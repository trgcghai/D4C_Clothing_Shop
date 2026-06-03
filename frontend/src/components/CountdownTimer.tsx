// frontend/src/components/CountdownTimer.tsx

import { useEffect } from "react";
import { useCountdownTimer } from "use-countdown-timer";
import { Clock } from "lucide-react";
import { getAdjustedNow } from "@/src/services/clockSync";

interface CountdownTimerProps {
  expiresAt: string;
  onExpire: () => void;
}

export default function CountdownTimer({
  expiresAt,
  onExpire,
}: CountdownTimerProps) {
  const timerMs = Math.max(0, new Date(expiresAt).getTime() - getAdjustedNow());

  const { countdown, start } = useCountdownTimer({
    timer: timerMs,
    autostart: false,
    onExpire,
  });

  // Start timer on mount — expiresAt is guaranteed by parent
  useEffect(() => {
    start();
  }, [start]);

  if (countdown <= 0) return null;

  const minutes = Math.floor(countdown / 60000)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((countdown % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  return (
    <div className="flex items-center justify-center gap-2 text-amber-600">
      <Clock className="h-4 w-4" />
      <span className="font-mono font-semibold text-lg">
        {minutes}:{seconds}
      </span>
      <span className="text-sm">còn lại để thanh toán</span>
    </div>
  );
}
