import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const productScript = read('../assets/les56-product.js');
const themeScript = read('../assets/theme.js');
const sectionSource = read('../sections/les56-main-product.liquid');
const productStyles = read('../assets/les56-product.css');
const productTemplate = JSON.parse(read('../templates/product.json').replace(/^\/\*[\s\S]*?\*\//, ''));

// The real theme ProductForm (cart request, error markup, drawer events) runs next to the section script.
const productFormStart = themeScript.indexOf('function getCurrentCartItemCount()');
const productFormEnd = themeScript.indexOf('customElements.define("product-form", ProductForm, { extends: "form" });');
const productFormScript = themeScript.slice(productFormStart, productFormEnd) +
  'customElements.define("product-form", ProductForm, { extends: "form" });';

// ---------------------------------------------------------------------------
// Minimal DOM: enough of the platform for the section entrypoint and ProductForm.
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'link', 'meta', 'source']);
const kebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function parseCompound(text) {
  const compound = { tag: null, id: null, classes: [], attrs: [] };
  const pattern = /^([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]/g;
  let match;
  while ((match = pattern.exec(text))) {
    if (match[1]) compound.tag = match[1].toLowerCase();
    else if (match[2]) compound.id = match[2];
    else if (match[3]) compound.classes.push(match[3]);
    else compound.attrs.push([match[4].toLowerCase(), match[5]]);
  }
  return compound;
}

function parseSelector(selector) {
  return selector.split(',').map((part) => part.trim().split(/\s+/).map(parseCompound));
}

function matchesCompound(element, compound) {
  if (element.nodeType !== 1) return false;
  if (compound.tag && element.localName !== compound.tag) return false;
  if (compound.id && element.getAttribute('id') !== compound.id) return false;
  for (const name of compound.classes) if (!element.classList.contains(name)) return false;
  for (const [name, value] of compound.attrs) {
    const actual = element.getAttribute(name);
    if (actual === null) return false;
    if (value !== undefined && actual !== value) return false;
  }
  return true;
}

function matchesComplex(element, compounds) {
  if (!matchesCompound(element, compounds[compounds.length - 1])) return false;
  let index = compounds.length - 2;
  let ancestor = element.parentNode;
  while (index >= 0 && ancestor) {
    if (ancestor.nodeType === 1 && matchesCompound(ancestor, compounds[index])) index -= 1;
    ancestor = ancestor.parentNode;
  }
  return index < 0;
}

function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const pattern = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let match;
  while ((match = pattern.exec(html))) {
    const current = stack[stack.length - 1];
    if (match[1]) {
      const tag = match[1].toLowerCase();
      while (stack.length > 1 && stack.pop().tag !== tag);
    } else if (match[2]) {
      const tag = match[2].toLowerCase();
      const attrs = {};
      const attrPattern = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let attr;
      while ((attr = attrPattern.exec(match[3] || ''))) {
        attrs[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4] ?? '';
      }
      const node = { tag, attrs, children: [] };
      current.children.push(node);
      if (!VOID_TAGS.has(tag) && !match[4]) stack.push(node);
    } else if (match[5] && match[5].trim()) {
      current.children.push({ text: match[5].trim() });
    }
  }
  return root.children;
}

function createBrowser({ url = 'https://shop.test/products/lessive?variant=101&preview_theme_id=186855653754', resizeObserver = false, frames = false } = {}) {
  const registry = new Map();
  const mutationObservers = new Set();
  const intersectionObservers = [];
  const resizeObservers = [];
  const fetchCalls = [];
  const published = [];
  const windowListeners = [];
  // With `frames`, animation frames wait for runFrames() like a real browser; otherwise they run at once.
  const pendingFrames = new Map();
  let lastFrame = 0;
  let pending = null;
  let document;

  class FakeText {
    constructor(text) {
      this.nodeType = 3;
      this.data = text;
      this.parentNode = null;
    }
    get textContent() { return this.data; }
    cloneNode() { return new FakeText(this.data); }
  }

  class FakeEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.bubbles = Boolean(init.bubbles);
      this.cancelable = Boolean(init.cancelable);
      this.detail = init.detail;
      this.key = init.key;
      this.submitter = init.submitter || null;
      // Only the user agent sets it: true for pointer and keyboard activation, false for element.click().
      this.isTrusted = Boolean(init.isTrusted);
      this.defaultPrevented = false;
      this.stopped = false;
    }
    preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
    stopPropagation() { this.stopped = true; }
    stopImmediatePropagation() { this.stopped = true; this.immediateStopped = true; }
  }
  class FakeCustomEvent extends FakeEvent {}

  function notifyMutation(node) {
    for (const observer of mutationObservers) {
      if (observer.watches(node)) observer.schedule();
    }
  }

  function connect(node) {
    if (node.nodeType !== 1) return;
    const definition = registry.get(node.getAttribute('is') || node.localName);
    if (definition && !(node instanceof definition)) Object.setPrototypeOf(node, definition.prototype);
    node.connectedCallback?.();
    for (const child of [...node.childNodes]) connect(child);
  }

  function disconnect(node) {
    if (node.nodeType !== 1) return;
    node.disconnectedCallback?.();
    for (const child of [...node.childNodes]) disconnect(child);
  }

  class FakeElement {
    constructor() {
      const init = pending || { tag: 'div', attrs: {}, children: [] };
      pending = null;
      this.nodeType = 1;
      this.localName = init.tag;
      this.attributeMap = new Map(Object.entries(init.attrs));
      this.childNodes = [];
      this.parentNode = null;
      this.listeners = [];
      this.styleValues = {};
      this.clientWidth = 380;
      this.scrollLeft = 0;
      for (const child of init.children) this.appendChild(child);
      if (init.content) this.templateContent = init.content;
    }

    get tagName() { return this.localName.toUpperCase(); }
    // As in browsers (HTMLFormElement named properties override built-ins), a form control named or
    // identified "id" shadows form.id: the product form's `<input name="id">` does exactly that.
    get id() {
      if (this.localName === 'form') {
        const named = document.querySelectorAll('input, select, textarea, button')
          .find((control) => control.form === this && [control.getAttribute('name'), control.getAttribute('id')].includes('id'));
        if (named) return named;
      }
      return this.getAttribute('id') || '';
    }
    get name() { return this.getAttribute('name') || ''; }
    get type() { return (this.getAttribute('type') || (this.localName === 'button' ? 'submit' : 'text')).toLowerCase(); }
    get content() { return this.templateContent; }
    get children() { return this.childNodes.filter((node) => node.nodeType === 1); }
    get isConnected() {
      let node = this;
      while (node.parentNode) node = node.parentNode;
      return node === document;
    }
    get ownerDocument() { return document; }

    getAttribute(name) { return this.attributeMap.has(name) ? this.attributeMap.get(name) : null; }
    hasAttribute(name) { return this.attributeMap.has(name); }
    setAttribute(name, value) { this.attributeMap.set(name, String(value)); notifyMutation(this); }
    removeAttribute(name) { if (this.attributeMap.delete(name)) notifyMutation(this); }
    toggleAttribute(name, force) {
      const enable = force === undefined ? !this.hasAttribute(name) : Boolean(force);
      if (enable) this.setAttribute(name, ''); else this.removeAttribute(name);
      return enable;
    }

    get hidden() { return this.hasAttribute('hidden'); }
    set hidden(value) { this.toggleAttribute('hidden', value); }
    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(value) { this.toggleAttribute('disabled', value); }
    get open() { return this.hasAttribute('open'); }
    set open(value) { this.toggleAttribute('open', value); }

    get checked() { return this.checkedState ?? this.hasAttribute('checked'); }
    set checked(value) {
      this.checkedState = Boolean(value);
      if (!value || this.type !== 'radio' || !this.name) return;
      for (const other of document.querySelectorAll(`input[name="${this.name}"]`)) {
        if (other !== this && other.form === this.form) other.checkedState = false;
      }
    }

    get options() { return this.querySelectorAll('option'); }
    get value() {
      if (this.localName === 'select') {
        const options = this.options;
        if (options.some((item) => item.selectedState !== undefined)) {
          return options.find((item) => item.selectedState)?.value ?? '';
        }
        const option = options.find((item) => item.hasAttribute('selected')) || options[0];
        return option ? option.value : '';
      }
      if (this.valueState !== undefined) return this.valueState;
      const attribute = this.getAttribute('value');
      if (attribute !== null) return attribute;
      return this.localName === 'option' ? this.textContent : '';
    }
    set value(value) {
      if (this.localName === 'select') {
        for (const option of this.options) option.selectedState = option.value === String(value);
      } else {
        this.valueState = String(value);
      }
      notifyMutation(this);
    }

    get form() {
      const owner = this.getAttribute('form');
      return owner ? document.getElementById(owner) : this.closest('form');
    }

    get dataset() {
      const element = this;
      return new Proxy({}, {
        get(_, key) {
          if (typeof key !== 'string') return undefined;
          const value = element.getAttribute(`data-${kebab(key)}`);
          return value === null ? undefined : value;
        },
        set(_, key, value) {
          element.setAttribute(`data-${kebab(key)}`, value);
          return true;
        },
      });
    }

    get classList() {
      const element = this;
      const read = () => (element.getAttribute('class') || '').split(/\s+/).filter(Boolean);
      // DOMTokenList update steps: no class attribute is created for an empty list.
      const write = (list) => {
        if (list.length || element.hasAttribute('class')) element.setAttribute('class', list.join(' '));
      };
      return {
        contains: (name) => read().includes(name),
        add: (...names) => write([...new Set([...read(), ...names])]),
        remove: (...names) => write(read().filter((name) => !names.includes(name))),
        toggle(name, force) {
          const enable = force === undefined ? !read().includes(name) : Boolean(force);
          if (enable) this.add(name); else this.remove(name);
          return enable;
        },
      };
    }

    get style() {
      const values = this.styleValues;
      return {
        setProperty: (name, value) => { values[name] = String(value); },
        getPropertyValue: (name) => values[name] || '',
        removeProperty: (name) => { delete values[name]; },
      };
    }

    get textContent() { return this.childNodes.map((node) => node.textContent).join(' ').replace(/\s+/g, ' ').trim(); }
    set textContent(value) { this.replaceChildren(new FakeText(String(value))); }
    get innerText() { return this.textContent; }
    set innerText(value) { this.textContent = value; }

    appendChild(node) {
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = this;
      this.childNodes.push(node);
      if (this.isConnected) connect(node);
      notifyMutation(this);
      return node;
    }
    insertBefore(node, reference) {
      if (node === reference) return node;
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = this;
      this.childNodes.splice(this.childNodes.indexOf(reference), 0, node);
      if (this.isConnected) connect(node);
      notifyMutation(this);
      return node;
    }
    removeChild(node) {
      const wasConnected = node.isConnected;
      this.childNodes = this.childNodes.filter((child) => child !== node);
      node.parentNode = null;
      if (wasConnected) disconnect(node);
      notifyMutation(this);
      return node;
    }
    append(...nodes) { for (const node of nodes) this.appendChild(typeof node === 'string' ? new FakeText(node) : node); }
    replaceChildren(...nodes) {
      for (const child of [...this.childNodes]) this.removeChild(child);
      this.append(...nodes);
    }
    remove() { this.parentNode?.removeChild(this); }
    contains(node) {
      for (let current = node; current; current = current.parentNode) if (current === this) return true;
      return false;
    }

    descendants() {
      const result = [];
      const walk = (node) => {
        for (const child of node.childNodes) {
          if (child.nodeType !== 1) continue;
          result.push(child);
          walk(child);
        }
      };
      walk(this);
      return result;
    }
    matches(selector) { return parseSelector(selector).some((compounds) => matchesComplex(this, compounds)); }
    querySelectorAll(selector) {
      const selectors = parseSelector(selector);
      return this.descendants().filter((element) => selectors.some((compounds) => matchesComplex(element, compounds)));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) {
      for (let node = this; node && node.nodeType === 1; node = node.parentNode) if (node.matches(selector)) return node;
      return null;
    }
    cloneNode(deep) {
      const children = deep ? this.childNodes.map((child) => child.cloneNode(true)) : [];
      const content = this.templateContent?.cloneNode(true);
      return createElement(this.localName, Object.fromEntries(this.attributeMap), children, { inert: true, content });
    }

    addEventListener(type, listener, options) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      this.listeners.push({ type, listener, capture });
    }
    removeEventListener(type, listener, options) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      this.listeners = this.listeners.filter((entry) => !(entry.type === type && entry.listener === listener && entry.capture === capture));
    }
    invoke(event, phase) {
      event.currentTarget = this;
      for (const entry of [...this.listeners]) {
        if (entry.type !== event.type) continue;
        if (phase === 'capture' && !entry.capture) continue;
        if (phase === 'bubble' && entry.capture) continue;
        if (typeof entry.listener === 'function') entry.listener.call(this, event);
        else entry.listener.handleEvent(event);
        if (event.immediateStopped) break;
      }
    }
    dispatchEvent(event) {
      event.target = this;
      const path = [];
      for (let node = this.parentNode; node; node = node.parentNode) path.push(node);
      for (const node of [...path].reverse()) {
        node.invoke(event, 'capture');
        if (event.stopped) return !event.defaultPrevented;
      }
      this.invoke(event, 'target');
      if (event.bubbles) {
        for (const node of path) {
          if (event.stopped) break;
          node.invoke(event, 'bubble');
        }
      }
      return !event.defaultPrevented;
    }

    // A disabled control gets no click; an enabled submit button submits its form unless the click is cancelled.
    click({ isTrusted = false } = {}) {
      if (this.disabled) return;
      const event = new FakeEvent('click', { bubbles: true, cancelable: true, isTrusted });
      this.dispatchEvent(event);
      if (event.defaultPrevented || this.type !== 'submit') return;
      this.form?.requestSubmit(this);
    }
    focus() { document.activeElement = this; }
    blur() { if (document.activeElement === this) document.activeElement = document.body; }
    getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }; }
    scrollTo(options) { this.lastScroll = options; this.scrollLeft = options.left; }
    pause() { this.pauseCalls = (this.pauseCalls || 0) + 1; }
    showModal() { this.setAttribute('open', ''); }
    close() {
      if (!this.open) return;
      this.removeAttribute('open');
      this.dispatchEvent(new FakeEvent('close'));
    }
    requestSubmit(submitter = null) {
      const event = new FakeEvent('submit', { bubbles: true, cancelable: true, submitter });
      this.dispatchEvent(event);
      if (!event.defaultPrevented) document.nativeSubmissions.push(this);
    }
  }

  function createElement(tag, attrs = {}, children = [], { inert = false, content } = {}) {
    const definition = inert ? null : registry.get(attrs.is || tag);
    pending = { tag, attrs, children, content };
    return new (definition || FakeElement)();
  }

  function materialize(nodes, inert) {
    return nodes.map((node) => {
      if (node.text !== undefined) return new FakeText(node.text);
      if (node.tag === 'template') {
        const content = createElement('#fragment', {}, materialize(node.children, true), { inert: true });
        return createElement('template', node.attrs, [], { inert, content });
      }
      return createElement(node.tag, node.attrs, materialize(node.children, inert), { inert });
    });
  }

  document = createElement('#document');
  const html = createElement('html');
  const body = createElement('body');
  html.appendChild(body);
  document.appendChild(html);
  Object.assign(document, {
    documentElement: html,
    body,
    activeElement: body,
    nativeSubmissions: [],
    getElementById: (id) => document.querySelector(`[id="${id}"]`),
    createElement: (tag) => createElement(tag),
    importNode: (node, deep) => node.cloneNode(deep),
  });
  Object.defineProperty(document, 'isConnected', { get: () => true });

  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.scheduled = false; this.targets = []; }
    observe(target, options = {}) { this.targets.push({ target, subtree: Boolean(options.subtree) }); mutationObservers.add(this); }
    disconnect() { this.targets = []; mutationObservers.delete(this); }
    watches(node) { return this.targets.some(({ target, subtree }) => target === node || (subtree && target.contains(node))); }
    schedule() {
      if (this.scheduled) return;
      this.scheduled = true;
      queueMicrotask(() => { this.scheduled = false; this.callback([], this); });
    }
  }

  class FakeIntersectionObserver {
    constructor(callback, options = {}) { this.callback = callback; this.options = options; this.targets = []; intersectionObservers.push(this); }
    observe(target) { this.targets.push(target); }
    unobserve(target) { this.targets = this.targets.filter((item) => item !== target); }
    disconnect() { this.targets = []; }
  }

  class FakeResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = []; resizeObservers.push(this); }
    observe(target) { this.targets.push(target); }
    unobserve(target) { this.targets = this.targets.filter((item) => item !== target); }
    disconnect() { this.targets = []; }
  }

  class FakeFormData {
    constructor(form) {
      this.entriesList = [];
      if (!form) return;
      for (const control of document.querySelectorAll('input, select, textarea')) {
        if (control.form !== form || !control.name || control.disabled) continue;
        if (['submit', 'button', 'reset', 'image'].includes(control.type)) continue;
        if (['radio', 'checkbox'].includes(control.type) && !control.checked) continue;
        this.entriesList.push([control.name, control.value]);
      }
    }
    get(name) { return this.entriesList.find(([key]) => key === name)?.[1] ?? null; }
    getAll(name) { return this.entriesList.filter(([key]) => key === name).map(([, value]) => value); }
    append(name, value) { this.entriesList.push([name, String(value)]); }
    entries() { return this.entriesList[Symbol.iterator](); }
  }

  const context = {
    console,
    URL,
    JSON,
    Math,
    Number,
    Array,
    Promise,
    queueMicrotask,
    document,
    HTMLElement: FakeElement,
    HTMLFormElement: FakeElement,
    Event: FakeEvent,
    CustomEvent: FakeCustomEvent,
    FormData: FakeFormData,
    MutationObserver: FakeMutationObserver,
    IntersectionObserver: FakeIntersectionObserver,
    location: new URL(url),
    history: {
      state: null,
      urls: [],
      replaceState(state, _title, nextUrl) {
        this.state = state;
        this.urls.push(String(nextUrl));
        context.location = new URL(nextUrl, context.location.href);
      },
    },
    customElements: {
      define(name, constructor, options = {}) {
        if (registry.has(name)) throw new Error(`${name} already defined`);
        registry.set(name, constructor);
        if (options.extends) constructor.extendsTag = options.extends;
      },
      get: (name) => registry.get(name),
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame(callback) {
      if (!frames) { callback(0); return 1; }
      pendingFrames.set(++lastFrame, callback);
      return lastFrame;
    },
    cancelAnimationFrame(id) { pendingFrames.delete(id); },
    addEventListener(type, listener, options) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      windowListeners.push({ type, listener, capture, passive: Boolean(options?.passive) });
    },
    removeEventListener(type, listener, options) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      const index = windowListeners.findIndex((entry) => entry.type === type && entry.listener === listener && entry.capture === capture);
      if (index >= 0) windowListeners.splice(index, 1);
    },
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    fetch(requestUrl, config) {
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      fetchCalls.push({ url: requestUrl, body: config.body, respond: (json) => resolve({ json: async () => json }) });
      return promise;
    },
    theme: {
      utils: { fetchConfig: (type) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', Accept: `application/${type}` } }) },
      routes: { cart_add_url: '/cart/add' },
      settings: { cartType: 'drawer' },
      pubsub: {
        PUB_SUB_EVENTS: { cartUpdate: 'cart-update', cartError: 'cart-error' },
        publish: (name, payload) => published.push({ name, payload }),
      },
    },
  };
  if (resizeObserver) context.ResizeObserver = FakeResizeObserver;
  context.window = context;
  context.self = context;
  vm.createContext(context);
  vm.runInContext(productFormScript, context);
  vm.runInContext(productScript, context);

  return {
    window: context,
    document,
    fetchCalls,
    published,
    intersectionObservers,
    resizeObservers,
    windowListeners,
    pendingFrames,
    // The browser dispatches window scroll and resize events to every listener registered for them.
    fireWindow(type) {
      const event = new FakeEvent(type);
      event.target = document;
      for (const entry of windowListeners.filter((item) => item.type === type)) entry.listener.call(context, event);
    },
    runFrames() {
      const callbacks = [...pendingFrames.values()];
      pendingFrames.clear();
      for (const callback of callbacks) callback(0);
    },
    mount(markup) {
      for (const node of materialize(parseHtml(markup), false)) document.body.appendChild(node);
      return document.body.querySelector('les56-product');
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup(options = {}) {
  const browser = createBrowser(options);
  if (options.footer) {
    const footer = browser.document.createElement('footer');
    footer.setAttribute('class', 'footer-group');
    browser.document.body.appendChild(footer);
  }
  const root = browser.mount(renderSection(options.product || lessive));
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => root.querySelectorAll(selector);
  const form = $('[data-les56-form]');
  // A pointer or keyboard activation by the shopper.
  const click = (element) => element.click({ isTrusted: true });
  const choose = (input) => {
    input.checked = true;
    input.dispatchEvent(new browser.window.Event('change', { bubbles: true }));
  };
  const payload = () => Object.fromEntries(new browser.window.FormData(form).entries());
  const keydown = (element, key) => element.dispatchEvent(new browser.window.Event('keydown', { bubbles: true, cancelable: true, key }));
  const visibleThumbs = () => $$('[data-les56-thumb]').filter((thumb) => !thumb.hidden).map((thumb) => Number(thumb.dataset.index));
  return { ...browser, root, $, $$, form, click, choose, payload, keydown, visibleThumbs };
}

// ---------------------------------------------------------------------------
// Fixture: mirrors the markup contract rendered by sections/les56-main-product.liquid.
// ---------------------------------------------------------------------------

const monthly = { id: 711482605946, name: 'Livraison tous les mois', price: 1521 };
const bimonthly = { id: 711482573178, name: 'Livraison tous les 2 mois', price: 1521 };

// Real catalogue facts: the detergent is tagged for the shop's quantity discount, the gift box is not.
const lessive = {
  sectionId: 'template--1__main',
  type: 'Lessive liquide',
  tags: ['data-discount', 'new'],
  selected: 56810523722106,
  quantities: [
    { value: 1, discount: '', bp: 0 },
    { value: 2, discount: '-9%', bp: 900 },
    { value: 3, discount: '-11%', bp: 1100 },
    { value: 6, discount: '-12%', bp: 1200 },
  ],
  variants: [
    { id: 56810523722106, name: 'Amande douce', unitLabel: 'L', color: '#b7c68f', title: 'Lessive Concentrée 1L Amande Douce', available: true, price: 1690, compareAtPrice: null, plans: [monthly, bimonthly], images: ['amande-1', 'amande-2', 'amande-3'] },
    { id: 55185604149626, name: 'Fleurs Blanches', unitLabel: 'L', color: '#f0813c', title: 'Lessive Concentrée 1L Fleurs Blanches', available: true, price: 1690, compareAtPrice: null, plans: [monthly, bimonthly], images: ['fleurs-1', 'fleurs-2'] },
    { id: 55185604215162, name: 'Eucalyptus', unitLabel: 'L', color: '#37b6ad', title: 'Lessive Concentrée 1L Eucalyptus', available: true, price: 1790, compareAtPrice: null, plans: [{ ...monthly, price: 1611 }, { ...bimonthly, price: 1611 }], images: ['eucalyptus-1'] },
    { id: 55185598251386, name: 'Lavande', unitLabel: 'L', color: '#966fd7', title: 'Lessive Concentrée 1L Lavande', available: false, price: 1690, compareAtPrice: null, plans: [monthly], images: ['lavande-1', 'lavande-2'] },
    { id: 55185604182394, name: 'Bébé Sans Parfum', unitLabel: 'L', color: '#5893f2', title: 'Lessive Concentrée 1L Bébé', available: true, price: 1690, compareAtPrice: null, plans: [{ id: 999, name: 'Livraison toutes les 6 semaines', price: 1500 }], images: ['bebe-1', 'bebe-2', 'bebe-3', 'bebe-4'] },
  ],
};

const coffret = {
  sectionId: 'template--1__main',
  type: 'Coffret',
  tags: ['new'],
  selected: 55432686272890,
  quantities: lessive.quantities,
  variants: [
    { id: 55432686272890, name: 'Fleurs Blanches', color: '#f0813c', title: 'Coffret Maison Engagée', available: true, price: 3500, compareAtPrice: 4475, plans: [], images: ['coffret-1'] },
  ],
};

const euro = (cents) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}€`;

function renderGallery(variant) {
  const media = [...variant.images.map((id) => ({ id, type: 'image' })), ...(variant.videos || [])];
  const count = media.length;
  const slides = media.map(({ id: image, type }, index) => type !== 'image' ? `
    <div class="les56-gallery__slide les56-gallery__slide--video" data-les56-slide data-media-type="${type}" data-index="${index}" role="group" aria-label="Vidéo ${index + 1}">
      <img data-les56-video-poster src="/${image}.jpg" alt="Vidéo">
      <div data-les56-player></div>
      <template data-les56-video>${type === 'video' ? `<video controls preload="none"><source src="/${image}.mp4"></video>` : `<iframe src="https://www.youtube.com/embed/${image}" title="Vidéo"></iframe>`}</template>
    </div>` : `
    <button type="button" class="les56-gallery__slide" data-les56-slide data-index="${index}" aria-haspopup="dialog" aria-label="Ouvrir sur l’image ${index + 1} sur ${count}">
      <img class="les56-gallery__image" src="/${image}.jpg" alt="${image}" sizes="100vw">
    </button>`).join('');
  const thumbs = media.map(({ id: image }, index) => `
    <button type="button" class="les56-gallery__thumb" data-les56-thumb data-index="${index}" aria-label="Afficher l’image ${index + 1}"${index === 0 ? ' hidden' : ''}>
      <img src="/${image}-thumb.jpg" alt="">
    </button>`).join('');
  return `
    <les56-gallery class="les56-gallery">
      <div class="les56-gallery__frame">
        <div class="les56-gallery__viewport" data-les56-viewport>${slides}</div>

        <button type="button" class="les56-gallery__arrow" data-les56-prev aria-label="Image précédente"></button>
        <button type="button" class="les56-gallery__arrow" data-les56-next aria-label="Image suivante"></button>
        <div class="les56-gallery__dots">${media.map(() => '<span class="les56-gallery__dot" data-les56-dot></span>').join('')}</div>
      </div>
      <div class="les56-gallery__thumbs">${thumbs}</div>
      <dialog class="les56-lightbox" data-les56-lightbox aria-label="Image produit en grand">
        <button type="button" data-les56-lightbox-close>Fermer</button>
        <button type="button" data-les56-zoom-toggle aria-pressed="false" aria-label="Zoomer sur l’image"></button>
        <div data-les56-lightbox-stage><img data-les56-lightbox-image alt=""></div>
      </dialog>
    </les56-gallery>`;
}

const renderAccordions = (variant) => `
  <details class="les56-accordion" data-les56-accordion="description"><summary>Descriptif 🙌</summary><div><div class="les56-accordion__intro">${variant.name} short description</div>${variant.title} description</div></details>
  <details class="les56-accordion" data-les56-accordion="usage"><summary>Utilisation 💧</summary><div>${variant.title} usage</div></details>`;

function renderSection(product) {
  const { sectionId, quantities, variants } = product;
  const formId = `les56-form-${sectionId}`;
  const current = variants.find((variant) => variant.id === product.selected);
  // Section contract: quantity discounts only for the discount tag, headline and badges only for the family type.
  const discounted = product.tags.includes('data-discount');
  const inFamily = product.type === 'Lessive liquide';
  const data = {
    formId,
    moneyFormat: '{{amount}}€',
    variants: variants.map(({ id, title, available, price, compareAtPrice, plans, unitLabel = '' }) => ({
      id, title, available, price, compareAtPrice, unitPrice: unitLabel ? price : null, unitLabel, requiresSellingPlan: false, plans,
    })),
  };
  const family = inFamily ? `
    <div class="les56-family">
      <p class="les56-tagline">La lessive naturelle <em>vraiment</em> efficace</p>
      <ul class="les56-badges les56-badges--rows" role="list"><li class="les56-badge">🌿 100% d’origine naturelle</li><li class="les56-badge">🌱 Certifiée Ecocert</li></ul>
    </div>` : '<div class="les56-family"></div>';
  const fragrances = variants.length > 1 ? `
    <div class="les56-fragrances">
      <p class="les56-label">Parfum : <span data-les56-fragrance-name>${current.name}</span></p>
      ${variants.map((variant) => `
        <input type="radio" class="les56-sr-only" id="les56-variant-${sectionId}-${variant.id}" name="les56-variant-${sectionId}" value="${variant.id}" data-les56-variant-input data-fragrance-name="${variant.name}" data-fragrance-color="${variant.color}"${variant.id === current.id ? ' checked' : ''}>
        <label for="les56-variant-${sectionId}-${variant.id}" class="les56-fragrance">${variant.name}</label>`).join('')}
    </div>` : '';
  const quantityCards = quantities.map((quantity) => `
    <input type="radio" class="les56-sr-only" id="les56-quantity-${sectionId}-${quantity.value}" name="quantity" form="${formId}" value="${quantity.value}" data-les56-quantity data-discount-bp="${discounted ? quantity.bp : 0}"${quantity.value === 1 ? ' checked' : ''}>
    <label for="les56-quantity-${sectionId}-${quantity.value}" class="les56-quantity">
      <span class="les56-quantity__label">x${quantity.value}</span>
      <span class="les56-quantity__price"><span data-les56-quantity-total>?</span><s data-les56-quantity-compare hidden>?</s></span>
      ${discounted && quantity.discount ? `<span class="les56-pill les56-pill--discount">${quantity.discount}</span>` : ''}
    </label>`).join('');
  const hasPlans = current.plans.length > 0;
  // As the section renders it: the merchant copy with the current variant's real first-plan discount.
  const bubble = product.bubble || { single: '-15% toute l’année', multiple: '-15% supplémentaires' };
  const percent = hasPlans ? Math.round(((current.price - current.plans[0].price) * 100) / current.price) : 0;
  const amountAt = bubble.single.indexOf('%');
  const bubbleText = percent > 0 ? `${bubble.single.slice(0, amountAt).trimEnd().replace(/\S*$/, '')}-${percent}%${bubble.single.slice(amountAt + 1)}` : '';
  const subscription = variants.some((variant) => variant.plans.length) ? `
    <div class="les56-subscription" data-les56-subscription${hasPlans ? '' : ' hidden'}>
      <input type="checkbox" class="les56-sr-only" id="les56-subscribe-${sectionId}" data-les56-subscribe>
      <label for="les56-subscribe-${sectionId}">Je m’abonne
        <span data-les56-subscription-bubble data-copy-single="${bubble.single}" data-copy-multiple="${bubble.multiple}"${percent > 0 ? '' : ' hidden'}>${bubbleText}</span>
      </label>
      <div class="les56-subscription__frequency" data-les56-frequency hidden>
        <span id="les56-plan-label-${sectionId}">Livraison :</span>
        <div class="les56-plan" data-les56-plan-picker>
          <select id="les56-plan-${sectionId}" class="les56-sr-only" name="selling_plan" form="${formId}" data-les56-plan data-variant-id="${current.id}" tabindex="-1" aria-hidden="true" disabled>
            ${current.plans.map((plan) => `<option value="${plan.id}">${plan.name}</option>`).join('')}
          </select>
          <button type="button" class="les56-plan__trigger" id="les56-plan-trigger-${sectionId}" data-les56-plan-trigger aria-haspopup="listbox" aria-expanded="false" aria-controls="les56-plan-list-${sectionId}" aria-labelledby="les56-plan-label-${sectionId} les56-plan-trigger-${sectionId}">
            <span data-les56-plan-value>${current.plans[0]?.name || ''}</span>
          </button>
          <ul class="les56-plan__list" id="les56-plan-list-${sectionId}" role="listbox" tabindex="-1" aria-labelledby="les56-plan-label-${sectionId}" data-les56-plan-list hidden>
            ${current.plans.map((plan, index) => `<li class="les56-plan__option" id="les56-plan-list-${sectionId}-${plan.id}" role="option" data-value="${plan.id}" aria-selected="${index === 0}">${plan.name}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>` : '';
  const submitContent = `
    <span data-les56-submit-label>Ajouter au panier</span>
    <span class="les56-cta__price"><span data-les56-cta-total>?</span><s data-les56-cta-compare hidden>?</s></span>`;
  const templates = variants.length > 1 ? variants.map((variant) => `
    <template data-les56-variant-template="${variant.id}">
      <div data-les56-slot="gallery">${renderGallery(variant)}</div>
      <div data-les56-slot="title">${variant.title}</div>
      <div data-les56-slot="accordions">${renderAccordions(variant)}</div>
    </template>`).join('') : '';

  return `
    <les56-product class="les56" data-section-id="${sectionId}" data-add-label="Ajouter au panier" data-sold-out-label="Victime de son succès">
      <script type="application/json" data-les56-json>${JSON.stringify(data)}</script>
      <div class="les56__layout">
        <div class="les56__media" data-les56-region="gallery">${renderGallery(current)}</div>
        <div class="les56__info">
          <h1 class="les56-title" data-les56-region="title">${current.title}</h1>
          <p class="les56-price"><span data-les56-unit-price>?</span><span data-les56-unit-label hidden></span></p>
          ${family}
          ${fragrances}
          <fieldset class="les56-quantities"><legend>Quantité :</legend>${quantityCards}</fieldset>
          ${subscription}
          <div class="les56-app" data-les56-app></div>
          <div class="les56-buy">
            <form id="${formId}" is="product-form" data-les56-form method="post" action="/cart/add">
              <input type="hidden" name="id" value="${current.id}" data-les56-variant-id>
              ${product.injectedWidget || ''}
              <button type="submit" name="add" class="les56-cta" data-les56-submit="main">${submitContent}</button>
              <div class="product-form__error-message les56-error" role="alert" hidden></div>
            </form>
          </div>
          <div class="les56__details">
            <div class="les56-accordions" data-les56-region="accordions">${renderAccordions(current)}</div>
            <div class="les56-relocated-apps" data-les56-app-slot></div>
          </div>
        </div>
      </div>
      <div class="les56-sticky" data-les56-sticky hidden>
        <p class="les56-sticky__title" data-les56-sticky-title>${current.title}</p>
        <button type="submit" name="add" form="${formId}" class="les56-cta" data-les56-submit="sticky">${submitContent}</button>
        <p class="les56-error" data-les56-sticky-error role="alert" hidden></p>
      </div>
      ${templates}
    </les56-product>`;
}

const quantityInput = (t, value) => t.$(`[data-les56-quantity][value="${value}"]`);
const variantInput = (t, id) => t.$(`[data-les56-variant-input][value="${id}"]`);
const quantityPrices = (t) => t.$$('[data-les56-quantity]').map((input) => {
  const label = t.$(`label[for="${input.id}"]`);
  const compare = label.querySelector('[data-les56-quantity-compare]');
  return [Number(input.value), label.querySelector('[data-les56-quantity-total]').textContent, compare.hidden ? null : compare.textContent];
});

// ---------------------------------------------------------------------------
// Behaviour
// ---------------------------------------------------------------------------

test('displayed totals match the observed /cart.js totals for every quantity and plan (integer cents)', () => {
  const t = setup();
  // Characterized on the preview cart for variant 56810523722106 and plan 711482605946.
  assert.deepEqual(quantityPrices(t), [
    [1, euro(1690), null],
    [2, euro(3076), euro(3380)],
    [3, euro(4515), euro(5070)],
    [6, euro(8928), euro(10140)],
  ]);
  assert.equal(t.$('[data-les56-unit-price]').textContent, '16,90€');
  assert.equal(t.$('[data-les56-unit-label]').textContent, '/L');
  assert.equal(t.$('[data-les56-unit-label]').hidden, false);

  t.choose(t.$('[data-les56-subscribe]'));
  assert.deepEqual(quantityPrices(t).map(([quantity, total]) => [quantity, total]), [
    [1, euro(1690)],
    [2, euro(3076)],
    [3, euro(4515)],
    [6, euro(8928)],
  ]);

  t.choose(quantityInput(t, 6));
  assert.equal(t.$('[data-les56-submit="main"] [data-les56-cta-total]').textContent, euro(8034));
  assert.equal(t.$('[data-les56-submit="sticky"] [data-les56-cta-total]').textContent, euro(8034));
  assert.equal(t.$('[data-les56-submit="main"] [data-les56-cta-compare]').textContent, euro(10140));
});

test('non-round prices round each discounted unit up once, using the real allocation price', () => {
  const t = setup();
  t.choose(variantInput(t, 55185604215162));
  assert.deepEqual(quantityPrices(t).map(([quantity, total]) => [quantity, total]), [
    [1, euro(1790)],
    [2, euro(3258)],
    [3, euro(4782)],
    [6, euro(9456)],
  ]);
  t.choose(t.$('[data-les56-subscribe]'));
  assert.deepEqual(quantityPrices(t).map(([quantity, total]) => [quantity, total]), [
    [1, euro(1790)],
    [2, euro(3258)],
    [3, euro(4782)],
    [6, euro(9456)],
  ]);
});

test('the gift box has no quantity discount: totals match its observed cart (3500/7000/10500/21000)', () => {
  const t = setup({ product: coffret, url: 'https://shop.test/products/coffret' });
  assert.equal(t.$('[data-les56-subscription]'), null);
  assert.equal(t.$('[data-les56-variant-input]'), null);
  // Characterized on the preview cart for variant 55432686272890: no discount at any quantity.
  assert.deepEqual(quantityPrices(t), [
    [1, euro(3500), euro(4475)],
    [2, euro(7000), euro(8950)],
    [3, euro(10500), euro(13425)],
    [6, euro(21000), euro(26850)],
  ]);
  assert.deepEqual(t.$$('.les56-pill--discount'), []);

  t.choose(quantityInput(t, 6));
  assert.equal(t.$('[data-les56-submit="main"] [data-les56-cta-total]').textContent, euro(21000));
  assert.equal(t.$('[data-les56-submit="sticky"] [data-les56-cta-total]').textContent, euro(21000));
  assert.deepEqual(t.payload(), { id: '55432686272890', quantity: '6' });
});

test('the gift box shows no detergent headline, badges or per-litre unit', () => {
  const t = setup({ product: coffret, url: 'https://shop.test/products/coffret' });
  assert.equal(t.$('.les56-tagline'), null);
  assert.equal(t.$('.les56-badges'), null);
  assert.equal(t.$('[data-les56-unit-price]').textContent, '35,00€');
  assert.equal(t.$('[data-les56-unit-label]').hidden, true);
  assert.equal(t.$('[data-les56-unit-label]').textContent, '');
});

test('the detergent keeps its quantity discounts and the plan allocation is discounted per unit, rounded up', () => {
  const t = setup();
  assert.deepEqual(t.$$('.les56-pill--discount').map((pill) => pill.textContent), ['-9%', '-11%', '-12%']);
  t.choose(t.$('[data-les56-subscribe]'));
  // ceil(1521 × (100 − discount) / 100) × quantity, as in /cart.js.
  const expected = [1690, 3076, 4515, 8928];
  assert.deepEqual(quantityPrices(t).map(([, total]) => total), expected.map(euro));
  for (const [quantity, total] of [[1, 1521], [2, 2770], [3, 4062], [6, 8034]]) {
    t.choose(quantityInput(t, quantity));
    assert.equal(t.$('[data-les56-submit="main"] [data-les56-cta-total]').textContent, euro(total));
  }
});

test('the cart payload carries the selected fragrance, quantity and frequency exactly once', () => {
  const t = setup();
  t.choose(variantInput(t, 55185604149626));
  t.choose(quantityInput(t, 2));
  t.choose(t.$('[data-les56-subscribe]'));
  assert.equal(t.$('[data-les56-frequency]').hidden, false);
  t.$('[data-les56-plan]').value = String(bimonthly.id);
  t.$('[data-les56-plan]').dispatchEvent(new t.window.Event('change', { bubbles: true }));

  assert.deepEqual(t.payload(), { id: '55185604149626', quantity: '2', selling_plan: String(bimonthly.id) });
  assert.equal(t.$$('[name="id"]').length, 1);
  assert.equal(t.document.querySelectorAll('form').length, 1);

  t.click(t.$('[data-les56-submit="sticky"]'));
  assert.equal(t.fetchCalls.length, 1);
  assert.deepEqual(t.fetchCalls[0].body.getAll('id'), ['55185604149626']);
  assert.deepEqual(t.fetchCalls[0].body.getAll('quantity'), ['2']);
  assert.deepEqual(t.fetchCalls[0].body.getAll('selling_plan'), [String(bimonthly.id)]);
});

test('one-time purchases never submit a selling plan', () => {
  const t = setup();
  t.choose(t.$('[data-les56-subscribe]'));
  const subscribe = t.$('[data-les56-subscribe]');
  subscribe.checked = false;
  subscribe.dispatchEvent(new t.window.Event('change', { bubbles: true }));
  assert.deepEqual(t.payload(), { id: '56810523722106', quantity: '1' });
  assert.equal(t.$('[data-les56-frequency]').hidden, true);
});

test('a frequency persists only when the new fragrance offers it, otherwise a valid plan is shown', () => {
  const t = setup();
  t.choose(t.$('[data-les56-subscribe]'));
  const plan = t.$('[data-les56-plan]');
  plan.value = String(bimonthly.id);
  plan.dispatchEvent(new t.window.Event('change', { bubbles: true }));

  t.choose(variantInput(t, 55185604149626));
  assert.equal(t.payload().selling_plan, String(bimonthly.id));

  t.choose(variantInput(t, 55185604182394));
  assert.equal(t.payload().selling_plan, '999');
  assert.deepEqual(plan.options.map((option) => option.value), ['999']);
  assert.equal(plan.value, '999');
  assert.deepEqual(planOptions(t), [['999', 'Livraison toutes les 6 semaines', 'true']], 'dropdown rebuilt from the real plans');
  assert.equal(t.$('[data-les56-plan-value]').textContent, 'Livraison toutes les 6 semaines');
  assert.equal(t.$('[data-les56-submit="main"] [data-les56-cta-total]').textContent, euro(1500));
  assert.equal(t.$('[data-les56-subscribe]').checked, true);

  t.choose(variantInput(t, 55185604149626));
  assert.deepEqual(planOptions(t).map(([value, , selected]) => [value, selected]), [[String(monthly.id), 'true'], [String(bimonthly.id), 'false']]);
  assert.equal(t.payload().selling_plan, String(monthly.id), 'an unsold frequency falls back to a real plan');
});

const planOptions = (t) => t.$$('[data-les56-plan-list] [role="option"]').map((option) => [
  option.dataset.value, option.textContent, option.getAttribute('aria-selected'),
]);

test('the delivery dropdown is a button and listbox that writes the chosen real plan to the native select', () => {
  const t = setup();
  t.choose(t.$('[data-les56-subscribe]'));
  const trigger = t.$('[data-les56-plan-trigger]');
  const list = t.$('[data-les56-plan-list]');
  assert.equal(t.$('[data-les56-plan]').getAttribute('aria-hidden'), 'true', 'the native select is only the form field');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'listbox');
  assert.deepEqual(planOptions(t), [
    [String(monthly.id), monthly.name, 'true'],
    [String(bimonthly.id), bimonthly.name, 'false'],
  ]);
  assert.equal(t.$('[data-les56-plan-value]').textContent, monthly.name);

  t.click(trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(list.hidden, false);
  assert.equal(t.document.activeElement, list);
  assert.equal(list.getAttribute('aria-activedescendant'), `${list.getAttribute('id')}-${monthly.id}`);

  t.click(t.$(`[role="option"][data-value="${bimonthly.id}"]`));
  assert.equal(list.hidden, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(t.document.activeElement, trigger, 'focus returns to the button');
  assert.equal(t.$('[data-les56-plan-value]').textContent, bimonthly.name);
  assert.deepEqual(planOptions(t).map(([, , selected]) => selected), ['false', 'true']);
  assert.deepEqual(t.payload(), { id: '56810523722106', quantity: '1', selling_plan: String(bimonthly.id) });
  assert.equal(t.$$('[name="selling_plan"]').length, 1, 'the native select stays the only plan field');

  t.click(t.$('[data-les56-submit="main"]'));
  assert.deepEqual(t.fetchCalls[0].body.getAll('selling_plan'), [String(bimonthly.id)]);

  // Back to a one-time purchase: no plan is sent.
  t.$('[data-les56-subscribe]').checked = false;
  t.$('[data-les56-subscribe]').dispatchEvent(new t.window.Event('change', { bubbles: true }));
  assert.equal(t.$('[data-les56-plan]').disabled, true);
  assert.equal(t.payload().selling_plan, undefined);
});

test('the delivery dropdown works from the keyboard and closes on Escape, Tab or an outside click', () => {
  const t = setup();
  t.choose(t.$('[data-les56-subscribe]'));
  const trigger = t.$('[data-les56-plan-trigger]');
  const list = t.$('[data-les56-plan-list]');
  const listId = list.getAttribute('id');
  const active = () => list.getAttribute('aria-activedescendant');

  trigger.focus();
  t.keydown(trigger, 'ArrowDown');
  assert.equal(list.hidden, false, 'arrow keys open the list');
  assert.equal(active(), `${listId}-${monthly.id}`);
  t.keydown(list, 'ArrowDown');
  assert.equal(active(), `${listId}-${bimonthly.id}`);
  t.keydown(list, 'ArrowDown');
  assert.equal(active(), `${listId}-${bimonthly.id}`, 'stops on the last option');
  t.keydown(list, 'Home');
  assert.equal(active(), `${listId}-${monthly.id}`);
  t.keydown(list, 'End');
  t.keydown(list, 'Escape');
  assert.equal(list.hidden, true);
  assert.equal(t.document.activeElement, trigger);
  assert.equal(t.payload().selling_plan, String(monthly.id), 'Escape keeps the plan');

  t.click(trigger);
  t.keydown(list, 'ArrowDown');
  t.keydown(list, 'Enter');
  assert.equal(list.hidden, true);
  assert.equal(t.payload().selling_plan, String(bimonthly.id));
  assert.equal(t.document.activeElement, trigger);

  t.keydown(trigger, 'ArrowUp');
  t.keydown(list, 'ArrowUp');
  t.keydown(list, ' ');
  assert.equal(t.payload().selling_plan, String(monthly.id), 'Space selects too');
  assert.equal(t.$('[data-les56-submit="main"] [data-les56-cta-total]').textContent, euro(1521));

  t.click(trigger);
  t.keydown(list, 'Tab');
  assert.equal(list.hidden, true, 'Tab closes without trapping the focus');

  t.click(trigger);
  const outside = new t.window.Event('pointerdown', { bubbles: true });
  t.document.body.dispatchEvent(outside);
  assert.equal(list.hidden, true, 'outside click closes');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(t.document.listeners.some((entry) => entry.type === 'pointerdown'), false, 'outside listener released');

  t.click(trigger);
  t.root.remove();
  assert.equal(t.document.listeners.some((entry) => entry.type === 'pointerdown'), false, 'released with the section');
});

test('the subscription bubble keeps the merchant wording with the real discount of the selected fragrance and plan', () => {
  const t = setup();
  const bubble = t.$('[data-les56-subscription-bubble]');
  // 1690 → 1521: the plan allocation is 10% off, whatever percentage the example copy carries.
  assert.equal(bubble.textContent, '-10% toute l’année');
  assert.equal(bubble.hidden, false);
  t.choose(quantityInput(t, 3));
  assert.equal(bubble.textContent, '-10% supplémentaires');

  // 1690 → 1500 is 11.2% off.
  t.choose(variantInput(t, 55185604182394));
  assert.equal(bubble.textContent, '-11% supplémentaires');
  t.choose(quantityInput(t, 1));
  assert.equal(bubble.textContent, '-11% toute l’année');

  // Quantity discounts and plan allocations are unchanged: 1500 at one unit, ceil(1500 × 0.89) × 3.
  t.choose(t.$('[data-les56-subscribe]'));
  t.choose(quantityInput(t, 3));
  assert.equal(t.$('[data-les56-submit="main"] [data-les56-cta-total]').textContent, euro(Math.ceil(1500 * 0.89) * 3));
});

test('the bubble follows the chosen plan and never shows a discount the plan does not give', () => {
  const plans = [{ ...monthly, price: 1521 }, { ...bimonthly, price: 1436 }];
  const product = {
    ...lessive,
    bubble: { single: 'Jusqu’à -15 % toute l’année', multiple: 'en plus' },
    variants: [
      { ...lessive.variants[0], plans },
      { ...lessive.variants[1], plans: [{ ...monthly, price: 1690 }] },
    ],
  };
  const t = setup({ product });
  const bubble = t.$('[data-les56-subscription-bubble]');
  assert.equal(bubble.textContent, 'Jusqu’à -10% toute l’année', 'only the example amount is replaced');

  t.choose(t.$('[data-les56-subscribe]'));
  t.$('[data-les56-plan]').value = String(bimonthly.id);
  t.$('[data-les56-plan]').dispatchEvent(new t.window.Event('change', { bubbles: true }));
  assert.equal(bubble.textContent, 'Jusqu’à -15% toute l’année', '1690 → 1436');
  t.choose(quantityInput(t, 2));
  assert.equal(bubble.textContent, '-15% en plus', 'copy without an amount gets the real one first');

  t.choose(variantInput(t, 55185604149626));
  assert.equal(bubble.hidden, true, 'a plan at full price shows no discount');
  t.choose(variantInput(t, 56810523722106));
  assert.equal(bubble.hidden, false);
  assert.equal(bubble.textContent, '-10% en plus', 'the first plan is offered again after the fallback');
});

test('the section renders the real subscription discount in the bubble before any script runs', () => {
  const markup = sectionSource.replace(/{%\s*schema\s*%}[\s\S]*$/, '');
  assert.match(markup, /assign subscription_offer = current_variant\.selling_plan_allocations\.first/);
  assert.match(markup, /current_variant\.price \| minus: subscription_offer\.price \| times: 100\.0 \| divided_by: current_variant\.price \| round/);
  const bubble = markup.match(/<span\s+class="les56-subscription__bubble"[\s\S]*?<\/span>/)[0];
  assert.match(bubble, /{{- bubble_text \| escape -}}/);
  assert.match(bubble, /if subscription_percent == 0/);
  assert.doesNotMatch(bubble, />\s*{{[^}]*section\.settings\.subscription_bubble/, 'the example copy is never shown as is');
});

test('an unavailable fragrance cannot be bought from either button or by submitting the form', () => {
  const t = setup();
  t.choose(variantInput(t, 55185598251386));
  for (const button of t.$$('[data-les56-submit]')) {
    assert.equal(button.disabled, true);
    assert.equal(button.querySelector('[data-les56-submit-label]').textContent, 'Victime de son succès');
  }
  t.form.requestSubmit(t.$('[data-les56-submit="main"]'));
  assert.equal(t.fetchCalls.length, 0);
  assert.equal(t.document.nativeSubmissions.length, 0);

  t.choose(variantInput(t, 56810523722106));
  assert.equal(t.$('[data-les56-submit="main"]').disabled, false);
  assert.equal(t.$('[data-les56-submit-label]').textContent, 'Ajouter au panier');
});

test('rapid fragrance changes always leave the latest choice in content, payload and URL', () => {
  const t = setup();
  for (const id of [55185604149626, 55185604215162, 55185604182394, 55185604149626]) t.choose(variantInput(t, id));

  assert.equal(t.payload().id, '55185604149626');
  assert.equal(t.$('[data-les56-region="title"]').textContent, 'Lessive Concentrée 1L Fleurs Blanches');
  assert.equal(t.$('.les56-tagline').textContent, 'La lessive naturelle vraiment efficace', 'family headline is not per variant');
  assert.equal(t.$('[data-les56-accordion="description"] .les56-accordion__intro').textContent, 'Fleurs Blanches short description');
  assert.equal(t.$('[data-les56-fragrance-name]').textContent, 'Fleurs Blanches');
  assert.equal(t.$('[data-les56-sticky-title]').textContent, 'Lessive Concentrée 1L Fleurs Blanches');
  assert.deepEqual(t.$$('[data-les56-slide] img').map((image) => image.getAttribute('alt')), ['fleurs-1', 'fleurs-2']);
  assert.match(t.$('[data-les56-region="accordions"]').textContent, /Fleurs Blanches description/);
  const lastUrl = new URL(t.window.history.urls.at(-1));
  assert.equal(lastUrl.searchParams.get('variant'), '55185604149626');
  assert.equal(lastUrl.searchParams.get('preview_theme_id'), '186855653754');
});

// Supply a real asynchronous image boundary without replacing gallery behavior.
function delayGalleryDecode(t, id) {
  const slot = t.$(`[data-les56-variant-template="${id}"]`).content.querySelector('[data-les56-slot="gallery"]');
  const clone = slot.cloneNode.bind(slot);
  let resolve, reject;
  const decoded = new Promise((yes, no) => { resolve = yes; reject = no; });
  slot.cloneNode = (...args) => {
    const content = clone(...args);
    content.querySelector('img').decode = () => decoded;
    return content;
  };
  return { resolve, reject };
}

test('pending fragrance images keep the previous gallery and stale decodes cannot replace the last choice', async () => {
  const t = setup();
  const oldGallery = t.$('les56-gallery');
  const first = delayGalleryDecode(t, 55185604149626);
  const last = delayGalleryDecode(t, 55185604182394);
  t.choose(variantInput(t, 55185604149626));
  assert.equal(t.$('les56-gallery'), oldGallery, 'no blank gallery while loading');
  assert.equal(t.payload().id, '55185604149626', 'purchase selection updates immediately');
  t.choose(variantInput(t, 55185604182394));
  last.resolve();
  await new Promise(resolve => setImmediate(resolve));
  const selectedGallery = t.$('les56-gallery');
  assert.notEqual(selectedGallery, oldGallery);
  assert.equal(selectedGallery.querySelector('img').getAttribute('alt'), 'bebe-1');
  first.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(t.$('les56-gallery'), selectedGallery, 'late old image ignored');
});

test('returning to the same fragrance ignores an older decode of that fragrance', async () => {
  const t = setup();
  const first = delayGalleryDecode(t, 55185604149626);
  t.choose(variantInput(t, 55185604149626));
  t.choose(variantInput(t, 55185604182394));
  const last = delayGalleryDecode(t, 55185604149626);
  t.choose(variantInput(t, 55185604149626));
  last.resolve();
  await new Promise(resolve => setImmediate(resolve));
  const gallery = t.$('les56-gallery');
  t.click(t.$('[data-les56-thumb][data-index="1"]'));
  first.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(t.$('les56-gallery') === gallery, 'older decode must not replace the current gallery');
  assert.equal(gallery.activeIndex, 1, 'the shopper keeps the image selected after loading');
});

test('an image decode rejection still renders the selected gallery and a removed section stays untouched', async () => {
  const t = setup();
  const failed = delayGalleryDecode(t, 55185604149626);
  t.choose(variantInput(t, 55185604149626));
  failed.reject(new Error('decode failed'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(t.$('les56-gallery').querySelector('img').getAttribute('alt'), 'fleurs-1');
  const pending = delayGalleryDecode(t, 55185604182394);
  t.choose(variantInput(t, 55185604182394));
  const gallery = t.$('les56-gallery');
  t.root.remove();
  pending.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(t.root.querySelector('les56-gallery'), gallery, 'no detached DOM replacement');
});

test('an open accordion stays open when the fragrance changes', () => {
  const t = setup();
  t.$('[data-les56-accordion="usage"]').open = true;
  t.choose(variantInput(t, 55185604149626));
  assert.equal(t.$('[data-les56-accordion="usage"]').open, true);
  assert.equal(t.$('[data-les56-accordion="description"]').open, false);
});

test('main and sticky buttons share one request while it is pending', () => {
  const t = setup();
  t.choose(quantityInput(t, 2));
  t.click(t.$('[data-les56-submit="main"]'));
  t.click(t.$('[data-les56-submit="main"]'));
  t.click(t.$('[data-les56-submit="sticky"]'));
  assert.equal(t.fetchCalls.length, 1);
  assert.deepEqual(t.fetchCalls[0].body.getAll('quantity'), ['2']);
});

test('a failed add shows the error near both buttons and allows a retry', async () => {
  const t = setup();
  t.click(t.$('[data-les56-submit="sticky"]'));
  t.fetchCalls[0].respond({ status: 422, description: 'Stock insuffisant' });
  await flush();

  const error = t.form.querySelector('.product-form__error-message');
  assert.equal(error.hidden, false);
  assert.equal(error.textContent, 'Stock insuffisant');
  assert.equal(t.$('[data-les56-sticky-error]').hidden, false);
  assert.equal(t.$('[data-les56-sticky-error]').textContent, 'Stock insuffisant');
  assert.equal(t.$('[data-les56-submit="main"]').hasAttribute('aria-disabled'), false);

  t.click(t.$('[data-les56-submit="main"]'));
  assert.equal(t.fetchCalls.length, 2);
  t.fetchCalls[1].respond({ id: 1, quantity: 1, sections: {} });
  await flush();
  assert.equal(error.hidden, true);
  assert.equal(t.$('[data-les56-sticky-error]').hidden, true);
  assert.ok(t.published.some((entry) => entry.name === 'cart-update'));
});

test('the sticky bar appears as soon as the main button starts leaving the top of the screen and leaves near the footer', () => {
  const t = setup({ footer: true });
  const footer = t.document.querySelector('.footer-group');
  const sticky = t.$('[data-les56-sticky]');
  const main = t.$('[data-les56-submit="main"]');
  const observer = t.intersectionObservers.find((item) => item.targets.includes(main));
  assert.ok(observer, 'main button observed');
  assert.ok([observer.options.threshold].flat().includes(1), 'notified when the button stops being fully visible');
  const rootBounds = { top: 0, bottom: 800 };
  const at = (top, intersectionRatio) => {
    placeMainButton(t, top);
    observer.callback([{
      target: main, rootBounds, intersectionRatio, isIntersecting: intersectionRatio > 0, boundingClientRect: { top, bottom: top + 50 },
    }]);
  };

  at(900, 0);
  assert.equal(sticky.hidden, true, 'not shown while the button is still below the screen');
  at(775, 0.5);
  assert.equal(sticky.hidden, true, 'not shown while the button enters from below');
  at(400, 1);
  assert.equal(sticky.hidden, true, 'not shown while the button is fully visible');

  at(-10, 0.8);
  assert.equal(sticky.hidden, false, 'shown once the top of the button is clipped');
  at(-80, 0);
  assert.equal(sticky.hidden, false);
  at(-20, 0.6);
  assert.equal(sticky.hidden, false, 'still shown while scrolling back up to the button');
  at(10, 1);
  assert.equal(sticky.hidden, true, 'hidden again once the button is fully back');

  at(-80, 0);
  const footerObserver = t.intersectionObservers.find((item) => item.targets.includes(footer));
  footerObserver.callback([{ target: footer, isIntersecting: true, boundingClientRect: { top: 500, bottom: 900 } }]);
  assert.equal(sticky.hidden, true);
  footerObserver.callback([{ target: footer, isIntersecting: false, boundingClientRect: { top: 900, bottom: 1300 } }]);
  assert.equal(sticky.hidden, false);
});

test('floating app launchers make way only while the sticky bar is shown', () => {
  const t = setup();
  const html = t.document.documentElement;
  const main = t.$('[data-les56-submit="main"]');
  const observer = t.intersectionObservers.find((item) => item.targets.includes(main));
  const at = (top, intersectionRatio) => {
    placeMainButton(t, top);
    observer.callback([{
      target: main, rootBounds: { top: 0, bottom: 800 }, intersectionRatio, isIntersecting: intersectionRatio > 0, boundingClientRect: { top, bottom: top + 50 },
    }]);
  };

  assert.equal(html.classList.contains('les56-sticky-visible'), false);
  at(-80, 0);
  assert.equal(html.classList.contains('les56-sticky-visible'), true);
  at(400, 1);
  assert.equal(html.classList.contains('les56-sticky-visible'), false);
  at(-80, 0);
  t.root.remove();
  assert.equal(html.classList.contains('les56-sticky-visible'), false, 'restored when the section goes');

  // Only the overlapping Klaviyo teaser and Smile launcher are hidden, and only under that class.
  const rules = productStyles.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]*les56-sticky-visible[^{}]*{[^}]*}/g) || [];
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    const selectors = rule.slice(0, rule.indexOf('{')).split(',').map((selector) => selector.trim());
    for (const selector of selectors) {
      assert.match(selector, /^html\.les56-sticky-visible (\[class\*="kl-teaser-"\]|#smile-ui-lite-launcher-frame-container)$/, selector);
    }
    // Klaviyo resets visibility and pointer-events on the teaser's children: only display: none takes the
    // whole launcher out of rendering, hit-testing and the tab order. Their elements stay in the DOM.
    assert.match(rule, /display: none !important/);
  }
});

// The main button's viewport position as Element.getBoundingClientRect reports it, counting layout reads.
function placeMainButton(t, top) {
  const main = t.$('[data-les56-submit="main"]');
  main.layoutReads ??= 0;
  main.getBoundingClientRect = () => {
    main.layoutReads += 1;
    return { top, bottom: top + 50, left: 16, right: 752, width: 736, height: 50 };
  };
  return main;
}

test('one jump that carries the main button from below to above the screen shows the sticky bar without an observer callback', () => {
  const t = setup({ footer: true, frames: true });
  const html = t.document.documentElement;
  const sticky = t.$('[data-les56-sticky]');
  const footer = t.document.querySelector('.footer-group');
  const scrollListeners = t.windowListeners.filter((entry) => entry.type === 'scroll');
  assert.equal(scrollListeners.length, 1, 'the section follows the page scroll');
  assert.equal(scrollListeners[0].passive, true, 'without delaying scrolling');

  // 768×1024 tablet: the button starts below the screen, so the observer reports it not intersecting.
  const main = placeMainButton(t, 1470.953);
  t.runFrames();
  assert.equal(sticky.hidden, true, 'not shown while the button is still below the screen');

  // One PageDown or long wheel of 1800px: the button goes straight to above the screen, crossing no
  // observer threshold, so the observer stays silent.
  placeMainButton(t, 1470.953 - 1800);
  const readsBefore = main.layoutReads;
  t.fireWindow('scroll');
  t.fireWindow('scroll');
  t.fireWindow('scroll');
  assert.equal(main.layoutReads, readsBefore, 'no layout read on the raw scroll events');
  assert.equal(t.pendingFrames.size, 1, 'scroll events are coalesced into one frame');
  t.runFrames();
  assert.equal(main.layoutReads, readsBefore + 1, 'one position read per frame');
  assert.equal(sticky.hidden, false, 'shown once the button has left the top of the screen');
  assert.equal(html.classList.contains('les56-sticky-visible'), true);

  // Near the footer the bar makes way, and comes back when the footer leaves.
  const footerObserver = t.intersectionObservers.find((item) => item.targets.includes(footer));
  footerObserver.callback([{ target: footer, isIntersecting: true, boundingClientRect: { top: 500, bottom: 900 } }]);
  t.fireWindow('scroll');
  t.runFrames();
  assert.equal(sticky.hidden, true, 'hidden near the footer');
  assert.equal(html.classList.contains('les56-sticky-visible'), false);
  footerObserver.callback([{ target: footer, isIntersecting: false, boundingClientRect: { top: 1100, bottom: 1500 } }]);
  assert.equal(sticky.hidden, false, 'shown again once the footer leaves');

  // The shopper returns to the button: hidden while it is fully visible or below the screen again.
  placeMainButton(t, 400);
  t.fireWindow('scroll');
  t.runFrames();
  assert.equal(sticky.hidden, true, 'hidden while the button is fully visible');
  assert.equal(html.classList.contains('les56-sticky-visible'), false);
  placeMainButton(t, -2000);
  t.fireWindow('scroll');
  t.runFrames();
  assert.equal(sticky.hidden, false);
  placeMainButton(t, 1470.953);
  t.fireWindow('scroll');
  t.runFrames();
  assert.equal(sticky.hidden, true, 'hidden after one jump back below the button');
  assert.equal(html.classList.contains('les56-sticky-visible'), false);
});

test('a late observer entry from before a jump does not hide the sticky bar the page has scrolled to', () => {
  const t = setup({ footer: true, frames: true });
  const html = t.document.documentElement;
  const sticky = t.$('[data-les56-sticky]');
  const main = placeMainButton(t, 1470.953);
  t.runFrames();
  assert.equal(sticky.hidden, true);

  // The jump puts the button above the screen and the scroll frame shows the bar.
  placeMainButton(t, 1470.953 - 1800);
  t.fireWindow('scroll');
  t.runFrames();
  assert.equal(sticky.hidden, false);

  // The observer then delivers an entry queued while the button was still below the screen.
  const observer = t.intersectionObservers.find((item) => item.targets.includes(main));
  observer.callback([{
    target: main, rootBounds: { top: 0, bottom: 1024 }, intersectionRatio: 0, isIntersecting: false,
    boundingClientRect: { top: 1470.953, bottom: 1520.953 },
  }]);
  assert.equal(sticky.hidden, false, 'still shown when the stale entry arrives');
  assert.equal(html.classList.contains('les56-sticky-visible'), true);
  t.runFrames();
  assert.equal(sticky.hidden, false, 'still shown after the next frame, without another scroll');
  assert.equal(html.classList.contains('les56-sticky-visible'), true);
});

test('the sticky bar follows the main button position on load and on resize', () => {
  const t = setup({ frames: true });
  const html = t.document.documentElement;
  const sticky = t.$('[data-les56-sticky]');
  assert.equal(t.windowListeners.filter((entry) => entry.type === 'resize').length, 1, 'the section follows viewport resizes');

  // A page restored already scrolled past the button shows the bar without waiting for a scroll.
  placeMainButton(t, -300);
  t.runFrames();
  assert.equal(sticky.hidden, false, 'reconciled on load');
  assert.equal(html.classList.contains('les56-sticky-visible'), true);

  // Rotating to landscape brings the button back on screen; a narrower viewport pushes it above again.
  placeMainButton(t, 300);
  t.fireWindow('resize');
  t.runFrames();
  assert.equal(sticky.hidden, true, 'hidden when a resize brings the button back');
  assert.equal(html.classList.contains('les56-sticky-visible'), false);
  placeMainButton(t, -10);
  t.fireWindow('resize');
  t.runFrames();
  assert.equal(sticky.hidden, false, 'shown when a resize moves the button above the screen');
});

test('a removed section releases its scroll and resize listeners and its pending frame', () => {
  const t = setup({ frames: true });
  const html = t.document.documentElement;
  placeMainButton(t, -300);
  t.runFrames();
  assert.equal(html.classList.contains('les56-sticky-visible'), true);

  t.fireWindow('scroll');
  assert.equal(t.pendingFrames.size, 1);
  t.root.remove();
  assert.deepEqual(t.windowListeners.filter((entry) => ['scroll', 'resize'].includes(entry.type)), [], 'listeners removed');
  assert.equal(t.pendingFrames.size, 0, 'pending frame cancelled');
  t.runFrames();
  assert.equal(html.classList.contains('les56-sticky-visible'), false, 'launchers restored when the section goes');
});

test('selecting a thumbnail replaces only its slot with the previous main image', () => {
  const t = setup();
  t.choose(variantInput(t, 55185604182394));
  const gallery = t.$('les56-gallery');
  for (const thumb of t.$$('[data-les56-thumb]')) {
    thumb.animate = () => assert.fail('thumbnails must not move or fade between slots');
  }
  let expected = [1, 2, 3];
  let previous = 0;
  for (const target of [3, 1, 0, 2, 3, 2, 0]) {
    const slot = expected.indexOf(target);
    expected[slot] = previous;
    gallery.setActive(target, true);
    assert.deepEqual(t.visibleThumbs(), expected, 'all other thumbnails stay in their original slots');
    assert.equal(gallery.activeIndex, target);
    previous = target;
  }
  gallery.setActive(previous, false);
  assert.deepEqual(t.visibleThumbs(), expected, 'scroll reconciliation leaves the slots untouched');
});

test('thumbnails list every image except the active one and select on click', () => {
  const t = setup();
  assert.deepEqual(t.visibleThumbs(), [1, 2]);
  t.click(t.$('[data-les56-thumb][data-index="2"]'));
  assert.deepEqual(t.visibleThumbs(), [1, 0]);
  assert.equal(t.$('[data-les56-viewport]').lastScroll.left, 2 * 380);
  assert.equal(t.$('[data-les56-viewport]').lastScroll.behavior, 'instant', 'no intermediate slide reflows the thumbnail row');
  assert.equal(t.document.activeElement, t.$('[data-les56-slide][data-index="2"]'));

  t.click(t.$('[data-les56-next]'));
  assert.deepEqual(t.visibleThumbs(), [1, 2]);

  t.choose(variantInput(t, 55185604182394));
  assert.deepEqual(t.visibleThumbs(), [1, 2, 3], 'replacement gallery starts on its first image');
  t.click(t.$('[data-les56-thumb][data-index="3"]'));
  assert.deepEqual(t.visibleThumbs(), [1, 2, 0]);
});

const mixedMediaProduct = () => ({
  ...lessive,
  variants: lessive.variants.map((variant) => ({ ...variant, videos: [
    { id: 'shopify-demo', type: 'video' }, { id: 'youtube-demo', type: 'external_video' },
  ] })),
});

test('video slides load on selection, hide image zoom and leave native controls operable', () => {
  const t = setup({ product: mixedMediaProduct() });
  const gallery = t.$('les56-gallery');
  assert.equal(t.$('video'), null, 'no video is loaded behind the initial image');
  assert.equal(t.$('iframe'), null, 'no external player is loaded behind the initial image');
  t.click(t.$('[data-les56-thumb][data-index="3"]'));
  const video = t.$('video');
  assert.ok(video, 'hosted player activated');
  assert.equal(video.hasAttribute('controls'), true);
  assert.equal(video.getAttribute('preload'), 'none');
  assert.equal(t.$('[data-les56-lightbox]').open, false);
  t.click(video);
  assert.equal(gallery.zoomed, false, 'native player clicks never zoom');
  gallery.setZoom(true);
  assert.equal(gallery.zoomed, false, 'a video cannot be zoomed programmatically either');

  t.click(t.$('[data-les56-next]'));
  assert.ok(video.pauseCalls > 0, 'the previous video is paused');
  assert.equal(t.$('video'), null, 'inactive player released');
  const iframe = t.$('iframe');
  assert.ok(iframe, 'external player activated');
  t.click(t.$('[data-les56-next]'));
  assert.equal(t.$('iframe'), null, 'external player removed to stop playback');
  assert.equal(t.$('[data-les56-lightbox]').open, false, 'no lightbox opened by navigation');
  assert.equal(iframe.isConnected, false);
});

test('video navigation keeps its player and keyboard focus through scroll reconciliation', () => {
  const t = setup({ product: mixedMediaProduct(), frames: true });
  const gallery = t.$('les56-gallery');
  const viewport = t.$('[data-les56-viewport]');
  viewport.scrollTo = (options) => {
    // A smooth scroll first reports the old physical position; instant navigation
    // lands at its destination before scroll events reconcile the active slide.
    viewport.scrollLeft = options.behavior === 'smooth' ? 0 : options.left;
    viewport.dispatchEvent(new t.window.Event('scroll'));
  };
  const thumb = t.$('[data-les56-thumb][data-index="4"]');
  thumb.focus();
  t.click(thumb);
  const frame = t.$('iframe');
  const selected = t.$('[data-les56-slide][data-index="4"]');
  t.runFrames();
  assert.equal(gallery.activeIndex, 4, 'selected video remains active after scroll events');
  assert.equal(t.$('iframe'), frame, 'the player is not unloaded during navigation');
  assert.equal(frame.isConnected, true);
  assert.equal(t.document.activeElement, selected, 'focus stays on the selected media');

  viewport.scrollLeft = 0;
  viewport.dispatchEvent(new t.window.Event('scroll'));
  t.runFrames();
  assert.equal(gallery.activeIndex, 0, 'a real swipe still follows the physically visible image');
  assert.equal(t.$('iframe'), null, 'leaving the video still stops it');
});

test('fragrance replacement and gallery disconnect stop the current video', () => {
  const t = setup({ product: mixedMediaProduct() });
  t.click(t.$('[data-les56-thumb][data-index="3"]'));
  const first = t.$('video');
  t.choose(variantInput(t, 55185604149626));
  assert.ok(first.pauseCalls > 0, 'switching fragrance pauses playback');
  assert.equal(first.isConnected, false);
  assert.equal(t.$('video'), null, 'the next fragrance starts on its first image');
  t.click(t.$('[data-les56-thumb][data-index="2"]'));
  const second = t.$('video');
  t.root.remove();
  assert.ok(second.pauseCalls > 0, 'removing the section pauses playback');
});

test('an interrupted smooth scroll leaves the gallery on the slide that is actually visible', () => {
  const t = setup();
  const viewport = t.$('[data-les56-viewport]');
  const settleOn = (index) => {
    viewport.scrollLeft = index * viewport.clientWidth;
    viewport.dispatchEvent(new t.window.Event('scroll'));
  };
  const state = () => ({
    thumbs: t.visibleThumbs(),
    dots: t.$$('[data-les56-dot]').map((dot) => dot.classList.contains('is-active')),
    tabindex: t.$$('[data-les56-slide]').map((slide) => slide.getAttribute('tabindex')),
    hidden: t.$$('[data-les56-slide]').map((slide) => slide.getAttribute('aria-hidden')),
  });

  t.click(t.$('[data-les56-thumb][data-index="2"]'));
  // The shopper swipes back before the requested smooth scroll reaches image 3: image 2 stays on screen.
  settleOn(1);
  settleOn(1);
  assert.deepEqual(state(), {
    thumbs: [2, 0],
    dots: [false, true, false],
    tabindex: ['-1', '0', '-1'],
    hidden: ['true', 'false', 'true'],
  });

  t.click(t.$('[data-les56-next]'));
  assert.equal(viewport.lastScroll.left, 2 * 380);
  assert.deepEqual(t.visibleThumbs(), [1, 0]);
  t.click(t.$('[data-les56-thumb][data-index="0"]'));
  assert.deepEqual(t.visibleThumbs(), [1, 2]);
  settleOn(0);
  assert.deepEqual(state().dots, [true, false, false]);
});

// A pointer event at viewport coordinates; detail 1 marks a pointer click (keyboard activation has 0).
function pointer(t, element, type, clientX, clientY, pointerType = 'mouse') {
  const event = new t.window.Event(type, { bubbles: true, cancelable: true, detail: 1 });
  Object.assign(event, { clientX, clientY, pointerType });
  element.dispatchEvent(event);
  return event;
}

test('an image opens full screen before the magnifier zooms and Escape closes it', () => {
  const t = setup();
  const slide = t.$('[data-les56-slide]');
  const dialog = t.$('[data-les56-lightbox]');
  const toggle = t.$('[data-les56-zoom-toggle]');
  assert.equal(toggle.closest('dialog'), dialog, 'magnifier only inside the full-screen view');
  assert.equal(dialog.open, false);
  t.click(slide);
  assert.equal(dialog.open, true);
  assert.equal(t.$('les56-gallery').zoomed, false, 'first click opens the full-screen view without extra magnification');
  assert.equal(t.$('[data-les56-lightbox-image]').getAttribute('src'), slide.querySelector('img').getAttribute('src'));
  t.click(toggle);
  assert.equal(t.$('les56-gallery').zoomed, true);
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  t.click(toggle);
  assert.equal(t.$('les56-gallery').zoomed, false);
  t.keydown(t.document.body, 'Escape');
  assert.equal(dialog.open, false);
});

test('the enlarged image pans, and close, slide change and fragrance replacement release it', () => {
  const t = setup();
  const gallery = t.$('les56-gallery');
  const stage = t.$('[data-les56-lightbox-stage]');
  stage.getBoundingClientRect = () => ({ left: 0, top: 100, width: 380, height: 350 });
  t.click(t.$('[data-les56-slide]'));
  t.click(t.$('[data-les56-zoom-toggle]'));
  pointer(t, stage, 'pointermove', 285, 135);
  assert.equal(stage.style.getPropertyValue('--les56-zoom-x'), '75%');
  assert.equal(stage.style.getPropertyValue('--les56-zoom-y'), '10%');
  t.click(t.$('[data-les56-lightbox-close]'));
  assert.equal(t.$('[data-les56-lightbox]').open, false);
  assert.equal(gallery.zoomed, false);
  t.click(t.$('[data-les56-slide]'));
  t.click(t.$('[data-les56-next]'));
  assert.equal(t.$('[data-les56-lightbox]').open, false);
  t.click(t.$('[data-les56-slide][data-index="1"]'));
  t.choose(variantInput(t, 55185604149626));
  assert.equal(gallery.querySelector('[data-les56-lightbox]').open, false);
  assert.equal(t.$('[data-les56-lightbox]').open, false);
  assert.equal(t.document.listeners.some((entry) => entry.type === 'keydown'), false);
});

test('the quantity in the URL preselects a configured quantity card', () => {
  const t = setup({ url: 'https://shop.test/products/lessive?variant=56810523722106&quantity=3' });
  assert.equal(quantityInput(t, 3).checked, true);
  assert.equal(t.payload().quantity, '3');
});

const bundleWidget = `
  <div class="bogos-fbt-widget">
    <h2>Fréquemment achetés ensemble</h2>
    <label><input type="checkbox" name="bundle_item" value="42" checked> L'Ultime Doseur</label>
    <button type="button" aria-label="Increase quantity">+</button>
  </div>`;

test('an app widget injected above the button is moved below the accordions and keeps its fields in the form', () => {
  const t = setup({ product: { ...lessive, injectedWidget: bundleWidget } });
  const widget = t.$('.bogos-fbt-widget');
  assert.equal(widget.parentNode, t.$('[data-les56-app-slot]'));
  assert.equal(t.form.contains(widget), false);
  assert.equal(t.form.querySelector('[data-les56-variant-id]').parentNode, t.form, 'own hidden fields stay');
  assert.equal(widget.querySelector('[name="bundle_item"]').getAttribute('form'), t.form.getAttribute('id'));
  assert.equal(widget.querySelector('button').hasAttribute('form'), false, 'widget buttons never become submitters');

  t.click(t.$('[data-les56-submit="main"]'));
  assert.equal(t.fetchCalls.length, 1, 'the theme ProductForm stays the only add-to-cart request');
  assert.deepEqual(t.fetchCalls[0].body.getAll('bundle_item'), ['42']);
  assert.deepEqual(t.fetchCalls[0].body.getAll('id'), ['56810523722106']);
});

test('a widget the app injects after load is relocated too', async () => {
  const t = setup();
  const widget = t.document.createElement('div');
  widget.setAttribute('class', 'late-app-widget');
  t.form.appendChild(widget);
  await flush();
  assert.equal(widget.parentNode, t.$('[data-les56-app-slot]'));
  assert.equal(t.form.querySelector('[data-les56-submit="main"]').parentNode, t.form);
});

test('relocated app fields name the real form ID although the variant field shadows form.id', async () => {
  const t = setup({ product: { ...lessive, injectedWidget: bundleWidget } });
  const formId = t.form.getAttribute('id');
  assert.equal(formId, 'les56-form-template--1__main');
  assert.equal(typeof t.form.id, 'object', 'form.id is the <input name="id">, as in a real browser');
  assert.equal(t.form.id, t.form.querySelector('[data-les56-variant-id]'));

  const bundleItem = t.$('[name="bundle_item"]');
  assert.equal(bundleItem.getAttribute('form'), formId);
  assert.equal(bundleItem.form, t.form);

  const lateWidget = t.document.createElement('div');
  const lateField = t.document.createElement('input');
  lateField.setAttribute('type', 'hidden');
  lateField.setAttribute('name', 'properties[_bundle]');
  lateField.setAttribute('value', 'doseur');
  lateWidget.appendChild(lateField);
  t.form.appendChild(lateWidget);
  await flush();
  assert.equal(lateWidget.parentNode, t.$('[data-les56-app-slot]'));
  assert.equal(lateField.getAttribute('form'), formId);

  t.click(t.$('[data-les56-submit="main"]'));
  assert.equal(t.fetchCalls.length, 1);
  assert.deepEqual(t.fetchCalls[0].body.getAll('id'), ['56810523722106']);
  assert.deepEqual(t.fetchCalls[0].body.getAll('bundle_item'), ['42']);
  assert.deepEqual(t.fetchCalls[0].body.getAll('properties[_bundle]'), ['doseur']);
});

// The "Fréquemment achetés ensemble" accessory checkbox has no name: FormData never sends it.
const accessoryWidget = `
  <div class="bogos-fbt-widget">
    <label><input type="checkbox" class="bogos-fbt-checkbox" value="doseur" checked> L'Ultime Doseur</label>
  </div>`;

/*
 * Mirrors the observed BOGOS behaviour: it binds a click hook on the CTA inside the form only (it
 * looks for external buttons through `form.id`, which is the variant input), cancels that click,
 * adds the checked accessories with its own request, then clicks the CTA again a few seconds later.
 */
function installAccessoryApp(t) {
  const cta = t.form.querySelector('[type="submit"]');
  const adds = [];
  let pendingAdd = null;
  let reclicking = false;
  cta.addEventListener('click', (event) => {
    if (reclicking) return;
    const accessories = t.root.querySelectorAll('.bogos-fbt-checkbox').filter((box) => box.checked).map((box) => box.value);
    if (!accessories.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pendingAdd) return;
    adds.push(accessories);
    pendingAdd = () => {
      pendingAdd = null;
      reclicking = true;
      cta.click();
      reclicking = false;
    };
  });
  // The accessory request resolves and the delayed forced click fires.
  return { adds, finishAdd: () => pendingAdd?.() };
}

function installCartDrawer(t) {
  const openers = [];
  const drawer = t.document.createElement('cart-drawer');
  // ProductForm passes the button whose focus the drawer restores on close.
  drawer.show = (opener) => openers.push(opener.dataset.les56Submit);
  t.document.body.appendChild(drawer);
  return openers;
}

test('the sticky button adds the checked accessory and the selected product once, like the main button', async () => {
  const t = setup({ product: { ...lessive, injectedWidget: accessoryWidget } });
  const app = installAccessoryApp(t);
  const openers = installCartDrawer(t);
  const sticky = t.$('[data-les56-submit="sticky"]');
  t.choose(variantInput(t, 55185604149626));
  t.choose(quantityInput(t, 2));
  t.choose(t.$('[data-les56-subscribe]'));

  t.click(sticky);
  assert.deepEqual(app.adds, [['doseur']], 'the app click hook ran for the sticky button');
  assert.equal(t.fetchCalls.length, 0, 'the product waits for the app, as with the main button');

  app.finishAdd();
  assert.equal(t.fetchCalls.length, 1);
  assert.deepEqual(t.fetchCalls[0].body.getAll('id'), ['55185604149626']);
  assert.deepEqual(t.fetchCalls[0].body.getAll('quantity'), ['2']);
  assert.deepEqual(t.fetchCalls[0].body.getAll('selling_plan'), [String(monthly.id)]);
  assert.deepEqual(app.adds, [['doseur']], 'the accessory is added once');
  assert.equal(t.document.nativeSubmissions.length, 0, 'no page-reloading submission');

  t.click(sticky);
  assert.deepEqual(app.adds, [['doseur']], 'no accessory while the product request is pending');
  assert.equal(t.fetchCalls.length, 1);

  t.fetchCalls[0].respond({ id: 1, quantity: 2, sections: {} });
  await flush();
  assert.deepEqual(openers, ['sticky'], 'closing the cart returns focus to the sticky button');
  assert.equal(t.$('[data-les56-submit="main"]').hasAttribute('aria-disabled'), false);
  assert.equal(sticky.hasAttribute('aria-disabled'), false);
});

test('without an app hook the sticky button submits the form once and keeps the focus', async () => {
  const t = setup();
  const openers = installCartDrawer(t);
  const sticky = t.$('[data-les56-submit="sticky"]');
  t.click(sticky);
  assert.equal(t.fetchCalls.length, 1);
  assert.equal(t.document.nativeSubmissions.length, 0);
  t.fetchCalls[0].respond({ id: 1, quantity: 1, sections: {} });
  await flush();
  assert.deepEqual(openers, ['sticky']);

  const main = t.$('[data-les56-submit="main"]');
  t.click(main);
  t.fetchCalls[1].respond({ id: 1, quantity: 1, sections: {} });
  await flush();
  assert.deepEqual(openers, ['sticky', 'main'], 'the main button keeps its own focus return');
});

test('a sold-out fragrance adds nothing from the sticky button, not even the accessory', () => {
  const t = setup({ product: { ...lessive, injectedWidget: accessoryWidget } });
  const app = installAccessoryApp(t);
  t.choose(variantInput(t, 55185598251386));
  t.click(t.$('[data-les56-submit="sticky"]'));
  assert.deepEqual(app.adds, []);
  assert.equal(t.fetchCalls.length, 0);
  assert.equal(t.document.nativeSubmissions.length, 0);
});

test('a main button click after an unfinished sticky add keeps the main focus return', async () => {
  const t = setup({ product: { ...lessive, injectedWidget: accessoryWidget } });
  const app = installAccessoryApp(t);
  const openers = installCartDrawer(t);
  const main = t.$('[data-les56-submit="main"]');
  t.click(t.$('[data-les56-submit="sticky"]'));
  // The app never re-clicks (its request failed); the shopper uses the main button instead.
  t.click(main);
  app.finishAdd();
  assert.equal(t.fetchCalls.length, 1);
  t.fetchCalls[0].respond({ id: 1, quantity: 1, sections: {} });
  await flush();
  assert.deepEqual(openers, ['main']);
});

test('an app block adds its spacing only while its output takes up room', () => {
  const t = setup({ resizeObserver: true });
  const block = t.$('[data-les56-app]');
  const observer = t.resizeObservers.find((item) => item.targets.includes(block));
  assert.ok(observer, 'app block observed');
  assert.equal(block.classList.contains('has-content'), false);

  observer.callback([{ target: block, contentRect: { height: 0 } }]);
  assert.equal(block.classList.contains('has-content'), false, 'empty app container takes no room');
  observer.callback([{ target: block, contentRect: { height: 64 } }]);
  assert.equal(block.classList.contains('has-content'), true);
  observer.callback([{ target: block, contentRect: { height: 0 } }]);
  assert.equal(block.classList.contains('has-content'), false);

  t.root.remove();
  assert.deepEqual(observer.targets, [], 'observer released with the section');
});

test('without ResizeObserver an app block keeps its spacing', () => {
  const t = setup();
  assert.equal(t.$('[data-les56-app]').classList.contains('has-content'), true);
});

// ---------------------------------------------------------------------------
// Template and markup contracts
// ---------------------------------------------------------------------------

const schema = JSON.parse(sectionSource.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/)[1]);

test('the default product template uses the LES-56 section without losing merchant data', () => {
  const main = productTemplate.sections.cluutch_main_product_7yzPKV;
  assert.equal(main.type, 'les56-main-product');
  const blockTypes = new Set(schema.blocks.map((block) => block.type));
  for (const block of Object.values(main.blocks)) {
    const type = block.type.startsWith('shopify://apps/') ? '@app' : block.type;
    assert.ok(blockTypes.has(type), `block type ${block.type} is declared`);
  }
  const settingIds = new Set(schema.settings.map((setting) => setting.id));
  for (const id of Object.keys(main.settings)) assert.ok(settingIds.has(id), `setting ${id} is declared`);
  assert.deepEqual(
    main.block_order.filter((id) => main.blocks[id].type === 'quantity-button').map((id) => main.blocks[id].settings.value),
    [1, 2, 3, 6],
  );
});

test('legacy layout settings the fixed design ignores are hidden but keep their stored data', () => {
  const ignored = ['gallery_layout', 'image_zoom', 'mobile_layout', 'padding_top', 'padding_bottom', 'padding_top_mobile', 'padding_bottom_mobile'];
  const markup = sectionSource.replace(/{%\s*schema\s*%}[\s\S]*$/, '');
  const stored = productTemplate.sections.cluutch_main_product_7yzPKV.settings;
  const hidden = schema.settings.filter((setting) => 'visible_if' in setting).map((setting) => setting.id);
  assert.deepEqual(hidden.sort(), [...ignored].sort(), 'only the ignored settings are hidden');
  for (const id of ignored) {
    const setting = schema.settings.find((candidate) => candidate.id === id);
    assert.equal(setting.visible_if, '{{ false }}', id);
    assert.doesNotMatch(markup, new RegExp(`section\\.settings\\.${id}\\b`), `${id} is not read by the section`);
    // The stored value stays valid against the declared setting, so it can be restored as is.
    assert.ok(id in stored, `${id} is stored`);
    if (setting.type === 'select') {
      const values = setting.options.map((option) => option.value);
      assert.ok(values.includes(setting.default) && values.includes(stored[id]), id);
    } else {
      for (const value of [setting.default, stored[id]]) {
        assert.ok(value >= setting.min && value <= setting.max && (value - setting.min) % setting.step === 0, `${id}: ${value}`);
      }
    }
  }
});

test('the section does not load legacy product scripts or the legacy variant snippet', () => {
  for (const legacy of ['cluutch-main-product.js', 'cluutch-buy-product.js', 'cluutch-main-product.css', "'cluutch-product-variant'"]) {
    assert.equal(sectionSource.includes(legacy), false, legacy);
  }
  assert.match(sectionSource, /'les56-product\.js' \| asset_url/);
});

test('every DOM hook used by the script is rendered by the section', () => {
  const hooks = new Set(productScript.match(/data-les56-[a-z-]+/g));
  for (const hook of hooks) assert.ok(sectionSource.includes(hook), `${hook} rendered`);
});

test('quantity discounts and the popular mention depend on the product discount tag, not on block settings alone', () => {
  const eligibility = sectionSource.match(/assign quantity_discounts = false[\s\S]*?endif/)[0];
  assert.match(eligibility, /product\.tags contains discount_tag/);
  assert.equal(schema.settings.find((setting) => setting.id === 'quantity_discount_tag').default, 'data-discount');
  assert.match(sectionSource, /if quantity_discounts\s+assign discount_text = quantity_block\.settings\.discount/);
  assert.match(sectionSource, /if quantity_discounts and quantity_block\.settings\.value == default_quantity/);
  assert.match(sectionSource, /if quantity_discounts and quantity_value == section\.settings\.popular_quantity/);
});

test('the family headline and badges are limited to the configured product type', () => {
  const settings = Object.fromEntries(schema.settings.map((setting) => [setting.id, setting.default]));
  assert.equal(settings.family_product_types, 'Lessive liquide');
  assert.equal(settings.family_headline, 'La lessive naturelle <em>vraiment</em> efficace');
  assert.match(sectionSource, /assign product_type_key = product\.type \| strip \| downcase/);
  const familyBlock = sectionSource.match(/<div class="les56-family"[\s\S]*?<\/div>/)[0];
  assert.match(familyBlock, /^<div class="les56-family" {{ block\.shopify_attributes }}>\s*{%- if in_family -%}/);
  assert.match(familyBlock, /section\.settings\.badges/);
  assert.doesNotMatch(sectionSource, /data-les56-region="description"/, 'no per-variant tagline region');
});

test('state classes set by the section and script are styled', () => {
  assert.match(sectionSource, /<span class="les56-badge__icon">/);
  assert.match(productStyles, /\.les56-badge__icon\s*{[^}]*width:/);
  assert.match(productScript, /'has-content'/);
  assert.match(productStyles, /\.les56-app:not\(\.has-content\)\s*{\s*margin-top: 0;/);
  assert.match(productScript, /'is-zoomed'/);
  assert.match(productStyles, /\.les56-lightbox\.is-zoomed [^{]*\.les56-lightbox__image\s*{[^}]*transform: scale\(/);
});

test('the per-litre unit comes from Shopify unit pricing or a litre option value, never from a product id', () => {
  assert.match(sectionSource, /for option_value in variant\.options/);
  assert.match(sectionSource, /assign variant_unit_label = 'L'/);
  assert.doesNotMatch(sectionSource.replace(/{%\s*schema\s*%}[\s\S]*$/, ''), /\b\d{10,}\b/, 'no hard-coded product or variant id');
});

test('fragrance colours and names come from the merchant variant data, the Figma palette only filling an empty field', () => {
  const markup = sectionSource.replace(/{%\s*schema\s*%}[\s\S]*$/, '');
  const loop = markup.slice(markup.indexOf('assign fragrance_key = variant.option1'), markup.indexOf('{%- capture fragrance_card -%}'));
  const card = markup.slice(markup.indexOf('{%- capture fragrance_card -%}'), markup.indexOf('{%- endcapture -%}', markup.indexOf('{%- capture fragrance_card -%}')));
  const paletteEnd = loop.indexOf('endcase');
  assert.ok(paletteEnd > 0);
  for (const field of ['cluutch_variant_button_color', 'variant_text_color']) {
    const read = loop.indexOf(`variant.metafields.custom.${field}.value`);
    assert.ok(read > paletteEnd, `${field} overrides the palette`);
  }
  assert.match(loop, /if merchant_background != blank\s+assign fragrance_color = merchant_background/);
  assert.match(loop, /if merchant_text != blank\s+assign fragrance_text_color = merchant_text/);
  assert.match(loop, /assign fragrance_name = variant\.option1\b/, 'names come from the option value');
  assert.match(card, /data-fragrance-color="{{ fragrance_accent \| escape }}"/, 'chosen name in the accent colour');
  assert.match(card, /--les56-fragrance-accent: {{ fragrance_accent \| escape }}/);
  assert.match(productStyles, /\.les56-sr-only:checked \+ \.les56-fragrance::after\s*{[^}]*border: 3px solid var\(--les56-fragrance-accent\)/);
  // Real review data only.
  assert.match(markup, /assign rating = product\.metafields\.reviews\.rating\.value/);
  assert.match(markup, /assign rating_count = product\.metafields\.reviews\.rating_count\.value/);
});

test('the fragrance illustrations are the unedited Figma originals (Rectangle 1651–1655)', () => {
  const originals = {
    lavande: '1b1670051c6c85f09c2c3f4e7f209d8c5f899c35981f63abb430159c075f2a6b',
    'fleurs-blanches': 'cafda79bc2d1fac000ba4f65396c47424856d2f6010c817b3aaf8361ddab7d03',
    eucalyptus: '287efc5b5b0a57e21e04fd81394014064465d8b0593bc5ae65fab3da0a13e00a',
    'amande-douce': '9ed4b7c5fd71daab1933bce200158092ae3f335eb41eef26bb2a9c919f6e6488',
    bebe: 'f1bafe00ea21b02d8c6b13b1f38892044ea2e1ffcc07d804a092b1078a891427',
  };
  for (const [name, sha256] of Object.entries(originals)) {
    const bytes = readFileSync(new URL(`../assets/les56-fragrance-${name}.jpg`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, name);
  }
});
