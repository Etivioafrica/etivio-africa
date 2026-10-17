"use server";
import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { deleteObject } from "@/lib/r2";
import type { Database } from "@/lib/database.types";
import type { FormState } from "@/app/(app)/teach/actions";

type Visibility = Database["public"]["Enums"]["document_visibility"];
const VIS: Visibility[] = ["public", "enrolled", "private"];
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function addDocument(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin();
  const url = str(fd, "file");
  if (!url) return { error: "Upload a file first." };
  const title = str(fd, "title") || str(fd, "file_name");
  if (!title) return { error: "Give the document a title." };
  const courseId = str(fd, "course_id") || null;
  let visibility = str(fd, "visibility") as Visibility;
  if (!VIS.includes(visibility)) visibility = "enrolled";
  if (visibility === "enrolled" && !courseId) return { error: "Pick a course for documents limited to enrolled students." };

  const { data, error } = await db
    .from("documents")
    .insert({
      title,
      description: str(fd, "description") || null,
      file_url: url,
      file_key: str(fd, "file_key") || null,
      file_name: str(fd, "file_name") || null,
      file_size: Number(str(fd, "file_size")) || null,
      mime_type: str(fd, "file_type") || null,
      course_id: courseId,
      visibility,
      uploaded_by: admin.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not save the document." };
  await audit(admin.id, "document.create", { type: "document", id: data.id }, { title });
  refresh();
  return { ok: "Document added." };
}

export async function updateDocument(fd: FormData) {
  const { db } = await requireAdmin();
  const visibility = str(fd, "visibility") as Visibility;
  if (!VIS.includes(visibility)) return;
  await db.from("documents").update({ visibility }).eq("id", str(fd, "id"));
  refresh();
}

export async function deleteDocument(fd: FormData) {
  const { admin, db } = await requireAdmin();
  const id = str(fd, "id");
  const { data } = await db.from("documents").select("file_key, title").eq("id", id).single();
  await db.from("documents").delete().eq("id", id);
  await deleteObject(data?.file_key ?? null);
  await audit(admin.id, "document.delete", { type: "document", id }, { title: data?.title ?? "" });
  refresh();
}
