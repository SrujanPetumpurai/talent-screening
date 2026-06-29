import { NextRequest, NextResponse } from 'next/server'
import { extractText } from '@/lib/extract'
import { extractJD } from '@/lib/extract-JD'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    
    const text = await extractText(buffer, file.type)
    
    const analysis = await extractJD(text)
    
    const job = await prisma.job.create({
      data: {
        title: analysis.role_title,
        rawText: text,
        analysis,
      },
    })

    return NextResponse.json({ job }, { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}