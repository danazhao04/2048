const GRID_SIZE = 4;
const BEST_SCORE_KEY = "codex-2048-best-score";
const PLAYER_NAME_KEY = "codex-2048-player-name";
const LEADERBOARD_MAX_ENTRIES = 10;
const SUPABASE_URL = "https://ocqqxvnubumnmvxrdzra.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_7SkVS64svHmJ3LzRydPpCg_VKVNGXLP";
const SUPABASE_TABLE = "leaderboard_scores";
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
    this.playerNameInput = elements.playerName;
    this.submitScoreButton = elements.submitScore;
    this.leaderboardListEl = elements.leaderboardList;
    this.leaderboardStatusEl = elements.leaderboardStatus;

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
    this.scoreSubmitted = false;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleOverlayPrimary = this.handleOverlayPrimary.bind(this);
    this.handleMenuToggle = this.handleMenuToggle.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleDocumentKeyDown = this.handleDocumentKeyDown.bind(this);
    this.handleLeaderboardSubmit = this.handleLeaderboardSubmit.bind(this);
    this.handlePlayerNameKeyDown = this.handlePlayerNameKeyDown.bind(this);

    this.createCells();
    this.bindEvents();
    this.initializeLeaderboard();
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
    this.submitScoreButton?.addEventListener("click", this.handleLeaderboardSubmit);
    this.playerNameInput?.addEventListener("keydown", this.handlePlayerNameKeyDown);
    this.playerNameInput?.addEventListener("change", () => {
      const normalizedName = this.normalizePlayerName(this.playerNameInput.value);
      this.playerNameInput.value = normalizedName;
      this.savePlayerName(normalizedName);
    });

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
    this.scoreSubmitted = false;

    this.addRandomTile();
    this.addRandomTile();

    this.updateSubmitButtonState();
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

  initializeLeaderboard() {
    if (!this.leaderboardListEl || !this.leaderboardStatusEl) {
      return;
    }

    const savedName = this.loadPlayerName();
    if (this.playerNameInput && savedName) {
      this.playerNameInput.value = savedName;
    }

    this.renderLeaderboard([]);
    this.setLeaderboardStatus("Loading leaderboard...");
    void this.fetchLeaderboard();
  }

  loadPlayerName() {
    try {
      return this.normalizePlayerName(localStorage.getItem(PLAYER_NAME_KEY) || "");
    } catch (error) {
      return "";
    }
  }

  savePlayerName(name) {
    try {
      const normalizedName = this.normalizePlayerName(name);
      if (normalizedName) {
        localStorage.setItem(PLAYER_NAME_KEY, normalizedName);
      } else {
        localStorage.removeItem(PLAYER_NAME_KEY);
      }
    } catch (error) {
      // Ignore storage errors so gameplay stays uninterrupted.
    }
  }

  normalizePlayerName(name) {
    const normalized = String(name || "").replace(/\s+/g, " ").trim();
    return normalized.slice(0, 20);
  }

  getPlayerName() {
    if (!this.playerNameInput) {
      return "";
    }

    const normalizedName = this.normalizePlayerName(this.playerNameInput.value);
    this.playerNameInput.value = normalizedName;
    return normalizedName;
  }

  handleLeaderboardSubmit() {
    void this.submitScore({ manual: true });
  }

  handlePlayerNameKeyDown(event) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    this.handleLeaderboardSubmit();
  }

  setLeaderboardStatus(message, tone = "info") {
    if (!this.leaderboardStatusEl) {
      return;
    }

    this.leaderboardStatusEl.textContent = message;
    this.leaderboardStatusEl.className = `leaderboard-status ${
      tone === "success" || tone === "error" ? tone : ""
    }`.trim();
  }

  renderLeaderboard(entries) {
    if (!this.leaderboardListEl) {
      return;
    }

    this.leaderboardListEl.replaceChildren();

    if (!Array.isArray(entries) || entries.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "leaderboard-empty";
      emptyItem.textContent = "No global scores yet. Be first.";
      this.leaderboardListEl.appendChild(emptyItem);
      return;
    }

    entries.slice(0, LEADERBOARD_MAX_ENTRIES).forEach((entry, index) => {
      const row = document.createElement("li");
      row.className = "leaderboard-entry";

      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = `#${index + 1}`;

      const name = document.createElement("span");
      name.className = "leaderboard-name";
      name.textContent = this.normalizePlayerName(entry.name) || "Anonymous";

      const score = document.createElement("span");
      score.className = "leaderboard-score";
      score.textContent = formatter.format(Number(entry.score) || 0);

      row.append(rank, name, score);
      this.leaderboardListEl.appendChild(row);
    });
  }

  getSupabaseHeaders() {
    return {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    };
  }

  buildSupabaseLeaderboardUrl(limit = LEADERBOARD_MAX_ENTRIES) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`);
    url.searchParams.set("select", "name,score,created_at");
    url.searchParams.set("order", "score.desc,created_at.asc");
    url.searchParams.set("limit", String(limit));
    return url.toString();
  }

  async fetchLeaderboardEntries(limit = LEADERBOARD_MAX_ENTRIES) {
    const response = await fetch(this.buildSupabaseLeaderboardUrl(limit), {
      headers: this.getSupabaseHeaders(),
    });

    if (!response.ok) {
      throw new Error(`leaderboard_fetch_${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  }

  async fetchLeaderboard() {
    try {
      const entries = await this.fetchLeaderboardEntries();
      this.renderLeaderboard(entries);

      if (entries.length > 0) {
        this.setLeaderboardStatus("Live leaderboard");
      } else {
        this.setLeaderboardStatus("No global scores yet. Be first.");
      }
    } catch (error) {
      this.renderLeaderboard([]);
      if (window.location.protocol === "file:") {
        this.setLeaderboardStatus(
          "Host the site (GitHub Pages) to enable global leaderboard.",
          "error"
        );
        return;
      }

      this.setLeaderboardStatus("Leaderboard API not connected yet.", "error");
    }
  }

  updateSubmitButtonState() {
    if (!this.submitScoreButton) {
      return;
    }

    this.submitScoreButton.disabled = !this.over || this.score <= 0 || this.scoreSubmitted;
  }

  maybeAutoSubmitOnGameOver() {
    if (this.score <= 0 || this.scoreSubmitted) {
      return;
    }

    const playerName = this.getPlayerName();
    if (!playerName) {
      this.setLeaderboardStatus(
        "Add your name, then tap Submit Score to post globally."
      );
      return;
    }

    void this.submitScore({ manual: false });
  }

  async submitScore({ manual = false } = {}) {
    if (!this.submitScoreButton) {
      return;
    }

    if (!this.over) {
      if (manual) {
        this.setLeaderboardStatus("Finish your run first, then submit.", "error");
      }
      return;
    }

    if (this.scoreSubmitted) {
      if (manual) {
        this.setLeaderboardStatus("Score already submitted for this run.");
      }
      return;
    }

    const playerName = this.getPlayerName();
    if (!playerName) {
      this.setLeaderboardStatus("Enter your name first.", "error");
      this.playerNameInput?.focus();
      return;
    }

    this.savePlayerName(playerName);

    if (this.score <= 0) {
      this.setLeaderboardStatus("Play one round first, then submit.", "error");
      return;
    }

    this.submitScoreButton.disabled = true;
    this.setLeaderboardStatus("Submitting score...");

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
        method: "POST",
        headers: {
          ...this.getSupabaseHeaders(),
          "content-type": "application/json",
          prefer: "return=minimal",
        },
        body: JSON.stringify([{ name: playerName, score: this.score }]),
      });

      if (!response.ok) {
        throw new Error(`submit_failed_${response.status}`);
      }

      const entries = await this.fetchLeaderboardEntries();
      this.renderLeaderboard(entries);
      this.scoreSubmitted = true;
      this.setLeaderboardStatus(
        `Saved ${formatter.format(this.score)} for ${playerName}.`,
        "success"
      );
    } catch (error) {
      if (window.location.protocol === "file:") {
        this.setLeaderboardStatus(
          "Host the site (GitHub Pages) to enable global leaderboard.",
          "error"
        );
      } else {
        this.setLeaderboardStatus("Could not submit score right now.", "error");
      }
    } finally {
      this.updateSubmitButtonState();
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
        this.maybeAutoSubmitOnGameOver();
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
        this.maybeAutoSubmitOnGameOver();
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
      this.maybeAutoSubmitOnGameOver();
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
    this.updateSubmitButtonState();
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
        "Start a new board and see if you can set a new personal best.\nGood riddance!";
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
  playerName: document.getElementById("player-name"),
  submitScore: document.getElementById("submit-score"),
  leaderboardList: document.getElementById("leaderboard-list"),
  leaderboardStatus: document.getElementById("leaderboard-status"),
});

window.game2048 = game;
