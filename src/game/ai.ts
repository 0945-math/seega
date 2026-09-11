import { Board, GameState, Player, Position, getCaptures, getValidMoves, countPieces, isFirstMove } from './seega';

const BOARD_SIZE = 5;
const CENTER = 2;

export function getAIMoveFast(state: GameState): { from?: Position; to: Position } | null {
  if (state.phase === 'placing') return null;

  const first = isFirstMove(state);
  let best: { from: Position; to: Position } | null = null;
  let bestScore = -Infinity;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c] !== state.currentPlayer) continue;

      const from = { row: r, col: c };
      for (const to of getValidMoves(state.board, from)) {
        if (first && (to.row !== CENTER || to.col !== CENTER)) continue;

        const board = state.board.map(row => [...row]);
        board[r][c] = null;
        board[to.row][to.col] = state.currentPlayer;

        const captures = getCaptures(board, to, state.currentPlayer);
        let score = captures.length * 1000;

        // 捕獲できる手を優先し、それ以外では中央に近い手を優先する。
        score += (4 - Math.abs(to.row - CENTER) - Math.abs(to.col - CENTER)) * 2;

        if (captures.length) {
          for (const cap of captures) board[cap.row][cap.col] = null;
          const opponent: Player = state.currentPlayer === 'player1' ? 'player2' : 'player1';
          if (countPieces(board, opponent) <= 1) score += 100000;
        }

        if (score > bestScore) {
          bestScore = score;
          best = { from, to };
        }
      }
    }
  }

  return best;
}
