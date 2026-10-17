import Link from "next/link";
import { PageHead, Status } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { requireSuperAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { addAdmin, removeAdmin } from "./actions";

export const metadata = { title: "Team" };

export default async function Team() {
  const { admin, db } = await requireSuperAdmin();
  const [{ data: supers }, { data: admins }] = await Promise.all([
    db.rpc("admin_list_users", { p_role: "super_admin", p_limit: 100 }),
    db.rpc("admin_list_users", { p_role: "admin", p_limit: 100 }),
  ]);
  const team = [...(supers ?? []), ...(admins ?? [])];

  return (
    <div className="et-page">
      <PageHead title="Team" sub="People who can sign in to the admin dashboard." />
      <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 360px" }}>
        <section className="et-card">
          <table className="et-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th />
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
                    <Status value={m.role} />
                  </td>
                  <td>
                    <Status value={m.status} />
                  </td>
                  <td>{m.last_sign_in_at ? formatDate(m.last_sign_in_at) : "Never"}</td>
                  <td className="et-td-right">
                    {m.id !== admin.id && (
                      <form action={removeAdmin}>
                        <input type="hidden" name="id" value={m.id} />
                        <button type="submit" className="et-btn et-btn-sm et-btn-danger-text">
                          Remove access
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="et-card">
          <div className="et-card-head">
            <h2>Add a team member</h2>
          </div>
          <div className="et-card-pad">
            <ActionForm action={addAdmin}>
              <p className="et-muted" style={{ fontSize: 12.5 }}>
                They need an Etivio account first. They then sign in at /admin/login.
              </p>
              <div className="et-field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div className="et-field">
                <label htmlFor="role">Role</label>
                <select id="role" name="role" defaultValue="admin">
                  <option value="admin">Admin: users, courses, content, chats</option>
                  <option value="super_admin">Super admin: everything, incl. team + money</option>
                </select>
              </div>
              <div className="et-form-foot">
                <SubmitButton pendingLabel="Adding…">Add to team</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </section>
      </div>
    </div>
  );
}
