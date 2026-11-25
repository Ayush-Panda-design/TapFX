# TapFX: dynamic QR code platform

A full-stack QR code SaaS (brand name and tagline live in `src/lib/brand.ts`).

**What it does**

- **Free public generator** with live preview: Website, Text, WiFi, Contact (vCard), Email, SMS, Phone, Location.
- **Custom designs**: dot patterns (square, rounded, circle, **heart**, diamond), corner styles, colours, logo, export as SVG or PNG (up to 4096px).
- **Scan check**: every design is decoded with ZXing in the browser as you edit; unreliable designs are flagged before you print.
- **Dynamic QR codes**: the code encodes a short link (`/r/AbC1234`) that redirects, so the destination can be edited after printing, paused or deleted.
- **Scan analytics**: scans per day, unique scanners, countries, devices, OS, browsers, referrers. Bots and link-preview crawlers are filtered out.
- **Accounts**: sign up / sign in, **email verification**, **password reset**, private per-user library, abuse reporting. Dynamic codes require a confirmed email.
- **Email**: in development, emails are printed to the server console (no provider needed). In production set `RESEND_API_KEY` and `EMAIL_FROM` (Resend free tier; verify a sending domain first).
- No payments yet. Limits live in `src/lib/limits.ts`.

## Run it locally

Requires Node 20+ (tested on Node 24).

```powershell
npm install
copy .env.example .env.local      # then edit IP_HASH_SALT to a long random string
npm run db:migrate                # creates data/app.db
npm run dev                       # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve the build |
| `npm test` | Unit and round-trip tests (renders every design and decodes it with ZXing) |
| `npm run typecheck`, `npm run lint` | Static checks |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (uses `DATABASE_URL`) |

## Architecture

```
src/
  app/
    page.tsx              public generator + marketing
    (auth)/               login, signup, server actions
    dashboard/            list, create, edit + analytics, pause/delete (all owner-scoped)
    r/[code]/route.ts     THE HOT PATH: lookup -> 302 redirect -> log scan after response
    report/               public abuse reporting
    proxy.ts              optimistic auth redirect (real checks are in requireUser)
  components/qr/          designer UI (live preview, scan check, export)
  lib/qr/                 pure QR engine: content payloads, renderer, styles (shared client + server)
  lib/                    session, password (scrypt), rate limiter, analytics, UA parser, safe-url
  db/                     Drizzle schema + client (SQLite/libSQL)
```

Design decisions worth knowing:

- **The QR renderer is one pure function** (`renderSvg`), so the preview, the download and the dashboard thumbnails are always identical.
- **Redirects are 302 + `no-store`** so edits apply instantly and browsers never cache a stale destination. Scan logging runs in `after()` and can never delay or break a redirect.
- **Cache Components is enabled** (Next 16). Anything reading cookies or the database sits under `<Suspense>`; session checks call `connection()`.
- **SQLite via libSQL**: a local file in development; the same code runs on Turso with only env changes.

## Security (implemented)

- Passwords: scrypt (N=2^15) with per-user salt; login does a dummy hash for unknown emails (no timing leak).
- Sessions: 256-bit random token in an `httpOnly`, `SameSite=Lax` (`Secure` in production) cookie; only its SHA-256 is stored.
- Every query for user data is scoped by `user_id` (verified: another account gets "not found").
- All input validated with Zod on the server; SVG output only ever contains validated hex colours and `data:` image logos.
- Rate limits (DB-backed, atomic): sign-up, login (per IP and per email), QR creation, abuse reports.
- Destinations: only `http(s)`, no embedded credentials, no loops to our own `/r/` links, and no private/internal addresses in production.
- Analytics privacy: raw IPs are never stored; a salted, daily-rotating hash gives unique counts.
- Email tokens: 256-bit, single use, only the SHA-256 stored; verify links expire in 24h, reset links in 1h. Confirming needs a button press (not page load) so mail scanners can't burn the link. "Forgot password" answers identically whether or not the account exists, and a reset signs out all sessions.
- Headers: CSP, HSTS (prod), `X-Frame-Options`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP.

## Deploying for free

1. **Database (Turso free tier)**: create a database, then set `DATABASE_URL=libsql://...` and `DATABASE_AUTH_TOKEN=...`. Run `npm run db:migrate` once against it.
2. **Hosting**: deploy to Vercel (set `APP_URL` to your real URL and a strong `IP_HASH_SALT`). **Vercel's free Hobby plan is for non-commercial use only**: if this is a commercial product, use a paid plan or another host.
3. Point a short custom domain at it for nicer short links, and set `APP_URL` to it.

Free tiers have quotas. Heavy scan traffic will outgrow them: plan to upgrade the database/hosting when real usage arrives.

## Known gaps (not built yet)

- Payments and plan limits (placeholder single plan in `src/lib/limits.ts`).
- Public REST API, bulk CSV creation, teams, custom domains, hosted landing pages.
- Admin panel for abuse reports (they are stored in the `abuse_reports` table).
- Scan analytics use SQL over raw events (fine to ~millions of rows); add daily rollups beyond that.
- Strict nonce-based CSP (currently `'unsafe-inline'` scripts, required by static prerendering).
- The scan check uses ZXing (Android's decoder family); it has not been verified on real iPhone/Android cameras. **Test-print before mass-printing.**
