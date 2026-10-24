"use server";
import { refresh } from "next/cache";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { saveProduct, type ProductInput } from "@/lib/data/products-admin";
import { moderate, reviewProductText } from "@/lib/moderation";

// Tutors save drafts and submit for review; they can never publish directly.
export async function tutorSaveProduct(input: ProductInput) {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) return { error: "Only approved tutors can add products." };
  // Quick word-list check on every save; the AI reads it all once it's submitted.
  const check = await moderate("product", user.id, [input.title, input.summary, input.description.replace(/<[^>]+>/g, " "), input.tags, input.formats], undefined, { ai: false, strike: false });
  if (check.error) return { error: check.error };
  const intent = input.intent === "publish" ? "submit" : input.intent;
  const res = await saveProduct({ id: user.id, isAdmin: false }, { ...input, intent, featured: false });
  if ("id" in res && res.id && intent === "submit") {
    const productId = res.id;
    after(() => reviewProductText(productId, user.id));
  }
  refresh();
  return res;
}
