# web

`curl https://mewton.jp` で読めるポートフォリオ。ブラウザで開くと、WebContainer のターミナル上で同じように `curl` して読める。

要件は [docs/requirements.md](docs/requirements.md)。

## 構成

| パス | 役割 |
| --- | --- |
| `content/` | 掲載内容（Works は Markdown、Talks / プロフィールは YAML） |
| `server/` | Nitro。`Accept` ヘッダーでテキスト / HTML を出し分ける |
| `client/` | ブラウザのターミナル（WebContainer + xterm.js）。esbuild で `public/` に出力 |
| `scripts/check-content.ts` | コンテンツの必須項目の検証。`npm run build` で実行される |

## 開発

```sh
npm install
npm run build
npm start                         # http://localhost:3000

curl localhost:3000/works         # テキスト
open http://localhost:3000/works  # ブラウザでターミナル
```

`npm run typecheck` で型検査。

ブラウザのターミナル冒頭に出る `[diag]` 行は試作用の診断で、WebContainer 内の `curl` の有無と通信の可否を表示する。

## ランタイムを変えて試す

Nitro の preset を切り替えると、同じコードを別のランタイム向けにビルドできる（要件書 7.4）。

```sh
# Cloudflare Workers（workerd）でローカル実行
NITRO_PRESET=cloudflare-module npm run build
npx wrangler dev .output/server/index.mjs --assets .output/public --compatibility-flags nodejs_compat
```

```sh
# Vercel / Netlify 向け（出力先はそれぞれ .vercel/ と .netlify/ + dist/）
NITRO_PRESET=vercel npm run build
NITRO_PRESET=netlify npm run build
```

> 注: このリポジトリの現在のコード（`server/` `client/` など）は 2026-10-01 時点の試作。詳細設計（[docs/design.md](docs/design.md)）のモノレポ構成には未対応。
