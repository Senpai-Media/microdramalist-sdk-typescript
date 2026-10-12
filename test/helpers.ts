// Test helpers: a fake fetch that records every request and answers from a
// queue, so the tests run offline and never touch microdramalist.com.

export interface Recorded {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

export type Answer = { status?: number; body?: unknown; text?: string; headers?: Record<string, string> };

/** A fetch that answers each call with the next queued answer (the last one repeats). */
export function fakeFetch(...answers: Answer[]) {
  const calls: Recorded[] = [];
  const fn = async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({
      url: new URL(String(input)),
      method: init.method ?? "GET",
      headers: { ...(init.headers as Record<string, string>) },
      body: init.body as string | undefined,
    });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)] ?? {};
    const text = a.text ?? JSON.stringify(a.body ?? {});
    return new Response(text, { status: a.status ?? 200, headers: a.headers });
  };
  return { fetch: fn as typeof fetch, calls };
}
