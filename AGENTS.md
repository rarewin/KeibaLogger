<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Scratch Directory for Temporary / Verification Files
- 一時的な動作確認スクリプト、API検証用コード、実験用スクリプトなどの一時ファイルを作成する場合は、プロジェクトルートの `scratch/` ディレクトリ内に配置すること。
- `scratch/` は `.gitignore` に登録されており、Git管理対象外として本番コード（`src/` 配下など）を汚さずに検証作業を行うために使用する。

# Server Management Rules
- Next.jsなどのサーバープロセスの起動・停止・再起動（kill含む）は、AI側で直接実行せず、必ずユーザーに作業を依頼すること。


