// scripts/create-test-answer.ts
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const question = await prisma.interviewQuestion.findFirst();
  if (!question) {
    console.log("No questions found — generate some first.");
    return;
  }

  const answer = await prisma.interviewAnswer.create({
    data: { questionId: question.id },
  });

  console.log("Created test answer:", answer.id);
}

main().catch(console.error);