import { insurerNames } from './insurers.js';

const EMPTY_ALIAS_SLOTS = 8;

function aliasBinds(slug) {
  const names = insurerNames(slug).slice(0, EMPTY_ALIAS_SLOTS);
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
  const mention = `%${ins.name}%`;

  const [coverages, cases, boardPosts] = await Promise.all([
    safeQuery(() => env.DB.prepare(
      `SELECT product_name, coverage_name, join_amount, join_age,
              payment_period, maturity_period, gender
       FROM ic_product_coverages
       WHERE insurer IN (?, ?, ?, ?, ?, ?, ?, ?)
         AND verify_status = 'approved'
         AND join_amount IS NOT NULL
         AND TRIM(join_amount) NOT IN ('', '-')
       ORDER BY product_name, coverage_name
       LIMIT 40`
    ).bind(...names).all()),
    safeQuery(() => env.DB.prepare(
      `SELECT category, disease, gender, age, join_condition, result,
              summary, reliability, created_at
       FROM ic_insurance_cases
       WHERE insurer IN (?, ?, ?, ?, ?, ?, ?, ?)
         AND verify_status = 'approved'
       ORDER BY reliability DESC, created_at DESC
       LIMIT 12`
    ).bind(...names).all()),
    safeQuery(() => env.DB.prepare(
      `SELECT id, title, content, created_at
       FROM ic_board_posts
       WHERE deleted = 0
         AND (title LIKE ? OR content LIKE ?)
       ORDER BY created_at DESC
       LIMIT 5`
    ).bind(mention, mention).all()),
  ]);

  return { coverages, cases, boardPosts };
}
