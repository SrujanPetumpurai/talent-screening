/*
  Warnings:

  - The `interviewStatus` column on the `Candidate` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('not_invited', 'invited', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('pending', 'uploading', 'complete', 'failed');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('technical', 'behavioural', 'domain', 'situational');

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "interviewScore" DOUBLE PRECISION,
ADD COLUMN     "interviewScorecard" JSONB,
DROP COLUMN "interviewStatus",
ADD COLUMN     "interviewStatus" "InterviewStatus" NOT NULL DEFAULT 'not_invited';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "shortlistThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75;

-- CreateTable
CREATE TABLE "InterviewQuestion" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "videoUrl" TEXT,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'pending',
    "transcript" TEXT,
    "relevanceScore" DOUBLE PRECISION,
    "clarityScore" DOUBLE PRECISION,
    "specificityScore" DOUBLE PRECISION,
    "depthScore" DOUBLE PRECISION,
    "answerSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewAnswer_questionId_key" ON "InterviewAnswer"("questionId");

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewAnswer" ADD CONSTRAINT "InterviewAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "InterviewQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
