import { AuthForm } from "../AuthForm";

export const metadata = { title: "Set a new password | Etivio" };

export default function ResetPasswordPage() {
  return <AuthForm mode="reset" />;
}
