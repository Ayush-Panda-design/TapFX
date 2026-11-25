@AGENTS.md

# Project: TapFX (dynamic QR code SaaS)

Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind v4 + Drizzle/libSQL (SQLite). See README.md for architecture.

## Commands
- `npm run dev` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
- After editing `src/db/schema.ts`: `npm run db:generate` then `npm run db:migrate`
- Use **npm** (pnpm cannot create symlinks on this Windows setup).

## Rules
- **Read `node_modules/next/dist/docs/` before using a Next API** (this is Next 16: `params`/`searchParams` are Promises, `middleware` is `proxy`, `cookies()`/`headers()` are async).
- Anything reading cookies, headers or the database must render under `<Suspense>` or a `loading.tsx`; code using `Date.now()` after request data needs `await connection()` first. Do not use `export const dynamic`.
- **Every query touching user data must be scoped by `user_id`.** Never trust client input: re-validate with Zod in Server Actions.
- Colours that reach SVG must pass `hexColor`; logos must be `data:` URIs. Never interpolate raw user strings into SVG.
- QR engine changes (`src/lib/qr/`) must keep `npm test` green: tests render each design and decode it with ZXing. Do not add a design that fails the decode tests (a heart-shaped finder pupil was removed for this reason).
- Branding lives in `src/lib/brand.ts`; colours in `src/app/globals.css` tokens only.
- No payments yet; limits are in `src/lib/limits.ts`.
- Do not commit `.env.local` or `data/`.
