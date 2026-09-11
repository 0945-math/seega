@echo off
echo 🏛️ シーガ ゲームをGitHub Pagesにデプロイします
echo.

set /p REPO_URL="GitHubリポジトリのURLを入力してください (例: https://github.com/username/seega-game.git): "

if "%REPO_URL%"=="" (
    echo ❌ リポジトリURLが入力されませんでした
    pause
    exit /b 1
)

echo 📦 Gitリポジトリを初期化しています...
git init
git add .
git commit -m "Initial commit: Seega game with AlphaGo-style AI"

echo 🔗 リモートリポジトリを設定しています...
git branch -M main
git remote add origin %REPO_URL%

echo 🚀 GitHubにプッシュしています...
git push -u origin main

echo.
echo ✅ プッシュが完了しました！
pause
