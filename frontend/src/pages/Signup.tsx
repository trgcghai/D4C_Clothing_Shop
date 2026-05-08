import { useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useNavigate, Link } from "react-router-dom";
import { isAxiosError } from "axios";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSignUp } from "../hooks/useAuth";

const defaultForm = {
  confirmPassword: "",
  email: "",
  fullName: "",
  password: "",
  phoneNumber: "",
  username: "",
};

const SignUp = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<{
    phoneNumber?: string;
    confirmPassword?: string;
  }>({});

  const { mutate, isPending, error } = useSignUp();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function onChange(field: keyof typeof defaultForm) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
      if (field === "phoneNumber" || field === "confirmPassword") {
        setFieldErrors((current) => ({ ...current, [field]: undefined }));
      }
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);
    setFieldErrors({});

    if (form.password !== form.confirmPassword) {
      setFieldErrors((current) => ({
        ...current,
        confirmPassword: "Confirm password must match password.",
      }));
      return;
    }

    if (!/^\+?[0-9]{9,15}$/.test(form.phoneNumber)) {
      setFieldErrors((current) => ({
        ...current,
        phoneNumber: "Phone number must be 9-15 digits and may start with +.",
      }));
      return;
    }

    mutate(
      {
        username: form.username,
        email: form.email,
        fullName: form.fullName,
        phoneNumber: form.phoneNumber,
        password: form.password,
      },
      {
        onSuccess: () => {
          setSuccessMessage(
            "Account created! Please check your email for the verification code.",
          );
          setForm(defaultForm);
          setTimeout(() => navigate(`/verify-email?email=${encodeURIComponent(form.email)}`), 2000);
        },
      },
    );
  }

  const apiFieldErrors =
    isAxiosError(error) && error.response?.data?.errors
      ? (error.response.data.errors as Record<string, string>)
      : undefined;
  const phoneNumberError = fieldErrors.phoneNumber ?? apiFieldErrors?.phoneNumber;
  const confirmPasswordError = fieldErrors.confirmPassword;

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
          {error ? (
            <p
              className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
              aria-live="polite"
            >
              {error.message}
            </p>
          ) : null}
          {successMessage ? (
            <p
              className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              role="status"
              aria-live="polite"
            >
              {successMessage}
            </p>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field id="signup-username" label="Username">
              <Input
                id="signup-username"
                required
                value={form.username}
                onChange={onChange("username")}
              />
            </Field>
            <Field id="signup-email" label="Email">
              <Input
                id="signup-email"
                type="email"
                required
                value={form.email}
                onChange={onChange("email")}
              />
            </Field>
            <Field id="signup-fullName" label="Full name">
              <Input
                id="signup-fullName"
                required
                value={form.fullName}
                onChange={onChange("fullName")}
              />
            </Field>
            <Field id="signup-phoneNumber" label="Phone number">
              <Input
                id="signup-phoneNumber"
                required
                value={form.phoneNumber}
                onChange={onChange("phoneNumber")}
                aria-invalid={Boolean(phoneNumberError)}
                aria-describedby={
                  phoneNumberError ? "signup-phoneNumber-error" : undefined
                }
              />
              {phoneNumberError ? (
                <p
                  id="signup-phoneNumber-error"
                  className="text-xs text-red-600"
                  role="alert"
                >
                  {phoneNumberError}
                </p>
              ) : null}
            </Field>
            <Field id="signup-password" label="Password">
              <Input
                id="signup-password"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={onChange("password")}
              />
            </Field>
            <div className="space-y-1.5">
              <label
                htmlFor="signup-confirmPassword"
                className="text-sm font-medium text-(--sea-ink)"
              >
                Confirm password
              </label>
              <Input
                id="signup-confirmPassword"
                type="password"
                required
                minLength={6}
                value={form.confirmPassword}
                onChange={onChange("confirmPassword")}
                aria-invalid={Boolean(confirmPasswordError)}
                aria-describedby={
                  confirmPasswordError
                    ? "signup-confirmPassword-error"
                    : "signup-confirmPassword-hint"
                }
              />
              {confirmPasswordError ? (
                <p
                  id="signup-confirmPassword-error"
                  className="text-xs text-red-600"
                  role="alert"
                >
                  {confirmPasswordError}
                </p>
              ) : null}
              <p
                id="signup-confirmPassword-hint"
                className="text-xs text-(--sea-ink-soft)"
              >
                Must match password exactly.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-(--sea-ink-soft)">
            Already have account?{" "}
            <Button variant="link" className="p-0" asChild>
              <Link to="/signin" className="font-medium">
                Sign in
              </Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </section>
  );
};

export default SignUp;

function Field({
  children,
  id,
  label,
}: {
  children: ReactNode;
  id: string;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-(--sea-ink)">
        {label}
      </label>
      {children}
    </div>
  );
}
