import Link from "next/link";
import type { Analytics, Breakdown } from "@/lib/analytics";
import { Card } from "./ui";

const fmt = new Intl.NumberFormat("en");

function countryName(code: string): string {
  if (code === "Unknown") return code;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

/** Accessible SVG bar chart: every bar has a <title> tooltip and the whole chart has a text summary. */
function Bars({ series }: { series: Analytics["series"] }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const W = 600;
  const H = 160;
  const gap = series.length > 40 ? 1 : 3;
  const bw = (W - gap * (series.length - 1)) / series.length;
  const total = series.reduce((a, s) => a + s.count, 0);
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label={`Scans per day: ${total} in total over ${series.length} days`} className="h-auto w-full">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} stroke="var(--border)" strokeWidth={1} />
      ))}
      {series.map((s, i) => {
        const h = Math.max(s.count > 0 ? 3 : 1, (s.count / max) * H);
        return (
          <rect key={s.day} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={Math.min(3, bw / 2)} fill={s.count ? "var(--primary)" : "var(--border)"}>
            <title>{`${s.day}: ${s.count} scan${s.count === 1 ? "" : "s"}`}</title>
          </rect>
        );
      })}
      <text x={0} y={H + 16} fontSize={11} fill="var(--muted-foreground)">{series[0]?.day}</text>
      <text x={W} y={H + 16} fontSize={11} textAnchor="end" fill="var(--muted-foreground)">{series.at(-1)?.day}</text>
    </svg>
  );
}

function List({ title, rows, map }: { title: string; rows: Breakdown; map?: (l: string) => string }) {
  const total = rows.reduce((a, r) => a + r.count, 0) || 1;
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No data yet</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate">{map ? map(r.label) : r.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {fmt.format(r.count)} · {Math.round((r.count / total) * 100)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AnalyticsPanel({ data, basePath }: { data: Analytics; basePath: string }) {
  return (
    <section aria-labelledby="analytics-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="analytics-h" className="text-xl font-semibold tracking-tight">
          Scan analytics
        </h2>
        <nav aria-label="Date range" className="flex rounded-xl border border-border bg-card p-1 text-sm">
          {([7, 30, 90] as const).map((d) => (
            <Link
              key={d}
              href={`${basePath}?range=${d}`}
              scroll={false}
              aria-current={data.days === d ? "page" : undefined}
              className={`rounded-lg px-3 py-1 ${data.days === d ? "bg-primary-soft font-medium text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {d} days
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total scans" value={fmt.format(data.total)} />
        <Stat label="Unique scanners" value={fmt.format(data.unique)} hint="Same device on the same day counts once" />
        <Stat label="Bots filtered" value={fmt.format(data.botsFiltered)} hint="Link previews and crawlers aren't counted" />
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium">Scans per day (UTC)</h3>
        {data.total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No scans yet. Scan your code to see it appear here.</p>
        ) : (
          <Bars series={data.series} />
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <List title="Countries" rows={data.countries} map={countryName} />
        <List title="Devices" rows={data.devices} />
        <List title="Operating systems" rows={data.os} />
        <List title="Browsers" rows={data.browsers} />
        <List title="Referrers" rows={data.referrers} />
      </div>
    </section>
  );
}
