import { nanoid } from 'nanoid';

/**
 * Generate a unique tempGuid for an outbound send. BlueBubbles echoes this back
 * on the resulting `new-message` event so we can reconcile the echo to the agent
 * who sent it (critical for multi-agent shared inboxes).
 */
export function newTempGuid(): string {
  return `comms-${nanoid()}`;
}
