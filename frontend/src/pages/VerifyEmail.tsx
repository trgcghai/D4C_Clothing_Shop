import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { REGEXP_ONLY_DIGITS } from "input-otp";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useVerifyEmail } from "../hooks/useAuth";
import { getUserIdByEmail } from "../services/authApi";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlUserId = searchParams.get("userId");
  const email = searchParams.get("email");

  const [otpValue, setOtpValue] = useState("");

  const { mutate, isPending, error } = useVerifyEmail();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(
    urlUserId,
  );
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
          setUserIdError(
            "Could not find account with this email. Please sign up first.",
          );
          setUserIdLoading(false);
        });
    } else {
      navigate("/signup", { replace: true });
    }
  }, [urlUserId, email, navigate]);

  const effectiveUserId = resolvedUserId ?? urlUserId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);
    setResendMessage(null);

    if (otpValue.length !== 6 || !effectiveUserId) return;

    mutate(
      { userId: Number(effectiveUserId), verificationCode: otpValue },
      {
        onSuccess: () => {
          setSuccessMessage(
            "Email verified successfully! Redirecting to sign in...",
          );
          setOtpValue("");
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
              ? `Enter the 6-digit code sent to ${email}. The code is valid for 5 minutes.`
              : "Enter the 6-digit code sent to your email address. The code is valid for 5 minutes."}
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
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                value={otpValue}
                onChange={setOtpValue}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
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
