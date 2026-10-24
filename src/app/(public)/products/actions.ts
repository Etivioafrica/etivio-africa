"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { grantProduct } from "@/lib/data/grants";
import { moderate } from "@/lib/moderation";

async function signedIn(next: string) {
  const user = await sessionUser(await createClient());
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function claimFreeProduct(fd: FormData) {
  const slug = String(fd.get("slug") ?? "");
  const user = await signedIn(`/products/${slug}`);
  const { data: p } = await createAdminClient().from("products").select("id, price_minor, status").eq("slug", slug).maybeSingle();
  if (!p || p.status !== "published" || p.price_minor !== 0) redirect(`/products/${slug}`);
  await grantProduct(user.id, p.id);
  redirect("/learn/library");
}

export async function toggleSavedProduct(fd: FormData) {
  const slug = String(fd.get("slug") ?? "");
  const user = await signedIn(`/products/${slug}`);
  const db = createAdminClient();
  const { data: p } = await db.from("products").select("id").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!p) return;
  if (fd.get("saved") === "1") await db.from("saved_products").delete().eq("user_id", user.id).eq("product_id", p.id);
  else await db.from("saved_products").upsert({ user_id: user.id, product_id: p.id }, { onConflict: "user_id,product_id", ignoreDuplicates: true });
  refresh();
}

// One review per owner per product. Editing it sends it back for approval.
export async function submitProductReview(productId: string, rating: number, body: string): Promise<{ ok?: string; error?: string }> {
  const user = await sessionUser(await createClient());
  if (!user) return { error: "Sign in again to leave a review." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Pick a star rating." };
  const db = createAdminClient();
  const [{ data: p }, { data: access }] = await Promise.all([
    db.from("products").select("creator_id, status").eq("id", productId).maybeSingle(),
    db.from("product_access").select("granted_at").eq("product_id", productId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!p || p.status !== "published") return { error: "This product is no longer available." };
  if (!access || p.creator_id === user.id) return { error: "Only people who own this product can review it." };
  const text = body.trim().slice(0, 2000);
  const check = await moderate("product_review", user.id, [text]);
  if (check.error) return { error: check.error };
  const { data, error } = await db
    .from("product_reviews")
    .upsert({ product_id: productId, user_id: user.id, rating, body: text || null, approved: false }, { onConflict: "product_id,user_id" })
    .select("id")
    .single();
  if (error) return { error: "Couldn't save your review. Try again." };
  await check.record(data?.id);
  refresh();
  return { ok: "Thanks! Your review shows on the product once the team has checked it." };
}
