// コンテンツの解析と検証。Nitro に依存させず、scripts/check-content.ts からも使う
import { parse } from "yaml";

export type Profile = {
  name: string;
  tagline: string;
  about: string;
  skills: string[];
  career: { period: string; summary: string }[];
  contact: { label: string; value: string }[];
};

export type Work = {
  slug: string;
  title: string;
  fields: string[];
  summary: string;
  period: string;
  role?: string;
  tech: string[];
  links: string[];
  // 空なら詳細ページを作らない（要件書 5.1）
  body: string;
};

export type Talk = {
  kind: string;
  title: string;
  date: string;
  venue: string;
  url: string;
};

export type Site = { profile: Profile; works: Work[]; talks: Talk[] };

const WORK_FIELDS = ["Web開発", "デザイン", "OSS"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class ContentError extends Error {}

function fail(source: string, message: string): never {
  throw new ContentError(`${source}: ${message}`);
}

function str(source: string, obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value === "number" || value instanceof Date) {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  }
  if (typeof value !== "string" || value.trim() === "") fail(source, `"${key}" は必須です`);
  return value.trim();
}

function strList(source: string, obj: Record<string, unknown>, key: string, required = true): string[] {
  const value = obj[key];
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== "string")) {
    fail(source, `"${key}" は1件以上の文字列の配列にしてください`);
  }
  return value as string[];
}

function record(source: string, value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(source, "オブジェクトではありません");
  return value as Record<string, unknown>;
}

export function parseProfile(raw: string, source = "profile.yaml"): Profile {
  const obj = record(source, parse(raw));
  const career = obj.career;
  const contact = obj.contact;
  if (!Array.isArray(career)) fail(source, '"career" は配列にしてください');
  if (!Array.isArray(contact)) fail(source, '"contact" は配列にしてください');
  return {
    name: str(source, obj, "name"),
    tagline: str(source, obj, "tagline"),
    about: str(source, obj, "about"),
    skills: strList(source, obj, "skills"),
    career: career.map((c, i) => {
      const r = record(`${source} career[${i}]`, c);
      return { period: str(source, r, "period"), summary: str(source, r, "summary") };
    }),
    contact: contact.map((c, i) => {
      const r = record(`${source} contact[${i}]`, c);
      return { label: str(source, r, "label"), value: str(source, r, "value") };
    }),
  };
}

export function parseWork(fileName: string, raw: string): Work {
  const source = `works/${fileName}`;
  const slug = fileName.replace(/\.md$/, "");
  if (!SLUG.test(slug)) fail(source, "ファイル名は小文字英数字とハイフンにしてください");

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) fail(source, "frontmatter がありません");
  const meta = record(source, parse(match[1]));

  const fields = strList(source, meta, "fields");
  for (const f of fields) {
    if (!WORK_FIELDS.includes(f)) fail(source, `分野 "${f}" は ${WORK_FIELDS.join(" / ")} のいずれかにしてください`);
  }
  const links = strList(source, meta, "links", false);
  // テキストでは画像を見せられないため、デザイン作品は外部リンク必須（要件書 5.1）
  if (fields.includes("デザイン") && links.length === 0) fail(source, "デザイン作品は外部リンクが必須です");

  return {
    slug,
    title: str(source, meta, "title"),
    fields,
    summary: str(source, meta, "summary"),
    period: str(source, meta, "period"),
    role: meta.role === undefined ? undefined : str(source, meta, "role"),
    tech: strList(source, meta, "tech"),
    links,
    body: match[2].trim(),
  };
}

export function parseTalks(raw: string, source = "talks.yaml"): Talk[] {
  const list = parse(raw);
  if (!Array.isArray(list)) fail(source, "配列にしてください");
  return list.map((t, i) => {
    const s = `${source}[${i}]`;
    const r = record(s, t);
    return {
      kind: str(s, r, "kind"),
      title: str(s, r, "title"),
      date: str(s, r, "date"),
      venue: str(s, r, "venue"),
      url: str(s, r, "url"),
    };
  });
}
