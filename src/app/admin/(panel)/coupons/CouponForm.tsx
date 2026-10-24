"use client";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { BookOpen, Package, Search, Shuffle, Tag, Users } from "lucide-react";
import { saveCoupon } from "./actions";
import type { FormState } from "@/app/(app)/teach/actions";

export type CouponFormValue = {
  id: string;
  code: string;
  description: string | null;
  kind: "percent" | "fixed";
  value: number;
  applies_to: "all" | "courses" | "products" | "selected";
  course_ids: string[];
  product_ids: string[];
  emails: string[];
  max_uses: number | null;
  per_person: number | null;
  min_order_minor: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

export type PickItem = { id: string; title: string; type: "course" | "product"; meta: string };

const APPLIES = [
  { v: "all", label: "Everything" },
  { v: "courses", label: "All courses" },
  { v: "products", label: "All products" },
  { v: "selected", label: "Chosen items" },
] as const;

// Lagos time for datetime-local inputs.
const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 60 * 60 * 1000).toISOString().slice(0, 16) : "");
const naira = (minor: number) => (minor ? String(minor / 100) : "");

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `ETIVIO-${Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")}`;
}

export function CouponForm({ coupon, items }: { coupon: CouponFormValue | null; items: PickItem[] }) {
  const [state, action] = useActionState<FormState, FormData>(saveCoupon, null);
  const [code, setCode] = useState(coupon?.code ?? "");
  const [kind, setKind] = useState<"percent" | "fixed">(coupon?.kind ?? "percent");
  const [value, setValue] = useState(coupon ? String(coupon.kind === "percent" ? coupon.value : coupon.value / 100) : "");
  const [applies, setApplies] = useState<CouponFormValue["applies_to"]>(coupon?.applies_to ?? "all");
  const [audience, setAudience] = useState<"anyone" | "people">(coupon?.emails.length ? "people" : "anyone");
  const [emails, setEmails] = useState(coupon?.emails.join("\n") ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set([...(coupon?.course_ids ?? []), ...(coupon?.product_ids ?? [])]));
  const [find, setFind] = useState("");

  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    return items.filter((i) => !q || i.title.toLowerCase().includes(q));
  }, [items, find]);
  const people = emails.split(/[\s,;]+/).filter(Boolean).length;
  const offLabel = value ? (kind === "percent" ? `${value}% off` : `₦${Number(value).toLocaleString()} off`) : kind === "percent" ? "__% off" : "₦__ off";
  const scopeLabel = applies === "all" ? "everything" : applies === "courses" ? "all courses" : applies === "products" ? "all products" : `${picked.size} chosen ${picked.size === 1 ? "item" : "items"}`;

  return (
    <form action={action} className="et-cp-form">
      {coupon && <input type="hidden" name="id" value={coupon.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="applies_to" value={applies} />
      <input type="hidden" name="audience" value={audience} />
      {applies === "selected" &&
        [...picked].map((id) => {
          const item = items.find((i) => i.id === id);
          return item ? <input key={id} type="hidden" name={item.type === "course" ? "course_ids" : "product_ids"} value={id} /> : null;
        })}

      <div className="et-cp-main">
        <section className="et-card et-card-pad et-cp-sec">
          <h2>Code</h2>
          <div className="et-field">
            <label htmlFor="cp-code">Coupon code</label>
            <div className="et-cp-code">
              <input id="cp-code" name="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} maxLength={32} placeholder="e.g. WELCOME20" required />
              <button type="button" className="et-btn et-btn-ghost" onClick={() => setCode(randomCode())}>
                <Shuffle size={14} /> Generate
              </button>
            </div>
            <small>Letters, numbers, dashes and underscores. People type it at checkout.</small>
          </div>
          <div className="et-field">
            <label htmlFor="cp-desc">Note for your team</label>
            <input id="cp-desc" name="description" defaultValue={coupon?.description ?? ""} maxLength={300} placeholder="e.g. For the Lagos bootcamp cohort" />
          </div>
        </section>

        <section className="et-card et-card-pad et-cp-sec">
          <h2>Discount</h2>
          <div className="et-seg" role="radiogroup" aria-label="Discount type">
            <button type="button" className={kind === "percent" ? "is-on" : ""} onClick={() => setKind("percent")}>
              Percent off
            </button>
            <button type="button" className={kind === "fixed" ? "is-on" : ""} onClick={() => setKind("fixed")}>
              Fixed amount off
            </button>
          </div>
          <div className="et-field">
            <label htmlFor="cp-value">{kind === "percent" ? "Percent" : "Amount (₦)"}</label>
            <div className="et-cp-affix">
              {kind === "fixed" && <span>₦</span>}
              <input id="cp-value" name="value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))} placeholder={kind === "percent" ? "20" : "5000"} required />
              {kind === "percent" && <span>%</span>}
            </div>
            <small>{kind === "fixed" ? "Shared across the items it covers, and never more than they cost." : "100% makes the items free."}</small>
          </div>
        </section>

        <section className="et-card et-card-pad et-cp-sec">
          <h2>Applies to</h2>
          <div className="et-seg" role="radiogroup" aria-label="Applies to">
            {APPLIES.map((a) => (
              <button key={a.v} type="button" className={applies === a.v ? "is-on" : ""} onClick={() => setApplies(a.v)}>
                {a.label}
              </button>
            ))}
          </div>
          {applies === "selected" && (
            <div className="et-cp-picker">
              <div className="et-cp-find">
                <Search size={14} />
                <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search courses and products" aria-label="Search items" />
                <span>{picked.size} chosen</span>
              </div>
              <ul>
                {shown.map((i) => (
                  <li key={i.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={picked.has(i.id)}
                        onChange={(e) =>
                          setPicked((cur) => {
                            const next = new Set(cur);
                            if (e.target.checked) next.add(i.id);
                            else next.delete(i.id);
                            return next;
                          })
                        }
                      />
                      <span className="et-cp-kind">{i.type === "course" ? <BookOpen size={13} /> : <Package size={13} />}</span>
                      <span className="et-cp-title">
                        {i.title}
                        <small>{i.meta}</small>
                      </span>
                    </label>
                  </li>
                ))}
                {!shown.length && <li className="et-cp-none">Nothing matches.</li>}
              </ul>
            </div>
          )}
        </section>

        <section className="et-card et-card-pad et-cp-sec">
          <h2>Who can use it</h2>
          <div className="et-seg" role="radiogroup" aria-label="Who can use it">
            <button type="button" className={audience === "anyone" ? "is-on" : ""} onClick={() => setAudience("anyone")}>
              Anyone with the code
            </button>
            <button type="button" className={audience === "people" ? "is-on" : ""} onClick={() => setAudience("people")}>
              <Users size={13} /> Specific people
            </button>
          </div>
          {audience === "people" && (
            <div className="et-field">
              <label htmlFor="cp-emails">Their emails</label>
              <textarea id="cp-emails" name="emails" rows={5} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={"ada@example.com\ntunde@example.com"} />
              <small>One per line, or separated by commas. Only these people can use the code, even if it&apos;s shared. {people ? `${people} ${people === 1 ? "person" : "people"}.` : ""}</small>
            </div>
          )}
        </section>

        <section className="et-card et-card-pad et-cp-sec">
          <h2>Limits</h2>
          <div className="et-form-grid">
            <div className="et-field">
              <label htmlFor="cp-max">Total uses</label>
              <input id="cp-max" name="max_uses" inputMode="numeric" defaultValue={coupon?.max_uses ?? ""} placeholder="No limit" />
            </div>
            <div className="et-field">
              <label htmlFor="cp-per">Uses per person</label>
              <input id="cp-per" name="per_person" inputMode="numeric" defaultValue={coupon ? (coupon.per_person ?? "") : 1} placeholder="No limit" />
            </div>
            <div className="et-field">
              <label htmlFor="cp-min">Minimum order (₦)</label>
              <input id="cp-min" name="min_order" inputMode="decimal" defaultValue={naira(coupon?.min_order_minor ?? 0)} placeholder="None" />
            </div>
            <div className="et-field" />
            <div className="et-field">
              <label htmlFor="cp-start">Starts</label>
              <input id="cp-start" name="starts_at" type="datetime-local" defaultValue={local(coupon?.starts_at ?? null)} />
              <small>Empty means right away.</small>
            </div>
            <div className="et-field">
              <label htmlFor="cp-end">Ends</label>
              <input id="cp-end" name="ends_at" type="datetime-local" defaultValue={local(coupon?.ends_at ?? null)} />
              <small>Empty means it never expires. Lagos time.</small>
            </div>
          </div>
        </section>
      </div>

      <aside className="et-cp-side">
        <div className="et-cp-ticket">
          <span className="et-cp-ticket-icon">
            <Tag size={16} />
          </span>
          <b>{code || "YOUR-CODE"}</b>
          <strong>{offLabel}</strong>
          <small>
            On {scopeLabel}, for {audience === "people" ? `${people || "no"} ${people === 1 ? "person" : "people"}` : "anyone with the code"}.
          </small>
        </div>
        <section className="et-card et-card-pad et-cp-publish">
          <label className="et-cp-switch">
            <input type="checkbox" className="et-toggle" name="active" defaultChecked={coupon?.active ?? true} />
            <span>
              <b>Active</b>
              <small>Switch off to stop new uses straight away.</small>
            </span>
          </label>
          {state?.error && <p className="et-flash et-flash-err">{state.error}</p>}
          {state?.ok && <p className="et-flash et-flash-ok">{state.ok}</p>}
          <Save isNew={!coupon} />
        </section>
      </aside>
    </form>
  );
}

function Save({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="et-btn et-btn-primary" disabled={pending}>
      {pending ? "Saving…" : isNew ? "Create coupon" : "Save changes"}
    </button>
  );
}
