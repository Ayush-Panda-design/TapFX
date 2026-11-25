import type { Metadata } from "next";
import { requestPasswordReset } from "../actions";
import { ForgotForm } from "../token-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <ForgotForm action={requestPasswordReset} />;
}
