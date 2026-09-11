// シーガ（Seega）ゲームロジック
// 古代エジプトの挟み棋ゲーム

export type Player = 'player1' | 'player2';
export type Cell = Player | null;
export type Board = Cell[][];
export type Phase = 'placing' | 'moving';

export interface Position {
  row: number;
  col: number;
}

export interface GameState {
  board: Board;
  currentPlayer: Player;
  phase: Phase;
  piecesPlacedThisTurn: number; // 配置フェーズでこのターンに置いた数（0, 1, 2）
  totalPlaced: { player1: number; player2: number };
  selectedPos: Position | null;
  validMoves: Position[];
  capturedBy: { player1: number; player2: number };
  gameOver: boolean;
  winner: Player | null;
  message: string;
  canCapture: boolean; // 連続キャプチャ中
  boardSize: number;
}

const BOARD_SIZE = 5;
const PIECES_PER_PLAYER = 12; // (25-1)/2 = 12

export function createInitialState(): GameState {
  const board: Board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  return {
    board,
    currentPlayer: 'player1',
    phase: 'placing',
    piecesPlacedThisTurn: 0,
    totalPlaced: { player1: 0, player2: 0 },
    selectedPos: null,
    validMoves: [],
    capturedBy: { player1: 0, player2: 0 },
    gameOver: false,
    winner: null,
    message: '配置フェーズ：あなたの駒を置いてください（2個/ターン）',
    canCapture: false,
    boardSize: BOARD_SIZE,
  };
}

// 中央かどうか
export function isCenter(pos: Position): boolean {
  const center = Math.floor(BOARD_SIZE / 2);
  return pos.row === center && pos.col === center;
}

// 配置フェーズ：駒を置けるか
export function canPlace(state: GameState, pos: Position): boolean {
  if (state.phase !== 'placing') return false;
  if (state.board[pos.row][pos.col] !== null) return false;
  if (isCenter(pos)) return false;
  return true;
}

// 駒を置く
export function placePiece(state: GameState, pos: Position): GameState {
  if (!canPlace(state, pos)) return state;

  const newBoard = state.board.map(row => [...row]);
  newBoard[pos.row][pos.col] = state.currentPlayer;

  const newTotalPlaced = { ...state.totalPlaced };
  newTotalPlaced[state.currentPlayer]++;
  const newPlacedThisTurn = state.piecesPlacedThisTurn + 1;

  const nextPlayer: Player = state.currentPlayer === 'player1' ? 'player2' : 'player1';

  // 配置フェーズ終了チェック
  const allPlaced = newTotalPlaced.player1 >= PIECES_PER_PLAYER && newTotalPlaced.player2 >= PIECES_PER_PLAYER;

  let newPhase: Phase = state.phase;
  let newMessage = '';

  if (allPlaced) {
    newPhase = 'moving';
    newMessage = '移動フェーズ開始！先手の最初の一手は中央へ';
  } else if (newPlacedThisTurn >= 2) {
    // 2個置き終わったら相手ターン
    newMessage = `配置フェーズ：${nextPlayer === 'player1' ? 'あなた' : 'AI'}の駒を置いてください（2個/ターン）`;
  } else {
    // あと1個
    newMessage = `あと1個置いてください（${state.currentPlayer === 'player1' ? 'あなた' : 'AI'}）`;
  }

  // ターン切り替え判定
  const shouldSwitchTurn = newPlacedThisTurn >= 2 || allPlaced;

  return {
    ...state,
    board: newBoard,
    totalPlaced: newTotalPlaced,
    piecesPlacedThisTurn: shouldSwitchTurn ? 0 : newPlacedThisTurn,
    currentPlayer: shouldSwitchTurn ? nextPlayer : state.currentPlayer,
    phase: newPhase,
    message: newMessage || state.message,
    selectedPos: null,
    validMoves: [],
  };
}

// 移動可能な位置を取得
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

// 挟み取りチェック：移動後に相手の駒を取れるか
export function getCaptures(board: Board, pos: Position, player: Player): Position[] {
  const captures: Position[] = [];
  const opponent: Player = player === 'player1' ? 'player2' : 'player1';

  // 移動した駒の上下左右をチェック
  const directions = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  for (const dir of directions) {
    // 隣が相手の駒
    const adjRow = pos.row + dir.dr;
    const adjCol = pos.col + dir.dc;
    if (adjRow < 0 || adjRow >= BOARD_SIZE || adjCol < 0 || adjCol >= BOARD_SIZE) continue;
    if (board[adjRow][adjCol] !== opponent) continue;

    // その向こうが自分の駒
    const beyondRow = adjRow + dir.dr;
    const beyondCol = adjCol + dir.dc;
    if (beyondRow < 0 || beyondRow >= BOARD_SIZE || beyondCol < 0 || beyondCol >= BOARD_SIZE) continue;
    if (board[beyondRow][beyondCol] === player) {
      captures.push({ row: adjRow, col: adjCol });
    }
  }

  return captures;
}

// 駒を移動する
export function movePiece(state: GameState, from: Position, to: Position): GameState {
  const newBoard = state.board.map(row => [...row]);
  const player = state.currentPlayer;
  const opponent: Player = player === 'player1' ? 'player2' : 'player1';

  // 駒を移動
  newBoard[from.row][from.col] = null;
  newBoard[to.row][to.col] = player;

  // 挟み取りチェック
  const captures = getCaptures(newBoard, to, player);

  let newCapturedBy = { ...state.capturedBy };
  let newBoardAfterCaptures = newBoard;

  if (captures.length > 0) {
    // 挟んだ駒を取り除く
    newBoardAfterCaptures = newBoard.map(row => [...row]);
    for (const cap of captures) {
      newBoardAfterCaptures[cap.row][cap.col] = null;
      newCapturedBy[player]++;
    }
  }

  // 勝利判定
  const opponentPieces = countPieces(newBoardAfterCaptures, opponent);
  let gameOver = false;
  let winner: Player | null = null;

  if (opponentPieces <= 1) {
    gameOver = true;
    winner = player;
  }

  // 連続キャプチャの判定
  const canContinueCapture = captures.length > 0 && !gameOver && hasAnyCapturePossible(newBoardAfterCaptures, player);

  let message = '';
  if (gameOver) {
    message = player === 'player1' ? '🎉 あなたの勝ち！' : '😢 AIの勝ち...';
  } else if (canContinueCapture) {
    message = '連続キャプチャ！もう一度移動できます';
  } else {
    const nextPlayer: Player = player === 'player1' ? 'player2' : 'player1';
    message = nextPlayer === 'player1' ? 'あなたの番です' : 'AIの番です';
  }

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
  };
}

// 盤面の駒数を数える
export function countPieces(board: Board, player: Player): number {
  let count = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === player) count++;
    }
  }
  return count;
}

// 何か1つでもキャプチャ可能な手があるか
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

// プレイヤーに移動可能な駒があるか
export function hasAnyValidMove(board: Board, player: Player): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== player) continue;
      const moves = getValidMoves(board, { row: r, col: c });
      if (moves.length > 0) return true;
    }
  }
  return false;
}

// 先手の最初の移動かどうか（中央に移動する必要がある）
export function isFirstMove(state: GameState): boolean {
  return state.phase === 'moving' &&
    state.capturedBy.player1 === 0 && state.capturedBy.player2 === 0 &&
    countPieces(state.board, 'player1') === PIECES_PER_PLAYER &&
    countPieces(state.board, 'player2') === PIECES_PER_PLAYER &&
    state.board[Math.floor(BOARD_SIZE / 2)][Math.floor(BOARD_SIZE / 2)] === null;
}

// ===== AI =====

// 評価関数
function evaluate(board: Board, aiPlayer: Player): number {
  const opponent: Player = aiPlayer === 'player1' ? 'player2' : 'player1';
  const myPieces = countPieces(board, aiPlayer);
  const oppPieces = countPieces(board, opponent);

  let score = (myPieces - oppPieces) * 100;

  // 勝利/敗北
  if (oppPieces <= 1) return 10000;
  if (myPieces <= 1) return -10000;

  // 中央制御ボーナス
  const center = Math.floor(BOARD_SIZE / 2);
  if (board[center][center] === aiPlayer) score += 30;

  // 挟める位置のボーナス
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== aiPlayer) continue;
      // 各駒について、隣接する敵駒を挟める可能性
      const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
      for (const dir of dirs) {
        const ar = r + dir.dr;
        const ac = c + dir.dc;
        if (ar < 0 || ar >= BOARD_SIZE || ac < 0 || ac >= BOARD_SIZE) continue;
        if (board[ar][ac] === opponent) {
          const br = ar + dir.dr;
          const bc = ac + dir.dc;
          if (br >= 0 && br < BOARD_SIZE && bc >= 0 && bc < BOARD_SIZE && board[br][bc] === null) {
            score += 10; // 挟めるチャンス
          }
        }
      }
    }
  }

  // 自分が挟まれているリスクのペナルティ
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
            score -= 8; // 挟まれるリスク
          }
        }
      }
    }
  }

  return score;
}

// AIの配置手を選択
function getAIPlacement(state: GameState): Position[] {
  const placements: Position[] = [];
  let currentBoard = state.board.map(row => [...row]);
  const aiPlayer = state.currentPlayer;
  const center = Math.floor(BOARD_SIZE / 2);

  for (let i = 0; i < 2; i++) {
    let bestPos: Position | null = null;
    let bestScore = -Infinity;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (currentBoard[r][c] !== null) continue;
        if (r === center && c === center) continue;

        const testBoard = currentBoard.map(row => [...row]);
        testBoard[r][c] = aiPlayer;
        const score = evaluatePlacement(testBoard, aiPlayer, { row: r, col: c });

        if (score > bestScore) {
          bestScore = score;
          bestPos = { row: r, col: c };
        }
      }
    }

    if (bestPos) {
      placements.push(bestPos);
      currentBoard[bestPos.row][bestPos.col] = aiPlayer;
    }
  }

  return placements;
}

function evaluatePlacement(board: Board, player: Player, pos: Position): number {
  const opponent: Player = player === 'player1' ? 'player2' : 'player1';
  let score = 0;
  const center = Math.floor(BOARD_SIZE / 2);

  // 中央に近いほど良い
  const distToCenter = Math.abs(pos.row - center) + Math.abs(pos.col - center);
  score += (4 - distToCenter) * 5;

  // 挟める位置かチェック
  const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
  for (const dir of dirs) {
    const ar = pos.row + dir.dr;
    const ac = pos.col + dir.dc;
    if (ar < 0 || ar >= BOARD_SIZE || ac < 0 || ac >= BOARD_SIZE) continue;

    if (board[ar][ac] === opponent) {
      // 相手の駒の反対側が自分の駒なら挟める
      const br = ar + dir.dr;
      const bc = ac + dir.dc;
      if (br >= 0 && br < BOARD_SIZE && bc >= 0 && bc < BOARD_SIZE && board[br][bc] === player) {
        score += 50;
      }
    }
  }

  // 自分が挟まれるリスク
  for (const dir of dirs) {
    const ar = pos.row + dir.dr;
    const ac = pos.col + dir.dc;
    const br = pos.row - dir.dr;
    const bc = pos.col - dir.dc;
    if (ar >= 0 && ar < BOARD_SIZE && ac >= 0 && ac < BOARD_SIZE &&
        br >= 0 && br < BOARD_SIZE && bc >= 0 && bc < BOARD_SIZE) {
      if (board[ar][ac] === opponent && board[br][bc] === null) {
        score -= 15;
      }
    }
  }

  return score;
}

// AIの移動手を選択
interface AIMove {
  from: Position;
  to: Position;
  score: number;
}

function getAIMove(state: GameState, depth: number = 3): { from: Position; to: Position } | null {
  const aiPlayer = state.currentPlayer;
  const opponent: Player = aiPlayer === 'player1' ? 'player2' : 'player1';

  // 先手の最初の移動は中央へ
  const center = Math.floor(BOARD_SIZE / 2);
  const isFirst = state.phase === 'moving' &&
    state.capturedBy.player1 === 0 && state.capturedBy.player2 === 0 &&
    countPieces(state.board, 'player1') === PIECES_PER_PLAYER &&
    countPieces(state.board, 'player2') === PIECES_PER_PLAYER &&
    state.board[center][center] === null;

  if (isFirst && aiPlayer === 'player1') {
    // 中央に最も近い駒を探す
    let bestFrom: Position | null = null;
    let bestDist = Infinity;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (state.board[r][c] !== aiPlayer) continue;
        const moves = getValidMoves(state.board, { row: r, col: c });
        if (moves.some(m => m.row === center && m.col === center)) {
          const dist = Math.abs(r - center) + Math.abs(c - center);
          if (dist < bestDist) {
            bestDist = dist;
            bestFrom = { row: r, col: c };
          }
        }
      }
    }
    if (bestFrom) {
      return { from: bestFrom, to: { row: center, col: center } };
    }
  }

  // 全合法手を生成
  const allMoves: AIMove[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c] !== aiPlayer) continue;
      const moves = getValidMoves(state.board, { row: r, col: c });
      for (const move of moves) {
        // 先手の最初の移動で中央以外は無視
        if (isFirst && aiPlayer === 'player1' && !(move.row === center && move.col === center)) {
          continue;
        }

        // シミュレート
        const testBoard = state.board.map(row => [...row]);
        testBoard[r][c] = null;
        testBoard[move.row][move.col] = aiPlayer;
        const captures = getCaptures(testBoard, { row: move.row, col: move.col }, aiPlayer);
        let score = 0;

        // キャプチャをシミュレート
        const afterBoard = testBoard.map(row => [...row]);
        for (const cap of captures) {
          afterBoard[cap.row][cap.col] = null;
          score += 100;
        }

        // 追加探索
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

  // 最高スコアの手を選択
  allMoves.sort((a, b) => b.score - a.score);
  return { from: allMoves[0].from, to: allMoves[0].to };
}

function minimax(board: Board, depth: number, alpha: number, beta: number, maximizing: boolean, aiPlayer: Player): number {
  const opponent: Player = aiPlayer === 'player1' ? 'player2' : 'player1';
  const currentPlayer = maximizing ? aiPlayer : opponent;

  if (depth === 0) {
    return evaluate(board, aiPlayer);
  }

  // 駒数チェック
  const myPieces = countPieces(board, aiPlayer);
  const oppPieces = countPieces(board, opponent);
  if (oppPieces <= 1) return 10000;
  if (myPieces <= 1) return -10000;

  // 全合法手を生成
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
