import { redirect } from "next/navigation";

// Saved moved out of Profile to its own page; old links land there.
export default function OldSaved() {
  redirect("/learn/saved");
}
