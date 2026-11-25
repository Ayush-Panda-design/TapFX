"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { resendVerification, type MessageState } from "../(auth)/actions";

export function VerifyBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState<MessageState, FormData>(() => resendVerification(), undefined);
  return (
    <div className="mb-6">
      <Alert kind={state?.error ? "error" : "success"}>
        <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span>{state?.message ?? state?.error ?? `Confirm your email (${email}) to create dynamic QR codes.`}</span>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Sending…" : "Resend link"}
          </Button>
        </form>
      </Alert>
    </div>
  );
}
