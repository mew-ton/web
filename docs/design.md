# ポートフォリオサイト 詳細設計（技術）

- ステータス: ドラフト
- 最終更新: 2026-10-02（IDE 風の構成へ変更。同日、親ページの中に常に iframe を置く構成に改定）
- 前提: [要件定義](requirements.md)。見た目の詳細（配色・レイアウト）は対象外で、後で決める。

## 1. 全体構成

静的配信のみ（サーバーを持たない）。Vite+ のモノレポで役割ごとにプロジェクトを分ける。

| プロジェクト | 場所 | 役割 | 主な技術 |
| --- | --- | --- | --- |
| 親ページ | `apps/shell` | ブラウザで開く URL のページ（CSR）。メインパネルの iframe、URL との連動、「最大化をやめる」ボタン。IDE モードの部分（ファイルツリー・ターミナル・カレントディレクトリの連動）は非同期で読み込む | Vite、xterm.js（暫定）、WebContainer API |
| サイト | `apps/site` | iframe に表示するコンテンツのページ（各ディレクトリの `index.html`）と、コンテンツの正本（Content Collections） | Astro（静的生成） |
| コンテナ | `apps/container` | WebContainer の作業ディレクトリにマウントするファイル群（サイトのディレクトリ構成。将来は projects） | TypeScript |

```
apps/shell（Vite） ──ビルド──▶ 親ページ・IDE のスクリプト・フォント ──────┐
                                                                      │
apps/site（Astro） ──ビルド──▶ コンテンツのページ（/_content/…）・アセット ─┤──▶ 配信物（Vercel の静的配信）
        │                                                             │
        └─ディレクトリ構成──▶ apps/container ──▶ マウント用ファイル群 ───┘
```

方針:

- **親ページの中に常に iframe がある**（要件 6.1）。最大化モードは iframe を画面いっぱいにした状態で、IDE モードとの違いはレイアウト（CSS）だけ。モードを切り替えても iframe は読み直さない。
- **最大化モードでは IDE を読み込まない**。親ページの初期のスクリプトは、iframe の表示・URL との連動・ボタンだけにする。IDE モードの部分は `import()` で分割し、最大化をやめたときに読み込む。
- **コンテンツのページは JavaScript なしで描画できる静的ページにする**。持つスクリプトは親ページとのやり取り（`postMessage`。5章）だけで、IDE のことは知らない。
- **すべての HTML に COOP / COEP を付ける**（親ページも iframe に入るページも。要件 7.1）。

## 2. モノレポ構成

### 2.1 ディレクトリ

```
vite.config.ts           # Vite+ のルート設定（lint・fmt・タスク）
pnpm-workspace.yaml
vercel.json              # ヘッダー（COOP / COEP / HSTS）・書き換え・ビルド設定
apps/
  shell/                 # Vite（CSR）
    index.html           # 親ページ
    src/
      main.ts            # 親ページの起動（レイアウト・iframe・ボタン）
      sync.ts            # iframe とのやり取りと URL の連動（5章）
      ide/               # 最大化をやめたときに import() で読み込む
        index.ts         # IDE モードの起動
        terminal.ts      # xterm.js と WebContainer
        tree.ts          # ファイルツリー
        cwd.ts           # カレントディレクトリの連動（5章）
    public/fonts/        # ターミナル用フォント（OFL。ライセンス文を同梱）
  site/                  # Astro（base: /_content/）
    src/content/         # Content Collections（JSON ＋ スキーマ）
    src/pages/           # 各ディレクトリの index.html になるページ
    src/scripts/
      bridge.ts          # 親ページとのやり取り（postMessage。5章）
    public/fonts/        # ページ用フォント（OFL。ライセンス文を同梱）
  container/
    src/build.ts         # site のビルド結果からディレクトリ構成を集め、マウント用ファイル群を出力
```

`/_content/` は仮の名前（要件 6.1）。Astro の `base` で設定する。

### 2.2 ツール

- **Vite+**（`vite-plus` 1.0.0、MIT）: lint（Oxlint）・フォーマット（Oxfmt）・テスト（Vitest）・タスク実行（`vp run`）。Vite 8 を含む。Astro も内部で Vite を使う。
- **パッケージマネージャー**: pnpm（workspaces）。Vite+ は既存のパッケージマネージャーを検出して使う。
- Node.js: 22.18 以上（Vite+ の要件 `^22.18.0 || ^24.11.0 || >=26.0.0`）。

### 2.3 ビルドの順序と配信物

`vp run build` のタスク依存で次の順に実行する。

1. `apps/site`: Astro で静的生成（Content Collections の検証を含む）。フォントをページに出る文字だけにサブセット化する
2. `apps/container`: site のビルド結果から、マウント用のファイル群（WebContainer の `FileSystemTree`）を出力
3. `apps/shell`: Vite でビルド（親ページ、IDE のスクリプト、ターミナル用フォント）。site のディレクトリ構成から、親ページが受け付けるパスの一覧を作る
4. 3つの出力を1つの配信物にまとめる

| 配信物 | パス（例） | 備考 |
| --- | --- | --- |
| 親ページ | `/`、`/works/` など | 全パス共通の1枚（`/index.html`）。`/` 以外は書き換えで同じ HTML を返す（6章） |
| 親ページ・IDE のスクリプトなど | `/_ide/…`（ハッシュ付き） | IDE モードの部分は最大化をやめたときに読み込む |
| コンテンツのページ | `/_content/`、`/_content/works/` など | Astro の出力 |
| マウント用ファイル群 | `/_ide/fs.json` など | IDE モードの起動時に取得してマウントする |

### 2.4 開発時

| 起動方法 | 用途 |
| --- | --- |
| `vp run dev:site` | ページの開発（Astro の開発サーバー） |
| `vp run dev` | 結合の確認。親ページ（Vite の開発サーバー）から `/_content/` を Astro の開発サーバーへ中継する（Vite の `server.proxy`） |

- どちらの開発サーバーにも COOP / COEP を付ける（`server.headers`）。

## 3. コンテンツのページ（apps/site）

- 各ディレクトリの `index.html` を Astro で静的生成する。ディレクトリ構成は後で決める（要件 4.1）。
- コンテンツの正本は Content Collections（JSON ＋ スキーマ）。スキーマに合わない場合はビルドが失敗する。
- アイコンは GitHub アカウントのアイコンをビルド時に取得して同梱し、自分のドメインから配信する（COEP の制約のため）。取得に失敗したらビルドを止める。
- ページ間のリンクは、普通の相対リンク（iframe の中で移動する）。
- JavaScript なしで描画できること（要件 6.1）。スクリプトは親ページとのやり取り（`bridge.ts`。5章）だけを持つ。直接開かれた場合も、そのまま単体のページとして表示する（親ページへは移さない）。
- 検索結果に出さない。全ページに `<meta name="robots" content="noindex, indexifembedded">` を付ける。`noindex` で単体では検索結果に出さず、`indexifembedded` で `/` の iframe に入った内容は `/` の内容として扱わせる（Google の仕様。出典は 10章の注）。

## 4. 親ページ（apps/shell）

### 4.1 最大化モード（初期表示）

1. iframe は HTML に `src="/_content/"` を初期値として書いておく。JavaScript が無効なときはこのまま `/` のコンテンツが表示される（要件 6.1）
2. `location.pathname` が `/` 以外なら、コンテンツのページのパスに変換して（`/works/` → `/_content/works/`）iframe の `src` を差し替える
   - 差し替えは iframe の直後のスクリプトで、最初の読み込みが終わる前に行う。読み込み途中の移動は履歴を増やさない（置き換えになる）ため、戻るボタンで `/` の中身に戻ることはない（要検証）
3. 「最大化をやめる」ボタンを出す。スマートフォンの幅では CSS のメディアクエリで非表示にする（要件 8章）。WebContainer の非対応環境では出さないか、開けない旨を出す（要件 7.1）
4. iframe とのやり取りを始める（5章）。URL・タイトル・iframe の大きさを同期する

### 4.2 IDE モード

最大化をやめると、レイアウトを IDE の形に変え（iframe は読み直さない）、`import()` で IDE モードの部分を読み込んで次を行う。

1. ターミナル用フォントの読み込みを待ってから xterm.js を開く（Unicode 11 の文字幅を有効にする。9章）
2. WebContainer を起動する（時間で打ち切り。要件 7.1）。API キーが必要なら `boot()` の前に `configureAPIKey()` を呼ぶ
3. マウント用ファイル群を取得して作業ディレクトリにマウントする
4. シェル（`jsh`）を `--osc` 付きで起動する。カレントディレクトリは `spawn()` の `cwd` で、現在の URL に対応するディレクトリにする（入力を送らない。5.1）
5. WebContainer の帰属表示を出す（必須。場所・文言は後で決める）

- 最大化に戻すと、レイアウトだけを戻す。WebContainer とターミナルは動かしたままにする。2回目以降の切り替えは読み込みを伴わない。
- IDE モード中に画面幅がスマートフォンの幅になったら（`matchMedia` の変化で検知）、最大化モードに戻す（要件 8章）。幅が広がっても自動では IDE モードに戻さず、ボタンで戻す。

### 4.3 ファイルツリー

- WebContainer のファイルシステムを読んで表示する（`fs.readdir`。変更は `fs.watch` で追従）。
- 将来、projects の配下に入ったら、そのプロジェクトを起点にした表示に切り替える（要件 5.3）。

## 5. 親ページと iframe のやり取り（postMessage）

親ページとコンテンツのページは `postMessage` でやり取りする（作者が過去に作った方式。要件 5.4）。

- **同じオリジンの相手とだけやり取りする**。受け取る側は `event.origin === location.origin` を確かめ、親ページ側は加えて `event.source === iframe.contentWindow` を確かめる。送る側は相手のオリジンに `location.origin` を指定する。
- コンテンツのページの送受信のスクリプト（`bridge.ts`）は、`window.parent !== window` のときだけ動く。直接開かれたときや JavaScript が無効なときは何もしない。

| 向き | 内容 | 受け取った側の処理 |
| --- | --- | --- |
| iframe → 親 | ページを表示した（パス・タイトル） | 親の URL とタイトルを合わせる。IDE モードならカレントディレクトリも合わせる |
| 親 → iframe | 表示領域（メインパネル）の大きさが変わった（画面の大きさの変更、モードの切り替え） | 中身のページが表示を合わせる（レスポンシブデザインは中身のページ側で対応する。要件 5.4） |
| iframe → 親 | ページの大きさ（幅・高さ）が変わった（`ResizeObserver` で検知） | iframe の幅と高さをページに合わせる（スクロールは iframe の中ではなく、親ページ・メインパネルの側で行う） |
| 親 → iframe | 指定のパスへ移動する（ターミナルで `cd`、戻る・進むなど） | iframe の中で移動する |

- 履歴の増え方（`pushState` / `replaceState` の使い分け。iframe の中の移動は親と共通の履歴に入る）は、過去の実装に合わせる。
- JavaScript が無効なときは大きさの同期が無いため、iframe は初期の大きさ（画面いっぱい）のままで、中でスクロールする。中身のページは iframe の幅に対して通常のレスポンシブデザインとして表示される。
- 要検証: 幅を中身に合わせると、中身は iframe の幅を基準に表示を変えるため、幅が循環して決まらなくなるおそれがある。表示領域の幅を基準として中身に渡し、中身の幅はそれを超えた分だけを返す、などの形で循環を断つ（過去の実装と照合する）。

### 5.1 ターミナルのカレントディレクトリ（調査: 2026-10-02）

WebContainer の配信元（stackblitz.com など）にこの環境から接続できないため、実機では試していない。以下は資料による調査。

**確認できたこと**

| 内容 | 根拠 | 出典 |
| --- | --- | --- |
| 公開 API に、カレントディレクトリの変化を知らせるイベントや、プロセスのカレントディレクトリを読む手段は無い。イベントは `port`・`server-ready`・`preview-message`・`error`・`xdg-open`・`code` だけ | 型定義の `on()` の一覧と `WebContainerProcess`（`exit`・`input`・`output`・`kill`・`resize` のみ） | npm パッケージ `@webcontainer/api` 1.6.4 の `dist/index.d.ts`（パッケージを取得して確認） |
| 起動時のカレントディレクトリは `spawn()` の `cwd` で指定できる（作業ディレクトリからの相対パス） | `SpawnOptions.cwd` | 同上、[API Reference `cwd`](https://webcontainers.io/api#▸-cwd-string) |
| 外からシェルに渡せるのは、端末への入力（`input`）だけ | `WebContainerProcess.input: WritableStream<string>` | 同上 |
| `jsh` の標準のプロンプトは、カレントディレクトリを表示する（`~/<作業ディレクトリ名>` の行と `❯` の行） | チュートリアルの画面写真 | [stackblitz/webcontainer-docs `docs/tutorial/images/19-terminal-prompt.png`](https://github.com/stackblitz/webcontainer-docs/blob/main/docs/tutorial/images/19-terminal-prompt.png) |
| `jsh` を `--osc` 付きで起動すると、独自のエスケープシーケンス `ESC ] 654 ; … BEL` を出力する。StackBlitz 自身の製品（bolt.new）が、これで「入力を受け付ける状態になった」ことを検知している | `webcontainer.spawn('/bin/jsh', ['--osc', ...args], …)`、`data.match(/\x1b\]654;([^\x07]+)\x07/)`、`osc === 'interactive'` | [stackblitz/bolt.new `app/utils/shell.ts`](https://github.com/stackblitz/bolt.new/blob/eda10b121221b30825a4c16eec5da1fd3eb1eb99/app/utils/shell.ts)（MIT） |
| 確認できた種類は `interactive`（起動完了）・`prompt`（プロンプトを出した＝コマンドの入力待ち）・`exit=<数値>:<終了コード>`（コマンドの終了）。カレントディレクトリを運ぶものは見当たらない | `waitTillOscCode('prompt')`、`/\x1b\]654;([^\x07=]+)=?((-?\d+):(\d+))?\x07/`、`osc === 'exit'` | [stackblitz-labs/bolt.diy `app/utils/shell.ts`](https://github.com/stackblitz-labs/bolt.diy/blob/2e254ac19a696394030601bc602f54945b12bfc4/app/utils/shell.ts)（MIT） |

注:
- `--osc` と OSC 654 は公式ドキュメントに記載が無い（StackBlitz の製品のコードで使われているだけ）。将来変わる可能性がある。
- `jsh` が設定ファイル（`.jshrc`）でエイリアスを定義できる、という記述が StackBlitz のブログ（2021年6月の更新情報）にあるとの検索結果を得たが、ブログにこの環境から接続できず、原文は未確認。プロンプト（`PS1`）や関数を定義できるかも未確認。

**方式の案**

| 案 | 方法 | 評価 |
| --- | --- | --- |
| A. プロンプトを読む | OSC 654 の `prompt` を合図に、その直前に出たプロンプトの行からパスを読み取る | どの方法でディレクトリが変わっても追従できる。プロンプトの形（色のエスケープシーケンス、`~` の扱い、長いパスの省略）に依存する |
| B. 入力を監視する | 入力された行が `cd` で始まり、続く `exit` の終了コードが 0 なら、引数から移動先を計算する | プロンプトの形に依存しない。`cd -`・`cd ~`・`pushd` などを自前で解釈する必要がある |
| C. 設定ファイルで OSC 7 を出させる | `.jshrc` のプロンプトや関数で、カレントディレクトリを OSC 7 で出力させる | 最も確実だが、`jsh` が対応しているか未確認 |

**方針**

- 起動時のディレクトリは、入力を送らずに `spawn('jsh', ['--osc'], { cwd })` で指定する（4.2 の 4 を修正）。
- 変化の検知は **案 A（プロンプトを読む）** にする（2026-10-02 決定）。プロンプトの生の出力（エスケープシーケンスを含む）は実機で確かめ、読み取り方を決める。
- 外から変える（メインパネルのリンクで移動したとき）方法は、端末への入力として `cd <パス>` を送るしかない（公開 API に他の手段が無い）。入力はターミナルに見える。OSC 654 の `prompt` を受けた後（コマンドの実行中でないとき）にだけ送り、実行中なら送らない。
- 作業ディレクトリの外（`cd ..` で `/` より上など）に出た場合の、URL とメインパネルの扱いは決める必要がある。

**実機で確かめること**

1. `jsh --osc` が出力する OSC 654 の種類と順序（`cd` の前後で出るもの）
2. 標準のプロンプトの生の出力（エスケープシーケンスを含む）
3. `.jshrc` を作業ディレクトリ外のホーム（`~/.jshrc`）にマウントしたとき、エイリアス・関数・`PS1` が効くか
4. 作業ディレクトリの外に出たときのプロンプトの表示

### 5.2 そのほかの要検証

- 連動が循環しない仕組み（`cd` → iframe 移動 → 再び `cd`、とならないように、きっかけを区別する）。

## 6. 配信とヘッダー（Vercel）

`vercel.json` で次を設定する。

| 対象 | 設定 |
| --- | --- |
| すべての HTML | ヘッダー `Cross-Origin-Opener-Policy: same-origin`、`Cross-Origin-Embedder-Policy: require-corp`、`Strict-Transport-Security: max-age=31536000` |
| ハッシュ付きの静的ファイル | ヘッダー `Cache-Control: public, max-age=31536000, immutable` |
| サイトのパス | `rewrites` で `/` 以外のパス（`/_content/` と `/_ide/` を除く）を `/index.html` に書き換える。存在しないパスも同じ（iframe に 404 のページを出す。要件 7.2） |
| `/` 以外の親ページ | ヘッダー `X-Robots-Tag: noindex`（検索結果に出すのは `/` だけ。要件 6.1） |

- http から https へのリダイレクトは Vercel が行う。
- タイトル・説明・OGP は親ページの HTML に1種類だけ書く。

## 7. 将来: projects（要件 5.3）

- ソースはビルド時に集めて、プロジェクトごとのマウント用ファイル群（例: `/_ide/projects/<name>.json`）として同梱する。
- 流れ:
  1. 起動時のマウントで、`projects/<name>/` を空のディレクトリとして置いておく（`cd` が成功するため。`mountPoint` はマウント先が存在している必要があるため）
  2. プロンプトから、カレントディレクトリが `projects/<name>` の配下になったことを検知する（5.1 の案 A）
  3. そのプロジェクトがまだマウントされていなければ、ファイル群を非同期で取得し、`mount(tree, { mountPoint: 'projects/<name>' })` でマウントする
  4. ファイルツリーをそのプロジェクトを起点にした表示に切り替え、メインパネルを README.md のプレビューにする
- 取得中は、ディレクトリが空に見える。取得中であることの表示は見た目と合わせて決める。
  - 起動後に追加でマウントすることになる。`mount()` には `mountPoint`（マウント先のディレクトリ。事前に `fs.mkdir` で作っておく必要がある）があり、作業ディレクトリの一部へ後からマウントする使い方が想定されている。ただし、複数回呼べることや、既存のファイルと重なったときの挙動は公式ドキュメントに明記が無い（[API Reference `mount`](https://webcontainers.io/api#▸-mount)、[Working with the File System「Mounting to a different path」](https://webcontainers.io/guides/working-with-the-file-system#mounting-to-a-different-path)）。実機で確かめ、使えなければ `fs.mkdir` / `fs.writeFile` で書き込む。
- メインパネルは README.md の Markdown プレビューに切り替える。
- WebContainer の `server-ready` イベントで得た URL を、メインパネルの iframe に表示する。
- 要調査: WebContainer のプレビューを iframe で表示するときの COOP / COEP との両立。
- 作るかどうかは、初回公開後の実装の状況とセッションの使用状況を見て判断する。そのために IDE モードを開いた回数を把握する（方法は未決定）。

## 8. テスト

| 種類 | 内容 |
| --- | --- |
| ビルド時の検証 | Content Collections のスキーマ検証（失敗でビルドを止める） |
| ブラウザ（E2E） | Playwright で、最大化モードの表示、ヘッダーにより `crossOriginIsolated` が `true`、IDE モードへの切り替え（iframe を読み直さないこと）、最大化に戻す、リンク移動と URL の連動、戻る・進む（履歴が1回の移動で1つだけ増えること）、`cd` と URL・iframe の連動、iframe の幅と高さが同期されること、別オリジンからのメッセージを無視すること、スマートフォンの幅で「最大化をやめる」が出ないこと、IDE モード中にスマートフォンの幅へ狭めると最大化モードに戻ること |
| JavaScript 無効 | 親ページを開くと iframe に `/` のコンテンツが表示されること。コンテンツのページが JavaScript なしで描画されること |
| 検索エンジン向け | `/` だけが `noindex` でないこと（`/` 以外の親ページは `X-Robots-Tag`、コンテンツのページは `robots` メタタグ） |

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
| `jsh` のカレントディレクトリの検知方法（案 A〜C の実機での確認。5.1） | 要検証（実装の初期） |
| 作業ディレクトリの外に出たときの URL とメインパネルの扱い（5.1） | 要件 |
| 初期表示で iframe の `src` を差し替えたときに履歴が増えないか（4.1） | 要検証 |
| `indexifembedded` の挙動を Google の公式ドキュメントで確認する（下の注） | 要確認 |
| コンテンツのページを置くパスの名前（`/_content/` は仮） | 要件（6.1） |
| ディレクトリ構成・経歴の粒度・Content Collections のスキーマ | 要件（中身） |
| 配色・レイアウト | 要件（見た目。後で決める） |
| ターミナルの表示部品（xterm.js）の確定 | 要件（暫定） |
| IDE モードを開いた回数の把握方法 | 要件（projects の判断材料） |
| 帰属表示の場所・文言、API セッションの数え方 | 後で決める（要件 7.3） |
| Noto Color Emoji（COLRv1）の Safari 対応 | 要検証 |
| projects のプレビュー iframe と COOP / COEP の両立 | 要調査（将来） |
| 起動後の追加の `mount()`（複数回・重なったときの挙動） | 要検証（将来。7章） |

注: `indexifembedded` は Google が 2022 年に追加した robots の指定で、`noindex` と組み合わせたときだけ働き、iframe などで埋め込まれた内容を埋め込み先のページの内容として索引に入れる。Google 以外の検索エンジンが対応しているかは未確認。出典は二次資料（[Search Engine Roundtable](https://www.seroundtable.com/googles-robots-tag-indexifembedded-32802.html)、[PPC Land](https://ppc.land/google-introduces-indexifembedded-to-embedded-content-indexation/)）。公式ドキュメント（developers.google.com の robots メタタグの解説）はこの環境から接続できず未確認。
