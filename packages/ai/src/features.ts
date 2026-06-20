import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropic, getModel } from './client.js';
import { formatTranscript, type TranscriptMessage } from './transcript.js';

function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
    .trim();
}

/** A tight catch-up summary for an agent opening a conversation. */
export async function summarizeConversation(input: {
  contactName?: string | null;
  messages: TranscriptMessage[];
}): Promise<string> {
  const res = await getAnthropic().messages.create({
    model: getModel(),
    max_tokens: 600,
    system:
      "You are an assistant for a customer-support team. Summarize the conversation so an agent can catch up in seconds. Lead with the customer's core ask and the current status, then the key details. 2–4 sentences, plain text, no preamble.",
    messages: [
      {
        role: 'user',
        content: formatTranscript(input.messages, input.contactName) || 'No messages yet.',
      },
    ],
  });
  return extractText(res.content);
}

/** Draft the next agent reply, optionally matched to the team's brand voice. */
export async function suggestReply(input: {
  contactName?: string | null;
  messages: TranscriptMessage[];
  brandVoiceExamples?: string[];
  guidance?: string;
}): Promise<string> {
  const parts = [formatTranscript(input.messages, input.contactName) || 'No messages yet.'];
  if (input.brandVoiceExamples?.length) {
    parts.push(
      '\n\nExamples of how our team writes (match this tone):\n' +
        input.brandVoiceExamples.map((e) => `- ${e}`).join('\n'),
    );
  }
  if (input.guidance) parts.push(`\n\nGuidance for this reply: ${input.guidance}`);

  const res = await getAnthropic().messages.create({
    model: getModel(),
    max_tokens: 800,
    system:
      "You are a customer-support agent drafting the next reply to send to the customer. Output only the message body — no salutation placeholders, no subject line, no quotation marks, no commentary. Be warm, concise, and genuinely helpful. Match the team's tone from any examples provided. Never invent facts, order numbers, prices, or commitments you cannot verify; if information is missing, ask the customer for it.",
    messages: [{ role: 'user', content: parts.join('') }],
  });
  return extractText(res.content);
}

export interface ConversationTriage {
  priority: 'low' | 'normal' | 'high' | 'urgent';
  sentiment: 'positive' | 'neutral' | 'negative';
  topic: string;
  suggestedTags: string[];
  summary: string;
}

const TRIAGE_TOOL: Anthropic.Tool = {
  name: 'record_triage',
  description: 'Record the triage classification for this support conversation.',
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'urgent'],
        description: 'Urgency based on customer impact and tone.',
      },
      sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
      topic: { type: 'string', description: 'A 1–4 word topic, e.g. "Billing" or "Login issue".' },
      suggestedTags: {
        type: 'array',
        items: { type: 'string' },
        description: '0–5 short lowercase tags.',
      },
      summary: { type: 'string', description: 'One-sentence summary of the request.' },
    },
    required: ['priority', 'sentiment', 'topic', 'suggestedTags', 'summary'],
  },
};

/** Classify a conversation: priority, sentiment, topic, tags, one-line summary. */
export async function triageConversation(input: {
  contactName?: string | null;
  messages: TranscriptMessage[];
}): Promise<ConversationTriage> {
  const res = await getAnthropic().messages.create({
    model: getModel(),
    max_tokens: 600,
    system: 'You triage inbound customer-support conversations. Classify accurately and concisely.',
    messages: [
      {
        role: 'user',
        content: `Triage this conversation:\n\n${
          formatTranscript(input.messages, input.contactName) || 'No messages yet.'
        }`,
      },
    ],
    tools: [TRIAGE_TOOL],
    tool_choice: { type: 'tool' as const, name: 'record_triage' },
  });

  const block = res.content.find((b) => b.type === 'tool_use');
  const data = (block && 'input' in block ? block.input : {}) as Partial<ConversationTriage>;
  return {
    priority: data.priority ?? 'normal',
    sentiment: data.sentiment ?? 'neutral',
    topic: (data.topic ?? '').slice(0, 60),
    suggestedTags: Array.isArray(data.suggestedTags)
      ? data.suggestedTags.slice(0, 5).map((t) => String(t).toLowerCase().slice(0, 30))
      : [],
    summary: (data.summary ?? '').slice(0, 400),
  };
}
