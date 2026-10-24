"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionUser } from "@/lib/supabase/session";
import { completeFreeOrder, createOrder, paystackCheckoutUrl, priceItems, type Billing } from "@/lib/data/checkout";
import { createGroup } from "@/lib/data/group-buy";
import { walletBalance } from "@/lib/data/wallet";
import { paystackReady } from "@/lib/paystack";
import { featureOn } from "@/lib/data/features";

export type GroupActionState = { error?: string } | null;

// Signed-in only: members are tracked by account, and a group that doesn't fill credits their wallet.
async function buyer(next: string) {
  const viewer = await sessionUser(await createClient());
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data: profile } = await createAdminClient().from("profiles").select("full_name").eq("id", viewer.id).maybeSingle();
  const [firstName = "Etivio", ...rest] = (profile?.full_name || viewer.email.split("@")[0]).trim().split(/\s+/);
  const billing: Billing = { firstName, lastName: rest.join(" ") || "Learner", email: viewer.email, phone: "", country: "", state: "" };
  return { viewer, billing };
}

// One course at the group price, paid from the wallet first, then Paystack for the rest.
async function payForGroup(userId: string, billing: Billing, courseId: string, group: { id: string; unit_price_minor: number }, title: string): Promise<GroupActionState> {
  const [item] = await priceItems([{ type: "course", id: courseId }], userId);
  if (!item || item.problem === "unavailable") return { error: "This course isn't available right now." };
  if (item.problem === "owned") return { error: "You already have this course." };
  const priced = { ...item, priceMinor: group.unit_price_minor, problem: null };
  const wallet = Math.min(await walletBalance(userId), priced.priceMinor);
  if (wallet < priced.priceMinor && !paystackReady()) return { error: "Payments aren't available right now. Please try again later." };
  const order = await createOrder(userId, billing, [priced], { groupBuyId: group.id, walletMinor: wallet });
  if (!order) return { error: "We couldn't start your order. Please try again." };
  if (order.total_minor === 0) {
    const done = await completeFreeOrder(order.id);
    if (!done.ok || !done.destination) return { error: "We couldn't use your wallet just now. Please try again." };
    redirect(done.destination);
  }
  const url = await paystackCheckoutUrl(order, billing, [`${title} (group)`]);
  if (!url) return { error: "We couldn't reach the payment provider. Please try again." };
  redirect(url);
}

export async function startGroup(_prev: GroupActionState, fd: FormData): Promise<GroupActionState> {
  const courseId = String(fd.get("course_id") ?? "");
  const db = createAdminClient();
  const { data: course } = await db
    .from("courses")
    .select("id, slug, title, status, price_minor, currency, group_buy_enabled, group_size, group_discount_percent, group_days")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.status !== "published" || !course.group_buy_enabled || course.price_minor <= 0) return { error: "Group buy isn't available for this course." };
  const { viewer, billing } = await buyer(`/courses/${course.slug}`);
  if (!(await featureOn("group_buy"))) return { error: "Group buy isn't available right now." };
  const group = await createGroup(course, viewer.id);
  if (!group) return { error: "We couldn't start a group just now. Please try again." };
  return payForGroup(viewer.id, billing, course.id, group, course.title);
}

export async function joinGroup(_prev: GroupActionState, fd: FormData): Promise<GroupActionState> {
  const code = String(fd.get("code") ?? "");
  const db = createAdminClient();
  const { data: g } = await db.from("group_buys").select("id, status, size, expires_at, unit_price_minor, course:courses(id, title, status)").eq("code", code).maybeSingle();
  if (!g || !g.course) return { error: "That group doesn't exist." };
  const { viewer, billing } = await buyer(`/groups/${code}`);
  if (!(await featureOn("group_buy"))) return { error: "Group buy isn't available right now." };
  if (g.status !== "open" || Date.parse(g.expires_at) < Date.now()) return { error: "This group has closed. Start a new one from the course page." };
  const [{ count }, { data: mine }] = await Promise.all([
    db.from("group_buy_members").select("user_id", { count: "exact", head: true }).eq("group_id", g.id),
    db.from("group_buy_members").select("user_id").eq("group_id", g.id).eq("user_id", viewer.id).maybeSingle(),
  ]);
  if (mine) return { error: "You're already in this group." };
  if ((count ?? 0) >= g.size) return { error: "This group is full. Start a new one from the course page." };
  return payForGroup(viewer.id, billing, g.course.id, g, g.course.title);
}
