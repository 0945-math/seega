#!/bin/bash

# シーガ ゲーム - GitHub Pages デプロイスクリプト

echo "🏛️ シーガ ゲームをGitHub Pagesにデプロイします"
echo ""

read -p "GitHubリポジトリのURLを入力してください (例: https://github.com/username/seega-game.git): " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ リポジトリURLが入力されませんでした"
    exit 1
fi

echo "📦 Gitリポジトリを初期化しています..."
git init
git add .
git commit -m "Initial commit: Seega game with AlphaGo-style AI"

echo "🔗 リモートリポジトリを設定しています..."
git branch -M main
git remote add origin $REPO_URL

echo "🚀 GitHubにプッシュしています..."
git push -u origin main

echo ""
echo "✅ プッシュが完了しました！"
