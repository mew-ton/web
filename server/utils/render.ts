import type { Site } from "./content";
import { displayWidth, padEndWidth } from "./width";

export type Page = { title: string; description: string; text: string };

// 案内に表示する正式な叩き方。http は使わせない（要件書 7.1）
export function siteCommand(host: string, path: string): string {
  return `curl https://${host}${path === "/" ? "" : path}`;
}

function indent(text: string, n = 2): string {
  const pad = " ".repeat(n);
  return text
    .split("\n")
    .map((l) => (l ? pad + l : l))
    .join("\n");
}

// 末尾は必ず改行で終える（curl の出力の直後にプロンプトが続かないように）
function page(title: string, description: string, lines: string[]): Page {
  return { title, description, text: lines.join("\n").replace(/\n*$/, "\n") };
}

export function renderPage(path: string, site: Site, host: string): Page | null {
  const { profile, works, talks } = site;
  const cmd = (p: string) => siteCommand(host, p);

  switch (path) {
    case "/": {
      const menu: [string, string][] = [
        [cmd("/about"), "自己紹介・スキル・経歴"],
        [cmd("/works"), "作ったもの"],
        [cmd("/talks"), "執筆・登壇"],
        [cmd("/contact"), "連絡先"],
      ];
      const width = Math.max(...menu.map(([c]) => displayWidth(c))) + 2;
      return page(profile.name, profile.tagline, [
        "",
        `  ${profile.name}`,
        `  ${profile.tagline}`,
        "",
        ...menu.map(([c, label]) => `  ${padEndWidth(c, width)}${label}`),
        "",
      ]);
    }

    case "/about":
      return page(`About - ${profile.name}`, profile.tagline, [
        "",
        "# About",
        "",
        indent(profile.about.trim()),
        "",
        "## Skills",
        "",
        ...profile.skills.map((s) => `  - ${s}`),
        "",
        "## Career",
        "",
        ...profile.career.map((c) => `  ${c.period}  ${c.summary}`),
        "",
      ]);

    case "/works":
      return page(`Works - ${profile.name}`, "作ったもの（Web開発・デザイン・OSS）", [
        "",
        "# Works",
        "",
        ...works.flatMap((w) => [
          `  ${w.title}  [${w.fields.join(" / ")}]  ${w.period}`,
          `    ${w.summary}`,
          ...w.links.map((l) => `    ${l}`),
          ...(w.body ? [`    → ${cmd(`/works/${w.slug}`)}`] : []),
          "",
        ]),
      ]);

    case "/talks":
      return page(`Talks & Writing - ${profile.name}`, "執筆・登壇", [
        "",
        "# Talks & Writing",
        "",
        ...talks.flatMap((t) => [`  ${t.date}  [${t.kind}] ${t.title}`, `    ${t.venue}`, `    ${t.url}`, ""]),
      ]);

    case "/contact":
      return page(`Contact - ${profile.name}`, "連絡先", [
        "",
        "# Contact",
        "",
        ...profile.contact.map((c) => `  ${padEndWidth(c.label, 10)}${c.value}`),
        "",
      ]);
  }

  const slug = path.match(/^\/works\/([^/]+)$/)?.[1];
  const work = works.find((w) => w.slug === slug && w.body);
  if (!work) return null;
  return page(`${work.title} - ${profile.name}`, work.summary, [
    "",
    `# ${work.title}`,
    "",
    `  ${padEndWidth("分野", 10)}${work.fields.join(" / ")}`,
    `  ${padEndWidth("時期", 10)}${work.period}`,
    ...(work.role ? [`  ${padEndWidth("担当", 10)}${work.role}`] : []),
    `  ${padEndWidth("技術", 10)}${work.tech.join(", ")}`,
    ...work.links.map((l, i) => `  ${padEndWidth(i === 0 ? "リンク" : "", 10)}${l}`),
    "",
    // 本文は Markdown のまま出す（テキストへの整形方法は要件書 10章で未決定）
    indent(work.body),
    "",
  ]);
}

export function notFoundPage(host: string): Page {
  return page("Not Found", "ページが見つかりません", ["", "  404 Not Found", "", `  ${siteCommand(host, "/")}`, ""]);
}
