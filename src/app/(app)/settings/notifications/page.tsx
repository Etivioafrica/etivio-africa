import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProfileDetails } from "@/lib/data/profile";
import { SetRow } from "../SetRow";
import { NotificationToggles } from "./NotificationToggles";

export const metadata = { title: "Notifications" };

export default async function NotificationSettings() {
  const user = await getCurrentUser();
  const p = await getProfileDetails(user.id);
  if (!p) notFound();

  return (
    <SetRow title="Email notifications" sub="Choose what we email you about. Sign-in, password, and payment emails are always sent.">
      <NotificationToggles prefs={p.notificationPrefs} />
    </SetRow>
  );
}
