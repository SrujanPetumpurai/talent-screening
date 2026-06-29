-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentTitle" TEXT,
    "currentCompany" TEXT,
    "location" TEXT,
    "skills" TEXT[],
    "experienceYears" INTEGER,
    "experienceSummary" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "confidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "rawData" JSONB,
    "semanticScore" DOUBLE PRECISION,
    "scoreBreakdown" JSONB,
    "redFlags" JSONB,
    "isShortlisted" BOOLEAN NOT NULL DEFAULT false,
    "shortlistOverride" BOOLEAN,
    "interviewToken" TEXT,
    "interviewStatus" TEXT NOT NULL DEFAULT 'not_invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_interviewToken_key" ON "Candidate"("interviewToken");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
