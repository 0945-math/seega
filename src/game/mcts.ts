// AlphaGo風AI - モンテカルロ木探索（MCTS）＋ニューラルネットワーク
// シーガ（Seega）用

import { Board, Player, Position, GameState, getValidMoves, getCaptures, countPieces, isFirstMove, PIECES_PER_PLAYER } from './seega';

const BOARD_SIZE = 5;
const CENTER = Math.floor(BOARD_SIZE / 2);

// ===== ニューラルネットワーク（簡易版） =====

class NeuralNetwork {
  private weights1: number[][];
  private bias1: number[];
  private weights2: number[][];
  private bias2: number[];
  private weights3: number[][];
  private bias3: number[];

  constructor() {
    // 入力: 50次元（盤面25 + 特徴量25）
    // 隠れ層1: 64次元
    // 隠れ層2: 32次元
    // 出力: 25次元（各セルの確率）+ 1次元（勝率予測）
    
    // 重みを初期化（Xavier初期化）
    this.weights1 = this.initializeWeights(50, 64);
    this.bias1 = new Array(64).fill(0);
    this.weights2 = this.initializeWeights(64, 32);
    this.bias2 = new Array(32).fill(0);
    this.weights3 = this.initializeWeights(32, 26);
    this.bias3 = new Array(26).fill(0);
  }

  private initializeWeights(rows: number, cols: number): number[][] {
    const scale = Math.sqrt(2.0 / rows);
    return Array(rows).fill(null).map(() => 
      Array(cols).fill(null).map(() => (Math.random() * 2 - 1) * scale)
    );
  }

  private relu(x: number): number {
    return Math.max(0, x);
  }

  private softmax(x: number[]): number[] {
    const maxVal = Math.max(...x);
    const exps = x.map(v => Math.exp(v - maxVal));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(v => v / sum);
  }

  // 特徴量抽出
  private extractFeatures(board: Board, player: Player): number[] {
    const features: number[] = [];
    const opponent: Player = player === 'player1' ? 'player2' : 'player1';

    // 盤面状態（25次元）
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = board[r][c];
        if (cell === player) features.push(1);
        else if (cell === opponent) features.push(-1);
        else features.push(0);
      }
    }

    // 追加特徴量（25次元）
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        let value = 0;
        
        // 中央からの距離
        const dist = Math.abs(r - CENTER) + Math.abs(c - CENTER);
        value += (4 - dist) * 0.1;
        
        // 隣接する自分の駒数
        const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
        let adjacentFriendly = 0;
        let adjacentEnemy = 0;
        for (const dir of dirs) {
          const ar = r + dir.dr;
          const ac = c + dir.dc;
          if (ar >= 0 && ar < BOARD_SIZE && ac >= 0 && ac < BOARD_SIZE) {
            if (board[ar][ac] === player) adjacentFriendly++;
            else if (board[ar][ac] === opponent) adjacentEnemy++;
          }
        }
        value += adjacentFriendly * 0.2;
        value -= adjacentEnemy * 0.1;
        
        features.push(value);
      }
    }

    return features;
  }

  // 順伝播
  forward(board: Board, player: Player): { policy: number[]; value: number } {
    const input = this.extractFeatures(board, player);

    // 隠れ層1
    const hidden1 = new Array(64).fill(0);
    for (let i = 0; i < 64; i++) {
      let sum = this.bias1[i];
      for (let j = 0; j < 50; j++) {
        sum += input[j] * this.weights1[j][i];
      }
      hidden1[i] = this.relu(sum);
    }

    // 隠れ層2
    const hidden2 = new Array(32).fill(0);
    for (let i = 0; i < 32; i++) {
      let sum = this.bias2[i];
      for (let j = 0; j < 64; j++) {
        sum += hidden1[j] * this.weights2[j][i];
      }
      hidden2[i] = this.relu(sum);
    }

    // 出力層
    const output = new Array(26).fill(0);
    for (let i = 0; i < 26; i++) {
      let sum = this.bias3[i];
      for (let j = 0; j < 32; j++) {
        sum += hidden2[j] * this.weights3[j][i];
      }
      output[i] = sum;
    }

    // ポリシー（最初の25次元）とバリュー（最後の1次元）
    const policy = this.softmax(output.slice(0, 25));
    const value = Math.tanh(output[25]); // -1 to 1

    return { policy, value };
  }
}

// ===== モンテカルロ木探索（MCTS） =====

interface MCTSNode {
  state: GameState;
  parent: MCTSNode | null;
  children: Map<string, MCTSNode>;
  visits: number;
  wins: number;
  prior: number;
  move?: { from?: Position; to: Position };
}

class MCTS {
  private nn: NeuralNetwork;
  private c_puct: number = 1.5; // 探索パラメータ
  private maxSimulations: number;

  constructor(maxSimulations: number = 30) {
    this.nn = new NeuralNetwork();
    this.maxSimulations = maxSimulations;
  }

  // UCB値の計算
  private ucbValue(node: MCTSNode, parentVisits: number): number {
    if (node.visits === 0) return Infinity;
    const qValue = node.wins / node.visits;
    const uValue = this.c_puct * node.prior * Math.sqrt(parentVisits) / (1 + node.visits);
    return qValue + uValue;
  }

  // 状態を文字列キーに変換
  private stateKey(state: GameState): string {
    return JSON.stringify({
      board: state.board,
      currentPlayer: state.currentPlayer,
      phase: state.phase,
      totalPlaced: state.totalPlaced,
    });
  }

  // 合法手を生成
  private getLegalMoves(state: GameState): { from?: Position; to: Position }[] {
    const moves: { from?: Position; to: Position }[] = [];
    const player = state.currentPlayer;

    if (state.phase === 'placing') {
      // 配置フェーズ - 2個ずつ配置
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (state.board[r][c] === null && !(r === CENTER && c === CENTER)) {
            moves.push({ to: { row: r, col: c } });
          }
        }
      }
    } else if (state.phase === 'moving') {
      const isFirst = isFirstMove(state);

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (state.board[r][c] !== player) continue;
          const from = { row: r, col: c };
          for (const move of getValidMoves(state.board, from)) {
            if (isFirst && !(move.row === CENTER && move.col === CENTER)) continue;
            moves.push({ from, to: move });
          }
        }
      }
    }

    return moves;
  }

  // 手を適用する。実戦側の movePiece と同じく、連続キャプチャを探索木にも反映する。
  private applyMove(state: GameState, move: { from?: Position; to: Position }): GameState {
    const newState: GameState = {
      ...state,
      board: state.board.map(row => [...row]),
      capturedBy: { ...state.capturedBy },
    };
    const player = state.currentPlayer;

    if (!move.from) {
      newState.board[move.to.row][move.to.col] = player;
      newState.totalPlaced = { ...state.totalPlaced, [player]: state.totalPlaced[player] + 1 };
      newState.piecesPlacedThisTurn = state.piecesPlacedThisTurn + 1;

      if (newState.totalPlaced.player1 >= PIECES_PER_PLAYER &&
          newState.totalPlaced.player2 >= PIECES_PER_PLAYER) {
        newState.phase = 'moving';
        newState.piecesPlacedThisTurn = 0;
      } else if (newState.piecesPlacedThisTurn >= 2) {
        newState.currentPlayer = player === 'player1' ? 'player2' : 'player1';
        newState.piecesPlacedThisTurn = 0;
      }
      return newState;
    }

    newState.board[move.from.row][move.from.col] = null;
    newState.board[move.to.row][move.to.col] = player;

    const captures = getCaptures(newState.board, move.to, player);
    for (const cap of captures) {
      newState.board[cap.row][cap.col] = null;
    }
    newState.capturedBy[player] += captures.length;

    const opponent: Player = player === 'player1' ? 'player2' : 'player1';
    const opponentPieces = countPieces(newState.board, opponent);

    if (opponentPieces <= 1) {
      newState.gameOver = true;
      newState.winner = player;
      newState.canCapture = false;
      return newState;
    }

    newState.canCapture = captures.length > 0 && this.hasAnyCapturePossible(newState.board, player);
    if (!newState.canCapture) {
      newState.currentPlayer = opponent;
    }

    return newState;
  }

  private hasAnyCapturePossible(board: Board, player: Player): boolean {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== player) continue;
        const from = { row: r, col: c };
        for (const to of getValidMoves(board, from)) {
          const testBoard = board.map(row => [...row]);
          testBoard[r][c] = null;
          testBoard[to.row][to.col] = player;
          if (getCaptures(testBoard, to, player).length > 0) return true;
        }
      }
    }
    return false;
  }

  // シミュレーション（ロールアウト）
  private simulate(state: GameState, player: Player): number {
    let currentState = { ...state };
    let depth = 0;
    const maxDepth = 30;

    while (!currentState.gameOver && depth < maxDepth) {
      const moves = this.getLegalMoves(currentState);
      if (moves.length === 0) break;

      // ランダムに手を選択
      const move = moves[Math.floor(Math.random() * moves.length)];
      currentState = this.applyMove(currentState, move);
      depth++;
    }

    // 勝敗を返す
    if (currentState.winner === player) return 1;
    if (currentState.winner && currentState.winner !== player) return -1;
    return 0; // 引き分け
  }

  // 選択（Selection）
  private select(node: MCTSNode): MCTSNode {
    let current = node;
    
    while (current.children.size > 0) {
      let bestChild: MCTSNode | null = null;
      let bestUCB = -Infinity;

      for (const child of current.children.values()) {
        const ucb = this.ucbValue(child, current.visits);
        if (ucb > bestUCB) {
          bestUCB = ucb;
          bestChild = child;
        }
      }

      if (!bestChild) break;
      current = bestChild;
    }

    return current;
  }

  // 展開（Expansion）
  private expand(node: MCTSNode): void {
    const { policy } = this.nn.forward(node.state.board, node.state.currentPlayer);
    const moves = this.getLegalMoves(node.state);

    for (const move of moves) {
      const key = JSON.stringify(move);
      if (!node.children.has(key)) {
        const newState = this.applyMove(node.state, move);
        const childNode: MCTSNode = {
          state: newState,
          parent: node,
          children: new Map(),
          visits: 0,
          wins: 0,
          prior: policy[move.to.row * BOARD_SIZE + move.to.col] || 0.01,
          move,
        };
        node.children.set(key, childNode);
      }
    }
  }

  // バックプロパゲーション
  private backpropagate(node: MCTSNode, value: number, rootPlayer: Player): void {
    let current: MCTSNode | null = node;

    while (current) {
      current.visits++;
      current.wins += current.state.currentPlayer === rootPlayer ? value : -value;
      current = current.parent;
    }
  }

  // 検索実行
  search(state: GameState, numSimulations?: number): { from?: Position; to: Position } | null {
    const simulations = numSimulations || this.maxSimulations;
    
    // ルートノード作成
    const root: MCTSNode = {
      state,
      parent: null,
      children: new Map(),
      visits: 0,
      wins: 0,
      prior: 1,
    };

    // MCTSループ
    for (let i = 0; i < simulations; i++) {
      let leaf = this.select(root);

      if (!leaf.state.gameOver) {
        this.expand(leaf);

        // expand は子を一括生成するため、その直後に UCB 最大の子を1つ選ぶ。
        if (leaf.children.size > 0) {
          leaf = this.select(leaf);
        }
      }

      const value = leaf.state.gameOver
        ? (leaf.state.winner === state.currentPlayer ? 1 : -1)
        : this.simulate(leaf.state, state.currentPlayer);

      this.backpropagate(leaf, value, state.currentPlayer);
    }

    // 最も訪問された手を選択
    let bestMove: { from?: Position; to: Position } | null = null;
    let bestVisits = -1;

    for (const child of root.children.values()) {
      if (child.visits > bestVisits) {
        bestVisits = child.visits;
        bestMove = child.move || null;
      }
    }

    return bestMove;
  }
}

// ===== 公開API =====

const mcts = new MCTS(32); // ブラウザ向け: 1手あたり32シミュレーション

export function getMCTSMove(state: GameState): { from?: Position; to: Position } | null {
  return mcts.search(state);
}

export function getMCTSPlacement(state: GameState): Position {
  const move = mcts.search(state);
  return move ? move.to : { row: 0, col: 0 };
}
