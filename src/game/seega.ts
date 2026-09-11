// シーガ（Seega）ゲームロジック - 修正版
// 古代エジプトの挟み棋ゲーム

export type Player = 'player1' | 'player2';
export type Cell = Player | null;
export type Board = Cell[][];
export type Phase = 'placing' | 'moving';

export interface Position { row: number; col: number; }
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
  piecesPlacedThisTurn: number;
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
  const initialBoard: Board = [
    ['player1', 'player2', 'player1', 'player2', 'player1'],
    ['player2', 'player1', 'player2', 'player1', 'player2'],
    ['player2', 'player1', null, 'player2', 'player1'],
    ['player1', 'player2', 'player1', 'player2', 'player1'],
    ['player2', 'player1', 'player2', 'player1', 'player2'],
  ];
  return {
    board: initialBoard, currentPlayer: 'player1', phase: 'moving',
    piecesPlacedThisTurn: 0, totalPlaced: { player1: 12, player2: 12 },
    selectedPos: null, validMoves: [], capturedBy: { player1: 0, player2: 0 },
    gameOver: false, winner: null,
    message: '移動フェーズ開始！あなたの最初の一手は中央へ',
    canCapture: false, moveHistory: [], lastMove: null, capturedPositions: [],
  };
}

export function isCenter(pos: Position): boolean {
  const center = Math.floor(BOARD_SIZE / 2);
  return pos.row === center && pos.col === center;
}

export function canPlace(state: GameState, pos: Position): boolean {
  return state.phase === 'placing' &&
    state.board[pos.row][pos.col] === null &&
    !isCenter(pos);
}

export function placePiece(state: GameState, pos: Position): GameState {
  if (!canPlace(state, pos)) return state;
  const newBoard = state.board.map(row => [...row]);
  newBoard[pos.row][pos.col] = state.currentPlayer;
  const newTotalPlaced = { ...state.totalPlaced };
  newTotalPlaced[state.currentPlayer]++;
  const placedThisTurn = state.piecesPlacedThisTurn + 1;
  const nextPlayer: Player = state.currentPlayer === 'player1' ? 'player2' : 'player1';
  const allPlaced = newTotalPlaced.player1 >= PIECES_PER_PLAYER && newTotalPlaced.player2 >= PIECES_PER_PLAYER;
  const switchTurn = placedThisTurn >= 2 || allPlaced;
  return {
    ...state, board: newBoard, totalPlaced: newTotalPlaced,
    piecesPlacedThisTurn: switchTurn ? 0 : placedThisTurn,
    currentPlayer: switchTurn ? nextPlayer : state.currentPlayer,
    phase: allPlaced ? 'moving' : state.phase,
    message: allPlaced ? '移動フェーズ開始！先手の最初の一手は中央へ'
      : switchTurn ? `${nextPlayer === 'player1' ? 'あなた' : 'AI'}の駒を2個置いてください` : 'あと1個置いてください',
    selectedPos: null, validMoves: [],
    moveHistory: [...state.moveHistory, { type: 'place', player: state.currentPlayer, to: pos }],
    lastMove: { to: pos }, capturedPositions: [],
  };
}

export function getValidMoves(board: Board, pos: Position): Position[] {
  const moves: Position[] = [];
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const r = pos.row + dr, c = pos.col + dc;
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === null) moves.push({row:r,col:c});
  }
  return moves;
}

export function getCaptures(board: Board, pos: Position, player: Player): Position[] {
  const captures: Position[] = [];
  const opponent = player === 'player1' ? 'player2' : 'player1';
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const ar = pos.row + dr, ac = pos.col + dc;
    const br = pos.row + 2*dr, bc = pos.col + 2*dc;
    if (ar < 0 || ar >= BOARD_SIZE || ac < 0 || ac >= BOARD_SIZE ||
        br < 0 || br >= BOARD_SIZE || bc < 0 || bc >= BOARD_SIZE) continue;
    if (board[ar][ac] === opponent && board[br][bc] === player) captures.push({row:ar,col:ac});
  }
  return captures;
}

export function movePiece(state: GameState, from: Position, to: Position): GameState {
  const board = state.board.map(row => [...row]);
  const player = state.currentPlayer;
  board[from.row][from.col] = null;
  board[to.row][to.col] = player;
  const captures = getCaptures(board, to, player);
  const capturedBy = {...state.capturedBy};
  for (const cap of captures) { board[cap.row][cap.col] = null; capturedBy[player]++; }

  const opponent = player === 'player1' ? 'player2' : 'player1';
  const gameOver = countPieces(board, opponent) <= 1;
  const winner = gameOver ? player : null;
  const canContinue = captures.length > 0 && !gameOver && hasAnyCapturePossible(board, player);

  return {
    ...state, board, currentPlayer: canContinue ? player : opponent,
    selectedPos: null, validMoves: [], capturedBy, gameOver, winner,
    message: gameOver ? (player === 'player1' ? '🎉 あなたの勝ち！' : '😢 AIの勝ち...')
      : canContinue ? `連続キャプチャ！${captures.length}個取った！もう一度移動できます`
      : opponent === 'player1' ? 'あなたの番です' : 'AIの番です',
    canCapture: canContinue,
    moveHistory: [...state.moveHistory, { type:'move', player, from, to, captured: captures.length ? captures : undefined }],
    lastMove: {from,to}, capturedPositions: captures,
  };
}

export function countPieces(board: Board, player: Player): number {
  return board.flat().filter(cell => cell === player).length;
}

function hasAnyCapturePossible(board: Board, player: Player): boolean {
  for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) {
    if (board[r][c] !== player) continue;
    for (const to of getValidMoves(board,{row:r,col:c})) {
      const test = board.map(row=>[...row]);
      test[r][c]=null; test[to.row][to.col]=player;
      if (getCaptures(test,to,player).length) return true;
    }
  }
  return false;
}

export function isFirstMove(state: GameState): boolean {
  return state.phase === 'moving' &&
    state.capturedBy.player1 === 0 && state.capturedBy.player2 === 0 &&
    countPieces(state.board,'player1') === PIECES_PER_PLAYER &&
    countPieces(state.board,'player2') === PIECES_PER_PLAYER &&
    state.board[Math.floor(BOARD_SIZE/2)][Math.floor(BOARD_SIZE/2)] === null;
}

function evaluate(board: Board, aiPlayer: Player): number {
  const opponent = aiPlayer === 'player1' ? 'player2' : 'player1';
  const myPieces=countPieces(board,aiPlayer), oppPieces=countPieces(board,opponent);
  let score=(myPieces-oppPieces)*100;
  if (oppPieces<=1) return 10000;
  if (myPieces<=1) return -10000;
  const center=Math.floor(BOARD_SIZE/2);
  if (board[center][center]===aiPlayer) score+=80;
  if (board[center][center]===opponent) score-=80;
  for(let r=0;r<BOARD_SIZE;r++) for(let c=0;c<BOARD_SIZE;c++){
    if(board[r][c]===null) continue;
    const bonus=(4-(Math.abs(r-center)+Math.abs(c-center)))*8;
    score += board[r][c]===aiPlayer ? bonus : -bonus;
  }
  return score;
}

function getAIPlacement(state: GameState): Position {
  const ai=state.currentPlayer, center=Math.floor(BOARD_SIZE/2);
  let best:Position|null=null,bestScore=-Infinity;
  for(let r=0;r<BOARD_SIZE;r++) for(let c=0;c<BOARD_SIZE;c++){
    if(state.board[r][c]!==null || (r===center&&c===center)) continue;
    const test=state.board.map(row=>[...row]); test[r][c]=ai;
    const score=evaluate(test,ai);
    if(score>bestScore){bestScore=score;best={row:r,col:c};}
  }
  return best || {row:0,col:0};
}

function getAIMove(state: GameState, depth=5): {from:Position;to:Position}|null {
  const ai=state.currentPlayer, center=Math.floor(BOARD_SIZE/2);
  const first=isFirstMove(state);
  if(first){
    for(let r=0;r<BOARD_SIZE;r++) for(let c=0;c<BOARD_SIZE;c++) if(state.board[r][c]===ai){
      const moves=getValidMoves(state.board,{row:r,col:c});
      if(moves.some(m=>m.row===center&&m.col===center)) return {from:{row:r,col:c},to:{row:center,col:center}};
    }
  }
  const moves:{from:Position;to:Position;score:number}[]=[];
  for(let r=0;r<BOARD_SIZE;r++) for(let c=0;c<BOARD_SIZE;c++) if(state.board[r][c]===ai){
    for(const to of getValidMoves(state.board,{row:r,col:c})){
      if(first && !(to.row===center&&to.col===center)) continue;
      const test=state.board.map(row=>[...row]); test[r][c]=null; test[to.row][to.col]=ai;
      const caps=getCaptures(test,to,ai); for(const cap of caps)test[cap.row][cap.col]=null;
      const score=caps.length*250+(depth>0?minimax(test,depth-1,-Infinity,Infinity,false,ai):evaluate(test,ai));
      moves.push({from:{row:r,col:c},to,score});
    }
  }
  if(!moves.length) return null;
  moves.sort((a,b)=>b.score-a.score);
  return {from:moves[0].from,to:moves[0].to};
}

function minimax(board:Board,depth:number,alpha:number,beta:number,maximizing:boolean,ai:Player):number{
  const opponent=ai==='player1'?'player2':'player1';
  if(depth===0)return evaluate(board,ai);
  const current=maximizing?ai:opponent;
  let best=maximizing?-Infinity:Infinity;
  for(let r=0;r<BOARD_SIZE;r++)for(let c=0;c<BOARD_SIZE;c++)if(board[r][c]===current){
    for(const to of getValidMoves(board,{row:r,col:c})){
      const test=board.map(row=>[...row]);test[r][c]=null;test[to.row][to.col]=current;
      for(const cap of getCaptures(test,to,current))test[cap.row][cap.col]=null;
      const v=minimax(test,depth-1,alpha,beta,!maximizing,ai);
      if(maximizing){best=Math.max(best,v);alpha=Math.max(alpha,v);}else{best=Math.min(best,v);beta=Math.min(beta,v);}
      if(beta<=alpha)return best;
    }
  }
  return best;
}

export function getHint(state:GameState):{from?:Position;to:Position}|null{
  return state.phase==='placing'?{to:getAIPlacement(state)}:state.phase==='moving'?getAIMove(state,3):null;
}
export {getAIPlacement,getAIMove};
