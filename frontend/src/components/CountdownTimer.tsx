// frontend/src/components/CountdownTimer.tsx

import { useEffect, useRef } from "react";
import { useCountdownTimer } from "use-countdown-timer";
import { Clock } from "lucide-react";
import { getAdjustedNow } from "@/src/services/clockSync";

interface CountdownTimerProps {
  readonly expiresAt: string;
  readonly onExpire: () => void;
}

export default function CountdownTimer({
  expiresAt,
  onExpire,
}: CountdownTimerProps) {
  const mountedRef = useRef(true);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const expiresMs = new Date(expiresAt).getTime();
  const timerMs = Number.isNaN(expiresMs)
    ? 0
    : Math.max(0, expiresMs - getAdjustedNow());

  const { countdown } = useCountdownTimer({
    timer: timerMs,
    autostart: true,
    onExpire: () => {
      if (mountedRef.current) {
        onExpireRef.current();
      }
    },
  });

  // Unmount guard: prevent onExpire from firing after component unmounts
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (countdown <= 0) return null;

  const minutes = Math.floor(countdown / 60000)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((countdown % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  return (
    <div
      className="flex items-center justify-center gap-2 text-amber-600"
      role="timer"
      aria-live="polite"
      aria-label={`${minutes}:${seconds} còn lại để thanh toán`}
    >
      <Clock className="h-4 w-4" />
      <span className="font-mono font-semibold text-lg">
        {minutes}:{seconds}
      </span>
      <span className="text-sm">còn lại để thanh toán</span>
    </div>
  );
}
