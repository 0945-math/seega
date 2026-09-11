import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, Position, Piece, PieceType, Player, PIECE_NAMES, Move } from './game/types';
import { createInitialGameState, getValidMoves, getDropMoves, canPromote, mustPromote, applyMove, isInCheck } from './game/rules';
import { getAIMove } from './game/ai';

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [showPromotion, setShowPromotion] = useState<{ move: Move } | null>(null);
  const [selectedHandPiece, setSelectedHandPiece] = useState<PieceType | null>(null);
  const [difficulty, setDifficulty] = useState<number>(1);
  const [isThinking, setIsThinking] = useState(false);
  const [playerSide] = useState<Player>('sente');
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // AIの手番
  useEffect(() => {
    if (gameState.currentPlayer !== playerSide && !gameState.gameOver && !showPromotion) {
      setIsThinking(true);
      const timer = setTimeout(() => {
        const currentState = gameStateRef.current;
        const aiMove = getAIMove(currentState, difficulty);
        if (aiMove) {
          const newState = applyMove(currentState, aiMove);
          if (isInCheck(newState.board, newState.currentPlayer)) {
            newState.message = '王手！';
          } else {
            newState.message = 'あなたの番です';
          }
          setGameState(newState);
        }
        setIsThinking(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayer, gameState.gameOver, playerSide, difficulty, showPromotion]);

  // セルクリック
  const handleCellClick = useCallback((row: number, col: number) => {
    if (gameState.gameOver || gameState.currentPlayer !== playerSide || isThinking) return;

    const pos: Position = { row, col };
    const clickedPiece = gameState.board[row][col];

    // 持ち駒を打つモード
    if (selectedHandPiece) {
      const hand = playerSide === 'sente' ? gameState.senteHand : gameState.goteHand;
      const dropMoves = getDropMoves(gameState.board, hand, playerSide);
      const isValidDrop = dropMoves.some(d => d.pos.row === row && d.pos.col === col);

      if (isValidDrop) {
        const piece: Piece = { type: selectedHandPiece, player: playerSide, promoted: false };
        const move: Move = { from: { row: -1, col: -1 }, to: pos, piece, drop: true };
        const newState = applyMove(gameState, move);
        if (isInCheck(newState.board, newState.currentPlayer)) {
          newState.message = '王手！';
        } else {
          newState.message = '';
        }
        setGameState(newState);
      }
      setSelectedHandPiece(null);
      return;
    }

    // 既に自分の駒を選択している場合
    if (gameState.selectedPosition) {
      const isValidMove = gameState.validMoves.some(m => m.row === row && m.col === col);

      if (isValidMove) {
        const from = gameState.selectedPosition;
        const piece = gameState.board[from.row][from.col]!;
        const captured = gameState.board[row][col] || undefined;
        const canP = canPromote(piece, from, pos);
        const mustP = mustPromote(piece, pos);

        if (mustP) {
          const move: Move = { from, to: pos, piece, captured, promoted: true };
          const newState = applyMove(gameState, move);
          if (isInCheck(newState.board, newState.currentPlayer)) {
            newState.message = '王手！';
          } else {
            newState.message = '';
          }
          setGameState(newState);
        } else if (canP) {
          setShowPromotion({ move: { from, to: pos, piece, captured } });
        } else {
          const move: Move = { from, to: pos, piece, captured, promoted: false };
          const newState = applyMove(gameState, move);
          if (isInCheck(newState.board, newState.currentPlayer)) {
            newState.message = '王手！';
          } else {
            newState.message = '';
          }
          setGameState(newState);
        }
        return;
      }

      // 自分の別の駒をクリックした場合、選択を変更
      if (clickedPiece && clickedPiece.player === playerSide) {
        const hand = playerSide === 'sente' ? gameState.senteHand : gameState.goteHand;
        const moves = getValidMoves(gameState.board, pos, clickedPiece, hand);
        setGameState({
          ...gameState,
          selectedPosition: pos,
          validMoves: moves,
        });
        return;
      }

      // 選択解除
      setGameState({ ...gameState, selectedPosition: null, validMoves: [] });
      return;
    }

    // 新しい駒を選択
    if (clickedPiece && clickedPiece.player === playerSide) {
      const hand = playerSide === 'sente' ? gameState.senteHand : gameState.goteHand;
      const moves = getValidMoves(gameState.board, pos, clickedPiece, hand);
      setGameState({
        ...gameState,
        selectedPosition: pos,
        validMoves: moves,
      });
    }
  }, [gameState, playerSide, selectedHandPiece, isThinking]);

  // 成る/成らない選択
  const handlePromotion = useCallback((promote: boolean) => {
    if (!showPromotion) return;
    const { move } = showPromotion;
    const newMove: Move = { ...move, promoted: promote };
    const newState = applyMove(gameState, newMove);
    if (isInCheck(newState.board, newState.currentPlayer)) {
      newState.message = '王手！';
    } else {
      newState.message = '';
    }
    setGameState(newState);
    setShowPromotion(null);
  }, [showPromotion, gameState]);

  // 持ち駒クリック
  const handleHandPieceClick = useCallback((type: PieceType) => {
    if (gameState.gameOver || gameState.currentPlayer !== playerSide || isThinking) return;
    setSelectedHandPiece(selectedHandPiece === type ? null : type);
    setGameState({ ...gameState, selectedPosition: null, validMoves: [] });
  }, [gameState, playerSide, selectedHandPiece, isThinking]);

  // ゲームリセット
  const handleReset = useCallback(() => {
    setGameState(createInitialGameState());
    setShowPromotion(null);
    setSelectedHandPiece(null);
    setIsThinking(false);
  }, []);

  // 駒の表示名を取得
  const getPieceDisplay = (piece: Piece): string => {
    const name = piece.promoted ? PIECE_NAMES[piece.type].promoted : PIECE_NAMES[piece.type].normal;
    return name;
  };

  // 持ち駒の表示
  const renderHand = (hand: Map<PieceType, number>, player: Player, isPlayerHand: boolean) => {
    const pieces: PieceType[] = ['rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn'];
    const hasAny = pieces.some(t => (hand.get(t) || 0) > 0);

    return (
      <div className={`flex flex-wrap gap-1 ${isPlayerHand ? 'justify-end' : 'justify-start'}`}>
        {!hasAny && <span className="text-xs text-gray-400">なし</span>}
        {pieces.map(type => {
          const count = hand.get(type) || 0;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => isPlayerHand ? handleHandPieceClick(type) : undefined}
              className={`
                px-2 py-1 text-sm rounded border font-medium transition-all
                ${isPlayerHand && selectedHandPiece === type
                  ? 'bg-yellow-300 border-yellow-600 shadow-md scale-105'
                  : isPlayerHand
                    ? 'bg-white hover:bg-yellow-50 border-gray-300 cursor-pointer hover:border-yellow-400'
                    : 'bg-gray-50 border-gray-200 cursor-default'}
              `}
              disabled={!isPlayerHand}
            >
              <span className={player === 'gote' ? '' : ''}>{PIECE_NAMES[type].normal}</span>
              <span className="ml-0.5 text-xs">×{count}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const rowLabels = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex flex-col items-center py-3 px-2">
      {/* タイトル */}
      <h1 className="text-2xl sm:text-3xl font-bold text-amber-900 mb-2 flex items-center gap-2">
        <span>🏯</span>
        <span>将棋AI対戦</span>
      </h1>

      {/* 難易度選択 */}
      <div className="mb-3 flex items-center gap-2 flex-wrap justify-center">
        <span className="text-sm text-amber-800 font-medium">難易度:</span>
        {[
          { label: '簡単', value: 0 },
          { label: '普通', value: 1 },
          { label: '強い', value: 2 },
        ].map(d => (
          <button
            key={d.value}
            onClick={() => { setDifficulty(d.value); handleReset(); }}
            className={`px-3 py-1 text-sm rounded-full transition-all ${
              difficulty === d.value
                ? 'bg-amber-700 text-white shadow-md'
                : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-100'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* メッセージ */}
      <div className={`mb-2 px-4 py-2 rounded-lg text-center font-medium text-sm sm:text-base transition-all ${
        gameState.gameOver
          ? 'bg-red-100 text-red-800 border border-red-200'
          : gameState.message.includes('王手')
            ? 'bg-orange-100 text-orange-800 border border-orange-200 animate-pulse'
            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
      }`}>
        {gameState.gameOver
          ? (gameState.winner === playerSide ? '🎉 あなたの勝ち！' : '😢 AIの勝ち...')
          : isThinking
            ? '🤔 AIが考えています...'
            : selectedHandPiece
              ? `持ち駒「${PIECE_NAMES[selectedHandPiece].normal}」を盤面に打ってください`
              : gameState.message || 'あなたの番です（先手）'}
      </div>

      {/* 後手の持ち駒 */}
      <div className="mb-1 w-full max-w-lg px-2">
        <div className="text-xs text-amber-700 mb-0.5 font-medium">🤖 AI（後手）持ち駒:</div>
        {renderHand(gameState.goteHand, 'gote', false)}
      </div>

      {/* 将棋盤 */}
      <div className="relative my-1">
        <div className="bg-amber-100 border-4 border-amber-900 rounded shadow-2xl p-0.5">
          {/* 列番号 */}
          <div className="flex">
            <div className="w-5 sm:w-6"></div>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="w-9 h-4 sm:w-11 sm:h-5 flex items-center justify-center text-[10px] sm:text-xs text-amber-800 font-bold">
                {9 - i}
              </div>
            ))}
          </div>

          {/* 盤面 */}
          {Array.from({ length: 9 }, (_, row) => (
            <div key={row} className="flex">
              {/* 行番号 */}
              <div className="w-5 sm:w-6 h-9 sm:h-11 flex items-center justify-center text-[10px] sm:text-xs text-amber-800 font-bold">
                {rowLabels[row]}
              </div>
              {Array.from({ length: 9 }, (_, col) => {
                const piece = gameState.board[row][col];
                const isSelected = gameState.selectedPosition?.row === row && gameState.selectedPosition?.col === col;
                const isValidMove = gameState.validMoves.some(m => m.row === row && m.col === col);
                const isLastMove = gameState.moveHistory.length > 0 &&
                  (gameState.moveHistory[gameState.moveHistory.length - 1].to.row === row &&
                   gameState.moveHistory[gameState.moveHistory.length - 1].to.col === col);

                return (
                  <div
                    key={col}
                    onClick={() => handleCellClick(row, col)}
                    className={`
                      w-9 h-9 sm:w-11 sm:h-11 border border-amber-700/50 flex items-center justify-center
                      cursor-pointer relative transition-all duration-100
                      ${isSelected ? 'bg-yellow-300 shadow-inner' : ''}
                      ${isValidMove && !piece ? 'bg-green-200/70' : ''}
                      ${isValidMove && piece ? 'bg-red-100' : ''}
                      ${isLastMove && !isSelected && !isValidMove ? 'bg-blue-100/50' : ''}
                      ${!piece && !isValidMove && !isSelected ? 'hover:bg-amber-50' : ''}
                    `}
                  >
                    {piece && (
                      <span className={`
                        text-base sm:text-lg font-bold select-none leading-none
                        ${piece.player === 'sente' ? 'text-gray-900' : 'text-gray-800'}
                        ${piece.player === 'gote' ? 'rotate-180' : ''}
                        ${isSelected ? 'scale-110' : ''}
                        ${piece.promoted ? 'text-red-700' : ''}
                      `}>
                        {getPieceDisplay(piece)}
                      </span>
                    )}
                    {isValidMove && !piece && (
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 opacity-50"></div>
                    )}
                    {isValidMove && piece && (
                      <div className="absolute inset-0.5 border-2 border-red-400 rounded-sm opacity-70"></div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* 成りダイアログ */}
        {showPromotion && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded z-10 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-xl shadow-2xl border-2 border-amber-300">
              <p className="text-lg font-bold mb-4 text-center text-amber-900">成りますか？</p>
              <div className="flex gap-4">
                <button
                  onClick={() => handlePromotion(true)}
                  className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-bold shadow-lg transition-all hover:scale-105"
                >
                  成る
                </button>
                <button
                  onClick={() => handlePromotion(false)}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-bold shadow-lg transition-all hover:scale-105"
                >
                  成らない
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 先手の持ち駒 */}
      <div className="mt-2 w-full max-w-lg px-2">
        <div className="text-xs text-amber-700 mb-0.5 font-medium">👤 あなた（先手）持ち駒:</div>
        {renderHand(gameState.senteHand, 'sente', true)}
      </div>

      {/* リセットボタン */}
      <button
        onClick={handleReset}
        className="mt-3 px-6 py-2.5 bg-amber-700 text-white rounded-full hover:bg-amber-800 font-medium shadow-lg transition-all hover:scale-105 active:scale-95"
      >
        🔄 新しいゲーム
      </button>

      {/* 操作説明 */}
      <div className="mt-4 text-xs sm:text-sm text-amber-700 text-center max-w-md bg-amber-50 rounded-lg p-3 border border-amber-200">
        <p className="font-bold mb-1">📖 操作方法</p>
        <p>• 駒をクリックして選択 → 移動先をクリック</p>
        <p>• 持ち駒をクリック → 盤面の打てる場所に打つ</p>
        <p>• <span className="inline-block w-2 h-2 rounded-full bg-green-500 opacity-50 mr-1"></span>緑=移動可能 <span className="inline-block w-2 h-2 border border-red-400 mr-1"></span>赤枠=取れる駒</p>
      </div>
    </div>
  );
}

export default App;
