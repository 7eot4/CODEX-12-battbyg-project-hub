const state = {
  data: null,
  selected: "all",
  language: "english",
  domain: "all",
  cardIndex: 0,
  revealed: false,
  deck: [],
  deckKey: "",
  voices: [],
  searchIndex: [],
  searchResults: [],
  journalEntries: [],
};

const JOURNAL_STORAGE_KEY = "battbyg-field-journal-v1";
const PUBLIC_DATA_VERSION = "20261030-history9a";
const ui = window.BattbygI18n;
ui.apply();

const byId = (id) => document.getElementById(id);
const t = (key, values) => ui.t(key, values);
const number = (value) => new Intl.NumberFormat(ui.locale()).format(value);
const date = (value) => new Intl.DateTimeFormat(ui.locale(), { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
const plural = (value, one, few, many) => {
  if (ui.get() === "en") return value === 1 ? one : many;
  const lastTwo = value % 100;
  if (value === 1) return one;
  if (value % 10 >= 2 && value % 10 <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
};

const DOMAIN_LABELS_EN = {
  general: "Ship and spaces",
  machinery: "Machinery",
  electrical: "Electrical engineering",
  automation: "Automation",
  safety: "Safety",
  process: "Process and refrigeration",
  research: "Research systems",
  commissioning: "Commissioning",
  documentation: "Documentation",
};

const CATEGORY_LABELS_EN = {
  "00_Project_identity_context": "Project identification",
  "10_Drawings_specs_asbuilt": "Drawings and as-built",
  "20_Hull_deck_yard": "Hull, deck and shipyard",
  "30_Safety_fire_LSA": "Safety, fire and LSA",
  "40_Electrical_power_distribution": "Power distribution",
  "50_Automation_control_instrumentation": "Automation and instrumentation",
  "60_Machinery_auxiliaries_piping": "Machinery and piping",
  "70_Navigation_scientific_mission": "Navigation and specialist systems",
  "80_Commissioning_testing_closeout": "Commissioning and testing",
};

const LEARNING_CONTEXTS_EN = {
  general: "Project-wide vessel context",
  machinery: "Machinery and systems",
  electrical: "Power distribution",
  automation: "Automation and instrumentation",
  safety: "Safety and LSA",
  process: "Machinery and systems",
  research: "Navigation and specialist systems",
  commissioning: "Commissioning and testing",
  documentation: "Drawings and as-built",
};

const SOURCE_SCOPES_EN = [
  "electrotechnical terminology",
  "ship safety, fire protection and life-saving appliances",
  "life-saving appliances and the LSA Code",
  "classification context for ship systems",
  "drives, HMI and automation",
];

const localizedDomain = (term) => ui.get() === "en" ? DOMAIN_LABELS_EN[term.domain] || term.domain_label : term.domain_label;
const localizedCategory = (category) => ui.get() === "en" ? CATEGORY_LABELS_EN[category.key] || category.label : category.label;
const localizedLearningContext = (term) => ui.get() === "en" ? LEARNING_CONTEXTS_EN[term.domain] || term.learning_context : term.learning_context;
const projectFocus = (project) => ui.get() === "en" ? t(`project.focus.${project.id}`) : project.focus;
const projectCode = (project) => {
  if (ui.get() !== "en") return project.code;
  if (project.code === "projekt badawczy") return t("project.codeResearch");
  if (project.code === "projekt stoczniowy") return t("project.codeShipyard");
  return project.code;
};

const escapeHTML = (value) => String(value).replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
})[character]);

function normalizeSearch(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/[^a-z0-9/+-]+/g, " ")
    .trim();
}

function buildSearchIndex(data) {
  const projects = data.projects.map((project) => ({
    id: `project:${project.id}`,
    type: "project",
    typeLabel: t("search.typeProject"),
    title: project.name,
    subtitle: `${projectCode(project)} · ${projectFocus(project)}`,
    meta: `${number(project.language_learning.term_count)} ${t("general.terms")} · EN/NO/PL`,
    projectId: project.id,
    searchValues: [project.name, project.code, project.focus, projectCode(project), projectFocus(project)],
  }));

  const termsById = new Map();
  data.projects.forEach((project) => {
    project.language_learning.terms.forEach((term) => {
      if (!termsById.has(term.id)) {
        termsById.set(term.id, {
          id: `term:${term.id}`,
          type: "term",
          typeLabel: t("search.typeTerm"),
          title: term.english,
          subtitle: `${term.norwegian} · ${term.polish}`,
          meta: localizedDomain(term),
          termId: term.id,
          domain: term.domain,
          projectIds: [],
          projectNames: [],
          searchValues: [
            term.english,
            term.norwegian,
            term.polish,
            term.domain_label,
            term.learning_context,
            term.definition_pl,
            term.application_pl,
          ],
        });
      }
      const entry = termsById.get(term.id);
      entry.projectIds.push(project.id);
      entry.projectNames.push(project.name);
    });
  });
  const terms = [...termsById.values()].map((term) => ({
    ...term,
    meta: `${term.meta} · ${term.projectNames.join(", ")}`,
  }));

  const topics = data.categories.map((category) => {
    const matchingProjects = data.projects.filter((project) => project.categories.some((item) => item.key === category.key));
    return {
      id: `topic:${category.key}`,
      type: "topic",
      typeLabel: t("search.typeTopic"),
      title: localizedCategory(category),
      subtitle: t("search.topicSubtitle"),
      meta: matchingProjects.map((project) => project.name).join(", "),
      categoryKey: category.key,
      searchValues: [category.label, localizedCategory(category), category.key, ...matchingProjects.flatMap((project) => [project.focus, projectFocus(project)])],
    };
  });

  return [...terms, ...topics, ...projects].map((item) => ({
    ...item,
    normalizedTitle: normalizeSearch(item.title),
    normalizedValues: item.searchValues.map(normalizeSearch),
  }));
}

function findSearchResults(index, query, limit = 12) {
  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery.length < 2) return [];
  return index
    .map((item) => {
      const titleExact = item.normalizedTitle === normalizedQuery;
      const titleStarts = item.normalizedTitle.startsWith(normalizedQuery);
      const titleWordStarts = item.normalizedTitle.split(" ").some((word) => word.startsWith(normalizedQuery));
      const exact = item.normalizedValues.some((value) => value === normalizedQuery);
      const starts = item.normalizedValues.some((value) => value.startsWith(normalizedQuery));
      const wordStarts = item.normalizedValues.some((value) => value.split(" ").some((word) => word.startsWith(normalizedQuery)));
      const includes = item.normalizedValues.some((value) => value.includes(normalizedQuery));
      if (!includes) return null;
      const score = titleExact ? 0 : titleStarts ? 1 : titleWordStarts ? 2 : exact ? 3 : starts ? 4 : wordStarts ? 5 : 6;
      return { ...item, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.type.localeCompare(b.type, ui.locale()) || a.title.localeCompare(b.title, ui.locale()))
    .slice(0, limit);
}

function renderSearch(query) {
  const input = byId("global-search");
  const resultsPanel = byId("search-results");
  const clearButton = byId("clear-search");
  const trimmed = query.trim();
  clearButton.hidden = trimmed.length === 0;
  if (trimmed.length < 2) {
    state.searchResults = [];
    resultsPanel.hidden = true;
    resultsPanel.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    return;
  }

  state.searchResults = findSearchResults(state.searchIndex, trimmed);
  resultsPanel.hidden = false;
  input.setAttribute("aria-expanded", "true");
  if (state.searchResults.length === 0) {
    resultsPanel.innerHTML = `<p class="search-empty">${escapeHTML(t("search.noResult", { query: trimmed }))}</p>`;
    return;
  }

  resultsPanel.innerHTML = `
    <div class="search-results-head"><strong>${escapeHTML(t("search.results", { count: number(state.searchResults.length) }))}</strong><span>${escapeHTML(t("search.select"))}</span></div>
    ${state.searchResults.map((item) => `
      <button class="search-result" type="button" data-search-result="${escapeHTML(item.id)}" data-result-type="${item.type}">
        <span class="search-result-type">${item.typeLabel}</span>
        <span class="search-result-main"><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.subtitle)}</span></span>
        <span class="search-result-meta">${escapeHTML(item.meta)}</span>
      </button>
    `).join("")}
  `;
}

function closeSearch() {
  byId("search-results").hidden = true;
  byId("global-search").setAttribute("aria-expanded", "false");
}

function openSearchResult(result) {
  if (!result) return;
  closeSearch();
  if (result.type === "project") {
    state.selected = result.projectId;
    state.domain = "all";
    state.deckKey = "";
    state.revealed = false;
    render();
    requestAnimationFrame(() => byId("projects-title").scrollIntoView({ block: "start" }));
    return;
  }

  if (result.type === "topic") {
    state.selected = "all";
    state.domain = "all";
    state.deckKey = "";
    render();
    requestAnimationFrame(() => {
      byId("areas-title").scrollIntoView({ block: "start" });
      const bar = [...document.querySelectorAll("[data-category]")].find((item) => item.dataset.category === result.categoryKey);
      if (bar) {
        bar.classList.add("search-highlight");
        window.setTimeout(() => bar.classList.remove("search-highlight"), 2200);
      }
    });
    return;
  }

  const currentProject = result.projectIds.includes(state.selected) ? state.selected : result.projectIds[0];
  state.selected = currentProject;
  state.domain = result.domain;
  state.deckKey = "";
  state.revealed = true;
  render();
  const termIndex = state.deck.findIndex((term) => term.id === result.termId);
  if (termIndex > 0) [state.deck[0], state.deck[termIndex]] = [state.deck[termIndex], state.deck[0]];
  state.cardIndex = 0;
  state.revealed = true;
  renderFlashcard(activeProject(state.data));
  requestAnimationFrame(() => {
    byId("language-lab").scrollIntoView({ block: "start" });
    byId("flashcard").focus({ preventScroll: true });
  });
}

function renderMetrics(data) {
  byId("metric-projects").textContent = number(data.summary.projects);
  byId("metric-terms").textContent = number(data.summary.terms);
  byId("metric-languages").textContent = number(data.summary.languages);
  byId("metric-journal").textContent = t("project.local").toUpperCase();
  byId("snapshot-date").textContent = date(data.site.data_snapshot);
  const generated = new Intl.DateTimeFormat(ui.locale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.site.generated_at));
  byId("generated-at").textContent = t("generated", { date: generated });
}

function renderFilters(data) {
  const filters = [{ id: "all", name: t("general.all") }, ...data.projects.map(({ id, name }) => ({ id, name }))];
  byId("project-filters").innerHTML = filters.map((item) => `
    <button class="filter-button ${item.id === state.selected ? "active" : ""}" type="button" data-project="${item.id}" aria-pressed="${item.id === state.selected}">${item.name}</button>
  `).join("");
}

function projectCard(project) {
  return `
    <button class="project-card ${project.id === state.selected ? "active" : ""}" type="button" data-project="${project.id}">
      <header>
        <div><h3>${project.name}</h3><span class="project-code">${projectCode(project)}</span></div>
        <span class="project-count">${number(project.language_learning.term_count)}</span>
      </header>
      <p>${projectFocus(project)}</p>
      <span class="project-learning">${number(project.language_learning.term_count)} ${t("general.terms")} EN/NO</span>
    </button>
  `;
}

function activeProject(data) {
  if (state.selected !== "all") {
    return data.projects.find((item) => item.id === state.selected);
  }
  return data.projects.reduce((a, b) => a.language_learning.term_count > b.language_learning.term_count ? a : b);
}

function renderProjects(data) {
  byId("project-list").innerHTML = data.projects.map(projectCard).join("");
  const project = activeProject(data);
  byId("project-detail").innerHTML = `
    <span class="detail-label">${state.selected === "all" ? t("project.largest") : t("project.selected")}</span>
    <h3>${project.name}</h3>
    <div class="detail-stats">
      <div><span>${t("project.terms")}</span><strong>${number(project.language_learning.term_count)}</strong></div>
      <div><span>${t("project.areas")}</span><strong>${number(project.language_learning.domains.length)}</strong></div>
      <div><span>${t("project.languages")}</span><strong>EN / NO / PL</strong></div>
      <div><span>${t("project.journal")}</span><strong>${t("project.local")}</strong></div>
    </div>
    <p class="detail-note">${projectFocus(project)} ${t("project.sensitive")}</p>
  `;
}

function filteredTerms(project) {
  const terms = project.language_learning.terms;
  if (state.domain === "all") return terms;
  return terms.filter((item) => item.domain === state.domain);
}

function randomIndex(maxExclusive) {
  if (window.crypto?.getRandomValues) {
    const range = 0x100000000;
    const limit = range - (range % maxExclusive);
    const buffer = new Uint32Array(1);
    do window.crypto.getRandomValues(buffer); while (buffer[0] >= limit);
    return buffer[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomIndex(index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function ensureDeck(project, force = false) {
  const key = `${project.id}|${state.domain}`;
  if (force || state.deckKey !== key || state.deck.length === 0) {
    const previousFirst = state.deck[0];
    const nextDeck = shuffled(filteredTerms(project));
    if (force && nextDeck.length > 1 && nextDeck[0] === previousFirst) {
      const target = 1 + randomIndex(nextDeck.length - 1);
      [nextDeck[0], nextDeck[target]] = [nextDeck[target], nextDeck[0]];
    }
    state.deck = nextDeck;
    state.deckKey = key;
    state.cardIndex = 0;
    state.revealed = false;
  }
  return state.deck;
}

function languageTerms(project) {
  return ensureDeck(project);
}

function renderLanguageSwitch() {
  document.querySelectorAll("[data-language]").forEach((button) => {
    const active = button.dataset.language === state.language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

const VOICE_PREFERENCES = {
  english: ["sonia", "libby", "olivia", "abbi", "bella", "hollie", "hazel", "susan", "zira", "aria", "jenny"],
  norwegian: ["pernille", "iselin"],
};

const MALE_VOICE_NAMES = ["finn", "ryan", "thomas", "george", "guy", "david", "mark"];

function voiceLanguageMatches(voice, language) {
  const normalized = voice.lang.toLowerCase().replace("_", "-");
  return language === "english"
    ? normalized.startsWith("en-")
    : normalized.startsWith("nb-no") || normalized.startsWith("no-no");
}

function preferredVoiceIndex(voices, language) {
  const preferred = VOICE_PREFERENCES[language];
  const scored = voices.map((voice, index) => {
    const name = voice.name.toLowerCase();
    const preferredIndex = preferred.findIndex((token) => name.includes(token));
    const isKnownMale = MALE_VOICE_NAMES.some((token) => name.includes(token));
    let score = 0;
    if (preferredIndex >= 0) score += 100 - preferredIndex;
    if (language === "english" && voice.lang.toLowerCase().replace("_", "-").startsWith("en-gb")) score += 12;
    if (/natural|neural|online/.test(name)) score += 20;
    if (voice.localService) score += 2;
    if (isKnownMale) score -= 200;
    return { index, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.index ?? -1;
}

function populateVoiceSelect(language) {
  const select = byId(`voice-${language}`);
  const previousVoiceURI = select.value;
  const voices = state.voices.filter((voice) => voiceLanguageMatches(voice, language));
  select.innerHTML = "";
  if (voices.length === 0) {
    select.add(new Option(t("voice.none"), ""));
    select.disabled = true;
    return false;
  }
  voices.forEach((voice) => select.add(new Option(`${voice.name} (${voice.lang})`, voice.voiceURI)));
  const previousIndex = voices.findIndex((voice) => voice.voiceURI === previousVoiceURI);
  select.selectedIndex = previousIndex >= 0 ? previousIndex : preferredVoiceIndex(voices, language);
  select.disabled = false;
  return VOICE_PREFERENCES[language].some((token) => voices[select.selectedIndex].name.toLowerCase().includes(token));
}

function loadVoices() {
  if (!("speechSynthesis" in window)) return;
  state.voices = window.speechSynthesis.getVoices();
  const englishFemale = populateVoiceSelect("english");
  const norwegianFemale = populateVoiceSelect("norwegian");
  if (englishFemale && norwegianFemale) {
    byId("voice-status").textContent = t("voice.selected");
  } else if (state.voices.length === 0) {
    byId("voice-status").textContent = t("voice.loading");
  } else {
    byId("voice-status").textContent = t("voice.warning");
  }
}

function selectedVoice(language) {
  const voiceURI = byId(`voice-${language}`).value;
  return state.voices.find((voice) => voice.voiceURI === voiceURI) || null;
}

function renderAudioSupport() {
  const supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  ["speak-english", "speak-norwegian"].forEach((id) => {
    const button = byId(id);
    button.disabled = !supported;
    button.title = supported ? "" : t("voice.unsupported");
  });
  byId("speech-rate").disabled = !supported;
  if (!supported) {
    ["voice-english", "voice-norwegian"].forEach((id) => { byId(id).disabled = true; });
    byId("voice-status").textContent = t("voice.unsupported");
  }
}

function renderDomainFilters(project) {
  const domains = [...new Map(project.language_learning.terms.map((item) => [item.domain, localizedDomain(item)])).entries()];
  if (state.domain !== "all" && !domains.some(([key]) => key === state.domain)) {
    state.domain = "all";
  }
  const filters = [["all", t("general.all")], ...domains];
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

  byId("flashcard-domain").textContent = localizedDomain(term);
  byId("flashcard-progress").textContent = `${state.cardIndex + 1} / ${terms.length}`;
  byId("flashcard-question-label").textContent = questionLabel;
  byId("flashcard-question").textContent = question;
  byId("flashcard-question").lang = state.language === "english" ? "en" : "no";
  byId("flashcard-answer").hidden = !state.revealed;
  byId("flashcard-answer").innerHTML = `
    <div><span>${t("flashcard.polish")}</span><strong>${term.polish}</strong></div>
    <div><span>${companionLabel}</span><strong lang="${state.language === "english" ? "no" : "en"}">${companionValue}</strong></div>
    <div class="flashcard-definition"><span>${t("flashcard.definition")}</span><p>${term.definition_pl}</p></div>
    <div class="flashcard-definition"><span>${t("flashcard.onShip")}</span><p>${term.application_pl}</p></div>
  `;
  byId("flashcard-evidence").textContent = t("flashcard.evidence", { basis: localizedLearningContext(term), date: date(term.definition_added_on) });
  byId("reveal-card").textContent = state.revealed ? t("flashcard.hide") : t("flashcard.reveal");
}

function renderVocabulary(project) {
  const terms = filteredTerms(project);
  byId("vocabulary-count").textContent = `${number(terms.length)} ${t("general.items")}`;
  byId("vocabulary-body").innerHTML = terms.map((term) => `
    <tr>
      <td lang="en">${term.english}</td>
      <td lang="no">${term.norwegian}</td>
      <td>${term.polish}</td>
      <td class="definition-cell">
        <span class="domain-pill">${localizedDomain(term)}</span>
        <strong>${term.definition_pl}</strong>
        <span>${term.application_pl}</span>
        <small>${t("definition.added", { date: date(term.definition_added_on) })} · ${t("definition.status")}</small>
      </td>
    </tr>
  `).join("");
}

function renderLanguage(data) {
  const project = activeProject(data);
  byId("language-project-name").textContent = project.name;
  byId("language-term-count").textContent = number(project.language_learning.term_count);
  byId("language-term-label").textContent = ui.get() === "en" ? "terms in the project" : `${plural(project.language_learning.term_count, "termin", "terminy", "terminów")} w projekcie`;
  byId("language-rule").textContent = ui.get() === "en"
    ? "I manually curate the terms and assign them to vessel contexts for my own professional learning."
    : data.language_learning.assignment_rule;
  byId("definition-note").innerHTML = `<strong>${escapeHTML(t("definition.coverage", { defined: number(data.language_learning.defined_terms), total: number(data.language_learning.source_terms) }))}</strong> ${escapeHTML(t("definition.note"))} ${escapeHTML(t("definition.state", { date: date(data.language_learning.definitions_added_on) }))}`;
  byId("definition-sources").innerHTML = data.language_learning.reference_sources.map((source, index) => `
    <li><a href="${escapeHTML(source.url)}" target="_blank" rel="noreferrer">${escapeHTML(source.title)}</a><span>${escapeHTML(ui.get() === "en" ? SOURCE_SCOPES_EN[index] : source.scope)} · ${escapeHTML(t("source.accessed", { date: date(source.accessed_on) }))}</span></li>
  `).join("");
  renderLanguageSwitch();
  renderAudioSupport();
  renderDomainFilters(project);
  ensureDeck(project);
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
  const voice = selectedVoice(language);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || (language === "english" ? "en-GB" : "nb-NO");
  utterance.rate = Number(byId("speech-rate").value);
  utterance.pitch = 1.02;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function selectedCategories(data) {
  if (state.selected === "all") return data.categories;
  return data.projects.find((item) => item.id === state.selected).categories;
}

function renderBars(data) {
  const categories = selectedCategories(data);
  byId("area-context").textContent = state.selected === "all" ? t("areas.all") : data.projects.find((item) => item.id === state.selected).name;
  byId("category-bars").innerHTML = categories.map((item) => `
    <div class="bar-row" data-category="${item.key}">
      <span class="bar-label">${localizedCategory(item)}</span>
      <span class="bar-status">${t("areas.inPlan")}</span>
    </div>
  `).join("");
}

function renderUpdates(data) {
  byId("update-timeline").innerHTML = data.updates.map((item) => `
    <li>
      <div class="timeline-meta"><time datetime="${item.date}T${item.time}">${date(item.date)}</time><span class="timeline-time">${escapeHTML(item.time)}</span><span class="timeline-tag">${escapeHTML(ui.get() === "en" ? item.tag_en : item.tag_pl)}</span></div>
      <strong>${escapeHTML(t("updates.line", { title: ui.get() === "en" ? item.title_en : item.title_pl }))}</strong>
      <span>${escapeHTML(t("updates.detail", { detail: ui.get() === "en" ? item.detail_en : item.detail_pl }))}</span>
    </li>
  `).join("");
}

function renderMethod(data) {
  byId("method-facts").textContent = ui.get() === "en" ? t("method.factsCopy") : data.methodology.facts;
  byId("method-interpretations").textContent = ui.get() === "en" ? t("method.interpretationsCopy") : data.methodology.interpretations;
  byId("method-limitations").textContent = ui.get() === "en" ? t("method.limitationsCopy") : data.methodology.limitations;
}

function localDateValue(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function loadJournalEntries() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(JOURNAL_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && entry.text && entry.created_at && entry.source_date).slice(0, 500);
  } catch {
    return [];
  }
}

function persistJournalEntries() {
  try {
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(state.journalEntries));
    return true;
  } catch {
    return false;
  }
}

function normalizeJournalType(value) {
  return ({
    Fakt: "fact",
    Interpretation: "interpretation",
    Interpretacja: "interpretation",
    "Do weryfikacji": "verify",
    "To verify": "verify",
    Lekcja: "lesson",
    Lesson: "lesson",
  })[value] || value;
}

function journalTypeLabel(value) {
  const key = normalizeJournalType(value);
  return ({
    fact: t("journal.typeFact"),
    interpretation: t("journal.typeInterpretation"),
    verify: t("journal.typeVerify"),
    lesson: t("journal.typeLesson"),
  })[key] || value;
}

function renderJournal() {
  const list = byId("journal-list");
  const entries = [...state.journalEntries].sort((a, b) => b.created_at.localeCompare(a.created_at));
  byId("journal-count").textContent = `${number(entries.length)} ${t("general.entries")}`;
  byId("export-journal").disabled = entries.length === 0;
  if (entries.length === 0) {
    list.innerHTML = `<li class="journal-empty">${escapeHTML(t("journal.empty"))}</li>`;
    return;
  }
  list.innerHTML = entries.map((entry) => `
    <li class="journal-entry">
      <div><span class="journal-type">${escapeHTML(journalTypeLabel(entry.type))}</span><time datetime="${escapeHTML(entry.source_date)}">${escapeHTML(t("journal.event", { date: date(entry.source_date) }))}</time></div>
      <strong>${escapeHTML(entry.project)} · ${escapeHTML(entry.domain_key ? localizedDomain({ domain: entry.domain_key, domain_label: entry.domain }) : entry.domain)}</strong>
      <p>${escapeHTML(entry.text).replace(/\n/g, "<br>")}</p>
      <small>${escapeHTML(t("journal.local", { date: new Intl.DateTimeFormat(ui.locale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.created_at)) }))}</small>
    </li>
  `).join("");
}

function renderJournalControls(data) {
  const projectSelect = byId("journal-project");
  const previousProject = projectSelect.value;
  projectSelect.innerHTML = data.projects.map((project) => `<option value="${escapeHTML(project.id)}">${escapeHTML(project.name)}</option>`).join("");
  projectSelect.value = data.projects.some((project) => project.id === previousProject)
    ? previousProject
    : activeProject(data).id;

  const domainSelect = byId("journal-domain");
  const previousDomain = domainSelect.value;
  const domains = [...new Map(data.projects.flatMap((project) => project.language_learning.terms).map((term) => [term.domain, localizedDomain(term)])).entries()];
  domainSelect.innerHTML = domains.map(([key, label]) => `<option value="${escapeHTML(key)}">${escapeHTML(label)}</option>`).join("");
  domainSelect.value = domains.some(([key]) => key === previousDomain) ? previousDomain : "general";
  if (!byId("journal-source-date").value) byId("journal-source-date").value = localDateValue();
}

function currentTerm() {
  const project = activeProject(state.data);
  return languageTerms(project)[state.cardIndex];
}

function fillJournalFromCurrentTerm() {
  const project = activeProject(state.data);
  const term = currentTerm();
  byId("journal-type").value = "lesson";
  byId("journal-project").value = project.id;
  byId("journal-domain").value = term.domain;
  byId("journal-source-date").value = localDateValue();
  byId("journal-text").value = `${term.english} / ${term.norwegian} / ${term.polish}\n${t("journal.templateDefinition")}: ${term.definition_pl}\n${t("journal.templateOnShip")}: ${term.application_pl}\n${t("journal.templateCheck")}: `;
  byId("journal-text").focus();
  byId("journal-status").textContent = t("journal.filled");
  byId("field-journal").scrollIntoView({ block: "start", behavior: "smooth" });
}

function journalAsMarkdown(entries) {
  const english = ui.get() === "en";
  const lines = [
    english ? "# BATTBYG — shipboard learning and work journal" : "# BATTBYG — dziennik nauki i pracy na statku",
    "",
    `${english ? "Export" : "Eksport"}: ${new Date().toISOString()}`,
    "",
    english
      ? "> Private educational record. A fact, interpretation and item to verify are not equivalent."
      : "> Prywatny zapis edukacyjny. Fakt, interpretacja i element do weryfikacji nie są równoważne.",
    "",
  ];
  [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at)).forEach((entry) => {
    lines.push(
      `## ${entry.source_date} · ${journalTypeLabel(entry.type)}`,
      "",
      `- ${english ? "Project" : "Projekt"}: ${entry.project}`,
      `- ${english ? "Area" : "Obszar"}: ${entry.domain_key ? localizedDomain({ domain: entry.domain_key, domain_label: entry.domain }) : entry.domain}`,
      `- ${english ? "Local record" : "Zapis lokalny"}: ${entry.created_at}`,
      "",
      entry.text,
      "",
    );
  });
  return lines.join("\n");
}

function exportJournal() {
  if (state.journalEntries.length === 0) return;
  const blob = new Blob([journalAsMarkdown(state.journalEntries)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `BATTBYG_${ui.get() === "en" ? "journal" : "dziennik"}_${localDateValue()}.md`;
  link.click();
  URL.revokeObjectURL(url);
  byId("journal-status").textContent = t("journal.exported");
}

function render() {
  renderFilters(state.data);
  renderProjects(state.data);
  renderBars(state.data);
  renderLanguage(state.data);
}

document.addEventListener("click", (event) => {
  const searchResultTarget = event.target.closest("[data-search-result]");
  if (searchResultTarget) {
    openSearchResult(state.searchResults.find((item) => item.id === searchResultTarget.dataset.searchResult));
    return;
  }

  const suggestionTarget = event.target.closest("[data-search-suggestion]");
  if (suggestionTarget) {
    const input = byId("global-search");
    input.value = suggestionTarget.dataset.searchSuggestion;
    renderSearch(input.value);
    input.focus();
    return;
  }

  if (event.target.closest("#clear-search")) {
    const input = byId("global-search");
    input.value = "";
    renderSearch("");
    input.focus();
    return;
  }

  const projectTarget = event.target.closest("[data-project]");
  if (projectTarget) {
    state.selected = projectTarget.dataset.project;
    state.domain = "all";
    state.deckKey = "";
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
    state.deckKey = "";
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

  if (event.target.closest("#previous-card")) {
    const terms = languageTerms(activeProject(state.data));
    state.cardIndex = (state.cardIndex - 1 + terms.length) % terms.length;
    state.revealed = false;
    renderFlashcard(activeProject(state.data));
    return;
  }

  if (event.target.closest("#shuffle-cards")) {
    ensureDeck(activeProject(state.data), true);
    renderFlashcard(activeProject(state.data));
    return;
  }

  if (event.target.closest("#speak-english")) {
    speakTerm("english");
    return;
  }

  if (event.target.closest("#speak-norwegian")) {
    speakTerm("norwegian");
    return;
  }

  if (event.target.closest("#note-current-term")) {
    fillJournalFromCurrentTerm();
    return;
  }

  if (event.target.closest("#export-journal")) {
    exportJournal();
  }
});

byId("journal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const project = state.data.projects.find((item) => item.id === byId("journal-project").value);
  const domainOption = byId("journal-domain").selectedOptions[0];
  const entry = {
    type: byId("journal-type").value,
    project: project?.name || byId("journal-project").value,
    domain: domainOption?.textContent || byId("journal-domain").value,
    domain_key: byId("journal-domain").value,
    source_date: byId("journal-source-date").value,
    text: byId("journal-text").value.trim(),
    created_at: new Date().toISOString(),
  };
  if (!entry.text || !entry.source_date) return;
  state.journalEntries.push(entry);
  if (!persistJournalEntries()) {
    state.journalEntries.pop();
    byId("journal-status").textContent = t("journal.saveFailed");
    return;
  }
  renderJournal();
  byId("journal-text").value = "";
  byId("journal-status").textContent = t("journal.saved", { type: journalTypeLabel(entry.type).toLowerCase(), date: date(entry.source_date) });
});

byId("global-search").addEventListener("input", (event) => renderSearch(event.target.value));
byId("global-search").addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSearch();
    event.target.select();
  }
});
byId("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.searchResults[0]) openSearchResult(state.searchResults[0]);
});

byId("speech-rate").addEventListener("input", (event) => {
  byId("speech-rate-value").value = `${Number(event.target.value).toLocaleString(ui.locale(), { minimumFractionDigits: 2 })}×`;
});

["voice-english", "voice-norwegian"].forEach((id) => {
  byId(id).addEventListener("change", () => {
    byId("voice-status").textContent = t("voice.manual");
  });
});

if ("speechSynthesis" in window) {
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
  loadVoices();
}

window.addEventListener("battbyg:languagechange", () => {
  if (!state.data) return;
  state.searchIndex = buildSearchIndex(state.data);
  renderMetrics(state.data);
  renderUpdates(state.data);
  renderMethod(state.data);
  renderJournalControls(state.data);
  renderJournal();
  render();
  if (byId("global-search").value.trim()) renderSearch(byId("global-search").value);
  if ("speechSynthesis" in window) loadVoices();
});

fetch(`data/site-data.json?v=${PUBLIC_DATA_VERSION}`, { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    state.data = data;
    state.searchIndex = buildSearchIndex(data);
    state.journalEntries = loadJournalEntries();
    renderMetrics(data);
    renderUpdates(data);
    renderMethod(data);
    renderJournalControls(data);
    renderJournal();
    render();
    const initialQuery = new URLSearchParams(window.location.search).get("q");
    if (initialQuery) {
      byId("global-search").value = initialQuery;
      renderSearch(initialQuery);
    }
    if (window.location.hash === "#language-lab") {
      requestAnimationFrame(() => byId("language-lab").scrollIntoView({ block: "start" }));
    }
  })
  .catch(() => {
    byId("main").innerHTML = `<section class="intro"><div><p class="eyebrow">${escapeHTML(t("data.errorEyebrow"))}</p><h1>${escapeHTML(t("data.errorTitle"))}</h1><p class="lead">${escapeHTML(t("data.errorCopy"))}</p></div></section>`;
  });
