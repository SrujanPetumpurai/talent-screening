import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ answerId: string }> }
) {
  const { answerId } = await params;

  // chunkIndex comes in as a query param, e.g. ?chunkIndex=3
  const chunkIndexParam = req.nextUrl.searchParams.get("chunkIndex");
  if (chunkIndexParam === null) {
    return Response.json({ error: "Missing chunkIndex" }, { status: 400 });
  }
  const chunkIndex = parseInt(chunkIndexParam, 10);
  if (Number.isNaN(chunkIndex) || chunkIndex < 0) {
    return Response.json({ error: "Invalid chunkIndex" }, { status: 400 });
  }

  let answer;
  try {
    answer = await prisma.interviewAnswer.findUniqueOrThrow({
      where: { id: answerId },
    });
  } catch {
    return Response.json({ error: "Answer not found" }, { status: 404 });
  }

  // Read the raw chunk bytes from the request body
  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return Response.json({ error: "Empty chunk" }, { status: 400 });
  }
  const buffer = Buffer.from(arrayBuffer);

  const key = `answers/${answerId}/chunk-${chunkIndex}.webm`;

  try {
    await uploadToR2(key, buffer, "video/webm");
  } catch (err) {
    console.error("R2 upload failed for chunk", chunkIndex, err);
    return Response.json({ error: "Upload to storage failed" }, { status: 502 });
  }

  // Idempotent update — only add chunkIndex if not already recorded
  const updated = await prisma.interviewAnswer.update({
    where: { id: answerId },
    data: {
      receivedChunks: answer.receivedChunks.includes(chunkIndex)
        ? answer.receivedChunks
        : [...answer.receivedChunks, chunkIndex].sort((a, b) => a - b),
      uploadStatus: "uploading",
    },
  });

  return Response.json({
    received: chunkIndex,
    totalReceived: updated.receivedChunks.length,
    receivedChunks: updated.receivedChunks,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ answerId: string }> }
) {
  const { answerId } = await params;

  const answer = await prisma.interviewAnswer.findUnique({
    where: { id: answerId },
    select: { receivedChunks: true, totalChunks: true, uploadStatus: true },
  });

  if (!answer) {
    return Response.json({ error: "Answer not found" }, { status: 404 });
  }

  return Response.json(answer);
}