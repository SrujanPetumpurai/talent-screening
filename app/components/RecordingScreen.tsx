// app/components/RecordingScreen.tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface RecordingScreenProps {
  questionId: string;
  maxSeconds?: number; // default 180 = 3 min, per spec
  chunkIntervalMs?: number; // default 5000
  onComplete: () => void;
}

export function RecordingScreen({
  questionId,
  maxSeconds = 180,
  chunkIntervalMs = 5000,
  onComplete,
}: RecordingScreenProps) {
  const [remaining, setRemaining] = useState(maxSeconds);
  const [status, setStatus] = useState<"starting" | "recording" | "finalizing" | "error">("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const answerIdRef = useRef<string | null>(null);
  const chunkIndexRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
const hasStarted = useRef(false);
const pendingUploadsRef = useRef<Promise<void>[]>([]);

 useEffect(() => {
  async function setup() {
    try {
      // 1. Create the InterviewAnswer row
      const startRes = await fetch("/api/answers/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (!startRes.ok) throw new Error("Could not start answer");
      const { answerId } = await startRes.json();
      answerIdRef.current = answerId;

      // 2. Request camera + mic
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 3. Set up MediaRecorder with chunked output
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });
      recorder.ondataavailable = (e) => {
  if (e.data.size === 0 || !answerIdRef.current) return;
  const index = chunkIndexRef.current;
  chunkIndexRef.current += 1;

  const uploadPromise = fetch(
    `/api/answers/${answerIdRef.current}/chunk?chunkIndex=${index}`,
    { method: "POST", body: e.data }
  )
    .then((res) => {
      if (!res.ok) throw new Error(`Chunk ${index} failed (${res.status})`);
    })
    .catch((err) => {
      console.error("Chunk upload failed", index, err);
      throw err;
    });

  pendingUploadsRef.current.push(uploadPromise);
};
      recorderRef.current = recorder;
      recorder.start(chunkIntervalMs);
      setStatus("recording");
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "We couldn't access your camera or microphone. Please check your browser permissions and try again."
      );
      setStatus("error");
    }
  }

  if (hasStarted.current) return;
  hasStarted.current = true;
  setup();

  return () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };
}, [questionId, chunkIntervalMs]);
  // Countdown + auto-stop at max time
  useEffect(() => {
    if (status !== "recording") return;
    if (remaining <= 0) {
      stopAndFinalize();
      return;
    }
    const interval = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(interval);
  }, [status, remaining]);

 async function stopAndFinalize() {
  setStatus("finalizing");

  const recorder = recorderRef.current;
  if (recorder && recorder.state !== "inactive") {
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });
  }
  streamRef.current?.getTracks().forEach((t) => t.stop());

  try {
    await Promise.all(pendingUploadsRef.current);
  } catch (err) {
    console.error("One or more chunk uploads failed", err);
    setErrorMessage(
      "Some parts of your answer failed to upload. Please try again."
    );
    setStatus("error");
    return;
  }

  if (!answerIdRef.current) return;

  try {
    const res = await fetch(
      `/api/answers/${answerIdRef.current}/finalize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalChunks: chunkIndexRef.current }),
      }
    );
    if (!res.ok) throw new Error("Finalize failed");
    onComplete();
  } catch (err) {
    console.error(err);
    setErrorMessage(
      "We had trouble saving your answer. Please check your connection."
    );
    setStatus("error");
  }
}

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <p className="text-red-600 mb-6">{errorMessage}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-lg bg-black text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full max-w-md rounded-lg mb-6"
      />
      <p className="text-sm text-gray-500 mb-2">
        {status === "starting" && "Setting up your camera…"}
        {status === "recording" && "Recording…"}
        {status === "finalizing" && "Saving your answer…"}
      </p>
      {status === "recording" && (
        <>
          <div className="text-4xl font-semibold mb-6 tabular-nums">
            {Math.floor(remaining / 60)}:
            {(remaining % 60).toString().padStart(2, "0")}
          </div>
          <button
            onClick={stopAndFinalize}
            className="px-6 py-3 rounded-lg bg-black text-white"
          >
            Submit answer
          </button>
        </>
      )}
    </div>
  );
}