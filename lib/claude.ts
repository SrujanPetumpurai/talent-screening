import OpenAI from 'openai'

export const claude = new OpenAI({
  apiKey: process.env.AICREDITS_API_KEY!,
  baseURL: process.env.BASE_URL,
})