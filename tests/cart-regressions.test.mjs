import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cartScript = await readFile(new URL('../assets/cart.js', import.meta.url), 'utf8');
const themeScript = await readFile(new URL('../assets/theme.js', import.meta.url), 'utf8');
const cartDrawer = await readFile(new URL('../sections/cluutch-cart-drawer.liquid', import.meta.url), 'utf8');

test('cart recommendation adds keep only the drawer notification', () => {
  assert.match(
    themeScript,
    /if \(!isCartRecommendation\) \{\s*this\.showCartSuccessMessage\(\);\s*\}/,
  );
  assert.match(cartScript, /onAjaxProductAdded\(event\) \{\s*this\.showStatus/);
});

test('the recommendation just added is removed after restoring preserved cards', () => {
  const restoreIndex = cartScript.indexOf(
    'this.restoreCartRecommendationBlocks(miniCart, preservedRecommendationBlocks);',
  );
  const removeIndex = cartScript.indexOf(
    'this.removeAddedRecommendationProduct(miniCart, event.cartRecommendationProductHandle);',
  );

  assert.notEqual(restoreIndex, -1);
  assert.ok(removeIndex > restoreIndex);
  assert.match(cartScript, /slider\?\.remove/);
});

test('recommendation removal updates Flickity without rebuilding the drawer', () => {
  const methodStart = cartScript.indexOf('  removeAddedRecommendationProduct(');
  const methodEnd = cartScript.indexOf('\n\n  getPrimaryCartScrollContainer(', methodStart);
  const methodSource = cartScript.slice(methodStart, methodEnd);
  const Harness = Function(`return class {${methodSource}}`)();

  const removed = [];
  const slider = { remove: (card) => removed.push(card) };
  const cards = [
    {
      dataset: { productHandle: 'lessive-10l' },
      closest: () => ({ carousel: { slider } }),
    },
    {
      dataset: { productHandle: 'autre-produit' },
      closest: () => ({ carousel: { slider } }),
    },
  ];
  const recommendations = { hidden: false, querySelector: () => cards[1] };
  const container = {
    querySelectorAll: () => cards,
    querySelector: () => recommendations,
  };

  new Harness().removeAddedRecommendationProduct(container, 'lessive-10l');

  assert.deepEqual(removed, [cards[0]]);
  assert.equal(recommendations.hidden, false);
});

test('compare-at prices alone do not generate a promo percentage badge', () => {
  const badgesStart = cartDrawer.indexOf('assign promo_pct = 0');
  const subscriptionStart = cartDrawer.indexOf(
    '{%- if item.selling_plan_allocation != null',
    badgesStart,
  );
  const badgeBlock = cartDrawer.slice(badgesStart, subscriptionStart);

  assert.doesNotMatch(badgeBlock, /shopify_pct/);
  assert.match(badgeBlock, /if promo_title != blank or promo_pct > 0/);
});

const productScript = await readFile(new URL('../assets/cluutch-main-product.js', import.meta.url), 'utf8');

test('product initialization preserves quantity selected before business scripts arrive', () => {
  const start = productScript.indexOf('  const hiddenQuantity =');
  const end = productScript.indexOf('\n});', start);
  const initialize = Function('document', 'window', productScript.slice(start, end));
  const quantity = { value: '1' };
  const radios = ['1', '2', '3'].map(value => ({ value, checked: value === '2', dataset: value === '2' ? { userSelected: 'true' } : {}, addEventListener() {} }));
  initialize({
    querySelector: selector => selector === '.hidden-quantity' ? quantity : radios.find(r => r.checked),
    querySelectorAll: () => radios,
  }, { location: { search: '' } });
  assert.equal(quantity.value, '2');
  assert.equal(radios[1].checked, true);
});

const purchaseGuard = await readFile(new URL('../snippets/cluutch-purchase-guard.liquid', import.meta.url), 'utf8');

test('early purchase is blocked until both product and direct-buy handlers are ready', () => {
  const handlers = {};
  const status = { hidden: true, textContent: '', append() {} };
  const form = { dataset: {}, matches: () => true, querySelector: () => status };
  Function('document', 'customElements', 'window', purchaseGuard.match(/<script>([\s\S]*?)<\/script>/)[1])({
    addEventListener: (name, fn) => { handlers[name] = fn; }, querySelector: () => null, createElement: () => ({}),
  }, { get: () => true }, { location: { href: '/product' } });
  for (const dataset of [{}, { productReady: 'true' }, { productReady: 'true', buyReady: 'true', variantPending: 'true' }, { productReady: 'true', buyReady: 'true', variantError: 'true' }]) {
    form.dataset = dataset;
    let prevented = false;
    let stopped = false;
    handlers.submit({ type: 'submit', target: form, preventDefault: () => { prevented = true; }, stopImmediatePropagation: () => { stopped = true; } });
    assert.equal(prevented, true);
    assert.equal(stopped, true);
    prevented = stopped = false;
    handlers.click({ type: 'click', target: { closest: () => ({ type: 'submit', form }) }, preventDefault: () => { prevented = true; }, stopImmediatePropagation: () => { stopped = true; } });
    assert.equal(prevented, true, 'direct-buy click must be blocked before its listener');
    assert.equal(stopped, true);
  }
});

test('ready purchase reads selected variant, quantity and subscription synchronously', () => {
  const handlers = {};
  const id = { value: 'old' }, qty = { value: '1' }, selling = { value: '' };
  const plan = { dataset: { variant: 'new' }, querySelector: s => s === '.button-subscribe' ? { checked: true } : { selectedOptions: [{ dataset: { planId: 'plan-2' } }] } };
  const section = { querySelector: s => s.includes('variant-button') ? { dataset: { variant: 'new' } } : { value: '2' }, querySelectorAll: () => [plan] };
  const form = { dataset: { productReady: 'true', buyReady: 'true' }, matches: () => true, closest: () => section,
    querySelector: s => s === '[name="id"]' ? id : s === '[name="quantity"]' ? qty : selling };
  Function('document', 'customElements', 'window', purchaseGuard.match(/<script>([\s\S]*?)<\/script>/)[1])({
    addEventListener: (name, fn) => { handlers[name] = fn; }, querySelector: () => null, createElement: () => ({}),
  }, { get: () => true }, { location: { href: '/product' } });
  handlers.submit({ type: 'submit', target: form, preventDefault: () => assert.fail('ready purchase blocked') });
  assert.deepEqual([id.value, qty.value, selling.value], ['new', '2', 'plan-2']);
});


test('quantity URL overrides an untouched server default', () => {
  const start = productScript.indexOf('  const hiddenQuantity =');
  const end = productScript.indexOf('\n});', start);
  const initialize = Function('document', 'window', productScript.slice(start, end));
  const quantity = { value: '1' };
  const radios = ['1', '2'].map(value => ({ value, checked: value === '1', dataset: {}, addEventListener() {} }));
  initialize({ querySelector: () => quantity, querySelectorAll: () => radios }, { location: { search: '?quantity=2' } });
  assert.equal(quantity.value, '2');
  assert.equal(radios[0].checked, false);
});

const variantSnippet = await readFile(new URL('../snippets/cluutch-product-variant.liquid', import.meta.url), 'utf8');

test('a stalled variant request reaches a recoverable error instead of blocking purchases forever', async () => {
  const start = variantSnippet.indexOf('  function loadProductVariant(');
  const end = variantSnippet.indexOf("  document.querySelectorAll('.variant-button').forEach", start);
  let deadline;
  const status = { append() {}, hidden: true };
  const form = { dataset: {}, querySelector: () => status };
  const document = {
    getElementById: () => form,
    querySelector: () => ({ classList: { add() {}, remove() {} } }),
    createElement: () => ({ addEventListener() {} }),
  };
  const fetch = (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const load = Function('document', 'fetch', 'window', 'AbortController', 'setTimeout', 'clearTimeout', 'console',
    `let variantRequest; let variantRequestId=0; ${variantSnippet.slice(start,end)}; return loadProductVariant;`
  )(document, fetch, {}, AbortController, fn => { deadline = fn; return 1; }, () => {}, { error() {} });
  load({ dataset: { variant: '123' } });
  assert.equal(typeof deadline, 'function', 'request needs a finite deadline');
  deadline();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(form.dataset.variantPending, undefined);
  assert.equal(form.dataset.variantError, 'true');
  assert.equal(status.hidden, false);
});

for (const subscribed of [true, false]) {
  test(`page load preserves the active ${subscribed ? 'subscription' : 'one-time'} choice despite inactive variants`, () => {
    const start = productScript.indexOf('function updateSellingPlan()');
    const end = productScript.indexOf("onProductReady(() => {\n  const form", start);
    const sellingPlan = { value: '' };
    const loadListeners = [];
    const makeSelector = (display, subscribe) => {
      const nodes = {
        '.button-one-time': { checked: !subscribe, addEventListener() {} },
        '.button-subscribe': { checked: subscribe, addEventListener() {} },
        '.plan-button-select': { selectedIndex: 0, options: [{ dataset: { planId: 'plan-42' } }], addEventListener() {} },
        '.plan-button-select-wrapper': { style: {} },
      };
      return { style: { display }, querySelector: key => nodes[key] };
    };
    const selectors = [makeSelector('block', subscribed), makeSelector('none', false)];
    Function('document', 'window', 'getComputedStyle', 'setTimeout', 'console', productScript.slice(start, end))({
      querySelectorAll: () => selectors,
      querySelector: () => sellingPlan,
    }, { addEventListener: (event, callback) => { if (event === 'load') loadListeners.push(callback); } },
    element => element.style, callback => callback(), { log() {} });
    const expected = subscribed ? 'plan-42' : '';
    assert.equal(sellingPlan.value, expected, 'active selection should initialize correctly');
    loadListeners.forEach(callback => callback());
    assert.equal(sellingPlan.value, expected, 'inactive one-time choices must not erase the active subscription at load');
    assert.equal(selectors[1].querySelector('.plan-button-select-wrapper').style.display, 'none');
    if (!subscribed) {
      assert.equal(selectors[0].querySelector('.plan-button-select-wrapper').style.display, 'none');
    }
  });
}
