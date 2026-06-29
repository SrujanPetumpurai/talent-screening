import { prisma } from "@/lib/prisma";
import { scrapeLinkedInCandidates } from "./linkedin";

export async function runCandidatePipeline(jobId: string) {
  // 1. Load job from DB
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  const analysis = job.analysis as Record<string, any>;
  const roleTitle: string = analysis.role_title ?? job.title;

  console.log(`[pipeline] Starting for "${roleTitle}" (${jobId})`);

  // 2. Scrape LinkedIn via Apify
  const { candidates, errors } = await scrapeLinkedInCandidates(
    roleTitle,
    "India",
    25
  );

  console.log(`[pipeline] Got ${candidates.length} candidates, ${errors.length} errors`);

  // 3. Skip if already scraped
  const existing = await prisma.candidate.count({ where: { jobId } });
  if (existing > 0) {
    console.log(`[pipeline] Candidates already exist, skipping insert`);
    return { jobId, candidatesCreated: 0, errors };
  }

  // 4. Save to DB 
  const CHUNK = 10;
  let created = 0;
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const chunk = candidates.slice(i, i + CHUNK);
    await prisma.candidate.createMany({
      data: chunk.map((c) => ({
        jobId,
        name: c.name,
        currentTitle: c.currentTitle,
        currentCompany: c.currentCompany,
        location: c.location,
        skills: c.skills,
        experienceYears: c.experienceYears,
        experienceSummary: c.experienceSummary,
        source: c.source,
        sourceUrl: c.sourceUrl,
        confidenceLevel: c.confidenceLevel,
        rawData: c.rawData as object,
      })),
    });
    created += chunk.length;
  }

  console.log(`[pipeline] Created ${created} candidates`);
  return { jobId, candidatesCreated: created, errors };
}