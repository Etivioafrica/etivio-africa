import Link from "next/link";
import { ArrowRight, CreditCard, Landmark, Plus } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { NG_BANKS } from "@/lib/banks";
import { Status } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canTeach } from "@/lib/roles";
import { formatDate, formatMoney } from "@/lib/format";
import { removeCard, saveBillingDetails, savePayoutAccount, setDefaultCard } from "../actions";
import { SetRow } from "../SetRow";
import { Select } from "@/components/dash/Select";

export const metadata = { title: "Billing" };

export default async function BillingSettings() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const tutor = canTeach(user.roles);
  const [{ data: cards }, { data: payments }, { data: billing }, { data: payout }] = await Promise.all([
    supabase
      .from("payment_methods")
      .select("id, brand, last4, exp_month, exp_year, bank, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, reference, amount_minor, currency, status, paid_at, created_at, course:courses(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("billing_details").select("*").eq("user_id", user.id).maybeSingle(),
    tutor
      ? supabase.from("payout_accounts").select("bank_code, bank_name, account_number, account_name, verified_at").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const paid = (payments ?? []).filter((p) => p.status === "success");
  const spent = paid.reduce((n, p) => n + p.amount_minor, 0);

  return (
    <>
      <SetRow title="Payment methods" sub="Cards saved from Paystack checkout for faster course purchases. We never store full card numbers.">
        <div className="et-set-box">
          {(cards ?? []).map((c) => (
            <div key={c.id} className="et-set-box-row">
              <span className="et-set-item">
                <span className="et-card-brand">{(c.brand ?? "card").toUpperCase()}</span>
                <span>
                  <b>
                    •••• {c.last4}
                    {c.is_default && (
                      <span className="et-tag" style={{ marginLeft: 8 }}>
                        Default
                      </span>
                    )}
                  </b>
                  <small>
                    {c.exp_month && c.exp_year ? `Expires ${String(c.exp_month).padStart(2, "0")}/${String(c.exp_year).slice(-2)}` : "No expiry on file"}
                    {c.bank ? ` · ${c.bank}` : ""}
                  </small>
                </span>
              </span>
              <span className="et-inline">
                {!c.is_default && (
                  <form action={setDefaultCard}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="et-btn et-btn-ghost et-btn-sm">
                      Make default
                    </button>
                  </form>
                )}
                <form action={removeCard}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="et-btn et-btn-danger-text et-btn-sm">
                    Remove
                  </button>
                </form>
              </span>
            </div>
          ))}
          <div className="et-set-box-row">
            <span className="et-set-item">
              <span className="et-set-icon is-dashed">
                <Plus size={17} />
              </span>
              <span>
                <b>Add a payment method</b>
                <small>Cards are saved when you pay for a course. Online checkout is launching soon.</small>
              </span>
            </span>
            <span className="et-tag">Coming soon</span>
          </div>
        </div>
      </SetRow>

      <ActionForm action={saveBillingDetails} toast className="et-set-form">
        <SetRow title="Invoice details" sub="The name printed on your receipts. Turn on company invoice if your employer is paying.">
          <div className="et-form-grid">
            <div className="et-field">
              <label htmlFor="b-name">Name on receipts</label>
              <input id="b-name" name="name" defaultValue={billing?.name ?? user.name} maxLength={120} autoComplete="name" />
            </div>
            <div className="et-field">
              <label htmlFor="b-country">Country</label>
              <input id="b-country" name="country" list="et-countries" defaultValue={billing?.country ?? "Nigeria"} maxLength={80} autoComplete="country-name" />
              <datalist id="et-countries">
                {["Nigeria", "Ghana", "Kenya", "South Africa", "Rwanda", "Uganda", "Tanzania", "Egypt", "Côte d'Ivoire", "Senegal", "Cameroon", "United Kingdom", "United States"].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          {/* The company fields open with CSS (:has) when the switch is on, so no client JS is needed. */}
          <div className="et-invoice">
            <label className="et-set-box et-set-box-row" style={{ cursor: "pointer" }}>
              <span>
                <b>I need a company invoice</b>
                <small>Adds your company, address, and tax ID to receipts.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="et-toggle"
                name="company_invoice"
                defaultChecked={Boolean(billing?.company || billing?.address || billing?.tax_id)}
              />
            </label>
            <div className="et-form-grid et-invoice-extra">
              <div className="et-field">
                <label htmlFor="b-company">Company name</label>
                <input id="b-company" name="company" defaultValue={billing?.company ?? ""} maxLength={120} autoComplete="organization" />
              </div>
              <div className="et-field">
                <label htmlFor="b-tax">
                  Tax ID <span className="et-muted">(optional)</span>
                </label>
                <input id="b-tax" name="tax_id" defaultValue={billing?.tax_id ?? ""} maxLength={40} placeholder="TIN or VAT number" />
              </div>
              <div className="et-field et-field-wide">
                <label htmlFor="b-address">Company address</label>
                <input id="b-address" name="address" defaultValue={billing?.address ?? ""} maxLength={300} autoComplete="street-address" />
              </div>
              <div className="et-field">
                <label htmlFor="b-city">City</label>
                <input id="b-city" name="city" defaultValue={billing?.city ?? ""} maxLength={80} autoComplete="address-level2" />
              </div>
            </div>
          </div>
        </SetRow>
        <SetRow title="Receipt email" sub="Where we send receipts. Use a work or finance address if someone else handles your payments.">
          <div className="et-field">
            <label htmlFor="b-email">Send receipts to</label>
            <input id="b-email" name="receipt_email" type="email" defaultValue={billing?.receipt_email ?? ""} placeholder={user.email} autoComplete="email" />
            <small>Leave empty to use your account email, {user.email}.</small>
          </div>
        </SetRow>
        <div className="et-set-foot">
          <SubmitButton>Save billing details</SubmitButton>
        </div>
      </ActionForm>

      <SetRow title="Purchase history" sub={paid.length ? `${paid.length} paid purchase${paid.length === 1 ? "" : "s"}, ${formatMoney(spent)} in total.` : "Courses you've paid for show up here."}>
        {payments?.length ? (
          <div className="et-set-box">
            <div className="et-table-wrap">
              <table className="et-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th className="et-hide-sm">Date</th>
                    <th className="et-th-right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.course?.title ?? "Removed course"}</b>
                        <br />
                        <small className="et-muted">{p.reference}</small>
                      </td>
                      <td className="et-hide-sm">{formatDate(p.paid_at ?? p.created_at)}</td>
                      <td className="et-td-right">{formatMoney(p.amount_minor, p.currency)}</td>
                      <td>
                        <Status value={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="et-set-box">
            <div className="et-set-box-row">
              <span className="et-set-item">
                <span className="et-set-icon">
                  <CreditCard size={17} />
                </span>
                <span>
                  <b>No purchases yet</b>
                  <small>Free courses don&apos;t appear here.</small>
                </span>
              </span>
              <Link href="/learn/browse" className="et-btn et-btn-ghost et-btn-sm">
                Browse courses
              </Link>
            </div>
          </div>
        )}
      </SetRow>

      {tutor && (
        <SetRow title="Payout account" sub="The Nigerian bank account your course earnings are paid into.">
          {payout && (
            <div className="et-set-box">
              <div className="et-set-box-row">
                <span className="et-set-item">
                  <span className="et-set-icon">
                    <Landmark size={17} />
                  </span>
                  <span>
                    <b>{payout.account_name}</b>
                    <small>
                      {payout.bank_name} · •••• {payout.account_number.slice(-4)}
                    </small>
                  </span>
                </span>
                {payout.verified_at ? <Status value="verified" /> : <span className="et-tag">Not verified yet</span>}
              </div>
            </div>
          )}
          <ActionForm action={savePayoutAccount} toast>
            <div className="et-form-grid">
              <div className="et-field">
                <label htmlFor="p-bank">Bank</label>
                <Select id="p-bank" name="bank_code" defaultValue={payout?.bank_code ?? ""} required>
                  <option value="" disabled>
                    Choose your bank
                  </option>
                  {NG_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="et-field">
                <label htmlFor="p-number">Account number</label>
                <input id="p-number" name="account_number" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} defaultValue={payout?.account_number ?? ""} placeholder="10-digit NUBAN" required />
              </div>
              <div className="et-field et-field-wide">
                <label htmlFor="p-name">Account name</label>
                <input id="p-name" name="account_name" defaultValue={payout?.account_name ?? ""} maxLength={120} placeholder="As it appears on your bank account" />
                <small>We check this matches your bank before paying out.</small>
              </div>
            </div>
            <div className="et-set-inline-foot">
              <SubmitButton className="et-btn et-btn-ghost">{payout ? "Update payout account" : "Save payout account"}</SubmitButton>
            </div>
          </ActionForm>
        </SetRow>
      )}

      {tutor && (
        <SetRow title="Earnings and payouts" sub="Your course sales, Etivio's commission, and payouts to you.">
          <div className="et-set-box">
            <div className="et-set-box-row">
              <span>
                <b>Teaching earnings</b>
                <small>See sales and payout history in your Teach dashboard.</small>
              </span>
              <Link href="/teach/earnings" className="et-btn et-btn-ghost et-btn-sm">
                Open <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </SetRow>
      )}
    </>
  );
}
