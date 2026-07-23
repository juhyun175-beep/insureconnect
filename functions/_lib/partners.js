/**
 * v2.137.0: 제휴 파트너 광고 카드 — 입력 검증/정규화 헬퍼 (등록·수정 공용)
 *
 *   인슈어커넥트는 광고 게재 매체로서 파트너사가 제공한 링크·배너를 게재한다.
 *   요청 객체 전체를 SQL에 그대로 쓰지 않고, 허용 필드만 명시적으로 추출·검증한다.
 *
 *   검증 기준(작업지시서 3-3):
 *     name       필수, trim 후 1~60자
 *     tagline    선택, trim 후 최대 120자
 *     category   선택, trim 후 최대 30자
 *     href       필수, 최대 2,048자, http/https 만 허용
 *     img        선택, 값이 있으면 최대 2,048자, http/https 만 허용
 *     sort_order 정수, -9999~9999
 *     is_active  정확히 0 또는 1
 */

export const PARTNER_FIELDS = ['name', 'tagline', 'category', 'href', 'img', 'sort_order', 'is_active'];

const HREF_MAX = 2048;
const NAME_MAX = 60;
const TAGLINE_MAX = 120;
const CATEGORY_MAX = 30;
const SORT_MIN = -9999;
const SORT_MAX = 9999;

/**
 * new URL() 파싱 후 protocol 검증 — 정규식 한 줄에 의존하지 않는다.
 * javascript:/data:/file:/ftp:/blob: 등은 protocol 불일치로 거부된다.
 */
export function isSafeUrl(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s || s.length > HREF_MAX) return false;
  let u;
  try {
    u = new URL(s);
  } catch (_) {
    return false;
  }
  return u.protocol === 'http:' || u.protocol === 'https:';
}

function toIntOrNull(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return parseInt(value.trim(), 10);
  return null;
}

function normalizeActive(value) {
  if (value === 0 || value === 1) return value;
  if (value === true) return 1;
  if (value === false) return 0;
  return null;
}

/**
 * 허용 필드만 추출·검증하여 SQL SET/INSERT 용 컬럼·값 배열을 만든다.
 *   partial=false(등록): name·href 필수.
 *   partial=true(수정): 값이 전달된 허용 필드만 갱신, 최소 1개 필요.
 * 반환: { error } | { columns: [...], values: [...] }
 */
export function buildPartnerWrite(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') return { error: '요청 본문이 올바르지 않습니다.' };

  const columns = [];
  const values = [];
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  const setText = (key, max) => {
    const trimmed = String(body[key] == null ? '' : body[key]).trim();
    if (trimmed.length > max) return `${key} 길이가 최대 ${max}자를 초과했습니다.`;
    columns.push(key);
    values.push(trimmed || null);
    return null;
  };

  // name — 등록 필수 / 수정 시 전달되면 검증
  if (has('name') || !partial) {
    const name = String(body.name == null ? '' : body.name).trim();
    if (!name) return { error: '파트너명은 필수입니다.' };
    if (name.length > NAME_MAX) return { error: `파트너명은 최대 ${NAME_MAX}자입니다.` };
    columns.push('name');
    values.push(name);
  }

  if (has('tagline')) {
    const err = setText('tagline', TAGLINE_MAX);
    if (err) return { error: err };
  }

  if (has('category')) {
    const err = setText('category', CATEGORY_MAX);
    if (err) return { error: err };
  }

  // href — 등록 필수 / 수정 시 전달되면 검증
  if (has('href') || !partial) {
    const href = String(body.href == null ? '' : body.href).trim();
    if (!href) return { error: '링크(href)는 필수입니다.' };
    if (!isSafeUrl(href)) return { error: '링크는 http/https URL이어야 합니다.' };
    columns.push('href');
    values.push(href);
  }

  if (has('img')) {
    const img = String(body.img == null ? '' : body.img).trim();
    if (img && !isSafeUrl(img)) return { error: '이미지는 http/https URL이어야 합니다.' };
    columns.push('img');
    values.push(img || null);
  }

  if (has('sort_order')) {
    const n = toIntOrNull(body.sort_order);
    if (n === null || n < SORT_MIN || n > SORT_MAX) {
      return { error: `노출 순서는 ${SORT_MIN}~${SORT_MAX} 사이 정수여야 합니다.` };
    }
    columns.push('sort_order');
    values.push(n);
  } else if (!partial) {
    columns.push('sort_order');
    values.push(0);
  }

  if (has('is_active')) {
    const a = normalizeActive(body.is_active);
    if (a === null) return { error: '활성 여부는 0 또는 1이어야 합니다.' };
    columns.push('is_active');
    values.push(a);
  } else if (!partial) {
    columns.push('is_active');
    values.push(1);
  }

  if (partial && columns.length === 0) return { error: '수정할 허용 필드가 없습니다.' };

  return { columns, values };
}
