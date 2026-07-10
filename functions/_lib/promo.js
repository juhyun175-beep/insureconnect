export const LAUNCH_PROMO = {
  enabled: true,
  code: 'launch30',
  limit: 100,
  label: '런치 프로모 — 선착순 100건 등록비 0원',
};

export async function ensurePromoCol(env) {
  await env.DB.prepare(`ALTER TABLE ad_orders ADD COLUMN promo_code TEXT`).run().catch(() => {});
}

export async function getPromoRemaining(env) {
  if (!LAUNCH_PROMO.enabled) {
    return { enabled: false, remaining: 0, limit: LAUNCH_PROMO.limit };
  }

  try {
    await ensurePromoCol(env);
    // Count is based on order creation time. A concurrent registration race may overshoot by 1-2 orders,
    // which is acceptable for expected traffic; if rejected orders waste slots, manually adjust the limit.
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS used FROM ad_orders WHERE promo_code = ?`
    ).bind(LAUNCH_PROMO.code).first();
    const used = Number(row?.used || 0);
    return {
      enabled: true,
      remaining: Math.max(0, LAUNCH_PROMO.limit - used),
      limit: LAUNCH_PROMO.limit,
    };
  } catch (_) {
    return { enabled: true, remaining: 0, limit: LAUNCH_PROMO.limit };
  }
}
