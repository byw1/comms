import type {
  BBResponse,
  BBServerInfo,
  BBMessage,
  BBChat,
  BBContact,
  BBWebhook,
  BBReaction,
  BBSendMethod,
} from './types.js';

export class BlueBubblesError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly type?: string,
  ) {
    super(message);
    this.name = 'BlueBubblesError';
  }
}

export interface BlueBubblesClientOptions {
  serverUrl: string;
  password: string;
  /** Query param name for auth. BlueBubbles accepts `password`, `guid`, or `token`. */
  passwordParam?: 'password' | 'guid' | 'token';
  timeoutMs?: number;
}

export interface SendTextParams {
  chatGuid: string;
  tempGuid: string;
  message: string;
  method?: BBSendMethod;
  subject?: string;
  /** GUID of the message being replied to (Private API inline reply). */
  selectedMessageGuid?: string;
  partIndex?: number;
  effectId?: string;
}

export interface SendAttachmentParams {
  chatGuid: string;
  tempGuid: string;
  file: Buffer | Uint8Array;
  fileName: string;
  contentType?: string;
  message?: string;
  method?: BBSendMethod;
  isAudioMessage?: boolean;
}

export interface ReactParams {
  chatGuid: string;
  selectedMessageGuid: string;
  reaction: BBReaction;
  partIndex?: number;
}

/**
 * A typed client for one BlueBubbles server. All requests authenticate with the
 * shared password passed as a query parameter (the only method BlueBubbles
 * supports). Never log full URLs — they contain the password.
 */
export class BlueBubblesClient {
  private readonly base: string;
  private readonly password: string;
  private readonly passwordParam: string;
  private readonly timeoutMs: number;

  constructor(opts: BlueBubblesClientOptions) {
    this.base = opts.serverUrl.replace(/\/+$/, '');
    this.password = opts.password;
    this.passwordParam = opts.passwordParam ?? 'password';
    this.timeoutMs = opts.timeoutMs ?? 20_000;
  }

  private url(path: string, query: Record<string, string | number | undefined> = {}): string {
    const u = new URL(`${this.base}/api/v1/${path.replace(/^\/+/, '')}`);
    u.searchParams.set(this.passwordParam, this.password);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) u.searchParams.set(k, String(v));
    }
    return u.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    init: {
      query?: Record<string, string | number | undefined>;
      json?: unknown;
      body?: BodyInit;
      headers?: Record<string, string>;
      /** Per-call override — a full contact dump needs far longer than 20s. */
      timeoutMs?: number;
    } = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? this.timeoutMs);
    try {
      const headers: Record<string, string> = { ...init.headers };
      let body = init.body;
      if (init.json !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(init.json);
      }
      const res = await fetch(this.url(path, init.query), {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      const text = await res.text();
      let parsed: BBResponse<T> | undefined;
      try {
        parsed = text ? (JSON.parse(text) as BBResponse<T>) : undefined;
      } catch {
        // non-JSON body
      }

      if (!res.ok || (parsed && parsed.status >= 400)) {
        const detail = parsed?.error?.error ?? parsed?.message ?? text ?? res.statusText;
        throw new BlueBubblesError(
          `BlueBubbles ${method} ${path} failed: ${detail}`,
          parsed?.status ?? res.status,
          parsed?.error?.type,
        );
      }
      return (parsed ? parsed.data : (undefined as T)) as T;
    } catch (err) {
      if (err instanceof BlueBubblesError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new BlueBubblesError(`BlueBubbles ${method} ${path} timed out`, 408);
      }
      throw new BlueBubblesError(
        `BlueBubbles ${method} ${path} request error: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- Health / capabilities ----

  async ping(): Promise<boolean> {
    await this.request<unknown>('GET', 'ping');
    return true;
  }

  async serverInfo(): Promise<BBServerInfo> {
    return this.request<BBServerInfo>('GET', 'server/info');
  }

  // ---- Webhooks ----

  async listWebhooks(): Promise<BBWebhook[]> {
    return this.request<BBWebhook[]>('GET', 'webhook');
  }

  async registerWebhook(url: string, events: string[]): Promise<BBWebhook> {
    return this.request<BBWebhook>('POST', 'webhook', { json: { url, events } });
  }

  async deleteWebhook(id: number | string): Promise<void> {
    await this.request<unknown>('DELETE', `webhook/${id}`);
  }

  // ---- Sending ----

  async sendText(params: SendTextParams): Promise<BBMessage> {
    const { method = 'private-api', ...rest } = params;
    return this.request<BBMessage>('POST', 'message/text', {
      json: { ...rest, method },
    });
  }

  async sendAttachment(params: SendAttachmentParams): Promise<BBMessage> {
    const form = new FormData();
    form.set('chatGuid', params.chatGuid);
    form.set('tempGuid', params.tempGuid);
    form.set('method', params.method ?? 'private-api');
    if (params.message) form.set('message', params.message);
    if (params.isAudioMessage) form.set('isAudioMessage', 'true');
    form.set('name', params.fileName);
    const blob = new Blob([params.file as BlobPart], {
      type: params.contentType ?? 'application/octet-stream',
    });
    form.set('attachment', blob, params.fileName);
    return this.request<BBMessage>('POST', 'message/attachment', { body: form });
  }

  /** Requires the Private API. */
  async react(params: ReactParams): Promise<BBMessage> {
    return this.request<BBMessage>('POST', 'message/react', {
      json: {
        chatGuid: params.chatGuid,
        selectedMessageGuid: params.selectedMessageGuid,
        reaction: params.reaction,
        partIndex: params.partIndex ?? 0,
      },
    });
  }

  /** Requires the Private API. */
  async startTyping(chatGuid: string): Promise<void> {
    await this.request<unknown>('POST', `chat/${encodeURIComponent(chatGuid)}/typing`);
  }

  /** Requires the Private API. */
  async stopTyping(chatGuid: string): Promise<void> {
    await this.request<unknown>('DELETE', `chat/${encodeURIComponent(chatGuid)}/typing`);
  }

  async markRead(chatGuid: string): Promise<void> {
    await this.request<unknown>('POST', `chat/${encodeURIComponent(chatGuid)}/read`);
  }

  // ---- Fetching ----

  async queryChats(
    options: {
      limit?: number;
      offset?: number;
      with?: string[];
      sort?: string;
    } = {},
  ): Promise<BBChat[]> {
    return this.request<BBChat[]>('POST', 'chat/query', {
      json: {
        limit: options.limit ?? 1000,
        offset: options.offset ?? 0,
        with: options.with ?? ['lastMessage', 'participants'],
        sort: options.sort ?? 'lastmessage',
      },
    });
  }

  async getChatMessages(
    chatGuid: string,
    options: {
      limit?: number;
      offset?: number;
      after?: number;
      before?: number;
      sort?: 'ASC' | 'DESC';
      with?: string[];
    } = {},
  ): Promise<BBMessage[]> {
    return this.request<BBMessage[]>('GET', `chat/${encodeURIComponent(chatGuid)}/message`, {
      query: {
        limit: options.limit ?? 100,
        offset: options.offset,
        after: options.after,
        before: options.before,
        sort: options.sort ?? 'ASC',
        with: (options.with ?? ['attachment', 'handle']).join(','),
      },
    });
  }

  /**
   * Start a brand-new chat with one or more addresses. This is what turns
   * Comms from purely reactive (reply to whoever texts first) into something
   * you can start a conversation from.
   */
  async createChat(params: {
    addresses: string[];
    message: string;
    service?: string;
    method?: BBSendMethod;
    tempGuid?: string;
  }): Promise<BBChat & { guid: string }> {
    return this.request<BBChat & { guid: string }>('POST', 'chat/new', {
      json: {
        addresses: params.addresses,
        message: params.message,
        service: params.service ?? 'iMessage',
        method: params.method ?? 'private-api',
        ...(params.tempGuid ? { tempGuid: params.tempGuid } : {}),
      },
      timeoutMs: 30_000,
    });
  }

  // ---- Contacts ----

  /**
   * Every contact the Mac knows about — its own database plus the macOS
   * Address Book / iCloud. Slow with avatars (they're inlined as base64), so
   * the timeout is raised well above the default.
   *
   * Returns `[...dbContacts, ...macContacts]` with NO cross-source dedup: the
   * same person appears twice routinely. Dedupe by normalized address.
   */
  async listContacts(
    options: { withAvatars?: boolean; timeoutMs?: number } = {},
  ): Promise<BBContact[]> {
    const result = await this.request<BBContact[]>('GET', 'contact', {
      query: options.withAvatars ? { extraProperties: 'avatar' } : {},
      timeoutMs: options.timeoutMs ?? 120_000,
    });
    return result ?? [];
  }

  /** Look up specific addresses — used to fetch avatars in batches. */
  async queryContacts(
    addresses: string[],
    options: { withAvatars?: boolean; timeoutMs?: number } = {},
  ): Promise<BBContact[]> {
    const result = await this.request<BBContact[]>('POST', 'contact/query', {
      json: {
        addresses,
        extraProperties: options.withAvatars ? ['avatar'] : [],
      },
      timeoutMs: options.timeoutMs ?? 60_000,
    });
    return result ?? [];
  }

  // ---- Single message ----

  /**
   * Refetch one message in full. Webhooks deliver a slimmed "notification"
   * serialization that omits `attributedBody` — which is where Apple's
   * on-device voice-memo transcript lives.
   */
  async getMessage(guid: string, options: { with?: string[] } = {}): Promise<BBMessage> {
    return this.request<BBMessage>('GET', `message/${encodeURIComponent(guid)}`, {
      query: { with: (options.with ?? ['attachment', 'attributedBody']).join(',') },
    });
  }

  /** Download an attachment's bytes. `original=true` skips server-side conversion. */
  async downloadAttachment(
    guid: string,
    options: { original?: boolean } = {},
  ): Promise<{ bytes: Uint8Array; contentType: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs * 3);
    try {
      const res = await fetch(
        this.url(`attachment/${encodeURIComponent(guid)}/download`, {
          original: options.original ? 'true' : undefined,
        }),
        { signal: controller.signal },
      );
      if (!res.ok) {
        throw new BlueBubblesError(`Attachment download failed: ${res.statusText}`, res.status);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      return { bytes: buf, contentType: res.headers.get('content-type') };
    } finally {
      clearTimeout(timer);
    }
  }
}
