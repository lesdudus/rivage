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
import { matches, budgetFor, recommendation, restore, equipment, knownNumber, emptyProfile, normalizeProfile, projectAdvice } from './logic.js';

const main = document.querySelector('#main');
const dialog = document.querySelector('#detail');
const welcome = document.querySelector('#welcome');
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
let filters = {}, sort = 'price', view = 'catalogue', budgetId = 'moken10', estimates = {}, owned = [], excluded = [], shippingQuotes = {}, extras = 250, budgetChosen = false;
const defaultProfile = emptyProfile;
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
  main.insertAdjacentHTML('beforeend', `<section class="go-further" aria-labelledby="further-title"><div><p class="eyebrow">À ton rythme</p><h2 id="further-title">Pour aller plus loin</h2><p>Quelques kayaks te plaisent ? Regardons lesquels pourraient vraiment te convenir.</p></div><a class="button-link" href="#projet">${icon('compass')}Préparer ton projet${icon('arrow-right')}</a></section>`);
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
  const cost = currentBudget(model);
  const rows = cost.lines.map(item => `<tr><td><strong>${item.label}</strong><br><small class="${item.included ? 'included' : ''}">${item.included ? 'Inclus : aucun ajout' : item.owned ? 'Déjà possédé : compatibilité à vérifier' : item.omitted ? 'Non prévu dans ce budget' : item.unknown ? 'Inclusion à confirmer' : 'Non inclus dans le pack'}</small>${item.optional ? `<label class="optional-switch"><input type="checkbox" data-optional="${item.id}" ${item.omitted ? '' : 'checked'} ${item.included || item.owned ? 'disabled' : ''}>Prévoir cette option</label>` : ''}</td><td>${item.included ? icon('check') : `<label class="check"><input type="checkbox" data-owned="${item.id}" ${item.owned ? 'checked' : ''}>Possédé</label>`}</td><td><input type="number" aria-label="Provision ${item.label}" min="0" max="10000" step="1" data-estimate="${item.id}" value="${item.included || item.owned || item.omitted ? 0 : estimates[item.id] ?? item.estimate}" ${item.included || item.owned || item.omitted ? 'disabled' : ''}></td></tr>`);
  const baseRows = rows.filter((row, index) => !cost.lines[index].optional).join('');
  const optionalRows = rows.filter((row, index) => cost.lines[index].optional).join('');
  main.innerHTML = `${header('Préparons ton équipement.', 'Le budget équipé · Rien à compter deux fois', 'On distingue le pack, le matériel que tu as déjà et les achats à prévoir. Les provisions sont modifiables ; leur compatibilité reste à confirmer.')}<div class="split"><div><label>Kayak et pack à chiffrer<select id="budget-model">${selectOptions(models.map(item => [item.id, `${item.brand} · ${item.name} · ${money(item.price)}`]), budgetId)}</select></label><p class="muted"><small>${escape(model.version)}</small></p><div class="budget-choice">${budgetChosen ? `${icon('bookmark-check')}Cette piste est dans ton projet. <a href="#projet">Faire le point</a>` : `<span>Simulation uniquement : aucun kayak retenu.</span><button data-action="choose" data-id="${model.id}">${icon('bookmark-plus')}Retenir ce kayak</button>`}</div><table class="budget-table"><thead><tr><th scope="col">Équipement</th><th scope="col">Déjà possédé</th><th scope="col">Provision (€)</th></tr></thead><tbody><tr class="equipment-group"><th colspan="3">La base à prévoir ou à vérifier</th></tr>${baseRows}<tr class="equipment-group"><th colspan="3">En option, selon la mise à l’eau</th></tr>${optionalRows}</tbody></table><div class="form-section form-grid"><label>Livraison ou retrait (€)<input id="shipping-quote" type="number" min="0" max="5000" placeholder="${knownNumber(model.shipping) ? number(model.shipping) : 'Devis nécessaire'}" value="${shippingQuotes[budgetId] ?? ''}"><span class="field-hint">Valeur saisie = ton hypothèse, à confirmer. Vide = tarif de la source, s’il existe.</span></label><label>Autres frais / réserve (€)<input id="extras" type="number" min="0" max="20000" value="${extras}"><span class="field-hint">Vêtements adaptés à l’eau, repérage lumineux, étanchéité, matériel de pêche, transport…</span></label></div><div class="notice">${icon('truck')}<p>${escape(model.shippingNote || 'Livraison et retrait : tarif et conditions à confirmer auprès du vendeur.')}${model.shippingSource ? `<br>${link(model.shippingSource, 'Conditions de transport')}` : ''}</p></div><p><small>Pour l’aide à la flottabilité et les autres équipements, vérifie taille, normes, état et compatibilité avec le vendeur. Il ne s’agit ni d’un devis ni d’une liste réglementaire complète. Un total bas ne prouve pas la disponibilité.</small></p></div><aside class="budget-preview" id="budget-summary"></aside></div>`;
  document.querySelector('#budget-model').addEventListener('change', event => { budgetId = event.target.value; saveBudget(); budgetView(); icons(); document.querySelector('#budget-model').focus(); });
  main.querySelectorAll('[data-owned]').forEach(input => input.addEventListener('change', () => { owned = input.checked ? [...new Set([...owned, input.dataset.owned])] : owned.filter(id => id !== input.dataset.owned); saveBudget(); budgetView(); icons(); document.querySelector(`[data-owned="${input.dataset.owned}"]`).focus(); }));
  main.querySelectorAll('[data-optional]').forEach(input => input.addEventListener('change', () => { excluded = input.checked ? excluded.filter(id => id !== input.dataset.optional) : [...new Set([...excluded, input.dataset.optional])]; saveBudget(); budgetView(); icons(); document.querySelector(`[data-optional="${input.dataset.optional}"]`).focus(); }));
  main.querySelectorAll('[data-estimate]').forEach(input => input.addEventListener('input', () => { estimates[input.dataset.estimate] = Math.min(10000, Math.max(0, Number(input.value) || 0)); saveBudget(); budgetSummary(); }));
  document.querySelector('#shipping-quote').addEventListener('input', event => { if (event.target.value === '') delete shippingQuotes[budgetId]; else shippingQuotes[budgetId] = Math.min(5000, Math.max(0, Number(event.target.value) || 0)); saveBudget(); budgetSummary(); });
  document.querySelector('#extras').addEventListener('input', event => { extras = Math.min(20000, Math.max(0, Number(event.target.value) || 0)); saveBudget(); budgetSummary(); });
  budgetSummary();
}
function saveBudget() { save('budget', { budgetId, estimates, owned, excluded, shippingQuotes, extras, budgetChosen }); projectResult = null; }
function budgetSummary() {
  const model = byId(budgetId), cost = currentBudget(model);
  document.querySelector('#budget-summary').innerHTML = `<p class="eyebrow">${escape(model.brand)}</p><h2>${escape(model.name)}</h2>${photo(model, '', false)}<span class="status ${model.status}">${statusNames[model.status]}</span><dl class="total-lines"><div><dt>Pack TTC relevé</dt><dd>${money(model.price)}</dd></div><div><dt>Équipement à ajouter</dt><dd>${money(cost.accessories)}</dd></div><div><dt>${cost.manualShipping ? 'Transport saisi (hypothèse)' : 'Transport source'}</dt><dd>${cost.shippingUnknown ? 'Non chiffré' : money(cost.adjusted.shipping)}</dd></div><div><dt>Autres / réserve</dt><dd>${money(extras)}</dd></div></dl><p class="eyebrow">${cost.shippingUnknown ? 'Sous-total · transport non chiffré' : 'Total estimatif'}</p><div class="amount" id="budget-total">${cost.total === null ? 'Prix manquant' : money(cost.total)}</div><p><small>${cost.shippingUnknown ? 'Les frais de transport inconnus ne sont pas inclus dans ce sous-total.' : cost.manualShipping ? 'Ton montant de transport reste à confirmer avec le vendeur.' : 'Transport inclus selon la source.'} ${cost.lines.some(item => item.unknown) ? 'Une provision reste ajoutée pour chaque inclusion non confirmée.' : ''}</small></p><div class="inline-actions"><button data-action="detail" data-id="${model.id}">${icon('file-text')}Vérifier le pack</button></div><small>Offre relevée le ${date(model.checked)}.<br>${link(model.offerUrl, model.seller)}</small>`;
  icons();
}
function projectView() {
  const stages = ['Tes sorties', 'À terre', 'À bord', 'Ton budget', 'Le point ensemble'];
  const titles = ['Où aimerais-tu aller pêcher ?', 'Comment se passera la mise à l’eau ?', 'Faisons de la place au confort.', 'Gardons une place pour l’équipement.'];
  const introductions = ['Un lac tranquille, le littoral, une rivière… Le point de départ, ce sont les sorties qui te font envie.', 'Le bon kayak, c’est aussi celui que tu peux transporter et ranger sans difficulté.', 'Le siège, les jambes et la charge comptent autant que la fiche technique. Un essai restera précieux.', 'L’enveloppe comprend le kayak, ce qui manque pour le préparer et les frais de transport. Pas seulement le prix affiché.'];
  const groups = [['environment', 'experience', 'fishing'], ['transport', 'lifting', 'maxWeight', 'maxLength'], ['seats', 'bodyWeight', 'gear', 'comfort', 'priority'], ['budget']];
  main.innerHTML = `${header(profile.step === 0 ? 'Bonjour Franck.' : 'On avance à ton rythme.', 'Ton kayak de pêche · Préparons-le ensemble', profile.step === 0 ? 'On prépare ton kayak ? Commençons par les sorties que tu aimerais faire.' : 'Rien n’oblige à tout décider aujourd’hui. On peut revenir sur chaque choix.')}<nav class="project-steps" aria-label="Étapes de ton projet">${stages.map((label, index) => `<button data-action="project-step" data-id="${index}" ${profile.step === index ? 'aria-current="step"' : ''}><span>${index + 1}</span>${label}</button>`).join('')}</nav><div class="project-layout"><div>${profile.step < 4 ? `<form id="project" class="project-questions"><p class="eyebrow">${profile.step + 1} sur 4 · ${stages[profile.step]}</p><h2 id="question-title" tabindex="-1">${titles[profile.step]}</h2><p class="question-intro">${introductions[profile.step]}</p><div class="form-grid">${groups[profile.step].map(projectField).join('')}</div>${profile.step === 3 ? `<fieldset class="form-section"><legend>Ce que tu as déjà</legend><p>À conserver si la taille, l’état et la compatibilité conviennent au kayak choisi.</p><div class="owned-grid">${equipment.map(item => `<label class="check"><input data-project-owned="${item.id}" type="checkbox" ${owned.includes(item.id) ? 'checked' : ''}>${item.label}</label>`).join('')}</div></fieldset><div class="notice">${icon('wallet')}<p>Une réserve de ${money(extras)} est prévue pour les autres frais. On pourra l’ajuster dans le budget équipé. Ce n’est pas un devis ni une liste de sécurité complète.</p></div>` : ''}<p class="uncertain-note">Un point encore flou ? Tu peux le laisser à préciser. Il ne sera pas considéré comme vérifié.</p><div class="project-actions">${profile.step ? `<button type="button" data-action="project-step" data-id="${profile.step - 1}">${icon('arrow-left')}Revenir</button>` : `<a href="#catalogue">Je regarde les kayaks d’abord</a>`}<button type="submit" class="primary">${profile.step === 3 ? 'Faire le point' : 'On continue'}${icon('arrow-right')}</button></div></form>` : `<section class="project-review"><p class="eyebrow">Tes repères, sans raccourcis</p><h2 id="question-title" tabindex="-1">Le point, tranquillement.</h2><p>On a séparé tes envies, tes contraintes et ce qui demande encore une réponse. Un kayak retenu ici reste une piste, pas un achat validé.</p><div id="personal-advice"></div><div class="inline-actions"><a class="button-link primary" href="#catalogue">${icon('search')}Explorer les kayaks</a><a class="button-link" href="#budget">${icon('wallet')}Préparer l’équipement</a></div><section id="project-shortlist"></section></section>`}</div><aside id="project-summary" class="project-summary" aria-label="Le projet de Franck"></aside></div>${profile.step === 4 ? '<section id="project-results" class="results"></section>' : ''}`;
  const form = document.querySelector('#project');
  form?.addEventListener('input', event => {
    const field = event.target;
    if (field.dataset.projectOwned) {
      owned = field.checked ? [...new Set([...owned, field.dataset.projectOwned])] : owned.filter(id => id !== field.dataset.projectOwned);
      saveBudget();
    } else if (field.name) {
      const value = field.value === '' ? null : field.type === 'number' || field.name === 'seats' ? Number(field.value) : field.value;
      profile = normalizeProfile({ ...profile, [field.name]: value });
      save('profile', profile);
      projectResult = null;
    }
    projectSummary();
  });
  form?.addEventListener('submit', event => { event.preventDefault(); setProjectStep(profile.step + 1); });
  projectSummary();
  if (profile.step === 4) {
    const advice = projectAdvice(profile);
    document.querySelector('#personal-advice').innerHTML = advice.length ? `<ul class="advice-list">${advice.map(text => `<li>${icon('compass')}<span>${escape(text)}</span></li>`).join('')}</ul>` : '<p class="muted">Tes envies restent ouvertes. Aucun poids, budget ou niveau d’expérience n’a été choisi à ta place.</p>';
    projectShortlist();
    projectResults();
  }
  icons();
  const steps = document.querySelector('.project-steps'), current = steps.querySelector('[aria-current="step"]');
  steps.scrollLeft = current.offsetLeft - steps.offsetLeft - (steps.clientWidth - current.clientWidth) / 2;
}

const projectQuestions = {
  environment: { label: 'Ton milieu de pêche', options: [['fresh', 'Lac / eau douce calme'], ['sea', 'Mer / littoral'], ['river', 'Rivière']], hint: 'Courant, vent et règles locales changent ce qu’il faut vérifier.' },
  experience: { label: 'Ton expérience du kayak', options: [['new', 'Je découvre'], ['some', 'J’en ai déjà fait quelques fois'], ['regular', 'Je pratique régulièrement']] },
  fishing: { label: 'Le genre de sortie qui te tente', options: [['roam', 'Explorer et changer de poste'], ['spot', 'Pêcher tranquillement sur un poste'], ['both', 'Un peu des deux']] },
  transport: { label: 'Comment emmènerais-tu le kayak ?', options: [['roof', 'Sur le toit de la voiture'], ['trailer', 'Sur une remorque'], ['nearby', 'Il resterait près de l’eau']] },
  lifting: { label: 'Pour le charger et le déplacer', options: [['solo', 'Je serais seul'], ['help', 'Quelqu’un pourrait m’aider']] },
  maxWeight: { label: 'Ta limite de portage de coque (kg)', min: 1, max: 150, hint: 'Coque sans siège ni pédalier. Si tu n’as pas essayé, ne devine pas une limite.' },
  maxLength: { label: 'Longueur disponible pour le ranger (cm)', min: 100, max: 1000, hint: 'Mesure aussi le passage de la porte. Le kayak ne se plie pas forcément.' },
  seats: { label: 'À combien voudrais-tu partir ?', options: [[1, 'Seul à bord'], [2, 'À deux dans le kayak']] },
  bodyWeight: { label: 'Ton poids avec ta tenue de pêche (kg)', min: 20, max: 250, hint: 'Il sert à vérifier la limite du siège. Ta réponse reste dans ce navigateur.' },
  gear: { label: 'Matériel et autre passager éventuel (kg)', min: 0, max: 350, hint: 'Eau, affaires, équipement et éventuel passager, sans compter ton propre poids.' },
  comfort: { label: 'Ce que tu veux surtout essayer', options: [['adjustable', 'Les réglages et l’appui du siège'], ['space', 'La place pour les jambes'], ['try', 'L’ensemble, avant de décider']] },
  priority: { label: 'Ta priorité entre les modèles', options: [['price', 'Le budget le plus bas'], ['light', 'Une coque plus facile à porter'], ['reverse', 'La marche arrière, indispensable'], ['comfort', 'Le confort, à vérifier en essai']] },
  budget: { label: 'Ton enveloppe totale maximum (€)', min: 1, max: 30000, hint: 'Kayak, équipement manquant, transport et réserve compris. Aucun montant n’est imposé.' }
};
function projectField(field) {
  const question = projectQuestions[field];
  return `<label>${question.label}${question.options ? `<select name="${field}">${selectOptions([['', 'Je ne sais pas encore'], ...question.options], profile[field] ?? '')}</select>` : `<input name="${field}" type="number" min="${question.min}" max="${question.max}" step="${field === 'budget' || field === 'maxLength' ? 1 : 0.1}" placeholder="À préciser" value="${profile[field] ?? ''}">`}${question.hint ? `<span class="field-hint">${question.hint}</span>` : ''}</label>`;
}
function setProjectStep(step) {
  if (document.querySelector('#project') && !document.querySelector('#project').reportValidity()) return;
  profile = normalizeProfile({ ...profile, step: Number(step) });
  save('profile', profile);
  projectView();
  document.querySelector('#question-title')?.focus();
}
function profileAnswer(field) {
  const value = profile[field];
  if (value === null || value === '') return 'À préciser';
  const options = projectQuestions[field].options;
  if (options) return options.find(([option]) => option === value)?.[1] || 'À préciser';
  return field === 'budget' ? money(value) : number(value, field === 'maxLength' ? 'cm' : 'kg');
}
function currentBudget(model = byId(budgetId)) {
  const manualShipping = Object.hasOwn(shippingQuotes, model.id);
  const adjusted = { ...model, shipping: manualShipping ? shippingQuotes[model.id] : model.shipping };
  const cost = budgetFor(adjusted, estimates, owned, excluded);
  return { ...cost, total: cost.total === null ? null : cost.total + extras, adjusted, manualShipping };
}
function projectSummary() {
  const target = document.querySelector('#project-summary');
  if (!target) return;
  const model = byId(budgetId), cost = currentBudget(model);
  target.innerHTML = `<p class="eyebrow">Ton carnet personnel</p><h2>Le projet de Franck</h2><dl class="project-facts">${[['environment', 'Sorties', 0], ['experience', 'Expérience', 0], ['fishing', 'Pêche', 0], ['transport', 'Transport', 1], ['lifting', 'Chargement', 1], ['maxWeight', 'Portage', 1], ['maxLength', 'Rangement', 1], ['seats', 'Places', 2], ['bodyWeight', 'Ton poids équipé', 2], ['gear', 'Autre charge', 2], ['comfort', 'Confort', 2], ['priority', 'Priorité', 2], ['budget', 'Enveloppe', 3]].map(([field, label, step]) => `<div><dt>${label}</dt><dd>${escape(profileAnswer(field))}<button class="edit-answer" data-action="project-step" data-id="${step}" aria-label="Modifier : ${label}" title="Modifier cette réponse">${icon('pencil')}</button></dd></div>`).join('')}</dl><div class="project-kit"><h3>${budgetChosen ? escape(model.name) : 'Le kayak reste à choisir'}</h3>${budgetChosen ? `${photo(model, 'summary-photo', false)}<p><strong>${cost.total === null ? 'Prix manquant' : money(cost.total)}</strong> <small>${cost.shippingUnknown ? '+ transport à chiffrer' : 'estimés'}</small></p><small>Pack + équipement manquant + transport chiffré + ${money(extras)} de réserve.</small>${knownNumber(profile.budget) && knownNumber(cost.total) && cost.total > profile.budget ? `<p class="budget-over">Au-dessus de ton enveloppe de ${money(cost.total - profile.budget)}.</p>` : ''}<p><a href="#budget">Revoir ce budget ${icon('arrow-up-right')}</a></p><button class="text-button" data-action="unchoose">${icon('x')}Retirer ce kayak du projet</button>` : '<p>Un favori permet de garder une piste sans prendre de décision.</p>'}<p><small>Déjà possédé : ${owned.length ? equipment.filter(item => owned.includes(item.id)).map(item => item.label).join(', ') : 'rien renseigné'}.</small></p><p><small>En option : chariot ${excluded.includes('cart') ? 'non prévu' : 'provisionné'}. Compatibilité à confirmer pour le matériel conservé.</small></p></div><p class="privacy-note">${icon('lock-keyhole')}Tes réponses restent sur cet appareil. Elles ne sont ni publiées ni partagées avec les visiteurs du site.</p><button data-action="clear-local" class="text-button">${icon('trash-2')}Effacer mon projet</button>`;
  icons();
}
function projectShortlist() {
  const target = document.querySelector('#project-shortlist');
  if (!target) return;
  const ids = [...new Set([...favorites, ...selected, ...(budgetChosen ? [budgetId] : [])])];
  target.innerHTML = `<h3>Tes kayaks à regarder de plus près</h3>${ids.length ? `<div class="shortlist">${ids.map(id => { const model = byId(id); return `<article class="shortlist-item">${photo(model, 'shortlist-photo', false)}<div><small>${escape(model.brand)}</small><h4>${escape(model.name)}</h4><small>${money(model.price)} · pack relevé</small></div><div class="shortlist-actions"><button class="icon" data-action="detail" data-id="${id}" aria-label="Examiner ${escape(model.name)}" title="Examiner la fiche">${icon('file-text')}</button><button class="icon" data-action="choose" data-id="${id}" aria-label="Retenir ${escape(model.name)} pour le projet" title="Retenir pour le projet" aria-pressed="${budgetChosen && budgetId === id}">${icon('check')}</button></div></article>`; }).join('')}</div>` : '<p class="muted">Aucune piste mise de côté pour le moment. On peut commencer par comparer deux kayaks qui te plaisent.</p>'}`;
  if (budgetChosen) {
    const model = byId(budgetId), cost = currentBudget(model);
    const assessment = examineModels([{ ...cost.adjusted, shippingEstimated: cost.manualShipping }]);
    const match = [...assessment.confirmed, ...assessment.toVerify][0];
    target.insertAdjacentHTML('beforeend', `<section class="chosen-checks"><h3>Avant de retenir ${escape(model.name)}</h3>${match ? `<p>Les critères chiffrés renseignés ne l’excluent pas. Il reste à vérifier :</p><ul>${[...match.missing, 'Un essai avec ta tenue et ton matériel, puis un devis pour cette version exacte'].map(text => `<li>${escape(text)}</li>`).join('')}</ul>` : `<p class="budget-over">${knownNumber(profile.budget) ? 'Cette piste ne passe pas les contraintes renseignées. Revois ensemble le budget, le poids, le stockage, les places et la disponibilité avant de la retenir.' : 'Ton enveloppe manque encore : on ne peut pas vérifier ce choix.'}</p>`}<p><small>Relevé du ${date(model.checked)} · ${escape(model.version)}. ${link(model.offerUrl, 'Demander confirmation au vendeur')}</small></p></section>`);
  }
  icons();
}
function examineModels(candidates) {
  return recommendation(candidates, { ...profile, requireComplete: true, budget: knownNumber(profile.budget) ? Math.max(0, profile.budget - extras) : null, load: knownNumber(profile.bodyWeight) && knownNumber(profile.gear) ? profile.bodyWeight + profile.gear : null }, estimates, owned, excluded);
}
function projectResults() {
  const target = document.querySelector('#project-results');
  if (!target) return;
  target.hidden = false;
  const candidates = models.map(model => Object.hasOwn(shippingQuotes, model.id) ? { ...model, shipping: shippingQuotes[model.id], shippingEstimated: true } : model);
  projectResult = examineModels(candidates);
  const { confirmed, toVerify } = projectResult;
  const cards = items => `<div class="grid">${items.map(item => `<article class="result">${photo(item.model, '', false)}<p class="eyebrow">${escape(item.model.brand)}</p><h3>${escape(item.model.name)}</h3><p><strong>${item.budget.total === null ? 'Prix incomplet' : money(item.budget.total + extras)}</strong> <small>${item.budget.shippingUnknown ? '+ transport à chiffrer' : 'estimés, réserve comprise'}</small></p><ul>${item.reasons.map(reason => `<li>${escape(reason)}</li>`).join('')}</ul>${item.missing.length ? `<p class="eyebrow">À confirmer avant de décider</p><ul class="checks">${item.missing.map(reason => `<li>${escape(reason)}</li>`).join('')}</ul>` : ''}<p class="tradeoff">${escape(item.model.cautions)}</p><div class="inline-actions">${selectionButton(item.model)}<button data-action="choose" data-id="${item.model.id}">${icon('bookmark-plus')}Retenir cette piste</button><button data-action="detail" data-id="${item.model.id}" title="Ouvrir la fiche" aria-label="Fiche ${escape(item.model.name)}" class="icon">${icon('arrow-up-right')}</button></div></article>`).join('')}</div>`;
  target.innerHTML = `<p class="eyebrow">Ce que les données permettent de dire</p><h2>${confirmed.length ? `${confirmed.length} piste${confirmed.length > 1 ? 's' : ''} compatible${confirmed.length > 1 ? 's' : ''} avec les critères documentés` : 'Aucun modèle confirmé.'}</h2><div class="notice warning">${icon('clipboard-check')}<p>${confirmed.length ? 'On a une compatibilité sur les critères renseignés, pas une garantie de sécurité. Restent un essai et un devis.' : 'Il manque encore des réponses ou des preuves pour tout vérifier. Ce n’est pas une impasse : on peut préparer les bonnes questions pour le vendeur.'} ${profile.environment === 'sea' ? 'En mer, demandons les documents de la version exacte.' : ''}</p></div><p><small>Même panier que ton budget équipé : matériel possédé déduit, options respectées, ${money(extras)} de réserve. Les montants saisis restent des estimations.</small></p>${confirmed.length ? cards(confirmed) : ''}${toVerify.length ? `<h3>Pistes à examiner, sans validation d’achat</h3><p class="muted">Aucune incompatibilité chiffrée établie sur tes réponses, mais les points ci-dessous restent ouverts.</p>${cards(toVerify)}` : `<p>${knownNumber(profile.budget) ? 'Aucune piste dans cette enveloppe avec les contraintes connues. On peut revoir le projet sans assouplir une limite de sécurité.' : 'Ton enveloppe reste à préciser. On ne va pas en inventer une : le catalogue reste ouvert pour te faire une idée.'}</p><button data-action="project-step" data-id="3">${icon('wallet')}Revoir mon enveloppe</button>`}`;
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
  if (action === 'welcome-close') welcome.close();
  if (action === 'welcome-browse') { welcome.close(); if (view !== 'catalogue') location.hash = 'catalogue'; }
  if (action === 'project-step') setProjectStep(id);
  if (action === 'choose') { budgetId = id; budgetChosen = true; saveBudget(); profile.step = 4; save('profile', profile); if (dialog.open) dialog.close(); if (view === 'projet') projectView(); else location.hash = 'projet'; notify('Cette piste est conservée. Les vérifications restent à faire avant tout achat.'); }
  if (action === 'unchoose') { budgetChosen = false; saveBudget(); projectSummary(); projectShortlist(); }
  if (action === 'detail') detail(id);
  if (action === 'close') dialog.close();
  if (action === 'select') {
    if (selected.includes(id)) selected = selected.filter(item => item !== id);
    else if (selected.length < 4) selected.push(id);
    else { notify('La sélection est limitée à quatre kayaks. Retirez une référence pour en ajouter une autre.'); return; }
    save('selection', selected);
    if (view === 'catalogue') renderProducts();
    if (view === 'comparatif') compareView();
    if (view === 'projet') { projectShortlist(); if (profile.step === 4) projectResults(); }
    document.querySelectorAll(`[data-action="select"][data-id="${id}"]`).forEach(control => { if (control.hasAttribute('aria-pressed')) { control.setAttribute('aria-pressed', selected.includes(id)); control.innerHTML = `${icon(selected.includes(id) ? 'check' : 'plus')}Comparer`; } });
    renderSelection();
  }
  if (action === 'favorite') { favorites = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id]; save('favorites', favorites); catalogue(); icons(); }
  if (action === 'favorites') { favoritesOnly = !favoritesOnly; catalogue(); icons(); }
  if (action === 'reset') { filters = {}; favoritesOnly = false; catalogue(); icons(); }
  if (action === 'clear-selection') { selected = []; save('selection', selected); if (view === 'comparatif') compareView(); if (view === 'catalogue') renderProducts(); if (view === 'projet') { projectShortlist(); if (profile.step === 4) projectResults(); } renderSelection(); icons(); }
  if (action === 'compare') location.hash = 'comparatif';
  if (action === 'budget-model') { budgetId = id; budgetChosen = true; saveBudget(); dialog.close(); if (view === 'budget') { budgetView(); icons(); } else location.hash = 'budget'; }
  if (action === 'clear-local') { for (const key of ['selection', 'favorites', 'budget', 'profile']) { try { localStorage.removeItem(`rivage.${key}`); } catch {} } selected = []; favorites = []; favoritesOnly = false; filters = {}; estimates = {}; owned = []; excluded = []; shippingQuotes = {}; extras = 250; budgetId = 'moken10'; budgetChosen = false; profile = { ...defaultProfile }; projectResult = null; if (view === 'projet') projectView(); renderSelection(); notify('Ton projet et tes favoris ont été effacés sur cet appareil.'); }
  if (['select', 'favorite', 'favorites'].includes(action)) {
    const restored = focusScope.querySelector(`[data-action="${action}"]${id ? `[data-id="${id}"]` : ''}`);
    if (restored) restored.focus({ preventScroll: true });
    else if (!dialog.open) main.focus({ preventScroll: true });
  }
});
dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
welcome.addEventListener('close', () => main.focus({ preventScroll: true }));
welcome.addEventListener('click', event => { if (event.target === welcome) { const bounds = welcome.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) welcome.close(); } });
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
      budgetChosen = saved.budgetChosen === true && ids.includes(saved.budgetId);
      if (Array.isArray(saved.owned)) owned = [...new Set(saved.owned.filter(id => equipment.some(item => item.id === id)))];
      if (Array.isArray(saved.excluded)) excluded = saved.excluded.filter(id => equipment.some(item => item.id === id && item.optional));
      for (const item of equipment) if (knownNumber(saved.estimates?.[item.id]) && saved.estimates[item.id] >= 0 && saved.estimates[item.id] <= 10000) estimates[item.id] = saved.estimates[item.id];
      for (const id of ids) if (knownNumber(saved.shippingQuotes?.[id]) && saved.shippingQuotes[id] >= 0 && saved.shippingQuotes[id] <= 5000) shippingQuotes[id] = saved.shippingQuotes[id];
      if (knownNumber(saved.extras) && saved.extras >= 0 && saved.extras <= 20000) extras = saved.extras;
    }
  } catch {}
  try {
    const savedProfile = JSON.parse(stored('profile'));
    profile = normalizeProfile(savedProfile?.version === 2 ? savedProfile : null);
  } catch {}
  render();
  if (stored('welcomeSeen') !== 'true') {
    welcome.showModal();
    save('welcomeSeen', true);
  }
} catch (error) {
  main.innerHTML = `<div class="empty"><h1>Le catalogue n’a pas pu être ouvert.</h1><p>Vérifiez votre connexion puis réessayez. Le catalogue peut être temporairement indisponible.</p><button data-action="retry">Réessayer</button></div>`;
  console.error(error);
}