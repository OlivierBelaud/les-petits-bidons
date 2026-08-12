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
