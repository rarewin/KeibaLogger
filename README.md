# KeibaLogger（競馬ロガー） 🏇

KeibaLogger は、競馬のレース予想、印、買い目馬券、収支を一括管理・分析できる Web アプリケーションです。  
JRA（中央競馬）および NAR（地方競馬・ばんえい競馬）に対応しており、netkeiba からのレース情報や出走表、レース結果の自動取得が可能です。

---

## 主な機能

- **📅 レース情報の自動取得 & スムーズな入力**
  - 開催日・競馬場（中央競馬・地方競馬・ばんえい帯広）・レース番号を選択してワンクリックで出走表・レース情報を自動取得。
  - netkeiba の URL やレース ID からの直接取得にも対応。
- **🎯 印・予想メモ管理**
  - 本命（◎）、対抗（◯）、穴（▲）、連下（△）の印付けと考察メモを保存。
  - 出走馬リストのクイックボタンや直接入力による印の設定に対応。
- **🎟️ 柔軟な馬券登録 & 自動的中判定**
  - 単勝、複勝、枠連、馬連、馬単、ワイド、3連複、3連単、応援馬券に対応。
  - BOX、流し、フォーメーションなどの買い目表記の自動展開に対応。
  - レース結果確定時に自動で的中判定および払戻金を算出。
- **📊 収支ダッシュボード & 分析モード**
  - 総投資額・総払戻額・収支・回収率・的中率をリアルタイムに集計。
  - 分析モードで券種別の回収率・的中率や競馬場別の成績、印別の好走傾向を可視化。
- **📜 ログ履歴一覧 & ソート**
  - 過去の予想・結果メモの一覧表示、編集、削除。
  - 日付、競馬場、レース番号、馬番、収支、回収率によるソート機能（収支・回収率ソート時は未確定レースを末尾に固定表示）。
- **📦 データのエクスポート & インポート**
  - 全レースメモ・買い目・出走馬・着順結果を JSON 形式でワンクリックバックアップ。
  - ファイルのドラッグ＆ドロップ対応インポートモーダル（件数プレビュー付き）。
  - 「追加・更新（マージ）」および「すべて置換（上書き復元）」の2種類のインポートモードに対応。

---

## 技術スタック

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router / Turbopack)
- **Library**: [React 19](https://react.dev/), TypeScript
- **Database / ORM**: SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)), [Prisma v7](https://www.prisma.io/)
- **Linter / Formatter**: [Biome](https://biomejs.dev/), ESLint

---

## 必要要件

- **Node.js**: `v20.x` 以上（`v20`〜`v24` 推奨）
- **npm** (または pnpm / yarn / bun)

---

## セットアップ手順

初めて環境を構築する場合は、以下の手順を実行してください。

### 1. リポジトリのクローン & ディレクトリ移動

```bash
git clone <repository-url>
cd KeibaLogger
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example` をコピーして `.env` を作成します。

```bash
cp .env.example .env
```

`.env` の内容（デフォルトでローカルの SQLite データベース `dev.db` を参照します）：

```env
DATABASE_URL="file:./dev.db"
```

※ デフォルト設定ではプロジェクトルートの `dev.db` を参照します。相対パス指定時は `file:./dev.db` を想定しています（別ファイル名や別パスにする場合は絶対パス指定を推奨します）。

### 4. データベースの初期化 & Prisma Client の生成

Prisma スキーマを SQLite データベースに反映し、Prisma Client を生成します。

```bash
npm run db:push
npm run db:generate
```

※ `dev.db` がプロジェクトルートに作成され、テーブルが自動構築されます。

### 5. 開発サーバーの起動

```bash
npm run dev
```

起動後、ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスしてください。

---

## 利用可能なスクリプト

| コマンド | 説明 |
| :--- | :--- |
| `npm run dev` | 開発サーバーを起動します（Next.js Turbopack） |
| `npm run build` | プロダクション向けにアプリケーションをビルドします |
| `npm run start` | ビルドしたプロダクションサーバーを起動します |
| `npm run lint` | ESLint によるコードチェックを実行します |
| `npm run check` | Biome によるコードチェックを実行します |
| `npm run format` | Biome によるコードフォーマットを実行します |
| `npm run db:push` | Prisma スキーマをデータベース（SQLite）へ直接同期・作成します |
| `npm run db:generate` | Prisma Client を再生成します |
| `npm run db:studio` | ブラウザでデータベース内容を確認・編集できる Prisma Studio を起動します |

---

## ディレクトリ構成

```text
├── prisma/
│   ├── migrations/       # マイグレーション履歴
│   └── schema.prisma     # Prisma スキーマ定義
├── src/
│   ├── app/
│   │   ├── api/scrape/   # netkeiba スクレイピング API エンドポイント
│   │   ├── actions.ts    # Server Actions（メモ・馬券の CRUD、エクスポート/インポート、集計処理）
│   │   ├── globals.css   # グローバルスタイル
│   │   ├── layout.tsx    # ルートレイアウト
│   │   ├── page.module.css # メインページのモジュール CSS
│   │   └── page.tsx      # メイン UI コンポーネント
│   └── lib/
│       └── prisma.ts     # PrismaClient インスタンス設定（better-sqlite3 アダプタ）
├── .env.example          # 環境変数のサンプル設定
├── biome.json            # Biome 設定
├── next.config.ts        # Next.js 設定
├── package.json          # 依存パッケージおよびスクリプト
├── prisma.config.ts      # Prisma v7 設定ファイル
└── tsconfig.json         # TypeScript 設定
```
