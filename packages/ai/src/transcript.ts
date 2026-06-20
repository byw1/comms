export interface TranscriptMessage {
  role: 'contact' | 'agent' | 'note' | 'system';
  author?: string | null;
  text: string;
}

/** Render a conversation transcript into a compact, model-friendly plain-text form. */
export function formatTranscript(
  messages: TranscriptMessage[],
  contactName?: string | null,
): string {
  return messages
    .filter((m) => m.text && m.text.trim())
    .map((m) => {
      switch (m.role) {
        case 'contact':
          return `${contactName ?? 'Customer'}: ${m.text}`;
        case 'agent':
          return `Agent${m.author ? ` (${m.author})` : ''}: ${m.text}`;
        case 'note':
          return `[internal note] ${m.text}`;
        default:
          return `[system] ${m.text}`;
      }
    })
    .join('\n');
}
