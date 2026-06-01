#!/usr/bin/env node
/**
 * v2.8.6: 보안 순찰 스캐너 (배포 전 자동 점검)
 *   휴리스틱 정적 분석으로 흔한 취약 패턴을 표시한다. 100% 보장이 아니라 "순찰 체크리스트"의 자동화 1차 필터.
 *   실행: node scripts/security-scan.mjs   (HIGH 발견 시 exit 1)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const findings = [];
const add = (sev, file, line, msg) => findings.push({ sev, file: file.replace(ROOT, '.'), line, msg });

function walk(dir, exts, cb) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    if (['node_modules', '.git', '.wrangler', 'scripts'].includes(e)) continue;
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, exts, cb);
    else if (exts.some(x => e.endsWith(x))) cb(p, readFileSync(p, 'utf8'));
  }
}
const lines = (t) => t.split('\n');

// 1) functions/api/admin/* 는 반드시 verifyAdmin
walk(join(ROOT, 'functions', 'api', 'admin'), ['.js'], (p, t) => {
  if (/onRequest(Post|Get|Delete|Put|Patch)/.test(t) && !/verifyAdmin/.test(t))
    add('HIGH', p, 0, 'admin 엔드포인트인데 verifyAdmin 호출이 없음');
});

// 2) 쓰기 엔드포인트(POST/DELETE/PUT)인데 인증 호출이 전혀 없음 (공개 의도면 무시 가능)
walk(join(ROOT, 'functions', 'api'), ['.js'], (p, t) => {
  if (/\/admin\//.test(p)) return;
  if (/onRequest(Post|Delete|Put|Patch)/.test(t) && !/(getUserFromRequest|verifyAdmin)/.test(t))
    add('REVIEW', p, 0, '쓰기 엔드포인트인데 인증(getUserFromRequest/verifyAdmin) 호출 없음 — 공개 의도인지 확인');
});

// 3) SQL 인젝션: prepare()에 ${} 보간 (화이트리스트가 아니면 위험)
walk(join(ROOT, 'functions'), ['.js'], (p, t) => {
  lines(t).forEach((ln, i) => {
    if (/\.prepare\s*\(\s*`[^`]*\$\{/.test(ln))
      add('REVIEW', p, i + 1, 'prepare()에 ${} 보간 — 컬럼/테이블이 화이트리스트인지 확인(아니면 인젝션)');
    // 동적 SQL 식별자 보간 (변수에 담긴 SQL 포함) — ORDER BY/GROUP BY/SET 뒤 ${}
    if (/\b(ORDER BY|GROUP BY)\s+\$\{/.test(ln) || /\bSET\s+\$\{/.test(ln))
      add('REVIEW', p, i + 1, '동적 SQL 식별자 보간(ORDER BY/SET 등) — 식별자 정제/화이트리스트 확인(아니면 인젝션)');
  });
});

// 4) 클라이언트 제공 파일에 시크릿 노출
walk(ROOT, ['.html'], (p, t) => {
  lines(t).forEach((ln, i) => {
    if (/sk-[A-Za-z0-9]{20,}/.test(ln)) add('HIGH', p, i + 1, 'OpenAI 시크릿키로 보이는 문자열이 클라이언트 파일에');
    if (/client_secret\s*[:=]\s*['"][A-Za-z0-9_\-]{12,}/.test(ln)) add('HIGH', p, i + 1, 'client_secret 하드코딩');
    if (/(VAPID_PRIVATE|KAKAO_REST_KEY|KAKAO_CLIENT_SECRET|ADMIN_SECRET)\s*[:=]\s*['"][^'"]{6,}/.test(ln)) add('HIGH', p, i + 1, '서버 전용 키가 클라이언트 파일에 하드코딩');
  });
});

// 5) CORS * + credentials 동시 (위험 조합)
walk(join(ROOT, 'functions'), ['.js'], (p, t) => {
  if (/Allow-Origin['"]?\s*:\s*['"]\*/.test(t) && /Allow-Credentials['"]?\s*:\s*['"]?true/.test(t))
    add('HIGH', p, 0, 'CORS Allow-Origin:* 와 Allow-Credentials:true 동시 사용');
});

// 6) eval / new Function
walk(ROOT, ['.js'], (p, t) => {
  lines(t).forEach((ln, i) => { if (/\beval\s*\(|\bnew Function\s*\(/.test(ln)) add('REVIEW', p, i + 1, 'eval/new Function 사용'); });
});

const order = { HIGH: 0, REVIEW: 1 };
findings.sort((a, b) => order[a.sev] - order[b.sev]);
const highs = findings.filter(f => f.sev === 'HIGH').length;
if (!findings.length) { console.log('✅ 보안 스캔: 발견된 항목 없음'); process.exit(0); }
console.log(`\n🛡  보안 순찰 — ${findings.length}건 (HIGH ${highs} / REVIEW ${findings.length - highs})\n`);
for (const f of findings) console.log(`[${f.sev}] ${f.file}${f.line ? ':' + f.line : ''}\n        ${f.msg}`);
console.log('');
process.exit(highs > 0 ? 1 : 0);
