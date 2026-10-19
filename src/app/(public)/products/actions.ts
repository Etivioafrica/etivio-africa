"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { grantProduct } from "@/lib/data/grants";

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
