export function isTokenExpiringSoon(token: string, thresholdSeconds: number): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    const expiryTime = payload.exp * 1000;
    return Date.now() + thresholdSeconds * 1000 >= expiryTime;
  } catch {
    return false;
  }
}
