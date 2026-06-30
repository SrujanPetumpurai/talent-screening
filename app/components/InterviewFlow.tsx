"use client";

import { useState } from "react";
import { QuestionScreen } from "@/app/components/QuestionScreen";
import { ThinkingScreen } from "@/app/components/ThinkingScreen";
import {RecordingScreen} from '@/app/components/RecordingScreen'
interface Question {
  id: string;
  questionText: string;
  orderIndex: number;
  answerId: string | null;
}

interface InterviewFlowProps {
  candidateId: string;
  candidateName: string;
  questions: Question[];
}

type Stage = "intro"|"question" | "thinking" | "recording" | "done";

export function InterviewFlow({ candidateName, questions }: InterviewFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("intro");
  
  const currentQuestion = questions[currentIndex];

  function handleReadyToProceed() {
    setStage("thinking"); // step 6 will build this screen next
  }
  function handleAnswerComplete() {
  if (currentIndex + 1 < questions.length) {
    setCurrentIndex((i) => i + 1);
    setStage("question"); // loop back for the next question
  } else {
    setStage("done");
  }
}

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen text-center px-6">
        <p className="text-lg">Interview complete. Thank you, {candidateName}!</p>
      </div>
    );
  }

if (stage === "intro") {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      <h1 className="text-2xl font-medium mb-4">Hi {candidateName}, ready to begin?</h1>
      <p className="text-gray-500 mb-8 max-w-md">
        You'll be asked {questions.length} questions. Each question will be read aloud,
        then you'll have time to think before recording your answer.
      </p>
      <button
        onClick={() => setStage("question")}
        className="px-6 py-3 rounded-lg bg-black text-white"
      >
        Start Interview
      </button>
    </div>
  );
}
  if (stage === "question") {
    return (
      <QuestionScreen
        questionText={currentQuestion.questionText}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
        onReadyToProceed={handleReadyToProceed}
      />
    );
  }
if (stage === "thinking") {
  return (
    <ThinkingScreen
      onTimeUp={() => setStage("recording")}
      onSkip={() => setStage("recording")}
    />
  );
}


if (stage === "recording") {
  return (
    <RecordingScreen
      questionId={currentQuestion.id}
      onComplete={handleAnswerComplete}
    />
  );
}
if (stage === "done") {
  return (
    <div className="flex items-center justify-center min-h-screen text-center px-6">
      <p className="text-lg">Interview complete. Thank you, {candidateName}!</p>
    </div>
  );
}
  // Placeholder until step 6 (thinking timer) and step 7 (recording) are built
  return (
    <div className="flex items-center justify-center min-h-screen text-center px-6">
      <p>Stage: {stage} — not built yet</p>
    </div>
  );
}