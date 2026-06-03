// frontend/src/services/clockSync.ts

/**
 * Tracks the offset between server time and client time.
 * Updated by axios response interceptor when Date header is present.
 * Defaults to 0 (client clock) if header is missing/stripped by proxy/CDN.
 * Capped at ±30 seconds for safety.
 */

let clockOffset = 0; // milliseconds: serverTime - clientTime

const MAX_OFFSET_MS = 30_000; // ±30 seconds cap

/**
 * Update clock offset from a response Date header.
 * Safe: never throws, silently ignores invalid headers.
 */
export function updateClockOffset(dateHeader: string | undefined | null): void {
  if (!dateHeader) return;

  try {
    const serverTime = new Date(dateHeader).getTime();
    if (Number.isNaN(serverTime)) return;

    const clientTime = Date.now();
    let offset = serverTime - clientTime;

    // Clamp to ±30s to prevent extreme values from bad headers
    offset = Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, offset));

    clockOffset = offset;
  } catch {
    // Silently ignore — fallback to client clock
  }
}

/**
 * Get current adjusted time: Date.now() + clockOffset.
 * When clockOffset is 0 (no server time received), returns raw Date.now().
 */
export function getAdjustedNow(): number {
  return Date.now() + clockOffset;
}

/**
 * Reset offset to 0. Useful for testing or cleanup.
 */
export function resetClockOffset(): void {
  clockOffset = 0;
}
