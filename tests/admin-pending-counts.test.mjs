import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/admin/pending-counts.js';

function request(secret) {
  const headers = new Headers();
  if (secret) headers.set('x-admin-secret', secret);
  return new Request('https://example.test/api/admin/pending-counts', { headers });
}

test('pending counts requires admin authentication', async () => {
  let prepared = 0;
  const response = await onRequestGet({
    request: request(''),
    env: {
      ADMIN_SECRET: 'admin-secret',
      DB: { prepare() { prepared += 1; throw new Error('must not query'); } },
    },
  });

  assert.equal(response.status, 401);
  assert.equal(prepared, 0);
});

test('pending counts returns one-statement aggregate', async () => {
  const statements = [];
  const response = await onRequestGet({
    request: request('admin-secret'),
    env: {
      ADMIN_SECRET: 'admin-secret',
      DB: {
        prepare(sql) {
          statements.push(sql);
          return {
            async first() {
              return { recruitments: 2, lectures: 3, meetings: 4 };
            },
          };
        },
      },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /ic_recruitments/);
  assert.match(statements[0], /ic_lectures/);
  assert.match(statements[0], /ic_meetings/);
  assert.deepEqual(await response.json(), {
    ok: true,
    recruitments: 2,
    lectures: 3,
    meetings: 4,
    total: 9,
  });
});

test('pending counts normalizes missing values to zero', async () => {
  const response = await onRequestGet({
    request: request('admin-secret'),
    env: {
      ADMIN_SECRET: 'admin-secret',
      DB: {
        prepare() {
          return { async first() { return null; } };
        },
      },
    },
  });

  assert.deepEqual(await response.json(), {
    ok: true,
    recruitments: 0,
    lectures: 0,
    meetings: 0,
    total: 0,
  });
});
