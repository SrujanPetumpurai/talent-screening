import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-6 px-16 py-32 text-center">
        <h1 className="max-w-md text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          AI-Powered Candidate Screening
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Create a job and upload resumes to automatically score and shortlist
          candidates.
        </p>
        <Link
          href="/jobs/new"
          className="flex h-12 items-center justify-center rounded-full bg-blue-600 px-6 text-base font-medium text-white shadow-md transition-all duration-200 hover:scale-105 hover:bg-blue-700 hover:shadow-lg active:scale-95"
        >
          Create a Job & Upload Resumes
        </Link>
      </main>
    </div>
  );
}