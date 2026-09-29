import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const markup = await readFile(new URL('../snippets/cluutch-product-variant.liquid', import.meta.url), 'utf8');
const source = markup.match(/<script>([\s\S]*?)<\/script>/)[1];

function gallery({ readyState = 'loading', width = 390, slides = 3, swiperReady = false } = {}) {
  const document = new EventTarget();
  document.readyState = readyState;
  function makeSlides(count) {
    return Array.from({ length: count }, (_, index) => {
      const slide = { hydrated: index === 0, copies: 0, image: null };
      const template = {
        content: { cloneNode() {
          const image = { loading: 'lazy', srcset: `variant-image-${index} 720w`, alt: `Image ${index}` };
          return { querySelector: () => image };
        } },
        replaceWith(fragment) {
          slide.hydrated = true;
          slide.copies++;
          slide.image = fragment.querySelector('img');
        },
      };
      slide.querySelector = () => slide.hydrated ? null : template;
      return slide;
    });
  }
  let currentSlides = makeSlides(slides);
  document.querySelectorAll = (selector) => selector === '.imgswiper .swiper-slide' ? currentSlides : [];
  const instances = [];
  let now = 0;
  const timers = [];
  const context = vm.createContext({
    document,
    window: { innerWidth: width },
    console: { log() {} },
    setTimeout(callback, delay) { timers.push({ callback, due: now + delay }); },
  });
  function installSwiper() {
    context.Swiper = function (selector, options) {
      this.destroy = () => { this.destroyed = true; };
      this.slides = currentSlides;
      this.activeIndex = 0;
      this.selector = selector;
      this.options = options;
      instances.push(this);
      options.on?.init?.(this);
    };
  }
  if (swiperReady) installSwiper();
  vm.runInContext(source, context);
  return {
    instances,
    installSwiper,
    get slides() { return currentSlides; },
    replaceVariant(count) {
      currentSlides = makeSlides(count);
      vm.runInContext('initializeSliders()', context);
    },
    advance(ms) {
      const end = now + ms;
      while (timers.length && timers[0].due <= end) {
        const timer = timers.shift();
        now = timer.due;
        timer.callback();
      }
      now = end;
    },
    finishParsing() {
      document.readyState = 'interactive';
      document.dispatchEvent(new Event('DOMContentLoaded'));
    },
  };
}

test('gallery still initializes when deferred Swiper arrives after six seconds', () => {
  const page = gallery();
  page.advance(6000);
  assert.equal(page.instances.length, 0);
  page.installSwiper();
  page.finishParsing();
  assert.equal(page.instances.length, 1);
  assert.equal(page.instances[0].selector, '.imgswiper');
  assert.equal(page.instances[0].options.loop, true);
  page.finishParsing();
  assert.equal(page.instances.length, 1, 'initial gallery listener must run only once');
});

test('a script loaded after DOM readiness initializes main and thumbnail sliders immediately', () => {
  const page = gallery({ readyState: 'complete', width: 1440, swiperReady: true });
  assert.deepEqual(page.instances.map(({ selector }) => selector), ['.thumb-swiper', '.imgswiper']);
});

test('a single-image gallery stays static after DOM readiness', () => {
  const page = gallery({ slides: 1 });
  page.advance(6000);
  page.installSwiper();
  page.finishParsing();
  assert.equal(page.instances.length, 0);
});


test('only first image and its loop neighbours hydrate at startup', () => {
  const page = gallery({ readyState: 'complete', slides: 8, swiperReady: true });
  assert.deepEqual(page.slides.map((slide) => slide.hydrated), [true, true, false, false, false, false, false, true]);
  assert.equal(page.slides[1].image.loading, 'eager');
  assert.equal(page.slides[1].image.srcset, 'variant-image-1 720w');
  assert.equal(page.slides[1].image.alt, 'Image 1');
});

test('jumping slides hydrates the destination and neighbours exactly once, including loop wrap', () => {
  const page = gallery({ readyState: 'complete', slides: 8, swiperReady: true });
  const swiper = page.instances[0];
  swiper.activeIndex = 4;
  swiper.options.on.slideChange(swiper);
  swiper.options.on.beforeTransitionStart(swiper);
  assert.deepEqual(page.slides.map((slide) => slide.hydrated), [true, true, false, true, true, true, false, true]);
  assert.equal(page.slides[4].copies, 1);
  swiper.activeIndex = 7;
  swiper.options.on.slideChange(swiper);
  assert.equal(page.slides[6].hydrated, true);
  assert.equal(page.slides[0].copies, 0);
});

test('variant replacement hydrates only the new gallery and destroys previous sliders', () => {
  const page = gallery({ readyState: 'complete', width: 1440, slides: 8, swiperReady: true });
  const oldSlides = page.slides;
  const oldInstances = [...page.instances];
  page.replaceVariant(6);
  assert.ok(oldInstances.every((swiper) => swiper.destroyed));
  assert.deepEqual(page.slides.map((slide) => slide.hydrated), [true, true, false, false, false, true]);
  assert.equal(oldSlides[2].hydrated, false);
});
