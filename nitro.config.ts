import { defineNitroConfig } from "nitropack/config";

export default defineNitroConfig({
  srcDir: "server",
  compatibilityDate: "2026-10-01",
  // srcDir 基準のパス。client/ のビルド結果を public/ から配信する
  publicAssets: [{ dir: "../public" }],
  serverAssets: [{ baseName: "content", dir: "../content" }],
  runtimeConfig: {
    // curl で叩かせるホスト名。表示テキストとブラウザのターミナルで使う
    siteHost: "mewton.jp",
  },
});
