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
  uti?: string | null;
  transferName?: string | null;
  totalBytes?: number;
  width?: number | null;
  height?: number | null;
  isSticker?: boolean;
  isOutgoing?: boolean;
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
} as const;

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
];
