import { prisma } from "@/lib/prisma";
import { claude } from "@/lib/claude";
import { NextRequest } from "next/server";
import { QuestionType } from "@/app/generated/prisma/enums";
const VALID_TYPES = ["technical", "behavioural", "domain", "situational"];

export async function POST(
  req: NextRequest,
  { params }: { params:Promise<{ candidateId: string }> }
) {
  const { candidateId } = await params;
  const candidate = await prisma.candidate.findUnique({
    where:{id:candidateId},
    include: { job: true },
  });

  if (!candidate) {
    return Response.json({ error: "Candidate not found" }, { status: 404 });
  }
  const systemPrompt = `You are a technical interviewer generating screening questions.
You will be given a job description analysis and a specific candidate's profile.
Generate 5 questions that are SPECIFIC to this candidate's stated skills and experience —
not generic questions for the role. Each question must reference something concrete from
the candidate's profile (a named skill, a claimed experience type, their title/seniority).

Mix question types based on role level:
- technical: probe depth on specific skills the candidate listed
- behavioural: calibrated to seniority (junior = teamwork/learning, senior+ = ownership/conflict/mentoring)
- domain: test domain-specific claims against JD's domain requirements
- situational: scenario tied to an implicit requirement from the JD (e.g. "fast-paced environment")

Return ONLY valid JSON, no markdown fences, no preamble. Schema:
[{ "questionText": string, "questionType": "technical"|"behavioural"|"domain"|"situational", "orderIndex": number }]`;

  const userPrompt = JSON.stringify({
    jdAnalysis: candidate.job.analysis,
    candidateProfile: {
      title: candidate.currentTitle,
      skills: candidate.skills,
      experienceYears: candidate.experienceYears,
      experienceSummary: candidate.experienceSummary,
    },
  });

  const response = await claude.chat.completions.create({
    model: "claude-haiku-4-5",
    max_tokens: 1000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices[0].message.content ?? "";
  const cleaned = raw.replace(/```json|```/g, "").trim();

  let parsed: { questionText: string; questionType: string; orderIndex: number }[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return Response.json({ error: "Model returned invalid JSON", raw }, { status: 502 });
  }

  const questions = parsed.filter(q => VALID_TYPES.includes(q.questionType));
  if (questions.length === 0) {
    return Response.json({ error: "No valid questions generated" }, { status: 502 });
  }

  await prisma.$transaction([
    prisma.interviewQuestion.deleteMany({ where: { candidateId } }),
    prisma.interviewQuestion.createMany({
      data: questions.map(q => ({
        candidateId,
        questionText: q.questionText,
        questionType: q.questionType as QuestionType,
        orderIndex: q.orderIndex,
      })),
    }),
  ]);

  return Response.json({ count: questions.length });
}