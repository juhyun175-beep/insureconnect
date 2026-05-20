-- ╔═══════════════════════════════════════════════════════════════╗
-- ║   InsureConnect Supabase Cleanup Script                       ║
-- ║   Supabase Dashboard → SQL Editor 에서 섹션별로 실행           ║
-- ║   🚨 반드시 ① → ② → ③ → ④ → ⑤ 순서로 단계별 실행             ║
-- ║   각 섹션 결과를 확인한 뒤 다음 단계로 넘어가세요.              ║
-- ╚═══════════════════════════════════════════════════════════════╝


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  ① DISCOVERY — 어디가 얼마나 차지하는지 먼저 진단              ║
-- ║     (이 섹션은 데이터를 변경하지 않습니다)                       ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- 1-A. 각 테이블 row 수 + 크기
SELECT
  c.relname AS table_name,
  to_char(c.reltuples, 'FM999,999,999') AS approx_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
  pg_size_pretty(pg_indexes_size(c.oid)) AS index_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'ic\_%'
ORDER BY pg_total_relation_size(c.oid) DESC;

-- 1-B. Storage bucket별 파일 개수 + 총 크기
SELECT
  bucket_id,
  count(*) AS file_count,
  pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) AS total_size_bytes
FROM storage.objects
GROUP BY bucket_id
ORDER BY sum((metadata->>'size')::bigint) DESC NULLS LAST;

-- 1-C. 전체 DB 크기
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;



-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  ② DRY-RUN — 삭제 예정 행 개수 확인 (실제 삭제 X)              ║
-- ║     숫자를 보고 OK면 ③으로 진행                                ║
-- ╚═══════════════════════════════════════════════════════════════╝

SELECT 'ic_page_visits 30일 이전'    AS scope, count(*) AS will_delete FROM ic_page_visits   WHERE created_at < now() - interval '30 days'
UNION ALL
SELECT 'ic_card_clicks 30일 이전',           count(*)                FROM ic_card_clicks    WHERE created_at < now() - interval '30 days'
UNION ALL
SELECT 'ic_link_clicks 30일 이전',           count(*)                FROM ic_link_clicks    WHERE created_at < now() - interval '30 days'
UNION ALL
SELECT 'ic_page_sessions 30일 이전',         count(*)                FROM ic_page_sessions  WHERE created_at < now() - interval '30 days'
UNION ALL
SELECT 'ic_service_alerts (종료 7일+ 경과)', count(*)                FROM ic_service_alerts WHERE ends_at IS NOT NULL AND ends_at < now() - interval '7 days'
UNION ALL
SELECT 'ic_home_popups (종료 7일+ 경과)',    count(*)                FROM ic_home_popups    WHERE ends_at IS NOT NULL AND ends_at < now() - interval '7 days'
UNION ALL
SELECT 'ic_knowledge_comments 90일 이전',    count(*)                FROM ic_knowledge_comments WHERE created_at < now() - interval '90 days'
UNION ALL
SELECT 'ic_kakao_stats (최신 1건 제외 옛 통계)', GREATEST(0, count(*) - 1) FROM ic_kakao_stats
ORDER BY 1;



-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  ③ 로그 테이블 정리 — 30일 이전 옛 통계 삭제                   ║
-- ║     (사이트 동작에 영향 X — 통계 그래프는 최근 30일만 노출)    ║
-- ╚═══════════════════════════════════════════════════════════════╝

DELETE FROM ic_page_visits   WHERE created_at < now() - interval '30 days';
DELETE FROM ic_card_clicks   WHERE created_at < now() - interval '30 days';
DELETE FROM ic_link_clicks   WHERE created_at < now() - interval '30 days';
DELETE FROM ic_page_sessions WHERE created_at < now() - interval '30 days';

-- 만료된 알림·팝업 (종료 7일 지난 거)
DELETE FROM ic_service_alerts WHERE ends_at IS NOT NULL AND ends_at < now() - interval '7 days';
DELETE FROM ic_home_popups    WHERE ends_at IS NOT NULL AND ends_at < now() - interval '7 days';

-- 오래된 보험지식 댓글 (90일 이전)
DELETE FROM ic_knowledge_comments WHERE created_at < now() - interval '90 days';

-- 카카오톡 대화순위는 가장 최근 1건만 남기고 나머지 삭제
DELETE FROM ic_kakao_stats
WHERE id NOT IN (SELECT id FROM ic_kakao_stats ORDER BY created_at DESC LIMIT 1);

SELECT 'DB log cleanup done' AS status;



-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  ④ STORAGE ORPHAN 정리 — DB에 참조 없는 파일 삭제              ║
-- ║     각 bucket을 순회하며 ic_* 테이블 file_url과 비교            ║
-- ║     ⚠️ storage.objects 삭제 = 실제 파일 삭제 (R2/S3 cascade)   ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- 4-A. DRY-RUN: bucket별 orphan 개수 미리 확인
WITH refs AS (
  SELECT 'recruitments'    AS bkt, regexp_replace(file_url, '.*/object/public/recruitments/', '')    AS path FROM ic_recruitments    WHERE file_url IS NOT NULL
  UNION ALL SELECT 'newsletters',  regexp_replace(file_url, '.*/object/public/newsletters/', '')     FROM ic_newsletters    WHERE file_url IS NOT NULL
  UNION ALL SELECT 'claim-forms',  regexp_replace(file_url, '.*/object/public/claim-forms/', '')     FROM ic_claim_forms    WHERE file_url IS NOT NULL
  UNION ALL SELECT 'card-news',    regexp_replace(file_url, '.*/object/public/card-news/', '')       FROM ic_card_news      WHERE file_url IS NOT NULL
  UNION ALL SELECT 'sidebar-banner',regexp_replace(file_url, '.*/object/public/sidebar-banner/', '') FROM ic_sidebar_banner WHERE file_url IS NOT NULL
  UNION ALL SELECT 'knowledge',    regexp_replace(image_url, '.*/object/public/knowledge/', '')      FROM ic_knowledge_posts WHERE image_url IS NOT NULL
  UNION ALL SELECT 'textbooks',    regexp_replace(file_url, '.*/object/public/textbooks/', '')       FROM ic_textbooks      WHERE file_url IS NOT NULL
  UNION ALL SELECT 'home-popup',   regexp_replace(file_url, '.*/object/public/home-popup/', '')      FROM ic_home_popups    WHERE file_url IS NOT NULL
)
SELECT o.bucket_id, count(*) AS orphan_count,
       pg_size_pretty(coalesce(sum((o.metadata->>'size')::bigint), 0)) AS orphan_size
FROM storage.objects o
LEFT JOIN refs r ON r.bkt = o.bucket_id AND r.path = o.name
WHERE o.bucket_id IN ('recruitments','newsletters','claim-forms','card-news','sidebar-banner','knowledge','textbooks','home-popup')
  AND r.path IS NULL
GROUP BY o.bucket_id
ORDER BY 1;

-- ⚠️ 결과 확인 후 아래 DELETE 실행 (필요 시 한 번에 한 bucket씩)

-- 4-B. 실제 삭제 — DB에서 참조 안 하는 파일 모두 제거
WITH refs AS (
  SELECT 'recruitments'    AS bkt, regexp_replace(file_url, '.*/object/public/recruitments/', '')    AS path FROM ic_recruitments    WHERE file_url IS NOT NULL
  UNION ALL SELECT 'newsletters',  regexp_replace(file_url, '.*/object/public/newsletters/', '')     FROM ic_newsletters    WHERE file_url IS NOT NULL
  UNION ALL SELECT 'claim-forms',  regexp_replace(file_url, '.*/object/public/claim-forms/', '')     FROM ic_claim_forms    WHERE file_url IS NOT NULL
  UNION ALL SELECT 'card-news',    regexp_replace(file_url, '.*/object/public/card-news/', '')       FROM ic_card_news      WHERE file_url IS NOT NULL
  UNION ALL SELECT 'sidebar-banner',regexp_replace(file_url, '.*/object/public/sidebar-banner/', '') FROM ic_sidebar_banner WHERE file_url IS NOT NULL
  UNION ALL SELECT 'knowledge',    regexp_replace(image_url, '.*/object/public/knowledge/', '')      FROM ic_knowledge_posts WHERE image_url IS NOT NULL
  UNION ALL SELECT 'textbooks',    regexp_replace(file_url, '.*/object/public/textbooks/', '')       FROM ic_textbooks      WHERE file_url IS NOT NULL
  UNION ALL SELECT 'home-popup',   regexp_replace(file_url, '.*/object/public/home-popup/', '')      FROM ic_home_popups    WHERE file_url IS NOT NULL
)
DELETE FROM storage.objects o
USING (
  SELECT o2.id
  FROM storage.objects o2
  LEFT JOIN refs r ON r.bkt = o2.bucket_id AND r.path = o2.name
  WHERE o2.bucket_id IN ('recruitments','newsletters','claim-forms','card-news','sidebar-banner','knowledge','textbooks','home-popup')
    AND r.path IS NULL
) victims
WHERE o.id = victims.id;

SELECT 'Storage orphan cleanup done' AS status;



-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  ⑤ VACUUM — 삭제로 비워진 공간을 디스크에서 회수               ║
-- ║     (이걸 안 하면 row만 표시상 삭제, 실제 디스크 안 줄어듦)     ║
-- ║     ⚠️ VACUUM FULL은 락이 걸려서 잠시 쿼리가 멈출 수 있음       ║
-- ╚═══════════════════════════════════════════════════════════════╝

VACUUM FULL ic_page_visits;
VACUUM FULL ic_card_clicks;
VACUUM FULL ic_link_clicks;
VACUUM FULL ic_page_sessions;
VACUUM FULL ic_knowledge_comments;
VACUUM FULL ic_service_alerts;
VACUUM FULL ic_home_popups;
VACUUM FULL ic_kakao_stats;

-- 통계도 새로 (쿼리 최적화 도움)
ANALYZE;

-- 마지막 확인
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size_after;
SELECT bucket_id, count(*) AS files,
       pg_size_pretty(coalesce(sum((metadata->>'size')::bigint),0)) AS total_size
FROM storage.objects GROUP BY bucket_id ORDER BY 1;
