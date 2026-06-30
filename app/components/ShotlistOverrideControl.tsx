"use client";

import { useState } from "react";

type Props = {
  candidateId: string;
  currentOverride: boolean | null;
  isShortlisted: boolean;
  onUpdated: (isShortlisted: boolean) => void;
};

export function ShortlistOverrideControl({
  candidateId,
  currentOverride,
  isShortlisted,
  onUpdated,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function setOverride(value: boolean | null) {
    setLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override: value }),
      });
      const data = await res.json();
      onUpdated(data.candidate.isShortlisted);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={
          isShortlisted
            ? "text-green-600 font-medium"
            : "text-gray-500"
        }
      >
        {isShortlisted ? "Shortlisted" : "Not shortlisted"}
      </span>

      {currentOverride !== null && (
        <span className="text-xs text-amber-600">(manual)</span>
      )}

      <button
        disabled={loading}
        onClick={() => setOverride(true)}
        className="px-2 py-1 rounded border hover:bg-green-50"
      >
        Shortlist
      </button>
      <button
        disabled={loading}
        onClick={() => setOverride(false)}
        className="px-2 py-1 rounded border hover:bg-red-50"
      >
        Reject
      </button>
      {currentOverride !== null && (
        <button
          disabled={loading}
          onClick={() => setOverride(null)}
          className="px-2 py-1 rounded border hover:bg-gray-50 text-gray-500"
        >
          Reset to auto
        </button>
      )}
    </div>
  );
}