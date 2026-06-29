import mammoth from 'mammoth'
import { extractText as extractPdfText } from 'unpdf'

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
  const { text } = await extractPdfText(new Uint8Array(buffer), { mergePages: true })
  return text
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const data = await mammoth.extractRawText({ buffer })
    return data.value
  }

  throw new Error('Unsupported file type. Please upload a PDF or Word document.')
}