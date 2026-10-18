import { signOut } from "@/app/(app)/actions";
import { AuthFrame } from "@/app/(auth)/AuthFrame";
import "@/app/(auth)/auth.css";

export const metadata = { title: "Account suspended | Etivio" };

export default function SuspendedPage() {
  return (
    <AuthFrame>
      <div className="et-auth-box">
        <h1>Account suspended</h1>
        <p className="et-auth-sub">Your account has been suspended. If you think this is a mistake, contact Etivio support.</p>
        <form action={signOut}>
          <button type="submit" className="et-auth-submit">Sign out</button>
        </form>
      </div>
    </AuthFrame>
  );
}
