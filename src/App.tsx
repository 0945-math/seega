import { useEffect, useState } from 'react';
import {
  GameState, Position, Player, createInitialState, getValidMoves,
  movePiece, isFirstMove, countPieces,
} from './game/seega';
import { getMCTSMove } from './game/mcts';

const CENTER = 2;

export default function App() {
  const [state, setState] = useState<GameState>(createInitialState());
  const [selected, setSelected] = useState<Position | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<{from?: Position; to: Position} | null>(null);

  const reset = () => {
    setState(createInitialState());
    setSelected(null);
    setHint(null);
  };

  useEffect(() => {
    if (state.gameOver || state.currentPlayer !== 'player2') return;

    let cancelled = false;
    setThinking(true);

    const timer = window.setTimeout(() => {
      try {
        if (cancelled) return;

        let s = state;
        // 連続キャプチャはルール上同一手番なので継続する。
        // ただし盤面上の相手駒数には上限があるため、上限を明示して
        // UI側で無限ループを起こさない。
        for (let i = 0; i < 12 && !s.gameOver && s.currentPlayer === 'player2'; i++) {
          const move = getMCTSMove(s);
          if (!move?.from) break;

          const next = movePiece(s, move.from, move.to);
          if (next === s) break;
          s = next;

          if (!s.canCapture) break;
        }

        if (!cancelled) setState(s);
      } catch (error) {
        console.error('AI move failed:', error);
      } finally {
        if (!cancelled) setThinking(false);
      }
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state.gameOver, state.currentPlayer]);

  const choose = (pos: Position) => {
    if (thinking || state.gameOver || state.currentPlayer !== 'player1') return;
    if (selected) {
      if (getValidMoves(state.board, selected).some(p => p.row === pos.row && p.col === pos.col) &&
          (!isFirstMove(state) || (pos.row === CENTER && pos.col === CENTER))) {
        setState(movePiece(state, selected, pos));
        setSelected(null);
        setHint(null);
        return;
      }
    }
    if (state.board[pos.row][pos.col] === 'player1') {
      setSelected(pos);
    } else {
      setSelected(null);
    }
  };

  const showHint = () => {
    if (state.currentPlayer !== 'player1' || state.gameOver) return;
    setHint(getMCTSMove(state));
  };

  const valid = selected ? getValidMoves(state.board, selected) : [];
  const p1 = countPieces(state.board, 'player1');
  const p2 = countPieces(state.board, 'player2');

  return (
    <main className="min-h-screen bg-stone-950 text-amber-100 flex flex-col items-center p-6">
      <header className="w-full max-w-3xl flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">シーガ</h1>
          <p className="text-sm text-amber-300/70">特別ルール版 · MCTS AI</p>
        </div>
        <div className="flex gap-2">
          <button onClick={showHint} className="px-3 py-2 rounded bg-cyan-900 hover:bg-cyan-800">ヒント</button>
          <button onClick={reset} className="px-3 py-2 rounded bg-amber-700 hover:bg-amber-600">リセット</button>
        </div>
      </header>

      <section className="w-full max-w-3xl mb-4 flex justify-between text-sm">
        <span>あなた: {p1} 個</span>
        <span>{thinking ? 'AI思考中…' : state.gameOver ? (state.winner === 'player1' ? 'あなたの勝ち' : 'AIの勝ち') : state.message}</span>
        <span>AI: {p2} 個</span>
      </section>

      <div className="grid grid-cols-5 w-full max-w-[520px] aspect-square border-4 border-amber-800 bg-amber-950 shadow-2xl">
        {state.board.map((row, r) => row.map((cell, c) => {
          const isSelected = selected?.row === r && selected?.col === c;
          const isValid = valid.some(p => p.row === r && p.col === c) &&
            (!isFirstMove(state) || (r === CENTER && c === CENTER));
          const isHint = hint?.to.row === r && hint?.to.col === c;
          return (
            <button key={`${r}-${c}`} onClick={() => choose({row:r,col:c})}
              className={`relative border border-amber-900 flex items-center justify-center aspect-square ${(r+c)%2 ? 'bg-amber-900/40' : 'bg-amber-800/30'} ${isSelected ? 'ring-4 ring-cyan-400 z-10' : ''} ${isValid ? 'ring-4 ring-green-400/70 z-10' : ''} ${isHint ? 'ring-4 ring-yellow-300 z-10' : ''}`}>
              {r === CENTER && c === CENTER && cell === null && isFirstMove(state) && <span className="text-xs text-amber-300">中央</span>}
              {cell === 'player1' && <span className="w-3/5 h-3/5 rounded-full bg-white shadow-lg border-4 border-stone-300" />}
              {cell === 'player2' && <span className="w-3/5 h-3/5 rounded-full bg-stone-800 shadow-lg border-4 border-stone-950" />}
            </button>
          );
        }))}
      </div>

      <div className="mt-6 w-full max-w-[520px] bg-stone-900 rounded-xl p-5 text-sm space-y-2">
        <h2 className="font-bold text-lg">ルール</h2>
        <p>初期盤面は12個ずつの特別配置。中央だけ空いています。</p>
        <p>上下左右に1マス移動します。先手の最初の一手は中央です。</p>
        <p>相手を自分の駒で挟むと捕獲し、捕獲可能なら同じ手番を継続します。</p>
        <p>相手の駒が1個以下になると勝利です。</p>
      </div>
    </main>
  );
}
