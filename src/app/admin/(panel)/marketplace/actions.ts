"use server";
import { refresh } from "next/cache";
import { after } from "next/server";
import { emailProductDecision, emailProductReviewReply } from "@/lib/email/notify";
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
  // Reviewers can approve or send back; archiving and restoring stay with marketplace admins.
  const { admin, db } = await requireAdmin(action === "approve" || action === "reject" ? ["marketplace", "review"] : "marketplace");
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

// Show or hide a course on the marketplace (/explore). It stays published and reachable everywhere else.
export async function setCourseListed(id: string, listed: boolean): Promise<Result> {
  const { admin, db } = await requireAdmin("marketplace");
  const { error } = await db.from("courses").update({ marketplace_listed: listed }).eq("id", id);
  if (error) return { error: "Couldn't update that course. Try again." };
  await audit(admin.id, listed ? "course.list" : "course.unlist", { type: "course", id });
  refresh();
  return { ok: listed ? "Showing on the marketplace." : "Hidden from the marketplace." };
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
  const { fulfillOrder } = await import("@/lib/data/checkout");
  // Each item's reference is the order's Paystack reference plus "-1", "-2"…; Paystack only knows the order's.
  const orderRef = reference.replace(/-\d+$/, "");
  const verified = await verifyTransaction(orderRef);
  if (!verified.status || !verified.data) return { error: verified.message || "Paystack couldn't find that payment." };
  const res = await fulfillOrder(verified.data);
  await audit(admin.id, "payment.recheck", { type: "payment", id: reference }, { result: res.ok ? "paid" : (res.reason ?? "not paid") });
  refresh();
  return res.ok ? { ok: "Paid. Access has been granted." } : { error: `Not paid: ${res.reason === "abandoned" ? "the buyer didn't finish checkout" : (res.reason ?? "unknown")}.` };
}

// Product reviews -------------------------------------------------------------------------

export async function approveProductReview(id: string, approved: boolean): Promise<Result> {
  const { admin, db } = await requireAdmin("marketplace");
  const { error } = await db.from("product_reviews").update({ approved }).eq("id", id);
  if (error) return { error: "Could not update the review." };
  await audit(admin.id, approved ? "review.approve" : "review.hide", { type: "product_review", id });
  refresh();
  return { ok: approved ? "Approved. It now shows on the product." : "Hidden." };
}

export async function replyToProductReview(id: string, reply: string): Promise<Result> {
  const { admin, db } = await requireAdmin("marketplace");
  const text = reply.trim().slice(0, 2000);
  const { error } = await db
    .from("product_reviews")
    .update(text ? { admin_reply: text, replied_at: new Date().toISOString(), approved: true } : { admin_reply: null, replied_at: null })
    .eq("id", id);
  if (error) return { error: "Could not save the reply." };
  await audit(admin.id, "review.reply", { type: "product_review", id });
  if (text) after(() => emailProductReviewReply(id));
  refresh();
  return { ok: text ? "Reply posted." : "Reply removed." };
}

export async function deleteProductReview(id: string): Promise<Result> {
  const { admin, db } = await requireAdmin("marketplace");
  await db.from("product_reviews").delete().eq("id", id);
  await audit(admin.id, "review.delete", { type: "product_review", id });
  refresh();
  return { ok: "Deleted." };
}
