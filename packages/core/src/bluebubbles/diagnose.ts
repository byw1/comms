/**
 * Translate BlueBubbles connection failures into something a non-technical
 * operator can act on.
 *
 * Node's fetch collapses DNS failures, refused connections, TLS errors and
 * unroutable hosts into the single string "fetch failed", which is useless on
 * its own. Comms runs in the cloud, so the single most common cause is an
 * address that only resolves on the operator's own network.
 */

export type ConnectionProblem =
  | 'local-address'
  | 'no-scheme'
  | 'bad-url'
  | 'password'
  | 'timeout'
  | 'tls'
  | 'dns'
  | 'refused'
  | 'unreachable'
  | 'server-error';

export interface ConnectionDiagnosis {
  problem: ConnectionProblem;
  /** One sentence, plain language, no jargon. */
  message: string;
  /** What to actually do about it. */
  hint: string;
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /\.local$/i,
  /^\[?::1\]?$/,
];

/**
 * Reject addresses that can never work from a hosted deployment, before we
 * waste a request on them. This is the check that turns "fetch failed" into
 * an explanation.
 */
export function checkServerUrl(rawUrl: string): ConnectionDiagnosis | null {
  const url = rawUrl.trim();
  if (!url) {
    return {
      problem: 'bad-url',
      message: 'You need to paste the web address first.',
      hint: 'In BlueBubbles on your Mac, look under the connection settings — the address usually ends in .trycloudflare.com or .ngrok-free.app',
    };
  }

  if (!/^https?:\/\//i.test(url)) {
    return {
      problem: 'no-scheme',
      message: 'That address is missing the https:// at the front.',
      hint: `Try using: https://${url.replace(/^\/+/, '')}`,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      problem: 'bad-url',
      message: "That doesn't look like a complete web address.",
      hint: 'Copy the whole address from BlueBubbles, including the https:// at the start and with no spaces.',
    };
  }

  if (PRIVATE_HOST_PATTERNS.some((p) => p.test(parsed.hostname))) {
    return {
      problem: 'local-address',
      message: `"${parsed.hostname}" is an address that only works on your own network.`,
      hint: 'Comms runs in the cloud, so it can\'t reach your Mac directly. In BlueBubbles, turn on a proxy service (Cloudflare is the default) — it gives you a public https:// address that works from anywhere. Paste that one instead.',
    };
  }

  return null;
}

/** Translate a thrown BlueBubbles/fetch error into an actionable diagnosis. */
export function diagnoseConnectionError(err: unknown, serverUrl?: string): ConnectionDiagnosis {
  // An obviously-unusable URL explains the failure better than the error does.
  if (serverUrl) {
    const urlProblem = checkServerUrl(serverUrl);
    if (urlProblem) return urlProblem;
  }

  const raw = (err as Error)?.message ?? String(err);
  const status = (err as { status?: number })?.status;
  const cause = ((err as { cause?: { code?: string } })?.cause?.code ?? '').toUpperCase();
  const text = `${raw} ${cause}`.toUpperCase();

  if (status === 401 || status === 403 || /UNAUTHOR|FORBIDDEN|PASSWORD/.test(text)) {
    return {
      problem: 'password',
      message: "That password doesn't match the one set on your Mac.",
      hint: 'Open BlueBubbles on the Mac and check the password field. Watch for autocorrect capitalising the first letter, and for a trailing space when copying.',
    };
  }

  if (status === 408 || /TIMED OUT|TIMEOUT|ABORT|UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/.test(text)) {
    return {
      problem: 'timeout',
      message: 'Your Mac took too long to answer.',
      hint: 'Wake the Mac, confirm BlueBubbles is running and shows a connected status, then try again. A sleeping Mac is the usual cause.',
    };
  }

  if (/CERT|TLS|SSL|SELF_SIGNED|ERR_TLS/.test(text)) {
    return {
      problem: 'tls',
      message: "Your Mac answered, but its security certificate couldn't be verified.",
      hint: 'This usually means a custom domain or self-signed certificate. Using the BlueBubbles-provided Cloudflare address avoids it entirely.',
    };
  }

  if (/ENOTFOUND|EAI_AGAIN|DNS/.test(text)) {
    return {
      problem: 'dns',
      message: "That web address doesn't exist any more.",
      hint: "Cloudflare gives BlueBubbles a new address every time it restarts. Open BlueBubbles, copy the current address, and update it here — your inbox and history stay exactly as they are.",
    };
  }

  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH/.test(text)) {
    return {
      problem: 'refused',
      message: 'Your Mac refused the connection.',
      hint: 'BlueBubbles is probably not running, or its proxy is switched off. Open the app on the Mac and check that it shows a green/connected status.',
    };
  }

  if (status && status >= 500) {
    return {
      problem: 'server-error',
      message: 'BlueBubbles answered with an error.',
      hint: 'Restart the BlueBubbles app on your Mac, then try again. If it keeps happening, check the app for an update.',
    };
  }

  // "fetch failed" with no further detail lands here.
  return {
    problem: 'unreachable',
    message: "We couldn't reach your Mac at that address.",
    hint: 'Three usual causes: the address changed when BlueBubbles restarted (copy the current one), the Mac is asleep, or the proxy is turned off in BlueBubbles. Check the app shows a connected status, then try again.',
  };
}

/** One-line version for storing on the connection record / showing in a banner. */
export function describeConnectionError(err: unknown, serverUrl?: string): string {
  const d = diagnoseConnectionError(err, serverUrl);
  return `${d.message} ${d.hint}`;
}
