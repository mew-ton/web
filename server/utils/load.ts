import { parseProfile, parseTalks, parseWork, type Site } from "./content";

export async function loadSite(): Promise<Site> {
  const storage = useStorage("assets:content");
  const keys = await storage.getKeys("works");
  const works = await Promise.all(
    keys
      .filter((k) => k.endsWith(".md"))
      .map(async (k) => parseWork(k.split(":").pop()!, String(await storage.getItem(k)))),
  );
  works.sort((a, b) => b.period.localeCompare(a.period));
  return {
    profile: parseProfile(String(await storage.getItem("profile.yaml"))),
    works,
    talks: parseTalks(String(await storage.getItem("talks.yaml"))).sort((a, b) => b.date.localeCompare(a.date)),
  };
}
