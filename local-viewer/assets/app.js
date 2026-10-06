const state = {
  data: null,
  project: "03_MV_BATSFJORD",
  mode: "schematics",
  selectedSet: null,
  category: "all",
  search: "",
  sort: "newest",
  limit: 60,
  visiblePhotoIds: [],
  dialogIndex: -1,
};

const byId = (id) => document.getElementById(id);
const number = (value) => new Intl.NumberFormat("pl-PL").format(value);
const dateTime = (value) => new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function recordMap() {
  return new Map(state.data.photos.map((item) => [item.id, item]));
}

function project() {
  return state.data.projects.find((item) => item.id === state.project);
}

function matchesSearch(record) {
  if (!state.search) return true;
  const haystack = [record.file_name, record.title, record.category_label, record.description, record.learning_note, record.project_name].join(" ").toLocaleLowerCase("pl");
  return haystack.includes(state.search);
}

function renderSummary() {
  byId("metric-visible").textContent = number(state.data.summary.visible_photos);
  byId("metric-schematics").textContent = number(state.data.summary.schematics);
  byId("metric-other").textContent = number(state.data.summary.other);
  byId("metric-sets").textContent = number(state.data.summary.document_sets);
  byId("method-fact").textContent = state.data.methodology.fact;
  byId("method-interpretation").textContent = state.data.methodology.interpretation;
  byId("method-limitation").textContent = state.data.methodology.limitation;
}

function renderProjects() {
  byId("project-switch").innerHTML = state.data.projects.map((item) => `
    <button class="project-button ${item.id === state.project ? "active" : ""}" type="button" data-project="${item.id}" aria-pressed="${item.id === state.project}">
      ${escapeHtml(item.name)} · ${number(item.photos)}
    </button>
  `).join("");
}

function photoCard(record, context = "gallery") {
  const badge = context === "related" ? `Kandydat · ${record.category_label}` : `${record.claim_class} · ${record.category_label}`;
  return `
    <button class="photo-card" type="button" data-photo-id="${escapeHtml(record.id)}">
      <span class="photo-thumb"><img src="${record.thumbnail_url}" alt="" loading="lazy"><span>${escapeHtml(badge)}</span></span>
      <span class="photo-copy"><strong>${escapeHtml(record.title)}</strong><span class="photo-description">${escapeHtml(record.description)}</span><span>${escapeHtml(record.file_name)} · ${dateTime(record.captured_at)}</span></span>
    </button>
  `;
}

function filteredSets() {
  const records = recordMap();
  return state.data.document_sets.filter((set) => {
    if (set.project !== state.project) return false;
    if (!state.search) return true;
    const photos = [...set.schematic_ids, ...set.related_ids].map((id) => records.get(id)).filter(Boolean);
    return set.title.toLocaleLowerCase("pl").includes(state.search) || photos.some(matchesSearch);
  });
}

function renderSetList() {
  const sets = filteredSets();
  if (!sets.some((set) => set.id === state.selectedSet)) state.selectedSet = sets[0]?.id || null;
  byId("set-count").textContent = `${number(sets.length)} zest.`;
  byId("set-list").innerHTML = sets.map((set) => `
    <button class="set-button ${set.id === state.selectedSet ? "active" : ""}" type="button" data-set-id="${set.id}" aria-pressed="${set.id === state.selectedSet}">
      <strong>${escapeHtml(set.title)}</strong>
      <span>${dateTime(set.captured_from)}</span>
      <span class="set-stats">${set.schematic_ids.length} dok. · ${set.related_ids.length} kandydatów</span>
    </button>
  `).join("");
  byId("set-empty").hidden = sets.length > 0;
  byId("set-content").hidden = sets.length === 0;
  renderSelectedSet();
}

function renderSelectedSet() {
  const set = state.data.document_sets.find((item) => item.id === state.selectedSet);
  if (!set) return;
  const records = recordMap();
  const schematics = set.schematic_ids.map((id) => records.get(id)).filter(Boolean);
  const related = set.related_ids.map((id) => records.get(id)).filter(Boolean);
  byId("set-method").textContent = set.group_method;
  byId("set-title").textContent = set.title;
  byId("set-period").textContent = `${dateTime(set.captured_from)} – ${dateTime(set.captured_to)}`;
  byId("set-status").textContent = set.completeness === "COMPLETE_PHOTOGRAPHIC_SEQUENCE" ? "Pełna sekwencja fotograficzna" : "Kompletność niepotwierdzona";
  byId("schematic-count").textContent = `${number(schematics.length)} zdjęć`;
  byId("related-count").textContent = `${number(related.length)} kandydatów`;
  byId("relation-basis").textContent = set.relation_basis;
  byId("relation-status").textContent = set.relation_status;
  byId("schematic-grid").innerHTML = schematics.map((item) => photoCard(item, "schematic")).join("");
  byId("related-grid").innerHTML = related.length ? related.map((item) => photoCard(item, "related")).join("") : '<div class="empty-state"><strong>Brak kandydatów powiązania</strong><span>Potrzebny jest tag urządzenia lub wskazanie użytkownika.</span></div>';
}

function renderCategoryFilters() {
  const current = project();
  const categories = current.categories.filter((item) => item.id !== "10_Drawings_specs_asbuilt");
  if (state.category !== "all" && !categories.some((item) => item.id === state.category)) state.category = "all";
  const filters = [{ id: "all", label: "Wszystkie", count: current.other }, ...categories];
  byId("category-filters").innerHTML = filters.map((item) => `
    <button class="category-button ${item.id === state.category ? "active" : ""}" type="button" data-category="${item.id}" aria-pressed="${item.id === state.category}">
      ${escapeHtml(item.label)} · ${number(item.count)}
    </button>
  `).join("");
}

function filteredPhotos() {
  const direction = state.sort === "newest" ? -1 : 1;
  return state.data.photos
    .filter((item) => item.project === state.project && item.kind === "photo")
    .filter((item) => state.category === "all" || item.category === state.category)
    .filter(matchesSearch)
    .sort((a, b) => a.captured_at.localeCompare(b.captured_at) * direction);
}

function renderPhotos() {
  renderCategoryFilters();
  const photos = filteredPhotos();
  const visible = photos.slice(0, state.limit);
  state.visiblePhotoIds = visible.map((item) => item.id);
  byId("photo-result-count").textContent = number(photos.length);
  byId("photo-grid").innerHTML = visible.map((item) => photoCard(item)).join("");
  byId("photo-empty").hidden = photos.length > 0;
  byId("load-more").hidden = state.limit >= photos.length;
}

function renderMode() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  byId("schematics-view").hidden = state.mode !== "schematics";
  byId("photos-view").hidden = state.mode !== "photos";
}

function render() {
  renderProjects();
  renderMode();
  renderSetList();
  renderPhotos();
  document.documentElement.dataset.viewportWidth = String(window.innerWidth);
  document.documentElement.dataset.scrollWidth = String(document.documentElement.scrollWidth);
}

function openPhoto(id) {
  const map = recordMap();
  const record = map.get(id);
  if (!record) return;
  const contextIds = state.mode === "photos"
    ? filteredPhotos().map((item) => item.id)
    : [...(state.data.document_sets.find((item) => item.id === state.selectedSet)?.schematic_ids || []), ...(state.data.document_sets.find((item) => item.id === state.selectedSet)?.related_ids || [])];
  state.visiblePhotoIds = contextIds;
  state.dialogIndex = contextIds.indexOf(id);
  byId("dialog-image").src = record.photo_url;
  byId("dialog-image").alt = `${record.project_name}: ${record.description}`;
  byId("dialog-project").textContent = `${record.project_name} · ${record.claim_class}`;
  byId("dialog-title").textContent = record.title;
  byId("dialog-description").textContent = record.description;
  byId("dialog-claim-class").textContent = record.claim_class;
  byId("dialog-limitation").textContent = record.limitation;
  byId("dialog-metadata").innerHTML = [
    ["Plik", record.file_name],
    ["Czas", `${dateTime(record.captured_at)} (${record.time_basis})`],
    ["Kategoria", record.category_label],
    ["Pewność", record.confidence],
    ["Metoda", record.classification_method],
    ["Opis", record.description_level === "curated" ? `szczegółowy · analiza ${record.analysis_date}` : "kategoria robocza"],
    ["Źródło opisu", record.annotation_source],
    ["Integralność", record.manifest_verified ? `manifest OK · SHA-256 ${record.sha256_short}…` : "brak potwierdzenia"],
  ].map(([term, value]) => `<dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd>`).join("");
  byId("dialog-prev").disabled = contextIds.length < 2;
  byId("dialog-next").disabled = contextIds.length < 2;
  const dialog = byId("photo-dialog");
  if (!dialog.open) dialog.showModal();
}

function moveDialog(offset) {
  const ids = state.visiblePhotoIds;
  if (!ids.length) return;
  state.dialogIndex = (state.dialogIndex + offset + ids.length) % ids.length;
  openPhoto(ids[state.dialogIndex]);
}

document.addEventListener("click", (event) => {
  const projectTarget = event.target.closest("[data-project]");
  if (projectTarget) {
    state.project = projectTarget.dataset.project;
    state.selectedSet = null;
    state.category = "all";
    state.limit = 60;
    render();
    return;
  }
  const modeTarget = event.target.closest("[data-mode]");
  if (modeTarget) {
    state.mode = modeTarget.dataset.mode;
    renderMode();
    return;
  }
  const setTarget = event.target.closest("[data-set-id]");
  if (setTarget) {
    state.selectedSet = setTarget.dataset.setId;
    renderSetList();
    return;
  }
  const categoryTarget = event.target.closest("[data-category]");
  if (categoryTarget) {
    state.category = categoryTarget.dataset.category;
    state.limit = 60;
    renderPhotos();
    return;
  }
  const photoTarget = event.target.closest("[data-photo-id]");
  if (photoTarget) {
    openPhoto(photoTarget.dataset.photoId);
    return;
  }
  if (event.target.closest("#load-more")) {
    state.limit += 60;
    renderPhotos();
  }
});

byId("search-input").addEventListener("input", (event) => {
  state.search = event.target.value.trim().toLocaleLowerCase("pl");
  state.limit = 60;
  renderSetList();
  renderPhotos();
});
byId("sort-select").addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderPhotos();
});
byId("dialog-close").addEventListener("click", () => byId("photo-dialog").close());
byId("dialog-prev").addEventListener("click", () => moveDialog(-1));
byId("dialog-next").addEventListener("click", () => moveDialog(1));
byId("photo-dialog").addEventListener("click", (event) => {
  if (event.target === byId("photo-dialog")) byId("photo-dialog").close();
});

fetch("/data/catalog.json")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    state.data = data;
    const params = new URLSearchParams(window.location.search);
    const requestedProject = params.get("project");
    const requestedMode = params.get("mode");
    const requestedCategory = params.get("category");
    const requestedSet = params.get("set");
    if (data.projects.some((item) => item.id === requestedProject)) state.project = requestedProject;
    if (["schematics", "photos"].includes(requestedMode)) state.mode = requestedMode;
    if (requestedCategory) state.category = requestedCategory;
    if (data.document_sets.some((item) => item.id === requestedSet && item.project === state.project)) state.selectedSet = requestedSet;
    renderSummary();
    render();
    const requestedPhoto = params.get("photo");
    if (data.photos.some((item) => item.id === requestedPhoto)) openPhoto(requestedPhoto);
  })
  .catch(() => {
    byId("viewer-main").innerHTML = '<section class="empty-state"><strong>Nie udało się wczytać lokalnego katalogu.</strong><span>Uruchom ponownie Start-BattbygPhotoViewer.ps1 i sprawdź walidację rejestrów.</span></section>';
  });
