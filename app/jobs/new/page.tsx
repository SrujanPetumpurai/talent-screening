'use client'

import { useCallback, useRef, useState } from 'react'
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google'

const display = Fraunces({ subsets: ['latin'], weight: ['400', '600'], style: ['italic', 'normal'], variable: '--font-display' })
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })

type Analysis = {
  role_title?: string
  role_level?: string
  experience_range?: string
  required_skills?: { skill: string; seniority?: string }[]
  preferred_skills?: string[]
  implicit_requirements?: { signal: string; meaning: string }[]
  [key: string]: any
}

type JobResult = {
  id: string
  title: string
  analysis: Analysis
}

type Status = 'idle' | 'uploading' | 'analysing' | 'done' | 'error'

export default function NewJobPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [job, setJob] = useState<JobResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const pickFile = useCallback((f: File | undefined | null) => {
    if (!f) return
    const ok = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (!ok.includes(f.type) && !f.name.match(/\.(pdf|docx|txt)$/i)) {
      setErrorMsg('Use a PDF, DOCX, or plain text file.')
      setStatus('error')
      return
    }
    setErrorMsg('')
    setStatus('idle')
    setFile(f)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }, [pickFile])

  const submit = useCallback(async () => {
    if (!file) return
    setStatus('uploading')
    setErrorMsg('')
    try {
      const formData = new FormData()
      formData.append('file', file)

      setTimeout(() => setStatus((s) => (s === 'uploading' ? 'analysing' : s)), 500)

      const res = await fetch('/api/jobs', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Something went wrong reading that file.')
      }

      setJob(data.job)
      setStatus('done')
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not analyse the job description. Try again.')
      setStatus('error')
    }
  }, [file])

  const reset = useCallback(() => {
    setFile(null)
    setJob(null)
    setStatus('idle')
    setErrorMsg('')
  }, [])

  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen`}
      style={{ background: '#FAFAF7', color: '#1C1C1A', fontFamily: 'var(--font-body)' }}
    >
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-24">
        {/* Header */}
        <div className="mb-10">
          <p
            className="text-xs uppercase tracking-[0.18em] mb-3"
            style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}
          >
            New requisition
          </p>
          <h1
            className="text-4xl sm:text-5xl leading-tight"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
          >
            Post a job description
          </h1>
          <p className="mt-3 text-base" style={{ color: '#4B4B47' }}>
            Drop in the JD as a file. We&apos;ll read it, pull out the requirements,
            and start building a candidate pipeline against it.
          </p>
        </div>

        {!job && (
          <>
            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-2xl transition-all duration-150 px-8 py-14 flex flex-col items-center text-center"
              style={{
                border: `1.5px dashed ${dragOver ? '#3730A6' : '#D8D5CC'}`,
                background: dragOver ? '#F1EFFB' : '#FFFFFF',
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />

              {!file ? (
                <>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3730A6" strokeWidth="1.6" className="mb-4">
                    <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm font-medium mb-1">Drag the job description here</p>
                  <p className="text-xs" style={{ color: '#9A968B' }}>
                    or click to browse — PDF, DOCX, or TXT
                  </p>
                </>
              ) : (
                <>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="1.6" className="mb-3">
                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="9" strokeLinecap="round" />
                  </svg>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs mt-1" style={{ color: '#9A968B' }}>
                    {(file.size / 1024).toFixed(0)} KB · click to choose a different file
                  </p>
                </>
              )}
            </div>

            {errorMsg && (
              <p className="mt-3 text-sm" style={{ color: '#B42318' }}>
                {errorMsg}
              </p>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                disabled={!file || status === 'uploading' || status === 'analysing'}
                onClick={submit}
                className="px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
                style={{ background: '#1C1C1A', color: '#FAFAF7' }}
              >
                {status === 'uploading' && 'Reading file…'}
                {status === 'analysing' && 'Extracting requirements…'}
                {(status === 'idle' || status === 'error') && 'Analyse job description'}
              </button>
              {file && status === 'idle' && (
                <button onClick={reset} className="text-sm" style={{ color: '#6B7280' }}>
                  Clear
                </button>
              )}
            </div>

            {(status === 'uploading' || status === 'analysing') && (
              <div
                className="mt-6 text-xs flex items-center gap-2"
                style={{ fontFamily: 'var(--font-mono)', color: '#6B7280' }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                    style={{ background: '#3730A6' }}
                  />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#3730A6' }} />
                </span>
                {status === 'uploading' ? 'uploading document…' : 'parsing skills, seniority, implicit signals…'}
              </div>
            )}
          </>
        )}

        {/* Result */}
        {job && (
          <div>
            <div
              className="rounded-2xl p-7"
              style={{ background: '#FFFFFF', border: '1px solid #E5E3DC' }}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p
                    className="text-xs uppercase tracking-[0.14em] mb-1.5"
                    style={{ color: '#3730A6', fontFamily: 'var(--font-mono)' }}
                  >
                    {job.analysis.role_level || 'Role level pending'}
                  </p>
                  <h2 className="text-2xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                    {job.title}
                  </h2>
                  {job.analysis.experience_range && (
                    <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                      {job.analysis.experience_range} years experience
                    </p>
                  )}
                </div>
                <span
                  className="text-xs px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: '#ECFDF3', color: '#15803D', fontFamily: 'var(--font-mono)' }}
                >
                  analysed
                </span>
              </div>

              <Section label="Required skills">
                <div className="flex flex-wrap gap-2">
                  {(job.analysis.required_skills || []).map((s, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-md"
                      style={{ background: '#F1EFFB', color: '#3730A6', fontFamily: 'var(--font-mono)' }}
                    >
                      {s.skill}
                      {s.seniority ? ` · ${s.seniority}` : ''}
                    </span>
                  ))}
                  {!job.analysis.required_skills?.length && (
                    <Empty>No required skills extracted</Empty>
                  )}
                </div>
              </Section>

              <Section label="Preferred skills">
                <div className="flex flex-wrap gap-2">
                  {(job.analysis.preferred_skills || []).map((s, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-md"
                      style={{ background: '#F6F5F2', color: '#4B4B47', fontFamily: 'var(--font-mono)' }}
                    >
                      {s}
                    </span>
                  ))}
                  {!job.analysis.preferred_skills?.length && <Empty>None listed</Empty>}
                </div>
              </Section>

              <Section label="Implicit requirements" last>
                <div className="space-y-2.5">
                  {(job.analysis.implicit_requirements || []).map((r, i) => (
                    <div key={i} className="text-sm flex gap-3">
                      <span
                        className="shrink-0 text-xs px-2 py-0.5 rounded mt-0.5"
                        style={{ background: '#FFF7ED', color: '#9A3412', fontFamily: 'var(--font-mono)' }}
                      >
                        {r.signal}
                      </span>
                      <span style={{ color: '#4B4B47' }}>{r.meaning}</span>
                    </div>
                  ))}
                  {!job.analysis.implicit_requirements?.length && <Empty>None detected</Empty>}
                </div>
              </Section>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <a
                href={`/jobs/${job.id}`}
                className="px-5 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: '#1C1C1A', color: '#FAFAF7' }}
              >
                Start building the pipeline →
              </a>
              <button onClick={reset} className="text-sm" style={{ color: '#6B7280' }}>
                Post another JD
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={`pb-5 mb-5 ${last ? '' : ''}`}
      style={!last ? { borderBottom: '1px solid #EEEDE8' } : undefined}
    >
      <p
        className="text-xs uppercase tracking-[0.1em] mb-3"
        style={{ color: '#9A968B', fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm" style={{ color: '#9A968B' }}>{children}</p>
}