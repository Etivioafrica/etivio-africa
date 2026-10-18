import { AuthForm } from "../AuthForm";

export const metadata = { title: "Reset password | Etivio" };

export default function ForgotPasswordPage() {
  return <AuthForm mode="forgot" />;
}
