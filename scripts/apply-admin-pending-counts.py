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
    'initial pending detail load',
    "      ensureAdminSectionLoaded('up-requests');",
    "      loadPendingCounts();",
)

replace_once(
    'periodic pending refresh',
    """    async function refreshPendingOnly() {
      await loadPending(true);
    }""",
    """    async function refreshPendingOnly() {
      await loadPendingCounts(true);
    }""",
)

replace_once(
    'pending count helpers',
    """    const pendingState = { lastTotal: 0, dismissed: false, items: [], itemMap: {}, currentKey: null };

    async function loadPending(force = false) {""",
    """    const pendingState = { lastTotal: 0, dismissed: false, items: [], itemMap: {}, currentKey: null };

    function applyPendingCounts(counts) {
      const recruitments = Number(counts && counts.recruitments || 0);
      const lectures = Number(counts && counts.lectures || 0);
      const meetings = Number(counts && counts.meetings || 0);
      const total = recruitments + lectures + meetings;
      const snapshot = { ok: true, recruitments, lectures, meetings, total };

      adminApiCache.set('pending:counts', { time: Date.now(), data: snapshot });
      updatePendingBadge(total);
      if (!pendingState.dismissed && total > 0 && total > pendingState.lastTotal) {
        showPendingPopup(recruitments, lectures, meetings);
      }
      pendingState.lastTotal = total;
      return snapshot;
    }

    async function loadPendingCounts(force = false) {
      try {
        const counts = await cachedAdminFetch(
          'pending:counts',
          '/api/admin/pending-counts',
          { headers: adminHeaders(), force },
          force ? 0 : 15000
        );
        applyPendingCounts(counts || {});
      } catch (e) {
        adminLoadFail('pending-counts', e);
      }
    }

    async function loadPending(force = false) {""",
)

replace_once(
    'pending detail count sync',
    """        renderPendingList(rcs, lcs, mts);
        const total = (rcs.length || 0) + (lcs.length || 0) + (mts.length || 0);
        updatePendingBadge(total);
        if (!pendingState.dismissed && total > 0 && total > pendingState.lastTotal) {
          showPendingPopup(rcs.length, lcs.length, mts.length);
        }
        pendingState.lastTotal = total;""",
    """        renderPendingList(rcs, lcs, mts);
        applyPendingCounts({
          recruitments: rcs.length || 0,
          lectures: lcs.length || 0,
          meetings: mts.length || 0
        });""",
)

path.write_text(text, encoding='utf-8')
