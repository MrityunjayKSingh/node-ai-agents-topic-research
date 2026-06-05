import { createTool } from '@mastra/core';
import { z } from 'zod';

async function duckDuckGoSearch(query: string): Promise<string> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }
  const data = await response.json() as {
    AbstractText?: string;
    AbstractURL?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    Results?: Array<{ Text?: string; FirstURL?: string }>;
  };

  const results: string[] = [];

  if (data.AbstractText) {
    results.push(`Summary: ${data.AbstractText}`);
    if (data.AbstractURL) results.push(`Source: ${data.AbstractURL}`);
  }

  const topics = (data.RelatedTopics ?? []).slice(0, 5);
  for (const topic of topics) {
    if (topic.Text) {
      results.push(`- ${topic.Text}${topic.FirstURL ? ` (${topic.FirstURL})` : ''}`);
    }
  }

  const directResults = (data.Results ?? []).slice(0, 3);
  for (const result of directResults) {
    if (result.Text) {
      results.push(`- ${result.Text}${result.FirstURL ? ` (${result.FirstURL})` : ''}`);
    }
  }

  return results.length > 0
    ? results.join('\n')
    : 'No results found for this query.';
}

export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web for information on a given query using DuckDuckGo',
  inputSchema: z.object({
    query: z.string().describe('The search query to look up'),
  }),
  outputSchema: z.object({
    results: z.string().describe('Search results as formatted text'),
  }),
  execute: async ({ context }) => {
    const results = await duckDuckGoSearch(context.query);
    return { results };
  },
});
