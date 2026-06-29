import { claude } from './claude'

export async function extractJD(text: string) {
  const response = await claude.chat.completions.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You are a JD analysis expert. Extract structured information from the following job description and return ONLY a valid JSON object with no markdown, no backticks, no preamble.

The JSON must follow this exact structure:
{
  "role_title": "string",
  "role_level": "junior | mid | senior | lead",
  "experience_range": {
    "min_years": number or null,
    "max_years": number or null
  },
  "required_skills": [
    { "skill": "string", "seniority": "string" }
  ],
  "preferred_skills": [
    { "skill": "string" }
  ],
  "domain_experience": ["string"],
  "implicit_requirements": [
    { "signal": "string", "inference": "string" }
  ],
  "responsibilities": ["string"]
}

Job Description:
${text}`,
      },
    ],
  })

  const content = response.choices[0].message.content!
const clean = content.replace(/```json|```/g, '').trim()
return JSON.parse(clean)
}