import http from "../lib/http";

export async function getMe() {
  const { data } = await http.get("/api/users/me");
  return data;
}

export async function updateMe(payload) {
  const { data } = await http.put("/api/users/me", payload);
  return data;
}

export async function changePassword(payload) {
  const { data } = await http.put("/api/users/me/password", payload);
  return data;
}

