const state = { data: null, selected: "all" };

const byId = (id) => document.getElementById(id);
const number = (value) => new Intl.NumberFormat("pl-PL").format(value);
const date = (value) => new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));

function renderMetrics(data) {
  byId("metric-projects").textContent = number(data.summary.projects);
  byId("metric-photos").textContent = number(data.summary.photos);
  byId("metric-updates").textContent = number(data.summary.updates);
  byId("metric-confidence").textContent = number(data.summary.high_confidence);
  byId("snapshot-date").textContent = date(data.site.data_snapshot);
  byId("generated-at").textContent = `Wygenerowano: ${new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.site.generated_at))}`;
}

function renderFilters(data) {
  const filters = [{ id: "all", name: "Wszystkie" }, ...data.projects.map(({ id, name }) => ({ id, name }))];
  byId("project-filters").innerHTML = filters.map((item) => `
    <button class="filter-button ${item.id === state.selected ? "active" : ""}" type="button" data-project="${item.id}" aria-pressed="${item.id === state.selected}">${item.name}</button>
  `).join("");
}

function projectCard(project) {
  return `
    <button class="project-card ${project.id === state.selected ? "active" : ""}" type="button" data-project="${project.id}">
      <header>
        <div><h3>${project.name}</h3><span class="project-code">${project.code}</span></div>
        <span class="project-count">${number(project.photos)}</span>
      </header>
      <p>${project.focus}</p>
    </button>
  `;
}

function renderProjects(data) {
  byId("project-list").innerHTML = data.projects.map(projectCard).join("");
  const project = state.selected === "all" ? data.projects.reduce((a, b) => a.photos > b.photos ? a : b) : data.projects.find((item) => item.id === state.selected);
  byId("project-detail").innerHTML = `
    <span class="detail-label">${state.selected === "all" ? "Największy zbiór" : "Wybrany projekt"}</span>
    <h3>${project.name}</h3>
    <div class="detail-stats">
      <div><span>Zdjęcia</span><strong>${number(project.photos)}</strong></div>
      <div><span>Okres</span><strong>${project.date_from.slice(0, 7)} – ${project.date_to.slice(0, 7)}</strong></div>
      <div><span>Wysoka pewność</span><strong>${number(project.confidence.high)}</strong></div>
      <div><span>Średnia pewność</span><strong>${number(project.confidence.medium)}</strong></div>
    </div>
    <p class="detail-note">${project.focus} Materiały wrażliwe pozostają poza publikacją.</p>
  `;
}

function selectedCategories(data) {
  if (state.selected === "all") return data.categories;
  return data.projects.find((item) => item.id === state.selected).categories;
}

function renderBars(data) {
  const categories = selectedCategories(data);
  const max = Math.max(...categories.map((item) => item.count), 1);
  byId("area-context").textContent = state.selected === "all" ? "Wszystkie projekty" : data.projects.find((item) => item.id === state.selected).name;
  byId("category-bars").innerHTML = categories.map((item) => `
    <div class="bar-row">
      <span class="bar-label">${item.label}</span>
      <div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width: ${(item.count / max * 100).toFixed(1)}%"></div></div>
      <span class="bar-value">${number(item.count)}</span>
    </div>
  `).join("");
}

function renderUpdates(data) {
  byId("update-timeline").innerHTML = data.updates.map((item) => `
    <li>
      <time datetime="${item.date}">${date(item.date)}</time>
      <strong>+${number(item.included)} rekordów · ${item.status}</strong>
      <span>${item.projects.join(", ")} · odrzucono ${number(item.excluded)} plików spoza zakresu</span>
    </li>
  `).join("");
}

function renderMethod(data) {
  byId("method-facts").textContent = data.methodology.facts;
  byId("method-interpretations").textContent = data.methodology.interpretations;
  byId("method-limitations").textContent = data.methodology.limitations;
}

function render() {
  renderFilters(state.data);
  renderProjects(state.data);
  renderBars(state.data);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-project]");
  if (!target) return;
  state.selected = target.dataset.project;
  render();
});

fetch("data/site-data.json")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    state.data = data;
    renderMetrics(data);
    renderUpdates(data);
    renderMethod(data);
    render();
  })
  .catch(() => {
    byId("main").innerHTML = "<section class='intro'><div><p class='eyebrow'>Błąd danych</p><h1>Nie udało się wczytać rejestru.</h1><p class='lead'>Spróbuj odświeżyć stronę. Jeżeli problem pozostaje, aktualizacja wymaga ponownej walidacji.</p></div></section>";
  });
