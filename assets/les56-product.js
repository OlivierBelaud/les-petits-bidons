/*
 * LES-56 product section.
 *
 * Every variant's content and commerce data is rendered by Liquid, so a fragrance
 * change is applied synchronously and no response can arrive out of order.
 * The theme ProductForm (assets/theme.js) remains the only add-to-cart request:
 * the sticky button activates the main button, so app click hooks run for both.
 */
(() => {
  if (!window.customElements) return;

  const BASIS_POINTS = 10000;

  // Matches Shopify's quantity discount: one upward rounding per discounted unit.
  function lineTotal(unitCents, discountBasisPoints, quantity) {
    const unit = Math.ceil((unitCents * (BASIS_POINTS - discountBasisPoints)) / BASIS_POINTS);
    return unit * quantity;
  }

  // The design writes prices the French way (16,90€) whatever separator the shop format uses.
  function formatMoney(cents, format) {
    const [units, decimals] = (cents / 100).toFixed(2).split('.');
    const grouped = units.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const amounts = {
      amount_no_decimals: grouped,
      amount_no_decimals_with_comma_separator: grouped,
      amount_no_decimals_with_space_separator: grouped.replace(/\./g, ' '),
    };
    return (format || '{{amount}}€')
      .replace(/<[^>]*>/g, '')
      .replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => amounts[key] ?? `${grouped},${decimals}`)
      .trim();
  }

  class Les56Gallery extends HTMLElement {
    connectedCallback() {
      this.viewport = this.querySelector('[data-les56-viewport]');
      this.slides = Array.from(this.querySelectorAll('[data-les56-slide]'));
      this.thumbs = Array.from(this.querySelectorAll('[data-les56-thumb]'));
      this.dots = Array.from(this.querySelectorAll('[data-les56-dot]'));
      this.dialog = this.querySelector('[data-les56-zoom]');
      this.zoomImage = this.querySelector('[data-les56-zoom-image]');

      this.onClick = this.onClick.bind(this);
      this.onScroll = this.onScroll.bind(this);
      this.onZoomClosed = this.onZoomClosed.bind(this);
      this.onZoomKeydown = this.onZoomKeydown.bind(this);
      this.addEventListener('click', this.onClick);
      this.viewport?.addEventListener('scroll', this.onScroll, { passive: true });
      this.dialog?.addEventListener('close', this.onZoomClosed);
      this.dialog?.addEventListener('keydown', this.onZoomKeydown);

      this.setActive(0, false);
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      this.viewport?.removeEventListener('scroll', this.onScroll, { passive: true });
      this.dialog?.removeEventListener('keydown', this.onZoomKeydown);
      this.zoomTrigger = null;
      if (this.dialog?.open) this.dialog.close();
      this.dialog?.removeEventListener('close', this.onZoomClosed);
      cancelAnimationFrame(this.scrollFrame);
    }

    onClick(event) {
      const target = event.target;
      if (this.dialog?.open) {
        if (target === this.dialog || target.closest('[data-les56-zoom-close]')) this.closeZoom();
        else if (target.closest('[data-les56-zoom-image]')) this.dialog.classList.toggle('is-zoomed');
        return;
      }

      const thumb = target.closest('[data-les56-thumb]');
      if (thumb) {
        this.setActive(Number(thumb.dataset.index), true);
        // The clicked thumbnail is now hidden: keep keyboard focus on the image it selected.
        this.slides[this.activeIndex]?.focus({ preventScroll: true });
        return;
      }
      if (target.closest('[data-les56-prev]')) return this.setActive(this.activeIndex - 1, true);
      if (target.closest('[data-les56-next]')) return this.setActive(this.activeIndex + 1, true);

      const slide = target.closest('[data-les56-slide]');
      if (slide) this.openZoom(slide);
    }

    setActive(index, scroll) {
      const count = this.slides.length;
      if (!count) return;
      this.activeIndex = ((index % count) + count) % count;

      this.slides.forEach((slide, position) => {
        const active = position === this.activeIndex;
        slide.setAttribute('tabindex', active ? '0' : '-1');
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      this.thumbs.forEach((thumb) => {
        thumb.hidden = Number(thumb.dataset.index) === this.activeIndex;
      });
      this.dots.forEach((dot, position) => dot.classList.toggle('is-active', position === this.activeIndex));

      if (scroll && this.viewport) {
        this.scrollTarget = this.activeIndex;
        this.viewport.scrollTo({ left: this.viewport.clientWidth * this.activeIndex, behavior: 'smooth' });
      }
    }

    onScroll() {
      cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = requestAnimationFrame(() => {
        const width = this.viewport.clientWidth;
        if (!width) return;
        const index = Math.round(this.viewport.scrollLeft / width);
        // Ignore intermediate positions of a programmatic smooth scroll.
        if (this.scrollTarget !== undefined) {
          if (index !== this.scrollTarget) return;
          this.scrollTarget = undefined;
        }
        if (index !== this.activeIndex) this.setActive(index, false);
      });
    }

    openZoom(slide) {
      if (!this.dialog || typeof this.dialog.showModal !== 'function') return;
      this.zoomTrigger = slide;
      this.zoomImage.setAttribute('src', slide.dataset.zoomSrc);
      this.zoomImage.setAttribute('alt', slide.dataset.zoomAlt || '');
      this.dialog.classList.remove('is-zoomed');
      this.dialog.showModal();
      this.querySelector('[data-les56-zoom-close]')?.focus();
    }

    closeZoom() {
      if (this.dialog?.open) this.dialog.close();
    }

    onZoomKeydown(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      this.closeZoom();
    }

    onZoomClosed() {
      const trigger = this.zoomTrigger;
      this.zoomTrigger = null;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    }
  }

  class Les56Rotator extends HTMLElement {
    connectedCallback() {
      this.items = Array.from(this.querySelectorAll('[data-les56-rotator-item]'));
      this.dots = Array.from(this.querySelectorAll('[data-les56-rotator-dot]'));
      this.onClick = this.onClick.bind(this);
      this.addEventListener('click', this.onClick);
      this.show(0);

      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (this.items.length > 1 && !reducedMotion) {
        this.timer = setInterval(() => this.show(this.index + 1), Number(this.dataset.interval) || 3000);
      }
    }

    disconnectedCallback() {
      clearInterval(this.timer);
      this.removeEventListener('click', this.onClick);
    }

    onClick(event) {
      const dot = event.target.closest('[data-les56-rotator-dot]');
      if (!dot) return;
      clearInterval(this.timer);
      this.show(this.dots.indexOf(dot));
    }

    show(index) {
      const count = this.items.length;
      if (!count) return;
      this.index = ((index % count) + count) % count;
      this.items.forEach((item, position) => { item.hidden = position !== this.index; });
      this.dots.forEach((dot, position) => dot.setAttribute('aria-current', position === this.index ? 'true' : 'false'));
    }
  }

  class Les56Product extends HTMLElement {
    connectedCallback() {
      const json = this.querySelector('[data-les56-json]');
      if (!json) return;
      this.data = JSON.parse(json.textContent);
      this.productForm = this.querySelector('[data-les56-form]');
      this.variantIdInput = this.querySelector('[data-les56-variant-id]');
      this.subscribeInput = this.querySelector('[data-les56-subscribe]');
      this.planSelect = this.querySelector('[data-les56-plan]');
      this.mainButton = this.querySelector('[data-les56-submit="main"]');
      this.stickyButton = this.querySelector('[data-les56-submit="sticky"]');

      const initialId = Number(this.variantIdInput?.value);
      this.state = {
        variantId: this.variantById(initialId) ? initialId : this.data.variants[0].id,
        subscribed: Boolean(this.subscribeInput?.checked),
        planId: Number(this.planSelect?.value) || null,
      };

      this.onChange = this.onChange.bind(this);
      this.onSubmit = this.onSubmit.bind(this);
      this.onClick = this.onClick.bind(this);
      this.onClickCapture = this.onClickCapture.bind(this);
      this.onSubmitted = this.onSubmitted.bind(this);
      this.addEventListener('change', this.onChange);
      this.addEventListener('submit', this.onSubmit, true);
      this.addEventListener('click', this.onClick);
      this.addEventListener('click', this.onClickCapture, true);
      this.addEventListener('submit', this.onSubmitted);

      this.selectQuantityFromUrl();
      this.update();
      this.observeSticky();
      this.mirrorFormErrors();
      this.relocateAppWidgets();
      this.observeAppBlocks();
    }

    disconnectedCallback() {
      this.removeEventListener('change', this.onChange);
      this.removeEventListener('submit', this.onSubmit, true);
      this.removeEventListener('click', this.onClick);
      this.removeEventListener('click', this.onClickCapture, true);
      this.removeEventListener('submit', this.onSubmitted);
      this.stickyObserver?.disconnect();
      this.errorObserver?.disconnect();
      this.appObserver?.disconnect();
      this.appBlockObserver?.disconnect();
    }

    variantById(id) {
      return this.data.variants.find((variant) => variant.id === id);
    }

    get variant() {
      return this.variantById(this.state.variantId);
    }

    get quantityInputs() {
      return Array.from(this.querySelectorAll('[data-les56-quantity]'));
    }

    get quantity() {
      const selected = this.quantityInputs.find((input) => input.checked);
      return selected ? Number(selected.value) : 1;
    }

    get discountBasisPoints() {
      const selected = this.quantityInputs.find((input) => input.checked);
      return selected ? Number(selected.dataset.discountBp) || 0 : 0;
    }

    selectQuantityFromUrl() {
      const requested = new URL(window.location.href).searchParams.get('quantity');
      const input = this.quantityInputs.find((candidate) => candidate.value === requested);
      if (input) input.checked = true;
    }

    onChange(event) {
      const target = event.target;
      if (target.matches('[data-les56-variant-input]')) {
        this.selectVariant(Number(target.value));
      } else if (target === this.subscribeInput) {
        this.state.subscribed = target.checked;
        this.update();
      } else if (target === this.planSelect) {
        this.state.planId = Number(target.value) || null;
        this.update();
      } else if (target.matches('[data-les56-quantity]')) {
        this.update();
      }
    }

    // Capture phase: runs before ProductForm's own submit listener on the form.
    onSubmit(event) {
      if (event.target !== this.productForm) return;
      this.update();
      if (this.variant.available) return;
      event.preventDefault();
      event.stopPropagation();
    }

    /*
     * Apps such as BOGOS hook the click of the button inside the form (they cannot find external
     * `form=` buttons, `form.id` being the variant input): an accessory they add on that click would be
     * missed by a native sticky submission. The sticky click is therefore replayed on the main button,
     * whose app hooks may delay or repeat it before the form is submitted once.
     */
    onClick(event) {
      if (event.defaultPrevented || !this.mainButton || !event.target.closest('[data-les56-submit="sticky"]')) return;
      // While ProductForm is busy it ignores submissions: leave the sticky one to that guard, no app hook.
      if (this.mainButton.hasAttribute('aria-disabled')) return;
      event.preventDefault();
      this.stickyPending = true;
      this.mainButton.click();
    }

    // Capture phase, before app hooks that may cancel it: a shopper's own main click supersedes a
    // sticky click an app never completed.
    onClickCapture(event) {
      if (event.isTrusted && event.target.closest('[data-les56-submit="main"]')) this.stickyPending = false;
    }

    // Bubble phase: ProductForm has recorded the button whose focus the cart drawer restores on close.
    onSubmitted(event) {
      if (event.target !== this.productForm || event.submitter !== this.mainButton || !this.stickyPending) return;
      this.stickyPending = false;
      if (this.productForm.activeElement === this.mainButton) this.productForm.activeElement = this.stickyButton;
    }

    selectVariant(id) {
      if (id === this.state.variantId || !this.variantById(id)) return;
      this.state.variantId = id;
      this.renderVariantContent(id);

      const url = new URL(window.location.href);
      url.searchParams.set('variant', String(id));
      window.history.replaceState(window.history.state, '', url.toString());

      this.update();
    }

    renderVariantContent(id) {
      const template = this.querySelector(`[data-les56-variant-template="${id}"]`);
      if (!template) return;

      const openAccordions = new Set(
        Array.from(this.querySelectorAll('[data-les56-accordion]'))
          .filter((accordion) => accordion.open)
          .map((accordion) => accordion.dataset.les56Accordion),
      );

      for (const slot of template.content.querySelectorAll('[data-les56-slot]')) {
        const region = this.querySelector(`[data-les56-region="${slot.dataset.les56Slot}"]`);
        if (region) region.replaceChildren(...Array.from(slot.cloneNode(true).childNodes));
      }

      for (const accordion of this.querySelectorAll('[data-les56-accordion]')) {
        accordion.open = openAccordions.has(accordion.dataset.les56Accordion);
      }
    }

    // A frequency survives a fragrance change only if that fragrance sells it.
    resolvePlan(variant) {
      const plans = variant.plans || [];
      if (!plans.length) {
        this.state.subscribed = false;
        return null;
      }
      if (variant.requiresSellingPlan) this.state.subscribed = true;
      if (!this.state.subscribed) return null;
      const plan = plans.find((candidate) => candidate.id === this.state.planId) || plans[0];
      this.state.planId = plan.id;
      return plan;
    }

    update() {
      const variant = this.variant;
      const plan = this.resolvePlan(variant);
      const quantity = this.quantity;
      const money = (cents) => formatMoney(cents, this.data.moneyFormat);

      if (this.variantIdInput) this.variantIdInput.value = String(variant.id);
      for (const input of this.querySelectorAll('[data-les56-variant-input]')) {
        input.checked = Number(input.value) === variant.id;
        if (input.checked) this.renderFragranceName(input);
      }

      this.renderSubscription(variant, plan, quantity);

      const unitCents = plan ? plan.price : variant.price;
      const compareUnitCents = Math.max(variant.compareAtPrice || 0, variant.price);
      for (const input of this.quantityInputs) {
        const value = Number(input.value);
        const label = this.querySelector(`label[for="${input.id}"]`);
        if (!label) continue;
        this.renderPrice(
          label.querySelector('[data-les56-quantity-total]'),
          label.querySelector('[data-les56-quantity-compare]'),
          lineTotal(unitCents, Number(input.dataset.discountBp) || 0, value),
          compareUnitCents * value,
        );
      }

      const total = lineTotal(unitCents, this.discountBasisPoints, quantity);
      for (const button of this.querySelectorAll('[data-les56-submit]')) {
        button.disabled = !variant.available;
        this.renderPrice(
          button.querySelector('[data-les56-cta-total]'),
          button.querySelector('[data-les56-cta-compare]'),
          total,
          compareUnitCents * quantity,
        );
      }
      for (const label of this.querySelectorAll('[data-les56-submit-label]')) {
        label.textContent = variant.available ? this.dataset.addLabel : this.dataset.soldOutLabel;
      }

      const unitPrice = this.querySelector('[data-les56-unit-price]');
      if (unitPrice) unitPrice.textContent = money(variant.unitPrice ?? variant.price);
      const unitLabel = this.querySelector('[data-les56-unit-label]');
      if (unitLabel) {
        unitLabel.textContent = variant.unitLabel ? `/${variant.unitLabel}` : '';
        unitLabel.hidden = !variant.unitLabel;
      }

      const stickyTitle = this.querySelector('[data-les56-sticky-title]');
      if (stickyTitle) stickyTitle.textContent = variant.title;
    }

    renderFragranceName(input) {
      const name = this.querySelector('[data-les56-fragrance-name]');
      if (!name) return;
      name.textContent = input.dataset.fragranceName;
      name.style.setProperty('color', input.dataset.fragranceColor);
    }

    renderSubscription(variant, plan, quantity) {
      const container = this.querySelector('[data-les56-subscription]');
      if (!container) return;
      const plans = variant.plans || [];
      container.hidden = !plans.length;

      if (this.planSelect) {
        if (this.planSelect.dataset.variantId !== String(variant.id)) {
          this.planSelect.replaceChildren(...plans.map((candidate) => {
            const option = document.createElement('option');
            option.value = String(candidate.id);
            option.textContent = candidate.name;
            return option;
          }));
          this.planSelect.dataset.variantId = String(variant.id);
        }
        if (plan) this.planSelect.value = String(plan.id);
        // A disabled select is left out of the form data: one-time purchases send no plan.
        this.planSelect.disabled = !plan;
      }
      if (this.subscribeInput) {
        this.subscribeInput.checked = Boolean(plan);
        this.subscribeInput.disabled = Boolean(variant.requiresSellingPlan);
      }
      const frequency = this.querySelector('[data-les56-frequency]');
      if (frequency) frequency.hidden = !plan;

      const bubble = this.querySelector('[data-les56-subscription-bubble]');
      if (bubble) bubble.textContent = quantity > 1 ? bubble.dataset.copyMultiple : bubble.dataset.copySingle;
    }

    renderPrice(totalElement, compareElement, totalCents, compareCents) {
      const money = (cents) => formatMoney(cents, this.data.moneyFormat);
      if (totalElement) totalElement.textContent = money(totalCents);
      if (!compareElement) return;
      compareElement.textContent = money(compareCents);
      compareElement.hidden = compareCents <= totalCents;
    }

    observeSticky() {
      const sticky = this.querySelector('[data-les56-sticky]');
      const mainButton = this.querySelector('[data-les56-submit="main"]');
      if (!sticky || !mainButton || !('IntersectionObserver' in window)) return;

      const footer = document.querySelector('.footer-group');
      let passedMainButton = false;
      let footerVisible = false;
      this.stickyObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === mainButton) {
            passedMainButton = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
          } else if (entry.target === footer) {
            footerVisible = entry.isIntersecting;
          }
        }
        sticky.hidden = !passedMainButton || footerVisible;
      });
      this.stickyObserver.observe(mainButton);
      if (footer) this.stickyObserver.observe(footer);
    }

    // ProductForm writes errors inside the form; repeat them where the sticky button is.
    mirrorFormErrors() {
      const source = this.productForm?.querySelector('.product-form__error-message');
      const target = this.querySelector('[data-les56-sticky-error]');
      if (!source || !target || !('MutationObserver' in window)) return;
      this.errorObserver = new MutationObserver(() => {
        target.textContent = source.textContent;
        target.hidden = source.hidden || !source.textContent;
      });
      this.errorObserver.observe(source, { attributes: true, childList: true, characterData: true, subtree: true });
    }

    /*
     * App embeds (the BOGOS "Fréquemment achetés ensemble" widget) insert their markup into the
     * purchase form, above the button. The design keeps the button right after the subscription, so
     * such widgets are moved, not copied, below the accordions: their own listeners and state move
     * with them, and named fields still belong to the form through their form attribute.
     */
    relocateAppWidgets() {
      const slot = this.querySelector('[data-les56-app-slot]');
      const form = this.productForm;
      const buy = form?.closest('.les56-buy');
      // `form.id` is the variant `<input name="id">` (form named-property access), not the form's ID.
      const formId = form?.getAttribute('id');
      if (!slot || !formId || !buy || !('MutationObserver' in window)) return;

      const relocate = () => {
        for (const container of [buy, form]) {
          for (const node of Array.from(container.children)) {
            if (FORM_PARTS.has(node.tagName) || node.matches('.product-form__error-message')) continue;
            slot.append(node);
            for (const field of node.querySelectorAll('input[name], select[name], textarea[name]')) {
              if (!field.hasAttribute('form') && !field.closest('form')) field.setAttribute('form', formId);
            }
          }
        }
      };
      relocate();
      this.appObserver = new MutationObserver(relocate);
      this.appObserver.observe(buy, { childList: true });
      this.appObserver.observe(form, { childList: true });
    }

    // App blocks (a countdown with no running campaign) often render an empty container, which must not
    // add the block spacing; the spacing comes with the first output that takes up room.
    observeAppBlocks() {
      const blocks = Array.from(this.querySelectorAll('[data-les56-app]'));
      if (!blocks.length) return;
      if (!('ResizeObserver' in window)) {
        for (const block of blocks) block.classList.add('has-content');
        return;
      }
      this.appBlockObserver = new ResizeObserver((entries) => {
        for (const entry of entries) entry.target.classList.toggle('has-content', entry.contentRect.height > 0);
      });
      for (const block of blocks) this.appBlockObserver.observe(block);
    }
  }

  // Elements an app may add next to the purchase button that must stay where they are.
  const FORM_PARTS = new Set(['FORM', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT']);

  const define = (name, constructor) => {
    if (!customElements.get(name)) customElements.define(name, constructor);
  };
  define('les56-gallery', Les56Gallery);
  define('les56-rotator', Les56Rotator);
  define('les56-product', Les56Product);
})();
