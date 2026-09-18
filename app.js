document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.dataset.photoLink) return;
  const link = document.createElement('a');
  link.className = image.className + ' photo-unavailable';
  link.href = image.dataset.photoLink;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Photo sur le site du vendeur';
  link.setAttribute('aria-label', image.alt + ' : voir la photo chez le vendeur');
  image.replaceWith(link);
}, true);
import { matches, budgetFor, recommendation, restore, equipment, knownNumber } from './logic.js';

const main = document.querySelector('#main');
const dialog = document.querySelector('#detail');
const money = value => knownNumber(value) ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value) : 'Non renseigné';
const number = (value, unit = '') => knownNumber(value) ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)}${unit ? ` ${unit}` : ''}` : 'Non renseigné';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const date = value => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const statusNames = { stock: 'En stock au relevé', order: 'Sur commande', unavailable: 'Indisponible', unverified: 'Disponibilité à vérifier' };
const yesNo = value => value === true ? 'Oui, annoncé' : value === false ? 'Non' : 'Non confirmé';
const link = (url, label) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ${icon('arrow-up-right')}</a>`;
const icons = () => window.lucide?.createIcons();
let models = [], selected = [], favorites = [], favoritesOnly = false, differences = false;
let filters = {}, sort = 'price', view = 'catalogue', budgetId = 'moken10', estimates = {}, owned = [], shippingQuotes = {}, extras = 250;
const defaultProfile = { budget: 3000, environment: 'fresh', transport: 'roof', maxWeight: 35, maxLength: 420, bodyWeight: 80, gear: 20, seats: 1, priority: 'price' };
let profile = { ...defaultProfile };
let projectResult = null, toastTimer;
const byId = id => models.find(model => model.id === id);
const stored = key => { try { return localStorage.getItem(`rivage.${key}`); } catch { return null; } };
const save = (key, value) => { try { localStorage.setItem(`rivage.${key}`, JSON.stringify(value)); } catch { notify('Le stockage local est indisponible. Cette session reste utilisable.'); } };
function notify(message) { clearTimeout(toastTimer); document.querySelector('#toast').textContent = message; toastTimer = setTimeout(() => { document.querySelector('#toast').textContent = ''; }, 4500); }
function header(title, kicker, subtitle, edition = false) {
  return `<div class="section-head"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${subtitle}</p></div>${edition ? `<div class="edition"><div><strong>${models.length}</strong><span>références</span></div><div><strong>${new Set(models.map(model => model.brand)).size}</strong><span>marques</span></div></div>` : ''}</div>`;
}
function photo(model, className = 'photo', lazy = true) { return `<img class="${className}" src="${model.image}" data-photo-link="${escape(model.source)}" alt="${escape(`${model.brand} ${model.name}, photo produit`)}" ${lazy ? 'loading="lazy"' : ''} width="600" height="340">`; }
function selectOptions(options, active) { return options.map(([value, label]) => `<option value="${escape(value)}" ${String(value) === String(active) ? 'selected' : ''}>${escape(label)}</option>`).join(''); }
function selectionButton(model) { const active = selected.includes(model.id); return `<button data-action="select" data-id="${model.id}" aria-pressed="${active}">${icon(active ? 'check' : 'plus')}Comparer</button>`; }
function productCard(model) {
  return `<article class="kayak ${selected.includes(model.id) ? 'selected' : ''}" data-model="${model.id}"><div class="photo-top"><span class="status ${model.status}">${statusNames[model.status]}</span><button class="icon heart" data-action="favorite" data-id="${model.id}" aria-label="Favori : ${escape(model.name)}" title="Ajouter ou retirer des favoris" aria-pressed="${favorites.includes(model.id)}">${icon('heart')}</button></div>${photo(model)}<div class="card-content"><div class="card-title"><div><p class="eyebrow">${escape(model.brand)}</p><h3>${escape(model.name)}</h3></div><div class="price">${model.price === null ? 'À vérifier' : money(model.price)}<small>${model.price === null ? 'Prix de variante' : 'TTC · pack relevé'}</small></div></div><p class="version">${escape(model.version)}</p><dl class="specs"><div><dt>Longueur</dt><dd>${number(model.length / 100, 'm')}</dd></div><div><dt>Coque hors siège / drive</dt><dd class="${model.hullWeight === null ? 'unknown' : ''}">${number(model.hullWeight, 'kg')}</dd></div><div><dt>Propulsion</dt><dd>${model.drive === 'fins' ? 'Nageoires' : 'Hélice'}</dd></div></dl></div><div class="card-footer">${selectionButton(model)}<button class="text-button" data-action="detail" data-id="${model.id}">La fiche ${icon('arrow-up-right')}</button></div></article>`;
}
function catalogue() {
  const brands = [...new Set(models.map(model => model.brand))].sort((left, right) => left.localeCompare(right, 'fr'));
  main.innerHTML = `${header('Kayaks à pédales.', 'Pêche · Le catalogue', 'Offres françaises et packs identifiés. Prix TTC hors équipement complémentaire.', true)}<form class="filters" id="filters"><div class="filter-grid"><label class="search-field">Modèle ou marque${icon('search')}<input name="query" type="search" placeholder="Moken, Hobie, Galaxy…" value="${escape(filters.query || '')}"></label><label>Marque<select name="brand">${selectOptions([['all', 'Toutes les marques'], ...brands.map(brand => [brand, brand])], filters.brand || 'all')}</select></label><label>Prix du pack maximum (€)<input name="budget" type="number" min="0" step="50" placeholder="Sans limite" value="${filters.budget ?? ''}"></label><label>Transmission<select name="drive">${selectOptions([['all', 'Toutes'], ['propeller', 'Hélice'], ['fins', 'Nageoires']], filters.drive || 'all')}</select></label></div><details ${filters.maxLength || filters.maxWeight || filters.reverse || filters.france ? 'open' : ''}><summary>Transport, stockage & disponibilité</summary><div class="filter-grid extra"><label>Longueur maximum (cm)<input name="maxLength" type="number" min="100" max="800" placeholder="Sans limite" value="${filters.maxLength ?? ''}"></label><label>Coque hors siège / drive (kg max.)<input name="maxWeight" type="number" min="1" max="150" placeholder="Sans limite" value="${filters.maxWeight ?? ''}"></label><label class="check"><input name="reverse" type="checkbox" ${filters.reverse ? 'checked' : ''}>Marche arrière confirmée</label><label class="check"><input name="france" type="checkbox" ${filters.france ? 'checked' : ''}>Acheminement France documenté</label></div></details><div class="filter-bottom"><label class="check"><input name="stock" type="checkbox" ${filters.stock ? 'checked' : ''}>En stock au relevé uniquement</label><p>Une valeur inconnue ne satisfait jamais un critère obligatoire.</p><button type="reset" class="text-button">${icon('rotate-ccw')}Réinitialiser</button></div></form><div class="toolbar"><div><strong id="result-count"></strong><span class="subcount"> · relevé du ${date(models[0].checked)}</span></div><button data-action="favorites" aria-pressed="${favoritesOnly}">${icon('heart')}Favoris <span>${favorites.length}</span></button><label class="sort"><span>Trier par</span><select id="sort">${selectOptions([['price', 'Prix croissant'], ['price-desc', 'Prix décroissant'], ['weight', 'Coque la plus légère'], ['length', 'Le plus court'], ['brand', 'Marque']], sort)}</select></label></div><div id="catalogue-grid" class="grid"></div><p class="catalogue-note">${icon('info')}Prix et stocks observés, pas en temps réel. Les poids ne sont comparés que lorsque leur périmètre est explicite. Photos de variantes parfois différentes du coloris retenu ; crédit et source dans chaque fiche.</p>`;
  document.querySelector('#filters').addEventListener('input', event => {
    const field = event.target;
    filters[field.name] = field.type === 'checkbox' ? field.checked : field.type === 'number' ? field.value === '' ? undefined : Number(field.value) : field.value;
    renderProducts();
  });
  document.querySelector('#filters').addEventListener('submit', event => event.preventDefault());
  document.querySelector('#filters').addEventListener('reset', event => { event.preventDefault(); filters = {}; favoritesOnly = false; catalogue(); icons(); });
  document.querySelector('#sort').addEventListener('change', event => { sort = event.target.value; renderProducts(); });
  renderProducts();
}
function renderProducts() {
  const visible = models.filter(model => matches(model, filters) && (!favoritesOnly || favorites.includes(model.id)));
  visible.sort((left, right) => {
    if (sort === 'brand') return `${left.brand} ${left.name}`.localeCompare(`${right.brand} ${right.name}`, 'fr');
    const key = sort === 'weight' ? 'hullWeight' : sort === 'length' ? 'length' : 'price';
    if (!knownNumber(left[key])) return 1;
    if (!knownNumber(right[key])) return -1;
    return (left[key] - right[key]) * (sort === 'price-desc' ? -1 : 1);
  });
  document.querySelector('#result-count').textContent = `${visible.length} référence${visible.length > 1 ? 's' : ''}`;
  const grid = document.querySelector('#catalogue-grid');
  grid.innerHTML = visible.length ? visible.map(productCard).join('') : `<div class="empty" style="grid-column:1/-1">${icon('search-x')}<h2>Aucun kayak dans ce périmètre.</h2><p>${favoritesOnly ? 'Aucun favori ne correspond aux critères actifs.' : 'Les données inconnues sont exclues des critères obligatoires. Assouplissez un filtre ou revenez au catalogue complet.'}</p><button data-action="reset">${icon('rotate-ccw')}Revenir à tous les kayaks</button></div>`;
  icons();
}
function renderSelection() {
  document.querySelector('#nav-count').textContent = selected.length;
  const tray = document.querySelector('#selection');
  tray.hidden = selected.length === 0;
  document.body.classList.toggle('has-selection', selected.length > 0);
  tray.innerHTML = `<span class="selection-label">${selected.length} / 4 kayaks</span><div class="selection-items">${selected.map(id => `<div class="selection-item"><span>${escape(byId(id).name)}</span><button class="icon" data-action="select" data-id="${id}" aria-label="Retirer ${escape(byId(id).name)}" title="Retirer">${icon('x')}</button></div>`).join('')}</div><button class="icon" data-action="clear-selection" title="Vider la sélection" aria-label="Vider la sélection">${icon('trash-2')}</button><button class="sun" data-action="compare" ${selected.length < 2 ? 'disabled' : ''}>Face-à-face (${selected.length}) ${icon('arrow-right')}</button>`;
  icons();
}
function compareView() {
  const products = selected.map(byId);
  main.innerHTML = header('Face-à-face.', 'La sélection', 'Mêmes unités, mêmes définitions. Les mentions commerciales ne remplacent pas un essai.') + (products.length < 2 ? `<div class="empty">${icon('columns-3')}<h2>Deux kayaks, au minimum.</h2><p>Votre sélection contient ${products.length} référence. Le face-à-face accepte deux à quatre kayaks.</p><a class="button-link primary" href="#catalogue">Les kayaks ${icon('arrow-right')}</a></div>` : `<div class="inline-actions"><label class="check"><input type="checkbox" id="differences" ${differences ? 'checked' : ''}>Différences uniquement</label><button data-action="clear-selection" class="text-button">${icon('trash-2')}Vider la sélection</button></div><div class="table-wrap" tabindex="0" role="region" aria-label="Tableau comparatif défilant"><table class="comparison"><thead><tr><th scope="col">${products.length} références<br><small>Prix TTC observés</small></th>${products.map(model => `<th scope="col"><button class="icon remove" data-action="select" data-id="${model.id}" title="Retirer" aria-label="Retirer ${escape(model.name)}">${icon('x')}</button>${photo(model, '', false)}<p class="eyebrow">${escape(model.brand)}</p><h3>${escape(model.name)}</h3><button data-action="detail" data-id="${model.id}" class="text-button">Fiche & sources ${icon('arrow-up-right')}</button></th>`).join('')}</tr></thead><tbody>${comparisonRows(products)}</tbody></table></div><div class="notice warning">${icon('scale')}<p>La « capacité maximale » n’a pas une définition uniforme. Elle n’est jamais assimilée automatiquement au poids du pêcheur, ni à la charge disponible. La largeur seule ne prouve pas la stabilité.</p></div>`);
  document.querySelector('#differences')?.addEventListener('change', event => { differences = event.target.checked; compareView(); icons(); });
}
function comparisonRows(products) {
  const rows = [
    ['Offre & pack', null], ['Version exacte', model => escape(model.version)], ['Prix TTC', model => money(model.price)],
    ['Disponibilité au relevé', model => statusNames[model.status]], ['Vendeur', model => link(model.offerUrl, model.seller)],
    ['Livraison / retrait', model => `${knownNumber(model.shipping) ? money(model.shipping) : 'À chiffrer'}<br><small>${escape(model.shippingNote || 'Conditions et tarif à confirmer auprès du vendeur.')}</small>`],
    ...equipment.map(item => [item.label, model => model.pack[item.id] === true ? 'Inclus dans le pack' : model.pack[item.id] === false ? 'Non inclus' : 'Inclusion non confirmée']),
    ['Gabarit & manutention', null], ['Places', model => String(model.seats)], ['Longueur', model => number(model.length, 'cm')], ['Largeur', model => number(model.width, 'cm')],
    ['Coque hors siège / pédalier', model => number(model.hullWeight, 'kg')], ['Poids équipé annoncé', model => number(model.equippedWeight, 'kg')],
    ['Autre indication de masse', model => escape(model.weightNote || 'Aucune autre mesure documentée')], ['Pédalier seul', model => number(model.driveWeight, 'kg')],
    ['Capacité annoncée', model => `${number(model.capacity, 'kg')}<br><small>${escape(model.capacityNote || 'Périmètre non confirmé comme charge utile.')}</small>`], ['Limite du siège', model => number(model.seatCapacity, 'kg')],
    ['Propulsion & pêche', null], ['Transmission', model => model.drive === 'fins' ? 'Nageoires' : 'Hélice'], ['Marche arrière', model => yesNo(model.reverse)],
    ['Mécanisme / relevage', model => escape(model.driveNote || 'Procédure de relevage et protection aux chocs à confirmer sur la notice.')], ['Tirant d’eau en pédalage', () => 'Non renseigné'],
    ['Aménagement', model => escape(model.strengths)], ['Sondeur', model => escape(model.sonar || 'Compatibilité à confirmer')],
    ['Position debout', model => escape(model.standing || 'Non documentée ; essai accompagné nécessaire')], ['Stockage démonté', model => escape(model.modular || 'Aucun démontage de coque documenté')],
    ['Avant de décider', null], ['Points de vigilance', model => escape(model.cautions)], ['SAV & garantie', model => escape(model.service)],
    ['Date du relevé', model => date(model.checked)], ['Photo / source', model => link(model.imageSource, model.imageCredit)]
  ];
  return rows.map(([label, format]) => {
    if (!format) return `<tr class="group"><th colspan="${products.length + 1}">${label}</th></tr>`;
    const values = products.map(format);
    if (differences && new Set(values).size === 1) return '';
    return `<tr><th scope="row">${label}</th>${values.map(value => `<td>${value}</td>`).join('')}</tr>`;
  }).join('');
}
function budgetView() {
  const model = byId(budgetId) || models[0];
  budgetId = model.id;
  const cost = budgetFor(model, estimates, owned);
  main.innerHTML = `${header('Le budget équipé.', 'Au-delà du prix du kayak', 'Un panier de départ, pas un devis. Les accessoires sont des provisions modifiables, sans promesse de compatibilité.')}<div class="split"><div><label>Kayak et pack<select id="budget-model">${selectOptions(models.map(item => [item.id, `${item.brand} · ${item.name} · ${money(item.price)}`]), budgetId)}</select></label><p class="muted"><small>${escape(model.version)}</small></p><table class="budget-table"><thead><tr><th scope="col">Équipement</th><th scope="col">Déjà possédé</th><th scope="col">Provision (€)</th></tr></thead><tbody>${cost.lines.map(item => `<tr><td><strong>${item.label}</strong><br><small class="${item.included ? 'included' : ''}">${item.included ? 'Inclus : aucun ajout' : item.unknown ? 'Inclusion à confirmer' : 'Non inclus dans le pack'}</small></td><td>${item.included ? icon('check') : `<label class="check"><input type="checkbox" data-owned="${item.id}" ${item.owned ? 'checked' : ''}>Possédé</label>`}</td><td><input type="number" aria-label="Provision ${item.label}" min="0" max="10000" step="1" data-estimate="${item.id}" value="${item.included || item.owned ? 0 : estimates[item.id] ?? item.estimate}" ${item.included || item.owned ? 'disabled' : ''}></td></tr>`).join('')}</tbody></table><div class="form-section form-grid"><label>Livraison ou retrait (€)<input id="shipping-quote" type="number" min="0" max="5000" placeholder="${knownNumber(model.shipping) ? number(model.shipping) : 'Devis nécessaire'}" value="${shippingQuotes[budgetId] ?? ''}"><span class="field-hint">Valeur saisie = votre hypothèse. Vide = tarif de la source, s’il existe.</span></label><label>Autres frais / réserve (€)<input id="extras" type="number" min="0" max="20000" value="${extras}"><span class="field-hint">Vêtements adaptés à l’eau, repérage lumineux, étanchéité, matériel de pêche, transport…</span></label></div><div class="notice">${icon('truck')}<p>${escape(model.shippingNote || 'Livraison et retrait : tarif et conditions à confirmer auprès du vendeur.')}${model.shippingSource ? `<br>${link(model.shippingSource, 'Conditions de transport')}` : ''}</p></div><p><small>Aide à la flottabilité et autres équipements : vérifier taille, normes, usage et compatibilité. La réserve ne constitue pas une liste réglementaire complète. Un total bas ne prouve pas que le kayak est disponible.</small></p></div><aside class="budget-preview" id="budget-summary"></aside></div>`;
  document.querySelector('#budget-model').addEventListener('change', event => { budgetId = event.target.value; saveBudget(); budgetView(); icons(); });
  main.querySelectorAll('[data-owned]').forEach(input => input.addEventListener('change', () => { owned = input.checked ? [...owned, input.dataset.owned] : owned.filter(id => id !== input.dataset.owned); saveBudget(); budgetView(); icons(); }));
  main.querySelectorAll('[data-estimate]').forEach(input => input.addEventListener('input', () => { estimates[input.dataset.estimate] = Math.min(10000, Math.max(0, Number(input.value) || 0)); saveBudget(); budgetSummary(); }));
  document.querySelector('#shipping-quote').addEventListener('input', event => { if (event.target.value === '') delete shippingQuotes[budgetId]; else shippingQuotes[budgetId] = Math.min(5000, Math.max(0, Number(event.target.value) || 0)); saveBudget(); budgetSummary(); });
  document.querySelector('#extras').addEventListener('input', event => { extras = Math.min(20000, Math.max(0, Number(event.target.value) || 0)); saveBudget(); budgetSummary(); });
  budgetSummary();
}
function saveBudget() { save('budget', { budgetId, estimates, owned, shippingQuotes, extras }); }
function budgetSummary() {
  const model = byId(budgetId), manualShipping = Object.hasOwn(shippingQuotes, budgetId);
  const adjusted = { ...model, shipping: manualShipping ? shippingQuotes[budgetId] : model.shipping };
  const cost = budgetFor(adjusted, estimates, owned);
  document.querySelector('#budget-summary').innerHTML = `<p class="eyebrow">${escape(model.brand)}</p><h2>${escape(model.name)}</h2>${photo(model, '', false)}<span class="status ${model.status}">${statusNames[model.status]}</span><dl class="total-lines"><div><dt>Pack TTC relevé</dt><dd>${money(model.price)}</dd></div><div><dt>Équipement à ajouter</dt><dd>${money(cost.accessories)}</dd></div><div><dt>${manualShipping ? 'Transport saisi' : 'Transport source'}</dt><dd>${cost.shippingUnknown ? 'Non chiffré' : money(adjusted.shipping)}</dd></div><div><dt>Autres / réserve</dt><dd>${money(extras)}</dd></div></dl><p class="eyebrow">${cost.shippingUnknown ? 'Sous-total · transport non chiffré' : 'Total estimatif'}</p><div class="amount" id="budget-total">${cost.total === null ? 'Prix manquant' : money(cost.total + extras)}</div><p><small>${cost.shippingUnknown ? 'Les frais de transport inconnus ne sont pas inclus dans ce sous-total.' : 'Transport inclus selon la source ou votre saisie.'} ${cost.lines.some(item => item.unknown) ? 'Une provision reste ajoutée pour chaque inclusion non confirmée.' : ''}</small></p><div class="inline-actions"><button data-action="detail" data-id="${model.id}">${icon('file-text')}Vérifier le pack</button></div><small>Offre relevée le ${date(model.checked)}.<br>${link(model.offerUrl, model.seller)}</small>`;
  icons();
}
function projectView() {
  main.innerHTML = `${header('Votre prochain kayak.', 'Mon projet · Décision guidée', 'Des contraintes concrètes avant une préférence de marque. Les réponses ne constituent pas une validation de sécurité.')}<div class="split"><form id="project"><div class="form-grid"><label>Budget total maximum (€)<input required type="number" name="budget" min="1" max="30000" step="1" value="${profile.budget}"></label><label>Milieu principal<select name="environment">${selectOptions([['fresh', 'Lac / eau douce calme'], ['sea', 'Mer / littoral']], profile.environment)}</select></label></div><fieldset class="form-section"><legend>À terre</legend><div class="form-grid"><label>Transport<select name="transport">${selectOptions([['roof', 'Sur le toit du véhicule'], ['trailer', 'Remorque'], ['nearby', 'Stockage près de l’eau']], profile.transport)}</select></label><label>Limite de manutention de coque (kg)<input required type="number" name="maxWeight" min="1" max="150" step="0.1" value="${profile.maxWeight}"></label><label>Longueur de stockage disponible (cm)<input required type="number" name="maxLength" min="100" max="1000" value="${profile.maxLength}"></label><label>Places<select name="seats">${selectOptions([[1, 'Une personne'], [2, 'Deux personnes']], profile.seats)}</select></label></div><p>Le poids hors siège et pédalier n’est pas le poids à mettre à l’eau. Un modèle démontable nécessite des dimensions de sections confirmées.</p></fieldset><fieldset class="form-section"><legend>À bord</legend><div class="form-grid"><label>Votre poids équipé (kg)<input required type="number" name="bodyWeight" min="20" max="250" step="0.1" value="${profile.bodyWeight}"></label><label>Matériel + autre passager (kg)<input required type="number" name="gear" min="0" max="350" step="0.1" value="${profile.gear}"></label><label>Priorité<select name="priority">${selectOptions([['price', 'Budget le plus bas'], ['light', 'Coque la plus légère'], ['reverse', 'Marche arrière obligatoire']], profile.priority)}</select></label></div></fieldset><div class="inline-actions"><button type="submit" class="primary">${icon('compass')}Examiner les options</button></div></form><aside class="project-intro"><p class="eyebrow">Le bon ordre des questions</p><h2>Le porter.<br>Le ranger.<br>Puis le choisir.</h2><ul><li>Un kayak trop lourd à charger risque de rester au garage.</li><li>La capacité annoncée n’est pas nécessairement une charge utile.</li><li>La stabilité se vérifie en essai, avec votre gabarit et votre matériel.</li></ul><p><small>Calcul : pack + provisions de départ non incluses + transport documenté + réserve de 250 €. Les montants personnalisés de la vue Budget ne modifient pas ce calcul. Les inconnues restent à vérifier.</small></p></aside></div><section id="project-results" class="results" ${projectResult ? '' : 'hidden'}></section>`;
  document.querySelector('#project').addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    profile = { ...values, ...Object.fromEntries(['budget', 'maxWeight', 'maxLength', 'bodyWeight', 'gear', 'seats'].map(key => [key, Number(values[key])])) };
    save('profile', profile);
    projectResult = recommendation(models, { ...profile, budget: Math.max(0, profile.budget - 250), load: profile.bodyWeight + profile.gear });
    projectResults();
    document.querySelector('#project-results').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  if (projectResult) projectResults();
}
function projectResults() {
  const target = document.querySelector('#project-results');
  target.hidden = false;
  const { confirmed, toVerify } = projectResult;
  const cards = items => `<div class="grid">${items.map(item => `<article class="result">${photo(item.model, '', false)}<p class="eyebrow">${escape(item.model.brand)}</p><h3>${escape(item.model.name)}</h3><p><strong>${item.budget.total === null ? 'Prix incomplet' : money(item.budget.total + 250)}</strong> <small>${item.budget.shippingUnknown ? '+ transport à chiffrer' : 'estimés, réserve comprise'}</small></p><ul>${item.reasons.map(reason => `<li>${escape(reason)}</li>`).join('')}</ul>${item.missing.length ? `<p class="eyebrow">Vérifications bloquantes</p><ul class="checks">${item.missing.map(reason => `<li>${escape(reason)}</li>`).join('')}</ul>` : ''}<p class="tradeoff">${escape(item.model.cautions)}</p><div class="inline-actions">${selectionButton(item.model)}<button data-action="detail" data-id="${item.model.id}" title="Ouvrir la fiche" aria-label="Fiche ${escape(item.model.name)}" class="icon">${icon('arrow-up-right')}</button></div></article>`).join('')}</div>`;
  target.innerHTML = `<p class="eyebrow">Votre examen de compatibilité</p><h2>${confirmed.length ? `${confirmed.length} option${confirmed.length > 1 ? 's' : ''} compatible${confirmed.length > 1 ? 's' : ''} avec les données documentées` : 'Aucun modèle confirmé.'}</h2><div class="notice warning">${icon('clipboard-check')}<p>${confirmed.length ? 'Compatibilité sur les seuls critères saisis, à valider par un essai et un devis.' : 'Les données disponibles ne permettent pas de valider toutes vos contraintes. Aucun critère n’a été assoupli pour fabriquer un résultat.'} ${profile.environment === 'sea' ? 'En mer, la conformité et la distance autorisée nécessitent les documents de la version exacte.' : ''}</p></div>${confirmed.length ? cards(confirmed) : ''}${toVerify.length ? `<h3>Pistes à vérifier, pas des achats validés</h3><p class="muted">${toVerify.length} dossier${toVerify.length > 1 ? 's' : ''} sans incompatibilité chiffrée établie, mais avec des inconnues bloquantes.</p>${cards(toVerify)}` : `<p>Aucune piste dans ce périmètre. Réexaminez les contraintes de budget, de stockage ou de transport sans sacrifier votre sécurité.</p>`}`;
  icons();
}
function notebook() {
  main.innerHTML = `${header('Le carnet de bord.', 'Comprendre · Vérifier · Essayer', 'Les bonnes questions avant de payer, et avant de mettre à l’eau.')}<div class="editorial"><aside aria-label="Sommaire du carnet"><a href="#definitions">Les mots utiles</a><a href="#securite">Premières sorties</a><a href="#regles">Le cadre français</a><a href="#achat">Avant l’achat</a><a href="#sources">Méthode & sources</a></aside><article><section id="definitions"><h2>Comparer ce qui est comparable.</h2><dl class="glossary"><div><dt>Coque / équipé</dt><dd>La coque hors siège et pédalier n’est pas le kayak prêt à naviguer. Des vendeurs incluent gouvernail, trappes ou accessoires ; tout périmètre ambigu reste non renseigné dans les champs normalisés.</dd></div><div><dt>Capacité / charge utile</dt><dd>Selon la marque, « capacité » peut désigner une charge embarquée ou un total plus large. Ni votre poids seul ni une soustraction arbitraire ne suffisent. Demandez le manuel et la plaque du kayak.</dd></div><div><dt>Nageoires / hélice</dt><dd>Les nageoires oscillent sous la coque ; l’hélice tourne. Marche arrière, profondeur nécessaire et protection contre les chocs dépendent de la transmission exacte, pas seulement de la famille.</dd></div><div><dt>Marche arrière</dt><dd>Elle peut demander de rétropédaler, tirer un câble ou orienter une transmission. Un MirageDrive n’est pas automatiquement un MD180. Une option Cyclone ne décrit pas un pack Stepper.</dd></div><div><dt>Tirant d’eau</dt><dd>La profondeur nécessaire avec la propulsion déployée. Un mécanisme relevable ou Kick-Up ne donne pas une profondeur utilisable ; ralentir et suivre la procédure du fabricant près des obstacles.</dd></div><div><dt>Stabilité / position debout</dt><dd>Aucune note déduite de la largeur ou du marketing. La forme de coque, la charge, le réglage du siège, le vent et votre équilibre comptent. Essayez d’abord assis, dans un cadre accompagné.</dd></div></dl></section><section id="securite"><h2>La première sortie se prépare.</h2><ul><li>Portez une aide à la flottabilité adaptée à votre morphologie et à votre pratique. Une aide 50 N n’offre pas les mêmes fonctions qu’un gilet de sauvetage.</li><li>Choisissez un plan d’eau calme, une mise à l’eau simple et un accompagnement. Apprenez la remontée à bord après chavirement et le retour à la pagaie avant de vous éloigner.</li><li>Habillez-vous pour la température de l’eau. Eau froide, vent, courant et fatigue changent rapidement la situation.</li><li>Consultez météo, vent et évolution prévue ; en mer, marées et courant. Prévenez un proche de votre parcours et de votre heure de retour.</li><li>Gardez une pagaie de secours et un moyen de communication accessible et protégé. Les attaches peuvent créer un risque d’emmêlement, particulièrement en courant : faites valider l’installation par un encadrant.</li><li>Avant chaque départ : coque, bouchons, siège, gouvernail, fixation du pédalier et matériel de sécurité. Après l’eau salée : rinçage et entretien selon la notice, sans lubrifiant improvisé.</li></ul></section><section id="regles"><h2>En France, la longueur ne suffit pas.</h2><div class="notice warning">${icon('life-buoy')}<p>Aucun kayak du catalogue n’est déclaré ici « homologué mer ». Une mention commerciale ou une catégorie de conception ne valide pas votre zone de navigation.</p></div><p>La Division 240, dans sa version consultée le 18 septembre 2026, distingue notamment les engins de plage des autres embarcations à propulsion humaine. Une embarcation de moins de 3,50 m entre dans la définition d’un engin de plage ; au-delà, les conditions d’étanchéité, stabilité et flottabilité comptent aussi.</p><p>En pratique autonome, les engins de plage naviguent de jour dans la limite de 300 m d’un abri. Pour les autres embarcations à propulsion humaine, les extensions jusqu’à 2 puis 6 milles d’un abri sont soumises aux conditions de l’article 240-2.10, aux équipements requis et aux limites du fabricant. Un abri n’est pas simplement le point de côte le plus proche.</p><p>Entre 2 et 6 milles, des exigences supplémentaires s’appliquent, notamment la navigation de conserve à deux embarcations minimum, avec une exception encadrée, ainsi que la VHF et l’armement côtier spécifique. Ce résumé n’est pas une liste exhaustive d’équipement.</p><p>En eau intérieure, vérifiez les règlements locaux, les accès, les arrêtés et les restrictions du plan d’eau. Les règles de navigation et celles de la pêche sont distinctes : carte ou autorisation, espèces, tailles, périodes et réserves restent à vérifier auprès des autorités et de l’association locale.</p><ul class="sources-list"><li>${link('https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054217241', 'Légifrance · Article 240-2.10')}<br><small>Conditions d’utilisation de la propulsion humaine ; version en vigueur depuis le 7 juin 2026.</small></li><li>${link('https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054217248', 'Légifrance · Définitions 240-1.02')}</li><li>${link('https://www.mer.gouv.fr/les-divisions-securite-plaisance', 'Ministère chargé de la mer · Divisions 240 et 245')}</li><li>${link('https://www.sportsdenature.gouv.fr/canoe-kayak/reglementation/organisation', 'Sports de nature · Organisation et réglementation')}</li></ul></section><section id="achat"><h2>Le devis doit lever les inconnues.</h2><ol><li>Référence, millésime, coloris, nombre de sièges et de transmissions. Photo contractuelle ou illustrative ?</li><li>Poids de coque, poids complet, charge embarquée disponible et limite du siège, définis dans la notice.</li><li>Stock de la variante exacte, délai écrit, frais de livraison à votre adresse, accès camion et procédure de réception.</li><li>Marche arrière, relevage, tirant d’eau et pièces d’usure de ce pédalier précis.</li><li>Durée, exclusions et interlocuteur de garantie ; prix et disponibilité de l’hélice, des câbles, roulements et nageoires.</li><li>Essai avec votre gabarit, mise à l’eau et chargement du véhicule. Charge admissible du toit, des barres et des supports à vérifier ensemble.</li></ol></section><section id="sources"><h2>Un relevé, pas une promesse.</h2><p>${models.length} références, ${new Set(models.map(model => model.brand)).size} marques ou marques de distribution. Les variantes de propulsion et les tandems restent séparés. Les coloris ne sont pas comptés comme des modèles supplémentaires. Kayak Attitude est utilisé comme marque de distribution pour Bora et Raiatea, sans attribution de fabricant non vérifiée.</p><p>Relevés produits du ${date(models[0].checked)}. Priorité donnée aux offres exactes des marques, distributeurs français et revendeurs. Les données ne sont pas mises à jour en temps réel. Les sources commerciales ne constituent ni des essais indépendants ni une certification de conformité.</p><p>Chaque fiche indique la source, le vendeur, la variante, les réserves et le crédit photo. Une information contradictoire reste non confirmée. Toutes les capacités de ce relevé ont un périmètre à vérifier : elles ne peuvent pas valider le critère de charge de l’assistant.</p><p>Le budget additionne le pack, les équipements non inclus, le transport documenté et votre réserve. Une inclusion inconnue conserve une provision ; un transport inconnu est signalé hors sous-total. Les tarifs d’accessoires sont des hypothèses de préparation, pas des offres vérifiées.</p><p>Photos : droits réservés aux marques et vendeurs cités. Les photos sont chargées depuis les sites des marques et vendeurs, sans copie hébergée par Rivage. Votre navigateur contacte ces sites pour les afficher. Leur affichage ne vous confère aucun droit de réutilisation. La photo peut présenter un autre coloris ou des accessoires non inclus. Icônes Lucide sous licence ISC.</p><p>Favoris, sélection, projet et budget sont stockés seulement dans ce navigateur. Aucun compte, aucune télémétrie et aucune API d’IA. Les liens vendeurs ouvrent des sites externes.</p><button data-action="clear-local">${icon('trash-2')}Effacer mes données locales</button></section></article></div>`;
}
function detail(id) {
  const model = byId(id);
  if (!model) return;
  dialog.innerHTML = `<div class="dialog-head"><p class="eyebrow">Dossier produit · ${escape(model.brand)}</p><button class="icon" data-action="close" aria-label="Fermer la fiche" title="Fermer">${icon('x')}</button></div><div class="dialog-body"><div class="detail-top"><div>${photo(model, '', false)}<p class="source-credit">Photo : ${escape(model.imageCredit)}. Coloris et accessoires illustrés non contractuels.</p></div><div><span class="status ${model.status}">${statusNames[model.status]}</span><h2 id="detail-title">${escape(model.name)}</h2><p>${escape(model.version)}</p><div class="price">${money(model.price)}</div><p><small>${escape(model.priceType)}<br>Relevé du ${date(model.checked)}</small></p><div class="inline-actions">${selectionButton(model)}<button data-action="budget-model" data-id="${id}">${icon('wallet')}Budget</button></div></div></div><div class="notice warning">${icon('triangle-alert')}<p>${escape(model.cautions)}</p></div><div class="detail-sections"><section><h3>Dimensions & masses</h3><dl class="facts">${[['Longueur', number(model.length, 'cm')], ['Largeur', number(model.width, 'cm')], ['Coque hors siège / pédalier', number(model.hullWeight, 'kg')], ['Équipé, selon la source', number(model.equippedWeight, 'kg')], ['Pédalier seul', number(model.driveWeight, 'kg')], ['Capacité annoncée', number(model.capacity, 'kg')], ['Limite du siège', number(model.seatCapacity, 'kg')], ['Places', model.seats]].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl><p>${escape(model.weightNote || '')}</p><p>${escape(model.capacityNote || 'La capacité annoncée n’est pas confirmée comme charge utile disponible.')}</p>${model.modular ? `<p>${escape(model.modular)}</p>` : ''}</section><section><h3>Le pack retenu</h3><dl class="facts">${equipment.map(item => `<div><dt>${item.label}</dt><dd>${model.pack[item.id] === true ? 'Inclus' : model.pack[item.id] === false ? 'Non inclus' : 'À confirmer'}</dd></div>`).join('')}</dl><p>${escape(model.strengths)}</p></section><section><h3>Propulsion & pêche</h3><p><strong>${model.drive === 'fins' ? 'Nageoires' : 'Hélice'} · Marche arrière : ${yesNo(model.reverse)}</strong></p><p>${escape(model.driveNote || 'Relevage, protection aux chocs et entretien à vérifier dans la notice de cette transmission.')}</p><p>Tirant d’eau en pédalage : non renseigné.</p><p>Sondeur : ${escape(model.sonar || 'compatibilité et installation à confirmer.')}</p><p>${escape(model.standing || 'Aucune aptitude à la pêche debout validée ici.')}</p></section><section><h3>Achat & service</h3><p>${escape(model.shippingNote || 'Transport, tarif et disponibilité à votre adresse à confirmer.')}</p><p>${escape(model.service)}</p><p>${link(model.offerUrl, `Offre · ${model.seller}`)}</p>${model.shippingSource ? `<p>${link(model.shippingSource, 'Conditions de transport')}</p>` : ''}</section><section><h3>Traçabilité</h3><p>${escape(model.sourceKind)} · ${date(model.checked)}<br>${escape(model.sourceNote)}</p><p>${link(model.source, 'Fiche technique source')}</p><p>${link(model.imageSource, 'Photo originale et attribution')}</p></section><section><h3>Usage à confirmer</h3><p>La destination pêche et les affirmations du vendeur ne constituent pas une validation de sécurité. Aucun classement mer, score de stabilité ou avis d’essai indépendant n’est attribué.</p><p>Avant achat : un essai, les documents du kayak exact et un devis complet.</p></section></div></div>`;
  if (!dialog.open) dialog.showModal();
  icons();
}
function render() {
  const requested = location.hash.slice(1);
  const anchors = ['definitions', 'securite', 'regles', 'achat', 'sources'];
  view = anchors.includes(requested) ? 'carnet' : ['catalogue', 'comparatif', 'budget', 'projet', 'carnet'].includes(requested) ? requested : 'catalogue';
  document.querySelectorAll('.navigation a').forEach(anchor => { if (anchor.hash === `#${view}`) anchor.setAttribute('aria-current', 'page'); else anchor.removeAttribute('aria-current'); });
  ({ catalogue, comparatif: compareView, budget: budgetView, projet: projectView, carnet: notebook })[view]();
  renderSelection();
  icons();
  if (anchors.includes(requested)) document.getElementById(requested)?.scrollIntoView();
  else window.scrollTo({ top: 0, behavior: 'instant' });
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  const focusScope = button.closest('dialog') ? dialog : button.closest('#selection') ? document.querySelector('#selection') : main;
  if (action === 'retry') location.reload();
  if (action === 'detail') detail(id);
  if (action === 'close') dialog.close();
  if (action === 'select') {
    if (selected.includes(id)) selected = selected.filter(item => item !== id);
    else if (selected.length < 4) selected.push(id);
    else { notify('La sélection est limitée à quatre kayaks. Retirez une référence pour en ajouter une autre.'); return; }
    save('selection', selected);
    if (view === 'catalogue') renderProducts();
    if (view === 'comparatif') compareView();
    if (view === 'projet' && projectResult) projectResults();
    document.querySelectorAll(`[data-action="select"][data-id="${id}"]`).forEach(control => { if (control.hasAttribute('aria-pressed')) { control.setAttribute('aria-pressed', selected.includes(id)); control.innerHTML = `${icon(selected.includes(id) ? 'check' : 'plus')}Comparer`; } });
    renderSelection();
  }
  if (action === 'favorite') { favorites = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id]; save('favorites', favorites); catalogue(); icons(); }
  if (action === 'favorites') { favoritesOnly = !favoritesOnly; catalogue(); icons(); }
  if (action === 'reset') { filters = {}; favoritesOnly = false; catalogue(); icons(); }
  if (action === 'clear-selection') { selected = []; save('selection', selected); if (view === 'comparatif') compareView(); if (view === 'catalogue') renderProducts(); if (view === 'projet' && projectResult) projectResults(); renderSelection(); }
  if (action === 'compare') location.hash = 'comparatif';
  if (action === 'budget-model') { budgetId = id; saveBudget(); dialog.close(); if (view === 'budget') { budgetView(); icons(); } else location.hash = 'budget'; }
  if (action === 'clear-local') { for (const key of ['selection', 'favorites', 'budget', 'profile']) { try { localStorage.removeItem(`rivage.${key}`); } catch {} } selected = []; favorites = []; favoritesOnly = false; filters = {}; estimates = {}; owned = []; shippingQuotes = {}; extras = 250; budgetId = 'moken10'; profile = { ...defaultProfile }; projectResult = null; renderSelection(); notify('Les données locales de Rivage ont été effacées.'); }
  if (['select', 'favorite', 'favorites'].includes(action)) {
    const restored = focusScope.querySelector(`[data-action="${action}"]${id ? `[data-id="${id}"]` : ''}`);
    if (restored) restored.focus({ preventScroll: true });
    else if (!dialog.open) main.focus({ preventScroll: true });
  }
});
dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
window.addEventListener('hashchange', render);
try {
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error('Catalogue indisponible');
  models = await response.json();
  const ids = models.map(model => model.id);
  selected = restore(stored('selection'), ids, 4);
  favorites = restore(stored('favorites'), ids);
  try {
    const saved = JSON.parse(stored('budget'));
    if (saved && typeof saved === 'object') {
      if (ids.includes(saved.budgetId)) budgetId = saved.budgetId;
      if (Array.isArray(saved.owned)) owned = [...new Set(saved.owned.filter(id => equipment.some(item => item.id === id)))];
      for (const item of equipment) if (knownNumber(saved.estimates?.[item.id]) && saved.estimates[item.id] >= 0 && saved.estimates[item.id] <= 10000) estimates[item.id] = saved.estimates[item.id];
      for (const id of ids) if (knownNumber(saved.shippingQuotes?.[id]) && saved.shippingQuotes[id] >= 0 && saved.shippingQuotes[id] <= 5000) shippingQuotes[id] = saved.shippingQuotes[id];
      if (knownNumber(saved.extras) && saved.extras >= 0 && saved.extras <= 20000) extras = saved.extras;
    }
    const savedProfile = JSON.parse(stored('profile'));
    if (savedProfile && typeof savedProfile === 'object') {
      for (const key of ['budget', 'maxWeight', 'maxLength', 'bodyWeight', 'gear']) if (knownNumber(savedProfile[key]) && savedProfile[key] >= 0 && savedProfile[key] <= 30000) profile[key] = savedProfile[key];
      for (const [key, values] of Object.entries({ environment: ['fresh', 'sea'], transport: ['roof', 'trailer', 'nearby'], seats: [1, 2], priority: ['price', 'light', 'reverse'] })) if (values.includes(savedProfile[key])) profile[key] = savedProfile[key];
    }
  } catch {}
  render();
} catch (error) {
  main.innerHTML = `<div class="empty"><h1>Le catalogue n’a pas pu être ouvert.</h1><p>Vérifiez votre connexion puis réessayez. Le catalogue peut être temporairement indisponible.</p><button data-action="retry">Réessayer</button></div>`;
  console.error(error);
}