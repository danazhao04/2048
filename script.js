const GRID_SIZE = 4;
const BEST_SCORE_KEY = "codex-2048-best-score";
const formatter = new Intl.NumberFormat();

class Game2048 {
  constructor(elements) {
    this.gridEl = elements.grid;
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
    this.menuWrapEl = elements.menuWrap;
    this.menuToggleButton = elements.menuToggle;
    this.menuPanelEl = elements.menuPanel;

    this.grid = [];
    this.score = 0;
    this.bestScore = this.loadBestScore();
    this.over = false;
    this.won = false;
    this.keepPlaying = false;
    this.touchStart = null;
    this.cellEls = [];
    this.spawnedCellIndex = null;
    this.overlayAction = "restart";

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleOverlayPrimary = this.handleOverlayPrimary.bind(this);
    this.handleMenuToggle = this.handleMenuToggle.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleDocumentKeyDown = this.handleDocumentKeyDown.bind(this);

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
      this.cellEls.push(cell);
    }

    this.gridEl.appendChild(fragment);
  }

  bindEvents() {
    window.addEventListener("keydown", this.handleKeyDown);
    this.boardShellEl.addEventListener("pointerdown", this.handlePointerDown);
    this.boardShellEl.addEventListener("pointerup", this.handlePointerUp);
    this.newGameButton.addEventListener("click", () => this.start());
    this.overlayPrimaryButton.addEventListener("click", this.handleOverlayPrimary);
    this.overlaySecondaryButton.addEventListener("click", () => this.start());

    if (this.menuToggleButton) {
      this.menuToggleButton.addEventListener("click", this.handleMenuToggle);
      document.addEventListener("click", this.handleDocumentClick);
      document.addEventListener("keydown", this.handleDocumentKeyDown);
    }
  }

  start() {
    this.closeMenu();
    this.grid = this.createEmptyGrid();
    this.score = 0;
    this.over = false;
    this.won = false;
    this.keepPlaying = false;
    this.spawnedCellIndex = null;

    this.addRandomTile();
    this.addRandomTile();

    this.render({
      bumpScore: true,
    });
  }

  createEmptyGrid() {
    return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
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

  openMenu() {
    if (!this.menuWrapEl || !this.menuPanelEl || !this.menuToggleButton) {
      return;
    }

    this.menuWrapEl.classList.add("open");
    document.body.classList.add("menu-open");
    this.menuToggleButton.setAttribute("aria-expanded", "true");
  }

  closeMenu() {
    if (!this.menuWrapEl || !this.menuPanelEl || !this.menuToggleButton) {
      return;
    }

    this.menuWrapEl.classList.remove("open");
    document.body.classList.remove("menu-open");
    this.menuToggleButton.setAttribute("aria-expanded", "false");
  }

  handleMenuToggle(event) {
    event.stopPropagation();

    if (!this.menuPanelEl) {
      return;
    }

    if (!this.menuWrapEl.classList.contains("open")) {
      this.openMenu();
      return;
    }

    this.closeMenu();
  }

  handleDocumentClick(event) {
    if (!this.menuWrapEl || this.menuWrapEl.contains(event.target)) {
      return;
    }

    this.closeMenu();
  }

  handleDocumentKeyDown(event) {
    if (event.key !== "Escape") {
      return;
    }

    this.closeMenu();
  }

  handleKeyDown(event) {
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
    this.touchStart = { x: event.clientX, y: event.clientY };
  }

  handlePointerUp(event) {
    if (!this.touchStart) {
      return;
    }

    const dx = event.clientX - this.touchStart.x;
    const dy = event.clientY - this.touchStart.y;
    this.touchStart = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) {
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

  move(direction) {
    if (this.over || (this.won && !this.keepPlaying)) {
      return;
    }

    const { grid, moved, scoreGained } = this.computeMove(direction);

    if (!moved) {
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

    const changedCells = this.getChangedCellIndices(this.grid, grid);
    this.grid = grid;
    this.score += scoreGained;

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.saveBestScore();
    }

    this.addRandomTile();

    if (!this.won && this.hasValue(2048)) {
      this.won = true;
      this.render({
        bumpScore: true,
        changedCells,
        direction,
      });
      return;
    }

    if (!this.canMove()) {
      this.over = true;
      this.render({
        bumpScore: true,
        changedCells,
        direction,
      });
      return;
    }

    this.render({
      bumpScore: scoreGained > 0,
      changedCells,
      direction,
    });
  }

  computeMove(direction) {
    const nextGrid = this.grid.map((row) => [...row]);
    let moved = false;
    let scoreGained = 0;

    if (direction === "left" || direction === "right") {
      for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
        const originalRow = [...nextGrid[rowIndex]];
        const workingRow =
          direction === "right" ? [...originalRow].reverse() : [...originalRow];
        const result = this.slideLine(workingRow);
        const finalRow =
          direction === "right" ? [...result.line].reverse() : result.line;

        if (!moved && !this.sameLine(originalRow, finalRow)) {
          moved = true;
        }

        nextGrid[rowIndex] = finalRow;
        scoreGained += result.scoreGained;
      }
    } else {
      for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
        const originalColumn = nextGrid.map((row) => row[colIndex]);
        const workingColumn =
          direction === "down"
            ? [...originalColumn].reverse()
            : [...originalColumn];
        const result = this.slideLine(workingColumn);
        const finalColumn =
          direction === "down" ? [...result.line].reverse() : result.line;

        if (!moved && !this.sameLine(originalColumn, finalColumn)) {
          moved = true;
        }

        for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
          nextGrid[rowIndex][colIndex] = finalColumn[rowIndex];
        }

        scoreGained += result.scoreGained;
      }
    }

    return { grid: nextGrid, moved, scoreGained };
  }

  slideLine(line) {
    const compacted = line.filter(Boolean);
    const merged = [];
    let scoreGained = 0;

    for (let index = 0; index < compacted.length; index += 1) {
      const current = compacted[index];
      const next = compacted[index + 1];

      if (current === next) {
        const mergedValue = current * 2;
        merged.push(mergedValue);
        scoreGained += mergedValue;
        index += 1;
      } else {
        merged.push(current);
      }
    }

    while (merged.length < GRID_SIZE) {
      merged.push(0);
    }

    return { line: merged, scoreGained };
  }

  sameLine(first, second) {
    return first.every((value, index) => value === second[index]);
  }

  addRandomTile() {
    const emptyCells = [];

    for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
      for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
        if (this.grid[rowIndex][colIndex] === 0) {
          emptyCells.push({ rowIndex, colIndex });
        }
      }
    }

    if (emptyCells.length === 0) {
      this.spawnedCellIndex = null;
      return;
    }

    const choice = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const value = Math.random() < 0.9 ? 2 : 4;

    this.grid[choice.rowIndex][choice.colIndex] = value;
    this.spawnedCellIndex = choice.rowIndex * GRID_SIZE + choice.colIndex;
  }

  hasValue(targetValue) {
    return this.grid.some((row) => row.includes(targetValue));
  }

  canMove() {
    for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
      for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
        const value = this.grid[rowIndex][colIndex];

        if (value === 0) {
          return true;
        }

        if (rowIndex < GRID_SIZE - 1 && value === this.grid[rowIndex + 1][colIndex]) {
          return true;
        }

        if (colIndex < GRID_SIZE - 1 && value === this.grid[rowIndex][colIndex + 1]) {
          return true;
        }
      }
    }

    return false;
  }

  getChangedCellIndices(previousGrid, nextGrid) {
    const changedIndices = new Set();

    for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
      for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
        if (previousGrid[rowIndex][colIndex] !== nextGrid[rowIndex][colIndex]) {
          changedIndices.add(rowIndex * GRID_SIZE + colIndex);
        }
      }
    }

    return changedIndices;
  }

  render(options = {}) {
    const { bumpScore = false, changedCells = new Set(), direction = null } = options;

    this.scoreEl.textContent = formatter.format(this.score);
    this.bestScoreEl.textContent = formatter.format(this.bestScore);

    this.updateScoreCardAnimation(bumpScore);
    this.updateCells(changedCells, direction);
    this.updateOverlay();
  }

  updateCells(changedCells = new Set(), direction = null) {
    for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
      for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
        const index = rowIndex * GRID_SIZE + colIndex;
        const cellEl = this.cellEls[index];
        const value = this.grid[rowIndex][colIndex];

        cellEl.className = "cell";
        cellEl.textContent = value === 0 ? "" : String(value);
        cellEl.dataset.value = value === 0 ? "" : String(value);
        cellEl.setAttribute(
          "aria-label",
          value === 0 ? "Empty tile" : `Tile ${formatter.format(value)}`
        );

        if (value > 0) {
          cellEl.classList.add("filled");
        }

        if (index === this.spawnedCellIndex) {
          cellEl.classList.add("spawn");
        }

        if (changedCells.has(index) && direction) {
          cellEl.classList.add(`move-${direction}`);
        }

        if (value > 2048) {
          cellEl.classList.add("super");
        }
      }
    }

    this.spawnedCellIndex = null;
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
  score: document.getElementById("score"),
  bestScore: document.getElementById("best-score"),
  newGame: document.getElementById("new-game"),
  overlay: document.getElementById("overlay"),
  overlayTag: document.getElementById("overlay-tag"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayText: document.getElementById("overlay-text"),
  overlayPrimary: document.getElementById("overlay-primary"),
  overlaySecondary: document.getElementById("overlay-secondary"),
  menuWrap: document.querySelector(".menu-wrap"),
  menuToggle: document.getElementById("menu-toggle"),
  menuPanel: document.getElementById("menu-panel"),
});

window.game2048 = game;
