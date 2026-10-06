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
    select.add(new Option("Brak głosu dla tego języka", ""));
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
    byId("voice-status").textContent = "Wybrano kobiece głosy EN i NO";
  } else if (state.voices.length === 0) {
    byId("voice-status").textContent = "Przeglądarka jeszcze ładuje głosy";
  } else {
    byId("voice-status").textContent = "Sprawdź wybór — brak rozpoznanego kobiecego głosu dla jednego z języków";
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
    button.title = supported ? "" : "Odsłuch nie jest obsługiwany w tej przeglądarce";
  });
  byId("speech-rate").disabled = !supported;
  if (!supported) {
    ["voice-english", "voice-norwegian"].forEach((id) => { byId(id).disabled = true; });
    byId("voice-status").textContent = "Odsłuch nie jest obsługiwany w tej przeglądarce";
  }
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
  const terms = filteredTerms(project);
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
  }
});

byId("speech-rate").addEventListener("input", (event) => {
  byId("speech-rate-value").value = `${Number(event.target.value).toLocaleString("pl-PL", { minimumFractionDigits: 2 })}×`;
});

["voice-english", "voice-norwegian"].forEach((id) => {
  byId(id).addEventListener("change", () => {
    byId("voice-status").textContent = "Głos wybrany ręcznie";
  });
});

if ("speechSynthesis" in window) {
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
  loadVoices();
}

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
    if (window.location.hash === "#language-lab") {
      requestAnimationFrame(() => byId("language-lab").scrollIntoView({ block: "start" }));
    }
  })
  .catch(() => {
    byId("main").innerHTML = "<section class='intro'><div><p class='eyebrow'>Błąd danych</p><h1>Nie udało się wczytać rejestru.</h1><p class='lead'>Spróbuj odświeżyć stronę. Jeżeli problem pozostaje, aktualizacja wymaga ponownej walidacji.</p></div></section>";
  });
