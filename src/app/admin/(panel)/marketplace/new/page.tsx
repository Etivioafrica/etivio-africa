import { ProductEditor } from "@/components/market/ProductEditor";
import { requireAdmin } from "@/lib/admin";
import { getCategories } from "@/lib/data/marketplace";
import { bundleOptions } from "@/lib/data/products-admin";
import { adminSaveProduct } from "../actions";

export const metadata = { title: "New product" };

export default async function NewProduct() {
  const { admin } = await requireAdmin("marketplace");
  const [categories, options] = await Promise.all([getCategories(), bundleOptions({ id: admin.id, isAdmin: true })]);
  return <ProductEditor mode="admin" categories={categories.filter((c) => !c.parent_id)} bundleOptions={options} backHref="/admin/marketplace" onSave={adminSaveProduct} />;
}
