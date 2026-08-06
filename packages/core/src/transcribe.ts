import { loadConfig } from './env.js';
import { logger } from './logger.js';

const log = logger.child({ module: 'transcribe' });

/**
 * Speech-to-text for voice memos.
 *
 * The Anthropic API cannot accept audio — there is no audio content block in
 * the Messages API — so transcription needs a second provider. Rather than
 * adopt an SDK, this talks to any OpenAI-compatible
 * `/audio/transcriptions` endpoint with plain fetch: one URL, one model
 * string. An operator already paying OpenAI changes two env vars; the default
 * points at Groq, whose free tier covers most self-hosted installs.
 *
 * Entirely optional. With no key configured, Apple's own on-device transcript
 * (extracted from the message's attributedBody) is still used — that path is
 * free and needs no configuration at all.
 */
export function isTranscriptionEnabled(): boolean {
  return Boolean(loadConfig().TRANSCRIPTION_API_KEY);
}

export interface TranscriptionResult {
  text: string;
  provider: string;
}

export async function transcribeAudio(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}): Promise<TranscriptionResult | null> {
  const cfg = loadConfig();
  if (!cfg.TRANSCRIPTION_API_KEY) return null;

  if (input.bytes.byteLength > cfg.TRANSCRIPTION_MAX_BYTES) {
    log.warn({ bytes: input.bytes.byteLength }, 'audio too large to transcribe; skipping');
    return null;
  }

  const form = new FormData();
  form.set('model', cfg.TRANSCRIPTION_MODEL);
  form.set('response_format', 'json');
  form.set(
    'file',
    new Blob([input.bytes as unknown as BlobPart], { type: input.mimeType }),
    input.fileName,
  );

  const url = `${cfg.TRANSCRIPTION_BASE_URL.replace(/\/+$/, '')}/audio/transcriptions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.TRANSCRIPTION_API_KEY}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      log.warn({ status: res.status }, 'transcription request failed');
      return null;
    }
    const data = (await res.json()) as { text?: string };
    const text = data.text?.trim();
    if (!text) return null;
    return { text, provider: cfg.TRANSCRIPTION_MODEL };
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'transcription error');
    return null;
  } finally {
    clearTimeout(timer);
  }
}
