export function extractAccessToken(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload.token || payload.accessToken || null;
}

export function extractErrorMessage(error, fallback = "Unexpected error") {
  return error?.response?.data?.message || fallback;
}

