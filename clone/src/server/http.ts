export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  console.error('server error:', e instanceof Error ? e.message : String(e));   // message only: never log state or tokens
  return json({ error: 'Something went wrong on our side. Try again.' }, 500);
}
