const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function seedFromSlug(slug) {
  const value = String(slug == null ? '' : slug);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicPick(pool, seedKey, n) {
  if (!Array.isArray(pool) || !pool.length) return [];
  const requested = Math.floor(Number(n));
  const limit = Math.min(pool.length, Number.isFinite(requested) ? Math.max(0, requested) : pool.length);
  if (!limit) return [];

  const seed = seedFromSlug(seedKey);
  const offset = seed % pool.length;
  const stride = 1 + (seed % 3);
  const selected = [];
  const usedIndexes = new Set();

  for (let step = 0; step < pool.length && selected.length < limit; step += 1) {
    const index = (offset + (step * stride)) % pool.length;
    if (usedIndexes.has(index)) continue;
    usedIndexes.add(index);
    selected.push(pool[index]);
  }

  // stride와 pool 길이의 최대공약수가 1이 아니어도 n개를 안정적으로 채운다.
  for (let step = 0; step < pool.length && selected.length < limit; step += 1) {
    const index = (offset + step) % pool.length;
    if (usedIndexes.has(index)) continue;
    usedIndexes.add(index);
    selected.push(pool[index]);
  }

  return selected;
}

export async function pickRelatedPosts(db, seedKey, categories, n = 5) {
  try {
    if (!db || typeof db.prepare !== 'function' || !Array.isArray(categories) || !categories.length) return [];
    const ph = categories.map(() => '?').join(',');
    const rs = await db.prepare(
      `SELECT category, slug, title FROM ic_seo_posts
       WHERE status='published' AND category IN (${ph})
       ORDER BY category, slug`,
    ).bind(...categories).all();
    const pool = Array.isArray(rs && rs.results) ? rs.results : [];
    return deterministicPick(pool, seedKey, n);
  } catch (_) {
    return [];
  }
}

export function relatedHtml(posts, heading) {
  const items = Array.isArray(posts)
    ? posts.filter((post) => post && post.category && post.slug && post.title)
    : [];
  if (!items.length) return '';
  return `<section class="card rel">
  <h2>${esc(heading)}</h2>
  <ul>${items.map((post) => `<li><a href="/insurance/${esc(post.category)}/${esc(post.slug)}">${esc(post.title)}</a></li>`).join('')}</ul>
</section>`;
}

export function crossLinkHtml(peers, current, heading, base, suffix) {
  const currentSlug = typeof current === 'object' && current ? current.slug : current;
  const seen = new Set([String(currentSlug == null ? '' : currentSlug)]);
  const uniquePeers = [];
  for (const peer of Array.isArray(peers) ? peers : []) {
    if (!peer || !peer.slug) continue;
    const slug = String(peer.slug);
    if (seen.has(slug)) continue;
    seen.add(slug);
    uniquePeers.push(peer);
  }

  const selected = deterministicPick(uniquePeers, currentSlug, 6);
  if (!selected.length) return '';
  return `<section class="card rel">
  <h2>${esc(heading)}</h2>
  <ul>${selected.map((peer) => `<li><a href="${esc(base)}${esc(peer.slug)}">${esc(peer.name || peer.slug)}${esc(suffix)}</a></li>`).join('')}</ul>
</section>`;
}
