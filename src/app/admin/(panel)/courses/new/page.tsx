import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { Uploader } from "@/components/dash/Uploader";
import { requireAdmin } from "@/lib/admin";
import { adminCreateCourse } from "../actions";
import { getInstructorOptions } from "../instructors";

export const metadata = { title: "New course" };

export default async function NewCourse() {
  const { admin, db } = await requireAdmin();
  const instructors = await getInstructorOptions(db);

  return (
    <div className="et-page" style={{ maxWidth: 820 }}>
      <Link href="/admin/courses" className="et-back">
        <ArrowLeft size={14} />
        Courses
      </Link>
      <PageHead title="New course" sub="Create a course for any instructor. You can add modules and lessons next." />
      <section className="et-card et-card-pad">
        <ActionForm action={adminCreateCourse}>
          <div className="et-form-grid">
            <div className="et-field et-field-wide">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" required minLength={3} placeholder="e.g. Product design fundamentals" />
            </div>
            <div className="et-field">
              <label htmlFor="instructor_id">Instructor</label>
              <select id="instructor_id" name="instructor_id" defaultValue={admin.id} required>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="et-field">
              <label htmlFor="level">Level</label>
              <select id="level" name="level" defaultValue="beginner">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="et-field">
              <label htmlFor="price">Price (₦)</label>
              <input id="price" name="price" inputMode="decimal" placeholder="0 for free" />
            </div>
            <div className="et-field et-field-wide">
              <label htmlFor="summary">Summary</label>
              <textarea id="summary" name="summary" rows={2} placeholder="One or two lines shown on the course card" />
            </div>
            <div className="et-field et-field-wide">
              <label>Cover image</label>
              <Uploader name="cover_url" kind="cover" label="Upload a cover image (16:9 works best)" />
            </div>
          </div>
          <div className="et-form-foot">
            <SubmitButton pendingLabel="Creating…">Create course</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
