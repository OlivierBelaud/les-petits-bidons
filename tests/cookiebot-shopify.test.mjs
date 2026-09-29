import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../snippets/cookiebot-shopify.liquid', import.meta.url), 'utf8')
  .match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

function browser({ response = true, consent = {}, delayed = false, asyncWrite = false, failures = 0 } = {}) {
  const events = new Map();
  const timers = [];
  const writes = [];
  const callbacks = [];
  const warnings = [];
  const stored = { analytics: '', marketing: '', preferences: '', sale_of_data: 'no' };
  const privacy = {
    currentVisitorConsent: () => ({ ...stored }),
    setTrackingConsent(value, callback) {
      writes.push({ ...value });
      const done = () => {
        if (failures-- > 0) return callback(new Error('temporary failure'));
        for (const [key, allowed] of Object.entries(value)) stored[key] = allowed ? 'yes' : 'no';
        callback();
      };
      if (asyncWrite) callbacks.push(done);
      else done();
    },
  };
  const window = {
    Cookiebot: { hasResponse: response, consent: { statistics: false, marketing: false, preferences: false, ...consent } },
    Shopify: delayed ? undefined : { customerPrivacy: privacy },
    addEventListener: (name, fn) => events.set(name, fn),
  };
  const context = { window, console: { warn: (...args) => warnings.push(args) },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {} };
  vm.runInNewContext(source, context);
  return { window, privacy, writes, stored, callbacks, warnings,
    emit: name => events.get(name)?.(), tick: () => timers.shift()?.(), timers };
}

test('first visit does not fabricate consent', () => {
  const b = browser({ response: false });
  b.emit('CookiebotOnConsentReady');
  assert.equal(b.writes.length, 0);
});

for (const category of ['statistics', 'marketing', 'preferences']) {
  test(`only ${category} is enabled, even on Accept`, () => {
    const b = browser({ response: false });
    b.window.Cookiebot.hasResponse = true;
    b.window.Cookiebot.consent[category] = true;
    b.emit('CookiebotOnAccept');
    assert.deepEqual(b.writes, [{ analytics: category === 'statistics', marketing: category === 'marketing', preferences: category === 'preferences' }]);
    assert.equal(b.stored.sale_of_data, 'no');
  });
}

test('restores refusal on reload and deduplicates overlapping events', () => {
  const b = browser();
  b.emit('CookiebotOnConsentReady');
  b.emit('CookiebotOnDecline');
  assert.deepEqual(b.writes, [{ analytics: false, marketing: false, preferences: false }]);
});

test('late Shopify initialization receives latest choice', () => {
  const b = browser({ delayed: true, consent: { marketing: true } });
  b.window.Cookiebot.consent.marketing = false;
  b.emit('CookiebotOnDecline');
  b.window.Shopify = { loadFeatures(_features, done) { this.customerPrivacy = b.privacy; done(); } };
  for (let i = 0; i < 3; i++) b.tick();
  assert.deepEqual(b.writes, [{ analytics: false, marketing: false, preferences: false }]);
});

test('withdrawal during an in-flight acceptance is written last', () => {
  const b = browser({ asyncWrite: true, consent: { statistics: true, marketing: true, preferences: true } });
  b.window.Cookiebot.consent = { statistics: false, marketing: false, preferences: false };
  b.emit('CookiebotOnDecline');
  assert.equal(b.writes.length, 1);
  b.callbacks.shift()();
  b.callbacks.shift()();
  assert.deepEqual(b.writes[1], { analytics: false, marketing: false, preferences: false });
  assert.equal(b.stored.marketing, 'no');
});

test('missing Shopify API stops waiting and warns', () => {
  const b = browser({ delayed: true });
  for (let i = 0; i < 150; i++) b.tick();
  assert.equal(b.writes.length, 0);
  assert.equal(b.timers.length, 0);
  assert.ok(b.warnings.length > 0);
});

test('a failed acceptance retries the newer refusal instead of losing it', () => {
  const b = browser({ asyncWrite: true, failures: 1, consent: { marketing: true } });
  b.window.Cookiebot.consent.marketing = false;
  b.emit('CookiebotOnDecline');
  b.callbacks.shift()();
  b.tick();
  b.callbacks.shift()();
  assert.equal(b.writes.length, 2);
  assert.equal(b.stored.marketing, 'no');
});

test('repeated write errors stop after three retries and a later choice can recover', () => {
  const b = browser({ failures: 4 });
  for (let i = 0; i < 150; i++) b.tick();
  assert.equal(b.writes.length, 4);
  assert.equal(b.timers.length, 0);
  assert.equal(b.warnings.length, 1);
  b.emit('CookiebotOnDecline');
  assert.equal(b.stored.marketing, 'no');
});

test('async feature loading happens once and recovers from a loading error', () => {
  const b = browser({ delayed: true });
  let loaded;
  let loads = 0;
  b.window.Shopify = { loadFeatures(_features, callback) { loads++; loaded = callback; } };
  b.tick();
  b.tick();
  assert.equal(loads, 1);
  loaded(new Error('temporary loading failure'));
  b.tick();
  assert.equal(loads, 2);
  b.window.Shopify.customerPrivacy = b.privacy;
  loaded();
  assert.equal(b.stored.marketing, 'no');
});

test('synchronous Shopify exceptions do not break the page and retry the latest choice', () => {
  const b = browser({ response: false });
  const write = b.privacy.setTrackingConsent;
  b.privacy.setTrackingConsent = () => { throw new Error('unavailable'); };
  b.window.Cookiebot.hasResponse = true;
  assert.doesNotThrow(() => b.emit('CookiebotOnDecline'));
  b.privacy.setTrackingConsent = write;
  b.tick();
  assert.equal(b.stored.marketing, 'no');
});
