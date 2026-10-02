# ポートフォリオサイト 要件定義

- ステータス: ドラフト
- 最終更新: 2026-10-02（IDE 風の構成へ大幅に変更。同日、URL の構成を改定: 6.1）
- 技術面の詳細設計: [design.md](design.md)

## 1. コンセプト

サイト全体を **IDE（統合開発環境）のような見せかけ**にする。

- 画面は **メインパネル・ファイルツリー・ターミナル** の3つで構成する。
- 開いた直後は、メインパネルが最大化された状態で表示される。メインパネルは「HTML ビューアー」（iframe）の位置付けで、普通の Web ページ（プロフィールなど）として読める。
- 最大化は見た目（レイアウト）の違いだけで、最大化モードでも IDE モードでも、親ページの中に iframe がある構成は変わらない（6.1）。
- 画面端の「最大化をやめる」ボタンで **IDE モード** になり、ファイルツリーとターミナルが現れる。ここで初めて WebContainer（ブラウザ内で Node.js とシェルを動かす仕組み）を読み込む。
- サイトの構成はファイルツリーとして見えている。ターミナルで `cd` すると、メインパネルにはそのディレクトリの `index.html` が表示され、ブラウザの URL のパスも連動して変わる。

```
/
├── index.html           # トップ（プロフィールなど）
├── works/index.html     # 例
├── histories/index.html # 例
└── projects/            # 将来（5.3）
    └── <project-name>/
        ├── README.md
        └── …（ソース一式）
```

> `works` / `histories` は例。ディレクトリ構成（どのページを置くか）は後で決める（4章）。決めているのは「ディレクトリごとに `index.html` があり、それがメインパネルに表示される」という仕組み。

2026-10-02 に `curl https://mewton.jp` を入口にする構成から変更した。curl の入口に関わる決定（コンテンツネゴシエーション、ANSI での装飾、80桁、絵文字の制限、`/career` などのテキスト、サーバー側の出し分け）はすべて廃止した（経緯は 10章）。

## 2. 目的

| 優先 | 目的 | サイトに求めること |
| --- | --- | --- |
| 1 | 技術の実験場 | IDE 風の画面、WebContainer によるブラウザ内のシェル、将来はプロジェクトの実行（5.3） |
| 2 | 転職・就職活動 | 採用担当・エンジニアが短時間でプロフィールと経歴を把握できる。IDE モードに切り替えなくても、メインパネルの Web ページだけで読める |
| 3 | 個人ブランディング | 活動全体（SNS・執筆・登壇など）への入口になる。IDE 風の体験そのものが印象に残る |

> 目的同士がぶつかった場合（例: 演出 vs 読みやすさ）は上位を優先する。ただし、IDE モードに切り替えなくてもコンテンツを読める状態は保つ（転職目的の読者が読めなくなるため）。

## 3. 想定読者

| 読者 | 主な読み方 |
| --- | --- |
| 採用担当者（非エンジニアを含む） | 最大化されたメインパネルの Web ページをそのまま読む |
| エンジニア（技術面接官、OSS 利用者など） | IDE モードに切り替え、ファイルツリーとターミナルで探索する |
| スクリーンリーダー利用者 | メインパネルの iframe に入る Web ページ（Astro の静的な HTML） |
| 検索エンジン | ルートページ（`/`）だけを対象にする（6.1） |

## 4. コンテンツ

### 4.1 ページとディレクトリ

- サイトのページは、ディレクトリごとの `index.html`（Astro で生成する静的ページ。6章）として作る。
- どのディレクトリ（ページ）を置くかは後で決める。トップ（`/`）から各ページへの導線を用意する。
- 決まっている内容:
  - トップ: アイコン（GitHub アカウントのアイコン）、名前、簡単なプロフィール、SNS リンク、メールアドレス（難読化しない）
  - 職務経歴書などの PDF は配布しない
  - 問い合わせフォームは設けない
- 経歴の粒度（社名・期間を出すか）は未決定。
- スキル1件あたりの項目（案）: 名前、モチベーション（絵文字1文字）、備考。絵文字の凡例は出さない。

### 4.2 正本（SSOT）

- コンテンツの正本は **Astro の Content Collections**（JSON ＋ スキーマ）で管理する。型と必須項目の検証は Astro の仕組みで行い、欠落があればビルドを失敗させる。
- 長い文章は持たない。各項目は短い文字列とリスト・リンクで構成する。
- CMS は将来検討する。導入する場合も、内容はビルド時に取り込む（実行時に CMS を参照しない）。

## 5. 画面と操作

### 5.1 最大化モード（初期表示）

- 親ページがメインパネルの iframe を画面いっぱい（幅・高さ 100%）に表示する。iframe の中身は、開いた URL に対応するページ（Astro の静的ページ）。
- 画面端に「最大化をやめる」ボタンを置く（親ページ側）。
- この状態では WebContainer も、IDE モード用のスクリプトも読み込まない（表示速度のため）。読み込むのは親ページ（iframe の表示、URL との連動、ボタン）の小さなスクリプトだけ。

### 5.2 IDE モード

- 「最大化をやめる」で、ファイルツリーとターミナルが現れ、メインパネルは IDE の一区画になる。iframe はレイアウトが変わるだけで、読み直さない。
- このとき、IDE モード用のスクリプトと WebContainer の非同期の読み込みを始める。
- 最大化に戻した場合も、レイアウトが変わるだけで、WebContainer は動かしたままにする。
- メインパネルは「HTML ビューアー」として、ターミナルのカレントディレクトリにある `index.html` を表示する（iframe）。
- ファイルツリーには、サイトのディレクトリ構成（`index.html` など）が表示される。WebContainer の作業ディレクトリにも同じ構成のファイルを置き、`ls` / `cd` / `cat` で同じものが見える。
- ターミナルの表示には xterm.js を使う（有力候補。6章）。
- WebContainer の帰属表示を出す（必須。7.3）。

### 5.3 projects（将来。初回公開には含めない）

- `projects/<project-name>/` に README.md とソース一式を置く。ソースはビルド時に集めて同梱し、`cd` したときに非同期で取得して WebContainer にマウントする。
- プロジェクトの配下に入ると、ファイルツリーはそのプロジェクトを起点にした表示になり、メインパネルは README.md の Markdown プレビューに変わる。
- README の手順に従って `npm install` やサーバーの起動を行うと、メインパネルに iframe が現れ、起動したサーバーのページを見られる（`localhost` の小さなブラウザのように見せる）。
- **作るかどうかは、初回公開後の実装の状況と WebContainer のセッションの使用状況（7.3 の上限との兼ね合い）を見て判断する**。そのために、IDE モードを開いた回数を把握できるようにする（9章）。
- 要調査: WebContainer で起動したサーバーのプレビューを iframe で表示するときの、このサイトの COOP / COEP との両立。

### 5.4 URL とカレントディレクトリの連動

- ブラウザの URL のパスと、ターミナルのカレントディレクトリを連動させる。
  - ターミナルで `cd works` → URL が `/works/` になり、メインパネルに `works/index.html` が表示される
  - `/works/` を直接開く → 最大化モードで `works/index.html` が表示される。IDE モードに切り替えると、カレントディレクトリは `/works` から始まる
  - メインパネル内のリンク（トップから各ページへの導線など）で移動した場合も、URL を追従させる（最大化モードでも同じ）。IDE モードではカレントディレクトリも追従させる
- ブラウザの戻る・進むでも連動させる。
- iframe の中身と親のパスを同期させる仕組みは、作者が過去に作った実績がある。方法は詳細設計 5章。

## 6. 技術スタック

| 層 | 採用 | 備考 |
| --- | --- | --- |
| コンテンツのページ | Astro（静的生成） | メインパネルの iframe に表示する各ディレクトリの `index.html`。Content Collections で正本を管理（4.2） |
| 親ページ | Vite（モノレポ内の別プロジェクト。CSR） | iframe の表示と URL の連動。ファイルツリー・ターミナルなど IDE モードの部分は、最大化をやめたときに非同期で読み込む |
| ブラウザ内のシェル | WebContainer API | 7章 |
| ターミナルの表示 | xterm.js（有力候補。2026-10-02 時点で暫定） | WebContainer は画面を持たないため、シェルの出力を描画するターミナルエミュレーターが必要 |
| 配信 | 静的配信（サーバーは持たない） | Astro と Vite のビルド結果をそのまま配信する。必要なレスポンスヘッダーはホスティング側の設定で付ける（7.1） |
| モノレポ | Vite+（pnpm workspaces） | 詳細設計 2章 |

### 6.1 URL の構成（2026-10-02 改定）

- **ブラウザで開く URL（`/`、`/works/` など）は親ページ**。親ページは CSR で、開いたパスに対応するコンテンツのページを iframe に表示する。
- **コンテンツのページ（Astro）は別のパスに置く**（例: `/_content/works/`。名前は仮）。
- 最大化モードは iframe を画面いっぱいに表示した状態で、IDE モードとの違いはレイアウトだけ。
- 改定の理由（同日の当初案「Astro のページが正の URL で、IDE はその上に立ち上がる」をやめた理由）:
  - 当初案では、IDE モードから最大化に戻すとき、WebContainer を動かしたままにするには iframe を広げるしかなく、「最大化」の実装が2通り（ページそのもの／iframe 全画面）になって整合しない
  - 当初案では、IDE モードで移動すると、URL と一番上の文書（最初に開いたページ）が食い違い、元のページと IDE が同じ文書に同居する
  - 中身は Astro の静的ページなので、iframe 経由でも表示速度に問題はない。WebContainer などは最大化をやめたときに非同期で読み込むため、初回表示には影響しない
- **親ページは全パス共通の1枚**。OGP は1種類でよいため、パスごとに作らない。
- **検索結果に出すのはルートページ（`/`）だけ**。`/` 以外の親ページとコンテンツのページは検索結果に出さない。
- **コンテンツのページは JavaScript なしで描画できる**（Astro の静的 HTML）。JavaScript は親ページでの連動（URL・iframe・カレントディレクトリ）と IDE モードにだけ使う。
- **JavaScript が無効なときは、どのパスでも `/` と同じページ（トップのコンテンツ）を iframe で開く**。iframe の中のリンクで移動はできるが、URL は変わらない。
- 未決定（詳細設計 10章）:
  - コンテンツのページを直接開いたときの扱い（親ページの URL へ移すか）

## 7. WebContainer

### 7.1 必要な条件

| 制約 | 対応方針 |
| --- | --- |
| ページのクロスオリジン分離が必要（`Cross-Origin-Opener-Policy: same-origin` と `Cross-Origin-Embedder-Policy: require-corp`。パッケージ同梱の README で確認済み） | すべての HTML の応答に付ける。メインパネルの iframe に入れるページも同じヘッダーが必要（クロスオリジン分離されたページに埋め込む文書も分離されている必要があるため）。画像・フォントなどは同じオリジンから配信し、外部の埋め込みは使わない |
| HTTPS 必須（localhost を除く） | サイト全体を https に限る。http はホスティング側で https へリダイレクトする |
| 実行時に StackBlitz のサーバーに依存する | 届かない場合 `boot()` は失敗も完了もしないため、時間で打ち切り、ターミナルを開けなかった旨を表示する（メインパネルのページはそのまま読める） |
| 対応ブラウザが限られる（スマートフォンを含む） | 非対応環境では「最大化をやめる」を出さないか、開けない旨を表示する（メインパネルのページは読める） |
| 起動時の読み込みが重い | IDE モードに切り替えたときに初めて読み込む（5.2） |

### 7.2 ブラウザでパスを開いたとき

- サイトのパス（`/`、`/works/` など）は親ページを返し、親ページが対応するコンテンツのページを iframe に表示する（6.1）。
- 存在しないパスも親ページを返し（全パス共通の1枚のため）、iframe に 404 のページを表示する。HTTP の状態は 200 になるが、`/` 以外は検索結果に出さないため問題にしない。

### 7.3 利用条件（調査: 2026-10-02）

### 一次情報で確認できたこと

| 内容 | 原文（抜粋） | 出典 |
| --- | --- | --- |
| パッケージのライセンスは MIT | `"license": "MIT"` | npm パッケージ `@webcontainer/api` 1.6.4 の `package.json`（パッケージを取得して確認） |
| 実行には StackBlitz のサービスが必要で、組み込むと利用規約に同意したことになる | "The WebContainer API relies on hosted proxies and server-side acceleration from StackBlitz to function properly. By integrating the WebContainer API into your project, you are agreeing to StackBlitz's standard Terms of Service." | 同パッケージの README、[npm](https://www.npmjs.com/package/@webcontainer/api) |
| 商用ライセンスが必要なのは「商用・営利目的での本番利用」。試作・PoC は不要 | "Licensing is required for *production* usage of the API in a commercial, for-profit setting. (Prototypes or POCs do not require a commercial license.)" | [Commercial Usage](https://webcontainers.io/enterprise)（原稿: [stackblitz/webcontainer-docs `docs/enterprise.md`](https://github.com/stackblitz/webcontainer-docs/blob/main/docs/enterprise.md)） |
| 判断の基準は「顧客・見込み客・従業員のニーズを満たすために使うか」。違反するとアクセスを止められうる | "If you're using the API to meet the needs of your customers, prospective customers, and/or employees, you need a license to ensure compliance with our Terms of Service. Usage of the API in violation of these terms may result in your access being revoked." | 同上 |
| API キーは商用利用のためのもの。`boot()` の前に設定する | "Configure an API key to be used for commercial usage of the WebContainer API." / "This function will throw an exception if `WebContainer.boot` was called before `configureAPIKey`." | [API Reference `configureAPIKey`](https://webcontainers.io/api#configureapikey)（原稿: [`docs/api.md`](https://github.com/stackblitz/webcontainer-docs/blob/main/docs/api.md)）、[Changelog 1.3.0](https://webcontainers.io/changelog) |

注: 原稿のリポジトリ（stackblitz/webcontainer-docs）の最終更新は 2024-11-15。公開中のサイト（webcontainers.io）にはこの環境から接続できず、現行の文面と同一かは未確認。

### 利用規約（2026-09-22 改定版）で確認できたこと

規約ページ（stackblitz.com）にはこの環境から接続できないため、規約の変更を追跡している公開リポジトリが保存した全文（2026-09-23 取得）で読んだ。

| 内容 | 原文（抜粋） | 出典 |
| --- | --- | --- |
| 改定の時期 | "Published: September 14, 2026 \| Last updated: September 22, 2026 \| Effective for existing accounts: October 7, 2026" | [StackBlitz Terms of Service](https://stackblitz.com/terms-of-service)（全文の写し: [arcships/zdr-monitor `snapshots/f9a1769fbe2834f0.md`](https://github.com/arcships/zdr-monitor/blob/main/snapshots/f9a1769fbe2834f0.md)） |
| WebContainer API も規約の対象サービスに含まれる | "“Services” means … the StackBlitz SDK, the WebContainer API, and any related tools, APIs, and features." | 同上 1.3 |
| **本番または商用での利用には、有効なプランか別途の書面ライセンスが必要** | "(c) WebContainer API. Use of the WebContainer API is subject to the license tiers, session limits, and other usage limits stated in the developer documentation (currently at webcontainers.io) and on the Pricing Page. Use in a production or commercial setting, or beyond the stated limits, requires an active plan or separate written license that includes it; contact hello@stackblitz.com to discuss licensing." | 同上 1.5(c) |
| 権利はプランかライセンスが有効な間だけ続く。開発者ドキュメントの上限は規約の一部になる | "(d) Duration; Documentation. The rights in this Section 1.5 continue only while the applicable plan or license is active … The usage limits and technical requirements stated in the developer documentation are incorporated into these Terms" | 同上 1.5(d) |
| 料金ページが規約に組み込まれる | "Stackblitz offers the Services under free and paid subscription plans, with the plans, prices, features, usage allotments, and limits for each product described on the Pricing Page, which is incorporated into these Terms by this reference." | 同上 1.4 |
| WebContainer API 経由の内容は AI 学習に使われない | "Content used solely through stackblitz.com or other non-Bolt Services, including … the WebContainer API, is not Bolt Model Development Content and is not used for the purposes described in Section 3.5." | 同上 1.3 |

注: 規約の写しは第三者のリポジトリによるもの。公開前に公式ページで原文を確認する。

### 料金ページで確認できたこと（2026-10-02）

StackBlitz の料金ページ（WebContainers のタブ）を利用者が画面で確認した（この環境からは接続できないため）。

| プラン | 料金 | 対象 | 含まれるもの |
| --- | --- | --- | --- |
| Personal | 月 0 ドル（GitHub アカウントでサインイン） | "For building prototypes and non-commercial use cases." | "Non-commercial usage with attribution"、"Up to 25,000 API sessions per month" |
| Enterprise & Self-hosted | 要相談 | "For commercial use cases requiring increased security & customization." | 商用利用、セッション数は個別、セルフホスト、SLA など |

出典: [StackBlitz Pricing（WebContainers）](https://stackblitz.com/pricing)

### このサイトへの当てはめ（2026-10-02 決定）

- **Personal プラン（無料）に登録して使う**。このサイトは非商用（2章。受託の宣伝や収益化はしない）で、Personal プランの対象に当たる。規約 1.5(c) の「本番での利用には有効なプランが必要」は、Personal プランへの登録で満たす。
- 守ること:
  - **帰属表示**（attribution）は**必須**。場所・文言・リンク先は後で決める。
  - **月 25,000 セッションまで**。WebContainer は IDE モードに切り替えたときにだけ起動するため（5.2）、数えられるのは IDE モードを開いた回数に限られる見込み。超えた場合も、コンテンツのページは WebContainer なしで読める。
- API キーが必要な場合は `boot()` の前に `configureAPIKey()` で設定する。キーはブラウザに配信されるが、公開中の WebContainer 利用サイトも同じ条件であり、問題にしない。
- 「API セッション」の数え方と上限を超えたときの挙動は後で確認する。起動に失敗した場合は「ターミナルを開けなかった」旨を表示する。
- 受託の宣伝や収益化を始める場合は、非商用でなくなるため見直す（Vercel のプランと同じ判断軸。8.1）。

## 8. 非機能要件

| 項目 | 要件 |
| --- | --- |
| 言語 | 日本語のみ |
| 公開先 | 独自ドメイン `mewton.jp`。Vercel（8.1） |
| スマートフォン | メインパネルのページで読めること。IDE モードの操作性は問わない（出すかどうかは詳細設計） |
| パフォーマンス | 最大化モードは、WebContainer と IDE のスクリプトを読み込まずに表示されること（読み込むのは親ページとコンテンツのページだけ） |
| フォント | 8.3 |
| アクセシビリティ | メインパネルのページ（静的 HTML）で担保する。iframe にはタイトルを付ける。アイコン画像には代替テキストを付ける |
| SEO / OGP | 検索結果に出すのはルートページ（`/`）だけ。タイトル・説明・OGP 画像は親ページに1種類だけ持たせる（6.1） |
| 通信 | https のみ。HTML に `Strict-Transport-Security` を付ける（サブドメインには広げない） |

### 8.1 ホスティング

**決定: Vercel（2026-10-02）**。静的配信になったため、条件は次の3つになった。

1. 静的ファイルを配信できる
2. レスポンスヘッダー（COOP / COEP / HSTS）をパスごとに設定できる（Vercel は `vercel.json` の `headers` で設定できる）
3. http を https へリダイレクトする（Vercel は常に行う）

料金（第三者の解説記事による。公式の料金ページは未確認）:

| プラン | 料金 | 条件 |
| --- | --- | --- |
| Hobby | 無料 | 非商用の個人利用に限る。個人のポートフォリオは対象に含まれるとされる |
| Pro | 1ユーザーあたり月 20 ドル（年払い）／月 24 ドル（月払い） | 商用利用可 |

無料であることは条件にしない。プランは目的が商用に当たるかで決める。

### 8.2 DNS（ドメインはさくらインターネットで取得済み）

- ネームサーバーはさくらのまま。`mewton.jp`（apex。現在未使用）に Vercel 指定の A レコードを追加する。
- `mail.mewton.jp` と `slmail.mewton.jp` でメールが稼働中のため、ネームサーバーは移さない（Cloudflare などへの移行は見送った）。
- CAA レコードがある場合は、Vercel の証明書発行元を許可する。

### 8.3 フォント（2026-10-02）

Google Fonts のフォント（OFL ライセンス）を同梱し、自分のドメインから配信する（COEP の制約のため外部 CDN は使わない）。

| 場所 | フォント | 読み込み |
| --- | --- | --- |
| メインパネルのページ（文章） | M PLUS 1 | ページに出る文字だけにビルド時に絞る |
| メインパネルのページ（コード風の部分） | M PLUS 1 Code | 同上 |
| ターミナル（等幅） | M PLUS 1 Code | フルサイズ。IDE モードに切り替えたときに読み込む |
| ターミナル（絵文字） | Noto Color Emoji | コンテンツで使う絵文字だけに絞る。IDE モードに切り替えたときに読み込む |

- M PLUS 1 Code は実測で半角 0.5 / 全角 1.0（1:2）、罫線・ブロック文字も半角幅で、xterm.js の扱いと一致する（詳細設計 9章）。
- 要確認: Noto Color Emoji（COLRv1）を Safari で表示できるか。

## 9. 未決定事項

- [ ] ディレクトリ構成（どのページを置くか）（4.1）
- [ ] 経歴の粒度（4.1）
- [ ] Content Collections のスキーマ（4.2）
- [ ] ターミナルの表示部品の確定（xterm.js が有力候補。6章）
- [ ] コンテンツのページを直接開いたときの扱い（6.1）
- [ ] コンテンツのページを置くパスの名前（6.1。`/_content/` は仮）
- [ ] IDE モードを開いた回数の把握方法（5.3 の判断材料。アクセス解析をどうするかと合わせて決める）
- [ ] スマートフォンで IDE モードを出すか（8章）
- [ ] 配色・レイアウトなどの見た目（後で決める。過去に決めたパーソナル向けデザイン要件に従う。フォントと食い違いがないかも確認する）
- [ ] 帰属表示の場所・文言（必須。7.3）
- [ ] WebContainer の Personal プランの登録と、API セッションの数え方の確認（7.3）
- [ ] Vercel のプランと料金の公式での確認（8.1）
- [ ] apex 用 A レコードの値の確認（8.2）
- [ ] Noto Color Emoji の Safari での表示確認（8.3）
- [ ] projects を作るか（将来。5.3）
- [ ] CMS の方式（将来。4.2）

## 10. 経緯

### 10.1 curl を入口にする構成（2026-10-01〜02。廃止）

`curl https://mewton.jp` を入口にし、`Accept` ヘッダーで curl にはテキスト、ブラウザには HTML を返す構成を検討していた。2026-10-02 に、IDE 風の構成（1章）へ変更し、curl の入口に関わる決定はすべて廃止した。

廃止した主な決定: Nitro によるサーバー側の出し分け（`Vary: Accept`、CORS）、ランタイムに依存しないための制約、ANSI による装飾（24bit カラー、Markdown 記号を残した装飾、ハーフブロックのアイコン）、80桁の桁揃え、絵文字の制限（`Emoji_Presentation` の単一コードポイントのみ）、`/career` `/skills` `/talks` と `*.md`、curl の候補（ゴーストテキスト）。

この時期の調査と検証（記録として残す）:

- Nitro の各 preset（Node.js・Cloudflare Workers・Vercel・Netlify）で、同じコードの応答が一致することを確認した（リポジトリ内の試作コード）
- ホスティング候補の比較（Cloudflare Workers・Fly.io・Vercel・Netlify・Deno Deploy・Void）と DNS への影響。Void（VoidZero）は Nitro 単体に対応しておらず、apex で使う場合に DNS の問題が残るため見送った
- xterm.js の装飾対応と文字幅の実測（詳細設計 10章）

### 10.2 URL の構成の改定（2026-10-02）

IDE 風の構成にした当初は「Astro のページが正の URL で、最大化をやめると IDE がそのページの上に立ち上がり、iframe に同じページを入れ直す」としていた。同日、「親ページ（CSR）の中に常に iframe があり、最大化は iframe を画面いっぱいにした状態」に改めた。理由は 6.1。

### 10.3 試作コード

リポジトリの現在のコード（`server/` `client/` `content/` など）は 2026-10-01 時点の試作で、curl を入口にする構成のもの。現在の要件・詳細設計には対応していない。
