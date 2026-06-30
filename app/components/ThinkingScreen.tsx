// app/components/ThinkingScreen.tsx
"use client";

import { useEffect, useState } from "react";

interface ThinkingScreenProps {
  seconds?: number; // default 30, configurable per assignment spec
  onTimeUp: () => void;
  onSkip?: () => void; // let candidate start recording early if they're ready sooner
}

export function ThinkingScreen({
  seconds = 30,
  onTimeUp,
  onSkip,
}: ThinkingScreenProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onTimeUp();
      return;
    }

    const interval = setInterval(() => {
      setRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [remaining, onTimeUp]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <p className="text-sm text-gray-500 mb-4">Take a moment to think</p>

      <div className="text-6xl font-semibold mb-8 tabular-nums">
        {remaining}
      </div>

      <p className="text-sm text-gray-500 mb-12">
        Recording will start automatically when the timer ends.
      </p>

      {onSkip && (
        <button
          onClick={onSkip}
          className="text-sm underline text-gray-600"
        >
          I'm ready now, start recording
        </button>
      )}
    </div>
  );
}