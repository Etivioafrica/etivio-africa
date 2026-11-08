import { redirect } from "next/navigation";

export default function ChartsIndex() {
  redirect("/admin/charts/revenue");
}
