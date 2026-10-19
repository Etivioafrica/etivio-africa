import { redirect } from "next/navigation";
import { ProductEditor } from "@/components/market/ProductEditor";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { getCategories } from "@/lib/data/marketplace";
import { bundleOptions } from "@/lib/data/products-admin";
import { tutorSaveProduct } from "../actions";

export const metadata = { title: "New product" };

export default async function NewTutorProduct() {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) redirect("/teach");
  const [categories, options] = await Promise.all([getCategories(), bundleOptions({ id: user.id, isAdmin: false })]);
  return <ProductEditor mode="tutor" categories={categories.filter((c) => !c.parent_id)} bundleOptions={options} backHref="/teach/products" onSave={tutorSaveProduct} />;
}
