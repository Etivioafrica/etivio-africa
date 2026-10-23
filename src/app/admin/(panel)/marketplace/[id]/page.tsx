import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/market/ProductEditor";
import { requireAdmin } from "@/lib/admin";
import { getCategories } from "@/lib/data/marketplace";
import { toFormValues } from "@/lib/data/product-form";
import { bundleOptions, loadProductForEdit } from "@/lib/data/products-admin";
import { adminSaveProduct } from "../actions";
import { ProductReview } from "./ProductReview";
import { featureOn } from "@/lib/data/features";

export const metadata = { title: "Edit product" };

type Props = { params: Promise<{ id: string }> };

export default function EditProductPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 600 }} />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Props) {
  const { id } = await params;
  const { admin, db } = await requireAdmin("marketplace");
  const loaded = /^[0-9a-f-]{36}$/i.test(id) ? await loadProductForEdit(id) : null;
  if (!loaded) notFound();
  const [categories, options, { data: creator }] = await Promise.all([
    getCategories(),
    bundleOptions({ id: admin.id, isAdmin: true }, id),
    db.from("profiles").select("full_name").eq("id", loaded.product.creator_id).maybeSingle(),
  ]);
  return (
    <>
      <ProductReview
        id={id}
        status={loaded.product.status}
        creator={creator?.full_name || "Unknown"}
        owners={loaded.owners}
        downloads={loaded.downloads}
        isOwn={loaded.product.creator_id === admin.id}
      />
      <ProductEditor
        ai={await featureOn("ai_course_tools")}
        key={loaded.product.updated_at}
        mode="admin"
        initial={toFormValues(loaded)}
        status={loaded.product.status}
        reviewNote={loaded.product.review_note}
        categories={categories.filter((c) => !c.parent_id)}
        bundleOptions={options}
        backHref="/admin/marketplace"
        onSave={adminSaveProduct}
      />
    </>
  );
}
