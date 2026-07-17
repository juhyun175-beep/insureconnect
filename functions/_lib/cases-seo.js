export const CASES_MIN_COUNT = 3;
export const CASES_MIN_UNDERWRITE = 1;

export function normalizeDisease(v) {
  return String(v ?? '').normalize('NFC').trim();
}

export function caseDiseaseUrl(disease) {
  return `/cases/${encodeURIComponent(normalizeDisease(disease))}`;
}

export const CASES_INDEX_WHERE = `verify_status = 'approved' AND ${
  "TRIM(COALESCE(disease,'')) != ''"
}`;
export const CASES_UNDERWRITE_WHERE = `${CASES_INDEX_WHERE} AND category IN ('underwrite','disclosure')`;

export function isCasesIndexable({ count = 0, underwriting = 0 } = {}) {
  return Number(count) >= CASES_MIN_COUNT && Number(underwriting) >= CASES_MIN_UNDERWRITE;
}
