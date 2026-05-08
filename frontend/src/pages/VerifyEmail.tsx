import { useState, useRef, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useVerifyEmail } from "../hooks/useAuth";
import { getUserIdByEmail } from "../services/authApi";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlUserId = searchParams.get("userId");
  const email = searchParams.get("email");

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  const { mutate, isPending, error } = useVerifyEmail();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(urlUserId);
  const [userIdLoading, setUserIdLoading] = useState(!urlUserId && !!email);
  const [userIdError, setUserIdError] = useState<string | null>(null);

  useEffect(() => {
    if (urlUserId) {
      setResolvedUserId(urlUserId);
      return;
    }
    if (email) {
      setUserIdLoading(true);
      getUserIdByEmail(email)
        .then((data) => {
          setResolvedUserId(String(data.userId));
          setUserIdLoading(false);
        })
        .catch(() => {
          setUserIdError("Could not find account with this email. Please sign up first.");
          setUserIdLoading(false);
        });
    } else {
      navigate("/signup", { replace: true });
    }
  }, [urlUserId, email, navigate]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const effectiveUserId = resolvedUserId ?? urlUserId;

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];

    if (value.length > 1) {
      const pasted = value.replace(/\D/g, "").slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] ?? "";
      }
      setDigits(newDigits);
      const lastFilled = Math.min(pasted.length, 6) - 1;
      inputRefs.current[Math.max(0, lastFilled)]?.focus();
      return;
    }

    newDigits[index] = value;
    setDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);
    setResendMessage(null);

    const code = digits.join("");
    if (code.length !== 6 || !effectiveUserId) return;

    mutate(
      { userId: Number(effectiveUserId), verificationCode: code },
      {
        onSuccess: () => {
          setSuccessMessage("Email verified successfully! Redirecting to sign in...");
          setDigits(Array(6).fill(""));
          setTimeout(() => navigate("/signin"), 1500);
        },
      },
    );
  }

  function handleResend() {
    setResendMessage("Verification code resent");
    setTimeout(() => setResendMessage(null), 3000);
  }

  if (!effectiveUserId && !userIdLoading) return null;

  if (userIdLoading) {
    return (
      <section className="mx-auto flex w-full max-w-md px-4 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Verify your email</CardTitle>
            <CardDescription>Looking up your account...</CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-md px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            {email
              ? `Enter the 6-digit code sent to ${email}.`
              : "Enter the 6-digit code sent to your email address."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userIdError ? (
            <p
              className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
              aria-live="polite"
            >
              {userIdError}
            </p>
          ) : null}

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

          {resendMessage ? (
            <p
              className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              role="status"
              aria-live="polite"
            >
              {resendMessage}
            </p>
          ) : null}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="flex justify-center gap-2">
              {digits.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-12 text-center text-xl"
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Verifying..." : "Verify"}
            </Button>
          </form>

          <div className="mt-4 space-y-2 text-center text-sm text-(--sea-ink-soft)">
            <p>
              Didn't receive a code?{" "}
              <Button variant="link" className="p-0" asChild>
                <button type="button" onClick={handleResend}>
                  Resend code
                </button>
              </Button>
            </p>
            <p>
              <Button variant="link" className="p-0" asChild>
                <Link to="/signin" className="font-medium">
                  Back to Sign in
                </Link>
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default VerifyEmail;
