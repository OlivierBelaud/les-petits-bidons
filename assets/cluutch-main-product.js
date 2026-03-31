// document.addEventListener("DOMContentLoaded", function () {
//   // let thumbsSwiper, mainSwiper;

//   // function initializeSliders() {
//   //   thumbsSwiper = new Swiper(".thumb-swiper", {
//   //     slidesPerView: 2,
//   //     initialSlide: 3,
//   //     spaceBetween: 12,
//   //     direction: "vertical",
//   //     navigation: {
//   //       nextEl: ".swiper-button-next",
//   //       prevEl: ".swiper-button-prev",
//   //     },
//   //   });

//   //   mainSwiper = new Swiper(".imgswiper", {
//   //     spaceBetween: 12,
//   //     slidesPerView: 1,
//   //     loop: true,
//   //     thumbs: {
//   //       swiper: thumbsSwiper,
//   //     },
//   //     navigation: {
//   //       nextEl: ".swiper-button-next",
//   //       prevEl: ".swiper-button-prev",
//   //     },
//   //   });
//   // }

//   // function initializeSliders() {
//   //   if (window.innerWidth > 768) {
//   //     thumbsSwiper = new Swiper(".thumb-swiper", {
//   //       slidesPerView: 2,
//   //       initialSlide: 3,
//   //       spaceBetween: 12,
//   //       direction: "vertical",
//   //       navigation: {
//   //         nextEl: ".swiper-button-next",
//   //         prevEl: ".swiper-button-prev",
//   //       },
//   //     });

//   //     mainSwiper = new Swiper(".imgswiper", {
//   //       spaceBetween: 12,
//   //       slidesPerView: 1,
//   //       loop: true,
//   //       thumbs: {
//   //         swiper: thumbsSwiper,
//   //       },
//   //       navigation: {
//   //         nextEl: ".swiper-button-next",
//   //         prevEl: ".swiper-button-prev",
//   //       },
//   //     });
//   //   } else {
//   //     mainSwiper = new Swiper(".imgswiper", {
//   //       spaceBetween: 12,
//   //       slidesPerView: 1,
//   //       loop: true,
//   //       navigation: {
//   //         nextEl: ".swiper-button-next",
//   //         prevEl: ".swiper-button-prev",
//   //       },
//   //       pagination: {
//   //         el: ".swiper-pagination",
//   //         type: "bullets",
//   //       },
//   //     });
//   //   }
//   // }

//   // function updateSlidersContent(productData) {
//   //   const thumbsWrapper = document.querySelector(
//   //     ".thumb-swiper .swiper-wrapper"
//   //   );
//   //   const mainSliderWrapper = document.querySelector(
//   //     ".imgswiper .swiper-wrapper"
//   //   );

//   //   thumbsWrapper.innerHTML = "";
//   //   mainSliderWrapper.innerHTML = "";
//   //   productData.images.forEach((image) => {
//   //     const thumbSlide = document.createElement("div");
//   //     thumbSlide.classList.add("swiper-slide");
//   //     thumbSlide.innerHTML = `<img src="${image}" class="product-media__thumbnail" alt="${productData.title}">`;
//   //     thumbsWrapper.appendChild(thumbSlide);

//   //     const mainSlide = document.createElement("div");
//   //     mainSlide.classList.add("swiper-slide");
//   //     mainSlide.innerHTML = `<img src="${image}" class="product-media__thumbnail" alt="${productData.title}">`;
//   //     mainSliderWrapper.appendChild(mainSlide);
//   //   });

//   //   if (thumbsSwiper) thumbsSwiper.destroy(true, true);
//   //   if (mainSwiper) mainSwiper.destroy(true, true);
//   //   initializeSliders();
//   // }

//   // function updateProductPrice(productData) {
//   //   const productPriceElement = document.querySelector(".product__price");

//   //   if (!productPriceElement || !productData || !productData.variants) {
//   //     return;
//   //   }

//   //   const firstAvailableVariant = productData.variants.find(
//   //     (variant) => variant.available
//   //   );

//   //   if (firstAvailableVariant) {
//   //     const price = (parseFloat(firstAvailableVariant.price) / 100).toFixed(2);
//   //     const compareAtPrice = firstAvailableVariant.compare_at_price
//   //       ? (parseFloat(firstAvailableVariant.compare_at_price) / 100).toFixed(2)
//   //       : null;

//   //     let priceHtml = `<span class="main-price">${price}€</span>`;

//   //     if (compareAtPrice && parseFloat(compareAtPrice) > parseFloat(price)) {
//   //       const discount = Math.round(
//   //         ((parseFloat(compareAtPrice) - parseFloat(price)) /
//   //           parseFloat(compareAtPrice)) *
//   //           100
//   //       );
//   //       priceHtml = `
//   //         <span class="main-price main-price-discount">${price}€</span>
//   //         <span class="discount">(${discount}% OFF)</span>
//   //         <span class="old-price">${compareAtPrice}€</span>`;
//   //     } else {
//   //       priceHtml = `<div class="main-price">${price}€</div>`;
//   //     }

//   //     productPriceElement.innerHTML = priceHtml;
//   //   }
//   // }

//   // function updateSpoilers(activeHandle) {
//   //   document
//   //     .querySelectorAll(".product-spoilers details")
//   //     .forEach((spoiler) => {
//   //       spoiler.style.display =
//   //         spoiler.dataset.handle === activeHandle ? "block" : "none";
//   //     });
//   // }

//   // function updateRating(activeHandle) {
//   //   document.querySelectorAll(".product-rating-cool").forEach((spoiler) => {
//   //     spoiler.style.display =
//   //       spoiler.dataset.handle === activeHandle ? "block" : "none";
//   //   });
//   // }

//   // function formatRichText(richTextJson) {
//   //   if (!richTextJson || !richTextJson.children) return "";

//   //   return richTextJson.children
//   //     .map((node) => {
//   //       if (node.type === "paragraph") {
//   //         return `<p>${formatRichText(node)}</p>`;
//   //       }
//   //       if (node.type === "text") {
//   //         return node.value;
//   //       }
//   //       return "";
//   //     })
//   //     .join("");
//   // }

//   // function formatPrice(price) {
//   //   if (isNaN(price)) return "0.00€";
//   //   return `${(parseFloat(price) / 100).toFixed(2)}€`;
//   // }

//   // function setActiveSizeButton(
//   //   button,
//   //   variantIdInput,
//   //   submitButton,
//   //   variantPriceInput
//   // ) {
//   //   const productSizesContainer = document.querySelector(".product-sizes");
//   //   const variantId = button.dataset.variantId;
//   //   const variantPrice = parseFloat(button.dataset.variantPrice);
//   //   variantIdInput.value = variantId;
//   //   updateSellingPlan();

//   //   document.querySelectorAll(".plan-selector").forEach((selector) => {
//   //     selector.style.display =
//   //       selector.dataset.variant === variantId ? "block" : "none";
//   //   });

//   //   const activePlanSelector = document.querySelector(
//   //     `.plan-selector[data-variant="${variantId}"]`
//   //   );

//   //   if (!activePlanSelector) {
//   //     document.querySelectorAll(".plan-selector").forEach((selector) => {
//   //       selector.style.display = "none";
//   //     });
//   //     const sellingPlanInput = document.querySelector(
//   //       ".selected-selling-plan-id"
//   //     );
//   //     if (sellingPlanInput) {
//   //       sellingPlanInput.value = "";
//   //     }
//   //   } else {
//   //     const oneTimeButton =
//   //       activePlanSelector.querySelector(".button-one-time");
//   //     const subscribeButton =
//   //       activePlanSelector.querySelector(".button-subscribe");
//   //     // const oneTimePriceElement =
//   //     //   activePlanSelector.querySelector(".one-time-price");
//   //     const planPriceElement = activePlanSelector.querySelector(".plan-price");
//   //     const percentPriceElement =
//   //       activePlanSelector.querySelector(".percent-price");

//   //     if (subscribeButton) {
//   //       subscribeButton.checked = true;
//   //     }

//   //     function updatePrice() {
//   //       if (oneTimePriceElement) {
//   //         oneTimePriceElement.innerHTML = formatPrice(variantPrice);
//   //       }
//   //       if (oneTimeButton && oneTimeButton.checked) {
//   //         variantPriceInput.innerHTML = formatPrice(variantPrice);
//   //         if (percentPriceElement) {
//   //           percentPriceElement.innerHTML = "";
//   //         }
//   //       } else if (subscribeButton && subscribeButton.checked) {
//   //         const planWrapper = activePlanSelector.querySelector(
//   //           ".plan-button-select-wrapper"
//   //         );
//   //         if (planWrapper) {
//   //           const planSelect = planWrapper.querySelector(".plan-button-select");
//   //           if (planSelect && planSelect.options.length > 0) {
//   //             const selectedOption =
//   //               planSelect.options[planSelect.selectedIndex];
//   //             if (selectedOption && selectedOption.dataset) {
//   //               const planPrice = parseFloat(selectedOption.dataset.planPrice);
//   //               let discountPercent = Math.round(
//   //                 ((variantPrice - planPrice) / variantPrice) * 100
//   //               );
//   //               variantPriceInput.innerHTML = `<s>${formatPrice(
//   //                 variantPrice
//   //               )}</s> ${formatPrice(planPrice)}`;
//   //               if (planPriceElement) {
//   //                 planPriceElement.innerHTML = `<s>${formatPrice(
//   //                   variantPrice
//   //                 )}</s> ${formatPrice(planPrice)}`;
//   //               }
//   //               if (percentPriceElement) {
//   //                 percentPriceElement.innerHTML = `${discountPercent}%`;
//   //               }
//   //             }
//   //           }
//   //         }
//   //       }
//   //     }

//   //     const planSelect = activePlanSelector.querySelector(
//   //       ".plan-button-select"
//   //     );
//   //     if (planSelect) {
//   //       planSelect.addEventListener("change", updatePrice);
//   //     }

//   //     updatePrice();

//   //     if (oneTimeButton) {
//   //       oneTimeButton.addEventListener("change", updatePrice);
//   //     }
//   //     if (subscribeButton) {
//   //       subscribeButton.addEventListener("change", updatePrice);
//   //     }

//   //     activePlanSelector
//   //       .querySelectorAll(".plan-button-select")
//   //       .forEach((planButton) => {
//   //         planButton.addEventListener("change", updatePrice);
//   //       });

//   //     updatePrice();
//   //   }

//   //   productSizesContainer
//   //     .querySelectorAll(".size-option")
//   //     .forEach((btn) => btn.classList.remove("active"));
//   //   button.classList.add("active");

//   //   if (button.classList.contains("unavailable")) {
//   //     submitButton.setAttribute("disabled", "disabled");
//   //     submitButton.classList.add("disabled");
//   //   } else {
//   //     submitButton.removeAttribute("disabled");
//   //     submitButton.classList.remove("disabled");
//   //   }
//   // }

//   // function setActiveColor(selectedButton) {
//   //   document.querySelectorAll(".related-product-button").forEach((button) => {
//   //     button.classList.remove("active");
//   //   });
//   //   selectedButton.classList.add("active");
//   // }

//   // function loadProductData(handle, selectedButton) {
//   //   fetch(`/products/${handle}.js`)
//   //     .then((response) => {
//   //       if (!response.ok) {
//   //         throw new Error(`Error: ${handle}`);
//   //       }
//   //       return response.json();
//   //     })
//   //     .then((productData) => {
//   //       const newURL = `/products/${handle}`;
//   //       window.history.replaceState({ path: newURL }, "", newURL);
//   //       document.querySelector(".cluutch-product-title-bread").textContent =
//   //         productData.title;
//   //       document.querySelector(".product__title h1").textContent =
//   //         productData.title;
//   //       updateSlidersContent(productData);
//   //       updateSpoilers(handle);
//   //       updateRating(handle);
//   //       // updateProductPrice(productData);
//   //       console.log(productData.variants);
//   //       const query = `
//   //       {
//   //         productByHandle(handle: "${handle}") {
//   //           metafield(namespace: "custom", key: "cluutch_paragraphe_seo") {
//   //             value
//   //           }
//   //           variants(first: 50) {
//   //             edges {
//   //               node {
//   //                 id
//   //                 title
//   //                 availableForSale
//   //                 variantDiscount: metafield(namespace: "custom", key: "variant_discount") {
//   //                   value
//   //                 }
//   //                 variantImage: metafield(namespace: "custom", key: "cluutch_variant_image") {
//   //                   reference {
//   //                     ... on MediaImage {
//   //                       image {
//   //                         originalSrc
//   //                       }
//   //                     }
//   //                   }
//   //                   value
//   //                 }
//   //               }
//   //             }
//   //           }
//   //         }
//   //       }`;

//   //       fetch(
//   //         "https://lespetitsbidons.myshopify.com/api/2023-01/graphql.json",
//   //         {
//   //           method: "POST",
//   //           headers: {
//   //             "Content-Type": "application/json",
//   //             "X-Shopify-Storefront-Access-Token":
//   //               "bf6607475f059377c1cec8c0dab9decf",
//   //           },
//   //           body: JSON.stringify({ query }),
//   //         }
//   //       )
//   //         .then((response) => response.json())
//   //         .then((data) => {
//   //           if (data.data && data.data.productByHandle) {
//   //             const richTextJson = JSON.parse(
//   //               data.data.productByHandle.metafield.value || "{}"
//   //             );
//   //             document.querySelector(
//   //               ".cluutch-main-product__paragraphe"
//   //             ).innerHTML = formatRichText(richTextJson);

//   //             const variantDiscounts = {};
//   //             const variantAvailability = {};
//   //             const variantImages = {};

//   //             data.data.productByHandle.variants.edges.forEach((edge) => {
//   //               const variantId = edge.node.id.split("/").pop();
//   //               variantDiscounts[variantId] =
//   //                 edge.node.variantDiscount?.value || "";
//   //               variantAvailability[variantId] = edge.node.availableForSale;

//   //               variantImages[variantId] =
//   //                 edge.node.variantImage?.reference?.image?.originalSrc ||
//   //                 edge.node.variantImage?.value ||
//   //                 "";
//   //             });

//   //             const sizeOptionsContainer =
//   //               document.querySelector(".product-sizes");
//   //             const productForm = document.querySelector(".product-form");
//   //             const variantIdInput = productForm.querySelector('[name="id"]');
//   //             const submitButton = productForm.querySelector('[type="submit"]');

//   //             if (sizeOptionsContainer) {
//   //               sizeOptionsContainer.innerHTML = "";

//   //               let firstAvailableButton = null;

//   //               productData.variants.forEach((variant) => {
//   //                 const sizeOption = document.createElement("button");
//   //                 sizeOption.classList.add("size-option");

//   //                 const span = document.createElement("span");
//   //                 span.textContent = variant.option1;
//   //                 sizeOption.appendChild(span);

//   //                 const discountSpan = document.createElement("span");
//   //                 discountSpan.classList.add("size-discount");
//   //                 discountSpan.textContent = variantDiscounts[variant.id]
//   //                   ? `${variantDiscounts[variant.id]}`
//   //                   : "";
//   //                 sizeOption.appendChild(discountSpan);

//   //                 const discountIcon = document.createElement("img");
//   //                 discountIcon.classList.add("size-discount-icon");
//   //                 if (variantImages[variant.id]) {
//   //                   discountIcon.src = variantImages[variant.id];
//   //                 }
//   //                 sizeOption.appendChild(discountIcon);

//   //                 sizeOption.dataset.variantId = variant.id;

//   //                 sizeOption.dataset.variantPrice = variant.price;

//   //                 if (
//   //                   variant.selling_plan_allocations &&
//   //                   variant.selling_plan_allocations.length > 0
//   //                 ) {
//   //                   sizeOption.dataset.sellingPlanPrice =
//   //                     variant.selling_plan_allocations
//   //                       .map((plan) => plan.price)
//   //                       .join(",");
//   //                 }

//   //                 if (!variantAvailability[variant.id]) {
//   //                   sizeOption.disabled = true;
//   //                   sizeOption.classList.add("unavailable");
//   //                 } else if (!firstAvailableButton) {
//   //                   firstAvailableButton = sizeOption;
//   //                 }

//   //                 sizeOptionsContainer.appendChild(sizeOption);
//   //               });

//   //               if (firstAvailableButton) {
//   //                 setActiveSizeButton(
//   //                   firstAvailableButton,
//   //                   variantIdInput,
//   //                   submitButton,
//   //                   document.querySelector(".main-price")
//   //                 );
//   //               }

//   //               sizeOptionsContainer
//   //                 .querySelectorAll(".size-option")
//   //                 .forEach((sizeButton) => {
//   //                   sizeButton.addEventListener("click", function () {
//   //                     setActiveSizeButton(
//   //                       this,
//   //                       variantIdInput,
//   //                       submitButton,
//   //                       document.querySelector(".main-price")
//   //                     );
//   //                   });
//   //                 });
//   //             }
//   //           }
//   //         })
//   //         .catch((error) => console.error("GraphQL Error:", error));
//   //     })
//   //     .catch((error) => console.error("Error:", error));
//   // }

//   // const pdpSection = document.querySelector(".cluutch-main-product");

//   // if (pdpSection) {
//   //   document.querySelectorAll(".related-product-button").forEach((button) => {
//   //     button.addEventListener("click", function () {
//   //       const handle = this.getAttribute("data-handle");
//   //       setActiveColor(this);
//   //       pdpSection.style.opacity = "0";
//   //       setTimeout(() => {
//   //         loadProductData(handle, this);
//   //       }, 400);
//   //       setTimeout(() => {
//   //         pdpSection.style.opacity = "1";
//   //       }, 800);
//   //     });
//   //   });
//   // }

//   // setTimeout(() => {
//   //   document.querySelector(".cluutch-main-product").style.opacity = "1";
//   // }, 500);

// //   const defaultButton = document.querySelector(
// //     ".related-product-button.active"
// //   );
// //   if (defaultButton) {
// //     const defaultHandle = defaultButton.getAttribute("data-handle");
// //     loadProductData(defaultHandle, defaultButton);
// //   }
// });

//old logic

document.addEventListener("DOMContentLoaded", function () {
  const hiddenQuantity = document.querySelector(".hidden-quantity");
  const quantityRadios = document.querySelectorAll(
    'input[type="radio"][name="quantity"]'
  );

  const urlParams = new URLSearchParams(window.location.search);
  const quantityParam = urlParams.get("quantity");

  let matchedRadio = null;

  if (quantityParam) {
    quantityRadios.forEach((radio) => {
      if (radio.value === quantityParam) {
        radio.checked = true;
        matchedRadio = radio;
      } else {
        radio.checked = false;
      }
    });
  }

  if (!matchedRadio) {
    const firstRadio = quantityRadios[0];
    if (firstRadio) {
      firstRadio.checked = true;
      matchedRadio = firstRadio;
    }
  }

  if (matchedRadio) {
    hiddenQuantity.value = matchedRadio.value;
  }

  quantityRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      if (this.checked) {
        hiddenQuantity.value = this.value;
      }
    });
  });
});

function updatePriceFromQuantity(radio) {
  const priceElement = document.querySelector(".product__price");
  const oneTimePriceElements = document.querySelectorAll(".one-time-price");
  const planPriceElements = document.querySelectorAll(".plan-price");
  const label = radio.dataset.label;

  const dataPriceEl = radio.closest('.product-quantity__button')?.querySelector('.data-main-price');
  const price = parseFloat(dataPriceEl?.dataset.price);
  const compare = parseFloat(dataPriceEl?.dataset.compare);

  if (!isNaN(price)) {
    if (priceElement) {
      if (!isNaN(compare) && compare > price) {
        priceElement.innerHTML = `${price.toFixed(2)}€ <s>${compare.toFixed(2)}€</s>`;
      } else {
        priceElement.innerHTML = `${price.toFixed(2)}€ `;
      }
    }

    oneTimePriceElements.forEach((el) => {
      if (!isNaN(compare) && compare > price) {
        el.innerHTML = `<strong>${price.toFixed(
          2
        )}€</strong>  
        <span class="compare-price cluutch-compare-price">${compare.toFixed(
          2
        )}€</span> 
        <p class="cluutch-compare-price--label">${label}</p>`;
      } else {
        el.innerHTML = `<strong>${price.toFixed(2)}€</strong> `;
      }
    });

    planPriceElements.forEach((el) => {
      el.innerHTML = `<s>${price.toFixed(2)}€</s>`;
    });
  }
}

document.querySelectorAll('input[type="radio"][name="quantity"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      if (this.checked) {
        updatePriceFromQuantity(this);
      }
    });
  });

document.addEventListener("DOMContentLoaded", function () {
  const radios = document.querySelectorAll(
    'input[type="radio"][name="quantity"]'
  );
  const firstChecked = Array.from(radios).find((r) => r.checked) || radios[0];

  if (firstChecked) {
    firstChecked.checked = true;
    updatePriceFromQuantity(firstChecked);
  }
});

function getSelectedQuantityPrice() {
  const selectedRadio = document.querySelector(
    'input[type="radio"][name="quantity"]:checked'
  );

  if (!selectedRadio) return null;

  const dataPriceEl = selectedRadio.closest('.product-quantity__button')?.querySelector('.data-main-price');
  const price = parseFloat(dataPriceEl?.dataset.price);
  return isNaN(price) ? null : price;
}

function shopifyBankersRound(value) {
  const scaled = value * 100;
  const int = Math.floor(scaled);
  const decimal = scaled - int;

  if (decimal === 0.5) {
    return (int % 2 === 0 ? int : int + 1) / 100;
  }

  return Math.round(scaled) / 100;
}

function shopifyRound(value) {
  const scaled = value * 100;
  const fractional = scaled % 1;

  if (fractional === 0.5) {
    return (Math.floor(scaled) + 1) / 100;
  }

  return Math.round(scaled) / 100;
}

function updatePlanPricing() {
  const selectedRadio = document.querySelector('input[name="quantity"]:checked');
  if (!selectedRadio) return;

  const priceEl = selectedRadio.closest('.product-quantity__button')?.querySelector('.data-main-price');
  const quantity = parseInt(selectedRadio.value, 10);
  if (!priceEl || isNaN(quantity)) return;

  const comparePrice = parseFloat(priceEl.dataset.price);
  if (isNaN(comparePrice)) return;

  const unitAfterQuantityDiscount = comparePrice / quantity;

  const planSelectors = document.querySelectorAll('.plan-selector');

  planSelectors.forEach((selector) => {
    const planSelect = selector.querySelector('.plan-button-select');
    const planPriceEl = selector.querySelector('.plan-price');
    const percentPriceEl = selector.querySelector('.percent-price');
    const subscribeButton = selector.querySelector('.button-subscribe');
    const oneTimeButton = selector.querySelector('.button-one-time');

    if (!planSelect || !planPriceEl || !percentPriceEl) return;

    const selectedOption = planSelect.options[planSelect.selectedIndex];
    const subscriptionDiscount = parseFloat(selectedOption.dataset.percent || '0');
    if (isNaN(subscriptionDiscount)) return;

    let total = 0;
    for (let i = 0; i < quantity; i++) {
      const afterSub = unitAfterQuantityDiscount * (1 - subscriptionDiscount / 100);
      const rounded = shopifyRound(afterSub);
      total += rounded;
    }

    const original = comparePrice.toFixed(2);

    if (subscribeButton && subscribeButton.checked) {
      planPriceEl.innerHTML = `${total.toFixed(2)}€ <span class="cluutch-compare-price">${original}€</span>`;
      percentPriceEl.textContent = subscriptionDiscount > 0 ? `-${subscriptionDiscount}%` : '';
    }

    if (oneTimeButton && oneTimeButton.checked) {
      planPriceEl.innerHTML = '';
      percentPriceEl.textContent = '';
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  updatePlanPricing();

  document
    .querySelectorAll(".button-subscribe, .button-one-time")
    .forEach((radio) => {
      radio.addEventListener("change", updatePlanPricing);
    });

  document.querySelectorAll(".plan-button-select").forEach((select) => {
    select.addEventListener("change", updatePlanPricing);
  });

  document
    .querySelectorAll('input[type="radio"][name="quantity"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        updatePriceFromQuantity(radio);
        updatePlanPricing();
      });
    });
});

document.addEventListener("DOMContentLoaded", function () {
  const buttons = document.querySelectorAll(".variant-button");
  const selectors = document.querySelectorAll(".plan-selector");
  const hiddenInput = document.getElementById("product-variant-id");
  const urlParams = new URLSearchParams(window.location.search);
  const variantFromUrl = urlParams.get("variant");

  function activateVariant(variantId) {
    let valid = false;

    buttons.forEach((button) => {
      const isMatch = button.dataset.variant === variantId;
      if (isMatch) {
        valid = true;
        button.checked = true;
      }
      button.classList.toggle("active", isMatch);
    });

    // Remember which plan type the user had selected (one-time or subscribe)
    const activePlan = [...selectors].find((s) => s.style.display === "block");
    const wasSubscribe = activePlan?.querySelector(".button-subscribe")?.checked;

    console.log('[plan-persist] activePlan found:', !!activePlan, activePlan?.dataset?.variant);
    console.log('[plan-persist] wasSubscribe:', wasSubscribe);

    selectors.forEach((selector) => {
      selector.style.display =
        selector.dataset.variant === variantId ? "block" : "none";
    });

    // Restore plan type selection on the newly shown plan selector
    if (wasSubscribe) {
      const newPlan = [...selectors].find((s) => s.style.display === "block");
      const subscribeBtn = newPlan?.querySelector(".button-subscribe");
      console.log('[plan-persist] newPlan found:', !!newPlan, '| subscribeBtn:', !!subscribeBtn);
      if (subscribeBtn) {
        subscribeBtn.checked = true;
        subscribeBtn.dispatchEvent(new Event("change", { bubbles: true }));
        console.log('[plan-persist] ✅ Restored subscribe');
      }
    }

    if (valid && hiddenInput) {
      hiddenInput.value = variantId;
    }

    return valid;
  }

  const isValidFromUrl = variantFromUrl && activateVariant(variantFromUrl);

  if (!isValidFromUrl && buttons.length > 0) {
    const firstVariantId = buttons[0].dataset.variant;
    activateVariant(firstVariantId);
    if (hiddenInput) hiddenInput.value = firstVariantId;
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const variantId = button.dataset.variant;

      if (hiddenInput) hiddenInput.value = variantId;

      const currentUrl = new URL(window.location);
      currentUrl.searchParams.set("variant", variantId);
      window.history.replaceState({}, "", currentUrl);

      activateVariant(variantId);
    });
  });
});

function updateSellingPlan() {
  setTimeout(() => {
    const activePlanSelector = [
      ...document.querySelectorAll(".plan-selector"),
    ].find((el) => getComputedStyle(el).display !== "none");

    if (!activePlanSelector) {
      return;
    }

    const sellingPlanInput = document.querySelector(
      ".selected-selling-plan-id"
    );
    const planSelect = activePlanSelector.querySelector(".plan-button-select");
    const oneTimeButton = activePlanSelector.querySelector(".button-one-time");

    if (oneTimeButton && oneTimeButton.checked) {
      if (sellingPlanInput) {
        sellingPlanInput.value = "";
      }
      return;
    }

    if (!planSelect || !sellingPlanInput) {
      return;
    }

    const selectedOption = planSelect.options[planSelect.selectedIndex];

    if (selectedOption) {
      const planId = selectedOption.dataset.planId || "";
      sellingPlanInput.value = planId;
    } else {
      sellingPlanInput.value = "";
    }
  }, 10);
}

document.querySelectorAll(".plan-selector").forEach((planSelector) => {
  const oneTimeBuy = planSelector.querySelector(".button-one-time");
  const subscribeButton = planSelector.querySelector(".button-subscribe");
  const planSelect = planSelector.querySelector(".plan-button-select");
  const planSelectWrapper = planSelector.querySelector(
    ".plan-button-select-wrapper"
  );

  if (subscribeButton) {
    subscribeButton.addEventListener("change", function () {
      if (this.checked) {
        if (planSelectWrapper) planSelectWrapper.style.display = "flex";
        updateSellingPlan();
      }
    });
  }

  if (oneTimeBuy) {
    oneTimeBuy.addEventListener("change", function () {
      if (this.checked) {
        if (planSelectWrapper) planSelectWrapper.style.display = "none";
        const sellingPlanInput = document.querySelector(
          ".selected-selling-plan-id"
        );
        if (sellingPlanInput) {
          sellingPlanInput.value = "";
        }
        console.log("Selling plan cleared for one-time buy");
      }
    });
  }

  if (oneTimeBuy) {
    window.addEventListener("load", function () {
      if (oneTimeBuy.checked) {
        if (planSelectWrapper) planSelectWrapper.style.display = "none";
        const sellingPlanInput = document.querySelector(
          ".selected-selling-plan-id"
        );
        if (sellingPlanInput) {
          sellingPlanInput.value = "";
        }
        console.log("Selling plan cleared for one-time buy 2");
      }
    });
  }

  if (planSelect) {
    planSelect.addEventListener("change", updateSellingPlan);
  }

  updateSellingPlan();
});

document.querySelectorAll(".plan-selector").forEach((planSelector) => {
  const oneTimeBuy = planSelector.querySelector(".button-one-time");
  const subscribeButton = planSelector.querySelector(".button-subscribe");
  const planSelect = planSelector.querySelector(".plan-button-select");
  const planSelectWrapper = planSelector.querySelector(
    ".plan-button-select-wrapper"
  );

  if (subscribeButton) {
    subscribeButton.addEventListener("change", function () {
      if (this.checked) {
        if (planSelectWrapper) planSelectWrapper.style.display = "flex";
        updateSellingPlan();
      }
    });
  }

  if (oneTimeBuy) {
    oneTimeBuy.addEventListener("change", function () {
      if (this.checked) {
        if (planSelectWrapper) planSelectWrapper.style.display = "none";
        const activePlanSelector = document.querySelector(
          ".plan-selector[style*='display: block']"
        );
        if (activePlanSelector) {
          const sellingPlanInput = activePlanSelector.querySelector(
            ".selected-selling-plan-id"
          );
          if (sellingPlanInput) sellingPlanInput.value = "";
        }
        console.log("Selling plan cleared for one-time buy");
      }
    });
  }

  if (planSelect) {
    planSelect.addEventListener("change", updateSellingPlan);
  }
  updateSellingPlan();
});

const observePriceChanges = () => {
  const quantityButtons = document.querySelectorAll('.product-quantity__button');

  quantityButtons.forEach((button) => {
    const dataInput = button.querySelector('.data-main-price');

    if (!dataInput) return;

    const observer = new MutationObserver(() => {
      const checkedRadio = document.querySelector('input[name="quantity"]:checked');
      if (checkedRadio) {
        updatePriceFromQuantity(checkedRadio);
        updatePlanPricing(); 
        updateSellingPlan();
      }
    });
    
    
    observer.observe(dataInput, {
      attributes: true,
      attributeFilter: ['data-price', 'data-compare'],
    });
  });
};

document.addEventListener('DOMContentLoaded', observePriceChanges);