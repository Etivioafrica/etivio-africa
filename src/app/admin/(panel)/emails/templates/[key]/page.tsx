import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { COMMON, starterFor, templateDef } from "@/lib/email/registry";
import { TemplateEditor } from "./TemplateEditor";

export const metadata = { title: "Edit email" };

type Props = { params: Promise<{ key: string }> };

export default function EditTemplatePage({ params }: Props) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: "80vh", margin: 24 }} />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Props) {
  const { key } = await params;
  const def = templateDef(key);
  if (!def) notFound();
  const { db } = await requireAdmin("emails");
  const { data: saved } = await db.from("email_templates").select("subject, design").eq("key", key).maybeSingle();
  return (
    <TemplateEditor
      key={key}
      templateKey={key}
      label={def.label}
      when={def.when}
      subject={saved?.subject ?? def.subject}
      design={(saved?.design as object | undefined) ?? starterFor(def)}
      placeholders={[...def.placeholders, ...(def.group === "app" ? COMMON : [])]}
      customised={!!saved}
      isAuth={def.group === "auth"}
    />
  );
}
