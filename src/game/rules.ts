import { Board, Cell, GameState, HandPieces, Move, Piece, PieceType, Player, Position } from './types';

// 初期盤面の作成
export function createInitialBoard(): Board {
  const board: Board = Array(9).fill(null).map(() => Array(9).fill(null));

  // 後手（上側、gote）の配置 - row 0が最上段
  board[0][0] = { type: 'lance', player: 'gote', promoted: false };
  board[0][1] = { type: 'knight', player: 'gote', promoted: false };
  board[0][2] = { type: 'silver', player: 'gote', promoted: false };
  board[0][3] = { type: 'gold', player: 'gote', promoted: false };
  board[0][4] = { type: 'king', player: 'gote', promoted: false };
  board[0][5] = { type: 'gold', player: 'gote', promoted: false };
  board[0][6] = { type: 'silver', player: 'gote', promoted: false };
  board[0][7] = { type: 'knight', player: 'gote', promoted: false };
  board[0][8] = { type: 'lance', player: 'gote', promoted: false };
  board[1][1] = { type: 'rook', player: 'gote', promoted: false };
  board[1][7] = { type: 'bishop', player: 'gote', promoted: false };
  for (let i = 0; i < 9; i++) {
    board[2][i] = { type: 'pawn', player: 'gote', promoted: false };
  }

  // 先手（下側、sente）の配置 - row 8が最下段
  board[8][0] = { type: 'lance', player: 'sente', promoted: false };
  board[8][1] = { type: 'knight', player: 'sente', promoted: false };
  board[8][2] = { type: 'silver', player: 'sente', promoted: false };
  board[8][3] = { type: 'gold', player: 'sente', promoted: false };
  board[8][4] = { type: 'king', player: 'sente', promoted: false };
  board[8][5] = { type: 'gold', player: 'sente', promoted: false };
  board[8][6] = { type: 'silver', player: 'sente', promoted: false };
  board[8][7] = { type: 'knight', player: 'sente', promoted: false };
  board[8][8] = { type: 'lance', player: 'sente', promoted: false };
  board[7][7] = { type: 'rook', player: 'sente', promoted: false };
  board[7][1] = { type: 'bishop', player: 'sente', promoted: false };
  for (let i = 0; i < 9; i++) {
    board[6][i] = { type: 'pawn', player: 'sente', promoted: false };
  }

  return board;
}

// 初期ゲーム状態の作成
export function createInitialGameState(): GameState {
  return {
    board: createInitialBoard(),
    currentPlayer: 'sente',
    senteHand: new Map(),
    goteHand: new Map(),
    moveHistory: [],
    gameOver: false,
    winner: null,
    selectedPosition: null,
    validMoves: [],
    message: 'あなたの番です（先手）',
  };
}

// 方向ベクトルの型
interface Dir {
  dr: number;
  dc: number;
}

// 各駒の動きを直接定義
// 先手の前進 = row減少方向（上方向）、後手の前進 = row増加方向（下方向）
// ここでは「相対方向」を定義: dr=-1は自陣から敵陣方向（前進）
function getRelativeMoves(piece: Piece): { steps: Dir[]; slides: Dir[] } {
  const type = piece.type;
  const promoted = piece.promoted;

  // 金相当の動き（金将、または成り駒）
  const goldMoves: Dir[] = [
    { dr: -1, dc: 0 },  // 前
    { dr: -1, dc: -1 }, // 前左
    { dr: -1, dc: 1 },  // 前右
    { dr: 0, dc: -1 },  // 左
    { dr: 0, dc: 1 },   // 右
    { dr: 1, dc: 0 },   // 後
  ];

  if (type === 'king') {
    return {
      steps: [
        { dr: -1, dc: 0 }, { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
        { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
        { dr: 1, dc: 0 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 },
      ],
      slides: [],
    };
  }

  if (type === 'gold' || promoted) {
    return { steps: goldMoves, slides: [] };
  }

  if (type === 'silver') {
    return {
      steps: [
        { dr: -1, dc: 0 }, { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
        { dr: 1, dc: -1 }, { dr: 1, dc: 1 },
      ],
      slides: [],
    };
  }

  if (type === 'knight') {
    return {
      steps: [{ dr: -2, dc: -1 }, { dr: -2, dc: 1 }],
      slides: [],
    };
  }

  if (type === 'pawn') {
    return { steps: [{ dr: -1, dc: 0 }], slides: [] };
  }

  if (type === 'lance') {
    return { steps: [], slides: [{ dr: -1, dc: 0 }] };
  }

  if (type === 'rook') {
    return {
      steps: [],
      slides: [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }],
    };
  }

  if (type === 'bishop') {
    return {
      steps: [],
      slides: [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }],
    };
  }

  return { steps: [], slides: [] };
}

// 相対方向を絶対方向に変換
// 先手(sente): 前進=row減少(dr=-1→dr=-1)、左=col増加(dc=-1→dc=+1)
// 後手(gote): 前進=row増加(dr=-1→dr=+1)、左=col減少(dc=-1→dc=-1)
function toAbsoluteDir(dir: Dir, player: Player): { dr: number; dc: number } {
  if (player === 'sente') {
    return { dr: dir.dr, dc: -dir.dc }; // 先手: drそのまま、dc反転
  } else {
    return { dr: -dir.dr, dc: dir.dc }; // 後手: dr反転、dcそのまま
  }
}

// 合法手の生成
export function getValidMoves(board: Board, pos: Position, piece: Piece, _hand: HandPieces): Position[] {
  const moves: Position[] = [];
  const { steps, slides } = getRelativeMoves(piece);
  const player = piece.player;

  // 1マス動き
  for (const dir of steps) {
    const abs = toAbsoluteDir(dir, player);
    const r = pos.row + abs.dr;
    const c = pos.col + abs.dc;
    if (r >= 0 && r < 9 && c >= 0 && c < 9) {
      const target = board[r][c];
      if (target === null || target.player !== player) {
        moves.push({ row: r, col: c });
      }
    }
  }

  // 飛び動き
  for (const dir of slides) {
    const abs = toAbsoluteDir(dir, player);
    let r = pos.row + abs.dr;
    let c = pos.col + abs.dc;
    while (r >= 0 && r < 9 && c >= 0 && c < 9) {
      const target = board[r][c];
      if (target === null) {
        moves.push({ row: r, col: c });
      } else if (target.player !== player) {
        moves.push({ row: r, col: c });
        break;
      } else {
        break;
      }
      r += abs.dr;
      c += abs.dc;
    }
  }

  // 龍王（成り飛車）: 飛車の動き + 斜め1マス
  if (type_is(piece.type, 'rook') && piece.promoted) {
    const diagSteps: Dir[] = [
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }
    ];
    for (const dir of diagSteps) {
      const abs = toAbsoluteDir(dir, player);
      const r = pos.row + abs.dr;
      const c = pos.col + abs.dc;
      if (r >= 0 && r < 9 && c >= 0 && c < 9) {
        const target = board[r][c];
        if (target === null || target.player !== player) {
          // 既に追加されていないか確認
          if (!moves.some(m => m.row === r && m.col === c)) {
            moves.push({ row: r, col: c });
          }
        }
      }
    }
  }

  // 龍馬（成り角）: 角の動き + 直線1マス
  if (type_is(piece.type, 'bishop') && piece.promoted) {
    const straightSteps: Dir[] = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
    ];
    for (const dir of straightSteps) {
      const abs = toAbsoluteDir(dir, player);
      const r = pos.row + abs.dr;
      const c = pos.col + abs.dc;
      if (r >= 0 && r < 9 && c >= 0 && c < 9) {
        const target = board[r][c];
        if (target === null || target.player !== player) {
          if (!moves.some(m => m.row === r && m.col === c)) {
            moves.push({ row: r, col: c });
          }
        }
      }
    }
  }

  return moves;
}

// 型チェックヘルパー
function type_is(type: PieceType, check: PieceType): boolean {
  return type === check;
}

// 持ち駒を打つ合法手
export function getDropMoves(board: Board, hand: HandPieces, player: Player): { pos: Position; type: PieceType }[] {
  const moves: { pos: Position; type: PieceType }[] = [];

  for (const [type, count] of hand.entries()) {
    if (count <= 0) continue;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== null) continue;

        // 歩・香は最奥段に打てない
        if (type === 'pawn' || type === 'lance') {
          if (player === 'sente' && r === 0) continue;
          if (player === 'gote' && r === 8) continue;
        }
        // 桂は最奥2段に打てない
        if (type === 'knight') {
          if (player === 'sente' && r <= 1) continue;
          if (player === 'gote' && r >= 7) continue;
        }
        // 二歩チェック
        if (type === 'pawn') {
          let hasPawn = false;
          for (let row = 0; row < 9; row++) {
            const cell = board[row][c];
            if (cell && cell.type === 'pawn' && cell.player === player && !cell.promoted) {
              hasPawn = true;
              break;
            }
          }
          if (hasPawn) continue;
        }

        moves.push({ pos: { row: r, col: c }, type });
      }
    }
  }

  return moves;
}

// 成れるかどうか
export function canPromote(piece: Piece, from: Position, to: Position): boolean {
  if (piece.promoted) return false;
  if (piece.type === 'king' || piece.type === 'gold') return false;

  const player = piece.player;
  if (player === 'sente') {
    // 先手：row 0-2が敵陣（上側）
    return from.row <= 2 || to.row <= 2;
  } else {
    // 後手：row 6-8が敵陣（下側）
    return from.row >= 6 || to.row >= 6;
  }
}

// 必ず成らないといけないか
export function mustPromote(piece: Piece, to: Position): boolean {
  if (piece.type === 'pawn' || piece.type === 'lance') {
    if (piece.player === 'sente' && to.row === 0) return true;
    if (piece.player === 'gote' && to.row === 8) return true;
  }
  if (piece.type === 'knight') {
    if (piece.player === 'sente' && to.row <= 1) return true;
    if (piece.player === 'gote' && to.row >= 7) return true;
  }
  return false;
}

// 指し手を適用
export function applyMove(state: GameState, move: Move): GameState {
  const newBoard = state.board.map(row => row.map(cell => cell ? { ...cell } : null));
  const newSenteHand = new Map(state.senteHand);
  const newGoteHand = new Map(state.goteHand);

  if (move.drop) {
    // 持ち駒を打つ
    newBoard[move.to.row][move.to.col] = { ...move.piece };
    const hand = move.piece.player === 'sente' ? newSenteHand : newGoteHand;
    const count = hand.get(move.piece.type) || 0;
    if (count <= 1) {
      hand.delete(move.piece.type);
    } else {
      hand.set(move.piece.type, count - 1);
    }
  } else {
    // 盤面の駒を移動
    newBoard[move.from.row][move.from.col] = null;
    const piece = { ...move.piece };

    if (move.promoted) {
      piece.promoted = true;
    }

    if (move.captured) {
      // 持ち駒に加える（成り駒は元に戻す）
      const capturedType = move.captured.type;
      const hand = move.piece.player === 'sente' ? newSenteHand : newGoteHand;
      hand.set(capturedType, (hand.get(capturedType) || 0) + 1);
    }

    newBoard[move.to.row][move.to.col] = piece;
  }

  const nextPlayer: Player = state.currentPlayer === 'sente' ? 'gote' : 'sente';

  // 王が取られたかチェック
  let winner: Player | null = null;
  let gameOver = false;
  let kingExists = { sente: false, gote: false };
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = newBoard[r][c];
      if (cell && cell.type === 'king') {
        kingExists[cell.player] = true;
      }
    }
  }
  if (!kingExists.sente) { winner = 'gote'; gameOver = true; }
  if (!kingExists.gote) { winner = 'sente'; gameOver = true; }

  return {
    ...state,
    board: newBoard,
    currentPlayer: nextPlayer,
    senteHand: newSenteHand,
    goteHand: newGoteHand,
    moveHistory: [...state.moveHistory, move],
    gameOver,
    winner,
    selectedPosition: null,
    validMoves: [],
  };
}

// 王手がかかっているかチェック
export function isInCheck(board: Board, player: Player): boolean {
  // 自玉の位置を探す
  let kingPos: Position | null = null;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = board[r][c];
      if (cell && cell.type === 'king' && cell.player === player) {
        kingPos = { row: r, col: c };
        break;
      }
    }
    if (kingPos) break;
  }

  if (!kingPos) return false;

  // 相手の駒が王を取れるかチェック
  const opponent: Player = player === 'sente' ? 'gote' : 'sente';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = board[r][c];
      if (cell && cell.player === opponent) {
        const moves = getValidMoves(board, { row: r, col: c }, cell, new Map());
        if (moves.some(m => m.row === kingPos!.row && m.col === kingPos!.col)) {
          return true;
        }
      }
    }
  }

  return false;
}

// 合法手かどうか（王手を放置しない）
export function isLegalMove(state: GameState, move: Move): boolean {
  const newState = applyMove(state, move);
  // 移動後に自分の王に王手がかかっていないか
  return !isInCheck(newState.board, state.currentPlayer);
}
