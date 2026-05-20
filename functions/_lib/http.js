/** 일관된 JSON 응답 헬퍼 */
const COMMON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
  'Cache-Control': 'no-store'
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...COMMON_HEADERS, ...extra }
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: COMMON_HEADERS });
}

/** SQL Date 비교용 ISO 문자열 (KST 고려는 따로) */
export function nowIso() {
  return new Date().toISOString();
}

/** Async safe wrapper — 예외 시 500 JSON */
export async function handle(fn) {
  try {
    return await fn();
  } catch (e) {
    return error(e.message || 'Internal error', 500);
  }
}
