import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ThemeScope } from "@/components/learn/PlayerFrame";
import { CallRoom } from "@/components/coaching/CallRoom";
import { getCurrentUser } from "@/lib/auth";
import { featureOn } from "@/lib/data/features";
import { getSessionRoom, roomWindow } from "@/lib/data/coaching";

export const metadata = { title: "Coaching session" };

type Props = { params: Promise<{ id: string }> };

export default function SessionCallPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="et-cr-loading" />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: Props) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!(await featureOn("coaching"))) notFound();
  const room = await getSessionRoom(id, user.id);
  if (!room) notFound();
  const { opens, closes } = roomWindow(room);
  return (
    <ThemeScope>
      <CallRoom room={room} opensAt={opens} closesAt={closes} backHref={room.role === "coach" ? "/teach/coaching" : "/learn/sessions"} />
    </ThemeScope>
  );
}
