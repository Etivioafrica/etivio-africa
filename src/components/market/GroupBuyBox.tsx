import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupPrice, openGroups } from "@/lib/data/group-buy";
import { formatPrice } from "@/lib/format";
import { GroupButton } from "./GroupButton";
import { featureOnForVisitor } from "@/lib/data/features";

const left = (iso: string) => {
  const h = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 3_600_000));
  return h >= 48 ? `${Math.round(h / 24)} days left` : h >= 1 ? `${h} hours left` : "closing soon";
};

// "Buy with friends" on the course page, when an admin has switched group buy on for the course.
// Render after connection(): the time left depends on now.
export async function GroupBuyBox({ courseId }: { courseId: string }) {
  if (!(await featureOnForVisitor("group_buy"))) return null;
  const { data: c } = await createAdminClient().from("courses").select("id, price_minor, currency, group_buy_enabled, group_size, group_discount_percent, group_days").eq("id", courseId).maybeSingle();
  if (!c || !c.group_buy_enabled || c.price_minor <= 0) return null;
  const groups = await openGroups(c.id);
  const each = groupPrice(c.price_minor, c.group_discount_percent);
  return (
    <div className="et-gb">
      <div className="et-gb-head">
        <span className="et-gb-off">{c.group_discount_percent}% off</span>
        <b>Buy with friends</b>
      </div>
      <p className="et-gb-price">
        {formatPrice(each, c.currency)} <s>{formatPrice(c.price_minor, c.currency)}</s> <small>each</small>
      </p>
      <p className="et-gb-how">
        Start a group and share the link. When {c.group_size} people join within {c.group_days} {c.group_days === 1 ? "day" : "days"}, everyone gets the course. If it doesn&apos;t fill, your money goes to your Etivio wallet.
      </p>
      {groups.length > 0 && (
        <ul className="et-gb-open">
          {groups.map((g) => (
            <li key={g.code}>
              <Link href={`/groups/${g.code}`}>
                <span>
                  <b>
                    {g.joined} of {g.size} joined
                  </b>
                  <small>{left(g.expiresAt)}</small>
                </span>
                <em>Join</em>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <GroupButton mode="start" courseId={c.id} label={groups.length ? "Or start your own group" : "Start a group"} />
    </div>
  );
}
