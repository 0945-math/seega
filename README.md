# 🏛️ シーガ (Seega) - 古代エジプトのボードゲーム

古代エジプトで遊ばれていた戦略的ボードゲーム「シーガ」を、**AlphaGo風AI**（モンテカルロ木探索＋ニューラルネットワーク）と対戦できるWebアプリケーションです。

![Seega Game](https://img.shields.io/badge/Game-Seega-gold)
![AI](https://img.shields.io/badge/AI-MCTS%20%2B%20Neural%20Network-blue)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## 🎮 ゲームの特徴

- ✅ **正しいシーガのルール** - Wikipediaに基づいた正確な実装
- 🧠 **強力なAI** - MCTS（モンテカルロ木探索）とニューラルネットワークを搭載
- 🎨 **美しいUI** - エジプト風の豪華なデザイン
- 🔊 **サウンドエフェクト** - 配置音、移動音、キャプチャ音など
- 📊 **ゲーム統計** - 勝率、最短勝利時間などを記録
- 🎓 **チュートリアル** - 初心者向けのガイド
- 💡 **ヒント機能** - AIが最善手を提案
- ↩️ **巻き戻し機能** - 手を戻せる
- ⌨️ **キーボード操作** - ESC, R, H, Ctrl+Z, 矢印キー

## 🎯 シーガのルール

1. **配置フェーズ**: 各プレイヤーが交互に**2個ずつ**駒を配置（中央以外、各12個ずつ）
2. **移動フェーズ**: 先手の最初の一手は**中央へ**。以降は上下左右に1マス移動
3. **挟み取り**: 相手の駒を縦横で挟むと取れる
4. **連続キャプチャ**: 挟んだらもう一度移動できる
5. **勝利条件**: 相手の駒を**1個以下**にする

## 🚀 クイックスタート

### 方法1: 開発サーバーで起動

```bash
# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev

# ブラウザで http://localhost:3000 を開く
```

### 方法2: ビルドして静的ファイルとして使用

```bash
# ビルド
npm run build

# distフォルダが生成されるので、これをWebサーバーに配置
```

## 🌐 デプロイ方法

### GitHub Pages（推奨）

1. GitHubで新しいリポジトリを作成（例: `seega-game`）

2. このプロジェクトをGitHubにプッシュ
```bash
git init
git add .
git commit -m "Initial commit: Seega game with AlphaGo-style AI"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/seega-game.git
git push -u origin main
```

3. GitHubリポジトリのページで:
   - **Settings** タブをクリック
   - 左メニューの **Pages** をクリック
   - **Source** で **GitHub Actions** を選択
   - 自動的にデプロイが開始されます

4. 数分後、以下のURLでアクセス可能:
   ```
   https://YOUR_USERNAME.github.io/seega-game/
   ```

### Vercel（最も簡単）

1. https://vercel.com にアクセス
2. GitHubアカウントでログイン
3. "New Project" をクリック
4. このリポジトリを選択
5. "Deploy" をクリック
6. 数秒でURLが発行されます！

### Netlify Drop（ブラウザだけで完結）

1. https://app.netlify.com/drop にアクセス
2. `dist` フォルダをブラウザにドラッグ＆ドロップ
3. 即座にURLが発行されます！

## 🛠️ 技術スタック

- **React 18** - UIフレームワーク
- **TypeScript** - 型安全性
- **Vite** - ビルドツール
- **Tailwind CSS** - スタイリング
- **Web Audio API** - サウンドエフェクト
- **MCTS** - モンテカルロ木探索（AlphaGoのアルゴリズム）
- **Neural Network** - 簡易ニューラルネットワーク

## 📁 プロジェクト構造

```
seega-game/
├── src/
│   ├── game/
│   │   ├── seega.ts      # ゲームロジック
│   │   └── mcts.ts       # AlphaGo風AI
│   ├── App.tsx           # メインコンポーネント
│   ├── main.tsx          # エントリーポイント
│   └── index.css         # スタイル
├── public/
│   └── 404.html          # GitHub Pages SPA対応
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions自動デプロイ
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.js
└── README.md
```

## 🎓 操作方法

### マウス操作
- 駒をクリックして選択 → 移動先をクリック
- 配置フェーズでは、置きたい場所をクリック

### キーボードショートカット
- `ESC`: 選択解除
- `R`: ゲームリセット
- `H`: ヒント表示
- `Ctrl+Z`: 一手巻き戻し
- `矢印キー`: 選択中の駒を移動

## 📊 ゲーム統計

統計はブラウザのlocalStorageに自動保存されます：

- **対戦数**: 総ゲーム数
- **勝率**: 勝利/敗北の割合
- **最短勝利**: 最速勝利の記録（秒）
- **総獲得駒数**: キャプチャした駒の合計

## 🧠 AIについて

このゲームのAIは、**AlphaGo**と同じ原理で動作します：

### モンテカルロ木探索（MCTS）
- 150回のシミュレーションで探索
- UCB（Upper Confidence Bound）で探索と活用のバランスを最適化
- 選択 → 展開 → シミュレーション → バックプロパゲーションの4ステップ

### ニューラルネットワーク
- 3層構造（入力50次元 → 隠れ層64次元 → 隠れ層32次元 → 出力26次元）
- **ポリシーネットワーク**: 各セルの確率分布を出力
- **バリューネットワーク**: 勝率予測（-1〜1）
- 特徴量抽出: 盤面状態 + 位置特徴 + 隣接駒数

## 🏛️ 歴史

シーガは紀元前のエジプトで遊ばれていた**世界最古のボードゲームの一つ**です。遊牧民が砂に穴を掘って石で遊んでいたとされています。1836年の文献にも記載があり、現在もエジプトや北アフリカで親しまれています。

## 🔧 開発

### 開発モード
```bash
npm run dev
```

### ビルド
```bash
npm run build
```

### 型チェック
```bash
npm run typecheck
```

## 📝 ライセンス

MIT License

## 🙏 謝辞

- **Wikipedia** - シーガのルールの参考
- **AlphaGo** - MCTSのアルゴリズムの参考
- **React & Vite** - 素晴らしいフレームワーク

## 🐛 バグ報告・機能要望

問題や要望があれば、GitHubのIssueで報告してください。

---

**Made with ❤️ for ancient Egyptian board games**
