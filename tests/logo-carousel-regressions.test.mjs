import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const logoCarouselScript = await readFile(
  new URL('../assets/cluutch-logos.js', import.meta.url),
  'utf8',
);

test('logo carousels rewind without enabling Swiper loop mode', () => {
  const carousels = [];
  const context = {
    Swiper: function Swiper(selector, options) {
      carousels.push({ selector, options });
    },
  };

  vm.runInNewContext(logoCarouselScript, context);

  assert.equal(carousels.length, 2);
  assert.deepEqual(
    carousels.map(({ selector }) => selector),
    ['.logo-swiper', '.logo-swiper-text'],
  );

  for (const { options } of carousels) {
    assert.equal(options.loop, false);
    assert.equal(options.rewind, true);
    assert.equal(options.autoplay.delay, 2500);
  }
});
