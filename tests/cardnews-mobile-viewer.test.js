const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractFunction(input, name) {
  const start = input.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const bodyStart = input.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = bodyStart; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) return input.slice(start, i + 1);
  }
  throw new Error(`Could not extract function ${name}`);
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('mobile viewer CSS and modal backdrop regressions stay fixed', () => {
  assert(!source.includes('.cn-viewport { aspect-ratio: 16 / 9'), 'legacy 16:9 mobile viewport must be removed');

  const mobileViewport = source.match(/body\.ic-mobile \.cn-viewport\s*\{([^}]*)\}/);
  assert(mobileViewport, 'mobile viewport rule must exist');
  assert.match(mobileViewport[1], /aspect-ratio:\s*auto\s*!important/);
  assert.match(mobileViewport[1], /max-height:\s*none\s*!important/);

  const mobileStage = source.match(/body\.ic-mobile \.cn-stage\s*\{([^}]*)\}/);
  assert(mobileStage, 'mobile stage rule must exist');
  assert.match(mobileStage[1], /touch-action:\s*none/);

  const modalTag = source.match(/<div class="cn-modal" id="cn-modal"[^>]*>/);
  assert(modalTag, 'card-news modal tag must exist');
  assert(!/onclick=/.test(modalTag[0]), 'modal backdrop must not use click.target inline close');

  const popupRule = source.indexOf('\n    #home-popup-overlay {');
  assert(popupRule >= 0, 'home popup rule must exist');
  const beforePopup = source.slice(Math.max(0, popupRule - 260), popupRule);
  assert(!/\.(?:cn-modal|nl-viewer-overlay|kn-modal-overlay)\s*,/.test(beforePopup), 'modal selectors must not be attached to home popup rule');
  assert(!/\.cn-modal\s*,[\s\S]{0,300}z-index:\s*9995/.test(source), 'card-news modal must not inherit z-index 9995');

  assert(source.includes("modal.addEventListener('pointerdown'"));
  assert(source.includes("modal.addEventListener('pointerup'"));
  assert(source.includes("!document.body.classList.contains('ic-mobile')"), 'mobile backdrop close must be disabled');
  assert(source.includes("modal.addEventListener('pointercancel'"));
});

test('touch gestures use stage while desktop inputs remain on viewport', () => {
  for (const event of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    assert(source.includes(`stage.addEventListener('${event}'`), `${event} must bind to stage`);
  }
  for (const event of ['wheel', 'dblclick', 'mousedown']) {
    assert(source.includes(`vp.addEventListener('${event}'`), `${event} must remain on viewport`);
    assert(!source.includes(`stage.addEventListener('${event}'`), `${event} must not bind to stage`);
  }

  assert(source.includes("t.closest('.cn-nav, .cn-zoom-ctrl, button, a, iframe')"));
  assert.match(source, /stage\.addEventListener\('touchcancel'[\s\S]*?lockOff\(\);[\s\S]*?\}\);/);
  assert(source.includes('window._cnGestureReset = function'));

  const teardown = extractFunction(source, '_cnTeardown');
  assert(teardown.includes('window._cnGestureReset'));
  assert(source.includes('Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4'));
  assert.match(source, /if \(!cnCurImg\(\)\)[\s\S]{0,260}sy = t\.clientY; dx = 0; dy = 0;/);

  const update = extractFunction(source, 'updateCarouselUI');
  assert(update.includes("document.querySelector('.cn-stage')"));
  assert(update.includes("_stage.style.touchAction = _isPdf ? 'auto' : 'none'"));
});

test('scroll lock, history and guest-news gate are guarded and reversible', () => {
  const open = extractFunction(source, 'openCardNewsModal');
  const lock = extractFunction(source, '_cnLockScroll');
  const unlock = extractFunction(source, '_cnUnlockScroll');

  assert(open.includes("m.classList.contains('open')"), 'modal re-entry guard must exist');
  assert(open.indexOf("m.classList.contains('open')") < open.indexOf('_cnLockScroll()'));
  assert(open.includes("document.body.classList.contains('ic-mobile')"));
  assert(open.includes('!(history.state && history.state.cnOpen)'));
  assert(open.includes('history.pushState({ cnOpen: 1 }'));

  assert(lock.includes('_cnPrevBodyStyle = {'));
  for (const prop of ['position', 'top', 'width', 'overflow']) {
    assert(lock.includes(`${prop}: b.style.${prop}`), `body ${prop} must be saved`);
    assert(unlock.includes(`b.style.${prop} = p.${prop}`), `body ${prop} must be restored`);
  }
  assert(lock.includes("if (b.classList.contains('ic-mobile'))"));
  assert.equal(count(lock, "b.style.position = 'fixed'"), 1, 'fixed scroll lock must have one mobile-only assignment');

  assert(!/if\s*\(\s*_q\.get\(['"]news['"]\)\s*\)\s*postGateBypass\s*=\s*true/.test(source));
  for (const token of ['window._icGateRestore', 'window._icGateShouldShow', 'window._icGateForce', '_icGateNewsTimer']) {
    assert(source.includes(token), `${token} must exist`);
  }
  const gateStart = source.indexOf('var postGateBypass=false, newsPending=false;');
  const gateEnd = source.indexOf("fetch('/api/stats'", gateStart);
  const gate = source.slice(gateStart, gateEnd);
  assert(gateStart >= 0 && gateEnd > gateStart, 'login gate script must be found');
  assert(!/_q\.get\(['"]meeting['"]\)/.test(gate), 'meeting links must not bypass the login gate');
});

test('invalid news id restores the login gate without opening a modal', () => {
  let opened = 0;
  let restored = 0;
  const sandbox = {
    URLSearchParams,
    location: { search: '?news=missing' },
    cardNewsState: { sets: [{ set_id: 'valid' }] },
    openCardNewsModal: () => { opened++; },
    clearTimeout: () => {},
  };
  sandbox.window = sandbox;
  sandbox._icGateRestore = () => { restored++; };
  vm.createContext(sandbox);
  vm.runInContext(`${extractFunction(source, 'openCardNewsFromURL')}; openCardNewsFromURL();`, sandbox);
  assert.equal(opened, 0);
  assert.equal(restored, 1);
});

test('valid news id confirms guest mode, clears timeout and opens shared modal', () => {
  let opened = null;
  let cleared = null;
  const sandbox = {
    URLSearchParams,
    location: { search: '?news=valid' },
    cardNewsState: { sets: [{ set_id: 'valid' }] },
    openCardNewsModal: (idx, sourceName) => { opened = [idx, sourceName]; },
    clearTimeout: (timer) => { cleared = timer; },
    _icGateNewsTimer: 77,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${extractFunction(source, 'openCardNewsFromURL')}; openCardNewsFromURL();`, sandbox);
  assert.equal(sandbox._cnFromShareLink, true);
  assert.equal(cleared, 77);
  assert.deepEqual(opened, [0, 'shared']);
});

test('narrow deep link syncs the mobile class before scroll lock and history push', () => {
  const classes = new Set();
  const modalClasses = new Set();
  let pushed = null;
  let lockedWithMobileClass = false;
  const bodyClassList = {
    contains: (name) => classes.has(name),
    add: (name) => classes.add(name),
  };
  const modal = {
    classList: {
      contains: (name) => modalClasses.has(name),
      add: (name) => modalClasses.add(name),
    },
  };
  const sandbox = {
    document: { body: { classList: bodyClassList }, getElementById: () => modal },
    location: { href: 'https://example.test/?news=valid' },
    history: { state: null, pushState: (...args) => { pushed = args; } },
    showCardNewsSet: () => {},
    _cnLockScroll: () => { lockedWithMobileClass = classes.has('ic-mobile'); },
    cardNewsState: { sets: [{ title: '' }] },
    matchMedia: () => ({ matches: true }),
    _cnxLoaded: 1,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext([
    extractFunction(source, '_cnSyncMobileClass'),
    extractFunction(source, 'openCardNewsModal'),
    "openCardNewsModal(0, 'shared');",
  ].join('\n'), sandbox);
  assert(classes.has('ic-mobile'));
  assert.equal(lockedWithMobileClass, true);
  assert.deepEqual(pushed, [{ cnOpen: 1 }, '', 'https://example.test/?news=valid']);
});

test('teardown restores the gate and clears shared-link state', () => {
  let removed = false;
  let restored = 0;
  let unlocked = 0;
  let zoomReset = 0;
  let gestureReset = 0;
  const modal = {
    classList: {
      contains: (name) => name === 'open' && !removed,
      remove: (name) => { if (name === 'open') removed = true; },
    },
  };
  const sandbox = {
    document: { getElementById: () => modal },
    _cnUnlockScroll: () => { unlocked++; },
    cnZoomReset: () => { zoomReset++; },
    _cnFromShareLink: true,
    _icGateRestore: () => { restored++; },
    _cnGestureReset: () => { gestureReset++; },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${extractFunction(source, '_cnTeardown')}; this.result = _cnTeardown();`, sandbox);
  assert.equal(sandbox.result, true);
  assert.equal(removed, true);
  assert.equal(unlocked, 1);
  assert.equal(zoomReset, 1);
  assert.equal(gestureReset, 1);
  assert.equal(restored, 1);
  assert.equal(sandbox._cnFromShareLink, false);
});
