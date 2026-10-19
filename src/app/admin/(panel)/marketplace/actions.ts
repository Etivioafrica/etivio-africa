"use server";
import { refresh } from "next/cache";
import { after } from "next/server";
import { emailProductDecision } from "@/lib/email/notify";
import { audit, requireAdmin } from "@/lib/admin";
import { saveProduct, type ProductInput } from "@/lib/data/products-admin";
import { deleteObject, keyFromUrl } from "@/lib/r2";

type Result = { ok?: string; error?: string; id?: string; slug?: string };

export async function adminSaveProduct(input: ProductInput): Promise<Result> {
  const { admin } = await requireAdmin("marketplace");
  const res = await saveProduct({ id: admin.id, isAdmin: true }, input);
  if (res.id) await audit(admin.id, input.id ? "product.update" : "product.create", { type: "product", id: res.id }, { title: input.title, intent: input.intent });
  refresh();
  return res;
}

// Approve, request changes on, archive, or restore a product.
export async function setProductStatus(id: string, action: "approve" | "reject" | "archive" | "restore", note = ""): Promise<Result> {
  const { admin, db } = await requireAdmin("marketplace");
  const { data: p } = await db.from("products").select("status, published_at, creator_id").eq("id", id).maybeSingle();
  if (!p) return { error: "That product no longer exists." };
  if (action === "reject" && !note.trim()) return { error: "Tell the creator what to change." };
  const update =
    action === "approve"
      ? { status: "published" as const, review_note: null, ...(p.published_at ? {} : { published_at: new Date().toISOString() }) }
      : action === "reject"
        ? { status: "rejected" as const, review_note: note.trim().slice(0, 1000), featured: false }
        : action === "archive"
          ? { status: "archived" as const, featured: false }
          : { status: "draft" as const };
  await db.from("products").update(update).eq("id", id);
  await audit(admin.id, `product.${action}`, { type: "product", id }, note ? { note } : {});
  // Let the tutor know, unless the admin is reviewing their own product.
  if ((action === "approve" || action === "reject") && p.creator_id !== admin.id) after(() => emailProductDecision(id, action === "approve"));
  refresh();
  return { ok: { approve: "Approved and live.", reject: "Sent back to the creator.", archive: "Archived. Owners keep their downloads.", restore: "Moved back to drafts." }[action] };
}

// Only products nobody owns can be deleted; owned ones are archived so buyers keep access.
export async function deleteProduct(id: string): Promise<Result> {
  const { admin, db } = await requireAdmin("marketplace");
  const { count } = await db.from("product_access").select("user_id", { count: "exact", head: true }).eq("product_id", id);
  if (count) return { error: "People own this product, so it can't be deleted. Archive it instead." };
  const [{ data: p }, { data: files }] = await Promise.all([db.from("products").select("title, cover_url, gallery").eq("id", id).maybeSingle(), db.from("product_files").select("file_key").eq("product_id", id)]);
  if (!p) return { error: "That product no longer exists." };
  await db.from("products").delete().eq("id", id);
  await Promise.all([...(files ?? []).map((f) => f.file_key), keyFromUrl(p.cover_url), ...p.gallery.map(keyFromUrl)].filter(Boolean).map((k) => deleteObject(k)));
  await audit(admin.id, "product.delete", { type: "product", id }, { title: p.title });
  refresh();
  return { ok: "Deleted." };
}

// Asks Paystack about a pending payment and grants access if it actually went through. A manual fallback for when
// a webhook didn't arrive.
export async function recheckPayment(reference: string): Promise<Result> {
  const { admin } = await requireAdmin("marketplace");
  const { verifyTransaction } = await import("@/lib/paystack");
  const { fulfillPayment } = await import("@/lib/data/checkout");
  const verified = await verifyTransaction(reference);
  if (!verified.status || !verified.data) return { error: verified.message || "Paystack couldn't find that payment." };
  const res = await fulfillPayment(verified.data);
  await audit(admin.id, "payment.recheck", { type: "payment", id: reference }, { result: res.ok ? "paid" : (res.reason ?? "not paid") });
  refresh();
  return res.ok ? { ok: "Paid. Access has been granted." } : { error: `Not paid: ${res.reason === "abandoned" ? "the buyer didn't finish checkout" : (res.reason ?? "unknown")}.` };
}
