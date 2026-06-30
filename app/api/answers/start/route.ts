// app/api/answers/start/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { questionId } = await req.json();

  if (!questionId) {
    return Response.json({ error: "Missing questionId" }, { status: 400 });
  }

  // Idempotent: if an answer already exists for this question (e.g. candidate
  // refreshed mid-recording), just return the existing one instead of erroring
  const existing = await prisma.interviewAnswer.findUnique({
    where: { questionId },
  });
  const answer = await prisma.interviewAnswer.upsert({
  where: { questionId },
  update: {},
  create: { questionId, uploadStatus: "uploading" },
});
  return Response.json({ answerId: answer.id });
}