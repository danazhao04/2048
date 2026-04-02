const GRID_SIZE = 4;
const BEST_SCORE_KEY = "codex-2048-best-score";
const MOVE_ANIMATION_MS = 185;
const formatter = new Intl.NumberFormat();

class Game2048 {
  constructor(elements) {
    this.gridEl = elements.grid;
    this.tileLayerEl = elements.tileLayer;
    this.boardShellEl = elements.boardShell;
    this.scoreEl = elements.score;
    this.bestScoreEl = elements.bestScore;
    this.newGameButton = elements.newGame;
    this.overlayEl = elements.overlay;
    this.overlayTagEl = elements.overlayTag;
    this.overlayTitleEl = elements.overlayTitle;
    this.overlayTextEl = elements.overlayText;
    this.overlayPrimaryButton = elements.overlayPrimary;
    this.overlaySecondaryButton = elements.overlaySecondary;

    this.grid = [];
    this.score = 0;
    this.bestScore = this.loadBestScore();
    this.over = false;
    this.won = false;
    this.keepPlaying = false;
    this.animating = false;
    this.touchStart = null;
    this.backgroundCellEls = [];
    this.tileEls = new Map();
    this.grid = this.createEmptyGrid();
    this.tiles = new Map();
    this.nextTileId = 1;
    this.animationTimer = null;
    this.overlayAction = "restart";

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleOverlayPrimary = this.handleOverlayPrimary.bind(this);
    this.handleResize = this.handleResize.bind(this);

    this.createCells();
    this.bindEvents();
    this.start();
  }

  createCells() {
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < GRID_SIZE * GRID_SIZE; index += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      fragment.appendChild(cell);
      this.backgroundCellEls.push(cell);
    }

    this.gridEl.appendChild(fragment);
  }

  bindEvents() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("resize", this.handleResize);
    this.boardShellEl.addEventListener("pointerdown", this.handlePointerDown);
    this.boardShellEl.addEventListener("pointerup", this.handlePointerUp);
    this.newGameButton.addEventListener("click", () => this.start());
    this.overlayPrimaryButton.addEventListener("click", this.handleOverlayPrimary);
    this.overlaySecondaryButton.addEventListener("click", () => this.start());
  }

  start() {
    this.clearAnimation();
    this.grid = this.createEmptyGrid();
    this.tiles.clear();
    this.tileEls.forEach((tileEl) => tileEl.remove());
    this.tileEls.clear();
    this.score = 0;
    this.over = false;
    this.won = false;
    this.keepPlaying = false;
    this.animating = false;
    this.touchStart = null;

    this.createRandomTile(true);
    this.createRandomTile(true);

    this.render({
      bumpScore: true,
    });
  }

  createEmptyGrid() {
    return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  }

  clearAnimation() {
    if (this.animationTimer) {
      window.clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
  }

  loadBestScore() {
    try {
      const savedScore = Number.parseInt(
        localStorage.getItem(BEST_SCORE_KEY) || "0",
        10
      );
      return Number.isNaN(savedScore) ? 0 : savedScore;
    } catch (error) {
      return 0;
    }
  }

  saveBestScore() {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
    } catch (error) {
      // Local storage can fail in restricted contexts; the game still works without it.
    }
  }

  handleKeyDown(event) {
    if (this.animating) {
      return;
    }

    const moveMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      a: "left",
      s: "down",
      d: "right",
      W: "up",
      A: "left",
      S: "down",
      D: "right",
    };

    const direction = moveMap[event.key];
    if (!direction) {
      return;
    }

    event.preventDefault();
    this.move(direction);
  }

  handlePointerDown(event) {
    if (this.animating) {
      return;
    }

    this.touchStart = { x: event.clientX, y: event.clientY };
  }

  handlePointerUp(event) {
    if (!this.touchStart) {
      return;
    }

    const dx = event.clientX - this.touchStart.x;
    const dy = event.clientY - this.touchStart.y;
    this.touchStart = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) {
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      this.move(dx > 0 ? "right" : "left");
      return;
    }

    this.move(dy > 0 ? "down" : "up");
  }

  handleOverlayPrimary() {
    if (this.overlayAction === "continue") {
      this.keepPlaying = true;

      if (!this.canMove()) {
        this.over = true;
        this.render({
          bumpScore: true,
        });
        return;
      }

      this.render();
      return;
    }

    this.start();
  }

  handleResize() {
    this.render();
  }

  move(direction) {
    if (this.animating || this.over || (this.won && !this.keepPlaying)) {
      return;
    }

    const { actions, moved, scoreGained } = this.computeMove(direction);

    if (!moved) {
      if (!this.canMoveOnGrid(this.grid)) {
        this.over = true;
        this.render({
          bumpScore: true,
        });
        return;
      }

      this.render();
      return;
    }

    this.animating = true;
    this.prepareTilesForMove(actions);
    this.render();

    this.animationTimer = window.setTimeout(() => {
      this.finishMove(actions, scoreGained);
    }, MOVE_ANIMATION_MS);
  }

  computeMove(direction) {
    const actions = [];
    let moved = false;
    let scoreGained = 0;

    for (let lineIndex = 0; lineIndex < GRID_SIZE; lineIndex += 1) {
      const line = this.getLineTiles(direction, lineIndex);
      let slotIndex = 0;

      for (let index = 0; index < line.length; index += 1) {
        const currentId = line[index];
        const currentTile = this.tiles.get(currentId);
        const nextId = line[index + 1];
        const nextTile = nextId ? this.tiles.get(nextId) : null;
        const destination = this.getDestination(direction, lineIndex, slotIndex);

        if (nextTile && currentTile.value === nextTile.value) {
          actions.push({
            type: "merge",
            ids: [currentId, nextId],
            toRow: destination.row,
            toCol: destination.col,
            value: currentTile.value * 2,
          });
          scoreGained += currentTile.value * 2;
          moved = true;
          index += 1;
        } else {
          actions.push({
            type: "move",
            id: currentId,
            toRow: destination.row,
            toCol: destination.col,
          });

          if (
            currentTile.row !== destination.row ||
            currentTile.col !== destination.col
          ) {
            moved = true;
          }
        }

        slotIndex += 1;
      }
    }

    return { actions, moved, scoreGained };
  }

  getLineTiles(direction, lineIndex) {
    const ids = [];

    if (direction === "left" || direction === "right") {
      for (let offset = 0; offset < GRID_SIZE; offset += 1) {
        const colIndex = direction === "left" ? offset : GRID_SIZE - 1 - offset;
        const tileId = this.grid[lineIndex][colIndex];
        if (tileId) {
          ids.push(tileId);
        }
      }
      return ids;
    }

    for (let offset = 0; offset < GRID_SIZE; offset += 1) {
      const rowIndex = direction === "up" ? offset : GRID_SIZE - 1 - offset;
      const tileId = this.grid[rowIndex][lineIndex];
      if (tileId) {
        ids.push(tileId);
      }
    }

    return ids;
  }

  getDestination(direction, lineIndex, slotIndex) {
    if (direction === "left") {
      return { row: lineIndex, col: slotIndex };
    }

    if (direction === "right") {
      return { row: lineIndex, col: GRID_SIZE - 1 - slotIndex };
    }

    if (direction === "up") {
      return { row: slotIndex, col: lineIndex };
    }

    return { row: GRID_SIZE - 1 - slotIndex, col: lineIndex };
  }

  prepareTilesForMove(actions) {
    this.tiles.forEach((tile) => {
      tile.isNew = false;
      tile.isMerged = false;
      tile.isRemoving = false;
    });

    actions.forEach((action) => {
      if (action.type === "move") {
        const tile = this.tiles.get(action.id);
        tile.row = action.toRow;
        tile.col = action.toCol;
        return;
      }

      action.ids.forEach((tileId) => {
        const tile = this.tiles.get(tileId);
        tile.row = action.toRow;
        tile.col = action.toCol;
        tile.isRemoving = true;
      });
    });
  }

  finishMove(actions, scoreGained) {
    this.clearAnimation();

    const nextGrid = this.createEmptyGrid();
    const nextTiles = new Map();

    actions.forEach((action) => {
      if (action.type === "move") {
        const tile = this.tiles.get(action.id);
        tile.isNew = false;
        tile.isMerged = false;
        tile.isRemoving = false;
        nextGrid[action.toRow][action.toCol] = tile.id;
        nextTiles.set(tile.id, tile);
        return;
      }

      action.ids.forEach((tileId) => {
        const tileEl = this.tileEls.get(tileId);
        if (tileEl) {
          tileEl.remove();
          this.tileEls.delete(tileId);
        }
      });

      const mergedTile = this.createTile(action.value, action.toRow, action.toCol, {
        isMerged: true,
      });
      nextGrid[action.toRow][action.toCol] = mergedTile.id;
      nextTiles.set(mergedTile.id, mergedTile);
    });

    this.tiles = nextTiles;
    this.grid = nextGrid;
    this.score += scoreGained;

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.saveBestScore();
    }

    this.createRandomTile(true);

    if (!this.won && this.hasValueOnGrid(this.grid, 2048)) {
      this.won = true;
    }

    if (!this.canMoveOnGrid(this.grid)) {
      this.over = true;
    }

    this.animating = false;
    this.render({
      bumpScore: scoreGained > 0,
    });
  }

  createRandomTile(isNew = false) {
    const emptyCells = [];

    for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
      for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
        if (this.grid[rowIndex][colIndex] === 0) {
          emptyCells.push({ rowIndex, colIndex });
        }
      }
    }

    if (emptyCells.length === 0) {
      return null;
    }

    const choice = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = this.createTile(value, choice.rowIndex, choice.colIndex, { isNew });

    this.grid[choice.rowIndex][choice.colIndex] = tile.id;
    this.tiles.set(tile.id, tile);
    return tile;
  }

  createTile(value, row, col, options = {}) {
    const tile = {
      id: this.nextTileId,
      value,
      row,
      col,
      isNew: Boolean(options.isNew),
      isMerged: Boolean(options.isMerged),
      isRemoving: false,
    };

    this.nextTileId += 1;
    return tile;
  }

  hasValueOnGrid(grid, targetValue) {
    for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
      for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
        const tileId = grid[rowIndex][colIndex];
        if (tileId && this.tiles.get(tileId)?.value === targetValue) {
          return true;
        }
      }
    }

    return false;
  }

  canMoveOnGrid(grid) {
    for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
      for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
        const tileId = grid[rowIndex][colIndex];
        const value = tileId ? this.tiles.get(tileId).value : 0;

        if (value === 0) {
          return true;
        }

        if (rowIndex < GRID_SIZE - 1) {
          const downId = grid[rowIndex + 1][colIndex];
          if (downId && value === this.tiles.get(downId).value) {
            return true;
          }
        }

        if (colIndex < GRID_SIZE - 1) {
          const rightId = grid[rowIndex][colIndex + 1];
          if (rightId && value === this.tiles.get(rightId).value) {
            return true;
          }
        }
      }
    }

    return false;
  }

  getTileMetrics(row, col) {
    const cellIndex = row * GRID_SIZE + col;
    const cellEl = this.backgroundCellEls[cellIndex];

    if (!cellEl) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const layerRect = this.tileLayerEl.getBoundingClientRect();
    const cellRect = cellEl.getBoundingClientRect();

    return {
      x: cellRect.left - layerRect.left,
      y: cellRect.top - layerRect.top,
      width: cellRect.width,
      height: cellRect.height,
    };
  }

  syncTileElements() {
    const activeTileIds = new Set(this.tiles.keys());

    this.tileEls.forEach((tileEl, tileId) => {
      if (!activeTileIds.has(tileId)) {
        tileEl.remove();
        this.tileEls.delete(tileId);
      }
    });

    this.tiles.forEach((tile) => {
      let tileEl = this.tileEls.get(tile.id);
      let contentEl;

      if (!tileEl) {
        tileEl = document.createElement("div");
        tileEl.className = "tile";
        contentEl = document.createElement("div");
        contentEl.className = "tile__content";
        tileEl.appendChild(contentEl);
        this.tileLayerEl.appendChild(tileEl);
        this.tileEls.set(tile.id, tileEl);
      } else {
        contentEl = tileEl.firstElementChild;
      }

      tileEl.className = "tile";
      tileEl.dataset.value = String(tile.value);
      const { x, y, width, height } = this.getTileMetrics(tile.row, tile.col);
      tileEl.style.setProperty("--tile-x", `${x}px`);
      tileEl.style.setProperty("--tile-y", `${y}px`);
      tileEl.style.width = `${width}px`;
      tileEl.style.height = `${height}px`;
      tileEl.setAttribute("aria-label", `Tile ${formatter.format(tile.value)}`);

      if (tile.value > 2048) {
        tileEl.classList.add("super");
      }

      if (tile.isNew) {
        tileEl.classList.add("tile--new");
      }

      if (tile.isMerged) {
        tileEl.classList.add("tile--merge");
      }

      if (tile.isRemoving) {
        tileEl.classList.add("tile--removing");
      }

      contentEl.textContent = String(tile.value);
      tile.isNew = false;
      tile.isMerged = false;
    });
  }

  canMove() {
    return this.canMoveOnGrid(this.grid);
  }

  render(options = {}) {
    const { bumpScore = false } = options;

    this.scoreEl.textContent = formatter.format(this.score);
    this.bestScoreEl.textContent = formatter.format(this.bestScore);

    this.updateScoreCardAnimation(bumpScore);
    this.syncTileElements();
    this.updateOverlay();
  }

  updateCells() {
    // Tiles are rendered in the floating tile layer so the background cells stay static.
  }

  updateScoreCardAnimation(bumpScore) {
    const scoreCard = this.scoreEl.closest(".score-card");
    const bestScoreCard = this.bestScoreEl.closest(".score-card");

    if (!scoreCard || !bestScoreCard) {
      return;
    }

    scoreCard.classList.remove("bump");
    bestScoreCard.classList.remove("bump");

    if (!bumpScore) {
      return;
    }

    void scoreCard.offsetWidth;
    scoreCard.classList.add("bump");

    if (this.score === this.bestScore && this.bestScore > 0) {
      void bestScoreCard.offsetWidth;
      bestScoreCard.classList.add("bump");
    }
  }

  updateOverlay() {
    if (this.over) {
      this.overlayEl.classList.remove("hidden");
      this.overlayTagEl.textContent = "Run Complete";
      this.overlayTitleEl.textContent = "No moves left";
      this.overlayTextEl.textContent =
        "Start a new board and see if you can set a new personal best.";
      this.overlayPrimaryButton.textContent = "Play again";
      this.overlaySecondaryButton.hidden = true;
      this.overlayAction = "restart";
      return;
    }

    if (this.won && !this.keepPlaying) {
      this.overlayEl.classList.remove("hidden");
      this.overlayTagEl.textContent = "Milestone";
      this.overlayTitleEl.textContent = "2048 reached";
      this.overlayTextEl.textContent =
        "You hit the target tile. Keep going for a bigger score or reset for a cleaner run.";
      this.overlayPrimaryButton.textContent = "Keep going";
      this.overlaySecondaryButton.hidden = false;
      this.overlayAction = "continue";
      return;
    }

    this.overlayEl.classList.add("hidden");
  }
}

const game = new Game2048({
  boardShell: document.getElementById("board-shell"),
  grid: document.getElementById("grid"),
  tileLayer: document.getElementById("tile-layer"),
  score: document.getElementById("score"),
  bestScore: document.getElementById("best-score"),
  newGame: document.getElementById("new-game"),
  overlay: document.getElementById("overlay"),
  overlayTag: document.getElementById("overlay-tag"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayText: document.getElementById("overlay-text"),
  overlayPrimary: document.getElementById("overlay-primary"),
  overlaySecondary: document.getElementById("overlay-secondary"),
});

window.game2048 = game;
