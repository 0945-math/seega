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
echo.
echo 📋 次の手順:
echo 1. GitHubリポジトリのページにアクセス: %REPO_URL%
echo 2. Settings ^> Pages をクリック
echo 3. Source で 'GitHub Actions' を選択
echo 4. 数分待ってから、以下のURLにアクセス:
echo    https://YOUR_USERNAME.github.io/REPO_NAME/
echo.
echo 🎉 デプロイが完了すると、上記のURLでゲームをプレイできます！
pause
