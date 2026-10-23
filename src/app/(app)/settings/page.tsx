import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { AvatarEditor } from "@/components/dash/AvatarEditor";
import { getCurrentUser } from "@/lib/auth";
import { getProfileDetails } from "@/lib/data/profile";
import { updateProfile } from "./actions";
import { SetRow } from "./SetRow";
import { UsernamePicker } from "./UsernamePicker";

export const metadata = { title: "Settings" };

export default async function ProfileSettings() {
  const user = await getCurrentUser();
  const p = await getProfileDetails(user.id);
  if (!p) notFound();

  return (
    // The id is targeted by the Cancel / Save buttons in the settings banner.
    <ActionForm action={updateProfile} id="settings-details" className="et-set-form" toast>
      <SetRow title="Public profile" sub="Your name and headline, shown on your profile and courses.">
        <div className="et-field">
          <label htmlFor="full_name">Full name</label>
          <input id="full_name" name="full_name" defaultValue={user.name} autoComplete="name" maxLength={80} />
        </div>
        <div className="et-field">
          <label htmlFor="headline">Headline</label>
          <input id="headline" name="headline" defaultValue={p.headline ?? ""} placeholder="Product designer learning data analysis" maxLength={120} />
        </div>
        <div className="et-field">
          <label htmlFor="location">Location</label>
          <input id="location" name="location" defaultValue={p.location ?? ""} placeholder="Lagos, Nigeria" maxLength={80} />
        </div>
      </SetRow>

      <SetRow title="Username" sub="Your public profile link. Share it anywhere.">
        <UsernamePicker current={p.username} />
        <label className="et-set-box et-set-box-row" style={{ cursor: "pointer" }}>
          <span>
            <b>Public profile</b>
            <small>Anyone with your link can see your name, bio, links, and completed courses. Never your email.</small>
          </span>
          <input type="checkbox" role="switch" className="et-toggle" name="profile_public" defaultChecked={p.profilePublic} />
        </label>
        <label className="et-set-box et-set-box-row" style={{ cursor: "pointer" }}>
          <span>
            <b>Show what I&apos;m currently learning</b>
            <small>Lists your in-progress courses on your public profile.</small>
          </span>
          <input type="checkbox" role="switch" className="et-toggle" name="show_current_learning" defaultChecked={p.showCurrentLearning} />
        </label>
      </SetRow>

      <SetRow title="Profile picture" sub="Shown on your profile, in chats, and next to your courses.">
        <AvatarEditor variant="row" url={user.avatarUrl} initial={(user.name || user.email).charAt(0).toUpperCase()} seed={user.name || user.email} />
      </SetRow>

      <SetRow title="About you" sub="What you're learning or teaching. Interests help us suggest courses.">
        <div className="et-field">
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" name="bio" rows={4} defaultValue={p.bio ?? ""} maxLength={2000} />
        </div>
        <div className="et-field">
          <label htmlFor="interests">Interests</label>
          <input id="interests" name="interests" defaultValue={p.interests.join(", ")} placeholder="Design, Data, Marketing" />
          <small>Separate with commas, up to 12.</small>
        </div>
      </SetRow>

      <SetRow title="Links" sub="Where people can find you elsewhere.">
        <div className="et-field">
          <label htmlFor="website_url">Website</label>
          <input id="website_url" name="website_url" defaultValue={p.websiteUrl ?? ""} placeholder="yoursite.com" inputMode="url" />
        </div>
        <div className="et-field">
          <label htmlFor="linkedin_url">LinkedIn</label>
          <input id="linkedin_url" name="linkedin_url" defaultValue={p.linkedinUrl ?? ""} placeholder="linkedin.com/in/you" inputMode="url" />
        </div>
        <div className="et-field">
          <label htmlFor="x_url">X</label>
          <input id="x_url" name="x_url" defaultValue={p.xUrl ?? ""} placeholder="x.com/you" inputMode="url" />
        </div>
      </SetRow>

      <div className="et-set-foot">
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </ActionForm>
  );
}
