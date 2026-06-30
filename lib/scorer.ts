import { pipeline, cos_sim } from "@xenova/transformers";
import type {PrismaClient} from '@/app/generated/prisma/client';
import { Prisma } from "@/app/generated/prisma/client";// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

// ─── Updated Types ───────────────────────────────────────────

interface SkillWithSeniority {
  skill: string;
  seniority?: string;
}

interface PreferredSkill {
  skill: string;
}

interface ImplicitRequirement {
  signal: string;
  inference: string;
}

interface ExperienceRange {
  min_years: number;
  max_years: number;
}

interface JDAnalysis {
  role_title: string;
  role_level: string;
  experience_range: ExperienceRange;         
  required_skills: SkillWithSeniority[];       
  preferred_skills: PreferredSkill[];          
  domain_experience: string[];                 
  implicit_requirements: ImplicitRequirement[];
  responsibilities: string[];                   
}
interface ScoreBreakdown {
  technicalSkills: number;
  seniority: number;
  domainExperience: number;
  implicitRequirements: number;
  overall: number;
}

interface RedFlag {
  detected: boolean;
  details?: string;
}

interface RedFlags {
  jobHopping: RedFlag;
  titleInflation: RedFlag;
  skillMismatch: RedFlag;
}

interface RawPosition {
  title?: string;
  companyName?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

interface CandidateRow {
  id: string;
  name: string;
  currentTitle: string | null;
  currentCompany: string | null;
  skills: string[];
  experienceYears: number | null;
  experienceSummary: string | null;
  confidenceLevel: number;
  rawData: unknown;
}
// ─── Helper: flatten JDAnalysis arrays to plain strings ──────

function flattenRequiredSkills(skills: SkillWithSeniority[]): string[] {
  return skills.map((s) => s.skill);
}

function flattenPreferredSkills(skills: PreferredSkill[]): string[] {
  return skills.map((s) => s.skill);
}

function flattenImplicitRequirements(reqs: ImplicitRequirement[]): string[] {
  // Combine signal + inference — gives the embedder richer context
  return reqs.map((r) => `${r.signal}: ${r.inference}`);
}

function flattenExperienceRange(range: ExperienceRange): string {
  return `${range.min_years} to ${range.max_years} years`;
}
// ─────────────────────────────────────────────
// Singleton embedder — loads once, reused across candidates
// ─────────────────────────────────────────────

let embedder: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return embedder;
}

// ─────────────────────────────────────────────
// Embedding helpers
// ─────────────────────────────────────────────

async function embed(text: string): Promise<number[]> {
  const model = await getEmbedder();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output = await (model as any)(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

async function similarity(a: string, b: string): Promise<number> {
  if (!a?.trim() || !b?.trim()) return 0;
  const [va, vb] = await Promise.all([embed(a), embed(b)]);
  return Math.max(0, Math.min(1, cos_sim(va, vb)));
}

// Score a candidate text chunk against multiple JD phrases, return max sim
async function scoreAgainstList(
  candidateText: string,
  jdPhrases: string[]
): Promise<number> {
  if (!jdPhrases?.length || !candidateText?.trim()) return 0;
  const scores = await Promise.all(
    jdPhrases.map((phrase) => similarity(candidateText, phrase))
  );
  return Math.max(...scores);
}

// Score each JD phrase independently, return mean
async function meanScoreAgainstList(
  candidateText: string,
  jdPhrases: string[]
): Promise<number> {
  if (!jdPhrases?.length || !candidateText?.trim()) return 0;
  const scores = await Promise.all(
    jdPhrases.map((phrase) => similarity(candidateText, phrase))
  );
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ─────────────────────────────────────────────
// Red flag detection (deterministic, no LLM)
// ─────────────────────────────────────────────

const SENIOR_TITLES = ["director", "vp", "vice president", "head of", "chief", "cto", "ceo", "coo"];
const SENIORITY_MAP: Record<string, number> = {
  intern: 0, junior: 1, associate: 2, mid: 3, senior: 4,
  lead: 5, staff: 5, principal: 6, manager: 5,
  director: 7, vp: 8, "vice president": 8, head: 7,
  chief: 9, cto: 9, ceo: 9,
};

function parseDateToMs(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function detectJobHopping(positions: RawPosition[]): RedFlag {
  if (!positions?.length) return { detected: false };

  const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Sort by startDate descending
  const sorted = [...positions]
    .map((p) => ({
      start: parseDateToMs(p.startDate),
      end: parseDateToMs(p.endDate) ?? now,
    }))
    .filter((p) => p.start !== null)
    .sort((a, b) => b.start! - a.start!);

  // Count how many roles started within the last 2 years
  const recentRoles = sorted.filter(
    (p) => p.start !== null && now - p.start! <= TWO_YEARS_MS
  );

  if (recentRoles.length >= 3) {
    return {
      detected: true,
      details: `${recentRoles.length} roles in the last 2 years`,
    };
  }
  return { detected: false };
}

function detectTitleInflation(
  currentTitle: string | null,
  positions: RawPosition[]
): RedFlag {
  if (!currentTitle) return { detected: false };

  const titleLower = currentTitle.toLowerCase();
  const isSeniorClaim = SENIOR_TITLES.some((t) => titleLower.includes(t));
  if (!isSeniorClaim) return { detected: false };

  // Check if prior positions show a career path consistent with the claimed title
  if (!positions?.length) {
    return {
      detected: true,
      details: `Claims "${currentTitle}" but no verifiable career history`,
    };
  }

  // Count how many prior roles carry junior/mid signals
  const juniorCount = positions.filter((p) => {
    const t = (p.title ?? "").toLowerCase();
    return (
      t.includes("junior") ||
      t.includes("intern") ||
      t.includes("associate") ||
      t.includes("trainee")
    );
  }).length;

  const totalRoles = positions.length;

  // If more than 60% of career is junior-level and they claim a senior title, flag it
  if (totalRoles >= 2 && juniorCount / totalRoles > 0.6) {
    return {
      detected: true,
      details: `Claims "${currentTitle}" but ${juniorCount}/${totalRoles} prior roles are junior-level`,
    };
  }

  return { detected: false };
}

function detectSkillMismatch(
  skills: string[],
  experienceYears: number | null,
  currentTitle: string | null
): RedFlag {
  if (!skills?.length) return { detected: false };

  const titleLower = (currentTitle ?? "").toLowerCase();

  // Infer expected seniority from title
  let titleSeniorityScore = 3; // default: mid
  for (const [keyword, score] of Object.entries(SENIORITY_MAP)) {
    if (titleLower.includes(keyword)) {
      titleSeniorityScore = score;
      break;
    }
  }

  // Infer seniority from years of experience
  let yearsSeniorityScore = 3;
  if (experienceYears !== null) {
    if (experienceYears <= 1) yearsSeniorityScore = 1;
    else if (experienceYears <= 3) yearsSeniorityScore = 2;
    else if (experienceYears <= 5) yearsSeniorityScore = 3;
    else if (experienceYears <= 8) yearsSeniorityScore = 5;
    else yearsSeniorityScore = 7;
  }

  // Flag if claimed title seniority is 3+ levels above what years suggest
  const gap = titleSeniorityScore - yearsSeniorityScore;
  if (gap >= 3) {
    return {
      detected: true,
      details: `Title "${currentTitle}" implies seniority level ${titleSeniorityScore} but ${experienceYears} years of experience suggests level ${yearsSeniorityScore}`,
    };
  }

  return { detected: false };
}

function extractRedFlags(candidate: CandidateRow): RedFlags {
  const raw = candidate.rawData as Record<string, unknown> | null;
  const positions: RawPosition[] = (raw?.positions as RawPosition[]) ?? [];

  return {
    jobHopping: detectJobHopping(positions),
    titleInflation: detectTitleInflation(candidate.currentTitle, positions),
    skillMismatch: detectSkillMismatch(
      candidate.skills,
      candidate.experienceYears,
      candidate.currentTitle
    ),
  };
}

// ─────────────────────────────────────────────
// Semantic scoring
// ─────────────────────────────────────────────

async function scoreTechnicalSkills(
  candidate: CandidateRow,
  jd: JDAnalysis
): Promise<number> {
  const candidateText = [
    candidate.skills.join(", "),
    candidate.experienceSummary ?? "",
  ].filter(Boolean).join(". ");

  const requiredScore = await meanScoreAgainstList(
    candidateText,
    flattenRequiredSkills(jd.required_skills)   // ← was: jd.required_skills
  );

  const preferredScore =
    jd.preferred_skills?.length > 0
      ? await meanScoreAgainstList(
          candidateText,
          flattenPreferredSkills(jd.preferred_skills) // ← was: jd.preferred_skills
        )
      : 0;

  return requiredScore * 0.7 + preferredScore * 0.3;
}

async function scoreSeniority(
  candidate: CandidateRow,
  jd: JDAnalysis
): Promise<number> {
  const candidateText = [
    candidate.currentTitle ?? "",
    candidate.experienceSummary ?? "",
    `${candidate.experienceYears ?? 0} years experience`,
  ].filter(Boolean).join(". ");

  const jdSeniorityText = [
    jd.role_level,
    flattenExperienceRange(jd.experience_range), // ← was: jd.experience_range (was a string)
    jd.role_title,
  ].filter(Boolean).join(", ");

  return similarity(candidateText, jdSeniorityText);
}

async function scoreImplicitRequirements(
  candidate: CandidateRow,
  jd: JDAnalysis
): Promise<number> {
  if (!jd.implicit_requirements?.length) return 0.5;

  const candidateText = [
    candidate.experienceSummary ?? "",
    candidate.currentTitle ?? "",
    candidate.skills.join(", "),
  ].filter(Boolean).join(". ");

  return meanScoreAgainstList(
    candidateText,
    flattenImplicitRequirements(jd.implicit_requirements) // ← was: jd.implicit_requirements
  );
}


async function scoreDomainExperience(
  candidate: CandidateRow,
  jd: JDAnalysis
): Promise<number> {
  const candidateText = [
    candidate.experienceSummary ?? "",
    candidate.currentTitle ?? "",
    candidate.currentCompany ?? "",
  ]
    .filter(Boolean)
    .join(". ");

  if (!jd.domain_experience?.length) return 0.5;
  return meanScoreAgainstList(candidateText, jd.domain_experience);
}


async function scoreCandidate(
  candidate: CandidateRow,
  jd: JDAnalysis
): Promise<{ breakdown: ScoreBreakdown; redFlags: RedFlags }> {
  const [technicalSkills, seniority, domainExperience, implicitRequirements] =
    await Promise.all([
      scoreTechnicalSkills(candidate, jd),
      scoreSeniority(candidate, jd),
      scoreDomainExperience(candidate, jd),
      scoreImplicitRequirements(candidate, jd),
    ]);

  // Weights: technical 40%, seniority 25%, domain 20%, implicit 15%
  const overall =
    technicalSkills * 0.4 +
    seniority * 0.25 +
    domainExperience * 0.2 +
    implicitRequirements * 0.15;

  const breakdown: ScoreBreakdown = {
    technicalSkills: Math.round(technicalSkills * 100) / 100,
    seniority: Math.round(seniority * 100) / 100,
    domainExperience: Math.round(domainExperience * 100) / 100,
    implicitRequirements: Math.round(implicitRequirements * 100) / 100,
    overall: Math.round(overall * 100) / 100,
  };

  const redFlags = extractRedFlags(candidate);

  return { breakdown, redFlags };
}

// ─────────────────────────────────────────────
// Main scorer — runs on all candidates for a job
// ─────────────────────────────────────────────

export async function scoreAllCandidates(
  jobId: string,
  prisma: PrismaClient
): Promise<{ scored: number; shortlisted: number }> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { candidates: true },
  });

  const jd = job.analysis as unknown as JDAnalysis;
  const threshold = job.shortlistThreshold;

  let scored = 0;
  let shortlisted = 0;

  for (const candidate of job.candidates) {
    const { breakdown, redFlags } = await scoreCandidate(candidate, jd);

    // Candidates with shortlistOverride set keep their manual decision
    const hasManualOverride = candidate.shortlistOverride !== null;
    const autoShortlist = breakdown.overall >= threshold;
    const isShortlisted = hasManualOverride
      ? (candidate.shortlistOverride as boolean)
      : autoShortlist;

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
         semanticScore: breakdown.overall,
          scoreBreakdown: breakdown as unknown as Prisma.InputJsonValue,
          redFlags: redFlags as unknown as Prisma.InputJsonValue,
          isShortlisted,
      },
    });

    scored++;
    if (isShortlisted) shortlisted++;
  }

  return { scored, shortlisted };
}