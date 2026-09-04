export type HttpStep =
  | Response
  | Error
  | ((input: RequestInfo | URL, init: RequestInit | undefined) => Response | Promise<Response>);

export interface HttpCall {
  input: RequestInfo | URL;
  init: RequestInit | undefined;
}

export function createMockHttp(initialSteps: HttpStep[]) {
  const steps = [...initialSteps];
  const calls: HttpCall[] = [];

  const fetch: typeof globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    const step = steps.shift();
    if (!step) throw new Error('예상하지 않은 HTTP 요청입니다.');
    if (step instanceof Error) throw step;
    return typeof step === 'function' ? step(input, init) : step;
  };

  return { calls, fetch };
}

export function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(headers)) },
  });
}
