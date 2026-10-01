import { notFoundPage, renderPage } from "../utils/render";
import { renderHtml } from "../utils/html";
import { loadSite } from "../utils/load";

export default defineEventHandler(async (event) => {
  const { siteHost } = useRuntimeConfig(event);
  const path = event.path.split("?")[0].replace(/\/+$/, "") || "/";
  const page = renderPage(path, await loadSite(), siteHost);

  // テキストか HTML かは Accept だけで決める（要件書 7.1）
  const wantsHtml = (getRequestHeader(event, "accept") ?? "").includes("text/html");
  setResponseHeader(event, "Vary", "Accept");
  if (!page) setResponseStatus(event, 404);

  if (!wantsHtml) {
    // curl mewton.jp は http で来る。リダイレクトすると curl は何も表示しないため、http のまま本文を返す
    setResponseHeaders(event, {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    return (page ?? notFoundPage(siteHost)).text;
  }

  // WebContainer は HTTPS が必須なので、ブラウザだけ https へ寄せる
  const host = getRequestHost(event, { xForwardedHost: true });
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (!isLocal && getRequestProtocol(event, { xForwardedProto: true }) === "http") {
    return sendRedirect(event, `https://${host}${event.path}`, 301);
  }

  setResponseHeaders(event, {
    "Content-Type": "text/html; charset=utf-8",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  });
  return renderHtml(page ?? notFoundPage(siteHost), path, siteHost);
});
