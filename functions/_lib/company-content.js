import { safeInsurerNames } from './insurers.js';

const EMPTY_ALIAS_SLOTS = 8;

function aliasBinds(slug) {
  const names = safeInsurerNames(slug).slice(0, EMPTY_ALIAS_SLOTS);
  return [...names, ...Array(EMPTY_ALIAS_SLOTS - names.length).fill(null)];
}

function rows(result) {
  return result?.results || [];
}

function safeQuery(query) {
  return Promise.resolve().then(query).then(rows).catch(() => []);
}

export async function loadCompanyContent(env, ins) {
  const names = aliasBinds(ins.slug);

  const [coverages, cases] = await Promise.all([
    safeQuery(() => env.DB.prepare(
      `SELECT product_name, coverage_name, join_amount, join_age,
              payment_period, maturity_period, gender,
              COUNT(*) OVER() AS total_count
       FROM ic_product_coverages
       WHERE insurer IN (?, ?, ?, ?, ?, ?, ?, ?)
         AND verify_status = 'approved'
         AND join_amount IS NOT NULL
         AND TRIM(join_amount) NOT IN ('', '-')
       ORDER BY product_name, coverage_name
       LIMIT 15`
    ).bind(...names).all()),
    safeQuery(() => env.DB.prepare(
      `SELECT category, disease, gender, age, join_condition, result,
              summary, reliability, created_at
       FROM ic_insurance_cases
       WHERE insurer IN (?, ?, ?, ?, ?, ?, ?, ?)
         AND verify_status = 'approved'
       ORDER BY reliability DESC, created_at DESC
       LIMIT 6`
    ).bind(...names).all()),
  ]);

  return { coverages, cases };
}
