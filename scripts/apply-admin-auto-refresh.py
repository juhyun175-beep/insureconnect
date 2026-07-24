from pathlib import Path

path = Path('admin.html')
text = path.read_text(encoding='utf-8')


def replace_once(label, old, new):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    text = text.replace(old, new, 1)


replace_once(
    'admin cache constants',
    """    let _cachedMainStats  = null;
    const ADMIN_LIST_INITIAL_LIMIT = 30;
    const ADMIN_LIST_PAGE_SIZE = 30;
    const ADMIN_API_TTL_MS = 30000;
    const adminSectionLoaded = new Set();
    const adminApiCache = new Map();""",
    """    let _cachedMainStats  = null;
    const ADMIN_LIST_INITIAL_LIMIT = 30;
    const ADMIN_LIST_PAGE_SIZE = 30;
    const ADMIN_API_TTL_MS = 30000;
    const ADMIN_STATS_REFRESH_MS = 60000;
    const ADMIN_PENDING_REFRESH_MS = 30000;
    const ADMIN_SECONDARY_REFRESH_MS = 300000;
    const adminSectionLoaded = new Set();
    const adminApiCache = new Map();
    const adminApiInflight = new Map();""",
)

replace_once(
    'cachedAdminFetch',
    """    async function cachedAdminFetch(key, url, options = {}, ttlMs = ADMIN_API_TTL_MS) {
      const now = Date.now();
      const fetchOptions = Object.assign({}, options);
      const force = fetchOptions.force === true;
      delete fetchOptions.force;
      if (!force) {
        const cached = adminApiCache.get(key);
        if (cached && now - cached.time < ttlMs) return cached.data;
      } else {
        adminApiCache.delete(key);
      }
      const res = await fetch(url, fetchOptions);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data && (data.error || data.message) ? (data.error || data.message) : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      adminApiCache.set(key, { time: now, data });
      return data;
    }""",
    """    async function cachedAdminFetch(key, url, options = {}, ttlMs = ADMIN_API_TTL_MS) {
      const now = Date.now();
      const fetchOptions = Object.assign({}, options);
      const force = fetchOptions.force === true;
      delete fetchOptions.force;
      if (!force) {
        const cached = adminApiCache.get(key);
        if (cached && now - cached.time < ttlMs) return cached.data;
      } else {
        adminApiCache.delete(key);
      }

      const inflight = adminApiInflight.get(key);
      if (inflight) return inflight;

      const request = (async () => {
        const res = await fetch(url, fetchOptions);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = data && (data.error || data.message) ? (data.error || data.message) : `HTTP ${res.status}`;
          throw new Error(msg);
        }
        adminApiCache.set(key, { time: Date.now(), data });
        return data;
      })();

      adminApiInflight.set(key, request);
      try {
        return await request;
      } finally {
        if (adminApiInflight.get(key) === request) adminApiInflight.delete(key);
      }
    }""",
)

replace_once(
    'auto refresh scheduler',
    """    async function refreshLightweightStats() {
      await loadDashboard(true);
    }

    async function refreshPendingOnly() {
      await loadPending(true);
    }

    /* ── 실시간 자동 갱신 (30초 간격, 핵심 통계/승인대기만) ── */
    let _autoTimer = null;
    let _lastKstDate = null;
    function _getKstDateStr() {
      return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
        year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    function startAutoRefresh() {
      if (_autoTimer) return;
      _lastKstDate = _getKstDateStr();
      _autoTimer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          const cur = _getKstDateStr();
          if (cur !== _lastKstDate) {
            /* 자정 KST 넘어감 → 강제 리셋 갱신 */
            _lastKstDate = cur;
            _cachedMainStats  = null;
            invalidateAdminCache('dashboard:');
          }
          refreshLightweightStats();
          if (!isAdminFormFocused()) refreshPendingOnly();
        }
      }, 30000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          const cur = _getKstDateStr();
          if (cur !== _lastKstDate) {
            _lastKstDate = cur;
            _cachedMainStats  = null;
            invalidateAdminCache('dashboard:');
          }
          refreshLightweightStats();
          if (!isAdminFormFocused()) refreshPendingOnly();
        }
      });
    }""",
    """    async function refreshLightweightStats() {
      await loadDashboard(true, false);
    }

    async function refreshSecondaryDashboardStats(force = true) {
      await Promise.allSettled([
        loadSessionStats(force),
        loadPopularContent(force)
      ]);
    }

    async function refreshPendingOnly() {
      await loadPending(true);
    }

    /* ── 자동 갱신: KPI 60초 · 승인대기 30초 · 보조통계 5분 ── */
    let _statsTimer = null;
    let _pendingTimer = null;
    let _secondaryTimer = null;
    let _lastKstDate = null;
    let _lastStatsRefreshAt = 0;
    let _lastPendingRefreshAt = 0;
    let _lastSecondaryRefreshAt = 0;

    function _getKstDateStr() {
      return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
        year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    function _resetDashboardDateCacheIfNeeded() {
      const cur = _getKstDateStr();
      if (cur === _lastKstDate) return false;
      _lastKstDate = cur;
      _cachedMainStats = null;
      invalidateAdminCache('dashboard:');
      return true;
    }

    function _runStatsRefreshIfDue(force = false) {
      const now = Date.now();
      if (!force && now - _lastStatsRefreshAt < ADMIN_STATS_REFRESH_MS) return;
      _lastStatsRefreshAt = now;
      refreshLightweightStats().catch(e => console.warn('admin stats refresh failed', e));
    }

    function _runPendingRefreshIfDue(force = false) {
      const now = Date.now();
      if (!force && now - _lastPendingRefreshAt < ADMIN_PENDING_REFRESH_MS) return;
      _lastPendingRefreshAt = now;
      refreshPendingOnly().catch(e => console.warn('admin pending refresh failed', e));
    }

    function _runSecondaryRefreshIfDue(force = false) {
      const now = Date.now();
      if (!force && now - _lastSecondaryRefreshAt < ADMIN_SECONDARY_REFRESH_MS) return;
      _lastSecondaryRefreshAt = now;
      refreshSecondaryDashboardStats(true).catch(e => console.warn('admin secondary refresh failed', e));
    }

    function _runAllAutoRefreshSections(force = false) {
      _runStatsRefreshIfDue(force);
      if (!isAdminFormFocused()) _runPendingRefreshIfDue(force);
      _runSecondaryRefreshIfDue(force);
    }

    function startAutoRefresh() {
      if (_statsTimer || _pendingTimer || _secondaryTimer) return;
      _lastKstDate = _getKstDateStr();
      const now = Date.now();
      _lastStatsRefreshAt = now;
      _lastPendingRefreshAt = now;
      _lastSecondaryRefreshAt = now;

      _statsTimer = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        if (_resetDashboardDateCacheIfNeeded()) {
          _runAllAutoRefreshSections(true);
          return;
        }
        _runStatsRefreshIfDue();
      }, ADMIN_STATS_REFRESH_MS);

      _pendingTimer = setInterval(() => {
        if (document.visibilityState !== 'visible' || isAdminFormFocused()) return;
        if (_resetDashboardDateCacheIfNeeded()) {
          _runAllAutoRefreshSections(true);
          return;
        }
        _runPendingRefreshIfDue();
      }, ADMIN_PENDING_REFRESH_MS);

      _secondaryTimer = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        if (_resetDashboardDateCacheIfNeeded()) {
          _runAllAutoRefreshSections(true);
          return;
        }
        _runSecondaryRefreshIfDue();
      }, ADMIN_SECONDARY_REFRESH_MS);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        _runAllAutoRefreshSections(_resetDashboardDateCacheIfNeeded());
      });
    }""",
)

replace_once(
    'loadDashboard signature',
    '    async function loadDashboard(force = false) {',
    '    async function loadDashboard(force = false, includeSecondary = true) {',
)

replace_once(
    'secondary dashboard loads',
    """        /* 체류 시간 통계 */
        loadSessionStats(force);


        /* 인기 콘텐츠 (조회/공유유입/복사) */
        loadPopularContent(force);""",
    """        /* 체류 시간·인기 콘텐츠는 최초 로드 또는 5분 주기로만 갱신 */
        if (includeSecondary) refreshSecondaryDashboardStats(force);""",
)

path.write_text(text, encoding='utf-8')
