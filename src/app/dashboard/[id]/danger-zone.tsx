"use client";

import { useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { deleteQr, setQrStatus } from "../actions";

export function DangerZone({ id, status, dynamic }: { id: string; status: "active" | "paused"; dynamic: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold tracking-tight">Manage</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {dynamic && (
          <Button variant="secondary" disabled={pending} onClick={() => start(() => setQrStatus(id, status === "active" ? "paused" : "active"))}>
            {status === "active" ? "Pause code" : "Resume code"}
          </Button>
        )}
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => {
            const msg = dynamic
              ? "Delete this QR code permanently? Anyone scanning a printed copy will see an error page, and its scan history will be lost."
              : "Delete this QR code from your library? Printed copies will keep working (the data is inside the code).";
            if (window.confirm(msg)) start(() => deleteQr(id));
          }}
        >
          Delete
        </Button>
      </div>
      {dynamic && <p className="mt-3 text-xs text-muted-foreground">Pausing shows visitors a friendly “paused” page instead of redirecting. You can resume it any time.</p>}
    </Card>
  );
}
