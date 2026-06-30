import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { candidateId: string } }
) {
  const { override } = await req.json();

  if (override !== true && override !== false && override !== null) {
    return NextResponse.json(
      { error: "override must be true, false, or null" },
      { status: 400 }
    );
  }

  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: params.candidateId },
    include: { job: true },
  });

  const isShortlisted =
    override !== null
      ? override
      : (candidate.semanticScore ?? 0) >= candidate.job.shortlistThreshold;

  const updated = await prisma.candidate.update({
    where: { id: params.candidateId },
    data: {
      shortlistOverride: override,
      isShortlisted,
    },
  });

  return NextResponse.json({ candidate: updated });
}