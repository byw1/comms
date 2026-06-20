export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lightweight liveness probe for Railway healthchecks. */
export function GET() {
  return Response.json({ status: 'ok', service: 'comms-web', ts: Date.now() });
}
