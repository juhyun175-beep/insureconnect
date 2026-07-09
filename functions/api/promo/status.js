import { json, handle } from '../../_lib/http.js';
import { LAUNCH_PROMO, getPromoRemaining } from '../../_lib/promo.js';

export const onRequestGet = async ({ env }) => handle(async () => {
  const promo = await getPromoRemaining(env);
  return json({
    enabled: promo.enabled,
    remaining: promo.remaining,
    limit: promo.limit,
    label: LAUNCH_PROMO.label,
  }, 200, { 'Cache-Control': 'max-age=30' });
});
