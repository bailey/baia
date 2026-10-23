const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Minesweeper, Solitaire } = require('../games/engine');
const card = (rank, suit = '♠', up = true) => ({ rank, suit, up });
const source = (pile, index = 0) => ({ type: 'tableau', pile, card: index });
const target = pile => ({ type: 'tableau', pile });
function emptySolitaire() {
  const game = new Solitaire(); game.tableau = [[], [], [], [], [], [], []]; game.stock = []; game.waste = []; return game;
}

test('Minesweeper first reveal protects every starting square and neighbors', () => {
  for (let first = 0; first < 81; first++) {
    const game = new Minesweeper(() => .42); game.reveal(first);
    assert.equal(game.cells.filter(c => c.mine).length, 10);
    assert.equal(game.cells[first].count, 0);
    assert.ok([first, ...game.neighbors(first)].every(i => !game.cells[i].mine));
    game.cells.forEach((cell, i) => assert.equal(cell.count, game.neighbors(i).filter(n => game.cells[n].mine).length));
  }
});
test('Minesweeper flags prevent reveal; clearing every safe square wins', () => {
  const game = new Minesweeper(() => .37);
  game.flag(0); assert.equal(game.reveal(0), false); assert.equal(game.status, 'ready');
  game.flag(0); game.reveal(0);
  game.cells.forEach((cell, i) => { if (!cell.mine) game.reveal(i); });
  assert.equal(game.status, 'won');
  assert.equal(game.flag(game.cells.findIndex(c => c.mine)), false);
});
test('Minesweeper mine ends game and freezes further actions', () => {
  const game = new Minesweeper(() => .2); game.reveal(40);
  game.reveal(game.cells.findIndex(c => c.mine)); assert.equal(game.status, 'lost');
  assert.equal(game.reveal(1), false); assert.equal(game.flag(1), false);
});
test('Solitaire deals all 52 unique cards with only tableau tops exposed', () => {
  const game = new Solitaire();
  assert.equal(game.stock.length, 24);
  assert.deepEqual(game.tableau.map(p => p.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set([...game.stock, ...game.tableau.flat()].map(c => c.suit + c.rank)).size, 52);
  game.tableau.forEach(p => assert.ok(p.every((c, i) => c.up === (i === p.length - 1))));
});
test('Solitaire stock recycles in order and undo restores each operation', () => {
  const game = emptySolitaire(); game.stock = [card(1, '♠', false), card(2, '♠', false)];
  game.draw(); assert.equal(game.waste.at(-1).rank, 2);
  game.draw(); assert.equal(game.waste.at(-1).rank, 1);
  game.draw(); assert.deepEqual(game.stock.map(c => c.rank), [1, 2]); assert.ok(game.stock.every(c => !c.up));
  game.undo(); assert.deepEqual(game.waste.map(c => c.rank), [2, 1]); assert.equal(game.moves, 2);
  game.draw(); game.draw(); assert.equal(game.waste.at(-1).rank, 2);
});
test('Solitaire moves alternating sequences, flips exposed cards, and undoes both', () => {
  const game = emptySolitaire();
  game.tableau[0] = [card(4, '♣', false), card(8, '♥'), card(7)]; game.tableau[1] = [card(9)];
  assert.equal(game.move(source(0, 1), target(1)), true);
  assert.equal(game.tableau[0][0].up, true); assert.equal(game.tableau[1].length, 3);
  game.undo(); assert.equal(game.tableau[0][0].up, false); assert.equal(game.tableau[0].length, 3);
  assert.equal(game.move(source(0, 0), target(1)), false);
  assert.equal(game.move(source(0, 1), target(2)), false); // only kings in empty columns
  game.tableau[1] = [card(9, '♦')]; assert.equal(game.move(source(0, 1), target(1)), false);
  game.tableau[0] = [card(13)]; assert.equal(game.move(source(0), target(2)), true);
});
test('Solitaire foundations require ascending same-suit singles and can be moved back', () => {
  const game = emptySolitaire(); game.tableau[0] = [card(2)];
  const home = { type: 'foundation', pile: 0 };
  assert.equal(game.move(source(0), home), false);
  game.tableau[0] = [card(1)]; assert.equal(game.move(source(0), home), true);
  game.tableau[1] = [card(2, '♥')]; assert.equal(game.move(source(1), home), false);
  game.tableau[1] = [card(2)]; assert.equal(game.move(source(1), home), true);
  game.tableau[2] = [card(3, '♥')];
  assert.equal(game.move({ type: 'foundation', pile: 0, card: 1 }, target(2)), true);
  assert.equal(game.foundations[0].length, 1);
});
test('Solitaire detects victory and undo can reopen the game', () => {
  const game = emptySolitaire();
  game.foundations = ['♠', '♥', '♣', '♦'].map(suit => Array.from({ length: 13 }, (_, i) => card(i + 1, suit)));
  game.tableau[0] = [game.foundations[3].pop()];
  assert.equal(game.won, false);
  assert.equal(game.move(source(0), { type: 'foundation', pile: 3 }), true);
  assert.equal(game.won, true); game.undo(); assert.equal(game.won, false);
});
