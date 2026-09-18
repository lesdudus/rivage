export const knownNumber = value => typeof value === 'number' && Number.isFinite(value);
export const equipment = [
  { id: 'drive', label: 'Pédalier', estimate: 800 },
  { id: 'seat', label: 'Siège', estimate: 150 },
  { id: 'paddle', label: 'Pagaie de secours', estimate: 65 },
  { id: 'rudder', label: 'Gouvernail', estimate: 120 },
  { id: 'pfd', label: 'Aide à la flottabilité adaptée', estimate: 110 },
  { id: 'cart', label: 'Chariot de mise à l’eau', estimate: 100 }
];

export function budgetFor(model, estimates = {}, owned = []) {
  const lines = equipment.map(item => {
    const included = model.pack?.[item.id] === true;
    const alreadyOwned = owned.includes(item.id);
    const unknown = !included && !alreadyOwned && model.pack?.[item.id] !== false;
    const estimate = estimates[item.id] ?? item.estimate;
    return { ...item, included, owned: alreadyOwned, unknown, amount: included || alreadyOwned ? 0 : Math.max(0, Number(estimate) || 0) };
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

export function recommendation(models, profile, estimates = {}) {
  const confirmed = [], toVerify = [];
  if (!knownNumber(profile.budget) || profile.budget <= 0) return { confirmed, toVerify };
  for (const model of models) {
    const missing = [], rejected = [], reasons = [];
    const budget = budgetFor(model, estimates);
    if (model.france !== true) missing.push('Livraison en France non confirmée');
    if (!['stock', 'order'].includes(model.status)) missing.push('Disponibilité non confirmée');
    if (model.status === 'unavailable') rejected.push('Indisponible');
    if (!knownNumber(budget.total)) missing.push('Prix non renseigné');
    else if (budget.total > profile.budget) rejected.push('Budget dépassé');
    else reasons.push('Budget indicatif compatible');
    if (budget.provisional) missing.push('Budget livré et contenu du pack à confirmer');
    if (profile.environment && model.environment?.[profile.environment] !== true) missing.push('Milieu de pêche non documenté');
    if (profile.environment === 'sea') missing.push('Conformité et zone de navigation à confirmer sur les documents du kayak exact');
    if (profile.seats && model.seats !== profile.seats) rejected.push('Nombre de places incompatible');
    if (knownNumber(profile.bodyWeight) && knownNumber(model.seatCapacity) && profile.bodyWeight > model.seatCapacity) rejected.push('Limite du siège dépassée');
    if (profile.transport === 'roof') missing.push('Charge admissible du toit, des barres et méthode de chargement à vérifier');
    if (knownNumber(profile.maxLength)) {
      if (!knownNumber(model.length)) missing.push('Longueur non renseignée');
      else if (model.length > profile.maxLength) rejected.push('Stockage trop court');
      else reasons.push('Longueur compatible avec le stockage');
    }
    if (knownNumber(profile.maxWeight)) {
      if (!knownNumber(model.hullWeight)) missing.push('Poids de coque nue non renseigné');
      else if (model.hullWeight > profile.maxWeight) rejected.push('Coque trop lourde pour la limite de transport');
      else reasons.push('Coque sous votre limite de manutention');
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