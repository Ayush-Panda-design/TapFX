import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Card, LinkButton } from "@/components/ui";
import { scanCountsForUser } from "@/lib/analytics";
import { svgFor } from "@/lib/qr/resolve";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your QR codes" };

const fmt = new Intl.NumberFormat("en");
const dataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export default async function DashboardPage() {
  const user = await requireUser();
  const [rows, counts] = await Promise.all([
    db.select().from(schema.qrCodes).where(eq(schema.qrCodes.userId, user.id)).orderBy(desc(schema.qrCodes.createdAt)),
    scanCountsForUser(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your QR codes</h1>
          <p className="mt-1 text-muted-foreground">Hi {user.name.split(" ")[0]}, here&apos;s everything you&apos;ve created.</p>
        </div>
        <LinkButton href="/dashboard/new">+ New QR code</LinkButton>
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center">
          <h2 className="text-lg font-semibold">No QR codes yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-muted-foreground">Create your first one in under a minute. Dynamic codes let you change the link later and track scans.</p>
          <div className="mt-5">
            <LinkButton href="/dashboard/new">Create your first QR code</LinkButton>
          </div>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((q) => {
            const svg = svgFor(q);
            return (
              <li key={q.id}>
                <Link href={`/dashboard/${q.id}`} className="group block h-full">
                  <Card className="flex h-full gap-4 p-4 transition-colors group-hover:border-primary/50">
                    <div className="size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                      {svg && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={dataUri(svg)} alt="" width={96} height={96} className="size-full" loading="lazy" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-medium group-hover:text-primary">{q.name}</h2>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 capitalize">{q.contentType}</span>
                        <span className={`rounded-md px-1.5 py-0.5 ${q.kind === "dynamic" ? "bg-primary-soft text-primary" : "bg-muted"}`}>{q.kind}</span>
                        {q.status === "paused" && <span className="rounded-md bg-danger-soft px-1.5 py-0.5 text-danger">paused</span>}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {q.kind === "dynamic" ? (
                          <>
                            <span className="font-semibold text-foreground tabular-nums">{fmt.format(counts.get(q.id) ?? 0)}</span> scans
                          </>
                        ) : (
                          "Not tracked"
                        )}
                      </p>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
