// コンテンツの必須項目を検証し、欠落があれば失敗させる（要件書 8.2）
import { readdirSync, readFileSync } from "node:fs";
import { parseProfile, parseTalks, parseWork } from "../server/utils/content.ts";

const dir = new URL("../content/", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, dir), "utf8");

try {
  parseProfile(read("profile.yaml"));
  parseTalks(read("talks.yaml"));
  const works = readdirSync(new URL("works/", dir)).filter((f) => f.endsWith(".md"));
  for (const f of works) parseWork(f, read(`works/${f}`));
  console.log(`content OK (works: ${works.length})`);
} catch (e) {
  console.error(`content NG: ${(e as Error).message}`);
  process.exit(1);
}
