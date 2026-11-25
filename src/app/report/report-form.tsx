"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { reportAbuse } from "./actions";

export function ReportForm() {
  const [state, action, pending] = useActionState(reportAbuse, undefined);
  if (state?.ok) return <Alert kind="success">Thank you. We&apos;ll review this report and disable the code if it breaks our rules.</Alert>;
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="QR short link or code" hint="Example: https://yoursite.com/r/AbC1234">
        <Input name="link" required maxLength={300} />
      </Field>
      <Field label="What's wrong?">
        <Select name="reason" defaultValue="phishing">
          <option value="phishing">Phishing / fake login page</option>
          <option value="malware">Malware or harmful download</option>
          <option value="scam">Scam or fraud</option>
          <option value="adult">Adult or illegal content</option>
          <option value="other">Something else</option>
        </Select>
      </Field>
      <Field label="Details (optional)">
        <Textarea name="details" maxLength={1000} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Submit report"}
      </Button>
    </form>
  );
}
