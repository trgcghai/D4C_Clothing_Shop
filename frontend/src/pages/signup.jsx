import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../api/auth";
import { extractErrorMessage } from "../lib/auth-contract";
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

const defaultForm = {
  username: "",
  email: "",
  fullName: "",
  phoneNumber: "",
  password: "",
  confirmPassword: "",
};

export default function SignUp() {
  const [form, setForm] = useState(defaultForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const onChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (form.password !== form.confirmPassword) {
      setErrorMessage("Password confirmation does not match");
      return;
    }

    setSubmitting(true);
    try {
      await signUp({
        username: form.username.trim(),
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        password: form.password,
      });
      setSuccessMessage(
        "Account created successfully. Redirecting to sign in...",
      );
      setForm(defaultForm);
      setTimeout(() => {
        navigate("/signin", { replace: true });
      }, 800);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, "Sign-up failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-lg px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
          <CardDescription>
            Create account to manage orders and profile.
          </CardDescription>
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
          {successMessage ? (
            <Alert
              variant="success"
              className="mb-4"
              role="status"
              aria-live="polite"
            >
              {successMessage}
            </Alert>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="signup-username">Username</Label>
              <Input
                id="signup-username"
                required
                value={form.username}
                onChange={onChange("username")}
              />
            </div>
            <div>
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                required
                value={form.email}
                onChange={onChange("email")}
              />
            </div>
            <div>
              <Label htmlFor="signup-fullName">Full name</Label>
              <Input
                id="signup-fullName"
                required
                value={form.fullName}
                onChange={onChange("fullName")}
              />
            </div>
            <div>
              <Label htmlFor="signup-phone">Phone number</Label>
              <Input
                id="signup-phone"
                required
                value={form.phoneNumber}
                onChange={onChange("phoneNumber")}
              />
            </div>
            <div>
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={onChange("password")}
              />
            </div>
            <div>
              <Label htmlFor="signup-confirm">Confirm password</Label>
              <Input
                id="signup-confirm"
                type="password"
                required
                minLength={6}
                value={form.confirmPassword}
                onChange={onChange("confirmPassword")}
                aria-describedby="signup-confirm-help"
              />
              <p
                id="signup-confirm-help"
                className="mt-1 text-xs text-gray-500"
              >
                Must match password exactly.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-gray-600 text-center">
            Already have account?{" "}
            <Link
              to="/signin"
              className="font-medium text-purple-600 hover:text-purple-700"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
