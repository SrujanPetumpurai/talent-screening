import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const candidate = await prisma.candidate.findFirst({
    where: { questions: { some: {} } },
  });

  if (!candidate) {
    console.log("No candidate with questions found.");
    return;
  }

  const updated = await prisma.candidate.update({
    where: { id: candidate.id },
    data: { interviewToken: "test-token-123" },
  });

  console.log("Token set. Visit: /interview/test-token-123");
}

main().catch(console.error);