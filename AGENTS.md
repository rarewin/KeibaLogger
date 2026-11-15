<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Scratch Directory for Temporary / Verification Files
- 一時的な動作確認スクリプト、API検証用コード、実験用スクリプトなどの一時ファイルを作成する場合は、プロジェクトルートの `scratch/` ディレクトリ内に配置すること。
- `scratch/` は `.gitignore` に登録されており、Git管理対象外として本番コード（`src/` 配下など）を汚さずに検証作業を行うために使用する。

# Server Management Rules
- Next.jsなどのサーバープロセスの起動・停止・再起動（kill含む）は、AI側で直接実行せず、必ずユーザーに作業を依頼すること。

# Git Worktree Workspace Rules

- Git worktree 環境で作業を開始する場合、検証・ビルド前に以下のセットアップを行うこと：
  1. メインリポジトリのパスを動的に特定:
     ```bash
     MAIN_REPO="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"
     ```
  2. 依存関係のセットアップ:
     ※ Turbopack はプロジェクト外への `node_modules` シンボリックリンクを拒否するため、独立した `node_modules` を用意し、ネイティブバイナリをメインリポジトリから引き継ぐこと。
     ```bash
     npm install
     if [ -f "$MAIN_REPO/node_modules/better-sqlite3/build/Release/better_sqlite3.node" ]; then
       mkdir -p node_modules/better-sqlite3/build/Release
       cp "$MAIN_REPO/node_modules/better-sqlite3/build/Release/better_sqlite3.node" node_modules/better-sqlite3/build/Release/
     else
       npm rebuild better-sqlite3
     fi
     ```
  3. 環境変数設定: メインリポジトリからコピーする (`cp "$MAIN_REPO/.env" .env`)
  4. Prisma Client の生成:
     ```bash
     npm run db:generate
     ```
  5. DBの準備（必要な場合）: `npm run db:push` を実行するか、メインの `dev.db` をコピーして使用する (`cp "$MAIN_REPO/dev.db" ./dev.db`)



