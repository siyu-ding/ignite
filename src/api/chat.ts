import * as Crypto from 'expo-crypto';

export type ChatSession = {
  sessionId: string;
  sessionToken: string;
};

export type DeleteReceipt = {
  receipt_id: string;
  deleted_at: string;
  scope: 'main_database';
  sessions_deleted: number;
  backup_copies_expire_by: string;
};

export type GrowthChoice = 'stay_here' | 'one_small_step' | 'wait_a_while';

export type BridgeOption = {
  id: GrowthChoice;
  label: string;
  stance: string;
};

export type BridgeDecision = {
  version: 'bridge_readiness.v1';
  optionsVersion: 'growth_options.v1';
  ready: boolean;
  offerId: string | null;
  reflection: string | null;
  options: BridgeOption[] | null;
};

export type AskResponse = {
  message: string;
  session_id: string;
  received_message_sha256: string;
  bridge?: BridgeDecision | null;
};

type ErrorEnvelope = {
  error?: string;
  message?: string;
  received_message_sha256?: string;
  restart_required?: boolean;
  session_adoption_required?: boolean;
  session_id?: string;
  session_token?: string;
};

type RequestOptions = {
  token?: string;
  signal?: AbortSignal;
  onSessionAdopt?: (session: ChatSession) => void | Promise<void>;
};

export class ChatApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ChatApiError';
  }
}

function baseUrl() {
  const value = process.env.EXPO_PUBLIC_BACKEND_URL?.trim().replace(/\/$/u, '');
  if (!value) {
    throw new ChatApiError(
      0,
      'backend_not_configured',
      '还没有配置聊天服务地址。请设置 EXPO_PUBLIC_BACKEND_URL。',
    );
  }
  return value;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function post<T>(
  path: string,
  body: Record<string, unknown>,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(options.token ? { 'x-session-token': options.token } : {}),
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ChatApiError(0, 'network_error', '暂时连接不到聊天服务，请稍后再试。');
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ChatApiError(response.status, 'invalid_response', '聊天服务返回了无法读取的内容。');
    }
  }

  const adoption = (payload ?? {}) as ErrorEnvelope;
  if (
    adoption.session_adoption_required === true &&
    adoption.session_id &&
    adoption.session_token
  ) {
    await options.onSessionAdopt?.({
      sessionId: adoption.session_id,
      sessionToken: adoption.session_token,
    });
  }

  if (!response.ok) {
    const envelope = (payload ?? {}) as ErrorEnvelope;
    throw new ChatApiError(
      response.status,
      envelope.error ?? `http_${response.status}`,
      envelope.message ?? '聊天服务暂时不可用。',
    );
  }
  return payload as T;
}

export async function startChatSession(): Promise<ChatSession> {
  const response = await post<{ session_id?: string; session_token?: string }>('/start', {});
  if (!response.session_id || !response.session_token) {
    throw new ChatApiError(0, 'invalid_start_response', '聊天服务没有返回完整的会话信息。');
  }
  return { sessionId: response.session_id, sessionToken: response.session_token };
}

async function reportIntegrityMismatch(
  session: ChatSession,
  onSessionAdopt?: RequestOptions['onSessionAdopt'],
) {
  try {
    await post('/event', {
      session_id: session.sessionId,
      type: 'input_integrity_client_mismatch',
    }, { token: session.sessionToken, onSessionAdopt });
  } catch {
    // Reporting must never cause the possibly committed /ask request to be replayed.
  }
}

export async function askChat(
  session: ChatSession,
  message: string,
  options: Pick<RequestOptions, 'signal' | 'onSessionAdopt'> = {},
): Promise<AskResponse> {
  const messageSha256 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message,
  );
  let activeSession = session;
  let transientRetries = 0;
  while (true) {
    try {
      const requestBody = Object.freeze({
        session_id: activeSession.sessionId,
        message,
        message_sha256: messageSha256,
      });
      const response = await post<AskResponse>('/ask', requestBody, {
        token: activeSession.sessionToken,
        signal: options.signal,
        onSessionAdopt: async (adopted) => {
          activeSession = adopted;
          await options.onSessionAdopt?.(adopted);
        },
      });
      if (response.received_message_sha256 !== messageSha256) {
        await reportIntegrityMismatch(activeSession, options.onSessionAdopt);
        throw new ChatApiError(
          0,
          'input_integrity_client_mismatch',
          '消息完整性校验失败。为避免重复回复，本条不会自动重发。',
        );
      }
      return response;
    } catch (error) {
      if (!(error instanceof ChatApiError)) throw error;
      const retryable = [
        'pending_transport_settlement',
        'stale_session_generation',
        'active_ask_slot',
      ].includes(error.code);
      if (!retryable || transientRetries >= 2) throw error;
      transientRetries += 1;
      await wait(error.code === 'stale_session_generation' ? 350 : 1000);
      // The message and digest remain identical; adopted credentials take effect first.
    }
  }
}

async function postBridge<T>(
  path: string,
  session: ChatSession,
  body: Record<string, unknown>,
  onSessionAdopt?: RequestOptions['onSessionAdopt'],
): Promise<T> {
  let retries = 0;
  let activeSession = session;
  while (true) {
    try {
      return await post<T>(path, { ...body, session_id: activeSession.sessionId }, {
        token: activeSession.sessionToken,
        onSessionAdopt: async (adopted) => {
          activeSession = adopted;
          await onSessionAdopt?.(adopted);
        },
      });
    } catch (error) {
      if (!(error instanceof ChatApiError)) throw error;
      const retryable = ['pending_transport_settlement', 'stale_session_generation'].includes(error.code);
      if (!retryable || retries >= 1) throw error;
      retries += 1;
      await wait(error.code === 'stale_session_generation' ? 350 : 1000);
      // The same body object is replayed exactly as required by the contract.
    }
  }
}

export async function deleteChatSession(
  session: ChatSession,
  signal?: AbortSignal,
): Promise<DeleteReceipt | null> {
  try {
    const response = await post<{ ok?: boolean; deleted?: boolean; receipt?: Partial<DeleteReceipt> }>('/session/delete', { session_id: session.sessionId }, {
      token: session.sessionToken,
      signal,
    });
    const receipt = response.receipt;
    if (
      response.ok !== true ||
      response.deleted !== true ||
      !receipt?.receipt_id ||
      !receipt.deleted_at ||
      receipt.scope !== 'main_database' ||
      typeof receipt.sessions_deleted !== 'number' ||
      !receipt.backup_copies_expire_by
    ) {
      throw new ChatApiError(0, 'invalid_delete_receipt', '删除服务返回了不完整的回执。');
    }
    return receipt as DeleteReceipt;
  } catch (error) {
    // `post` only reaches this branch for a parsed JSON error. An nginx HTML
    // 404 fails earlier as invalid_response and is deliberately not accepted.
    if (error instanceof ChatApiError && error.status === 404) return null;
    throw error;
  }
}

export function acknowledgeBridgeOffer(
  session: ChatSession,
  offerId: string,
  onSessionAdopt?: RequestOptions['onSessionAdopt'],
) {
  return postBridge('/growth-options-shown', session, {
    session_id: session.sessionId,
    offer_id: offerId,
  }, onSessionAdopt);
}

export function chooseBridgeOption(
  session: ChatSession,
  offerId: string,
  choice: GrowthChoice,
  latencyMs: number,
  onSessionAdopt?: RequestOptions['onSessionAdopt'],
) {
  return postBridge<{ ok: true; idempotent: boolean; message: string | null }>('/growth-choice', session, {
    session_id: session.sessionId,
    offer_id: offerId,
    choice,
    latency_ms: Math.max(0, Math.round(latencyMs)),
  }, onSessionAdopt);
}

export function chatErrorMessage(error: unknown) {
  if (!(error instanceof ChatApiError)) return '聊天服务暂时不可用，请稍后再试。';
  if (error.status === 429) return '消息有点多，请稍等一下再试。';
  if (error.code === 'forbidden') return '这次会话已经失效，请返回首页后重新进入。';
  if (error.code === 'session_closed') return '这次对话已经结束，请返回首页后重新开始。';
  if (error.code === 'input_integrity_mismatch') return '消息未通过完整性校验，请稍后重新发送。';
  if (error.status >= 500) return '聊天服务暂时出了点问题，已停止自动重试。';
  return error.message;
}
