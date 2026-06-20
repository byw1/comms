import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from '@comms/core';

let client: Anthropic | undefined;

export function isAiEnabled(): boolean {
  return loadConfig().aiEnabled;
}

/** Model id used for all AI features. Defaults to claude-opus-4-8; operator-overridable. */
export function getModel(): string {
  return loadConfig().AI_MODEL;
}

export function getAnthropic(): Anthropic {
  const cfg = loadConfig();
  if (!cfg.ANTHROPIC_API_KEY) {
    throw new Error('AI is not configured (ANTHROPIC_API_KEY is missing).');
  }
  if (!client) client = new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });
  return client;
}

export { Anthropic };
