import { signOut } from "@/app/(app)/actions";
import { AuthFrame } from "@/app/(auth)/AuthFrame";
import "@/app/(auth)/auth.css";

export const metadata = { title: "Account suspended | Etivio" };

export default function SuspendedPage() {
  return (
    <AuthFrame>
      <div className="et-auth-card">
        <div>
          <h1>Account suspended</h1>
          <p>Your account has been suspended. If you think this is a mistake, contact Etivio support.</p>
        </div>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    </AuthFrame>
  );
}
