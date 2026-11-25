/**
 * Per-account limits. There is no billing yet, so everyone gets the same generous plan.
 * When payments are added later, resolve limits from the user's plan here instead.
 */
export const LIMITS = {
  maxQrCodes: 200,
  maxDynamicQrCodes: 50,
  /** Creation attempts per hour (stops scripted abuse of the shortener). */
  createsPerHour: 60,
} as const;
