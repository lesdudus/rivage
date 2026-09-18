export const knownNumber = value => typeof value === 'number' && Number.isFinite(value);
export const equipment = [
  { id: 'drive', label: 'Pédalier', estimate: 800 },
  { id: 'seat', label: 'Siège', estimate: 150 },
  { id: 'paddle', label: 'Pagaie de secours', estimate: 65 },
  { id: 'rudder', label: 'Gouvernail', estimate: 120 },
  { id: 'pfd', label: 'Aide à la flottabilité adaptée', estimate: 110 },
  { id: 'cart', label: 'Chariot de mise à l’eau', estimate: 100, optional: true }
];

export function budgetFor(model, estimates = {}, owned = [], excluded = []) {
  const lines = equipment.map(item => {
    const included = model.pack?.[item.id] === true;
    const alreadyOwned = owned.includes(item.id);
    const omitted = item.optional === true && excluded.includes(item.id);
    const unknown = !included && !alreadyOwned && !omitted && model.pack?.[item.id] !== false;
    const estimate = estimates[item.id] ?? item.estimate;
    return { ...item, included, owned: alreadyOwned, omitted, unknown, amount: included || alreadyOwned || omitted ? 0 : Math.max(0, Number(estimate) || 0) };
  });
  const accessories = lines.reduce((sum, item) => sum + item.amount, 0);
  const total = knownNumber(model.price) ? model.price + accessories + (knownNumber(model.shipping) ? model.shipping : 0) : null;
  return { lines, accessories, total, shippingUnknown: !knownNumber(model.shipping), provisional: !knownNumber(model.price) || !knownNumber(model.shipping) || lines.some(item => item.unknown) };
}

export function matches(model, filters = {}) {
  if (filters.brand && filters.brand !== 'all' && model.brand !== filters.brand) return false;
  if (filters.drive && filters.drive !== 'all' && model.drive !== filters.drive) return false;
  if (filters.stock && model.status !== 'stock') return false;
  if (filters.france && model.france !== true) return false;
  if (knownNumber(filters.budget) && (!knownNumber(model.price) || model.price > filters.budget)) return false;
  if (knownNumber(filters.maxLength) && (!knownNumber(model.length) || model.length > filters.maxLength)) return false;
  if (knownNumber(filters.maxWeight) && (!knownNumber(model.hullWeight) || model.hullWeight > filters.maxWeight)) return false;
  if (filters.reverse && model.reverse !== true) return false;
  if (filters.query && !`${model.brand} ${model.name}`.toLocaleLowerCase('fr').includes(filters.query.toLocaleLowerCase('fr'))) return false;
  return true;
}

export function recommendation(models, profile, estimates = {}, owned = [], excluded = []) {
  const confirmed = [], toVerify = [];
  if (!knownNumber(profile.budget) || profile.budget <= 0) return { confirmed, toVerify };
  for (const model of models) {
    const missing = [], rejected = [], reasons = [];
    const budget = budgetFor(model, estimates, owned, excluded);
    if (profile.requireComplete) {
      for (const [field, label] of [['maxWeight', 'Ta limite de portage'], ['maxLength', 'Ton espace de stockage'], ['load', 'Le poids total à embarquer'], ['seats', 'Le nombre de places']]) if (!knownNumber(profile[field])) missing.push(`${label} reste à préciser`);
      if (!profile.environment) missing.push('Ton milieu de pêche reste à préciser');
      if (!profile.transport) missing.push('Ton transport reste à préciser');
      if (!knownNumber(profile.bodyWeight)) missing.push('Ton poids équipé reste à préciser pour vérifier le siège');
      if (profile.priority === 'comfort') missing.push('Confort et réglages du siège à valider par un essai');
    }
    if (model.france !== true) missing.push('Livraison en France non confirmée');
    if (!['stock', 'order'].includes(model.status)) missing.push('Disponibilité non confirmée');
    if (model.status === 'unavailable') rejected.push('Indisponible');
    if (!knownNumber(budget.total)) missing.push('Prix non renseigné');
    else if (budget.total > profile.budget) rejected.push('Budget dépassé');
    else reasons.push('Budget indicatif compatible');
    if (budget.provisional) missing.push('Budget livré et contenu du pack à confirmer');
    if (model.shippingEstimated) missing.push('Ton montant de transport saisi reste une hypothèse à confirmer');
    if (budget.lines.some(item => item.owned && !item.included)) missing.push('Taille, état et compatibilité du matériel déjà possédé à vérifier');
    if (profile.environment && model.environment?.[profile.environment] !== true) missing.push('Milieu de pêche non documenté');
    if (profile.environment === 'sea') missing.push('Conformité et zone de navigation à confirmer sur les documents du kayak exact');
    if (profile.seats && model.seats !== profile.seats) rejected.push('Nombre de places incompatible');
    if (knownNumber(profile.bodyWeight) && knownNumber(model.seatCapacity) && profile.bodyWeight > model.seatCapacity) rejected.push('Limite du siège dépassée');
    if (profile.requireComplete && knownNumber(profile.bodyWeight) && !knownNumber(model.seatCapacity)) missing.push('Limite de charge du siège non établie');
    if (profile.transport === 'roof') missing.push('Charge admissible du toit, des barres et méthode de chargement à vérifier');
    if (knownNumber(profile.maxLength)) {
      if (!knownNumber(model.length)) missing.push('Longueur non renseignée');
      else if (model.length > profile.maxLength) rejected.push('Stockage trop court');
      else reasons.push('Longueur compatible avec le stockage');
    }
    if (knownNumber(profile.maxWeight)) {
      if (!knownNumber(model.hullWeight)) missing.push('Poids de coque nue non renseigné');
      else if (model.hullWeight > profile.maxWeight) rejected.push('Coque trop lourde pour la limite de transport');
      else reasons.push('Coque sous ta limite de portage déclarée');
    }
    if (knownNumber(profile.load)) {
      if (!knownNumber(model.capacity) || model.capacityBasis !== 'payload') missing.push('Charge embarquée admissible non établie');
      else if (model.capacity < profile.load) rejected.push('Charge admissible insuffisante');
      else reasons.push('Charge déclarée compatible, à valider avec le fabricant');
    }
    if (profile.priority === 'reverse' && model.reverse !== true) {
      if (model.reverse === false) rejected.push('Pas de marche arrière'); else missing.push('Marche arrière non confirmée');
    }
    if (rejected.length) continue;
    const score = reasons.length + (profile.priority === 'light' && knownNumber(model.hullWeight) ? (70 - model.hullWeight) / 70 : 0) + (profile.priority === 'price' && knownNumber(budget.total) ? 1 - budget.total / profile.budget : 0);
    const item = { model, budget, reasons, missing, score };
    (missing.length ? toVerify : confirmed).push(item);
  }
  const rank = (left, right) => right.score - left.score || (left.budget.total ?? Infinity) - (right.budget.total ?? Infinity);
  return { confirmed: confirmed.sort(rank).slice(0, 3), toVerify: toVerify.sort(rank).slice(0, 3) };
}

export function restore(value, validIds, limit = Infinity) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? [...new Set(parsed.filter(id => validIds.includes(id)))].slice(0, limit) : [];
  } catch { return []; }
}

export const emptyProfile = Object.freeze({ version: 2, step: 0, environment: '', experience: '', fishing: '', transport: '', lifting: '', maxWeight: null, maxLength: null, bodyWeight: null, gear: null, seats: null, priority: '', comfort: '', budget: null });
export function normalizeProfile(value) {
  const profile = { ...emptyProfile };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return profile;
  for (const [field, [minimum, maximum]] of Object.entries({ budget: [1, 30000], maxWeight: [1, 150], maxLength: [100, 1000], bodyWeight: [20, 250], gear: [0, 350] })) {
    if (knownNumber(value[field]) && value[field] >= minimum && value[field] <= maximum) profile[field] = value[field];
  }
  for (const [field, options] of Object.entries({ environment: ['fresh', 'sea', 'river'], experience: ['new', 'some', 'regular'], fishing: ['roam', 'spot', 'both'], transport: ['roof', 'trailer', 'nearby'], lifting: ['solo', 'help'], seats: [1, 2], priority: ['price', 'light', 'reverse', 'comfort'], comfort: ['adjustable', 'space', 'try'] })) {
    if (options.includes(value[field])) profile[field] = value[field];
  }
  if (Number.isInteger(value.step) && value.step >= 0 && value.step <= 4) profile.step = value.step;
  return profile;
}

export function projectAdvice(profile) {
  const advice = [];
  if (profile.experience === 'new') advice.push('Tu découvres le kayak : un essai accompagné, le retour à la pagaie et la remontée à bord passent avant le choix des accessoires.');
  if (profile.lifting === 'solo') advice.push('Tu prévois de le charger seul : le poids à soulever et la hauteur de chargement méritent un essai réel, pas seulement une lecture de la fiche.');
  if (profile.transport === 'roof') advice.push('Tu envisages le toit de la voiture : vérifions ensemble la limite du toit, celle des barres et la façon de monter la coque.');
  if (profile.environment === 'sea') advice.push('Pour la mer, il faudra les documents du kayak exact et les règles de ta zone. Une longueur ou une mention commerciale ne suffit pas.');
  if (profile.environment === 'river') advice.push('Pour une rivière, le courant, les obstacles et le règlement local demandent un avis adapté au parcours. Aucun modèle n’est validé pour cet usage ici.');
  if (profile.fishing === 'roam') advice.push('Tu aimerais changer de poste : compare la propulsion lors d’un essai. Nous n’avons pas de mesures comparables de vitesse ou d’effort.');
  if (profile.fishing === 'spot') advice.push('Tu préfères rester sur un poste : essaie les réglages d’assise et l’accès aux cannes. La tenue au vent ne se déduit pas de la largeur.');
  if (profile.comfort) advice.push('Pour le confort, essayons le siège avec ta tenue de pêche : appui du dos, place pour les jambes et accès au pédalier.');
  return advice;
}