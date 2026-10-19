// Course skills: comma-separated in the editor, stored as a short, de-duplicated list.
export function parseSkills(raw: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const skill = part.trim().replace(/\s+/g, " ").slice(0, 40);
    const key = skill.toLowerCase();
    if (skill && !seen.has(key)) {
      seen.add(key);
      out.push(skill);
    }
  }
  return out.slice(0, 12);
}
