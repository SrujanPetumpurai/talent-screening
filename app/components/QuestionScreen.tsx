"use client";

import { useEffect, useRef, useState } from "react";

interface QuestionScreenProps {
  questionText: string;
  questionNumber: number;
  totalQuestions: number;
  onReadyToProceed: () => void; // called once speech finishes, hands off to timer step
}

export function QuestionScreen({
  questionText,
  questionNumber,
  totalQuestions,
  onReadyToProceed,
}: QuestionScreenProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Reset state when question changes
    setHasSpoken(false);
    speakQuestion();

    // Stop speaking if the component unmounts mid-utterance (e.g. candidate navigates away)
    return () => {
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionText]);

  function speakQuestion() {
    if (!("speechSynthesis" in window)) {
      // Browser doesn't support TTS — fail gracefully, candidate just reads the text
      setHasSpoken(true);
      return;
    }

    window.speechSynthesis.cancel(); // stop any previous utterance first

    const utterance = new SpeechSynthesisUtterance(questionText);
    utterance.rate = 0.95; // slightly slower than default, calmer pacing
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setHasSpoken(true);
    };
    utterance.onerror = () => {
      // If TTS fails for any reason, don't block the candidate — let them proceed
      setIsSpeaking(false);
      setHasSpoken(true);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <p className="text-sm text-gray-500 mb-2">
        Question {questionNumber} of {totalQuestions}
      </p>

      <h1 className="text-2xl font-medium max-w-xl mb-8">{questionText}</h1>

      <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        {isSpeaking ? (
          <span>Reading question aloud…</span>
        ) : (
          <span>Question read</span>
        )}
      </div>

      <button
        onClick={speakQuestion}
        className="text-sm underline text-gray-600 mb-12"
      >
        Start Interview
      </button>

      <button
        onClick={onReadyToProceed}
        disabled={!hasSpoken}
        className="px-6 py-3 rounded-lg bg-black text-white disabled:opacity-40"
      >
        I'm ready to think about my answer
      </button>
    </div>
  );
}