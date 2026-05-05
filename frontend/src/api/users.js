import http from "../lib/http";

export async function getMe({ signal } = {}) {
  const { data } = await http.get("/users/me", { signal });
  return data;
}

export async function updateMe(payload) {
  const { data } = await http.put("/users/me", payload);
  return data;
}

export async function changePassword(payload) {
  const { data } = await http.put("/users/me/password", payload);
  return data;
}
