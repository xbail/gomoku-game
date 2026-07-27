export type CellState = "black" | "white" | null;
export type PlayerColor = "black" | "white";

export function createEmptyBoard(size = 15): CellState[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

// 4 个方向：横、竖、主对角、副对角
const DIRECTIONS = [
  [0, 1],  // horizontal
  [1, 0],  // vertical
  [1, 1],  // diagonal \
  [1, -1], // diagonal /
] as const;

/**
 * 找到经过 (row,col) 的连珠位置（颜色为 cell 的同色连续段）。
 * 返回连珠包含的全部坐标（含落子点）。
 */
function getLine(board: CellState[][], row: number, col: number, dir: readonly [number, number]): [number, number][] {
  const cell = board[row][col];
  const size = board.length;
  const line: [number, number][] = [[row, col]];

  // 正向
  for (let i = 1; i < 6; i++) {
    const r = row + dir[0] * i;
    const c = col + dir[1] * i;
    if (r < 0 || r >= size || c < 0 || c >= size) break;
    if (board[r][c] !== cell) break;
    line.push([r, c]);
  }
  // 反向
  for (let i = 1; i < 6; i++) {
    const r = row - dir[0] * i;
    const c = col - dir[1] * i;
    if (r < 0 || r >= size || c < 0 || c >= size) break;
    if (board[r][c] !== cell) break;
    line.unshift([r, c]);
  }
  return line;
}

/**
 * 判定是否成 5（或更长）连珠，返回获胜连线坐标，未获胜返回 null。
 * 注意：黑方若落子形成长连（>=6），按禁手规则应判负，此处对白方仍判胜、对黑方交给禁手逻辑处理。
 */
export function findWinLine(board: CellState[][], row: number, col: number): [number, number][] | null {
  const cell = board[row][col];
  if (!cell) return null;

  for (const dir of DIRECTIONS) {
    const line = getLine(board, row, col, dir as unknown as [number, number]);
    if (line.length >= 5) {
      // 恰好 5 连对双方都判胜；超过 5（长连）仅白方判胜，黑方交给禁手处理
      if (line.length > 5 && cell === "black") continue;
      return line;
    }
  }
  return null;
}

/** 向后兼容旧调用：返回胜者颜色 */
export function checkWin(board: CellState[][], row: number, col: number): PlayerColor | null {
  const line = findWinLine(board, row, col);
  if (!line) return null;
  return board[row][col] as PlayerColor;
}

export function isBoardFull(board: CellState[][]): boolean {
  return board.every(row => row.every(cell => cell !== null));
}

// ====================== 黑方禁手规则 ======================
// 连珠棋禁手：黑方若落子形成「三三」「四四」「长连」则判负。
// 这里采用业界通用的简化判定，覆盖绝大多数实战局面。
// - 长连：某方向连续同色 >= 6
// - 活四 / 冲四：合计形成两个「四」即四四禁手
// - 活三：合计形成两个「活三」即三三禁手
// 判定时会把刚落下的子计入，按 RIF 简化规则判断「四」「活三」数量。

/** 统计某方向上以 (row,col) 为组成部分的「四」的数量（含活四/冲四） */
function countFour(board: CellState[][], row: number, col: number, dir: readonly [number, number]): number {
  const cell = board[row][col];
  if (!cell) return 0;
  const size = board.length;

  // 在该方向上扫描包含 (row,col) 的所有 6 格窗口（中心 1 + 两侧 5），
  // 统计恰好 4 连且两端不全堵的形态数（去重近似）。
  let fours = 0;

  // 取包含落子的连续段两端各延伸最多 2 格，构造一个最长 9 格的串
  const seg: { r: number; c: number; v: CellState }[] = [];
  for (let i = -4; i <= 4; i++) {
    const r = row + dir[0] * i;
    const c = col + dir[1] * i;
    if (r < 0 || r >= size || c < 0 || c >= size) {
      seg.push({ r: -1, c: -1, v: null }); // 边界视为空（非同色）
    } else {
      seg.push({ r, c, v: board[r][c] });
    }
  }

  // 在 9 格串里滑窗 5 格，找恰好 4 个同色 + 1 个空位、且 4 连续的形态
  for (let i = 0; i + 4 < seg.length; i++) {
    let same = 0;
    let emptyAt = -1;
    let bad = false;
    for (let j = 0; j < 5; j++) {
      const v = seg[i + j].v;
      if (v === cell) same++;
      else if (v === null) {
        if (emptyAt !== -1) { bad = true; break; } // 两个空位不算四
        emptyAt = j;
      } else { bad = true; break; }
    }
    if (bad) continue;
    if (same !== 4 || emptyAt === -1) continue;

    // 这 5 格里恰好 4 同色 + 1 空。判断 4 个同色是否连续（在去掉空位后）。
    const idx = [0, 1, 2, 3, 4].filter(k => k !== emptyAt);
    const consecutive = idx.every((k, p) => p === 0 || idx[p] === idx[p - 1] + 1);
    if (!consecutive) continue;

    // 判断是否被两端封死：四连段的左右两端
    // 四连段在窗口内的起止索引
    const s = idx[0];
    const e = idx[idx.length - 1];
    // 左端
    let leftBlocked = false;
    if (s === 0) leftBlocked = true;
    else {
      // 窗口左外侧（窗口前一格）
      const lr = seg[i - 1 + s] ?? null;
      // seg 索引：窗口起始 i，内部偏移 s-1
      const r = row + dir[0] * (i - 4 + s - 1);
      const c = col + dir[1] * (i - 4 + s - 1);
      leftBlocked = r < 0 || r >= size || c < 0 || c >= size || (board[r][c] !== null && board[r][c] !== cell);
      void lr;
    }
    // 右端
    let rightBlocked = false;
    if (e === 4) rightBlocked = true;
    else {
      const r = row + dir[0] * (i - 4 + e + 1);
      const c = col + dir[1] * (i - 4 + e + 1);
      rightBlocked = r < 0 || r >= size || c < 0 || c >= size || (board[r][c] !== null && board[r][c] !== cell);
    }
    // 活四或冲四都计入「四」
    fours++;
    void leftBlocked; void rightBlocked;
  }

  return fours;
}

/** 统计某方向上以 (row,col) 为组成部分的「活三」数量（简化判定） */
function countOpenThree(board: CellState[][], row: number, col: number, dir: readonly [number, number]): number {
  const cell = board[row][col];
  if (!cell) return 0;
  const size = board.length;

  // 活三：OOO 且两端都空（_OOO_），或带跳活三 _O_OO_ / _OO_O_。
  // 窗口取 [-4..4] 共 9 格，确保能覆盖偏移的活三。
  const line: { v: CellState; idx: number }[] = [];
  for (let i = -4; i <= 4; i++) {
    const r = row + dir[0] * i;
    const c = col + dir[1] * i;
    if (r < 0 || r >= size || c < 0 || c >= size) {
      line.push({ v: null, idx: i });
    } else {
      line.push({ v: board[r][c], idx: i });
    }
  }

  const arr = line.map(x => (x.v === cell ? "1" : x.v === null ? "0" : "x")).join("");
  // 连续活三 _OOO_
  if (/0011100/.test(arr)) return 1;
  // 跳活三 _OO_O_ / _O_OO_（两端空，中间含一个空）
  if (/011010|010110/.test(arr)) return 1;
  return 0;
}

/**
 * 判定黑方在 (row,col) 落子是否构成禁手。
 * 返回禁手类型字符串；非禁手返回 null。
 */
export function checkForbidden(board: CellState[][], row: number, col: number): "long" | "double4" | "double3" | null {
  const cell = board[row][col];
  if (cell !== "black") return null;

  // 长连：任一方向连续 >= 6
  for (const dir of DIRECTIONS) {
    const line = getLine(board, row, col, dir as unknown as [number, number]);
    if (line.length >= 6) return "long";
  }

  // 四四：四个方向上「四」的总数 >= 2
  let fourCount = 0;
  for (const dir of DIRECTIONS) {
    fourCount += countFour(board, row, col, dir as unknown as [number, number]);
  }
  if (fourCount >= 2) return "double4";

  // 三三：四个方向上「活三」的总数 >= 2
  let threeCount = 0;
  for (const dir of DIRECTIONS) {
    threeCount += countOpenThree(board, row, col, dir as unknown as [number, number]);
  }
  if (threeCount >= 2) return "double3";

  return null;
}
