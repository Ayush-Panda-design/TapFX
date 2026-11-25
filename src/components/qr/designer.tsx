"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { buildPayload, CONTENT_TYPES, contentSchema, type QrContentType } from "@/lib/qr/content";
import { renderSvg } from "@/lib/qr/render";
import {
  DEFAULT_STYLE,
  DOT_SHAPES,
  EYE_BALLS,
  EYE_FRAMES,
  MAX_LOGO_BYTES,
  type DotShape,
  type QrStyle,
} from "@/lib/qr/style";
import { DEFAULT_VALUES, FIELDS, toContentInput, toValues, type FieldSpec, type Values } from "./fields";

export type SaveResult = { error?: string; id?: string };
export type SaveInput = { id?: string; name: string; kind: "static" | "dynamic"; content: unknown; style: unknown };

type Props = {
  /** "public": homepage generator (no saving). "create"/"edit": dashboard. */
  mode: "public" | "create" | "edit";
  appUrl: string;
  saveAction?: (input: SaveInput) => Promise<SaveResult>;
  initial?: {
    id: string;
    name: string;
    kind: "static" | "dynamic";
    contentType: QrContentType;
    content: Record<string, unknown>;
    style: QrStyle;
    shortUrl: string | null;
  };
};

const SAMPLE = "https://example.com";
const dataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastIssue(fg: string, bg: string): string | null {
  const lf = luminance(fg);
  const lb = luminance(bg);
  if (lf > lb) return "Light-on-dark (inverted) codes fail on many scanners. Use a darker foreground on a lighter background.";
  const ratio = (lb + 0.05) / (lf + 0.05);
  return ratio < 4 ? "Low contrast: this code may be hard to scan. Pick a darker foreground or a lighter background." : null;
}

async function rasterize(svg: string, px: number): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = dataUri(svg);
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, px, px);
  return canvas;
}

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type Check = { state: "idle" | "checking" | "pass" | "risky" | "fail"; message: string };
type CheckResult = { key: string; state: "pass" | "risky" | "fail" | "unavailable" };

const CHECK_MESSAGES: Record<CheckResult["state"], Check> = {
  pass: { state: "pass", message: "Scan check passed" },
  risky: { state: "risky", message: "Scans, but only at some sizes. Increase contrast or simplify the design." },
  fail: { state: "fail", message: "This design did not scan. Try higher contrast, a simpler shape or a smaller logo." },
  unavailable: { state: "idle", message: "Scan check unavailable in this browser." },
};

export function QrDesigner({ mode, appUrl, saveAction, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState<QrContentType>(initial?.contentType ?? "url");
  const [values, setValues] = useState<Values>(initial ? toValues(initial.contentType, initial.content) : DEFAULT_VALUES.url);
  const [style, setStyle] = useState<QrStyle>(initial?.style ?? DEFAULT_STYLE);
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<"static" | "dynamic">(initial?.kind ?? "dynamic");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pngSize, setPngSize] = useState(1024);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => contentSchema.safeParse(toContentInput(type, values)), [type, values]);
  const dynamic = mode !== "public" && kind === "dynamic" && type === "url";
  const shortUrl = initial?.shortUrl ?? `${appUrl}/r/XXXXXXX`;

  // What the phone actually reads: the short link for dynamic codes, otherwise the data itself.
  const payload = parsed.success ? (dynamic ? shortUrl : buildPayload(parsed.data)) : null;
  const svg = useMemo(() => {
    try {
      return renderSvg(payload ?? SAMPLE, style);
    } catch {
      return renderSvg(SAMPLE, DEFAULT_STYLE);
    }
  }, [payload, style]);

  // Continuous scan check: decode the exact image at a small and a large size (debounced).
  // The result is keyed by the SVG it was computed for, so a stale result is never shown for a new design.
  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { decodePixels } = await import("@/lib/qr/scan");
        let ok = 0;
        for (const px of [300, 800]) {
          const c = await rasterize(svg, px);
          const d = c.getContext("2d")!.getImageData(0, 0, px, px);
          if (decodePixels(d.data, px, px) === payload) ok++;
        }
        if (!cancelled) setResult({ key: svg, state: ok === 2 ? "pass" : ok === 1 ? "risky" : "fail" });
      } catch {
        if (!cancelled) setResult({ key: svg, state: "unavailable" });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [payload, svg]);

  const check: Check = !payload
    ? { state: "idle", message: "Fill in the details to generate your code." }
    : result?.key !== svg
      ? { state: "checking", message: "Checking that it scans…" }
      : CHECK_MESSAGES[result.state];

  const setStyleKey = <K extends keyof QrStyle>(k: K, v: QrStyle[K]) => setStyle((s) => ({ ...s, [k]: v }));
  const contrast = contrastIssue(style.fg, style.bg);
  const downloadsEnabled = payload !== null;

  function switchType(next: QrContentType) {
    setType(next);
    setValues(DEFAULT_VALUES[next]);
    if (next !== "url") setKind("static");
    setError(null);
  }

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("Logo must be a PNG, JPEG or WebP image.");
    if (file.size > MAX_LOGO_BYTES) return setError(`Logo is too large. Keep it under ${Math.round(MAX_LOGO_BYTES / 1000)} KB.`);
    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      setStyle((s) => ({ ...s, logo: { href: String(reader.result), size: s.logo?.size ?? 0.2 }, ecc: "H" }));
    };
    reader.readAsDataURL(file);
  }

  async function downloadPng() {
    const c = await rasterize(svg, pngSize);
    c.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      download(url, `${slug(name || type)}.png`);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  function downloadSvg() {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    download(url, `${slug(name || type)}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function save() {
    setError(null);
    setSaved(false);
    if (!saveAction) return;
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Please complete the details.");
    if (!name.trim()) return setError("Give this QR code a name so you can find it later.");
    startTransition(async () => {
      const res = await saveAction({ id: initial?.id, name, kind: dynamic ? "dynamic" : "static", content: parsed.data, style });
      if (res.error) return setError(res.error);
      if (mode === "create" && res.id) router.push(`/dashboard/${res.id}`);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const issue = !parsed.success && Object.values(values).some((v) => v !== "" && v !== false) ? parsed.error.issues[0]?.message : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        {/* 1. Content */}
        <Card className="p-5 sm:p-6">
          <Step n={1} title="What should it open?" />
          <div role="tablist" aria-label="QR code type" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CONTENT_TYPES.map((t) => (
              <button
                key={t.type}
                role="tab"
                aria-selected={type === t.type}
                disabled={mode === "edit"}
                onClick={() => switchType(t.type)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed ${
                  type === t.type ? "border-primary bg-primary-soft font-medium" : "border-border hover:bg-muted"
                }`}
              >
                <span className="block">{t.label}</span>
                <span className="hidden text-xs font-normal text-muted-foreground sm:block">{t.description}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {FIELDS[type].map((f) => (
              <div key={f.key} className={f.kind === "textarea" || FIELDS[type].length === 1 ? "sm:col-span-2" : undefined}>
                <FieldInput spec={f} value={values[f.key]} disabled={type === "wifi" && f.key === "password" && values.security === "nopass"} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
              </div>
            ))}
          </div>
          {issue && <p className="mt-3 text-sm text-danger">{issue}</p>}

          {mode !== "public" && (
            <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium">QR code behaviour</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <KindOption
                  active={kind === "dynamic" && type === "url"}
                  disabled={type !== "url" || mode === "edit"}
                  onClick={() => setKind("dynamic")}
                  title="Dynamic"
                  text="Edit the destination any time, even after printing. Includes scan analytics."
                />
                <KindOption
                  active={!(kind === "dynamic" && type === "url")}
                  disabled={mode === "edit"}
                  onClick={() => setKind("static")}
                  title="Static"
                  text="Data is baked into the code. Works forever, but can't be changed or tracked."
                />
              </div>
              {type !== "url" && <p className="mt-2 text-xs text-muted-foreground">Dynamic codes are available for website links.</p>}
            </div>
          )}
        </Card>

        {/* 2. Design */}
        <Card className="p-5 sm:p-6">
          <Step n={2} title="Make it yours" />

          <Group label="Pattern">
            {DOT_SHAPES.map((s) => (
              <ShapeChip key={s} label={s} active={style.dotShape === s} onClick={() => setStyleKey("dotShape", s as DotShape)} preview={renderSvg("QR", { dotShape: s, margin: 1 })} />
            ))}
          </Group>
          <Group label="Corner frame">
            {EYE_FRAMES.map((s) => (
              <ShapeChip key={s} label={s} active={style.eyeFrame === s} onClick={() => setStyleKey("eyeFrame", s)} preview={renderSvg("QR", { eyeFrame: s, margin: 1 })} />
            ))}
          </Group>
          <Group label="Corner dot">
            {EYE_BALLS.map((s) => (
              <ShapeChip key={s} label={s} active={style.eyeBall === s} onClick={() => setStyleKey("eyeBall", s)} preview={renderSvg("QR", { eyeBall: s, margin: 1 })} />
            ))}
          </Group>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <ColorField label="Code colour" value={style.fg} onChange={(v) => setStyleKey("fg", v)} />
            <ColorField label="Background" value={style.bg} onChange={(v) => setStyleKey("bg", v)} />
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Corner colour</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Corner colour"
                  value={style.eyeColor ?? style.fg}
                  onChange={(e) => setStyleKey("eyeColor", e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-card p-1"
                />
                {style.eyeColor && (
                  <button className="text-xs text-muted-foreground underline" onClick={() => setStyle((s) => ({ ...s, eyeColor: undefined }))}>
                    Match code
                  </button>
                )}
              </div>
            </div>
          </div>
          {contrast && <div className="mt-3"><Alert>{contrast}</Alert></div>}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Logo (optional)" hint="PNG, JPEG or WebP, up to 150 KB. Keep it simple and centred.">
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
                <Button variant="secondary" type="button" onClick={() => fileRef.current?.click()}>
                  {style.logo ? "Replace logo" : "Upload logo"}
                </Button>
                {style.logo && (
                  <Button variant="ghost" type="button" onClick={() => setStyle((s) => ({ ...s, logo: undefined }))}>
                    Remove
                  </Button>
                )}
              </div>
            </Field>
            <Field label="Quiet zone (white border)">
              <Select value={style.margin} onChange={(e) => setStyleKey("margin", Number(e.target.value))}>
                <option value={2}>Small</option>
                <option value={4}>Standard (recommended)</option>
                <option value={6}>Large</option>
              </Select>
            </Field>
          </div>
          {style.logo && (
            <div className="mt-4">
              <Field label={`Logo size: ${Math.round(style.logo.size * 100)}%`} hint="Larger logos hide more of the code and make it harder to scan.">
                <input
                  type="range"
                  min={10}
                  max={25}
                  value={Math.round(style.logo.size * 100)}
                  onChange={(e) => setStyle((s) => (s.logo ? { ...s, logo: { ...s.logo, size: Number(e.target.value) / 100 } } : s))}
                  className="w-full accent-[var(--primary)]"
                />
              </Field>
            </div>
          )}
        </Card>

        {mode !== "public" && (
          <Card className="p-5 sm:p-6">
            <Step n={3} title="Name & save" />
            <div className="mt-4 max-w-md">
              <Field label="Name" hint="Only you see this. Example: “Table 4 menu”.">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Spring campaign flyer" />
              </Field>
            </div>
          </Card>
        )}
      </div>

      {/* Preview */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-5">
          <div className="qr-frame overflow-hidden rounded-xl border border-border bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUri(svg)} alt="QR code preview" width={340} height={340} className={`h-auto w-full ${payload ? "" : "opacity-40"}`} />
          </div>

          <div
            role="status"
            className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
              check.state === "pass"
                ? "border-success/30 bg-success-soft text-success"
                : check.state === "fail"
                  ? "border-danger/30 bg-danger-soft text-danger"
                  : check.state === "risky"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-border bg-muted text-muted-foreground"
            }`}
          >
            {check.state === "pass" ? "✓ " : check.state === "fail" ? "✕ " : check.state === "risky" ? "! " : ""}
            {check.message}
          </div>

          {dynamic && (
            <p className="mt-3 text-xs text-muted-foreground">
              Encodes a short link{initial?.shortUrl ? <> (<span className="font-mono">{initial.shortUrl}</span>)</> : " created when you save"} that redirects to your website, so you can change the destination later.
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={!downloadsEnabled} onClick={downloadSvg}>
              Download SVG
            </Button>
            <div className="flex gap-1.5">
              <Button disabled={!downloadsEnabled} onClick={downloadPng} className="flex-1">
                PNG
              </Button>
              <Select aria-label="PNG size" value={pngSize} onChange={(e) => setPngSize(Number(e.target.value))} className="w-24">
                <option value={512}>512px</option>
                <option value={1024}>1024px</option>
                <option value={2048}>2048px</option>
                <option value={4096}>4096px</option>
              </Select>
            </div>
          </div>

          {initial?.shortUrl && (
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={async () => {
                await navigator.clipboard.writeText(initial.shortUrl!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied!" : "Copy short link"}
            </Button>
          )}

          {mode === "public" ? (
            <div className="mt-4 rounded-xl bg-primary-soft p-4 text-sm">
              <p className="font-medium">Want to edit it after printing?</p>
              <p className="mt-1 text-muted-foreground">Create a free account to make dynamic codes, change the link any time and see who scans.</p>
              <Link href="/signup" className="mt-3 inline-block font-medium text-primary hover:underline">
                Create free account →
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {error && <Alert>{error}</Alert>}
              {saved && <Alert kind="success">Saved.</Alert>}
              <Button className="w-full" onClick={save} disabled={pending}>
                {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Save QR code"}
              </Button>
            </div>
          )}
          {mode === "public" && error && <div className="mt-3"><Alert>{error}</Alert></div>}
        </Card>
      </aside>
    </div>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "qr-code";

function Step({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">{n}</span>
      {title}
    </h2>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ShapeChip({ label, active, onClick, preview }: { label: string; active: boolean; onClick: () => void; preview: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-[84px] flex-col items-center gap-1 rounded-xl border p-2 text-xs capitalize transition-colors ${
        active ? "border-primary bg-primary-soft font-medium" : "border-border hover:bg-muted"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUri(preview)} alt="" width={56} height={56} className="rounded-md bg-white" />
      {label}
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-card p-1" />
        <span className="font-mono text-sm uppercase text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

function KindOption({ active, disabled, onClick, title, text }: { active: boolean; disabled?: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-muted"}`}
    >
      <span className="block font-medium">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{text}</span>
    </button>
  );
}

function FieldInput({ spec, value, onChange, disabled }: { spec: FieldSpec; value: string | boolean; onChange: (v: string | boolean) => void; disabled?: boolean }) {
  if (spec.kind === "checkbox") {
    return (
      <label className="flex h-10 items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--primary)]" />
        {spec.label}
      </label>
    );
  }
  return (
    <Field label={spec.label} hint={spec.hint}>
      {spec.kind === "textarea" ? (
        <Textarea value={String(value)} placeholder={spec.placeholder} maxLength={spec.maxLength} onChange={(e) => onChange(e.target.value)} />
      ) : spec.kind === "select" ? (
        <Select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {spec.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          type={spec.kind === "number" ? "number" : spec.kind === "text" ? "text" : spec.kind}
          step={spec.kind === "number" ? "any" : undefined}
          inputMode={spec.kind === "number" ? "decimal" : undefined}
          value={String(value)}
          placeholder={spec.placeholder}
          maxLength={spec.maxLength}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
