const state = {
  data: null,
  selected: "all",
  language: "english",
  domain: "all",
  cardIndex: 0,
  revealed: false,
};

const byId = (id) => document.getElementById(id);
const number = (value) => new Intl.NumberFormat("pl-PL").format(value);
const date = (value) => new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
const plural = (value, one, few, many) => {
  const lastTwo = value % 100;
  if (value === 1) return one;
  if (value % 10 >= 2 && value % 10 <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
};

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
      <span class="project-learning">${number(project.language_learning.term_count)} ${plural(project.language_learning.term_count, "termin", "terminy", "terminów")} EN/NO</span>
    </button>
  `;
}

function activeProject(data) {
  if (state.selected !== "all") {
    return data.projects.find((item) => item.id === state.selected);
  }
  return data.projects.reduce((a, b) => a.photos > b.photos ? a : b);
}

function renderProjects(data) {
  byId("project-list").innerHTML = data.projects.map(projectCard).join("");
  const project = activeProject(data);
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

function languageTerms(project) {
  const terms = project.language_learning.terms;
  if (state.domain === "all") return terms;
  return terms.filter((item) => item.domain === state.domain);
}

function renderLanguageSwitch() {
  document.querySelectorAll("[data-language]").forEach((button) => {
    const active = button.dataset.language === state.language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderAudioSupport() {
  const supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  ["speak-english", "speak-norwegian"].forEach((id) => {
    const button = byId(id);
    button.disabled = !supported;
    button.title = supported ? "" : "Odsłuch nie jest obsługiwany w tej przeglądarce";
  });
}

function renderDomainFilters(project) {
  const domains = [...new Map(project.language_learning.terms.map((item) => [item.domain, item.domain_label])).entries()];
  if (state.domain !== "all" && !domains.some(([key]) => key === state.domain)) {
    state.domain = "all";
  }
  const filters = [["all", "Wszystkie"], ...domains];
  byId("domain-filters").innerHTML = filters.map(([key, label]) => `
    <button class="domain-button ${key === state.domain ? "active" : ""}" type="button" data-domain="${key}" aria-pressed="${key === state.domain}">${label}</button>
  `).join("");
}

function renderFlashcard(project) {
  const terms = languageTerms(project);
  if (state.cardIndex >= terms.length) state.cardIndex = 0;
  const term = terms[state.cardIndex];
  const questionLabel = state.language === "english" ? "English" : "Norsk";
  const question = term[state.language];
  const companionLabel = state.language === "english" ? "Norsk" : "English";
  const companionValue = state.language === "english" ? term.norwegian : term.english;

  byId("flashcard-domain").textContent = term.domain_label;
  byId("flashcard-progress").textContent = `${state.cardIndex + 1} / ${terms.length}`;
  byId("flashcard-question-label").textContent = questionLabel;
  byId("flashcard-question").textContent = question;
  byId("flashcard-question").lang = state.language === "english" ? "en" : "no";
  byId("flashcard-answer").hidden = !state.revealed;
  byId("flashcard-answer").innerHTML = `
    <div><span>Polski</span><strong>${term.polish}</strong></div>
    <div><span>${companionLabel}</span><strong lang="${state.language === "english" ? "no" : "en"}">${companionValue}</strong></div>
  `;
  byId("flashcard-evidence").textContent = `Podstawa w dokumentacji: ${term.evidence_basis}.`;
  byId("reveal-card").textContent = state.revealed ? "Ukryj odpowiedź" : "Pokaż odpowiedź";
}

function renderVocabulary(project) {
  const terms = languageTerms(project);
  byId("vocabulary-count").textContent = `${number(terms.length)} ${plural(terms.length, "pozycja", "pozycje", "pozycji")}`;
  byId("vocabulary-body").innerHTML = terms.map((term) => `
    <tr>
      <td lang="en">${term.english}</td>
      <td lang="no">${term.norwegian}</td>
      <td>${term.polish}</td>
      <td><span class="domain-pill">${term.domain_label}</span>${term.evidence_basis}</td>
    </tr>
  `).join("");
}

function renderLanguage(data) {
  const project = activeProject(data);
  byId("language-project-name").textContent = project.name;
  byId("language-term-count").textContent = number(project.language_learning.term_count);
  byId("language-term-label").textContent = `${plural(project.language_learning.term_count, "termin", "terminy", "terminów")} w projekcie`;
  byId("language-rule").textContent = data.language_learning.assignment_rule;
  renderLanguageSwitch();
  renderAudioSupport();
  renderDomainFilters(project);
  renderFlashcard(project);
  renderVocabulary(project);
}

function speakTerm(language) {
  const project = activeProject(state.data);
  const terms = languageTerms(project);
  const term = terms[state.cardIndex];
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(language === "english" ? term.english : term.norwegian);
  utterance.lang = language === "english" ? "en-GB" : "nb-NO";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
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
  renderLanguage(state.data);
}

document.addEventListener("click", (event) => {
  const projectTarget = event.target.closest("[data-project]");
  if (projectTarget) {
    state.selected = projectTarget.dataset.project;
    state.domain = "all";
    state.cardIndex = 0;
    state.revealed = false;
    render();
    return;
  }

  const languageTarget = event.target.closest("[data-language]");
  if (languageTarget) {
    state.language = languageTarget.dataset.language;
    state.revealed = false;
    renderLanguage(state.data);
    return;
  }

  const domainTarget = event.target.closest("[data-domain]");
  if (domainTarget) {
    state.domain = domainTarget.dataset.domain;
    state.cardIndex = 0;
    state.revealed = false;
    renderLanguage(state.data);
    return;
  }

  if (event.target.closest("#reveal-card")) {
    state.revealed = !state.revealed;
    renderFlashcard(activeProject(state.data));
    return;
  }

  if (event.target.closest("#next-card")) {
    const terms = languageTerms(activeProject(state.data));
    state.cardIndex = (state.cardIndex + 1) % terms.length;
    state.revealed = false;
    renderFlashcard(activeProject(state.data));
    return;
  }

  if (event.target.closest("#speak-english")) {
    speakTerm("english");
    return;
  }

  if (event.target.closest("#speak-norwegian")) {
    speakTerm("norwegian");
  }
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
