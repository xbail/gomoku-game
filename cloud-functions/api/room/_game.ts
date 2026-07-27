type CellState = "black" | "white" | null;
type PlayerColor = "black" | "white";

const BOARD_SIZE = 15;

export function createEmptyBoard(): CellState[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function checkWin(board: CellState[][], row: number, col: number): PlayerColor | null {
  const cell = board[row][col];
  if (!cell) return null;

  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal \
    [1, -1], // diagonal /
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    // positive direction
    for (let i = 1; i < 5; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r][c] !== cell) break;
      count++;
    }
    // negative direction
    for (let i = 1; i < 5; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r][c] !== cell) break;
      count++;
    }
    if (count >= 5) return cell as PlayerColor;
  }

  return null;
}

export function isBoardFull(board: CellState[][]): boolean {
  return board.every(row => row.every(cell => cell !== null));
}
