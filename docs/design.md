# ポートフォリオサイト 詳細設計（技術）

- ステータス: ドラフト
- 最終更新: 2026-10-02
- 前提: [要件定義](requirements.md)。見た目の詳細（配色・アイコンの大きさ・レイアウト）は対象外で、後で決める。

## 1. 全体構成

Vite+（`vite-plus`）で管理するモノレポにし、役割ごとにプロジェクトを分ける（2026-10-02）。

| プロジェクト | 場所 | 役割 | 主な技術 |
| --- | --- | --- | --- |
| コンテンツ（共有） | `packages/content` | 正本 JSON・JSON Schema・検証・文書モデル・各形式への変換・桁幅・アイコンの変換 | TypeScript |
| サーバー | `apps/server` | 配信と出し分け（パスと `Accept` で、ビルド済みの応答を選んで返す） | Nitro |
| Web | `apps/web` | ブラウザ向けの HTML・CSS・JS（トップとターミナル） | Vite、xterm.js、WebContainer API |
| コンテナ | `apps/container` | WebContainer にマウントするファイル群（`career.md` などと、`curl` の代替コマンド。将来は作品フォルダ） | TypeScript |

```
                    packages/content（正本 JSON → 検証 → 文書モデル）
                     │ md / ansi           │ HTML 断片・アイコン PNG・文字一覧   │ md
                     ▼                     ▼                                    ▼
              apps/server            apps/web（Vite）                    apps/container
              （Nitro）                │ index.html                        │ マウント用ファイル群
                 ▲   ▲                 │ top.js / terminal.js / CSS / fonts│ （FileSystemTree）
                 │   └── server assets ┘ static ──────────────┐            │ static
                 │                                            ▼            ▼
                 └──────────────── Nitro の出力（Vercel にデプロイ）◀──────┘
```

ターミナルの表示には xterm.js を使う前提で設計する（要件 7章で有力候補として暫定）。

方針:

- **生成はすべてビルド時**に行い、実行時はビルド済みの応答を選んで返すだけにする（要件 7.4「実行時にファイルを読まない」「キャッシュを使わない」と一致）。
- **生成処理は `packages/content` に一本化**する。サーバー・Web・コンテナの各プロジェクトは、その生成物を使うだけで、独自に生成しない（3つの出力の食い違いを防ぐため）。
- **ランタイム非依存**: サーバーのコードは Nitro の標準 API（h3）だけを使い、判定に使うのはリクエストヘッダーのみ。
- **最終的な配信物は Nitro の出力1つ**にまとめる。Web とコンテナのビルド結果は、Nitro が静的ファイルまたは server assets として取り込む（2.3）。

## 2. モノレポ構成

### 2.1 ディレクトリ

```
vite.config.ts           # Vite+ のルート設定（lint・fmt・タスク）
pnpm-workspace.yaml
packages/
  content/
    site.json            # コンテンツの正本（SSOT）
    site.schema.json     # JSON Schema
    src/
      validate.ts
      document.ts        # 文書モデル
      render-markdown.ts
      render-ansi.ts
      render-html.ts     # トップの HTML 断片
      icon.ts            # アイコンの取得と変換
      width.ts           # 桁幅（xterm.js と同じ規則。7章）
    dist/                # 生成物（git 管理外）
apps/
  server/                # Nitro
    routes/[...path].ts  # 出し分けだけを行う
    nitro.config.ts
  web/                   # Vite
    index.html           # トップのテンプレート（content の HTML 断片を差し込む）
    src/
      top.ts             # コピーボタン・パネル開閉・ターミナルの遅延読み込み
      terminal/          # 遅延読み込みされるチャンク
        index.ts
        suggestion.ts    # 候補（ゴーストテキスト）
    fonts/               # フォント原本（OFL。ライセンス文を同梱）
    vite.config.ts
  container/
    files/               # マウントするファイルの元（固定のもの）
    src/
      curl-shim.ts       # 標準 curl が使えない場合の代替
      build.ts           # content の md と files/ をまとめ、FileSystemTree を出力
```

### 2.2 ツール

- **Vite+**（`vite-plus` 1.0.0、MIT）: lint（Oxlint）・フォーマット（Oxfmt）・テスト（Vitest）・タスク実行（`vp run`）をルートの `vite.config.ts` でまとめて管理する。Vite 8 を含む。
- **パッケージマネージャー**: pnpm（workspaces）。Vite+ は既存のパッケージマネージャーを検出して使う仕組みのため、別途必要。
- Node.js: 22.18 以上（Vite+ の要件 `^22.18.0 || ^24.11.0 || >=26.0.0` に合わせる）。

### 2.3 ビルドの順序と受け渡し

`vp run build` のタスク依存（`dependsOn`）で次の順に実行する。

1. `packages/content`: 検証 → 文書モデル → `*.md`・`*.ansi`・トップの HTML 断片・アイコン（PNG と ANSI）・トップに出る文字の一覧を `dist/` に出力
2. `apps/web` と `apps/container`（並行）
   - web: Vite でビルド。`index.html` に content の HTML 断片を差し込み、フォントをサブセット化（8章）し、`top.js` と遅延読み込みの `terminal.js` を出力
   - container: content の `*.md` と代替コマンドを WebContainer の `FileSystemTree`（JSON）にまとめて出力
3. `apps/server`: Nitro でビルド。次のように取り込む

| 取り込むもの | Nitro での扱い | 理由 |
| --- | --- | --- |
| content の `*.md` / `*.ansi` / トップの ANSI | server assets | 出し分けて返すため |
| web の `index.html` | **server assets**（静的ファイルにしない） | Vercel は静的ファイルを関数より先に返す。`/` に `index.html` を静的に置くと curl にも HTML が返り、出し分けが壊れるため |
| web の JS・CSS・フォント・アイコン | 静的ファイル（`publicAssets`） | ハッシュ付きファイル名で長期キャッシュ |
| container の `FileSystemTree` | 静的ファイル | ターミナルを開いたときに取得してマウントする |

### 2.4 開発時（2026-10-02）

用途で2つの起動方法を使い分ける。

| 起動方法 | 用途 | 入口 | 仕組み |
| --- | --- | --- | --- |
| `vp run dev:web` | 画面（トップ・ターミナル）の開発 | ブラウザは Vite の開発サーバー | Vite の開発サーバーで HMR を効かせる。トップの HTML には content の HTML 断片を Vite のプラグインで差し込む。詳細（`/career` など）とコンテナのファイル群へのリクエストは Nitro の開発サーバーへ転送する（Vite の `server.proxy`） |
| `vp run dev` | 結合の確認（本番と同じ経路） | Nitro の開発サーバー（curl もブラウザも同じポート） | web は Vite を監視モードでビルドし続け、その出力を Nitro が返す。トップの出し分けも本番と同じ |

- どちらも開発サーバーに COOP / COEP ヘッダーを付ける（Vite は `server.headers`、Nitro は応答側）。WebContainer が動かないため。
- `vp run dev:web` ではトップの出し分けは本番と別の経路になる。出し分けの確認は `vp run dev` と、ビルド後の出力に対する E2E テスト（12章）で行う。
- content の変更は監視して再生成し、両方の起動方法に反映する。

## 3. コンテンツ（SSOT）

### 3.1 `content/site.json` の構造（案）

```jsonc
{
  "github": "mew-ton",                      // アイコンの取得元
  "name": "mewton",
  "profile": "（簡単なプロフィール。1〜2文）",
  "links": [
    { "label": "GitHub", "url": "https://github.com/mew-ton" },
    { "label": "Email", "url": "mailto:…", "text": "…@…" }
  ],
  "career": [
    { "period": "20XX–", "title": "（経歴の見出し）", "note": "（短い説明）" }
  ],
  "skills": [
    { "name": "TypeScript", "motivation": "🔥", "note": "（備考）" }
  ],
  "talks": [
    { "kind": "登壇", "title": "…", "date": "2026-01-01", "venue": "…", "url": "https://…" }
  ]
}
```

- 経歴の粒度（社名・期間）は未決定（要件 10章）。上記は項目の器だけを決める。
- 長い文章は持たない（要件 8.2）。各文字列は 1〜2 文以内。

### 3.2 検証（ビルド時。1つでも失敗したらビルドを止める）

| 検証 | 方法 |
| --- | --- |
| 構造・型・必須項目 | JSON Schema（`ajv`） |
| スキルの絵文字が1つ・許可された種類か | 正規表現 `^\p{Emoji_Presentation}$`（単一コードポイント。VS16・ZWJ・肌色修飾を含むと不一致になる） |
| 各行が 80 桁以内か | 生成後の ANSI テキストを 7章の桁幅で計測 |
| URL の形式 | JSON Schema の `format: uri` |

## 4. ビルド手順

2.3 の順序で実行する。各段で使うライブラリ（案。実装時に確定）:

| 段 | ライブラリ | 用途 |
| --- | --- | --- |
| content | `ajv` | JSON Schema による検証 |
| content | `sharp` | アイコン画像の縮小と画素の読み取り |
| content | `@xterm/headless` ＋ `@xterm/addon-unicode11` | 桁幅の計測（7章） |
| web | Vite（Vite+ に同梱） | バンドル・HTML の生成 |
| web | `subset-font` | フォントのサブセット化 |

- GitHub アイコンの取得（`https://github.com/<github>.png?size=…`）に失敗したらビルドを止める（要件 8.2）。

## 5. 文書モデルと出力

### 5.1 方式

JSON → **文書モデル** → Markdown / ANSI / HTML の3形式。Markdown を解析し直す方式は取らない（ビルド時に生成する方式に合わせ、3形式が同じモデルから作られることで必ず一致させる）。

```ts
type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "emphasis"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; text: string; url: string };

type Block =
  | { type: "heading"; level: 1 | 2; content: Inline[] }   // 見出しは h2 まで（要件 8.1）
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; items: Inline[][] };
```

### 5.2 Markdown（`*.md`。`cat` とブラウザで表示）

- 標準的な Markdown をそのまま出力する。見出しは `#` / `##` のみ。
- 1行は 80 桁を目安に折り返す（`cat` で読みやすくするため。Markdown の意味は変わらない）。

### 5.3 ANSI（curl 向け）

記号は残し、記号に合った装飾を付ける（要件 8.1）。装飾は 9章の対応状況から、**広く対応している属性だけ**を使う。

| 記法 | 出力例 | 装飾（SGR） |
| --- | --- | --- |
| `# 見出し` | `# 見出し` | 太字＋色（`1;38;2;r;g;b`） |
| `## 見出し` | `## 見出し` | 太字（`1`） |
| `**強調**` | `**強調**` | 太字（`1`）。記号ごと |
| `*斜体*` | `*斜体*` | 斜体（`3`）。記号ごと |
| `` `code` `` | `` `code` `` | 色（`38;2;r;g;b`） |
| `- ` | `- ` | 記号だけ控えめな色 |
| `[text](url)` | `[text](url)` | 下線（`4`）＋ OSC 8 リンク（対応端末ではクリックできる） |

- 色の具体値は配色が決まってから入れる（要件 10章）。ここでは「どの属性を使うか」だけを決める。
- 使わない属性: 点滅（`5`）、波線などの下線の種類（`4:3` 等）、上線（`53`）、不可視（`8`）。対応がまちまちなため。
- 行末で必ず装飾を解除する（`\e[0m`）。パイプやファイル保存で装飾が後続に漏れないようにする。

### 5.4 HTML（トップ）

- アイコン画像・名前・プロフィール・リンク・詳細への案内・`curl https://mewton.jp`（コピーボタン付き）・「ターミナルを開く」。
- サーバーで完結する静的な HTML（JavaScript なしでも内容が読める）。

## 6. アイコン

| 出力 | 方式 |
| --- | --- |
| トップ用 | GitHub から取得した画像を PNG（または WebP）として同梱し、自分のドメインから配信 |
| curl 用 | ハーフブロック `▀` の前景色（上の画素）と背景色（下の画素）で、1セル＝縦2画素。24bit カラー（`38;2` / `48;2`）。透明部分は既定色（`39` / `49`） |

- 大きさ（列数×行数）は見た目の要件で決める。80 桁に収まること（例: 32 画素幅 → 32 列 × 16 行）。
- xterm.js でハーフブロックと 24bit カラーが表示できることは確認済み（10章）。

## 7. 桁幅

- **基準は xterm.js（Unicode 11 の規則）**とする。ブラウザのターミナルが xterm.js であり、ここで一致させないとブラウザで表示が崩れるため。
- ブラウザのターミナルでは `@xterm/addon-unicode11` を読み込み、`unicode.activeVersion = "11"` にする。**既定（Unicode 6）のままだと絵文字が1桁扱いになり、サーバーの計算（2桁）とずれる**（10章の実測）。
- ビルド時の桁計算も同じ規則にする。`@xterm/headless` ＋ `@xterm/addon-unicode11` を使ってビルド時に実測し、80 桁を超える行があればビルドを止める。これで「サーバーの計算」と「ブラウザのターミナル」の一致を仕組みで保証する。
- 許可した絵文字（`Emoji_Presentation` の単一コードポイント）は、xterm.js（Unicode 11）でも `string-width` でも2桁で一致する。許可しない絵文字（VS16・ZWJ・肌色修飾）は実装ごとに幅が食い違う（10章）。

## 8. フォント

| 用途 | 原本 | 加工 | 配信 |
| --- | --- | --- | --- |
| トップの文章 | M PLUS 1 | トップに出る文字だけにサブセット（文字一覧は content が出力） | web のビルドで出力（ハッシュ付きファイル名） |
| トップのコマンド | M PLUS 1 Code | トップに出る文字だけにサブセット | 同上 |
| ターミナル（等幅） | M PLUS 1 Code | 加工しない（フルサイズ） | 同上。ターミナルを開いたときに読み込む |
| ターミナル（絵文字） | Noto Color Emoji | コンテンツで使う絵文字だけにサブセット | 同上 |

- 原本は `apps/web/fonts/` にリポジトリで管理する（OFL ライセンス文を同梱）。ビルドのたびに外部から取得しない（ビルドの再現性のため）。
- ターミナルは `document.fonts.load()` でフォントの読み込みを待ってから xterm.js を開く（xterm.js は起動時にセル幅を計測するため）。
- 要確認: Noto Color Emoji（COLRv1）の Safari での表示（要件 9.4）。

## 9. サーバー（Nitro）

### 9.1 ルーティングと応答

| パス | `Accept` に `text/html` を含む | 含まない（curl など） |
| --- | --- | --- |
| `/` | `index.html`（server assets から返す。2.3） | トップの ANSI テキスト |
| `/career` `/skills` `/talks` | `*.md`（`text/plain`） | `*.ansi`（`text/plain`） |
| web の JS・CSS・フォント・アイコン、container の `FileSystemTree` | 静的ファイル（Vercel の配信層が関数より先に返す） | 同左 |
| その他 | 404（HTML） | 404（テキスト） |

### 9.2 応答ヘッダー

| 応答 | ヘッダー |
| --- | --- |
| すべての動的な応答 | `Vary: Accept` |
| テキスト（`text/plain; charset=utf-8`） | `Access-Control-Allow-Origin: *`（ブラウザのターミナルからの取得用） |
| HTML | `Cross-Origin-Opener-Policy: same-origin`、`Cross-Origin-Embedder-Policy: require-corp`、`Strict-Transport-Security: max-age=31536000` |
| 静的ファイル（ハッシュ付き） | `Cache-Control: public, max-age=31536000, immutable` |

- 動的な応答には `Cache-Control` を付けない（CDN にキャッシュさせない。要件 7.4）。
- プロトコル（http / https）は判定しない。https へのリダイレクトは Vercel が行う（要件 7.1）。

## 10. 技術検証の結果（2026-10-02）

### 10.1 xterm.js 6.0.0 の装飾対応（ソース確認＋ブラウザで描画確認）

| 属性 | SGR | 対応 |
| --- | --- | --- |
| 太字 / 細字 / 斜体 | 1 / 2 / 3 | ✓ |
| 下線（単線・二重・波線・点線・破線） | 4, 4:2〜4:5 | ✓ |
| 下線の色 | 58 | ✓ |
| 点滅 / 反転 / 不可視 / 取り消し線 / 上線 | 5 / 7 / 8 / 9 / 53 | ✓ |
| 16色 / 256色 / 24bit | 30–37, 90–97 / 38;5 / 38;2 | ✓ |
| ハイパーリンク | OSC 8 | ✓（`linkHandler` で挙動を設定できる） |
| ハーフブロックによる画像表現 | `▀` ＋ 前景色・背景色 | ✓ |

### 10.2 文字幅の実測（xterm.js と string-width）

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

→ Unicode 11 を有効にすれば許可する絵文字は一致する。許可しない絵文字は実装ごとに食い違うため、要件 5.4 の制限は妥当。

### 10.3 一般の端末での対応（実機未検証。要確認）

curl の利用者の端末は選べない。以下は既知の情報に基づく目安で、実機では確認していない。

| 端末 | 24bit カラー | OSC 8 | 斜体 |
| --- | --- | --- | --- |
| iTerm2 / WezTerm / kitty / Alacritty | ✓ | ✓ | ✓ |
| Windows Terminal | ✓ | ✓ | ✓ |
| GNOME Terminal など（VTE） | ✓ | ✓ | ✓ |
| VS Code の統合ターミナル | ✓ | ✓ | ✓ |
| macOS 標準の Terminal.app | 要確認（古い版は非対応で近い色に丸められる） | 非対応（無視される） | ✓ |

- 24bit カラーに非対応の端末では、アイコンや色が近い色に丸められるか崩れる。要件で 24bit を選んだため受け入れる。
- OSC 8 に非対応の端末では、リンク部分は普通の文字として表示される（記号を残す方針なので URL は読める）。

## 11. ブラウザ側

### 11.1 トップ（`apps/web` の `top.js`。ページを開いた時点で読み込む小さなスクリプト）

- コピーボタン（`navigator.clipboard.writeText`）
- 「ターミナルを開く」で `terminal.js` を動的に読み込み（`import()`。Vite がチャンクを分割する）、パネルを下から開く
- `crossOriginIsolated` が `false` のとき、または非対応ブラウザでは「ターミナルを開く」を出さない

### 11.2 ターミナル（`apps/web` の `terminal.js`。開いたときに読み込む）

1. フォントの読み込みを待つ（8章）
2. xterm.js を開く（`addon-unicode11` を有効化。7章）
3. WebContainer を起動（20秒で打ち切り。要件 7.2）
4. `apps/container` が出力した `FileSystemTree` を取得し、作業ディレクトリにマウントする（`career.md` / `skills.md` / `talks.md` と代替コマンド。中身は `/career` などと同じ content の生成物）
5. 標準の `curl` で `https://mewton.jp/` を叩いて確認し、使えなければ代替コマンドを `PATH` に置く（試作で実装済みの方式）
6. `jsh` を起動し、最初の1回だけ候補 `curl https://mewton.jp` を表示する

### 11.3 候補（ゴーストテキスト）

- ターミナルのバッファには書き込まず、カーソル位置に重ねた表示（xterm.js の decoration、または DOM の重ね表示）で出す。シェルの行編集と干渉させないため。
- 候補の表示中だけ Tab / → を横取りし、確定したら候補の文字列をシェルの入力に送る。それ以外の入力があれば候補を消す。
- 要検証: `jsh` が Tab を補完に使う場合の干渉。

## 12. テスト

| 種類 | 内容 |
| --- | --- |
| ビルド時の検証 | 3.2 の検証（失敗でビルドを止める） |
| 出力のスナップショット | `*.md` / `*.ansi` / `index.html` の生成結果を固定し、変更を差分で確認 |
| ランタイム間の一致 | 試作で行った比較（パス × `Accept` の全組み合わせで、Node.js / Cloudflare Workers / Vercel / Netlify の応答が一致）をテストとして常設 |
| ブラウザ（E2E） | Playwright で、トップの表示、COOP / COEP により `crossOriginIsolated` が `true`、コピーボタン、パネルの開閉 |
| 文字幅 | 7章の規則で、全出力の各行が 80 桁以内 |

## 13. 未決定・要検証

| 項目 | 種類 |
| --- | --- |
| 経歴の粒度 | 要件（中身） |
| 配色・アイコンの大きさ・レイアウト | 要件（見た目。後で決める） |
| Noto Color Emoji（COLRv1）の Safari 対応 | 要検証 |
| 本番で標準の `curl` が通るか | 要検証（本番で確認） |
| `jsh` の Tab 補完と候補の干渉 | 要検証 |
| 一般の端末の対応状況（10.3） | 要検証（実機） |
| StackBlitz の利用規約の本文・無料の範囲の上限 | 要確認（要件 7.5。商用ライセンスは不要と判断済み） |
| ターミナルの表示部品（xterm.js）の確定 | 要件（暫定） |
| 各段のライブラリ（4章の案） | 実装時に確定 |
