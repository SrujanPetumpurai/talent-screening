import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { InterviewFlow } from "@/app/components/InterviewFlow";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let candidate = await prisma.candidate.findUnique({
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

  // No questions generated yet for this candidate — trigger generation now.
  if (candidate.questions.length === 0) {
    const hdrs = await headers();
    const host = hdrs.get("host");
    const protocol = hdrs.get("x-forwarded-proto") ?? "http";
    const baseUrl = `${protocol}://${host}`;

    const res = await fetch(
      `${baseUrl}/api/candidates/${candidate.id}/generate-questions`,
      { method: "POST", cache: "no-store" }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return (
        <div className="flex items-center justify-center min-h-screen text-center px-6">
          <p className="text-lg text-rose-400">
            Couldn&apos;t prepare your interview questions
            {body?.error ? ` (${body.error})` : ""}. Please refresh, or contact
            the recruiter if this keeps happening.
          </p>
        </div>
      );
    }

    // Re-fetch candidate now that questions exist.
    candidate = await prisma.candidate.findUnique({
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