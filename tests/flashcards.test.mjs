import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const elements = new Map();
const element = (id) => {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      value: id === "speech-rate" ? "0.72" : "",
      addEventListener() {},
      setAttribute() {},
      classList: { toggle() {} },
      add(option) { this.options = [...(this.options || []), option]; },
      innerHTML: "",
      textContent: "",
      hidden: false,
      disabled: false,
    });
  }
  return elements.get(id);
};

let clickHandler;
const context = vm.createContext({
  console,
  Intl,
  Date,
  Math,
  Uint32Array,
  Option: class Option { constructor(text, value) { this.text = text; this.value = value; } },
  window: { crypto: globalThis.crypto },
  document: {
    getElementById: element,
    querySelectorAll: () => [],
    addEventListener(type, handler) { if (type === "click") clickHandler = handler; },
  },
  fetch: () => new Promise(() => {}),
});

const source = fs.readFileSync(new URL("../docs/assets/app.js", import.meta.url), "utf8");
vm.runInContext(source, context);

const term = (english) => ({
  english,
  norwegian: `no-${english}`,
  polish: `pl-${english}`,
  domain: "general",
  domain_label: "Ogólne",
  evidence_basis: "test",
});
const project = { id: "p", language_learning: { terms: [term("a"), term("b"), term("c")] } };

context.project = project;
vm.runInContext("state.data = { projects: [project] }; state.selected = 'p'; state.deck = [project.language_learning.terms[0], project.language_learning.terms[1], project.language_learning.terms[2]]; state.deckKey = 'p|all';", context);

assert.equal(vm.runInContext("preferredVoiceIndex([{name:'Microsoft Ryan Online',lang:'en-GB',localService:false},{name:'Microsoft Sonia Online (Natural)',lang:'en-GB',localService:false}], 'english')", context), 1);
assert.equal(vm.runInContext("preferredVoiceIndex([{name:'Microsoft Finn Online',lang:'nb-NO',localService:false},{name:'Microsoft Pernille Online',lang:'nb-NO',localService:false}], 'norwegian')", context), 1);
assert.equal(vm.runInContext("voiceLanguageMatches({lang:'no-NO'}, 'norwegian')", context), true);

const siteData = JSON.parse(fs.readFileSync(new URL("../docs/data/site-data.json", import.meta.url), "utf8"));
context.siteData = siteData;
assert.ok(vm.runInContext("buildSearchIndex(siteData).length", context) > 80);
assert.equal(vm.runInContext("findSearchResults(buildSearchIndex(siteData), 'uziemienie')[0].title", context), "earthing");
assert.equal(vm.runInContext("findSearchResults(buildSearchIndex(siteData), 'jording')[0].title", context), "earthing");
assert.equal(vm.runInContext("findSearchResults(buildSearchIndex(siteData), 'control cabinet')[0].title", context), "control cabinet");
assert.equal(vm.runInContext("findSearchResults(buildSearchIndex(siteData), 'rozdzial energii')[0].title", context), "Rozdział energii");
assert.equal(vm.runInContext("findSearchResults(buildSearchIndex(siteData), 'fonnes')[0].title", context), "M/S FONNES");

const before = project.language_learning.terms.map(({ english }) => english);
const shuffled = vm.runInContext("shuffled(project.language_learning.terms).map((item) => item.english)", context);
assert.deepEqual([...shuffled].sort(), [...before].sort());
assert.deepEqual(project.language_learning.terms.map(({ english }) => english), before);

const click = (selector) => clickHandler({ target: { closest: (query) => query === selector ? {} : null } });
click("#previous-card");
assert.equal(vm.runInContext("state.cardIndex", context), 2);
click("#next-card");
assert.equal(vm.runInContext("state.cardIndex", context), 0);
click("#shuffle-cards");
assert.equal(vm.runInContext("state.cardIndex", context), 0);
assert.equal(vm.runInContext("state.deck.length", context), 3);
assert.notEqual(vm.runInContext("state.deck[0].english", context), "a");

console.log("FLASHCARD_AND_SEARCH_TESTS_OK");
