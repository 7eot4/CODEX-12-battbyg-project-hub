import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
if (process.platform !== "win32" || !existsSync(edge)) {
  console.log("BROWSER_SEARCH_E2E_SKIPPED Edge unavailable");
  process.exit(0);
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

const port = await freePort();
const profile = await mkdtemp(path.join(os.tmpdir(), "battbyg-search-e2e-"));
const browser = spawn(edge, [
  "--headless=new",
  "--disable-gpu",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "http://127.0.0.1:4174/",
], { stdio: "ignore", windowsHide: true });

let socket;
try {
  let target;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      target = targets.find((item) => item.type === "page" && item.url.startsWith("http://127.0.0.1:4174/"));
      if (target) break;
    } catch {}
    await sleep(100);
  }
  assert.ok(target, "Edge did not expose the BATTBYG page");

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let commandId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    ready = await evaluate("typeof state !== 'undefined' && Boolean(state.data) && state.searchIndex.length > 80");
    if (ready) break;
    await sleep(100);
  }
  assert.equal(ready, true, "Search index did not load");

  const layout = JSON.parse(await evaluate(`JSON.stringify({
    heroLoaded: document.querySelector('.hero-visual img').complete && document.querySelector('.hero-visual img').naturalWidth > 0,
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    disclaimer: document.querySelector('.hero-visual figcaption').textContent
  })`));
  assert.equal(layout.heroLoaded, true);
  assert.equal(layout.noHorizontalOverflow, true);
  assert.match(layout.disclaimer, /nie jest materiałem dowodowym/);

  const resultPreview = JSON.parse(await evaluate(`(() => {
    const input = document.getElementById('global-search');
    input.value = 'uziemienie';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const result = document.querySelector('[data-search-result]');
    return JSON.stringify({ count: state.searchResults.length, title: result?.querySelector('strong')?.textContent, type: result?.dataset.resultType });
  })()`));
  assert.ok(resultPreview.count >= 1);
  assert.equal(resultPreview.title, "earthing");
  assert.equal(resultPreview.type, "term");

  await evaluate("document.querySelector('[data-search-result]').click(); true");
  await sleep(250);
  const opened = JSON.parse(await evaluate(`JSON.stringify({
    project: state.selected,
    domain: state.domain,
    question: document.getElementById('flashcard-question').textContent,
    answer: document.getElementById('flashcard-answer').textContent,
    answerHidden: document.getElementById('flashcard-answer').hidden,
    resultsHidden: document.getElementById('search-results').hidden
  })`));
  assert.ok(["02_GO_SARS", "03_MV_BATSFJORD"].includes(opened.project));
  assert.equal(opened.domain, "electrical");
  assert.equal(opened.question, "earthing");
  assert.match(opened.answer, /uziemienie/);
  assert.match(opened.answer, /Celowe połączenie punktu obwodu/);
  assert.equal(opened.answerHidden, false);
  assert.equal(opened.resultsHidden, true);

  const definitionCoverage = JSON.parse(await evaluate(`JSON.stringify({
    terms: new Map(state.data.projects.flatMap((project) => project.language_learning.terms).map((term) => [term.id, term])).size,
    definitions: new Map(state.data.projects.flatMap((project) => project.language_learning.terms).filter((term) => term.definition_pl && term.application_pl).map((term) => [term.id, term])).size,
    dated: state.data.projects.every((project) => project.language_learning.terms.every((term) => term.definition_added_on === '2026-10-07'))
  })`));
  assert.deepEqual(definitionCoverage, { terms: 77, definitions: 77, dated: true });

  const journal = JSON.parse(await evaluate(`(() => {
    document.getElementById('journal-type').value = 'Fakt';
    document.getElementById('journal-text').value = 'Test lokalnego zapisu — bez publikacji.';
    document.getElementById('journal-form').requestSubmit();
    return JSON.stringify({
      stored: JSON.parse(localStorage.getItem('battbyg-field-journal-v1') || '[]').length,
      rendered: document.querySelectorAll('.journal-entry').length,
      markdown: journalAsMarkdown(state.journalEntries).includes('Test lokalnego zapisu'),
      noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
    });
  })()`));
  assert.deepEqual(journal, { stored: 1, rendered: 1, markdown: true, noOverflow: true });
  await evaluate("localStorage.removeItem('battbyg-field-journal-v1'); true");

  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(150);
  const mobileLayout = JSON.parse(await evaluate(`JSON.stringify({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    journalColumns: getComputedStyle(document.querySelector('.journal-grid')).gridTemplateColumns,
    guideColumns: getComputedStyle(document.querySelector('.guide-flow')).gridTemplateColumns
  })`));
  assert.equal(mobileLayout.noHorizontalOverflow, true);
  assert.equal(mobileLayout.journalColumns.split(" ").length, 1);
  assert.equal(mobileLayout.guideColumns.split(" ").length, 1);

  console.log("BROWSER_SEARCH_E2E_OK");
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  if (browser.pid) spawnSync("taskkill.exe", ["/PID", String(browser.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  await sleep(600);
  const resolvedProfile = path.resolve(profile);
  if (resolvedProfile.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolvedProfile).startsWith("battbyg-search-e2e-")) {
    try {
      rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
    } catch {
      console.warn(`BROWSER_SEARCH_E2E_TEMP_RETAINED ${resolvedProfile}`);
    }
  }
}
