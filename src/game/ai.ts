import { GameState, Position, getCaptures, getValidMoves, isFirstMove } from './seega';

const BOARD_SIZE = 5;
const CENTER = 2;

/**
 * 実戦用の即時AI。
 * 1手を必ず短時間で返すことを優先し、探索木・MCTS・深い評価は行わない。
 */
export function getAIMoveFast(state: GameState): { from?: Position; to: Position } | null {
  if (state.phase === 'placing') return null;

  const first = isFirstMove(state);

  // まず中央への初手を探す。
  if (first) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (state.board[r][c] !== state.currentPlayer) continue;
        const from = { row: r, col: c };
        for (const to of getValidMoves(state.board, from)) {
          if (to.row === CENTER && to.col === CENTER) return { from, to };
        }
      }
    }
  }

  let fallback: { from: Position; to: Position } | null = null;

  // 全駒を一度だけ走査。捕獲できる手を最優先し、それがなければ最初の合法手。
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c] !== state.currentPlayer) continue;

      const from = { row: r, col: c };
      for (const to of getValidMoves(state.board, from)) {
        if (first && (to.row !== CENTER || to.col !== CENTER)) continue;

        if (!fallback) fallback = { from, to };

        const board = state.board.map(row => [...row]);
        board[from.row][from.col] = null;
        board[to.row][to.col] = state.currentPlayer;

        if (getCaptures(board, to, state.currentPlayer).length > 0) {
          return { from, to };
        }
      }
    }
  }

  return fallback;
}
