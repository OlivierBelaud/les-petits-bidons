import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const vendor = await readFile(new URL('../assets/vendor.js', import.meta.url), 'utf8');
const source = vendor.slice(vendor.indexOf('class LazyImage extends HTMLImageElement'));

function classes() {
  const values = new Set();
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    contains: name => values.has(name),
    toggle(name, enabled) { enabled ? values.add(name) : values.delete(name); },
  };
}

function fixture({ intersection = true, complete = false, naturalWidth = 0 } = {}) {
  class TrackedTarget extends EventTarget {
    listeners = new Map();
    addEventListener(type, callback, options) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(callback);
      super.addEventListener(type, callback, options);
    }
    removeEventListener(type, callback, options) {
      this.listeners.get(type)?.delete(callback);
      super.removeEventListener(type, callback, options);
    }
    listenerCount(type) { return this.listeners.get(type)?.size || 0; }
  }
  const window = new TrackedTarget();
  const mutations = [], intersections = [];
  class Observer {
    constructor(callback) { this.callback = callback; }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
  }
  class MutationObserver extends Observer {
    constructor(callback) { super(callback); mutations.push(this); }
  }
  class IntersectionObserver extends Observer {
    constructor(callback) { super(callback); intersections.push(this); }
  }
  const media = { classList: classes() };
  class Image extends TrackedTarget {
    constructor() {
      super();
      this.classList = classes();
      this.complete = complete;
      this.naturalWidth = naturalWidth;
      this.parent = media;
    }
    closest() { return this.parent; }
  }
  let Constructor;
  vm.runInNewContext(source, {
    HTMLImageElement: Image, window, MutationObserver,
    ...(intersection ? { IntersectionObserver } : {}),
    customElements: { define(name, value) { Constructor = value; } },
  });
  const image = new Constructor();
  image.connectedCallback();
  return { image, media, window, mutations, intersections,
    visible(value) { intersections.at(-1).callback([{ isIntersecting: value }]); },
    loading: () => media.classList.contains('loading'),
  };
}

test('pending image retains loading presentation, animates only while intersecting', () => {
  const f = fixture();
  assert.equal(f.loading(), true);
  assert.equal(f.media.classList.contains('loading-in-view'), false);
  f.visible(true);
  assert.equal(f.media.classList.contains('loading-in-view'), true);
  f.visible(false);
  assert.equal(f.media.classList.contains('loading-in-view'), false);
  assert.equal(f.loading(), true);
  f.image.dispatchEvent(new Event('load'));
  assert.equal(f.loading(), false);
  assert.equal(f.image.classList.contains('loaded'), true);
  assert.equal(f.intersections[0].disconnected, true);
  f.visible(true);
  assert.equal(f.media.classList.contains('loading-in-view'), false);
});

test('cached image is revealed without waiting for another load event', () => {
  const f = fixture({ complete: true, naturalWidth: 720 });
  assert.equal(f.intersections.length, 0, 'already loaded images need no viewport observer');
  assert.equal(f.loading(), false);
  assert.equal(f.image.classList.contains('loaded'), true);
});

test('error clears loading overlay and retry can load normally', () => {
  const f = fixture();
  f.image.complete = true;
  f.image.dispatchEvent(new Event('error'));
  assert.equal(f.loading(), false);
  assert.equal(f.image.classList.contains('loaded'), false);
  f.image.complete = false;
  f.mutations[0].callback([{ attributeName: 'src' }]);
  assert.equal(f.loading(), true);
  f.image.dispatchEvent(new Event('load'));
  assert.equal(f.loading(), false);
});

test('source changes do not hide an already displayed image', () => {
  const f = fixture({ complete: true, naturalWidth: 720 });
  f.image.complete = false;
  f.mutations[0].callback([{ attributeName: 'src' }]);
  f.window.dispatchEvent(new Event('resize'));
  assert.equal(f.loading(), false);
  f.image.dispatchEvent(new Event('error'));
  assert.equal(f.loading(), false);
});

test('disconnect removes observers and handlers, reconnect follows new media', () => {
  const f = fixture();
  f.visible(true);
  f.image.disconnectedCallback();
  assert.equal(f.window.listenerCount('resize'), 0);
  assert.equal(f.image.listenerCount('load'), 0);
  assert.equal(f.image.listenerCount('error'), 0);
  assert.equal(f.mutations[0].disconnected, true);
  assert.equal(f.intersections[0].disconnected, true);
  assert.equal(f.loading(), false);
  assert.equal(f.media.classList.contains('loading-in-view'), false);
  f.image.dispatchEvent(new Event('load'));
  f.window.dispatchEvent(new Event('resize'));
  f.visible(true); // An already queued observer callback after removal.
  assert.equal(f.image.classList.contains('loaded'), false);
  assert.equal(f.loading(), false);
  const nextMedia = { classList: classes() };
  f.image.parent = nextMedia;
  f.image.connectedCallback();
  assert.equal(f.window.listenerCount('resize'), 1);
  assert.equal(f.image.listenerCount('load'), 1);
  assert.equal(f.intersections.at(-1).target, nextMedia);
  assert.equal(nextMedia.classList.contains('loading'), true);
  assert.equal(f.media.classList.contains('loading'), false);
});

test('repeated connection, resize and source changes do not multiply listeners', () => {
  const f = fixture();
  let completions = 0;
  const finish = f.image.finishLoading.bind(f.image);
  f.image.finishLoading = success => { completions++; finish(success); };
  f.image.connectedCallback();
  for (let i = 0; i < 10; i++) {
    f.window.dispatchEvent(new Event('resize'));
    f.mutations[0].callback([{ attributeName: 'src' }]);
  }
  f.image.dispatchEvent(new Event('load'));
  assert.equal(completions, 1);
  assert.equal(f.mutations.length, 1);
  assert.equal(f.intersections.length, 1);
});

test('without IntersectionObserver image load still completes with static indicator', () => {
  const f = fixture({ intersection: false });
  assert.equal(f.loading(), true);
  assert.equal(f.media.classList.contains('loading-in-view'), false);
  f.image.dispatchEvent(new Event('load'));
  assert.equal(f.loading(), false);
  f.image.disconnectedCallback();
});

test('missing media wrapper is harmless', () => {
  const f = fixture();
  f.image.disconnectedCallback();
  f.image.parent = null;
  f.image.connectedCallback();
  f.image.disconnectedCallback();
});
