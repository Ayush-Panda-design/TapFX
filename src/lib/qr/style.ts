import { z } from "zod";

export const DOT_SHAPES = ["square", "rounded", "circle", "heart", "diamond"] as const;
export const EYE_FRAMES = ["square", "rounded", "circle"] as const;
// No "heart" pupil: a notched centre breaks the 1:1:3:1:1 finder ratio and fails to scan (verified in tests).
export const EYE_BALLS = ["square", "rounded", "circle"] as const;
export const ECC_LEVELS = ["L", "M", "Q", "H"] as const;

export type DotShape = (typeof DOT_SHAPES)[number];
export type EyeFrame = (typeof EYE_FRAMES)[number];
export type EyeBall = (typeof EYE_BALLS)[number];
export type EccLevel = (typeof ECC_LEVELS)[number];

/** Only strict 6-digit hex colors are ever interpolated into SVG (prevents SVG injection). */
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #111111");

/** Logos are embedded as data URIs only, so rendering never fetches remote URLs. */
export const LOGO_DATA_URI = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
export const MAX_LOGO_BYTES = 150_000;

export const styleSchema = z.object({
  dotShape: z.enum(DOT_SHAPES).default("square"),
  eyeFrame: z.enum(EYE_FRAMES).default("rounded"),
  eyeBall: z.enum(EYE_BALLS).default("square"),
  fg: hexColor.default("#000000"),
  bg: hexColor.default("#ffffff"),
  eyeColor: hexColor.optional(),
  margin: z.number().int().min(0).max(8).default(4),
  ecc: z.enum(ECC_LEVELS).default("H"),
  logo: z
    .object({
      href: z.string().max(MAX_LOGO_BYTES * 1.4).regex(LOGO_DATA_URI, "Logo must be a PNG, JPEG, WebP or SVG data URI"),
      /** Fraction of the QR width the logo occupies (kept small so the code stays scannable). */
      size: z.number().min(0.1).max(0.25).default(0.2),
    })
    .optional(),
});

export type QrStyle = z.infer<typeof styleSchema>;
export const DEFAULT_STYLE: QrStyle = styleSchema.parse({});
