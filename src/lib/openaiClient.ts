import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string;

if (!apiKey) {
  console.error('OpenAI API key is missing');
}

export const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true // Note: In production, this should be handled server-side
});
