import re
from pathlib import Path

path = Path('admin.html')
text = path.read_text(encoding='utf-8')

text, n = re.subn(
    r"ensureAdminSectionLoaded\(\s*['\"]up-requests['\"]\s*\)\s*;?",
    'loadPendingCounts();',
    text,
)
if n > 1:
    raise SystemExit(f'initial loader matches: {n}')

text, n = re.subn(
    r"(async function refreshPendingOnly\(\)\s*\{\s*)await loadPending\(true\);(\s*\})",
    r"\1await loadPendingCounts(true);\2",
    text,
    count=1,
)
if n != 1:
    raise SystemExit(f'periodic refresh matches: {n}')

marker = '    async function loadPending(force = false) {'
pos = text.find(marker)
if pos < 0:
    raise SystemExit('loadPending marker missing')

helper = """    function applyPendingCounts(counts) {
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
          'pending:counts', '/api/admin/pending-counts',
          { headers: adminHeaders(), force }, force ? 0 : 15000
        );
        applyPendingCounts(counts || {});
      } catch (e) {
        adminLoadFail('pending-counts', e);
      }
    }

"""
if 'async function loadPendingCounts(force = false)' not in text:
    text = text[:pos] + helper + text[pos:]
    pos += len(helper)

next_function = text.find('\n    function renderPendingList(rcs, lcs, mts) {', pos)
if next_function < 0:
    raise SystemExit('loadPending end marker missing')
segment = text[pos:next_function]
start_marker = '        renderPendingList(rcs, lcs, mts);'
end_marker = '        pendingState.lastTotal = total;'
start = segment.find(start_marker)
end = segment.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('detail count block missing')
end += len(end_marker)
replacement = """        renderPendingList(rcs, lcs, mts);
        applyPendingCounts({
          recruitments: rcs.length || 0,
          lectures: lcs.length || 0,
          meetings: mts.length || 0
        });"""
segment = segment[:start] + replacement + segment[end:]
text = text[:pos] + segment + text[next_function:]

path.write_text(text, encoding='utf-8')
