/** Subset of the BlueBubbles API payloads that Comms relies on. */

export interface BBHandle {
  address: string;
  service?: string;
  country?: string;
  originalROWID?: number;
}

export interface BBChat {
  guid: string;
  chatIdentifier?: string;
  displayName?: string | null;
  isArchived?: boolean;
  style?: number;
  participants?: BBHandle[];
}

export interface BBAttachment {
  guid: string;
  mimeType?: string | null;
  /**
   * The stable format signal. Unlike `mimeType`/`transferName` — which the
   * server rewrites during its audio conversion pass — the UTI is never
   * mutated, so it's the only reliable way to recognise a voice memo.
   */
  uti?: string | null;
  transferName?: string | null;
  totalBytes?: number;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown> | null;
  originalROWID?: number;
  /** NOTE: absent from webhook payloads (notification serialization). */
  isSticker?: boolean;
  isOutgoing?: boolean;
}

/** UTI of an iMessage voice memo. Survives the server's audio conversion. */
export const BB_UTI_AUDIO_MESSAGE = 'com.apple.coreaudio-format';

/** One address on a contact. Always an object — never a bare string. */
export interface BBContactAddress {
  /** Can be null when the source row was malformed; filter these out. */
  address: string | null;
  /** UUID string for macOS contacts ('api'), integer for BlueBubbles' own DB. */
  id?: string | number | null;
}

/**
 * A contact from the Mac. `GET /contact` returns
 * `[...blueBubblesDbContacts, ...macOsContacts]` with NO cross-source dedup,
 * so the same person routinely appears twice — dedupe by normalized address.
 */
export interface BBContact {
  phoneNumbers: BBContactAddress[];
  emails: BBContactAddress[];
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  nickname?: string;
  birthday?: string;
  /** Bare base64 — no `data:` prefix and no mime type. Empty string when absent. */
  avatar?: string;
  sourceType?: 'api' | 'db';
  id?: string | number;
}

export interface BBMessage {
  guid: string;
  text?: string | null;
  subject?: string | null;
  isFromMe: boolean;
  isAudioMessage?: boolean;
  handle?: BBHandle | null;
  handleId?: number;
  chats?: BBChat[];
  attachments?: BBAttachment[];
  dateCreated?: number;
  dateDelivered?: number;
  dateRead?: number;
  dateEdited?: number;
  dateRetracted?: number;
  error?: number;
  associatedMessageGuid?: string | null;
  associatedMessageType?: number | string | null;
  threadOriginatorGuid?: string | null;
  /** Echoed back from our outbound send so we can reconcile multi-agent sends. */
  tempGuid?: string | null;
}

export interface BBServerInfo {
  os_version?: string;
  server_version?: string;
  private_api?: boolean;
  proxy_service?: string;
  detected_icloud?: string;
  [key: string]: unknown;
}

export interface BBWebhook {
  id: number | string;
  url: string;
  events: string[];
}

export interface BBResponse<T> {
  status: number;
  message: string;
  data: T;
  error?: { type: string; error: string };
}

/** Friendly reaction names accepted by POST /message/react. `-` prefix removes. */
export type BBReaction =
  | 'love'
  | 'like'
  | 'dislike'
  | 'laugh'
  | 'emphasize'
  | 'question'
  | '-love'
  | '-like'
  | '-dislike'
  | '-laugh'
  | '-emphasize'
  | '-question';

export type BBSendMethod = 'apple-script' | 'private-api';

/** Known webhook/socket event type strings (allowlisted by the server). */
export const BB_EVENTS = {
  newMessage: 'new-message',
  updatedMessage: 'updated-message',
  messageSendError: 'message-send-error',
  typingIndicator: 'typing-indicator',
  chatReadStatusChanged: 'chat-read-status-changed',
  groupNameChange: 'group-name-change',
  participantAdded: 'participant-added',
  participantRemoved: 'participant-removed',
  participantLeft: 'participant-left',
  groupIconChanged: 'group-icon-changed',
  groupIconRemoved: 'group-icon-removed',
  /** The Mac's public URL changed — payload is the new URL as a bare string. */
  newServer: 'new-server',
  serverUpdate: 'server-update',
  helloWorld: 'hello-world',
} as const;

/**
 * These five events deliver a SERIALIZED MESSAGE, not a bespoke payload — so
 * the top-level `guid` is a *message* guid and the chat guid lives at
 * `data.chats[0].guid`. Getting this wrong makes the handler silently no-op.
 */
export const BB_MESSAGE_SHAPED_EVENTS: readonly string[] = [
  BB_EVENTS.groupNameChange,
  BB_EVENTS.participantAdded,
  BB_EVENTS.participantRemoved,
  BB_EVENTS.participantLeft,
  BB_EVENTS.groupIconChanged,
];

/** The events Comms subscribes to when registering a webhook. */
export const COMMS_WEBHOOK_EVENTS: string[] = [
  BB_EVENTS.newMessage,
  BB_EVENTS.updatedMessage,
  BB_EVENTS.messageSendError,
  BB_EVENTS.typingIndicator,
  BB_EVENTS.chatReadStatusChanged,
  BB_EVENTS.groupNameChange,
  BB_EVENTS.participantAdded,
  BB_EVENTS.participantRemoved,
  BB_EVENTS.participantLeft,
  BB_EVENTS.newServer,
];

/**
 * Bump whenever COMMS_WEBHOOK_EVENTS changes.
 *
 * Re-POSTing a webhook URL that already exists is a silent no-op on the
 * BlueBubbles side — it returns the existing row without updating its event
 * list. Without this stamp, every existing install would keep its old
 * subscription forever. The heartbeat compares it and re-registers on drift.
 */
export const COMMS_WEBHOOK_VERSION = 2;

/** Chat guids always contain `;` (e.g. `iMessage;-;+15551234567`). */
export function looksLikeChatGuid(value: unknown): value is string {
  return typeof value === 'string' && value.includes(';');
}

/**
 * Extract the chat guid from any webhook payload, tolerating the three shapes
 * BlueBubbles actually uses: message-shaped events (chats[0].guid), typing
 * (guid), and read-status (chatGuid). Rejects candidates that can't be chat
 * guids so a message guid is never mistaken for one.
 */
export function extractChatGuid(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  const candidates = [
    (d.chats as Array<{ guid?: string }> | undefined)?.[0]?.guid,
    d.chatGuid,
    d.chat_guid,
    d.guid,
  ];
  return candidates.find(looksLikeChatGuid);
}
