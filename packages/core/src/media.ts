/**
 * Media format detection by magic bytes.
 *
 * Necessary because BlueBubbles rewrites `mimeType` and `transferName` during
 * its audio-conversion pass — a voice memo arrives labelled `audio/mp3` /
 * "Audio Message.mp3" while the bytes on disk may still be Apple's CAF. Trust
 * the bytes, never the label: storing CAF under an .mp3 key makes an
 * <audio> element fail silently in every browser.
 */

export interface SniffedFormat {
  ext: string;
  mime: string;
  /** Whether browsers can play/render this directly. */
  playable: boolean;
}

const UNKNOWN: SniffedFormat = { ext: 'bin', mime: 'application/octet-stream', playable: false };

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return Array.from(bytes.slice(offset, offset + length))
    .map((b) => String.fromCharCode(b))
    .join('');
}

/** Identify a buffer from its signature. */
export function sniffFormat(bytes: Uint8Array): SniffedFormat {
  if (bytes.length < 12) return UNKNOWN;

  // ---- Audio ----
  // Apple Core Audio Format — the raw voice-memo container. No browser plays it.
  if (ascii(bytes, 0, 4) === 'caff') return { ext: 'caf', mime: 'audio/x-caf', playable: false };
  if (ascii(bytes, 0, 3) === 'ID3') return { ext: 'mp3', mime: 'audio/mpeg', playable: true };
  // MPEG frame sync (0xFF Ex/Fx) — a headerless MP3.
  if (bytes[0] === 0xff && bytes[1] !== undefined && (bytes[1] & 0xe0) === 0xe0) {
    return { ext: 'mp3', mime: 'audio/mpeg', playable: true };
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') {
    return { ext: 'wav', mime: 'audio/wav', playable: true };
  }
  if (ascii(bytes, 0, 4) === 'OggS') return { ext: 'ogg', mime: 'audio/ogg', playable: true };
  if (ascii(bytes, 0, 5) === '#!AMR') return { ext: 'amr', mime: 'audio/amr', playable: false };

  // ---- ISO base media (mp4 family): audio vs video depends on the brand ----
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand.startsWith('M4A')) return { ext: 'm4a', mime: 'audio/mp4', playable: true };
    if (brand.startsWith('qt')) return { ext: 'mov', mime: 'video/quicktime', playable: false };
    return { ext: 'mp4', mime: 'video/mp4', playable: true };
  }

  // ---- Images ----
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { ext: 'jpg', mime: 'image/jpeg', playable: true };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    return { ext: 'png', mime: 'image/png', playable: true };
  }
  if (ascii(bytes, 0, 3) === 'GIF') return { ext: 'gif', mime: 'image/gif', playable: true };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp', playable: true };
  }
  if (ascii(bytes, 4, 4) === 'ftyp' && ascii(bytes, 8, 4).startsWith('heic')) {
    // Safari plays HEIC; nothing else does.
    return { ext: 'heic', mime: 'image/heic', playable: false };
  }

  // ---- Documents ----
  if (ascii(bytes, 0, 4) === '%PDF') {
    return { ext: 'pdf', mime: 'application/pdf', playable: true };
  }

  return UNKNOWN;
}

/**
 * Whether an attachment is a voice memo. The UTI is authoritative; the mime
 * type and filename are fallbacks because BlueBubbles rewrites both, and
 * because clients other than iMessage send m4a.
 */
export function isVoiceMemoAttachment(input: {
  uti?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  isAudioMessage?: boolean;
}): boolean {
  if (input.isAudioMessage) return true;
  if (input.uti === 'com.apple.coreaudio-format') return true;
  if (input.uti === 'com.apple.m4a-audio') return true;
  if (input.mimeType?.startsWith('audio/')) return true;
  const ext = input.fileName?.split('.').pop()?.toLowerCase();
  return Boolean(ext && ['caf', 'm4a', 'amr', 'wav', 'mp3', 'aac'].includes(ext));
}

/**
 * Recursively hunt for Apple's on-device voice-memo transcript inside a
 * message's attributedBody. The exact nesting isn't documented and has changed
 * between releases, so walk the whole structure looking for the known key
 * rather than assuming a path. Absence is normal, not an error.
 */
export function extractAudioTranscript(body: unknown, partIndex?: number): string | null {
  let fallback: string | null = null;

  function walk(node: unknown, depth: number): string | null {
    if (!node || depth > 12) return null;

    if (Array.isArray(node)) {
      for (const child of node) {
        const hit = walk(child, depth + 1);
        if (hit) return hit;
      }
      return null;
    }
    if (typeof node !== 'object') return null;

    const obj = node as Record<string, unknown>;
    const transcript = obj.IMAudioTranscription;
    if (typeof transcript === 'string' && transcript.trim()) {
      const part = obj.__kIMMessagePartAttributeName;
      // An exact part match wins; otherwise remember it and keep looking.
      if (partIndex === undefined || part === partIndex) return transcript.trim();
      fallback ??= transcript.trim();
    }

    for (const value of Object.values(obj)) {
      const hit = walk(value, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  try {
    return walk(body, 0) ?? fallback;
  } catch {
    return null;
  }
}
