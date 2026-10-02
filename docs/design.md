# ポートフォリオサイト 詳細設計（技術）

- ステータス: ドラフト
- 最終更新: 2026-10-02（IDE 風の構成へ変更）
- 前提: [要件定義](requirements.md)。見た目の詳細（配色・レイアウト）は対象外で、後で決める。

## 1. 全体構成

静的配信のみ（サーバーを持たない）。Vite+ のモノレポで役割ごとにプロジェクトを分ける。

| プロジェクト | 場所 | 役割 | 主な技術 |
| --- | --- | --- | --- |
| サイト | `apps/site` | メインパネルに表示するページ（各ディレクトリの `index.html`）と、コンテンツの正本（Content Collections） | Astro（静的生成） |
| IDE | `apps/ide` | ファイルツリー・ターミナル・パネルの切り替え・メインパネルの iframe・URL とカレントディレクトリの連動 | Vite、xterm.js（暫定）、WebContainer API |
| コンテナ | `apps/container` | WebContainer の作業ディレクトリにマウントするファイル群（サイトのディレクトリ構成。将来は projects） | TypeScript |

```
apps/site（Astro） ──ビルド──▶ 各ディレクトリの index.html・アセット ─┐
        │                                                           │
        └─ディレクトリ構成──▶ apps/container ──▶ マウント用ファイル群 ┤──▶ 配信物（Vercel の静的配信）
                                                                    │
apps/ide（Vite） ──ビルド──▶ IDE のスクリプト・CSS・フォント ────────┘
```

方針:

- **Astro のページが正の URL**（要件 6.1）。IDE はその上に重ねる「拡張」で、無くてもサイトは成り立つ。
- **最大化モードでは IDE を読み込まない**。Astro のページには、「最大化をやめる」ボタンと IDE の遅延読み込みだけを行う小さなスクリプトを入れる。
- **すべての HTML に COOP / COEP を付ける**（メインパネルの iframe に入るページも含む。要件 7.1）。

## 2. モノレポ構成

### 2.1 ディレクトリ

```
vite.config.ts           # Vite+ のルート設定（lint・fmt・タスク）
pnpm-workspace.yaml
vercel.json              # ヘッダー（COOP / COEP / HSTS）とビルド設定
apps/
  site/                  # Astro
    src/content/         # Content Collections（JSON ＋ スキーマ）
    src/pages/           # 各ディレクトリの index.html になるページ
    src/components/
      MaximizeToggle.astro  # 「最大化をやめる」ボタンと IDE の遅延読み込み
    public/fonts/        # フォント（OFL。ライセンス文を同梱）
  ide/                   # Vite（ライブラリとしてビルドし、site から読み込む）
    src/
      index.ts           # IDE モードの起動（パネル構成・iframe・ツリー・ターミナル）
      terminal.ts        # xterm.js と WebContainer
      tree.ts            # ファイルツリー
      sync.ts            # URL・カレントディレクトリ・iframe の連動（5章）
  container/
    src/build.ts         # site のビルド結果からディレクトリ構成を集め、マウント用ファイル群を出力
```

### 2.2 ツール

- **Vite+**（`vite-plus` 1.0.0、MIT）: lint（Oxlint）・フォーマット（Oxfmt）・テスト（Vitest）・タスク実行（`vp run`）。Vite 8 を含む。Astro も内部で Vite を使う。
- **パッケージマネージャー**: pnpm（workspaces）。Vite+ は既存のパッケージマネージャーを検出して使う。
- Node.js: 22.18 以上（Vite+ の要件 `^22.18.0 || ^24.11.0 || >=26.0.0`）。

### 2.3 ビルドの順序と配信物

`vp run build` のタスク依存で次の順に実行する。

1. `apps/site`: Astro で静的生成（Content Collections の検証を含む）。フォントをページに出る文字だけにサブセット化する
2. `apps/ide`: Vite でビルド（IDE のスクリプト・CSS・ターミナル用フォント）
3. `apps/container`: site のビルド結果から、マウント用のファイル群（WebContainer の `FileSystemTree`）を出力
4. 3つの出力を1つの配信物にまとめる（site の出力をルートに、IDE とコンテナの出力をサブディレクトリに置く）

| 配信物 | パス（例） | 備考 |
| --- | --- | --- |
| 各ページ | `/`、`/works/` など | Astro の出力 |
| IDE のスクリプトなど | `/_ide/…`（ハッシュ付き） | 最大化をやめたときに読み込む |
| マウント用ファイル群 | `/_ide/fs.json` など | IDE モードの起動時に取得してマウントする |

### 2.4 開発時

| 起動方法 | 用途 |
| --- | --- |
| `vp run dev:site` | ページの開発（Astro の開発サーバー） |
| `vp run dev` | IDE を含めた結合の確認（Astro の開発サーバーから IDE を読み込む） |

- 開発サーバーにも COOP / COEP を付ける（Astro / Vite の `server.headers`）。

## 3. ページ（apps/site）

- 各ディレクトリの `index.html` を Astro で静的生成する。ディレクトリ構成は後で決める（要件 4.1）。
- コンテンツの正本は Content Collections（JSON ＋ スキーマ）。スキーマに合わない場合はビルドが失敗する。
- アイコンは GitHub アカウントのアイコンをビルド時に取得して同梱し、自分のドメインから配信する（COEP の制約のため）。取得に失敗したらビルドを止める。
- 各ページに `MaximizeToggle` を置く。押されたら `import()` で IDE を読み込み、IDE モードを起動する。
- iframe の中で表示されているときは、`MaximizeToggle` を出さない（入れ子にしないため）。

## 4. IDE モード（apps/ide）

### 4.1 起動の流れ

1. 現在のページの上に、メインパネル・ファイルツリー・ターミナルのレイアウトを作る
2. メインパネルの iframe に、現在の URL のページを読み込む（同じオリジン）
3. ターミナル用フォントの読み込みを待ってから xterm.js を開く（Unicode 11 の文字幅を有効にする。9章）
4. WebContainer を起動する（時間で打ち切り。要件 7.1）。API キーが必要なら `boot()` の前に `configureAPIKey()` を呼ぶ
5. マウント用ファイル群を取得して作業ディレクトリにマウントする
6. シェル（`jsh`）を起動し、現在の URL に対応するディレクトリへ `cd` した状態にする
7. WebContainer の帰属表示を出す（必須。場所・文言は後で決める）

### 4.2 ファイルツリー

- WebContainer のファイルシステムを読んで表示する（`fs.readdir`。変更は `fs.watch` で追従）。
- 将来、projects の配下に入ったら、そのプロジェクトを起点にした表示に切り替える（要件 5.3）。

## 5. URL・カレントディレクトリ・メインパネルの連動

要件 5.4 の連動を、次の3つの経路で扱う。

| きっかけ | 処理 |
| --- | --- |
| ターミナルで `cd` | カレントディレクトリの変化を検知 → URL を `history.pushState` で更新 → iframe を対応するページへ移動 |
| メインパネル内のリンク | iframe の移動を検知（同じオリジンなので `load` イベントで `location` を読める）→ URL を更新 → ターミナルのカレントディレクトリを合わせる |
| ブラウザの戻る・進む | `popstate` → iframe を移動 → カレントディレクトリを合わせる |

要検証（実装の初期に確かめる）:

- **`jsh` のカレントディレクトリの変化を、外から知る方法**。候補: (1) 自前の `cd` 関数やプロンプトで OSC 7 などのエスケープシーケンスを出させ、xterm.js 側で受け取る、(2) 入力されたコマンドを監視する、(3) WebContainer のプロセス情報から取得する。`jsh` がどこまで設定できるか（プロンプトや関数の定義）は未確認。
- **ターミナルのカレントディレクトリを外から変える方法**（リンクで移動したとき）。シェルへ `cd …` を入力として送る方法が最も単純だが、ターミナルに入力が見える。見せるか隠すかは見た目と合わせて決める。
- 連動が循環しない仕組み（`cd` → URL 更新 → iframe 移動 → 再び `cd`、とならないように、きっかけを区別する）。

## 6. 配信とヘッダー（Vercel）

`vercel.json` で次を設定する。

| 対象 | ヘッダー |
| --- | --- |
| すべての HTML | `Cross-Origin-Opener-Policy: same-origin`、`Cross-Origin-Embedder-Policy: require-corp`、`Strict-Transport-Security: max-age=31536000` |
| ハッシュ付きの静的ファイル | `Cache-Control: public, max-age=31536000, immutable` |

- http から https へのリダイレクトは Vercel が行う。
- 存在しないパスは Astro の 404 ページを返す。

## 7. 将来: projects（要件 5.3）

- ソースはビルド時に集めて同梱し、`cd projects/<name>` したときに非同期で取得してマウントする。
- メインパネルは README.md の Markdown プレビューに切り替える。
- WebContainer の `server-ready` イベントで得た URL を、メインパネルの iframe に表示する。
- 要調査: WebContainer のプレビューを iframe で表示するときの COOP / COEP との両立。
- 作るかどうかは、初回公開後の実装の状況とセッションの使用状況を見て判断する。そのために IDE モードを開いた回数を把握する（方法は未決定）。

## 8. テスト

| 種類 | 内容 |
| --- | --- |
| ビルド時の検証 | Content Collections のスキーマ検証（失敗でビルドを止める） |
| ブラウザ（E2E） | Playwright で、最大化モードの表示、ヘッダーにより `crossOriginIsolated` が `true`、IDE モードへの切り替え、`cd` と URL・iframe の連動、戻る・進む |
| ページ | 各ページが IDE なしで読めること（JavaScript を無効にしても内容が表示される） |

## 9. 技術検証の結果（2026-10-02）

### 9.1 xterm.js 6.0.0 の装飾対応（ソース確認＋ブラウザで描画確認）

| 属性 | SGR | 対応 |
| --- | --- | --- |
| 太字 / 細字 / 斜体 | 1 / 2 / 3 | ✓ |
| 下線（単線・二重・波線・点線・破線） | 4, 4:2〜4:5 | ✓ |
| 下線の色 | 58 | ✓ |
| 点滅 / 反転 / 不可視 / 取り消し線 / 上線 | 5 / 7 / 8 / 9 / 53 | ✓ |
| 16色 / 256色 / 24bit | 30–37, 90–97 / 38;5 / 38;2 | ✓ |
| ハイパーリンク | OSC 8 | ✓（`linkHandler` で挙動を設定できる） |
| ハーフブロックによる画像表現 | `▀` ＋ 前景色・背景色 | ✓ |

### 9.2 文字幅の実測（xterm.js と string-width）

| 文字 | xterm.js（Unicode 6・既定） | xterm.js（Unicode 11） | string-width |
| --- | --- | --- | --- |
| `a` | 1 | 1 | 1 |
| `あ` `漢` | 2 | 2 | 2 |
| `ｱ`（半角カナ） | 1 | 1 | 1 |
| `─` `│` `▀` `█` | 1 | 1 | 1 |
| `🔥` `🚀` `💤`（許可する絵文字） | **1** | 2 | 2 |
| `❤️`（VS16） | 1 | 1 | **2** |
| `👨‍💻`（ZWJ） | 2 | **4** | 2 |
| `👍🏽`（肌色） | 2 | **4** | 2 |

→ ターミナルでは Unicode 11 の規則を有効にする（絵文字を2桁として扱うため）。結合した絵文字などは実装ごとに幅が食い違うが、curl の入口を廃止したため、制限は設けない。


## 10. 未決定・要検証

| 項目 | 種類 |
| --- | --- |
| `jsh` のカレントディレクトリの検知と変更の方法（5章） | 要検証（実装の初期） |
| ディレクトリ構成・経歴の粒度・Content Collections のスキーマ | 要件（中身） |
| 配色・レイアウト | 要件（見た目。後で決める） |
| ターミナルの表示部品（xterm.js）の確定 | 要件（暫定） |
| スマートフォンで IDE モードを出すか | 要件 |
| IDE モードを開いた回数の把握方法 | 要件（projects の判断材料） |
| 帰属表示の場所・文言、API セッションの数え方 | 後で決める（要件 7.3） |
| Noto Color Emoji（COLRv1）の Safari 対応 | 要検証 |
| projects のプレビュー iframe と COOP / COEP の両立 | 要調査（将来） |
