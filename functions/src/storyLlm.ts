import { defineString } from 'firebase-functions/params';
import type { StoryGenerationInput } from './types';

const llmApiUrl = defineString('LLM_API_URL', {
  default: 'https://api.groq.com/openai/v1/chat/completions',
});
const llmApiKey = defineString('LLM_API_KEY', { default: '' });
const llmModel = defineString('LLM_MODEL', { default: 'llama-3.3-70b-versatile' });

function buildSystemPrompt(input: StoryGenerationInput): string {
  const lang = input.outputLanguage === 'hi' ? 'Hindi (Devanagari script)' : 'English';
  const perspective =
    input.perspective === 'first'
      ? 'first person (I, me, my)'
      : 'third person (he/she/they)';

  return `You are a skilled autobiography writer. Convert the spoken transcript into a polished life story.

Rules:
- Clean grammar while keeping the speaker's personality and voice
- Do NOT invent facts, names, dates, or events not in the transcript
- Preserve the original meaning exactly
- Write in ${lang}
- Use ${perspective} narrative
- Output ONLY the story text, no titles or commentary`;
}

function buildUserPrompt(input: StoryGenerationInput): string {
  let prompt = `Title: ${input.title}\n\nTranscript:\n${input.transcript}`;

  if (input.englishTranslation && input.hindiOutputMode === 'translate_english') {
    prompt += `\n\nEnglish reference:\n${input.englishTranslation}`;
  }

  if (input.languageHint === 'mixed' || input.hindiOutputMode === 'clean_mixed') {
    prompt +=
      '\n\nNote: This is mixed Hindi-English speech. Clean it into readable, flowing text.';
  }

  if (input.stimulusContext) {
    prompt += `\n\nContext about the memory/stimulus:\n${input.stimulusContext}`;
  }

  return prompt;
}

export async function generateStoryDraft(input: StoryGenerationInput): Promise<string> {
  const apiKey = llmApiKey.value();
  if (!apiKey) {
    return fallbackDraft(input);
  }

  const response = await fetch(llmApiUrl.value(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: llmModel.value(),
      messages: [
        { role: 'system', content: buildSystemPrompt(input) },
        { role: 'user', content: buildUserPrompt(input) },
      ],
      temperature: 0.4,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.warn(`LLM API failed (${response.status}): ${body}. Using fallback.`);
    return fallbackDraft(input);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return fallbackDraft(input);
  return content;
}

function fallbackDraft(input: StoryGenerationInput): string {
  const prefix =
    input.perspective === 'first' ? 'I remember' : 'They remember';
  return `${prefix} when ${input.transcript.trim()}`;
}
