const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
function fixture() {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: 'http://localhost', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.console.warn = () => {};
  w.matchMedia = () => ({ matches: true, addEventListener() {} });
  w.fetch = async () => ({ ok: true, json: async () => ({ count: 1, messages: [] }) });
  for (const file of ['script.js', 'games/engine.js', 'games/ui.js']) w.eval(fs.readFileSync(file, 'utf8'));
  return dom;
}
test('menu launches real games; Minesweeper supports flag mode and restart', () => {
  const dom = fixture(), d = dom.window.document;
  d.querySelector('[data-program="minesweeper"]').click();
  assert.ok(d.getElementById('view-minesweeper').classList.contains('is-active'));
  assert.match(d.getElementById('osWindowTitle').textContent, /MINESWEEPER/);
  assert.equal(d.querySelectorAll('.mine-cell').length, 81);
  d.getElementById('mineFlag').click(); d.querySelector('.mine-cell').click();
  assert.match(d.querySelector('.mine-cell').getAttribute('aria-label'), /flagged/);
  d.getElementById('mineNew').click();
  assert.equal(d.getElementById('mineFlag').getAttribute('aria-pressed'), 'false');
  d.querySelector('.mine-cell').click();
  assert.ok(d.querySelector('.mine-cell').classList.contains('is-open'));
  assert.doesNotMatch(d.getElementById('mineStatus').textContent, /Boom/);
  d.getElementById('osWindowClose').click(); assert.equal(d.activeElement.id, 'osMenuButton');
  dom.window.close();
});
test('Solitaire draws and undoes, and preserves its state when switching windows', () => {
  const dom = fixture(), d = dom.window.document;
  d.querySelector('[data-program="solitaire"]').click();
  assert.ok(d.getElementById('view-solitaire').classList.contains('is-active'));
  d.querySelector('[data-type="stock"]').click();
  assert.ok(d.querySelector('[data-type="waste"]'));
  assert.match(d.getElementById('solitaireMoves').textContent, /^1 moves/);
  d.querySelector('[data-program="minesweeper"]').click(); d.querySelector('[data-program="solitaire"]').click();
  assert.ok(d.querySelector('[data-type="waste"]'));
  d.querySelector('[data-type="waste"]').click();
  assert.equal(d.getElementById('solitaireHome').disabled, false);
  d.getElementById('solitaireUndo').click();
  assert.equal(d.querySelector('[data-type="waste"]'), null);
  assert.equal(d.getElementById('solitaireUndo').disabled, true);
  dom.window.close();
});
