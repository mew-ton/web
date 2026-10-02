// WebContainer に curl が無い場合に置く、最小限の curl 互換コマンド（要件書 7.2）
// WebContainer の中で node が実行するため、ここでは文字列として持つ
export const CURL_SHIM = `#!/usr/bin/env node
const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("-"));
if (!target) {
  console.error("curl: no URL specified!");
  process.exit(2);
}
let url = new URL(/^https?:\\/\\//.test(target) ? target : "http://" + target);
// サイトのホストは、このページの配信元へ向ける（ローカル開発でも同じコマンドで動くように）
if (url.host === process.env.MEWTON_HOST) url = new URL(url.pathname + url.search, process.env.MEWTON_ORIGIN);
try {
  const res = await fetch(url, { headers: { accept: "text/plain" } });
  process.stdout.write(await res.text());
} catch (e) {
  console.error("curl: " + (e && e.message ? e.message : e));
  process.exit(7);
}
`;
