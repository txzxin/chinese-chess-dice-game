const boardEl = document.querySelector("#board");
const diceValueEl = document.querySelector("#diceValue");
const diceFaceEl = document.querySelector("#diceFace");
const hpValueEl = document.querySelector("#hpValue");
const bossValueEl = document.querySelector("#bossValue");
const routeValueEl = document.querySelector("#routeValue");
const rollButton = document.querySelector("#rollButton");
const restartButton = document.querySelector("#restartButton");
const autoRollEl = document.querySelector("#autoRoll");
const messageEl = document.querySelector("#message");
const logListEl = document.querySelector("#logList");
const shellEl = document.querySelector(".game-shell");

const COLS = 9;
const ROWS = 10;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const initialPieces = [
  ["bA1", "black", "士", 3, 0, "guard"],
  ["bA2", "black", "士", 5, 0, "guard"],
  ["bS1", "black", "卒", 3, 1, "soldier"],
  ["bS2", "black", "卒", 5, 1, "soldier"],
  ["bS3", "black", "卒", 3, 2, "soldier"],
  ["bS4", "black", "卒", 5, 2, "soldier"],
  ["bE1", "black", "象", 1, 3, "elephant"],
  ["bC1", "black", "炮", 2, 3, "cannon"],
  ["bR1", "black", "車", 3, 3, "rook"],
  ["boss", "black", "将", 4, 3, "boss"],
  ["bR2", "black", "車", 5, 3, "rook"],
  ["bC2", "black", "炮", 6, 3, "cannon"],
  ["bE2", "black", "象", 7, 3, "elephant"],
  ["bH1", "black", "馬", 1, 4, "horse"],
  ["bS5", "black", "卒", 4, 4, "soldier"],
  ["bH2", "black", "馬", 7, 4, "horse"],
  ["rS1", "red", "兵", 3, 6, "health"],
  ["rS2", "red", "兵", 4, 6, "health"],
  ["rS3", "red", "兵", 5, 6, "health"],
  ["rH1", "red", "傌", 1, 7, "horse"],
  ["rS4", "red", "兵", 3, 7, "health"],
  ["rA1", "red", "仕", 4, 7, "health"],
  ["rS5", "red", "兵", 5, 7, "health"],
  ["rH2", "red", "傌", 7, 7, "horse"],
  ["rE1", "red", "相", 1, 8, "elephant"],
  ["rC1", "red", "炮", 3, 8, "cannon"],
  ["rA2", "red", "仕", 4, 8, "health"],
  ["rC2", "red", "炮", 5, 8, "cannon"],
  ["rE2", "red", "相", 7, 8, "elephant"],
  ["rR1", "red", "俥", 0, 9, "rook"],
  ["player", "red", "帅", 4, 9, "player"],
  ["rR2", "red", "俥", 8, 9, "rook"],
];

let state;
let elements = new Map();
let autoTimer = null;

function createState() {
  return {
    pieces: initialPieces.map(([id, side, label, col, row, type]) => ({
      id,
      side,
      label,
      col,
      row,
      type,
      alive: true,
    })),
    player: { col: 4, row: 9 },
    horizontalDir: 1,
    ride: null,
    moving: false,
    gameOver: false,
    hp: 7,
    maxHp: 7,
    bossEscapes: 0,
    dice: null,
    log: [],
  };
}

function gridToPos(col, row) {
  return {
    left: `${(col / (COLS - 1)) * 100}%`,
    top: `${(row / (ROWS - 1)) * 100}%`,
  };
}

function renderBoard() {
  boardEl.innerHTML = '<div class="river"><span>楚河</span><span>汉界</span></div>';
  elements = new Map();

  for (const piece of state.pieces) {
    const el = document.createElement("div");
    const pos = gridToPos(piece.col, piece.row);
    el.className = [
      "square",
      `piece-${piece.side}`,
      piece.type === "player" ? "piece-player" : "",
      piece.type === "health" ? "piece-health" : "",
      piece.alive ? "" : "piece-gone",
    ]
      .filter(Boolean)
      .join(" ");
    el.textContent = piece.label;
    el.style.left = pos.left;
    el.style.top = pos.top;
    boardEl.append(el);
    elements.set(piece.id, el);
  }
}

function syncPieces() {
  for (const piece of state.pieces) {
    const el = elements.get(piece.id);
    const pos = gridToPos(piece.col, piece.row);
    el.style.left = pos.left;
    el.style.top = pos.top;
    el.classList.toggle("piece-gone", !piece.alive);
    el.classList.toggle("piece-health", piece.type === "health" && piece.alive);
  }
}

function setMessage(text) {
  messageEl.textContent = text;
}

function addLog(text) {
  state.log.unshift(text);
  state.log = state.log.slice(0, 10);
  logListEl.innerHTML = state.log.map((item) => `<li>${item}</li>`).join("");
}

function updateStatus() {
  diceValueEl.textContent = state.dice ?? "-";
  diceFaceEl.textContent = state.dice ?? "?";
  hpValueEl.textContent = `${state.hp}/${state.maxHp}`;
  const boss = state.pieces.find((piece) => piece.id === "boss");
  bossValueEl.textContent = boss.row === 0 ? "顶部" : `${3 - boss.row}/3`;
  routeValueEl.textContent = state.ride ? `${state.ride.side === 0 ? "左" : "右"}车道` : "底线";
  rollButton.disabled = state.moving || state.gameOver;
  shellEl.classList.toggle("game-over", state.gameOver);
}

function pieceAt(col, row, options = {}) {
  return state.pieces.find((piece) => {
    if (!piece.alive || piece.col !== col || piece.row !== row) return false;
    if (options.side && piece.side !== options.side) return false;
    if (options.type && piece.type !== options.type) return false;
    return true;
  });
}

function alivePieces(filter) {
  return state.pieces.filter((piece) => piece.alive && filter(piece));
}

async function movePlayerTo(col, row) {
  state.player.col = col;
  state.player.row = row;
  const player = state.pieces.find((piece) => piece.id === "player");
  player.col = col;
  player.row = row;
  syncPieces();
  await delay(170);
}

async function moveByDice(steps) {
  let remaining = steps;
  while (remaining > 0) {
    if (state.ride) {
      const ride = state.ride;
      let nextRow = state.player.row + ride.dir;
      if (nextRow < 0) {
        ride.dir = 1;
        nextRow = 1;
      } else if (nextRow > 9) {
        ride.dir = -1;
        nextRow = 8;
      }
      await movePlayerTo(ride.side, nextRow);
      remaining -= 1;

      if (state.player.row === 9) {
        const side = ride.side;
        if (ride.rookId) {
          const rook = state.pieces.find((piece) => piece.id === ride.rookId);
          rook.alive = true;
          rook.col = side;
          rook.row = 9;
        }
        state.ride = null;
        state.horizontalDir = side === 0 ? 1 : -1;
        syncPieces();
        addLog("车棋完成上下移动，将棋回到底线。");
      }
    } else {
      let nextCol = state.player.col + state.horizontalDir;
      if (nextCol < 0 || nextCol > 8) {
        state.horizontalDir *= -1;
        nextCol = state.player.col + state.horizontalDir;
      }
      await movePlayerTo(nextCol, 9);
      remaining -= 1;
    }
  }
}

async function fireProjectile(fromCol, fromRow, toCol, toRow) {
  const projectile = document.createElement("div");
  const start = gridToPos(fromCol, fromRow);
  const end = gridToPos(toCol, toRow);
  projectile.className = "projectile";
  projectile.style.left = start.left;
  projectile.style.top = start.top;
  boardEl.append(projectile);
  await delay(40);
  projectile.style.left = end.left;
  projectile.style.top = end.top;
  await delay(380);
  projectile.style.opacity = "0";
  await delay(140);
  projectile.remove();
}

async function flashPiece(piece) {
  const el = elements.get(piece.id);
  el.classList.add("piece-hit");
  await delay(180);
  el.classList.remove("piece-hit");
}

async function damagePlayer(source = "敌方攻击") {
  if (state.hp <= 0) {
    state.gameOver = true;
    setMessage("我方将棋再次受伤，失败。");
    addLog("失败：血量耗尽后再次受到伤害。");
    updateStatus();
    stopAutoRoll();
    return;
  }

  const health = alivePieces((piece) => piece.side === "red" && piece.type === "health").at(-1);
  if (health) {
    health.alive = false;
  }
  state.hp -= 1;
  await flashPiece(state.pieces.find((piece) => piece.id === "player"));
  syncPieces();
  addLog(`${source}，我方损失 1 点血量。`);

  if (state.hp === 0) {
    setMessage("我方兵棋和士棋已耗尽，下一次受伤即失败。");
  }
}

async function hitEnemy(piece) {
  if (!piece) return false;

  await flashPiece(piece);
  if (piece.type === "boss") {
    if (piece.row <= 0) {
      state.gameOver = true;
      setMessage("敌方将棋被击出棋盘，胜利！");
      addLog("胜利：敌方将棋退出棋盘顶部。");
      updateStatus();
      stopAutoRoll();
      return true;
    }
    piece.row -= 1;
    state.bossEscapes += 1;
    addLog("炮弹击中敌方将棋，敌将向上退一格。");
  } else if (["soldier", "guard", "rook"].includes(piece.type)) {
    piece.alive = false;
    addLog(`炮弹摧毁敌方${piece.label}棋。`);
  } else if (piece.type === "cannon") {
    addLog("炮弹穿过敌方炮棋。");
    return false;
  } else {
    addLog(`敌方${piece.label}棋挡住炮弹，但没有被摧毁。`);
  }
  syncPieces();
  return true;
}

async function verticalCannonAttack() {
  const col = state.player.col;
  const targets = state.pieces
    .filter((piece) => piece.alive && piece.side === "black" && piece.col === col && piece.row < state.player.row)
    .sort((a, b) => b.row - a.row);

  let stopRow = 0;
  for (const target of targets) {
    if (target.type === "cannon") continue;
    stopRow = target.row;
    break;
  }

  await fireProjectile(col, state.player.row, col, stopRow);
  const target = targets.find((piece) => piece.row === stopRow && piece.type !== "cannon");
  if (target) {
    await hitEnemy(target);
  } else {
    addLog("我方炮弹向上飞出棋盘。");
  }
}

async function enemyCannonAttack() {
  await fireProjectile(state.player.col, 3, state.player.col, state.player.row);
  await damagePlayer("敌方炮棋开炮");
}

async function chargeOwnPiece() {
  const col = state.player.col;
  const charger =
    alivePieces((piece) => piece.side === "red" && piece.type === "horse" && piece.col === col)[0] ||
    alivePieces((piece) => piece.side === "red" && piece.type === "elephant" && piece.col === col)[0];

  if (!charger) {
    addLog("本列马棋、象棋均已损失，没有冲锋。");
    return;
  }

  const target = state.pieces
    .filter(
      (piece) =>
        piece.alive &&
        piece.side === "black" &&
        ["horse", "elephant"].includes(piece.type) &&
        piece.col === col,
    )
    .sort((a, b) => b.row - a.row)[0];

  const oldRow = charger.row;
  charger.row = target ? target.row : 0;
  syncPieces();
  await delay(280);

  if (target) {
    charger.alive = false;
    target.alive = false;
    addLog(`我方${charger.label}棋冲锋，与敌方${target.label}棋同归于尽。`);
  } else {
    charger.row = oldRow;
    addLog(`我方${charger.label}棋向上冲锋，但没有撞到目标。`);
  }
  syncPieces();
}

async function horizontalBattlefieldAttack() {
  const row = state.player.row;
  const col = state.player.col;
  const nearby = [-1, 1]
    .map((delta) => pieceAt(col + delta, row, { side: "black" }))
    .find((piece) => piece && ["horse", "elephant"].includes(piece.type));

  if (nearby) {
    await flashPiece(nearby);
    await damagePlayer(`敌方${nearby.label}棋近身冲锋`);
    return;
  }

  const dir = col <= 4 ? 1 : -1;
  const ordered = state.pieces
    .filter((piece) => piece.alive && piece.side === "black" && piece.row === row && (piece.col - col) * dir > 0)
    .sort((a, b) => (a.col - b.col) * dir);

  const blocker = ordered.find((piece) => piece.type !== "cannon");
  const endCol = blocker ? blocker.col : dir > 0 ? 8 : 0;
  await fireProjectile(col, row, endCol, row);

  if (blocker) {
    await hitEnemy(blocker);
  } else {
    addLog("横向炮弹穿过敌阵。");
  }
}

async function resolveEvent() {
  const { col, row } = state.player;
  if (row === 9 && (col === 0 || col === 8)) {
    const rook = pieceAt(col, row, { side: "red", type: "rook" });
    if (rook) rook.alive = false;
    state.ride = { side: col, dir: -1, rookId: rook?.id ?? null };
    syncPieces();
    addLog(`将棋登上${col === 0 ? "左" : "右"}侧车棋。`);
    setMessage("下次移动将沿边界车道上下行进。");
    return;
  }

  if (row >= 8 && [3, 4, 5].includes(col)) {
    setMessage("我方炮棋开炮。");
    await verticalCannonAttack();
    return;
  }

  if (row >= 8 && [2, 6].includes(col)) {
    setMessage("停在敌方炮棋正下方。");
    await enemyCannonAttack();
    return;
  }

  if (row >= 8 && [1, 7].includes(col)) {
    setMessage("触发我方马/象冲锋。");
    await chargeOwnPiece();
    return;
  }

  if (row < 5) {
    setMessage("进入敌方区域，触发横向交互。");
    await horizontalBattlefieldAttack();
    return;
  }

  addLog("没有触发事件。");
}

async function rollDice() {
  if (state.moving || state.gameOver) return;
  state.moving = true;
  rollButton.classList.add("rolling");
  updateStatus();

  for (let i = 0; i < 8; i += 1) {
    state.dice = Math.floor(Math.random() * 6) + 1;
    updateStatus();
    await delay(45);
  }

  const dice = Math.floor(Math.random() * 6) + 1;
  state.dice = dice;
  rollButton.classList.remove("rolling");
  setMessage(`掷出 ${dice} 点，将棋开始移动。`);
  addLog(`掷出 ${dice} 点。`);
  updateStatus();

  await moveByDice(dice);
  await resolveEvent();

  state.moving = false;
  updateStatus();
  if (!state.gameOver && !messageEl.textContent.includes("下次移动")) {
    setMessage("事件完成，可以继续掷骰子。");
  }
  scheduleAutoRoll();
}

function scheduleAutoRoll() {
  clearTimeout(autoTimer);
  autoTimer = null;
  if (!autoRollEl.checked || state.moving || state.gameOver) return;
  autoTimer = setTimeout(rollDice, 850);
}

function stopAutoRoll() {
  clearTimeout(autoTimer);
  autoTimer = null;
  autoRollEl.checked = false;
}

function restart() {
  clearTimeout(autoTimer);
  state = createState();
  renderBoard();
  setMessage("点击骰子开始。");
  addLog("新的一局开始。");
  updateStatus();
  scheduleAutoRoll();
}

rollButton.addEventListener("click", rollDice);
restartButton.addEventListener("click", restart);
autoRollEl.addEventListener("change", scheduleAutoRoll);

restart();
