// 駒の種類
export type PieceType = 'king' | 'rook' | 'bishop' | 'gold' | 'silver' | 'knight' | 'lance' | 'pawn';

// 駒のプレイヤー
export type Player = 'sente' | 'gote'; // 先手・後手

// 駒
export interface Piece {
  type: PieceType;
  player: Player;
  promoted: boolean;
}

// 盤面の位置
export interface Position {
  row: number; // 0-8 (上から下)
  col: number; // 0-8 (右から左、将棋の表記に合わせる)
}

// 盤面のセル
export type Cell = Piece | null;

// 盤面 (9x9)
export type Board = Cell[][];

// 指し手
export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captured?: Piece;
  promoted?: boolean;
  drop?: boolean; // 持ち駒を打つ場合
}

// 持ち駒
export type HandPieces = Map<PieceType, number>;

// ゲーム状態
export interface GameState {
  board: Board;
  currentPlayer: Player;
  senteHand: HandPieces;
  goteHand: HandPieces;
  moveHistory: Move[];
  gameOver: boolean;
  winner: Player | null;
  selectedPosition: Position | null;
  validMoves: Position[];
  message: string;
}

// 駒の名前（日本語）
export const PIECE_NAMES: Record<PieceType, { normal: string; promoted: string }> = {
  king: { normal: '王', promoted: '王' },
  rook: { normal: '飛', promoted: '龍' },
  bishop: { normal: '角', promoted: '馬' },
  gold: { normal: '金', promoted: '金' },
  silver: { normal: '銀', promoted: '成銀' },
  knight: { normal: '桂', promoted: '成桂' },
  lance: { normal: '香', promoted: '成香' },
  pawn: { normal: '歩', promoted: 'と' },
};
