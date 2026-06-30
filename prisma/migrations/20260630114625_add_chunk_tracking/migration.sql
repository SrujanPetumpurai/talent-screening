-- AlterTable
ALTER TABLE "InterviewAnswer" ADD COLUMN     "receivedChunks" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "totalChunks" INTEGER;
