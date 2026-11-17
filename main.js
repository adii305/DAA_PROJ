const ROWS = 25;
const COLS = 25;
const START = { row: 1, col: 1 };
const FINISH = { row: 23, col: 23 };
const DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const gridElement = document.getElementById("maze-grid");
const noticeElement = document.getElementById("notice");
const wallCountElement = document.getElementById("metric-walls");
const visitedCountElement = document.getElementById("metric-visited");
const pathCountElement = document.getElementById("metric-path");
const algorithmMetric = document.getElementById("metric-algorithm");
const canvasMode = document.getElementById("canvas-mode");

const algorithmSelect = document.getElementById("algorithm");
const descriptionElement = document.getElementById("algorithm-description");
const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");

const startButton = document.getElementById("start-search");
const stepButton = document.getElementById("step-search");
const pauseButton = document.getElementById("pause-search");
const resetSearchButton = document.getElementById("reset-search");
const generateButton = document.getElementById("generate-maze");
const randomButton = document.getElementById("random-obstacles");
const clearButton = document.getElementById("clear-walls");
const resetGridButton = document.getElementById("reset-grid");

let walls = new Set();
let isPointerDown = false;
let currentPaintMode = "add";
let searchSteps = [];
let currentStep = 0;
let animationTimer = null;
let searchFinished = false;
let visitedTotal = 0;
let finalPathLength = 0;

function cellKey(row, col) {
  return `${row},${col}`;
}

function isSpecialCell(row, col) {
  return (row === START.row && col === START.col) ||
         (row === FINISH.row && col === FINISH.col);
}

function getCell(row, col) {
  return gridElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function setNotice(message) {
  noticeElement.textContent = message;
}

function updateMetrics() {
  wallCountElement.textContent = walls.size;
  visitedCountElement.textContent = visitedTotal;
  pathCountElement.textContent = finalPathLength;
  algorithmMetric.textContent = algorithmSelect.value.toUpperCase();
}

function clearSearchState() {
  pauseAnimation();
  searchSteps = [];
  currentStep = 0;
  searchFinished = false;
  visitedTotal = 0;
  finalPathLength = 0;
  gridElement.querySelectorAll(".visited, .path").forEach(cell => {
    cell.classList.remove("visited", "path");
  });
  startButton.disabled = false;
  stepButton.disabled = false;
  canvasMode.textContent = "READY";
  updateMetrics();
}

function renderGrid() {
  gridElement.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute("role", "gridcell");

      if (row === START.row && col === START.col) {
        cell.classList.add("start");
        cell.setAttribute("aria-label", "Start");
      } else if (row === FINISH.row && col === FINISH.col) {
        cell.classList.add("finish");
        cell.setAttribute("aria-label", "Finish");
      } else if (walls.has(cellKey(row, col))) {
        cell.classList.add("wall");
        cell.setAttribute("aria-label", "Wall");
      } else {
        cell.setAttribute("aria-label", "Open cell");
      }
      fragment.appendChild(cell);
    }
  }

  gridElement.appendChild(fragment);
  updateMetrics();
}

function paintCell(cell, mode = currentPaintMode) {
  if (!cell) return;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  if (isSpecialCell(row, col)) return;

  const key = cellKey(row, col);
  if (mode === "add") walls.add(key);
  else walls.delete(key);

  clearSearchState();
  cell.classList.toggle("wall", walls.has(key));
  cell.classList.remove("visited", "path");
  cell.setAttribute("aria-label", walls.has(key) ? "Wall" : "Open cell");
  updateMetrics();
  canvasMode.textContent = "EDITING";
}

function getNeighbours(row, col) {
  const neighbours = [];
  for (const [dr, dc] of DIRECTIONS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
    if (walls.has(cellKey(nr, nc))) continue;
    neighbours.push({ row: nr, col: nc });
  }
  return neighbours;
}

function buildSearchSteps(type) {
  const startKey = cellKey(START.row, START.col);
  const finishKey = cellKey(FINISH.row, FINISH.col);
  const visited = new Set([startKey]);
  const parent = new Map();
  const steps = [];

  if (type === "bfs") {
    const queue = [{ ...START }];
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++];
      const key = cellKey(current.row, current.col);
      steps.push({ type: "visit", key });

      if (key === finishKey) break;

      for (const next of getNeighbours(current.row, current.col)) {
        const nextKey = cellKey(next.row, next.col);
        if (visited.has(nextKey)) continue;
        visited.add(nextKey);
        parent.set(nextKey, key);
        queue.push(next);
      }
    }
  } else {
    const stack = [{ ...START }];
    const discovered = new Set([startKey]);
    while (stack.length > 0) {
      const current = stack.pop();
      const key = cellKey(current.row, current.col);
      visited.add(key);
      steps.push({ type: "visit", key });

      if (key === finishKey) break;

      const neighbours = getNeighbours(current.row, current.col);
      // Mark cells when pushed so each cell gets only one parent.
      for (let i = neighbours.length - 1; i >= 0; i--) {
        const next = neighbours[i];
        const nextKey = cellKey(next.row, next.col);
        if (discovered.has(nextKey)) continue;
        discovered.add(nextKey);
        parent.set(nextKey, key);
        stack.push(next);
      }
    }
  }

  if (visited.has(finishKey)) {
    const path = [];
    let current = finishKey;
    while (current) {
      path.push(current);
      if (current === startKey) break;
      current = parent.get(current);
    }
    if (path[path.length - 1] === startKey) {
      path.reverse();
      for (const key of path) steps.push({ type: "path", key });
    }
  }

  return { steps, found: visited.has(finishKey) };
}

function prepareSearch() {
  clearSearchState();
  const type = algorithmSelect.value;
  const result = buildSearchSteps(type);
  searchSteps = result.steps;
  algorithmMetric.textContent = type.toUpperCase();
  canvasMode.textContent = "SEARCH READY";
  setNotice(`${type.toUpperCase()} ready. Press Start visualisation or Step to begin.`);
  if (!result.found) {
    setNotice(`${type.toUpperCase()} could not reach the finish. Try clearing or changing some walls.`);
  }
  return result.found;
}

function applyNextStep() {
  if (currentStep >= searchSteps.length) {
    finishSearch();
    return false;
  }

  const step = searchSteps[currentStep++];
  const [row, col] = step.key.split(",").map(Number);
  const cell = getCell(row, col);

  if (step.type === "visit") {
    if (!cell.classList.contains("start") && !cell.classList.contains("finish")) {
      cell.classList.add("visited");
    }
    visitedTotal++;
  } else if (step.type === "path") {
    if (!cell.classList.contains("start") && !cell.classList.contains("finish")) {
      cell.classList.remove("visited");
      cell.classList.add("path");
    }
    finalPathLength++;
  }

  updateMetrics();

  if (currentStep >= searchSteps.length) finishSearch();
  return true;
}

function finishSearch() {
  pauseAnimation();
  searchFinished = true;
  startButton.disabled = true;
  stepButton.disabled = true;
  canvasMode.textContent = "COMPLETE";
  const hasPath = searchSteps.some(step => step.type === "path");
  if (hasPath) {
    setNotice(`Search complete! ${algorithmSelect.value.toUpperCase()} explored ${visitedTotal} cells. Path length: ${finalPathLength} cells.`);
  } else {
    setNotice(`Search complete. No route to the finish was found. Explored ${visitedTotal} cells.`);
  }
}

function pauseAnimation() {
  if (animationTimer !== null) {
    clearInterval(animationTimer);
    animationTimer = null;
  }
}

function getAnimationDelay() {
  const speed = Number(speedInput.value);
  return [900, 550, 300, 140, 45][speed - 1];
}

function playAnimation() {
  if (searchSteps.length === 0 || searchFinished) prepareSearch();
  if (searchSteps.length === 0 || searchFinished) return;
  pauseAnimation();
  canvasMode.textContent = "RUNNING";
  setNotice(`${algorithmSelect.value.toUpperCase()} is exploring the maze...`);
  animationTimer = setInterval(() => {
    if (!applyNextStep()) pauseAnimation();
  }, getAnimationDelay());
}

function generatePerfectMaze() {
  clearSearchState();
  walls = new Set();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) walls.add(cellKey(row, col));
  }

  const stack = [{ row: 1, col: 1 }];
  walls.delete(cellKey(1, 1));
  const visited = new Set([cellKey(1, 1)]);
  const directions = [[-2, 0], [2, 0], [0, -2], [0, 2]];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const options = directions
      .map(([dr, dc]) => ({ row: current.row + dr, col: current.col + dc, dr, dc }))
      .filter(next =>
        next.row > 0 && next.row < ROWS - 1 &&
        next.col > 0 && next.col < COLS - 1 &&
        !visited.has(cellKey(next.row, next.col))
      );

    if (options.length === 0) {
      stack.pop();
      continue;
    }

    const next = options[Math.floor(Math.random() * options.length)];
    walls.delete(cellKey(current.row + next.dr / 2, current.col + next.dc / 2));
    walls.delete(cellKey(next.row, next.col));
    visited.add(cellKey(next.row, next.col));
    stack.push({ row: next.row, col: next.col });
  }

  // The finish is one of the maze's carved odd-coordinate cells, so it is connected.
  renderGrid();
  canvasMode.textContent = "EDITABLE";
  setNotice("Perfect maze generated. Choose BFS or DFS to explore it.");
}

function generateRandomObstacles() {
  clearSearchState();
  walls = new Set();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (Math.random() < 0.28 && !isSpecialCell(row, col)) {
        walls.add(cellKey(row, col));
      }
    }
  }
  renderGrid();
  canvasMode.textContent = "EDITABLE";
  setNotice("Random obstacles generated. A route may or may not exist.");
}

gridElement.addEventListener("pointerdown", event => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  event.preventDefault();
  isPointerDown = true;
  currentPaintMode = walls.has(cellKey(cell.dataset.row, cell.dataset.col)) ? "erase" : "add";
  paintCell(cell, currentPaintMode);
});

gridElement.addEventListener("pointerover", event => {
  if (!isPointerDown) return;
  const cell = event.target.closest(".cell");
  if (cell) paintCell(cell, currentPaintMode);
});

window.addEventListener("pointerup", () => { isPointerDown = false; });

gridElement.addEventListener("contextmenu", event => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  event.preventDefault();
  paintCell(cell, "erase");
});

startButton.addEventListener("click", () => {
  if (searchSteps.length === 0 || searchFinished) prepareSearch();
  if (!searchFinished) playAnimation();
});

stepButton.addEventListener("click", () => {
  if (searchSteps.length === 0 || searchFinished) prepareSearch();
  if (searchSteps.length > 0 && !searchFinished) {
    pauseAnimation();
    canvasMode.textContent = "STEP MODE";
    applyNextStep();
  }
});

pauseButton.addEventListener("click", () => {
  pauseAnimation();
  if (!searchFinished) {
    canvasMode.textContent = "PAUSED";
    setNotice("Animation paused. Press Start to continue or Step to advance once.");
  }
});

resetSearchButton.addEventListener("click", () => {
  clearSearchState();
  setNotice("Visualisation reset. Your walls and maze are unchanged.");
});

algorithmSelect.addEventListener("change", () => {
  clearSearchState();
  const isBfs = algorithmSelect.value === "bfs";
  descriptionElement.textContent = isBfs
    ? "BFS explores nearby cells first and finds a shortest path in an unweighted maze."
    : "DFS follows one route deeply before backtracking. It can find a path, but not necessarily the shortest one.";
  updateMetrics();
  setNotice(`${algorithmSelect.value.toUpperCase()} selected. Start the visualisation when ready.`);
});

speedInput.addEventListener("input", () => {
  speedValue.textContent = ["Slowest", "Slow", "Medium", "Fast", "Fastest"][Number(speedInput.value) - 1];
  if (animationTimer !== null) playAnimation();
});

generateButton.addEventListener("click", generatePerfectMaze);
randomButton.addEventListener("click", generateRandomObstacles);

clearButton.addEventListener("click", () => {
  clearSearchState();
  walls.clear();
  renderGrid();
  canvasMode.textContent = "EDITABLE";
  setNotice("All walls cleared. The grid is open.");
});

resetGridButton.addEventListener("click", () => {
  clearSearchState();
  walls.clear();
  renderGrid();
  canvasMode.textContent = "READY";
  setNotice("Grid reset. Start and finish are back in their original positions.");
});

renderGrid();
speedValue.textContent = "Medium";
updateMetrics();
