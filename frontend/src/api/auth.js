import http from "../lib/http";

export async function signIn(payload) {
  const { data } = await http.post("/auth/signin", payload, {
    withCredentials: true,
  });
  return data;
}

export async function signUp(payload) {
  const { data } = await http.post("/auth/signup", payload);
  return data;
}

export async function refreshToken() {
  const { data } = await http.post(
    "/auth/refresh-token",
    {},
    { withCredentials: true },
  );
  return data;
}

export async function signOut() {
  const { data } = await http.post(
    "/auth/signout",
    {},
    { withCredentials: true },
  );
  return data;
}
