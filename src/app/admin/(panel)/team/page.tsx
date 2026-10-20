import Link from "next/link";
import { X } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { ROLE_BLURBS, ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";
import { addStaff, removeStaffRole } from "./actions";
import { Select } from "@/components/dash/Select";

export const metadata = { title: "Team" };

export default async function Team() {
  const { admin, db } = await requireAdmin("team");
  const lists = await Promise.all(STAFF_ROLES.map((r) => db.rpc("admin_list_users", { p_role: r, p_limit: 200 })));
  const byId = new Map<string, NonNullable<(typeof lists)[number]["data"]>[number]>();
  for (const { data } of lists) for (const u of data ?? []) byId.set(u.id, u);
  const team = [...byId.values()];

  return (
    <div className="et-page">
      <PageHead title="Team" sub="Staff who can sign in to the admin dashboard, and what each can open." />
      <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 360px" }}>
        <section className="et-card">
          <table className="et-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Staff roles</th>
                <th>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/admin/users/${m.id}`}>
                      <b>
                        {m.full_name || "Unnamed"}
                        {m.id === admin.id && " (you)"}
                      </b>
                    </Link>
                    <small>{m.email}</small>
                  </td>
                  <td>
                    <span className="et-inline" style={{ gap: 6 }}>
                      {m.roles
                        .filter((r) => STAFF_ROLES.includes(r))
                        .map((r) => (
                          <form key={r} action={removeStaffRole} className="et-tag" style={{ gap: 4, paddingRight: 4 }}>
                            {ROLE_LABELS[r]}
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="role" value={r} />
                            {!(r === "super_admin" && m.id === admin.id) && (
                              <button type="submit" aria-label={`Remove ${ROLE_LABELS[r]}`} data-tip="Remove this role" style={{ background: "none", border: 0, display: "grid", placeItems: "center", color: "var(--a-faint)" }}>
                                <X size={12} />
                              </button>
                            )}
                          </form>
                        ))}
                    </span>
                  </td>
                  <td>{m.last_sign_in_at ? formatDate(m.last_sign_in_at) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Add a team member</h2>
            </div>
            <div className="et-card-pad">
              <ActionForm action={addStaff}>
                <p className="et-muted" style={{ fontSize: 12.5 }}>
                  They need an Etivio account first, then sign in at /admin/login.
                </p>
                <div className="et-field">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" required />
                </div>
                <div className="et-field">
                  <label htmlFor="role">Role</label>
                  <Select id="role" name="role" defaultValue="editor">
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="et-form-foot">
                  <SubmitButton pendingLabel="Adding…">Add to team</SubmitButton>
                </div>
              </ActionForm>
            </div>
          </section>
          <section className="et-card">
            <div className="et-card-head">
              <h2>What each role can open</h2>
            </div>
            <dl className="et-kv et-card-pad" style={{ gridTemplateColumns: "100px minmax(0,1fr)" }}>
              <dt>{ROLE_LABELS.super_admin}</dt>
              <dd>{ROLE_BLURBS.super_admin}</dd>
              <dt>{ROLE_LABELS.editor}</dt>
              <dd>Blog, plus dashboard and own settings.</dd>
              <dt>{ROLE_LABELS.accountant}</dt>
              <dd>Financials, payments, and tutor payouts.</dd>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
