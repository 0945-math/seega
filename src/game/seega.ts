// シーガ（Seega）ゲームロジック - 完全版
// 古代エジプトの挟み棋ゲーム

export type Player = 'player1' | 'player2';
export type Cell = Player | null;
export type Board = Cell[][];
export type Phase = 'placing' | 'moving';

export interface Position {
  row: number;
  col: number;
}

export interface MoveRecord {
  type: 'place' | 'move';
  player: Player;
  from?: Position;
  to: Position;
  captured?: Position[];
}

export interface GameState {
  board: Board;
  currentPlayer: Player;
  phase: Phase;
  totalPlaced: { player1: number; player2: number };
  selectedPos: Position | null;
  validMoves: Position[];
  capturedBy: { player1: number; player2: number };
  gameOver: boolean;
  winner: Player | null;
  message: string;
  canCapture: boolean;
  moveHistory: MoveRecord[];
  lastMove: { from?: Position; to: Position } | null;
  capturedPositions: Position[];
}

const BOARD_SIZE = 5;
export const PIECES_PER_PLAYER = 12;

export function createInitialState(): GameState {
  const board: Board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  return {
    board,
    currentPlayer: 'player1',
    phase: 'placing',
    totalPlaced: { player1: 0, player2: 0 },
    selectedPos: null,
    validMoves: [],
    capturedBy: { player1: 0, player2: 0 },
    gameOver: false,
    winner: null,
    message: '配置フェーズ：あなたの駒を置いてください',
    canCapture: false,
    moveHistory: [],
    lastMove: null,
    capturedPositions: [],
  };
}

export function isCenter(pos: Position): boolean {
  const center = Math.floor(BOARD_SIZE / 2);
  return pos.row === center && pos.col === center;
}

export function canPlace(state: GameState, pos: Position): boolean {
  if (state.phase !== 'placing') return false;
  if (state.board[pos.row][pos.col] !== null) return false;
  if (isCenter(pos)) return false;
  return true;
}

export function placePiece(state: GameState, pos: Position): GameState {
  if (!canPlace(state, pos)) return state;

  const newBoard = state.board.map(row => [...row]);
  newBoard[pos.row][pos.col] = state.currentPlayer;

  const newTotalPlaced = { ...state.totalPlaced };
  newTotalPlaced[state.currentPlayer]++;

  const nextPlayer: Player = state.currentPlayer === 'player1' ? 'player2' : 'player1';
  const allPlaced = newTotalPlaced.player1 >= PIECES_PER_PLAYER && newTotalPlaced.player2 >= PIECES_PER_PLAYER;

  let newPhase: Phase = state.phase;
  let newMessage = '';

  if (allPlaced) {
    newPhase = 'moving';
    newMessage = '移動フェーズ開始！先手の最初の一手は中央へ';
  } else {
    newMessage = `${nextPlayer === 'player1' ? 'あなた' : 'AI'}の番です`;
  }

  const newMoveHistory = [...state.moveHistory, {
    type: 'place' as const,
    player: state.currentPlayer,
    to: pos,
  }];

  return {
    ...state,
    board: newBoard,
    totalPlaced: newTotalPlaced,
    currentPlayer: nextPlayer,
    phase: newPhase,
    message: newMessage || state.message,
    selectedPos: null,
    validMoves: [],
    moveHistory: newMoveHistory,
    lastMove: { to: pos },
    capturedPositions: [],
  };
}

export function getValidMoves(board: Board, pos: Position): Position[] {
  const moves: Position[] = [];
  const directions = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  for (const dir of directions) {
    const newRow = pos.row + dir.dr;
    const newCol = pos.col + dir.dc;
    if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
      if (board[newRow][newCol] === null) {
        moves.push({ row: newRow, col: newCol });
      }
    }
  }

  return moves;
}

export function getCaptures(board: Board, pos: Position, player: Player): Position[] {
  const captures: Position[] = [];
  const opponent: Player = player === 'player1' ? 'player2' : 'player1';

  const directions = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  for (const dir of directions) {
    const adjRow = pos.row + dir.dr;
    const adjCol = pos.col + dir.dc;
    if (adjRow < 0 || adjRow >= BOARD_SIZE || adjCol < 0 || adjCol >= BOARD_SIZE) continue;
    if (board[adjRow][adjCol] !== opponent) continue;

    const beyondRow = adjRow + dir.dr;
    const beyondCol = adjCol + dir.dc;
    if (beyondRow < 0 || beyondRow >= BOARD_SIZE || beyondCol < 0 || beyondCol >= BOARD_SIZE) continue;
    if (board[beyondRow][beyondCol] === player) {
      captures.push({ row: adjRow, col: adjCol });
    }
  }

  return captures;
}

export function movePiece(state: GameState, from: Position, to: Position): GameState {
  const newBoard = state.board.map(row => [...row]);
  const player = state.currentPlayer;

  newBoard[from.row][from.col] = null;
  newBoard[to.row][to.col] = player;

  const captures = getCaptures(newBoard, to, player);

  let newCapturedBy = { ...state.capturedBy };
  let newBoardAfterCaptures = newBoard;
  const capturedPositions: Position[] = [];

  if (captures.length > 0) {
    newBoardAfterCaptures = newBoard.map(row => [...row]);
    for (const cap of captures) {
      newBoardAfterCaptures[cap.row][cap.col] = null;
      newCapturedBy[player]++;
      capturedPositions.push(cap);
    }
  }

  const opponent: Player = player === 'player1' ? 'player2' : 'player1';
  const opponentPieces = countPieces(newBoardAfterCaptures, opponent);
  let gameOver = false;
  let winner: Player | null = null;

  if (opponentPieces <= 1) {
    gameOver = true;
    winner = player;
  }

  const canContinueCapture = captures.length > 0 && !gameOver && hasAnyCapturePossible(newBoardAfterCaptures, player);

  let message = '';
  if (gameOver) {
    message = player === 'player1' ? '🎉 あなたの勝ち！' : '😢 AIの勝ち...';
  } else if (canContinueCapture) {
    message = `連続キャプチャ！もう一度移動できます`;
  } else {
    const nextPlayer: Player = player === 'player1' ? 'player2' : 'player1';
    message = nextPlayer === 'player1' ? 'あなたの番です' : 'AIの番です';
  }

  const newMoveHistory = [...state.moveHistory, {
    type: 'move' as const,
    player,
    from,
    to,
    captured: captures.length > 0 ? captures : undefined,
  }];

  return {
    ...state,
    board: newBoardAfterCaptures,
    currentPlayer: canContinueCapture ? player : (player === 'player1' ? 'player2' : 'player1'),
    selectedPos: null,
    validMoves: [],
    capturedBy: newCapturedBy,
    gameOver,
    winner,
    message,
    canCapture: canContinueCapture,
    moveHistory: newMoveHistory,
    lastMove: { from, to },
    capturedPositions,
  };
}

export function countPieces(board: Board, player: Player): number {
  let count = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === player) count++;
    }
  }
  return count;
}

function hasAnyCapturePossible(board: Board, player: Player): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== player) continue;
      const moves = getValidMoves(board, { row: r, col: c });
      for (const move of moves) {
        const testBoard = board.map(row => [...row]);
        testBoard[r][c] = null;
        testBoard[move.row][move.col] = player;
        const captures = getCaptures(testBoard, { row: move.row, col: move.col }, player);
        if (captures.length > 0) return true;
      }
    }
  }
  return false;
}

export function isFirstMove(state: GameState): boolean {
  return state.phase === 'moving' &&
    state.capturedBy.player1 === 0 && state.capturedBy.player2 === 0 &&
    countPieces(state.board, 'player1') === PIECES_PER_PLAYER &&
    countPieces(state.board, 'player2') === PIECES_PER_PLAYER &&
    state.board[Math.floor(BOARD_SIZE / 2)][Math.floor(BOARD_SIZE / 2)] === null;
}

// ===== AI =====

function evaluate(board: Board, aiPlayer: Player): number {
  const opponent: Player = aiPlayer === 'player1' ? 'player2' : 'player1';
  const myPieces = countPieces(board, aiPlayer);
  const oppPieces = countPieces(board, opponent);

  let score = (myPieces - oppPieces) * 100;

  if (oppPieces <= 1) return 10000;
  if (myPieces <= 1) return -10000;

  const center = Math.floor(BOARD_SIZE / 2);
  
  if (board[center][center] === aiPlayer) score += 50;
  if (board[center][center] === opponent) score -= 50;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === null) continue;
      const dist = Math.abs(r - center) + Math.abs(c - center);
      const posBonus = (4 - dist) * 5;
      if (board[r][c] === aiPlayer) {
        score += posBonus;
      } else {
        score -= posBonus;
      }
    }
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== aiPlayer) continue;
      const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
      for (const dir of dirs) {
        const ar = r + dir.dr;
        const ac = c + dir.dc;
        if (ar < 0 || ar >= BOARD_SIZE || ac < 0 || ac >= BOARD_SIZE) continue;
        if (board[ar][ac] === opponent) {
          const br = ar + dir.dr;
          const bc = ac + dir.dc;
          if (br >= 0 && br < BOARD_SIZE && bc >= 0 && bc < BOARD_SIZE && board[br][bc] === null) {
            score += 20;
          }
        }
      }
    }
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== aiPlayer) continue;
      const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
      for (const dir of dirs) {
        const ar = r + dir.dr;
        const ac = c + dir.dc;
        const br = r - dir.dr;
        const bc = c - dir.dc;
        if (ar >= 0 && ar < BOARD_SIZE && ac >= 0 && ac < BOARD_SIZE &&
            br >= 0 && br < BOARD_SIZE && bc >= 0 && bc < BOARD_SIZE) {
          if (board[ar][ac] === opponent && board[br][bc] === null) {
            score -= 15;
          }
        }
      }
    }
  }

  return score;
}

function getAIPlacement(state: GameState): Position {
  const aiPlayer = state.currentPlayer;
  const center = Math.floor(BOARD_SIZE / 2);
  let bestPos: Position | null = null;
  let bestScore = -Infinity;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c] !== null) continue;
      if (r === center && c === center) continue;

      const testBoard = state.board.map(row => [...row]);
      testBoard[r][c] = aiPlayer;
      const score = evaluate(testBoard, aiPlayer);

      if (score > bestScore) {
        bestScore = score;
        bestPos = { row: r, col: c };
      }
    }
  }

  return bestPos || { row: 0, col: 0 };
}

function getAIMove(state: GameState, depth: number = 3): { from: Position; to: Position } | null {
  const aiPlayer = state.currentPlayer;
  const center = Math.floor(BOARD_SIZE / 2);
  
  const isFirst = state.phase === 'moving' &&
    state.capturedBy.player1 === 0 && state.capturedBy.player2 === 0 &&
    countPieces(state.board, 'player1') === PIECES_PER_PLAYER &&
    countPieces(state.board, 'player2') === PIECES_PER_PLAYER &&
    state.board[center][center] === null;

  if (isFirst) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (state.board[r][c] !== aiPlayer) continue;
        const moves = getValidMoves(state.board, { row: r, col: c });
        if (moves.some(m => m.row === center && m.col === center)) {
          return { from: { row: r, col: c }, to: { row: center, col: center } };
        }
      }
    }
  }

  const allMoves: { from: Position; to: Position; score: number }[] = [];
  
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c] !== aiPlayer) continue;
      const moves = getValidMoves(state.board, { row: r, col: c });
      
      for (const move of moves) {
        if (isFirst && !(move.row === center && move.col === center)) continue;

        const testBoard = state.board.map(row => [...row]);
        testBoard[r][c] = null;
        testBoard[move.row][move.col] = aiPlayer;
        const captures = getCaptures(testBoard, { row: move.row, col: move.col }, aiPlayer);
        let score = captures.length * 200;

        const afterBoard = testBoard.map(row => [...row]);
        for (const cap of captures) {
          afterBoard[cap.row][cap.col] = null;
        }

        if (depth > 0) {
          score += minimax(afterBoard, depth - 1, -Infinity, Infinity, false, aiPlayer);
        } else {
          score += evaluate(afterBoard, aiPlayer);
        }

        allMoves.push({ from: { row: r, col: c }, to: move, score });
      }
    }
  }

  if (allMoves.length === 0) return null;

  allMoves.sort((a, b) => b.score - a.score);
  return { from: allMoves[0].from, to: allMoves[0].to };
}

function minimax(board: Board, depth: number, alpha: number, beta: number, maximizing: boolean, aiPlayer: Player): number {
  const opponent: Player = aiPlayer === 'player1' ? 'player2' : 'player1';
  const currentPlayer = maximizing ? aiPlayer : opponent;

  if (depth === 0) {
    return evaluate(board, aiPlayer);
  }

  const myPieces = countPieces(board, aiPlayer);
  const oppPieces = countPieces(board, opponent);
  if (oppPieces <= 1) return 10000;
  if (myPieces <= 1) return -10000;

  let bestEval = maximizing ? -Infinity : Infinity;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== currentPlayer) continue;
      const moves = getValidMoves(board, { row: r, col: c });
      
      for (const move of moves) {
        const testBoard = board.map(row => [...row]);
        testBoard[r][c] = null;
        testBoard[move.row][move.col] = currentPlayer;
        const captures = getCaptures(testBoard, { row: move.row, col: move.col }, currentPlayer);
        for (const cap of captures) {
          testBoard[cap.row][cap.col] = null;
        }

        const eval_ = minimax(testBoard, depth - 1, alpha, beta, !maximizing, aiPlayer);

        if (maximizing) {
          bestEval = Math.max(bestEval, eval_);
          alpha = Math.max(alpha, eval_);
        } else {
          bestEval = Math.min(bestEval, eval_);
          beta = Math.min(beta, eval_);
        }
        if (beta <= alpha) return bestEval;
      }
    }
  }

  return bestEval;
}

export { getAIPlacement, getAIMove };
