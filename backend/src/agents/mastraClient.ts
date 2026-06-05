import { createOpenAI } from '@ai-sdk/openai';

export function getDeepInfraModel(modelId: string) {
  const baseURL = process.env.DEEPINFRA_BASE_URL ?? 'https://api.deepinfra.com/v1/openai';
  const apiKey = process.env.DEEPINFRA_API_KEY ?? '';

  const provider = createOpenAI({ baseURL, apiKey });
  return provider(modelId);
}

export const DEFAULT_MODEL = process.env.DEFAULT_MODEL ?? 'deepseek-ai/DeepSeek-V3';
