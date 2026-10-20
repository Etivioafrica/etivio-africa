// Rebuilds supabase/templates/*.html from src/lib/email/templates.ts. Then apply them with configure-auth-email.mjs.
//   npx tsx scripts/build-auth-templates.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { AUTH_EMAILS, authEmail } from "../src/lib/email/templates";
import { authLink } from "../src/lib/email/auth-links";

const dir = new URL("../supabase/templates/", import.meta.url);
mkdirSync(dir, { recursive: true });
const subjects: Record<string, string> = {};
for (const kind of AUTH_EMAILS) {
  const e = authEmail(kind, { url: authLink(kind), email: "{{ .Email }}", newEmail: "{{ .NewEmail }}" });
  writeFileSync(new URL(`${kind}.html`, dir), `${e.html}\n`);
  subjects[kind] = e.subject;
}
writeFileSync(new URL("subjects.json", dir), `${JSON.stringify(subjects, null, 2)}\n`);
console.log(`Wrote ${AUTH_EMAILS.length} templates.`);
