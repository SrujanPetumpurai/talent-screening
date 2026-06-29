import { NextRequest, NextResponse } from "next/server";
import { runCandidatePipeline } from "@/lib/scraper/pipeline";

export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{jobId:string}>}
) {
  try {
    const {jobId} = await params;
    const result = await runCandidatePipeline(jobId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[scrape route]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pipeline failed" },
      { status: 500 }
    );
  }
}