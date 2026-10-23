/* Pure game rules shared by the desktop UI and regression tests. */
(function (root) {
  function shuffle(items, random = Math.random) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  class Minesweeper {
    constructor(random = Math.random) {
      this.random = random;
      this.size = 9;
      this.mineCount = 10;
      this.status = 'ready';
      this.cells = Array.from({ length: 81 }, () => ({ mine: false, open: false, flag: false, count: 0 }));
    }
    neighbors(index) {
      const row = Math.floor(index / this.size), col = index % this.size;
      const result = [];
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
        if (!x && !y) continue;
        const r = row + y, c = col + x;
        if (r >= 0 && r < this.size && c >= 0 && c < this.size) result.push(r * this.size + c);
      }
      return result;
    }
    plant(first) {
      const safe = new Set([first, ...this.neighbors(first)]);
      shuffle(this.cells.map((_, i) => i).filter(i => !safe.has(i)), this.random)
        .slice(0, this.mineCount).forEach(i => { this.cells[i].mine = true; });
      this.cells.forEach((cell, i) => { cell.count = this.neighbors(i).filter(n => this.cells[n].mine).length; });
      this.status = 'playing';
    }
    flag(index) {
      const cell = this.cells[index];
      if (!cell || cell.open || ['won', 'lost'].includes(this.status)) return false;
      if (!cell.flag && this.flags === this.mineCount) return false;
      cell.flag = !cell.flag;
      return true;
    }
    reveal(index) {
      const cell = this.cells[index];
      if (!cell || cell.open || cell.flag || ['won', 'lost'].includes(this.status)) return false;
      if (this.status === 'ready') this.plant(index);
      if (cell.mine) { cell.open = true; this.status = 'lost'; return true; }
      const queue = [index];
      while (queue.length) {
        const current = queue.pop(), next = this.cells[current];
        if (next.open || next.flag || next.mine) continue;
        next.open = true;
        if (!next.count) queue.push(...this.neighbors(current));
      }
      if (this.cells.every(c => c.mine || c.open)) this.status = 'won';
      return true;
    }
    get flags() { return this.cells.filter(c => c.flag).length; }
    get remaining() { return this.cells.filter(c => !c.mine && !c.open).length; }
  }

  const red = card => card.suit === '♥' || card.suit === '♦';
  class Solitaire {
    constructor(random = Math.random) {
      const deck = shuffle(['♠', '♥', '♣', '♦'].flatMap(suit =>
        Array.from({ length: 13 }, (_, i) => ({ suit, rank: i + 1, up: false }))), random);
      this.tableau = Array.from({ length: 7 }, (_, i) => {
        const pile = deck.splice(0, i + 1); pile[i].up = true; return pile;
      });
      this.stock = deck;
      this.waste = [];
      this.foundations = [[], [], [], []];
      this.history = [];
      this.moves = 0;
    }
    save() {
      this.history.push(JSON.stringify({ tableau: this.tableau, stock: this.stock, waste: this.waste, foundations: this.foundations, moves: this.moves }));
      if (this.history.length > 200) this.history.shift();
      this.moves++;
    }
    undo() {
      if (!this.history.length) return false;
      Object.assign(this, JSON.parse(this.history.pop()));
      return true;
    }
    draw() {
      if (this.won || (!this.stock.length && !this.waste.length)) return false;
      this.save();
      if (this.stock.length) {
        const card = this.stock.pop(); card.up = true; this.waste.push(card);
      } else {
        this.stock = this.waste.reverse(); this.waste = [];
        this.stock.forEach(c => { c.up = false; });
      }
      return true;
    }
    pile(type, index) {
      if (type === 'waste') return this.waste;
      if (type === 'tableau') return this.tableau[index];
      if (type === 'foundation') return this.foundations[index];
      return null;
    }
    cards(source) {
      const pile = this.pile(source.type, source.pile);
      if (!pile || !Number.isInteger(source.card) || source.card < 0 || source.card >= pile.length) return [];
      if (source.type !== 'tableau' && source.card !== pile.length - 1) return [];
      const cards = pile.slice(source.card);
      if (cards.some(c => !c.up)) return [];
      if (cards.some((c, i) => i > 0 && (cards[i - 1].rank !== c.rank + 1 || red(cards[i - 1]) === red(c)))) return [];
      return cards;
    }
    move(source, target) {
      if (this.won || !['tableau', 'foundation'].includes(target.type)) return false;
      const from = this.pile(source.type, source.pile), to = this.pile(target.type, target.pile);
      const cards = this.cards(source);
      if (!to || from === to || !cards.length) return false;
      const card = cards[0], top = to[to.length - 1];
      if (target.type === 'foundation') {
        if (cards.length !== 1 || (top ? top.suit !== card.suit || card.rank !== top.rank + 1 : card.rank !== 1)) return false;
      } else if (top ? !top.up || top.rank !== card.rank + 1 || red(top) === red(card) : card.rank !== 13) return false;
      this.save();
      to.push(...from.splice(source.card));
      if (source.type === 'tableau' && from.length) from[from.length - 1].up = true;
      return true;
    }
    get won() { return this.foundations.every(pile => pile.length === 13); }
  }
  const games = { Minesweeper, Solitaire, red };
  if (typeof module !== 'undefined' && module.exports) module.exports = games;
  else root.DesktopGames = games;
})(typeof window !== 'undefined' ? window : globalThis);
