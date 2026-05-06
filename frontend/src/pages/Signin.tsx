import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSignIn } from "../hooks/useAuth";

const SignIn = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { mutate, isPending, error } = useSignIn();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutate(
      { username, password },
      {
        onSuccess: (data) => {
          if (data.role === "ADMIN") {
            navigate("/admin", { replace: true });
            return;
          }
          navigate("/", { replace: true });
        },
      },
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-md px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p
              className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
              aria-live="polite"
            >
              {error.message}
            </p>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label
                htmlFor="signin-username"
                className="text-sm font-medium text-(--sea-ink)"
              >
                Username
              </label>
              <Input
                id="signin-username"
                name="username"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                aria-describedby="signin-username-hint"
              />
              <p
                id="signin-username-hint"
                className="text-xs text-(--sea-ink-soft)"
              >
                Enter your account username.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signin-password"
                className="text-sm font-medium text-(--sea-ink)"
              >
                Password
              </label>
              <Input
                id="signin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="signin-password-hint"
              />
              <p
                id="signin-password-hint"
                className="text-xs text-(--sea-ink-soft)"
              >
                Password must be at least 6 characters.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-(--sea-ink-soft)">
            New account?
            <Button variant="link" className="p-0" asChild>
              <Link to="/signup">Sign up</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </section>
  );
};

export default SignIn;
