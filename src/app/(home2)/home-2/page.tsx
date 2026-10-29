import { redirect } from "next/navigation";

// Home 2 is now the home page; old links land there.
export default function OldHome2() {
  redirect("/");
}
