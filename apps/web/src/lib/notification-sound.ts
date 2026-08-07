/**
 * A short two-note chime for new notifications, synthesised with WebAudio rather
 * than shipped as an audio file — no asset to load, nothing to 404 on a
 * self-hosted install. Browsers refuse to play audio until the page has been
 * interacted with, which is fine: by the time a notification arrives the user
 * has almost always clicked something.
 */

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

export function playNotificationTone(): void {
  try {
    const audio = context();
    if (!audio) return;
    if (audio.state === 'suspended') void audio.resume();

    const start = audio.currentTime;
    for (const [frequency, offset] of [
      [880, 0],
      [1174.66, 0.09],
    ] as const) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      // Ramp in and out so the note doesn't click on either end.
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.1, start + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
      osc.connect(gain).connect(audio.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.2);
    }
  } catch {
    // Audio is a nicety — never let it take the UI down with it.
  }
}
