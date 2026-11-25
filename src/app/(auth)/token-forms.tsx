"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import type { MessageState } from "./actions";

type Action = (prev: MessageState, fd: FormData) => Promise<MessageState>;

export function ForgotForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
      <form action={formAction} className="mt-6 space-y-4">
        {state?.error && <Alert>{state.error}</Alert>}
        {state?.message && <Alert kind="success">{state.message}</Alert>}
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required maxLength={254} />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Please wait…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}

export function ResetForm({ action, token }: { action: Action; token: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">You&apos;ll be signed out on all devices.</p>
      <form action={formAction} className="mt-6 space-y-4">
        {state?.error && <Alert>{state.error}</Alert>}
        <input type="hidden" name="token" value={token} />
        <Field label="New password" hint="At least 10 characters.">
          <Input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Please wait…" : "Update password"}
        </Button>
      </form>
    </Card>
  );
}

export function ConfirmForm({ action, token }: { action: Action; token: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <Card className="w-full max-w-md p-6 text-center sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Confirm your email</h1>
      {state?.message ? (
        <>
          <div className="mt-4">
            <Alert kind="success">{state.message}</Alert>
          </div>
          <Link href="/dashboard" className="mt-6 inline-block font-medium text-primary hover:underline">
            Go to your dashboard
          </Link>
        </>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">Click the button to finish confirming your email address.</p>
          {state?.error && <Alert>{state.error}</Alert>}
          <input type="hidden" name="token" value={token} />
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Please wait…" : "Confirm email"}
          </Button>
        </form>
      )}
    </Card>
  );
}
