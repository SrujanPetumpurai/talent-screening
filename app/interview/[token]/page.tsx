import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { InterviewFlow } from "@/app/components/InterviewFlow";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { interviewToken: token },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        include: { answer: true },
      },
    },
  });

  if (!candidate) {
    notFound();
  }

  if (candidate.interviewStatus === "completed") {
    return (
      <div className="flex items-center justify-center min-h-screen text-center px-6">
        <p className="text-lg">
          You've already completed this interview. Thank you!
        </p>
      </div>
    );
  }

  return (
    <InterviewFlow
      candidateId={candidate.id}
      candidateName={candidate.name}
      questions={candidate.questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        orderIndex: q.orderIndex,
        answerId: q.answer?.id ?? null,
      }))}
    />
  );
}