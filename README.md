# シーガ（Seega）- 古代エジプトのボードゲーム

🏛️ 古代エジプトで遊ばれていた戦略的ボードゲーム「シーガ」を、AlphaGo風のAI（モンテカルロ木探索＋ニューラルネットワーク）と対戦できるWebアプリケーションです。

## 🎮 ゲームの特徴

- **正しいシーガのルール** - Wikipediaに基づいた正確な実装
- **強力なAI** - MCTS（モンテカルロ木探索）とニューラルネットワークを搭載
- **美しいUI** - エジプト風の豪華なデザイン
- **サウンドエフェクト** - 配置音、移動音、キャプチャ音など
- **ゲーム統計** - 勝率、最短勝利時間などを記録
- **チュートリアル** - 初心者向けのガイド
- **ヒント機能** - AIが最善手を提案
- **巻き戻し機能** - 手を戻せる

## 🎯 シーガのルール

1. **配置フェーズ**: 各プレイヤーが交互に2個ずつ駒を配置（中央以外、各12個ずつ）
2. **移動フェーズ**: 先手の最初の一手は中央へ。以降は上下左右に1マス移動
3. **挟み取り**: 相手の駒を縦横で挟むと取れる
4. **連続キャプチャ**: 挟んだらもう一度移動できる
5. **勝利条件**: 相手の駒を1個以下にする

## 🚀 デプロイ方法（URLを作成）

### 方法1: 自動デプロイスクリプト（推奨）

**Mac/Linux:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Windows:**
```bash
deploy.bat
```

スクリプトがGitHubリポジトリのURLを聞いて、自動的にデプロイします。

### 方法2: 手動デプロイ（GitHub Pages）

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

### 方法3: Vercel（最も簡単）

1. https://vercel.com にアクセス
2. GitHubアカウントでログイン
3. "New Project" をクリック
4. このリポジトリを選択
5. "Deploy" をクリック
6. 数秒でURLが発行されます！

### 方法4: Netlify Drop（ブラウザだけで完結）

1. https://app.netlify.com/drop にアクセス
2. `dist` フォルダをブラウザにドラッグ＆ドロップ
3. 即座にURLが発行されます！

### その他のデプロイ方法

#### Vercel
```bash
npm install -g vercel
vercel
```

#### Netlify
1. https://app.netlify.com/drop にアクセス
2. `dist` フォルダをドラッグ＆ドロップ

#### ローカル開発
```bash
npm install
npm run dev
# http://localhost:5173 でアクセス
```

## 🛠️ 技術スタック

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Web Audio API（サウンドエフェクト）

## 📦 ビルド

```bash
npm run build
```

ビルド済みファイルは `dist` フォルダに生成されます。

## 🎓 操作方法

- **マウス**: 駒をクリックして選択 → 移動先をクリック
- **キーボード**:
  - `ESC`: 選択解除
  - `R`: リセット
  - `H`: ヒント表示
  - `Ctrl+Z`: 巻き戻し
  - 矢印キー: 駒を移動

## 📊 ゲーム統計

- 対戦数
- 勝率
- 最短勝利時間
- 総獲得駒数

統計はブラウザのlocalStorageに保存されます。

## 🏛️ 歴史

シーガは紀元前のエジプトで遊ばれていた世界最古のボードゲームの一つです。遊牧民が砂に穴を掘って石で遊んでいたとされています。

## 📝 ライセンス

MIT License

## 🙏 謝辞

- Wikipedia（シーガのルール）
- AlphaGo（MCTSのアルゴリズム）

---

Made with ❤️ for ancient Egyptian board games
