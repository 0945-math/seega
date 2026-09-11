import { Board, GameState, HandPieces, Move, Piece, PieceType, Player, Position } from './types';
import { applyMove, canPromote, getDropMoves, getValidMoves, isLegalMove, mustPromote } from './rules';

// 駒の価値（評価用）
const PIECE_VALUES: Record<PieceType, number> = {
  king: 10000,
  rook: 1000,
  bishop: 800,
  gold: 600,
  silver: 500,
  knight: 400,
  lance: 300,
  pawn: 100,
};

// 成りのボーナス
const PROMOTION_BONUS: Record<PieceType, number> = {
  king: 0,
  rook: 150,
  bishop: 150,
  gold: 0,
  silver: 50,
  knight: 100,
  lance: 50,
  pawn: 50,
};

// 位置ボーナス（中央に近いほど良い）
function positionBonus(pos: Position, player: Player): number {
  const centerDist = Math.abs(pos.col - 4) + Math.abs(pos.row - 4);
  return (8 - centerDist) * 2;
}

// 盤面評価関数
function evaluateBoard(board: Board, senteHand: HandPieces, goteHand: HandPieces): number {
  let score = 0;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      let value = PIECE_VALUES[piece.type];
      if (piece.promoted) {
        value += PROMOTION_BONUS[piece.type];
      }
      value += positionBonus({ row: r, col: c }, piece.player);

      if (piece.player === 'sente') {
        score += value;
      } else {
        score -= value;
      }
    }
  }

  // 持ち駒の評価
  for (const [type, count] of senteHand.entries()) {
    score += PIECE_VALUES[type] * count * 0.9; // 持ち駒は少し割引
  }
  for (const [type, count] of goteHand.entries()) {
    score -= PIECE_VALUES[type] * count * 0.9;
  }

  return score;
}

// 全ての合法手を生成
export function generateAllMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  const player = state.currentPlayer;
  const hand = player === 'sente' ? state.senteHand : state.goteHand;

  // 盤面の駒を移動
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = state.board[r][c];
      if (!piece || piece.player !== player) continue;

      const from = { row: r, col: c };
      const validPositions = getValidMoves(state.board, from, piece, hand);

      for (const to of validPositions) {
        const captured = state.board[to.row][to.col] || undefined;
        const canP = canPromote(piece, from, to);
        const mustP = mustPromote(piece, to);

        if (mustP) {
          const move: Move = { from, to, piece, captured, promoted: true };
          if (isLegalMove(state, move)) {
            moves.push(move);
          }
        } else if (canP) {
          // 成る手
          const promoteMove: Move = { from, to, piece, captured, promoted: true };
          if (isLegalMove(state, promoteMove)) {
            moves.push(promoteMove);
          }
          // 成らない手
          const noPromoteMove: Move = { from, to, piece, captured, promoted: false };
          if (isLegalMove(state, noPromoteMove)) {
            moves.push(noPromoteMove);
          }
        } else {
          const move: Move = { from, to, piece, captured, promoted: false };
          if (isLegalMove(state, move)) {
            moves.push(move);
          }
        }
      }
    }
  }

  // 持ち駒を打つ
  const dropMoves = getDropMoves(state.board, hand, player);
  for (const drop of dropMoves) {
    const piece: Piece = { type: drop.type, player, promoted: false };
    const move: Move = { from: { row: -1, col: -1 }, to: drop.pos, piece, drop: true };
    if (isLegalMove(state, move)) {
      moves.push(move);
    }
  }

  return moves;
}

// ミニマックス法（アルファベータ枝刈り付き）
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean
): number {
  if (depth === 0 || state.gameOver) {
    return evaluateBoard(state.board, state.senteHand, state.goteHand);
  }

  const moves = generateAllMoves(state);

  if (moves.length === 0) {
    // 合法手がない = 詰み
    return maximizing ? -99999 : 99999;
  }

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newState = applyMove(state, move);
      const eval_ = minimax(newState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newState = applyMove(state, move);
      const eval_ = minimax(newState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// AIの手を選択（後手=gote）
export function getAIMove(state: GameState, difficulty: number = 2): Move | null {
  const moves = generateAllMoves(state);
  if (moves.length === 0) return null;

  if (difficulty === 0) {
    // ランダム
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = Math.min(difficulty, 2); // 最大depth 2（ブラウザでの応答性を考慮）
  let bestMove: Move | null = null;
  let bestEval = Infinity; // AIは後手（minimizing）

  for (const move of moves) {
    const newState = applyMove(state, move);
    const eval_ = minimax(newState, depth - 1, -Infinity, Infinity, true);
    if (eval_ < bestEval) {
      bestEval = eval_;
      bestMove = move;
    }
  }

  return bestMove;
}
