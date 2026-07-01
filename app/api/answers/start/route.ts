import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { questionId } = await req.json();

  if (!questionId) {
    return Response.json({ error: "Missing questionId" }, { status: 400 });
  }
  const answer = await prisma.interviewAnswer.upsert({
  where: { questionId },
  update: {},
  create: { questionId, uploadStatus: "uploading" },
});
  return Response.json({ answerId: answer.id });
}