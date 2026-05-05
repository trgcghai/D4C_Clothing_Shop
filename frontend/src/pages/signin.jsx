import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { extractAccessToken, extractErrorMessage } from "../lib/auth-contract";
import { isAdminRole } from "../lib/auth-role";
import { setAuthStatus, setToken, setUser } from "../store/authSlice";
import { authQueryKeys, getMeQueryOptions, useSignInMutation } from "../hooks/useAuth";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Label from "../components/ui/Label";
import Alert from "../components/ui/Alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const signInMutation = useSignInMutation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = useMemo(() => location.state?.from, [location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    dispatch(setAuthStatus("loading"));

    try {
      const authPayload = await signInMutation.mutateAsync({
        username: username.trim(),
        password,
      });
      const token = extractAccessToken(authPayload);
      if (!token) {
        throw new Error("Access token is missing in sign-in response");
      }

      dispatch(setToken(token));
      await queryClient.invalidateQueries({ queryKey: authQueryKeys.me() });
      const profile = await queryClient.fetchQuery(getMeQueryOptions());
      dispatch(setUser(profile));

      if (from) {
        navigate(from, { replace: true });
        return;
      }

      navigate(isAdminRole(profile?.role) ? "/admin" : "/", { replace: true });
    } catch (error) {
      dispatch(setAuthStatus("unauthenticated"));
      dispatch(setToken(null));
      dispatch(setUser(null));
      setErrorMessage(extractErrorMessage(error, "Sign-in failed"));
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-md px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <Alert
              variant="error"
              className="mb-4"
              role="alert"
              aria-live="polite"
            >
              {errorMessage}
            </Alert>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="signin-username">Username</Label>
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
                className="mt-1 text-xs text-gray-500"
              >
                Enter account username.
              </p>
            </div>

            <div>
              <Label htmlFor="signin-password">Password</Label>
              <div className="relative">
                <Input
                  id="signin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby="signin-password-hint"
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded p-1 text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p
                id="signin-password-hint"
                className="mt-1 text-xs text-gray-500"
              >
                Password must be at least 6 characters.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={signInMutation.isPending}
            >
              {signInMutation.isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-gray-600 text-center">
            New account?{" "}
            <Link
              className="font-medium text-purple-600 hover:text-purple-700"
              to="/signup"
            >
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
