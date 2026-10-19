"use server";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { saveProduct, type ProductInput } from "@/lib/data/products-admin";

// Tutors save drafts and submit for review; they can never publish directly.
export async function tutorSaveProduct(input: ProductInput) {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) return { error: "Only approved tutors can add products." };
  const res = await saveProduct({ id: user.id, isAdmin: false }, { ...input, intent: input.intent === "publish" ? "submit" : input.intent, featured: false });
  refresh();
  return res;
}
