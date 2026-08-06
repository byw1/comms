import { describe, it, expect } from 'vitest';
import { sniffFormat, isVoiceMemoAttachment, extractAudioTranscript } from '../src/media.js';

function buf(...parts: Array<string | number[]>): Uint8Array {
  const bytes: number[] = [];
  for (const p of parts) {
    if (typeof p === 'string') bytes.push(...Array.from(p).map((c) => c.charCodeAt(0)));
    else bytes.push(...p);
  }
  // Pad so length checks pass.
  while (bytes.length < 16) bytes.push(0);
  return new Uint8Array(bytes);
}

describe('sniffFormat', () => {
  it('detects Apple CAF as unplayable — the whole reason this exists', () => {
    const caf = sniffFormat(buf('caff', [0, 1, 0, 0]));
    expect(caf.ext).toBe('caf');
    expect(caf.playable).toBe(false);
  });

  it('detects MP3 with an ID3 header', () => {
    expect(sniffFormat(buf('ID3', [3, 0, 0, 0])).ext).toBe('mp3');
    expect(sniffFormat(buf('ID3', [3, 0, 0, 0])).playable).toBe(true);
  });

  it('detects a headerless MP3 by frame sync', () => {
    expect(sniffFormat(buf([0xff, 0xfb, 0x90, 0x00])).ext).toBe('mp3');
  });

  it('detects M4A audio vs MP4 video by ISO brand', () => {
    expect(sniffFormat(buf([0, 0, 0, 0x20], 'ftyp', 'M4A ')).mime).toBe('audio/mp4');
    expect(sniffFormat(buf([0, 0, 0, 0x20], 'ftyp', 'isom')).mime).toBe('video/mp4');
  });

  it('detects wav', () => {
    expect(sniffFormat(buf('RIFF', [0, 0, 0, 0], 'WAVE')).ext).toBe('wav');
  });

  it('detects common images', () => {
    expect(sniffFormat(buf([0xff, 0xd8, 0xff, 0xe0])).ext).toBe('jpg');
    expect(sniffFormat(buf([0x89, 0x50, 0x4e, 0x47])).ext).toBe('png');
    expect(sniffFormat(buf('GIF', '89a')).ext).toBe('gif');
  });

  it('falls back to octet-stream for unknown data', () => {
    expect(sniffFormat(buf([1, 2, 3, 4, 5, 6, 7, 8])).ext).toBe('bin');
  });

  it('does not crash on a tiny buffer', () => {
    expect(sniffFormat(new Uint8Array([1, 2])).ext).toBe('bin');
  });
});

describe('isVoiceMemoAttachment', () => {
  it('recognises the CAF UTI even when the mime type says mp3', () => {
    // This is exactly what BlueBubbles sends: converted label, original UTI.
    expect(
      isVoiceMemoAttachment({
        uti: 'com.apple.coreaudio-format',
        mimeType: 'audio/mp3',
        fileName: 'Audio Message.mp3',
      }),
    ).toBe(true);
  });

  it('recognises audio by mime type', () => {
    expect(isVoiceMemoAttachment({ mimeType: 'audio/mp4' })).toBe(true);
  });

  it('recognises audio by extension', () => {
    expect(isVoiceMemoAttachment({ fileName: 'memo.m4a' })).toBe(true);
  });

  it('is false for images', () => {
    expect(isVoiceMemoAttachment({ mimeType: 'image/jpeg', fileName: 'photo.jpg' })).toBe(false);
  });

  it('is false for an empty descriptor', () => {
    expect(isVoiceMemoAttachment({})).toBe(false);
  });
});

describe('extractAudioTranscript', () => {
  it('finds a transcript nested anywhere', () => {
    const body = { runs: [{ attributes: { IMAudioTranscription: 'Hey, call me back' } }] };
    expect(extractAudioTranscript(body)).toBe('Hey, call me back');
  });

  it('prefers the run matching the requested part index', () => {
    const body = [
      { __kIMMessagePartAttributeName: 0, IMAudioTranscription: 'first' },
      { __kIMMessagePartAttributeName: 1, IMAudioTranscription: 'second' },
    ];
    expect(extractAudioTranscript(body, 1)).toBe('second');
  });

  it('falls back to any transcript when the part index does not match', () => {
    const body = [{ __kIMMessagePartAttributeName: 0, IMAudioTranscription: 'only one' }];
    expect(extractAudioTranscript(body, 7)).toBe('only one');
  });

  it('returns null when there is no transcript', () => {
    expect(extractAudioTranscript({ runs: [{ text: 'hello' }] })).toBeNull();
    expect(extractAudioTranscript(null)).toBeNull();
    expect(extractAudioTranscript(undefined)).toBeNull();
  });

  it('ignores empty transcripts', () => {
    expect(extractAudioTranscript({ IMAudioTranscription: '   ' })).toBeNull();
  });

  it('survives deeply nested and circular-ish structures without throwing', () => {
    let deep: Record<string, unknown> = { IMAudioTranscription: 'deep' };
    for (let i = 0; i < 30; i++) deep = { nested: deep };
    expect(() => extractAudioTranscript(deep)).not.toThrow();
  });
});
