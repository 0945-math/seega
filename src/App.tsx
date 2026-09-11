import { useState, useCallback, useEffect, useRef } from 'react';
import {
  GameState,
  Position,
  Player,
  createInitialState,
  canPlace,
  placePiece,
  getValidMoves,
  movePiece,
  countPieces,
  hasAnyValidMove,
  getAIPlacement,
  getAIMove,
  isFirstMove,
} from './game/seega';

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [difficulty, setDifficulty] = useState<number>(2);
  const [isThinking, setIsThinking] = useState(false);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const playerSide: Player = 'player1';
  const aiSide: Player = 'player2';

  // AIのターン処理
  useEffect(() => {
    if (gameState.gameOver) return;
    if (gameState.currentPlayer !== aiSide) return;

    setIsThinking(true);
    const timer = setTimeout(() => {
      const state = gameStateRef.current;

      if (state.phase === 'placing') {
        // 配置フェーズ - 2個ずつ配置
        const placements = getAIPlacement(state);
        let newState = state;
        for (const pos of placements) {
          newState = placePiece(newState, pos);
        }
        newState.message = '配置フェーズ：あなたの駒を置いてください（2個/ターン）';
        setGameState(newState);
      } else if (state.phase === 'moving') {
        // 移動フェーズ
        const aiMove = getAIMove(state, difficulty);
        if (aiMove) {
          let newState = movePiece(state, aiMove.from, aiMove.to);
          // 連続キャプチャ処理
          let captureCount = 0;
          while (newState.canCapture && newState.currentPlayer === aiSide && !newState.gameOver && captureCount < 5) {
            const nextMove = getAIMove(newState, difficulty);
            if (nextMove) {
              newState = movePiece(newState, nextMove.from, nextMove.to);
              captureCount++;
            } else {
              break;
            }
          }
          if (!newState.gameOver && newState.currentPlayer === playerSide) {
            newState.message = 'あなたの番です';
          }
          setGameState(newState);
        }
      }

      setIsThinking(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [gameState.currentPlayer, gameState.gameOver, gameState.phase, aiSide, playerSide, difficulty]);

  // セルクリック
  const handleCellClick = useCallback((row: number, col: number) => {
    if (gameState.gameOver || isThinking) return;
    if (gameState.currentPlayer !== playerSide) return;

    const pos: Position = { row, col };

    if (gameState.phase === 'placing') {
      // 配置フェーズ
      if (canPlace(gameState, pos)) {
        const newState = placePiece(gameState, pos);
        if (newState.currentPlayer === playerSide && newState.piecesPlacedThisTurn === 1) {
          newState.message = 'あと1個置いてください';
        }
        setGameState(newState);
      }
      return;
    }

    if (gameState.phase === 'moving') {
      // 移動フェーズ
      const clickedPiece = gameState.board[row][col];

      // 連続キャプチャ中は選択中の駒を移動させるだけ
      if (gameState.canCapture) {
        if (gameState.selectedPos) {
          const isValid = gameState.validMoves.some(m => m.row === row && m.col === col);
          if (isValid) {
            const newState = movePiece(gameState, gameState.selectedPos, pos);
            setGameState(newState);
            return;
          }
        }
        // 別の自分の駒を選択
        if (clickedPiece === playerSide) {
          const moves = getValidMoves(gameState.board, pos);
          if (moves.length > 0) {
            setGameState({ ...gameState, selectedPos: pos, validMoves: moves });
          }
        }
        return;
      }

      // 通常移動
      if (gameState.selectedPos) {
        const isValid = gameState.validMoves.some(m => m.row === row && m.col === col);
        if (isValid) {
          // 先手の最初の移動は中央のみ
          if (isFirstMove(gameState) && playerSide === 'player1') {
            const center = Math.floor(5 / 2);
            if (row !== center || col !== center) {
              setGameState({ ...gameState, message: '最初の一手は中央に移動してください' });
              return;
            }
          }
          const newState = movePiece(gameState, gameState.selectedPos, pos);
          setGameState(newState);
          return;
        }
        // 別の自分の駒を選択
        if (clickedPiece === playerSide) {
          const moves = getValidMoves(gameState.board, pos);
          setGameState({ ...gameState, selectedPos: pos, validMoves: moves });
          return;
        }
        // 選択解除
        setGameState({ ...gameState, selectedPos: null, validMoves: [] });
        return;
      }

      // 新しい駒を選択
      if (clickedPiece === playerSide) {
        const moves = getValidMoves(gameState.board, pos);
        if (moves.length > 0) {
          setGameState({ ...gameState, selectedPos: pos, validMoves: moves });
        }
      }
    }
  }, [gameState, playerSide, aiSide, isThinking]);

  // ゲームリセット
  const handleReset = useCallback(() => {
    setGameState(createInitialState());
    setIsThinking(false);
  }, []);

  const center = Math.floor(5 / 2);
  const p1Count = countPieces(gameState.board, 'player1');
  const p2Count = countPieces(gameState.board, 'player2');

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-800 via-amber-900 to-yellow-900 flex flex-col items-center py-4 px-2">
      {/* タイトル */}
      <h1 className="text-2xl sm:text-3xl font-bold text-amber-100 mb-1 flex items-center gap-2">
        <span>🏺</span>
        <span>シーガ (Seega)</span>
      </h1>
      <p className="text-xs text-amber-300 mb-3">古代エジプトの伝統的な挟み棋ゲーム</p>

      {/* 難易度選択 */}
      <div className="mb-3 flex items-center gap-2 flex-wrap justify-center">
        <span className="text-sm text-amber-200 font-medium">AI強さ:</span>
        {[
          { label: '弱い', value: 1 },
          { label: '普通', value: 2 },
          { label: '強い', value: 3 },
        ].map(d => (
          <button
            key={d.value}
            onClick={() => { setDifficulty(d.value); handleReset(); }}
            className={`px-3 py-1 text-sm rounded-full transition-all ${
              difficulty === d.value
                ? 'bg-amber-200 text-amber-900 shadow-md font-bold'
                : 'bg-amber-800/50 text-amber-200 border border-amber-600 hover:bg-amber-700/50'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* スコア表示 */}
      <div className="flex gap-6 mb-2 text-sm">
        <div className="text-center">
          <div className="text-amber-300 font-medium">あなた (白)</div>
          <div className="text-2xl font-bold text-white">{p1Count}</div>
          <div className="text-xs text-amber-400">取った: {gameState.capturedBy.player1}</div>
        </div>
        <div className="text-center">
          <div className="text-amber-300 font-medium">AI (黒)</div>
          <div className="text-2xl font-bold text-white">{p2Count}</div>
          <div className="text-xs text-amber-400">取った: {gameState.capturedBy.player2}</div>
        </div>
      </div>

      {/* メッセージ */}
      <div className={`mb-3 px-4 py-2 rounded-lg text-center font-medium text-sm transition-all ${
        gameState.gameOver
          ? gameState.winner === playerSide
            ? 'bg-green-200 text-green-900 border border-green-400'
            : 'bg-red-200 text-red-900 border border-red-400'
          : gameState.phase === 'placing'
            ? 'bg-blue-100 text-blue-900 border border-blue-300'
            : 'bg-amber-100 text-amber-900 border border-amber-300'
      }`}>
        {gameState.gameOver
          ? (gameState.winner === playerSide ? '🎉 あなたの勝ち！' : '😢 AIの勝ち...')
          : isThinking
            ? '🤔 AIが考えています...'
            : gameState.message}
      </div>

      {/* 盤面 */}
      <div className="relative bg-amber-700 p-3 rounded-xl shadow-2xl border-4 border-amber-600">
        {/* 碁盤風グリッド */}
        <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(5, 1fr)` }}>
          {Array.from({ length: 25 }, (_, idx) => {
            const row = Math.floor(idx / 5);
            const col = idx % 5;
            const cell = gameState.board[row][col];
            const isCenterCell = row === center && col === center;
            const isSelected = gameState.selectedPos?.row === row && gameState.selectedPos?.col === col;
            const isValidMove = gameState.validMoves.some(m => m.row === row && m.col === col);
            const canPlaceHere = gameState.phase === 'placing' && gameState.currentPlayer === playerSide && canPlace(gameState, { row, col });

            return (
              <div
                key={idx}
                onClick={() => handleCellClick(row, col)}
                className={`
                  w-14 h-14 sm:w-16 sm:h-16 border border-amber-900/40
                  flex items-center justify-center relative cursor-pointer
                  transition-all duration-100
                  ${isCenterCell ? 'bg-amber-500/30' : 'bg-amber-600/50'}
                  ${isSelected ? 'bg-yellow-400/50 ring-2 ring-yellow-300' : ''}
                  ${isValidMove ? 'bg-green-400/40' : ''}
                  ${canPlaceHere && !cell ? 'bg-blue-300/30 hover:bg-blue-300/50' : ''}
                  ${!cell && !isValidMove && !canPlaceHere ? 'hover:bg-amber-500/30' : ''}
                `}
              >
                {/* 中央マーク */}
                {isCenterCell && !cell && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-amber-400/50"></div>
                  </div>
                )}

                {/* 駒 */}
                {cell && (
                  <div className={`
                    w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-lg flex items-center justify-center
                    transition-transform duration-150
                    ${cell === 'player1'
                      ? 'bg-gradient-to-br from-white to-gray-200 border-2 border-gray-300'
                      : 'bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-600'}
                    ${isSelected ? 'scale-110' : ''}
                    ${isValidMove ? 'ring-2 ring-red-400' : ''}
                  `}>
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${
                      cell === 'player1' ? 'bg-gray-300' : 'bg-gray-500'
                    }`}></div>
                  </div>
                )}

                {/* 有効手インジケータ */}
                {isValidMove && !cell && (
                  <div className="w-4 h-4 rounded-full bg-green-400 opacity-60 animate-pulse"></div>
                )}
                {canPlaceHere && !cell && gameState.phase === 'placing' && (
                  <div className="w-3 h-3 rounded-full bg-blue-400 opacity-40"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* フェーズ表示 */}
      <div className="mt-3 flex gap-4 text-xs text-amber-300">
        <span className={gameState.phase === 'placing' ? 'font-bold text-amber-100' : ''}>
          📍 配置フェーズ
        </span>
        <span>|</span>
        <span className={gameState.phase === 'moving' ? 'font-bold text-amber-100' : ''}>
          🏃 移動フェーズ
        </span>
      </div>

      {/* リセットボタン */}
      <button
        onClick={handleReset}
        className="mt-3 px-6 py-2.5 bg-amber-600 text-white rounded-full hover:bg-amber-500 font-medium shadow-lg transition-all hover:scale-105 active:scale-95"
      >
        🔄 新しいゲーム
      </button>

      {/* ルール説明 */}
      <div className="mt-4 text-xs sm:text-sm text-amber-200 text-center max-w-md bg-amber-900/50 rounded-lg p-4 border border-amber-700">
        <p className="font-bold mb-2 text-amber-100">📖 シーガのルール</p>
        <div className="text-left space-y-1">
          <p>① <strong>配置フェーズ</strong>: 交互に2個ずつ駒を置く（中央以外）</p>
          <p>② <strong>移動フェーズ</strong>: 上下左右に1マス移動</p>
          <p>③ <strong>挟み取り</strong>: 相手の駒を縦横に挟むと取れる</p>
          <p>④ <strong>連続キャプチャ</strong>: 取ったらもう一度動ける</p>
          <p>⑤ <strong>勝利条件</strong>: 相手の駒を1個以下にする</p>
        </div>
      </div>
    </div>
  );
}

export default App;
