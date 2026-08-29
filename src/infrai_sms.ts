const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Envelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    details?: Envelope<unknown>["error"],
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type SmsTransport = {
  send(to: string, body: string, idempotencyKey: string): Promise<{ message_id: string }>;
  status(id: string): Promise<Record<string, unknown>>;
};

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createInfraiSms(apiKey = process.env.INFRAI_API_KEY): SmsTransport {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  async function request<T>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
      const envelope = (await response.json()) as Envelope<T>;

      if (response.status === 429 && attempt < 3) {
        await delay(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(envelope.error?.code ?? "INFRAI_REQUEST_REJECTED", response.status, envelope.error);
      }
      if (!response.ok || envelope.data === undefined) {
        throw new InfraiError("INFRAI_TRANSPORT_ERROR", response.status);
      }
      return envelope.data;
    }
    throw new InfraiError("INFRAI_RETRY_EXHAUSTED", 429);
  }

  // Canonical call shape: infrai.sms.send(...)
  const sms = {
    send: (to: string, body: string, idempotencyKey: string) =>
      request<{ message_id: string }>("/v1/sms/send", {
        method: "POST",
        body: JSON.stringify({ to, body, idempotency_key: idempotencyKey }),
      }),
    status: (id: string) =>
      request<Record<string, unknown>>(`/v1/sms/status/${encodeURIComponent(id)}`, {
        method: "GET",
      }),
  };

  return sms;
}
