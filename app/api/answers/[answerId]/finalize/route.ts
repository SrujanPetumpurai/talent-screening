// app/api/answers/[answerId]/finalize/route.ts
import { prisma } from "@/lib/prisma";
import { r2, uploadToR2 } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ answerId: string }> }
) {
  const { answerId } = await params;
  const { totalChunks } = await req.json();

  const answer = await prisma.interviewAnswer.findUnique({
    where: { id: answerId },
  });
  if (!answer) {
    return Response.json({ error: "Answer not found" }, { status: 404 });
  }
if (answer.uploadStatus === "complete") {
  return Response.json({ videoUrl: answer.videoUrl });
}
  // Confirm every expected chunk actually arrived before stitching
  const expected = Array.from({ length: totalChunks }, (_, i) => i);
const receivedSet = new Set(answer.receivedChunks);
const missing = expected.filter((i) => !receivedSet.has(i));if (missing.length > 0) {
  return Response.json(
    { error: "Missing chunks", missing },
    { status: 409 }
  );
}

  // Download each chunk from R2 and concatenate in order
  const buffers: Buffer[] = [];
  for (const i of expected) {
    const key = `answers/${answerId}/chunk-${i}.webm`;
    const obj = await r2.send(
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key })
    );
    const bytes = await obj.Body!.transformToByteArray();
    buffers.push(Buffer.from(bytes));
  }
  const finalBuffer = Buffer.concat(buffers);

  const finalKey = `answers/${answerId}/final.webm`;
  const videoUrl = await uploadToR2(finalKey, finalBuffer, "video/webm");

  const updated = await prisma.interviewAnswer.update({
    where: { id: answerId },
    data: { videoUrl, uploadStatus: "complete", totalChunks },
  });

  return Response.json({ videoUrl: updated.videoUrl });
}