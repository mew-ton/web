import type { Page } from "./render";

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 代替表示の中のリンクを押せるようにする（要件書 6章）
function linkify(text: string, host: string): string {
  const hostPattern = host.replace(/\./g, "\\.");
  return escape(text)
    .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`)
    .replace(new RegExp(`curl ${hostPattern}(/[\\w\\-/]*)?`, "g"), (all, p: string | undefined) => `<a href="${p ?? "/"}">${all}</a>`);
}

export function renderHtml(page: Page, path: string, host: string): string {
  return `<!doctype html>
<html lang="ja" data-site-host="${escape(host)}" data-path="${escape(path)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(page.title)}</title>
<meta name="description" content="${escape(page.description)}">
<meta property="og:title" content="${escape(page.title)}">
<meta property="og:description" content="${escape(page.description)}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="/xterm.css">
<style>
  :root { color-scheme: dark; --bg: #111; --fg: #ddd; --muted: #888; --link: #8ab4f8; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg); }
  body { font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  main { box-sizing: border-box; height: 100%; padding: 16px; display: flex; flex-direction: column; }
  #status { margin: 0 0 8px; color: var(--muted); font-size: 12px; }
  #status:empty { display: none; }
  #fallback { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  #fallback a { color: var(--link); }
  #terminal { flex: 1; min-height: 0; }
  #terminal[hidden] { display: none; }
</style>
</head>
<body>
<main>
<p id="status" role="status" aria-live="polite"></p>
<pre id="fallback">${linkify(`$ curl ${host}${path === "/" ? "" : path}\n${page.text}`, host)}</pre>
<div id="terminal" hidden></div>
</main>
<script type="module" src="/terminal.js"></script>
</body>
</html>
`;
}
