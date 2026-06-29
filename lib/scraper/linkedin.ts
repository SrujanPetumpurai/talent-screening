const APIFY_URL = process.env.APIFY_API_URL!;


interface ApifyProfile {
  id: string;
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  summary?: string;
  headline?: string;
  location?: { linkedinText?: string };
  currentPositions?: {
    title?: string;
    companyName?: string;
    startedOn?: { month?: number; year?: number };
    tenureAtPosition?: { numYears?: number };
  }[];
  pictureUrl?: string;
}

export interface LinkedInCandidate {
  name: string;
  currentTitle: string | null;
  currentCompany: string | null;
  location: string | null;
  skills: string[];
  experienceYears: number | null;
  experienceSummary: string | null;
  source: "linkedin";
  sourceUrl: string;
  confidenceLevel: number;
  rawData: ApifyProfile;
}


async function extractSkillsFromSummary(summary: string): Promise<string[]> {
  if (!summary) return [];

  try {
    const res = await fetch("https://api.aicredits.in/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AICREDITS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Extract technical skills from this LinkedIn summary. Return ONLY a JSON array of skill name strings, no explanation, no markdown.

Summary: ${summary.slice(0, 1000)}

Example output: ["React.js", "Node.js", "TypeScript", "PostgreSQL"]`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}


async function normalizeProfile(raw: ApifyProfile): Promise<LinkedInCandidate> {
  const currentPosition = raw.currentPositions?.[0];

  const currentTitle = currentPosition?.title ?? raw.headline ?? null;
  const currentCompany = currentPosition?.companyName ?? null;
  const location = raw.location?.linkedinText ?? null;

  let experienceYears: number | null = null;
  if (currentPosition?.tenureAtPosition?.numYears) {
    experienceYears = currentPosition.tenureAtPosition.numYears;
  } else if (currentPosition?.startedOn?.year) {
    experienceYears = new Date().getFullYear() - currentPosition.startedOn.year;
  }

  const experienceSummary = raw.summary ?? null;

  const skills = await extractSkillsFromSummary(raw.summary ?? "");

  return {
    name: `${raw.firstName} ${raw.lastName}`.trim(),
    currentTitle,
    currentCompany,
    location,
    skills,
    experienceYears,
    experienceSummary,
    source: "linkedin",
    sourceUrl: raw.linkedinUrl,
    confidenceLevel: skills.length > 0 ? 1.0 : 0.4,
    rawData: raw,
  };
}


async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseMs = 2000
): Promise<T | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === retries) return null;
      const wait = baseMs * Math.pow(2, i);
      console.warn(`[linkedin] Retry ${i + 1}/${retries} in ${wait}ms — ${err?.message}`);
      await sleep(wait);
    }
  }
  return null;
}


export interface LinkedInScrapeResult {
  candidates: LinkedInCandidate[];
  totalFetched: number;
  errors: string[];
}

export async function scrapeLinkedInCandidates(
  roleTitle: string,
  location = "India",
  maxProfiles = 25
): Promise<LinkedInScrapeResult> {
  const errors: string[] = [];

  console.log(`[linkedin] Scraping "${roleTitle}" in "${location}"`);
  const raw = await withBackoff(async () => {
    const res = await fetch(
          `${APIFY_URL}&format=json`,
        {
          method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(180_000),
        body: JSON.stringify({
        searchQuery: roleTitle,
        locations: [location],
        maxItems: maxProfiles,
        profileScraperMode: "Short",
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Apify ${res.status}: ${text.slice(0, 200)}`);
    }

    return res.json() as Promise<ApifyProfile[]>;
  });

  if (!raw || !Array.isArray(raw)) {
    errors.push("Apify returned no results or failed");
    return { candidates: [], totalFetched: 0, errors };
  }

  console.log(`[linkedin] Got ${raw.length} raw profiles, extracting skills...`);

  const candidates: LinkedInCandidate[] = [];
  for (const profile of raw) {
    await sleep(300); 
    const candidate = await normalizeProfile(profile);
    candidates.push(candidate);
  }

  console.log(`[linkedin] Done. ${candidates.length} candidates ready`);

  return {
    candidates,
    totalFetched: candidates.length,
    errors,
  };
}