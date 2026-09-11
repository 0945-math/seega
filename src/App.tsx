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
  getAIPlacement,
  getAIMove,
  isFirstMove,
  PIECES_PER_PLAYER,
} from './game/seega';

const BOARD_SIZE = 5;
const CENTER = Math.floor(BOARD_SIZE / 2);

// サウンドエフェクト
class SoundManager {
  private audioContext: AudioContext | null = null;

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playPlace() {
    this.init();
    if (!this.audioContext) return;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    oscillator.frequency.value = 400;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  playMove() {
    this.init();
    if (!this.audioContext) return;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    oscillator.frequency.value = 300;
    oscillator.type = 'triangle';
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.15);
  }

  playCapture() {
    this.init();
    if (!this.audioContext) return;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.3);
    oscillator.type = 'sawtooth';
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }

  playWin() {
    this.init();
    if (!this.audioContext) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, this.audioContext!.currentTime + i * 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + i * 0.15 + 0.3);
      oscillator.start(this.audioContext!.currentTime + i * 0.15);
      oscillator.stop(this.audioContext!.currentTime + i * 0.15 + 0.3);
    });
  }

  playLose() {
    this.init();
    if (!this.audioContext) return;
    const notes = [400, 350, 300, 250];
    notes.forEach((freq, i) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, this.audioContext!.currentTime + i * 0.2);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + i * 0.2 + 0.4);
      oscillator.start(this.audioContext!.currentTime + i * 0.2);
      oscillator.stop(this.audioContext!.currentTime + i * 0.2 + 0.4);
    });
  }
}

const soundManager = new SoundManager();

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [difficulty, setDifficulty] = useState<number>(2);
  const [isThinking, setIsThinking] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [animatingCells, setAnimatingCells] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const playerSide: Player = 'player1';
  const aiSide: Player = 'player2';

  const triggerAnimation = useCallback((positions: Position[]) => {
    const keys = new Set(positions.map(p => `${p.row}-${p.col}`));
    setAnimatingCells(keys);
    setTimeout(() => setAnimatingCells(new Set()), 600);
  }, []);

  // AIのターン処理
  useEffect(() => {
    if (gameState.gameOver) return;
    if (gameState.currentPlayer !== aiSide) return;

    setIsThinking(true);
    const timer = setTimeout(() => {
      const state = gameStateRef.current;

      if (state.phase === 'placing') {
        const pos = getAIPlacement(state);
        const newState = placePiece(state, pos);
        newState.message = 'あなたの番です';
        setGameState(newState);
        triggerAnimation([pos]);
        if (soundEnabled) soundManager.playPlace();
      } else if (state.phase === 'moving') {
        const aiMove = getAIMove(state, difficulty);
        if (aiMove) {
          let newState = movePiece(state, aiMove.from, aiMove.to);
          triggerAnimation([aiMove.to, ...newState.capturedPositions]);
          if (soundEnabled) soundManager.playMove();

          if (newState.capturedPositions.length > 0 && soundEnabled) {
            setTimeout(() => soundManager.playCapture(), 200);
          }

          let captureCount = 0;
          while (newState.canCapture && newState.currentPlayer === aiSide && !newState.gameOver && captureCount < 5) {
            const nextMove = getAIMove(newState, difficulty);
            if (nextMove) {
              newState = movePiece(newState, nextMove.from, nextMove.to);
              triggerAnimation([nextMove.to, ...newState.capturedPositions]);
              if (soundEnabled) soundManager.playMove();
              if (newState.capturedPositions.length > 0 && soundEnabled) {
                setTimeout(() => soundManager.playCapture(), 200);
              }
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
    }, 500);

    return () => clearTimeout(timer);
  }, [gameState.currentPlayer, gameState.gameOver, gameState.phase, aiSide, playerSide, difficulty, triggerAnimation, soundEnabled]);

  // ゲーム終了時のサウンド
  useEffect(() => {
    if (gameState.gameOver && soundEnabled) {
      if (gameState.winner === playerSide) {
        soundManager.playWin();
      } else {
        soundManager.playLose();
      }
    }
  }, [gameState.gameOver, gameState.winner, playerSide, soundEnabled]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (gameState.gameOver || isThinking) return;
    if (gameState.currentPlayer !== playerSide) return;

    const pos: Position = { row, col };

    if (gameState.phase === 'placing') {
      if (canPlace(gameState, pos)) {
        const newState = placePiece(gameState, pos);
        setGameState(newState);
        triggerAnimation([pos]);
        if (soundEnabled) soundManager.playPlace();
      }
      return;
    }

    if (gameState.phase === 'moving') {
      const clickedPiece = gameState.board[row][col];

      if (gameState.canCapture) {
        if (gameState.selectedPos) {
          const isValid = gameState.validMoves.some(m => m.row === row && m.col === col);
          if (isValid) {
            const newState = movePiece(gameState, gameState.selectedPos, pos);
            setGameState(newState);
            triggerAnimation([pos, ...newState.capturedPositions]);
            if (soundEnabled) soundManager.playMove();
            if (newState.capturedPositions.length > 0 && soundEnabled) {
              setTimeout(() => soundManager.playCapture(), 200);
            }
            return;
          }
        }
        if (clickedPiece === playerSide) {
          const moves = getValidMoves(gameState.board, pos);
          if (moves.length > 0) {
            setGameState({ ...gameState, selectedPos: pos, validMoves: moves });
          }
        }
        return;
      }

      if (gameState.selectedPos) {
        const isValid = gameState.validMoves.some(m => m.row === row && m.col === col);
        if (isValid) {
          if (isFirstMove(gameState) && playerSide === 'player1') {
            if (row !== CENTER || col !== CENTER) {
              setGameState({ ...gameState, message: '最初の一手は中央に移動してください' });
              return;
            }
          }
          const newState = movePiece(gameState, gameState.selectedPos, pos);
          setGameState(newState);
          triggerAnimation([pos, ...newState.capturedPositions]);
          if (soundEnabled) soundManager.playMove();
          if (newState.capturedPositions.length > 0 && soundEnabled) {
            setTimeout(() => soundManager.playCapture(), 200);
          }
          return;
        }
        if (clickedPiece === playerSide) {
          const moves = getValidMoves(gameState.board, pos);
          setGameState({ ...gameState, selectedPos: pos, validMoves: moves });
          return;
        }
        setGameState({ ...gameState, selectedPos: null, validMoves: [] });
        return;
      }

      if (clickedPiece === playerSide) {
        const moves = getValidMoves(gameState.board, pos);
        if (moves.length > 0) {
          setGameState({ ...gameState, selectedPos: pos, validMoves: moves });
        }
      }
    }
  }, [gameState, playerSide, isThinking, triggerAnimation, soundEnabled]);

  const handleReset = useCallback(() => {
    setGameState(createInitialState());
    setIsThinking(false);
  }, []);

  const p1Count = countPieces(gameState.board, 'player1');
  const p2Count = countPieces(gameState.board, 'player2');
  const placingProgress = gameState.phase === 'placing' ? gameState.totalPlaced.player1 : PIECES_PER_PLAYER;

  const posToLabel = (pos: Position): string => {
    const cols = ['1', '2', '3', '4', '5'];
    const rows = ['一', '二', '三', '四', '五'];
    return `${cols[4 - pos.col]}${rows[pos.row]}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0f05] via-[#2d1810] to-[#1a0f05] flex flex-col items-center py-4 px-2 relative overflow-hidden">
      {/* 背景装飾 */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 text-7xl rotate-12">🏺</div>
        <div className="absolute top-32 right-16 text-5xl -rotate-12">🐫</div>
        <div className="absolute bottom-32 left-16 text-6xl rotate-6">🌙</div>
        <div className="absolute bottom-16 right-10 text-7xl -rotate-6">⚱️</div>
      </div>

      {/* タイトル */}
      <div className="relative z-10 text-center mb-4">
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg flex items-center justify-center gap-3">
          <span className="text-2xl sm:text-3xl">🏛️</span>
          <span className="tracking-widest">SEEGA</span>
          <span className="text-2xl sm:text-3xl">🏛️</span>
        </h1>
        <p className="text-xs text-amber-400/80 mt-1 tracking-widest uppercase">Ancient Egyptian Strategy Game</p>
      </div>

      {/* コントロール */}
      <div className="relative z-10 mb-4 flex items-center gap-2 flex-wrap justify-center">
        <span className="text-xs text-amber-300 font-medium">AI:</span>
        {[
          { label: '易', value: 1, emoji: '🌱' },
          { label: '中', value: 2, emoji: '⚔️' },
          { label: '強', value: 3, emoji: '🔥' },
        ].map(d => (
          <button
            key={d.value}
            onClick={() => { setDifficulty(d.value); handleReset(); }}
            className={`px-3 py-1 text-sm rounded-lg transition-all duration-300 ${
              difficulty === d.value
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/30 scale-105 font-bold'
                : 'bg-amber-900/50 text-amber-300 border border-amber-700/50 hover:bg-amber-800/50 hover:border-amber-600'
            }`}
          >
            {d.emoji} {d.label}
          </button>
        ))}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`px-3 py-1 text-sm rounded-lg transition-all duration-300 ${
            soundEnabled
              ? 'bg-green-600/50 text-green-200 border border-green-500/50'
              : 'bg-gray-700/50 text-gray-400 border border-gray-600/50'
          }`}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>

      {/* スコアボード */}
      <div className="relative z-10 flex gap-4 sm:gap-8 mb-4">
        <div className={`px-4 py-3 rounded-xl border transition-all duration-300 ${
          gameState.currentPlayer === playerSide && !gameState.gameOver
            ? 'bg-gradient-to-br from-amber-600/30 to-amber-800/30 border-amber-400/60 shadow-lg shadow-amber-500/20'
            : 'bg-amber-900/30 border-amber-800/40'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white to-gray-300 border-2 border-gray-400 shadow-md"></div>
            <div>
              <div className="text-xs text-amber-300 font-medium">あなた</div>
              <div className="text-2xl font-bold text-white">{p1Count}</div>
            </div>
          </div>
          {gameState.capturedBy.player1 > 0 && (
            <div className="text-xs text-amber-400 mt-1 text-center">⚔️ {gameState.capturedBy.player1}個獲得</div>
          )}
        </div>

        <div className="flex items-center">
          <span className="text-amber-500 font-bold text-xl">VS</span>
        </div>

        <div className={`px-4 py-3 rounded-xl border transition-all duration-300 ${
          gameState.currentPlayer === aiSide && !gameState.gameOver
            ? 'bg-gradient-to-br from-gray-600/30 to-gray-800/30 border-gray-400/60 shadow-lg shadow-gray-500/20'
            : 'bg-gray-900/30 border-gray-700/40'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-500 shadow-md"></div>
            <div>
              <div className="text-xs text-gray-300 font-medium">AI</div>
              <div className="text-2xl font-bold text-white">{p2Count}</div>
            </div>
          </div>
          {gameState.capturedBy.player2 > 0 && (
            <div className="text-xs text-gray-400 mt-1 text-center">⚔️ {gameState.capturedBy.player2}個獲得</div>
          )}
        </div>
      </div>

      {/* 配置進捗バー */}
      {gameState.phase === 'placing' && (
        <div className="relative z-10 w-full max-w-xs mb-3">
          <div className="flex justify-between text-xs text-amber-400 mb-1">
            <span>配置進捗</span>
            <span>{placingProgress}/{PIECES_PER_PLAYER}</span>
          </div>
          <div className="h-2 bg-amber-900/50 rounded-full overflow-hidden border border-amber-700/30">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500 rounded-full"
              style={{ width: `${(placingProgress / PIECES_PER_PLAYER) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* メッセージ */}
      <div className={`relative z-10 mb-4 px-5 py-3 rounded-xl text-center font-medium text-sm transition-all duration-300 max-w-sm ${
        gameState.gameOver
          ? gameState.winner === playerSide
            ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-200 border border-green-400/50 shadow-lg shadow-green-500/20'
            : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-200 border border-red-400/50 shadow-lg shadow-red-500/20'
          : gameState.phase === 'placing'
            ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-200 border border-blue-400/50'
            : 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-200 border border-amber-400/50'
      }`}>
        {gameState.gameOver
          ? (gameState.winner === playerSide ? '🏆 勝利！見事です！' : '💀 敗北...次は勝ちましょう')
          : isThinking
            ? '🤔 AIが戦略を練っています...'
            : gameState.canCapture
              ? `⚡ 連続キャプチャ！もう一度動けます`
              : gameState.message}
      </div>

      {/* 盤面 */}
      <div className="relative z-10">
        <div className="absolute -inset-2 bg-gradient-to-br from-amber-600/30 via-yellow-600/20 to-amber-700/30 rounded-2xl blur-sm"></div>
        <div className="relative bg-gradient-to-br from-amber-800 to-amber-900 p-3 sm:p-4 rounded-xl shadow-2xl border-2 border-amber-600/50">
          <div className="absolute inset-1 rounded-lg border border-amber-500/20 pointer-events-none"></div>

          <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(5, 1fr)` }}>
            {Array.from({ length: 25 }, (_, idx) => {
              const row = Math.floor(idx / 5);
              const col = idx % 5;
              const cell = gameState.board[row][col];
              const isCenterCell = row === CENTER && col === CENTER;
              const isSelected = gameState.selectedPos?.row === row && gameState.selectedPos?.col === col;
              const isValidMove = gameState.validMoves.some(m => m.row === row && m.col === col);
              const canPlaceHere = gameState.phase === 'placing' && gameState.currentPlayer === playerSide && canPlace(gameState, { row, col });
              const isLastMove = gameState.lastMove?.to.row === row && gameState.lastMove?.to.col === col;
              const isAnimating = animatingCells.has(`${row}-${col}`);

              return (
                <div
                  key={idx}
                  onClick={() => handleCellClick(row, col)}
                  className={`
                    w-14 h-14 sm:w-16 sm:h-16 relative cursor-pointer
                    flex items-center justify-center
                    transition-all duration-200 active:scale-95
                    ${isCenterCell
                      ? 'bg-gradient-to-br from-amber-600/40 to-amber-700/40'
                      : 'bg-gradient-to-br from-amber-700/30 to-amber-800/30'}
                    ${isSelected ? 'ring-2 ring-yellow-300 bg-yellow-500/20' : ''}
                    ${isValidMove && !cell ? 'bg-green-500/20 hover:bg-green-500/30' : ''}
                    ${isValidMove && cell ? 'bg-red-500/20 hover:bg-red-500/30' : ''}
                    ${canPlaceHere && !cell ? 'bg-blue-400/15 hover:bg-blue-400/30' : ''}
                    ${isLastMove && !isSelected ? 'ring-1 ring-amber-400/40' : ''}
                    ${!cell && !isValidMove && !canPlaceHere ? 'hover:bg-amber-600/20' : ''}
                  `}
                >
                  <div className="absolute inset-0 border border-amber-600/20 pointer-events-none"></div>

                  {isCenterCell && !cell && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full border-2 border-amber-400/40 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50"></div>
                      </div>
                    </div>
                  )}

                  {cell && (
                    <div className={`
                      w-11 h-11 sm:w-13 sm:h-13 rounded-full shadow-xl flex items-center justify-center
                      transition-all duration-300 relative
                      ${cell === 'player1'
                        ? 'bg-gradient-to-br from-white via-gray-100 to-gray-300 border-2 border-gray-200 shadow-white/20'
                        : 'bg-gradient-to-br from-gray-600 via-gray-800 to-black border-2 border-gray-500 shadow-black/40'}
                      ${isSelected ? 'scale-110 shadow-2xl ring-2 ring-yellow-300/50' : ''}
                      ${isAnimating ? 'animate-bounce' : ''}
                    `}>
                      <div className={`absolute inset-1 rounded-full ${
                        cell === 'player1'
                          ? 'bg-gradient-to-br from-white/50 to-transparent'
                          : 'bg-gradient-to-br from-gray-400/30 to-transparent'
                      }`}></div>
                      <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full flex items-center justify-center ${
                        cell === 'player1'
                          ? 'bg-gradient-to-br from-gray-200 to-gray-400'
                          : 'bg-gradient-to-br from-gray-500 to-gray-700'
                      }`}>
                        <span className={`text-[6px] sm:text-[8px] font-bold ${
                          cell === 'player1' ? 'text-gray-500' : 'text-gray-300'
                        }`}>☥</span>
                      </div>
                    </div>
                  )}

                  {isValidMove && !cell && (
                    <div className="w-4 h-4 rounded-full bg-green-400/60 animate-pulse shadow-lg shadow-green-400/30"></div>
                  )}
                  {isValidMove && cell && (
                    <div className="absolute inset-1 rounded-full border-2 border-red-400/60 animate-pulse"></div>
                  )}
                  {canPlaceHere && !cell && gameState.phase === 'placing' && (
                    <div className="w-3 h-3 rounded-full bg-blue-400/30"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* フェーズ & ステータス */}
      <div className="relative z-10 mt-4 flex items-center gap-3 text-xs">
        <div className={`px-3 py-1 rounded-full ${
          gameState.phase === 'placing'
            ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
            : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
        }`}>
          {gameState.phase === 'placing' ? '📍 配置' : '🏃 移動'}
        </div>
        <div className={`px-3 py-1 rounded-full ${
          gameState.currentPlayer === playerSide
            ? 'bg-white/10 text-white border border-white/20'
            : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
        }`}>
          {gameState.currentPlayer === playerSide ? '👤 あなた' : '🤖 AI'}の番
        </div>
      </div>

      {/* ボタン群 */}
      <div className="relative z-10 mt-4 flex gap-2 flex-wrap justify-center">
        <button
          onClick={handleReset}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg hover:from-amber-500 hover:to-amber-600 font-medium shadow-lg transition-all hover:scale-105 active:scale-95 text-sm"
        >
          🔄 新規ゲーム
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-5 py-2.5 bg-gradient-to-r from-gray-700 to-gray-800 text-gray-200 rounded-lg hover:from-gray-600 hover:to-gray-700 font-medium shadow-lg transition-all hover:scale-105 active:scale-95 text-sm"
        >
          📜 棋譜
        </button>
        <button
          onClick={() => setShowRules(!showRules)}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-700 to-indigo-800 text-indigo-200 rounded-lg hover:from-indigo-600 hover:to-indigo-700 font-medium shadow-lg transition-all hover:scale-105 active:scale-95 text-sm"
        >
          📖 ルール
        </button>
      </div>

      {/* 棋譜パネル */}
      {showHistory && (
        <div className="relative z-10 mt-4 w-full max-w-sm bg-gray-900/80 rounded-xl border border-gray-700/50 p-4 max-h-60 overflow-y-auto animate-fade-in">
          <h3 className="text-sm font-bold text-amber-300 mb-3">📜 棋譜</h3>
          {gameState.moveHistory.length === 0 ? (
            <p className="text-xs text-gray-500">まだ手がありません</p>
          ) : (
            <div className="space-y-1.5">
              {gameState.moveHistory.map((move, idx) => (
                <div key={idx} className="text-xs flex items-center gap-2 text-gray-300">
                  <span className="text-amber-500 font-mono w-6">{idx + 1}.</span>
                  <span className={move.player === 'player1' ? 'text-white' : 'text-gray-400'}>
                    {move.player === 'player1' ? '👤' : '🤖'}
                  </span>
                  <span>
                    {move.type === 'place' ? '配置' : '移動'}
                    {move.from && ` ${posToLabel(move.from)}→`}
                    {posToLabel(move.to)}
                  </span>
                  {move.captured && move.captured.length > 0 && (
                    <span className="text-red-400 font-bold">×{move.captured.length}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ルールパネル */}
      {showRules && (
        <div className="relative z-10 mt-4 w-full max-w-sm bg-gradient-to-br from-amber-900/80 to-amber-950/80 rounded-xl border border-amber-700/50 p-5 animate-fade-in">
          <h3 className="text-sm font-bold text-amber-200 mb-3 flex items-center gap-2">
            <span>🏛️</span> シーガのルール <span>🏛️</span>
          </h3>
          <div className="text-xs text-amber-200/90 space-y-2.5">
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold">①</span>
              <div>
                <strong className="text-amber-300">配置フェーズ</strong>
                <p className="text-amber-200/70 mt-0.5">交互に1個ずつ駒を置く（中央以外、各12個ずつ）</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold">②</span>
              <div>
                <strong className="text-amber-300">移動フェーズ</strong>
                <p className="text-amber-200/70 mt-0.5">上下左右に1マス移動（斜め不可、飛び越え不可）</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold">③</span>
              <div>
                <strong className="text-amber-300">挟み取り</strong>
                <p className="text-amber-200/70 mt-0.5">相手の駒を縦横に自分の駒で挟むと取れる</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold">④</span>
              <div>
                <strong className="text-amber-300">連続キャプチャ</strong>
                <p className="text-amber-200/70 mt-0.5">挟んだらもう一度移動できる</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold">⑤</span>
              <div>
                <strong className="text-amber-300">勝利条件</strong>
                <p className="text-amber-200/70 mt-0.5">相手の駒を1個以下にする</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold">⑥</span>
              <div>
                <strong className="text-amber-300">特殊ルール</strong>
                <p className="text-amber-200/70 mt-0.5">移動フェーズの先手の最初の一手は必ず中央へ</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-700/30">
            <p className="text-[10px] text-amber-400/60 italic">
              ※ 紀元前のエジプトで遊ばれていた世界最古のボードゲームの一つ
            </p>
          </div>
        </div>
      )}

      {/* ゲームオーバー時のオーバーレイ */}
      {gameState.gameOver && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in">
          <div className={`p-8 rounded-2xl shadow-2xl border-2 text-center max-w-sm mx-4 animate-scale-in ${
            gameState.winner === playerSide
              ? 'bg-gradient-to-br from-green-900 to-emerald-950 border-green-500/50'
              : 'bg-gradient-to-br from-red-900 to-rose-950 border-red-500/50'
          }`}>
            <div className="text-6xl mb-4 animate-bounce">
              {gameState.winner === playerSide ? '🏆' : '💀'}
            </div>
            <h2 className={`text-3xl font-bold mb-3 ${
              gameState.winner === playerSide ? 'text-green-200' : 'text-red-200'
            }`}>
              {gameState.winner === playerSide ? '勝利！' : '敗北...'}
            </h2>
            <p className="text-sm text-gray-300 mb-5">
              {gameState.winner === playerSide
                ? 'おめでとうございます！素晴らしい戦略でした。'
                : 'AIに敗れました。もう一度挑戦しましょう！'}
            </p>
            <div className="flex gap-3 text-xs text-gray-400 mb-5 justify-center">
              <span>あなたの駒: {p1Count}</span>
              <span>|</span>
              <span>AIの駒: {p2Count}</span>
              <span>|</span>
              <span>手数: {gameState.moveHistory.length}</span>
            </div>
            <button
              onClick={handleReset}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-lg hover:from-amber-400 hover:to-yellow-400 shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              🔄 もう一度プレイ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
