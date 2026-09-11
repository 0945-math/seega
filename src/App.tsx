import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  private initialized = false;

  init() {
    if (this.initialized) return;
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext not supported');
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
    if (!this.audioContext) return;
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      oscillator.frequency.value = freq;
      oscillator.type = type;
      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (e) {}
  }

  playPlace() {
    this.playTone(440, 0.1, 'sine', 0.25);
    setTimeout(() => this.playTone(554, 0.08, 'sine', 0.15), 50);
  }

  playMove() {
    this.playTone(330, 0.12, 'triangle', 0.2);
  }

  playCapture() {
    this.playTone(600, 0.15, 'sawtooth', 0.25);
    setTimeout(() => this.playTone(400, 0.2, 'sawtooth', 0.2), 100);
  }

  playSelect() {
    this.playTone(500, 0.05, 'sine', 0.1);
  }

  playInvalid() {
    this.playTone(200, 0.1, 'square', 0.1);
  }

  playWin() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, 'sine', 0.3), i * 150);
    });
  }

  playLose() {
    [400, 350, 300, 250].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.4, 'sine', 0.3), i * 200);
    });
  }
}

const soundManager = new SoundManager();

// 統計情報
interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  totalCaptures: number;
  fastestWin: number | null;
}

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [difficulty, setDifficulty] = useState<number>(2);
  const [isThinking, setIsThinking] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [animatingCells, setAnimatingCells] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem('seega-stats');
    return saved ? JSON.parse(saved) : { gamesPlayed: 0, wins: 0, losses: 0, totalCaptures: 0, fastestWin: null };
  });
  
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const gameStartTime = useRef(Date.now());

  const playerSide: Player = 'player1';
  const aiSide: Player = 'player2';

  // 統計を保存
  useEffect(() => {
    localStorage.setItem('seega-stats', JSON.stringify(stats));
  }, [stats]);

  // ゲーム終了時の統計更新
  useEffect(() => {
    if (gameState.gameOver && gameState.winner) {
      const duration = Math.floor((Date.now() - gameStartTime.current) / 1000);
      setStats(prev => ({
        gamesPlayed: prev.gamesPlayed + 1,
        wins: prev.wins + (gameState.winner === playerSide ? 1 : 0),
        losses: prev.losses + (gameState.winner !== playerSide ? 1 : 0),
        totalCaptures: prev.totalCaptures + gameState.capturedBy.player1 + gameState.capturedBy.player2,
        fastestWin: gameState.winner === playerSide && (prev.fastestWin === null || duration < prev.fastestWin) ? duration : prev.fastestWin,
      }));
    }
  }, [gameState.gameOver, gameState.winner, playerSide]);

  const triggerAnimation = useCallback((positions: Position[]) => {
    const keys = new Set(positions.map(p => `${p.row}-${p.col}`));
    setAnimatingCells(keys);
    setTimeout(() => setAnimatingCells(new Set()), 600);
  }, []);

  // AIのターン処理
  useEffect(() => {
    if (gameState.gameOver) return;
    if (gameState.currentPlayer !== aiSide) return;
    if (gameState.phase === 'placing' && gameState.piecesPlacedThisTurn > 0) return;

    setIsThinking(true);
    const timer = setTimeout(() => {
      const state = gameStateRef.current;

      if (state.phase === 'placing') {
        const placements = getAIPlacement(state);
        let newState = state;
        for (const pos of placements) {
          newState = placePiece(newState, pos);
        }
        newState.message = 'あなたの番です';
        setGameState(newState);
        triggerAnimation(placements);
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
    }, 400 + Math.random() * 300);

    return () => clearTimeout(timer);
  }, [gameState.currentPlayer, gameState.gameOver, gameState.phase, gameState.piecesPlacedThisTurn, aiSide, playerSide, difficulty, triggerAnimation, soundEnabled]);

  // ゲーム終了時のサウンド
  useEffect(() => {
    if (gameState.gameOver && soundEnabled) {
      setTimeout(() => {
        if (gameState.winner === playerSide) {
          soundManager.playWin();
        } else {
          soundManager.playLose();
        }
      }, 300);
    }
  }, [gameState.gameOver, gameState.winner, playerSide, soundEnabled]);

  // キーボード操作
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.gameOver || isThinking || gameState.currentPlayer !== playerSide) return;

      // ESCで選択解除
      if (e.key === 'Escape') {
        setGameState({ ...gameState, selectedPos: null, validMoves: [] });
        return;
      }

      // Rでリセット
      if (e.key === 'r' || e.key === 'R') {
        handleReset();
        return;
      }

      // 矢印キーで選択中の駒を移動
      if (gameState.selectedPos) {
        const dirMap: Record<string, Position> = {
          ArrowUp: { row: -1, col: 0 },
          ArrowDown: { row: 1, col: 0 },
          ArrowLeft: { row: 0, col: -1 },
          ArrowRight: { row: 0, col: 1 },
        };
        const dir = dirMap[e.key];
        if (dir) {
          e.preventDefault();
          const newPos = { row: gameState.selectedPos.row + dir.row, col: gameState.selectedPos.col + dir.col };
          if (newPos.row >= 0 && newPos.row < BOARD_SIZE && newPos.col >= 0 && newPos.col < BOARD_SIZE) {
            const isValid = gameState.validMoves.some(m => m.row === newPos.row && m.col === newPos.col);
            if (isValid) {
              handleCellClick(newPos.row, newPos.col);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isThinking, playerSide]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (gameState.gameOver || isThinking) return;
    if (gameState.currentPlayer !== playerSide) return;

    if (soundEnabled && !soundManager['initialized']) {
      soundManager.init();
    }

    const pos: Position = { row, col };

    if (gameState.phase === 'placing') {
      if (canPlace(gameState, pos)) {
        const newState = placePiece(gameState, pos);
        setGameState(newState);
        triggerAnimation([pos]);
        if (soundEnabled) soundManager.playPlace();
      } else {
        if (soundEnabled) soundManager.playInvalid();
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
            if (soundEnabled) soundManager.playSelect();
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
              if (soundEnabled) soundManager.playInvalid();
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
          if (soundEnabled) soundManager.playSelect();
          return;
        }
        setGameState({ ...gameState, selectedPos: null, validMoves: [] });
        return;
      }

      if (clickedPiece === playerSide) {
        const moves = getValidMoves(gameState.board, pos);
        if (moves.length > 0) {
          setGameState({ ...gameState, selectedPos: pos, validMoves: moves });
          if (soundEnabled) soundManager.playSelect();
        } else {
          if (soundEnabled) soundManager.playInvalid();
        }
      }
    }
  }, [gameState, playerSide, isThinking, triggerAnimation, soundEnabled]);

  const handleReset = useCallback(() => {
    setGameState(createInitialState());
    setIsThinking(false);
    gameStartTime.current = Date.now();
  }, []);

  const p1Count = countPieces(gameState.board, 'player1');
  const p2Count = countPieces(gameState.board, 'player2');
  const placingProgress = gameState.phase === 'placing' ? gameState.totalPlaced.player1 : PIECES_PER_PLAYER;

  const posToLabel = (pos: Position): string => {
    const cols = ['A', 'B', 'C', 'D', 'E'];
    const rows = ['1', '2', '3', '4', '5'];
    return `${cols[pos.col]}${rows[pos.row]}`;
  };

  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0a05] via-[#1a0f08] to-[#0f0a05] flex flex-col items-center py-4 px-2 relative overflow-hidden">
      {/* 背景装飾 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.05)_0%,_transparent_50%)]"></div>
        <div className="absolute top-10 left-10 text-7xl rotate-12 opacity-[0.03]">🏺</div>
        <div className="absolute top-32 right-16 text-5xl -rotate-12 opacity-[0.03]">🐫</div>
        <div className="absolute bottom-32 left-16 text-6xl rotate-6 opacity-[0.03]">🌙</div>
        <div className="absolute bottom-16 right-10 text-7xl -rotate-6 opacity-[0.03]">⚱️</div>
      </div>

      {/* タイトル */}
      <div className="relative z-10 text-center mb-4">
        <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg flex items-center justify-center gap-3">
          <span className="text-3xl sm:text-4xl">🏛️</span>
          <span className="tracking-[0.2em]">SEEGA</span>
          <span className="text-3xl sm:text-4xl">🏛️</span>
        </h1>
        <p className="text-xs text-amber-400/60 mt-1 tracking-[0.3em] uppercase font-medium">Ancient Egyptian Strategy Game</p>
      </div>

      {/* コントロール */}
      <div className="relative z-10 mb-3 flex items-center gap-2 flex-wrap justify-center">
        <span className="text-xs text-amber-300/80 font-medium">AI:</span>
        {[
          { label: '易', value: 1, emoji: '🌱' },
          { label: '中', value: 2, emoji: '⚔️' },
          { label: '強', value: 3, emoji: '🔥' },
        ].map(d => (
          <button
            key={d.value}
            onClick={() => { setDifficulty(d.value); handleReset(); }}
            className={`px-3 py-1.5 text-sm rounded-lg transition-all duration-300 ${
              difficulty === d.value
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/30 scale-105 font-bold'
                : 'bg-amber-900/40 text-amber-300/80 border border-amber-700/40 hover:bg-amber-800/40 hover:border-amber-600/60'
            }`}
          >
            {d.emoji} {d.label}
          </button>
        ))}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-all duration-300 ${
            soundEnabled
              ? 'bg-green-600/30 text-green-200 border border-green-500/40 hover:bg-green-600/40'
              : 'bg-gray-700/30 text-gray-400 border border-gray-600/40 hover:bg-gray-700/40'
          }`}
          aria-label={soundEnabled ? 'サウンドをオフ' : 'サウンドをオン'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>

      {/* スコアボード */}
      <div className="relative z-10 flex gap-3 sm:gap-6 mb-3">
        <div className={`px-4 py-3 rounded-xl border-2 transition-all duration-500 ${
          gameState.currentPlayer === playerSide && !gameState.gameOver
            ? 'bg-gradient-to-br from-amber-600/40 to-amber-800/40 border-amber-400/70 shadow-lg shadow-amber-500/30 scale-105'
            : 'bg-amber-900/20 border-amber-800/40'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white to-gray-300 border-2 border-gray-400 shadow-md flex items-center justify-center">
              <span className="text-xs font-bold text-gray-600">☥</span>
            </div>
            <div>
              <div className="text-[10px] text-amber-300/80 font-medium uppercase tracking-wider">あなた</div>
              <div className="text-2xl font-bold text-white">{p1Count}</div>
            </div>
          </div>
          {gameState.capturedBy.player1 > 0 && (
            <div className="text-[10px] text-amber-400 mt-1 text-center font-medium">⚔️ {gameState.capturedBy.player1}個獲得</div>
          )}
        </div>

        <div className="flex items-center">
          <div className="bg-gradient-to-br from-amber-500/80 to-amber-700/80 px-3 py-2 rounded-lg shadow-md">
            <span className="text-amber-100 font-bold text-sm">VS</span>
          </div>
        </div>

        <div className={`px-4 py-3 rounded-xl border-2 transition-all duration-500 ${
          gameState.currentPlayer === aiSide && !gameState.gameOver
            ? 'bg-gradient-to-br from-gray-600/40 to-gray-800/40 border-gray-400/70 shadow-lg shadow-gray-500/30 scale-105'
            : 'bg-gray-900/20 border-gray-700/40'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-500 shadow-md flex items-center justify-center">
              <span className="text-xs font-bold text-gray-300">☥</span>
            </div>
            <div>
              <div className="text-[10px] text-gray-300/80 font-medium uppercase tracking-wider">AI</div>
              <div className="text-2xl font-bold text-white">{p2Count}</div>
            </div>
          </div>
          {gameState.capturedBy.player2 > 0 && (
            <div className="text-[10px] text-gray-400 mt-1 text-center font-medium">⚔️ {gameState.capturedBy.player2}個獲得</div>
          )}
        </div>
      </div>

      {/* 配置進捗バー */}
      {gameState.phase === 'placing' && (
        <div className="relative z-10 w-full max-w-xs mb-3">
          <div className="flex justify-between text-[10px] text-amber-400/80 mb-1 font-medium">
            <span>配置進捗</span>
            <span>{placingProgress}/{PIECES_PER_PLAYER}</span>
          </div>
          <div className="h-1.5 bg-amber-900/50 rounded-full overflow-hidden border border-amber-700/30">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500 rounded-full"
              style={{ width: `${(placingProgress / PIECES_PER_PLAYER) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* メッセージ */}
      <div className={`relative z-10 mb-3 px-5 py-3 rounded-xl text-center font-medium text-sm transition-all duration-300 max-w-md ${
        gameState.gameOver
          ? gameState.winner === playerSide
            ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-green-100 border-2 border-green-400/60 shadow-lg shadow-green-500/30'
            : 'bg-gradient-to-r from-red-500/30 to-rose-500/30 text-red-100 border-2 border-red-400/60 shadow-lg shadow-red-500/30'
          : gameState.phase === 'placing'
            ? 'bg-gradient-to-r from-blue-500/25 to-indigo-500/25 text-blue-100 border-2 border-blue-400/50 shadow-md'
            : 'bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-100 border-2 border-amber-400/50 shadow-md'
      }`}>
        <div className="flex items-center justify-center gap-2">
          {gameState.gameOver ? (
            <>
              <span className="text-2xl">{gameState.winner === playerSide ? '🏆' : '💀'}</span>
              <span className="text-base font-bold">
                {gameState.winner === playerSide ? '勝利！見事です！' : '敗北...次は勝ちましょう'}
              </span>
            </>
          ) : isThinking ? (
            <>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span>AIが戦略を練っています...</span>
            </>
          ) : gameState.canCapture ? (
            <>
              <span className="text-xl animate-pulse">⚡</span>
              <span className="font-bold">連続キャプチャ！もう一度動けます</span>
            </>
          ) : (
            <>
              <span className="text-lg">
                {gameState.phase === 'placing' ? '📍' : '🎯'}
              </span>
              <span>{gameState.message}</span>
            </>
          )}
        </div>
      </div>

      {/* 盤面 */}
      <div className="relative z-10 my-2">
        <div className="absolute -inset-3 bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-amber-600/20 rounded-3xl blur-md"></div>
        <div className="absolute -inset-1 bg-gradient-to-br from-amber-600/40 to-amber-800/40 rounded-2xl"></div>
        
        <div className="relative bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900 p-3 sm:p-4 rounded-xl shadow-2xl border-2 border-amber-600/60">
          <div className="absolute inset-2 rounded-lg border border-amber-500/20 pointer-events-none"></div>

          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(5, 1fr)` }}>
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
                    transition-all duration-200 active:scale-90
                    ${isCenterCell
                      ? 'bg-gradient-to-br from-amber-700/50 to-amber-800/50'
                      : 'bg-gradient-to-br from-amber-800/40 to-amber-900/40'}
                    ${isSelected ? 'ring-2 ring-yellow-300 bg-yellow-500/30 shadow-lg shadow-yellow-500/50' : ''}
                    ${isValidMove && !cell ? 'bg-green-500/30 hover:bg-green-500/40 shadow-inner shadow-green-400/30' : ''}
                    ${isValidMove && cell ? 'bg-red-500/30 hover:bg-red-500/40 shadow-inner shadow-red-400/30' : ''}
                    ${canPlaceHere && !cell ? 'bg-blue-400/20 hover:bg-blue-400/35 shadow-inner shadow-blue-400/20' : ''}
                    ${isLastMove && !isSelected ? 'ring-1 ring-amber-400/50 bg-amber-500/20' : ''}
                    ${!cell && !isValidMove && !canPlaceHere ? 'hover:bg-amber-700/30' : ''}
                  `}
                  role="button"
                  aria-label={`セル ${posToLabel({ row, col })}${cell ? ` - ${cell === 'player1' ? 'あなたの駒' : 'AIの駒'}` : ''}`}
                  tabIndex={0}
                >
                  <div className="absolute inset-0 border border-amber-600/20 pointer-events-none"></div>

                  {isCenterCell && !cell && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full border-2 border-amber-400/40 flex items-center justify-center bg-amber-500/10">
                        <div className="w-2 h-2 rounded-full bg-amber-400/50"></div>
                      </div>
                    </div>
                  )}

                  {cell && (
                    <div className={`
                      w-11 h-11 sm:w-13 sm:h-13 rounded-full shadow-xl flex items-center justify-center
                      transition-all duration-300 relative
                      ${cell === 'player1'
                        ? 'bg-gradient-to-br from-white via-gray-100 to-gray-300 border-2 border-gray-200 shadow-white/30'
                        : 'bg-gradient-to-br from-gray-600 via-gray-800 to-black border-2 border-gray-500 shadow-black/50'}
                      ${isSelected ? 'scale-115 shadow-2xl ring-2 ring-yellow-300/60' : ''}
                      ${isAnimating ? 'animate-bounce' : ''}
                      ${isLastMove ? 'ring-1 ring-amber-400/40' : ''}
                    `}>
                      <div className={`absolute inset-1 rounded-full ${
                        cell === 'player1'
                          ? 'bg-gradient-to-br from-white/60 to-transparent'
                          : 'bg-gradient-to-br from-gray-400/40 to-transparent'
                      }`}></div>
                      <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full flex items-center justify-center ${
                        cell === 'player1'
                          ? 'bg-gradient-to-br from-gray-200 to-gray-400'
                          : 'bg-gradient-to-br from-gray-500 to-gray-700'
                      }`}>
                        <span className={`text-[7px] sm:text-[9px] font-bold ${
                          cell === 'player1' ? 'text-gray-500' : 'text-gray-300'
                        }`}>☥</span>
                      </div>
                    </div>
                  )}

                  {isValidMove && !cell && (
                    <div className="w-5 h-5 rounded-full bg-green-400/70 animate-pulse shadow-lg shadow-green-400/50"></div>
                  )}
                  {isValidMove && cell && (
                    <div className="absolute inset-1.5 rounded-full border-2 border-red-400/70 animate-pulse"></div>
                  )}
                  {canPlaceHere && !cell && gameState.phase === 'placing' && (
                    <div className="w-4 h-4 rounded-full bg-blue-400/40 animate-pulse"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ステータス */}
      <div className="relative z-10 mt-3 flex items-center gap-3 text-xs">
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
        <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300/80 border border-amber-400/20">
          手数: {gameState.moveHistory.length}
        </div>
      </div>

      {/* ボタン群 */}
      <div className="relative z-10 mt-3 flex gap-2 flex-wrap justify-center">
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg hover:from-amber-500 hover:to-amber-600 font-medium shadow-lg transition-all hover:scale-105 active:scale-95 text-sm"
          aria-label="新しいゲーム"
        >
          🔄 新規
        </button>
        <button
          onClick={() => { setShowHistory(!showHistory); setShowRules(false); setShowStats(false); }}
          className={`px-4 py-2 rounded-lg font-medium shadow-lg transition-all hover:scale-105 active:scale-95 text-sm ${
            showHistory
              ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white'
              : 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-200 hover:from-gray-600 hover:to-gray-700'
          }`}
          aria-label="棋譜を表示"
        >
          📜 棋譜
        </button>
        <button
          onClick={() => { setShowRules(!showRules); setShowHistory(false); setShowStats(false); }}
          className={`px-4 py-2 rounded-lg font-medium shadow-lg transition-all hover:scale-105 active:scale-95 text-sm ${
            showRules
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white'
              : 'bg-gradient-to-r from-indigo-700 to-indigo-800 text-indigo-200 hover:from-indigo-600 hover:to-indigo-700'
          }`}
          aria-label="ルールを表示"
        >
          📖 ルール
        </button>
        <button
          onClick={() => { setShowStats(!showStats); setShowHistory(false); setShowRules(false); }}
          className={`px-4 py-2 rounded-lg font-medium shadow-lg transition-all hover:scale-105 active:scale-95 text-sm ${
            showStats
              ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white'
              : 'bg-gradient-to-r from-purple-700 to-purple-800 text-purple-200 hover:from-purple-600 hover:to-purple-700'
          }`}
          aria-label="統計を表示"
        >
          📊 統計
        </button>
      </div>

      {/* 棋譜パネル */}
      {showHistory && (
        <div className="relative z-10 mt-3 w-full max-w-sm bg-gray-900/90 rounded-xl border border-gray-700/50 p-4 max-h-60 overflow-y-auto animate-fade-in custom-scrollbar">
          <h3 className="text-sm font-bold text-amber-300 mb-3 flex items-center gap-2">
            <span>📜</span> 棋譜
          </h3>
          {gameState.moveHistory.length === 0 ? (
            <p className="text-xs text-gray-500">まだ手がありません</p>
          ) : (
            <div className="space-y-1.5">
              {gameState.moveHistory.map((move, idx) => (
                <div key={idx} className="text-xs flex items-center gap-2 text-gray-300 hover:bg-gray-800/50 px-2 py-1 rounded">
                  <span className="text-amber-500 font-mono w-6">{idx + 1}.</span>
                  <span className={move.player === 'player1' ? 'text-white' : 'text-gray-400'}>
                    {move.player === 'player1' ? '👤' : '🤖'}
                  </span>
                  <span>
                    {move.type === 'place' ? '📍' : '➡️'}
                    {move.from && ` ${posToLabel(move.from)}→`}
                    {posToLabel(move.to)}
                  </span>
                  {move.captured && move.captured.length > 0 && (
                    <span className="text-red-400 font-bold ml-auto">×{move.captured.length}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ルールパネル */}
      {showRules && (
        <div className="relative z-10 mt-3 w-full max-w-sm bg-gradient-to-br from-amber-900/90 to-amber-950/90 rounded-xl border border-amber-700/50 p-5 animate-fade-in">
          <h3 className="text-sm font-bold text-amber-200 mb-3 flex items-center gap-2">
            <span>🏛️</span> シーガのルール
          </h3>
          <div className="text-xs text-amber-200/90 space-y-2.5">
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold min-w-[20px]">①</span>
              <div>
                <strong className="text-amber-300">配置フェーズ</strong>
                <p className="text-amber-200/70 mt-0.5">交互に2個ずつ駒を置く（中央以外、各12個ずつ）</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold min-w-[20px]">②</span>
              <div>
                <strong className="text-amber-300">移動フェーズ</strong>
                <p className="text-amber-200/70 mt-0.5">上下左右に1マス移動（斜め不可、飛び越え不可）</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold min-w-[20px]">③</span>
              <div>
                <strong className="text-amber-300">挟み取り</strong>
                <p className="text-amber-200/70 mt-0.5">相手の駒を縦横に自分の駒で挟むと取れる</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold min-w-[20px]">④</span>
              <div>
                <strong className="text-amber-300">連続キャプチャ</strong>
                <p className="text-amber-200/70 mt-0.5">挟んだらもう一度移動できる</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold min-w-[20px]">⑤</span>
              <div>
                <strong className="text-amber-300">勝利条件</strong>
                <p className="text-amber-200/70 mt-0.5">相手の駒を1個以下にする</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400 font-bold min-w-[20px]">⑥</span>
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

      {/* 統計パネル */}
      {showStats && (
        <div className="relative z-10 mt-3 w-full max-w-sm bg-gradient-to-br from-purple-900/90 to-purple-950/90 rounded-xl border border-purple-700/50 p-5 animate-fade-in">
          <h3 className="text-sm font-bold text-purple-200 mb-3 flex items-center gap-2">
            <span>📊</span> ゲーム統計
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-purple-800/30 rounded-lg p-3 border border-purple-600/30">
              <div className="text-purple-300/80 mb-1">対戦数</div>
              <div className="text-2xl font-bold text-white">{stats.gamesPlayed}</div>
            </div>
            <div className="bg-green-800/30 rounded-lg p-3 border border-green-600/30">
              <div className="text-green-300/80 mb-1">勝利</div>
              <div className="text-2xl font-bold text-white">{stats.wins}</div>
            </div>
            <div className="bg-red-800/30 rounded-lg p-3 border border-red-600/30">
              <div className="text-red-300/80 mb-1">敗北</div>
              <div className="text-2xl font-bold text-white">{stats.losses}</div>
            </div>
            <div className="bg-amber-800/30 rounded-lg p-3 border border-amber-600/30">
              <div className="text-amber-300/80 mb-1">勝率</div>
              <div className="text-2xl font-bold text-white">{winRate}%</div>
            </div>
            <div className="bg-blue-800/30 rounded-lg p-3 border border-blue-600/30 col-span-2">
              <div className="text-blue-300/80 mb-1">総獲得駒数</div>
              <div className="text-2xl font-bold text-white">{stats.totalCaptures}</div>
            </div>
            {stats.fastestWin !== null && (
              <div className="bg-yellow-800/30 rounded-lg p-3 border border-yellow-600/30 col-span-2">
                <div className="text-yellow-300/80 mb-1">最短勝利</div>
                <div className="text-2xl font-bold text-white">{stats.fastestWin}秒</div>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (confirm('統計データをリセットしますか？')) {
                setStats({ gamesPlayed: 0, wins: 0, losses: 0, totalCaptures: 0, fastestWin: null });
              }
            }}
            className="mt-3 w-full px-3 py-2 bg-purple-800/50 text-purple-200 rounded-lg hover:bg-purple-700/50 text-xs border border-purple-600/30"
          >
            🗑️ 統計をリセット
          </button>
        </div>
      )}

      {/* ゲームオーバー時のオーバーレイ */}
      {gameState.gameOver && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in">
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
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 mb-5">
              <div className="bg-black/20 rounded-lg p-2">
                <div className="text-gray-500">あなたの駒</div>
                <div className="text-lg font-bold text-white">{p1Count}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2">
                <div className="text-gray-500">AIの駒</div>
                <div className="text-lg font-bold text-white">{p2Count}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2">
                <div className="text-gray-500">手数</div>
                <div className="text-lg font-bold text-white">{gameState.moveHistory.length}</div>
              </div>
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

      {/* キーボードショートカット案内 */}
      <div className="relative z-10 mt-4 text-[10px] text-amber-400/40 text-center">
        <p>ESC: 選択解除 | R: リセット | 矢印キー: 駒を移動</p>
      </div>
    </div>
  );
}

export default App;
