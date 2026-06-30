import { NextRequest, NextResponse } from "next/server";
import {prisma} from '@/lib/prisma'
import { scoreAllCandidates } from "@/lib/scorer";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { scored, shortlisted } = await scoreAllCandidates(jobId, prisma);

  return NextResponse.json({
    success: true,
    jobId,
    scored,
    shortlisted,
    threshold: job.shortlistThreshold,
  });
}