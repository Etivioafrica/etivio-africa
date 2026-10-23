import { notFound, redirect } from "next/navigation";
import { ProductEditor } from "@/components/market/ProductEditor";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { getCategories } from "@/lib/data/marketplace";
import { toFormValues } from "@/lib/data/product-form";
import { bundleOptions, loadProductForEdit } from "@/lib/data/products-admin";
import { tutorSaveProduct } from "../actions";
import { featureOn } from "@/lib/data/features";

export const metadata = { title: "Edit product" };

export default async function EditTutorProduct({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) redirect("/teach");
  const { id } = await params;
  const loaded = /^[0-9a-f-]{36}$/i.test(id) ? await loadProductForEdit(id) : null;
  if (!loaded || loaded.product.creator_id !== user.id) notFound();
  const [categories, options] = await Promise.all([getCategories(), bundleOptions({ id: user.id, isAdmin: false }, id)]);
  return (
    <ProductEditor
      ai={await featureOn("ai_course_tools")}
      key={loaded.product.updated_at}
      mode="tutor"
      initial={toFormValues(loaded)}
      status={loaded.product.status}
      reviewNote={loaded.product.review_note}
      categories={categories.filter((c) => !c.parent_id)}
      bundleOptions={options}
      backHref="/teach/products"
      onSave={tutorSaveProduct}
    />
  );
}
