const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadKakaoBlastModule(sendMemoToMember) {
  const source = fs.readFileSync(path.join(root, 'functions/_lib/kakao-blast.js'), 'utf8');
  const script = source
    .replace("import { sendMemoToMember } from './kakao-msg.js';", 'const sendMemoToMember = __sendMemoToMember;')
    .replace(/\bexport\s+/g, '') + `
this.__exports = {
  KAKAO_BLAST_TABLES,
  buildPostingKakaoBlast,
  sendPostingKakaoBlast,
};`;
  const sandbox = { console, Date, URL, __sendMemoToMember: sendMemoToMember };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return sandbox.__exports;
}

function makeD1Env() {
  const calls = [];
  let blastUpdate = null;
  const env = {
    KAKAO_REST_KEY: 'rest-key',
    DB: {
      prepare(sql) {
        const rec = {
          sql,
          values: [],
          bind(...values) {
            rec.values = values;
            return rec;
          },
          run() {
            if (/UPDATE ic_recruitments SET kakao_blast_sent_at/.test(sql)) {
              blastUpdate = { sql, values: rec.values };
            }
            return Promise.resolve({ meta: { changes: 1 } });
          },
          first() {
            if (/SELECT kakao_blast_sent_at/.test(sql)) {
              return Promise.resolve({ kakao_blast_sent_at: null });
            }
            return Promise.resolve(null);
          },
          all() {
            if (/FROM ic_members/.test(sql)) {
              return Promise.resolve({
                results: [
                  { id: 1, kakao_access_token: 'a', kakao_refresh_token: 'r1', kakao_token_expires: '2099-01-01T00:00:00.000Z' },
                  { id: 2, kakao_access_token: 'b', kakao_refresh_token: 'r2', kakao_token_expires: '2099-01-01T00:00:00.000Z' },
                ],
              });
            }
            return Promise.resolve({ results: [] });
          },
        };
        calls.push(rec);
        return rec;
      },
    },
  };
  return { env, calls, getBlastUpdate: () => blastUpdate };
}

(async () => {
  const sentPayloads = [];
  const mod = loadKakaoBlastModule(async (_env, member, payload) => {
    sentPayloads.push({ memberId: member.id, payload });
    return member.id === 2 ? { ok: false, revoked: true, error: 'send_403' } : { ok: true };
  });

  assert.strictEqual(mod.KAKAO_BLAST_TABLES.recruit, 'ic_recruitments');
  const built = mod.buildPostingKakaoBlast({
    adType: 'recruit',
    adId: 123,
    title: '테스트 채용',
    subtitle: '테스트 회사',
    fileUrl: '/api/files/sample.png',
    fileType: 'image',
  });
  assert(built.title.includes('채용공고'), 'message title should name the posting type');
  assert(built.description.includes('테스트 채용'), 'message body should include posting title');
  assert.strictEqual(built.image, 'https://insureconnect.co.kr/api/files/sample.png');
  assert(built.url.includes('https://insureconnect.co.kr/?recruit=123'), 'message should link to the recruit viewer');

  const { env, calls, getBlastUpdate } = makeD1Env();
  const result = await mod.sendPostingKakaoBlast(env, {
    table: 'ic_recruitments',
    adType: 'recruit',
    adId: 123,
    title: '테스트 채용',
    subtitle: '테스트 회사',
    fileUrl: '/api/files/sample.png',
    fileType: 'image',
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.total, 2);
  assert.strictEqual(result.sent, 1);
  assert.strictEqual(result.failed, 1);
  assert.strictEqual(result.revoked, 1);
  assert.strictEqual(sentPayloads.length, 2, 'selected option should send to all Kakao opt-in members');
  assert(
    calls.some((c) => /ALTER TABLE ic_recruitments ADD COLUMN kakao_blast_sent_at/.test(c.sql)),
    'helper should ensure idempotency tracking columns',
  );
  assert(
    calls.some((c) => /UPDATE ic_members SET alert_optin = 0 WHERE id = \?/.test(c.sql) && c.values[0] === 2),
    'revoked Kakao members should be opted out',
  );
  const update = getBlastUpdate();
  assert(update, 'helper should record blast result on the posting');
  assert.strictEqual(update.values[1], 1, 'sent count should be recorded');
  assert.strictEqual(update.values[2], 1, 'failed count should be recorded');
  assert.strictEqual(update.values[3], 1, 'revoked count should be recorded');

  for (const file of [
    'functions/api/recruitments/[id].js',
    'functions/api/lectures/[id].js',
    'functions/api/meetings/[id].js',
  ]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert(source.includes('sendPostingKakaoBlast'), `${file} should trigger Kakao blast on approval`);
    assert(source.includes('kakao_blast_enabled'), `${file} should read the selected Kakao blast option flag`);
  }

  console.log('kakao blast option activation tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
