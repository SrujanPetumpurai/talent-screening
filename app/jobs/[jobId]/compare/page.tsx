"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";

// ─────────────────────────────────────────────
// Types (mirrors lib/scorer.ts + prisma schema)
// ─────────────────────────────────────────────

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

interface Candidate {
  id: string;
  name: string;
  currentTitle: string | null;
  currentCompany: string | null;
  location: string | null;
  skills: string[];
  experienceYears: number | null;
  experienceSummary: string | null;
  source: string;
  sourceUrl: string | null;
  confidenceLevel: number;
  semanticScore: number | null;
  scoreBreakdown: ScoreBreakdown | null;
  redFlags: RedFlags | null;
  isShortlisted: boolean;
  shortlistOverride: boolean | null;
}

interface Job {
  id: string;
  title: string;
  shortlistThreshold: number;
  candidates: Candidate[];
}

type SortKey =
  | "overall"
  | "technicalSkills"
  | "seniority"
  | "domainExperience"
  | "implicitRequirements"
  | "name"
  | "experienceYears";

type FilterMode = "all" | "shortlisted" | "rejected" | "flagged";

// ─────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 0.75) return "bg-emerald-500";
  if (score >= 0.5) return "bg-amber-500";
  return "bg-rose-500";
}

function scoreTextColor(score: number): string {
  if (score >= 0.75) return "text-emerald-400";
  if (score >= 0.5) return "text-amber-400";
  return "text-rose-400";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 shrink-0 text-zinc-400">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-zinc-800">
        <div
          className={`h-1.5 rounded-full ${scoreColor(value)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-9 shrink-0 text-right font-mono ${scoreTextColor(value)}`}>
        {pct}
      </span>
    </div>
  );
}

function RedFlagBadges({ flags }: { flags: RedFlags | null }) {
  if (!flags) return <span className="text-xs text-zinc-600">—</span>;

  const active = (
    [
      ["Job hopping", flags.jobHopping],
      ["Title inflation", flags.titleInflation],
      ["Skill mismatch", flags.skillMismatch],
    ] as [string, RedFlag][]
  ).filter(([, f]) => f.detected);

  if (active.length === 0) {
    return (
      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
        Clean
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {active.map(([label, f]) => (
        <span
          key={label}
          title={f.details ?? label}
          className="cursor-help rounded-full bg-rose-950 px-2 py-0.5 text-xs text-rose-300 ring-1 ring-rose-800"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function CompareCandidatesPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overriding, setOverriding] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Failed to load job");
      return;
    }
    const data = await res.json();
    setJob(data.job);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    fetchJob().finally(() => setLoading(false));
  }, [jobId, fetchJob]);

  async function handleRescore() {
    setScoring(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/score`, { method: "POST" });
      if (!res.ok) throw new Error();
      await fetchJob();
    } catch {
      setError("Scoring failed");
    } finally {
      setScoring(false);
    }
  }

  async function handleOverride(candidateId: string, value: boolean | null) {
    setOverriding(candidateId);
    // optimistic update
    setJob((prev) =>
      prev
        ? {
            ...prev,
            candidates: prev.candidates.map((c) =>
              c.id === candidateId
                ? {
                    ...c,
                    shortlistOverride: value,
                    isShortlisted:
                      value !== null
                        ? value
                        : (c.scoreBreakdown?.overall ?? 0) >= prev.shortlistThreshold,
                  }
                : c
            ),
          }
        : prev
    );

    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortlistOverride: value }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // revert on failure by refetching source of truth
      await fetchJob();
      setError("Could not save override — check /api/candidates/[id] PATCH route");
    } finally {
      setOverriding(null);
    }
  }

  const filtered = useMemo(() => {
    if (!job) return [];
    let list = job.candidates;

    if (filter === "shortlisted") list = list.filter((c) => c.isShortlisted);
    if (filter === "rejected") list = list.filter((c) => !c.isShortlisted);
    if (filter === "flagged")
      list = list.filter(
        (c) =>
          c.redFlags &&
          (c.redFlags.jobHopping.detected ||
            c.redFlags.titleInflation.detected ||
            c.redFlags.skillMismatch.detected)
      );

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.currentTitle?.toLowerCase().includes(q) ||
          c.currentCompany?.toLowerCase().includes(q) ||
          c.skills.some((s) => s.toLowerCase().includes(q))
      );
    }

    const sorted = [...list].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;

      if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (sortKey === "experienceYears") {
        av = a.experienceYears ?? -1;
        bv = b.experienceYears ?? -1;
      } else {
        av = a.scoreBreakdown?.[sortKey] ?? -1;
        bv = b.scoreBreakdown?.[sortKey] ?? -1;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [job, filter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading candidates…
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-rose-400">
        {error}
      </div>
    );
  }

  if (!job) return null;

  const unscored = job.candidates.filter((c) => c.semanticScore === null).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{job.title}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {job.candidates.length} candidates · threshold{" "}
              <span className="font-mono text-zinc-300">
                {Math.round(job.shortlistThreshold * 100)}
              </span>
              {unscored > 0 && (
                <span className="ml-2 text-amber-400">
                  · {unscored} not yet scored
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleRescore}
            disabled={scoring}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scoring ? "Scoring…" : "Rescore all candidates"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-950 px-4 py-2 text-sm text-rose-300 ring-1 ring-rose-800">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, title, company, skill…"
            className="w-64 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm placeholder-zinc-500 outline-none focus:border-indigo-600"
          />
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {(["all", "shortlisted", "rejected", "flagged"] as FilterMode[]).map(
              (mode) => (
                <button
                  key={mode}
                  onClick={() => setFilter(mode)}
                  className={`rounded-md px-3 py-1 text-xs capitalize transition ${
                    filter === mode
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {mode}
                </button>
              )
            )}
          </div>
          <div className="flex gap-1 text-xs text-zinc-500">
            Sort:
            {(
              [
                ["overall", "Overall"],
                ["technicalSkills", "Skills"],
                ["seniority", "Seniority"],
                ["domainExperience", "Domain"],
                ["experienceYears", "Years"],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={`ml-1 rounded px-2 py-1 transition ${
                  sortKey === key
                    ? "bg-zinc-800 text-zinc-100"
                    : "hover:text-zinc-300"
                }`}
              >
                {label} {sortKey === key && (sortDir === "desc" ? "↓" : "↑")}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-zinc-500">
            Showing {filtered.length} of {job.candidates.length}
          </span>
        </div>

        {/* Candidate list */}
        <div className="space-y-2">
          {filtered.map((c) => {
            const isOpen = expanded === c.id;
            const overall = c.scoreBreakdown?.overall ?? c.semanticScore ?? 0;

            return (
              <div
                key={c.id}
                className={`rounded-xl border bg-zinc-900 transition ${
                  c.isShortlisted
                    ? "border-emerald-900/60"
                    : "border-zinc-800"
                }`}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left"
                >
                  {/* Score circle */}
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold ${scoreTextColor(
                      overall
                    )}`}
                  >
                    {c.semanticScore !== null ? Math.round(overall * 100) : "—"}
                  </div>

                  {/* Identity */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      {c.isShortlisted && (
                        <span className="shrink-0 rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-800">
                          Shortlisted
                        </span>
                      )}
                      {c.shortlistOverride !== null && (
                        <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                          Manual override
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-zinc-400">
                      {c.currentTitle ?? "—"}
                      {c.currentCompany ? ` at ${c.currentCompany}` : ""}
                      {c.experienceYears !== null
                        ? ` · ${c.experienceYears} yrs`
                        : ""}
                    </p>
                  </div>

                  {/* Mini breakdown bars (collapsed view) */}
                  <div className="hidden w-64 shrink-0 space-y-1 md:block">
                    {c.scoreBreakdown ? (
                      <>
                        <ScoreBar
                          label="Skills"
                          value={c.scoreBreakdown.technicalSkills}
                        />
                        <ScoreBar
                          label="Seniority"
                          value={c.scoreBreakdown.seniority}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-zinc-600">Not scored</span>
                    )}
                  </div>

                  <div className="hidden w-28 shrink-0 lg:block">
                    <RedFlagBadges flags={c.redFlags} />
                  </div>

                  <span className="shrink-0 text-zinc-500">
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-zinc-800 px-4 py-4">
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Full breakdown */}
                      <div className="space-y-2">
                        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Score breakdown
                        </h3>
                        {c.scoreBreakdown ? (
                          <>
                            <ScoreBar
                              label="Technical skills"
                              value={c.scoreBreakdown.technicalSkills}
                            />
                            <ScoreBar
                              label="Seniority"
                              value={c.scoreBreakdown.seniority}
                            />
                            <ScoreBar
                              label="Domain experience"
                              value={c.scoreBreakdown.domainExperience}
                            />
                            <ScoreBar
                              label="Implicit reqs"
                              value={c.scoreBreakdown.implicitRequirements}
                            />
                            <div className="mt-2 border-t border-zinc-800 pt-2">
                              <ScoreBar
                                label="Overall"
                                value={c.scoreBreakdown.overall}
                              />
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-zinc-500">
                            This candidate hasn&apos;t been scored yet.
                          </p>
                        )}

                        <div className="mt-3">
                          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Red flags
                          </h3>
                          {c.redFlags ? (
                            <ul className="space-y-1.5 text-xs">
                              {(
                                [
                                  ["Job hopping", c.redFlags.jobHopping],
                                  ["Title inflation", c.redFlags.titleInflation],
                                  ["Skill mismatch", c.redFlags.skillMismatch],
                                ] as [string, RedFlag][]
                              ).map(([label, f]) => (
                                <li
                                  key={label}
                                  className="flex items-center gap-2"
                                >
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      f.detected
                                        ? "bg-rose-950 text-rose-300 ring-1 ring-rose-800"
                                        : "bg-emerald-950 text-emerald-300 ring-1 ring-emerald-800"
                                    }`}
                                  >
                                    {f.detected ? "Flagged" : "Pass"}
                                  </span>
                                  <span className="text-zinc-400">{label}</span>
                                  {f.detected && f.details && (
                                    <span className="text-zinc-500">
                                      — {f.details}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-zinc-600">No data</p>
                          )}
                        </div>
                      </div>

                      {/* Profile details */}
                      <div>
                        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Profile
                        </h3>
                        <p className="mb-2 text-sm text-zinc-300">
                          {c.experienceSummary ?? "No summary available."}
                        </p>
                        {c.skills.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1">
                            {c.skills.map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="space-y-1 text-xs text-zinc-500">
                          <p>Location: {c.location ?? "—"}</p>
                          <p>
                            Source: {c.source}
                            {c.sourceUrl && (
                              <a
                                href={c.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1 text-indigo-400 hover:underline"
                              >
                                view profile
                              </a>
                            )}
                          </p>
                          <p>
                            Profile confidence:{" "}
                            {Math.round(c.confidenceLevel * 100)}
                          </p>
                        </div>

                        {/* Manual override controls */}
                        <div className="mt-4 flex gap-2">
                          <button
                            disabled={overriding === c.id}
                            onClick={() => handleOverride(c.id, true)}
                            className="rounded-lg bg-emerald-900/40 px-3 py-1.5 text-xs text-emerald-300 ring-1 ring-emerald-800 transition hover:bg-emerald-900/70 disabled:opacity-50"
                          >
                            Force shortlist
                          </button>
                          <button
                            disabled={overriding === c.id}
                            onClick={() => handleOverride(c.id, false)}
                            className="rounded-lg bg-rose-900/40 px-3 py-1.5 text-xs text-rose-300 ring-1 ring-rose-800 transition hover:bg-rose-900/70 disabled:opacity-50"
                          >
                            Force reject
                          </button>
                          {c.shortlistOverride !== null && (
                            <button
                              disabled={overriding === c.id}
                              onClick={() => handleOverride(c.id, null)}
                              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
                            >
                              Clear override
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center text-sm text-zinc-500">
              No candidates match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}