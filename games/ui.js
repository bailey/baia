(function () {
  const { Minesweeper, Solitaire, red } = window.DesktopGames;
  const mineBoard = document.getElementById('mineBoard');
  const mineStatus = document.getElementById('mineStatus');
  const flagButton = document.getElementById('mineFlag');
  let mines = new Minesweeper(), flagMode = false;

  function renderMines() {
    mineBoard.replaceChildren();
    mines.cells.forEach((cell, i) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'mine-cell'; button.dataset.cell = i;
      const exposedMine = cell.mine && ['lost', 'won'].includes(mines.status);
      button.classList.toggle('is-open', cell.open);
      button.classList.toggle('is-mine', exposedMine);
      button.classList.toggle('is-exploded', cell.mine && cell.open);
      button.dataset.count = cell.count;
      button.textContent = exposedMine ? '✹' : cell.flag ? '⚑' : cell.open ? cell.count || '' : '';
      const description = exposedMine ? 'mine' : cell.flag ? 'flagged' : cell.open ? `${cell.count} neighboring mines` : 'covered';
      button.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}: ${description}`);
      button.setAttribute('aria-disabled', String(cell.open || ['lost', 'won'].includes(mines.status)));
      mineBoard.appendChild(button);
    });
    document.getElementById('mineCounter').textContent = `${10 - mines.flags} flags left`;
    mineStatus.textContent = mines.status === 'won' ? 'Field cleared. You win!' : mines.status === 'lost' ? 'Boom. Try a new field!' : mines.status === 'ready' ? 'Pick a square. Your first reveal is always safe.' : `${mines.remaining} safe squares left to uncover.`;
    flagButton.setAttribute('aria-pressed', String(flagMode));
    flagButton.textContent = flagMode ? '⚑ Flag mode: on' : '⚑ Flag mode: off';
  }
  function mineAction(index, flag) {
    if (flag) mines.flag(index); else mines.reveal(index);
    renderMines();
    mineBoard.children[index].focus({ preventScroll: true });
  }
  mineBoard.addEventListener('click', event => {
    const cell = event.target.closest('[data-cell]');
    if (cell) mineAction(Number(cell.dataset.cell), flagMode || event.shiftKey);
  });
  mineBoard.addEventListener('contextmenu', event => {
    const cell = event.target.closest('[data-cell]');
    if (cell) { event.preventDefault(); mineAction(Number(cell.dataset.cell), true); }
  });
  mineBoard.addEventListener('keydown', event => {
    const cell = event.target.closest('[data-cell]');
    if (!cell) return;
    const index = Number(cell.dataset.cell);
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); mineAction(index, true); }
    const shifts = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
    if (event.key in shifts) {
      event.preventDefault();
      const next = index + shifts[event.key];
      if (next >= 0 && next < 81 && (Math.abs(shifts[event.key]) === 9 || Math.floor(next / 9) === Math.floor(index / 9))) mineBoard.children[next].focus();
    }
  });
  flagButton.addEventListener('click', () => { flagMode = !flagMode; renderMines(); });
  document.getElementById('mineNew').addEventListener('click', () => { mines = new Minesweeper(); flagMode = false; renderMines(); });
  renderMines();

  const table = document.getElementById('solitaireTable');
  const solStatus = document.getElementById('solitaireStatus');
  let solitaire = new Solitaire(), selected = null;
  const rankName = rank => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[rank] || String(rank));
  const suitName = { '♠': 'spades', '♥': 'hearts', '♣': 'clubs', '♦': 'diamonds' };
  const cardName = card => `${rankName(card.rank)} of ${suitName[card.suit]}`;
  const same = (a, b) => a && b && a.type === b.type && a.pile === b.pile && a.card === b.card;

  function cardButton(card, source) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'playing-card';
    button.dataset.type = source.type; button.dataset.pile = source.pile; button.dataset.card = source.card;
    if (!card.up) {
      button.classList.add('card-back'); button.disabled = true;
      button.setAttribute('aria-label', 'Face-down card');
    } else {
      button.classList.toggle('card-red', red(card));
      button.classList.toggle('is-selected', Boolean(selected && source.type === selected.type && source.pile === selected.pile && source.card >= selected.card));
      button.setAttribute('aria-pressed', String(Boolean(same(selected, source))));
      button.setAttribute('aria-label', `${cardName(card)}, ${source.type === 'tableau' ? `column ${source.pile + 1}` : source.type}`);
      const corner = document.createElement('span'); corner.className = 'card-corner'; corner.textContent = `${rankName(card.rank)}${card.suit}`;
      const center = document.createElement('span'); center.className = 'card-center'; center.textContent = card.suit;
      button.append(corner, center);
    }
    return button;
  }
  function slot(label, type, pile) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'card-slot'; button.textContent = label;
    button.dataset.type = type; button.dataset.pile = pile;
    button.setAttribute('aria-label', type === 'tableau' ? `Empty column ${pile + 1}: kings only` : `Empty foundation ${pile + 1}: aces first`);
    return button;
  }
  function renderSolitaire(message = '') {
    const focused = document.activeElement;
    const focusKey = table.contains(focused) ? [focused.dataset.type, focused.dataset.pile, focused.dataset.card] : null;
    table.replaceChildren();
    const top = document.createElement('div'); top.className = 'solitaire-top';
    const stock = document.createElement('button'); stock.type = 'button'; stock.className = 'playing-card card-back stock-card'; stock.dataset.type = 'stock';
    stock.textContent = solitaire.stock.length ? '✦' : '↻';
    stock.classList.toggle('stock-empty', !solitaire.stock.length);
    stock.setAttribute('aria-label', solitaire.stock.length ? `Draw a card, ${solitaire.stock.length} in stock` : 'Recycle waste into stock');
    stock.disabled = !solitaire.stock.length && !solitaire.waste.length || solitaire.won;
    top.appendChild(stock);
    const waste = document.createElement('div'); waste.className = 'waste-pile';
    if (solitaire.waste.length) waste.appendChild(cardButton(solitaire.waste[solitaire.waste.length - 1], { type: 'waste', pile: 0, card: solitaire.waste.length - 1 }));
    else { const empty = document.createElement('div'); empty.className = 'card-slot'; empty.textContent = 'WASTE'; waste.appendChild(empty); }
    top.appendChild(waste);
    const spacer = document.createElement('div'); spacer.setAttribute('aria-hidden', 'true'); top.appendChild(spacer);
    solitaire.foundations.forEach((pile, i) => top.appendChild(pile.length ? cardButton(pile[pile.length - 1], { type: 'foundation', pile: i, card: pile.length - 1 }) : slot('A', 'foundation', i)));
    table.appendChild(top);
    const columns = document.createElement('div'); columns.className = 'solitaire-columns';
    solitaire.tableau.forEach((pile, i) => {
      const column = document.createElement('div'); column.className = 'solitaire-column';
      if (!pile.length) column.appendChild(slot('K', 'tableau', i));
      pile.forEach((card, j) => column.appendChild(cardButton(card, { type: 'tableau', pile: i, card: j })));
      columns.appendChild(column);
    });
    table.appendChild(columns);
    document.getElementById('solitaireMoves').textContent = `${solitaire.moves} moves · ${solitaire.foundations.reduce((sum, p) => sum + p.length, 0)}/52 home`;
    document.getElementById('solitaireUndo').disabled = !solitaire.history.length;
    document.getElementById('solitaireHome').disabled = !selected;
    solStatus.textContent = solitaire.won ? 'All 52 cards home. You win!' : message || 'Draw a card, or select a face-up card and then its destination.';
    if (focusKey) {
      const match = [...table.querySelectorAll('button')].find(el => el.dataset.type === focusKey[0] && el.dataset.pile === focusKey[1] && el.dataset.card === focusKey[2] && !el.disabled);
      (match || stock).focus({ preventScroll: true });
    }
  }
  table.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled || solitaire.won) return;
    const type = button.dataset.type, pile = Number(button.dataset.pile), card = Number(button.dataset.card);
    if (type === 'stock') { solitaire.draw(); selected = null; renderSolitaire(); return; }
    const source = { type, pile, card };
    if (same(selected, source)) { selected = null; renderSolitaire('Selection cleared.'); return; }
    if (selected && ['foundation', 'tableau'].includes(type)) {
      if (solitaire.move(selected, { type, pile })) { selected = null; renderSolitaire('Nice move.'); return; }
      // Keep selection when a destination is invalid; clicking it again cancels.
      renderSolitaire('That move does not fit. Choose another destination, or press Escape to clear.'); return;
    }
    if (solitaire.cards(source).length) {
      selected = source; renderSolitaire(`${cardName(solitaire.cards(source)[0])} selected. Choose a column or foundation.`);
    }
  });
  table.addEventListener('keydown', event => {
    if (event.key === 'Escape') { selected = null; renderSolitaire('Selection cleared.'); }
  });
  document.getElementById('solitaireHome').addEventListener('click', () => {
    if (!selected) return;
    for (let i = 0; i < 4; i++) {
      if (solitaire.move(selected, { type: 'foundation', pile: i })) { selected = null; renderSolitaire('Card sent home.'); return; }
    }
    renderSolitaire('This card cannot go home yet. Foundations build from ace to king in the same suit.');
  });
  document.getElementById('solitaireUndo').addEventListener('click', () => { solitaire.undo(); selected = null; renderSolitaire('Move undone.'); });
  document.getElementById('solitaireNew').addEventListener('click', () => { solitaire = new Solitaire(); selected = null; renderSolitaire('New deal. Good luck!'); });
  renderSolitaire();
})();
