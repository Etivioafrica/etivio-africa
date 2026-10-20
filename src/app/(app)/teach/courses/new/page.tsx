import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { createCourse } from "../../actions";
import { Select } from "@/components/dash/Select";

export const metadata = { title: "New course" };

export default async function NewCourse() {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) redirect("/teach");

  return (
    <div className="et-page">
      <Link href="/teach/courses" className="et-back">
        <ArrowLeft size={14} />
        Courses
      </Link>
      <PageHead title="New course" sub="Start with the basics. You can change everything later." />
      <section className="et-card et-card-pad">
        <ActionForm action={createCourse}>
          <div className="et-field">
            <label htmlFor="title">Course title</label>
            <input id="title" name="title" required minLength={3} placeholder="e.g. Product design fundamentals" />
          </div>
          <div className="et-field">
            <label htmlFor="summary">Short summary</label>
            <textarea id="summary" name="summary" rows={3} placeholder="One or two sentences learners see on the course card." />
          </div>
          <div className="et-form-grid">
            <div className="et-field">
              <label htmlFor="level">Level</label>
              <Select id="level" name="level" defaultValue="beginner">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
            </div>
            <div className="et-field">
              <label htmlFor="price">Price (₦)</label>
              <input id="price" name="price" inputMode="decimal" placeholder="0" />
              <small>Leave empty or 0 for a free course.</small>
            </div>
          </div>
          <div className="et-form-foot">
            <Link href="/teach/courses" className="et-btn et-btn-ghost">
              Cancel
            </Link>
            <SubmitButton pendingLabel="Creating…">Create course</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
