#!/bin/bash

# シーガ ゲーム - GitHub Pages デプロイスクリプト

echo "🏛️ シーガ ゲームをGitHub Pagesにデプロイします"
echo ""

# GitHubリポジトリのURLを確認
read -p "GitHubリポジトリのURLを入力してください (例: https://github.com/username/seega-game.git): " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ リポジトリURLが入力されませんでした"
    exit 1
fi

# Gitリポジトリの初期化
echo "📦 Gitリポジトリを初期化しています..."
git init
git add .
git commit -m "Initial commit: Seega game with AlphaGo-style AI"

# リモートリポジトリの設定
echo "🔗 リモートリポジトリを設定しています..."
git branch -M main
git remote add origin $REPO_URL

# プッシュ
echo "🚀 GitHubにプッシュしています..."
git push -u origin main

echo ""
echo "✅ プッシュが完了しました！"
echo ""
echo "📋 次の手順:"
echo "1. GitHubリポジトリのページにアクセス: $REPO_URL"
echo "2. Settings > Pages をクリック"
echo "3. Source で 'GitHub Actions' を選択"
echo "4. 数分待ってから、以下のURLにアクセス:"
echo "   https://$(echo $REPO_URL | sed 's/https:\/\/github.com\///' | sed 's/\.git$//').github.io/$(basename $REPO_URL .git)/"
echo ""
echo "🎉 デプロイが完了すると、上記のURLでゲームをプレイできます！"
