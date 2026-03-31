document.addEventListener("DOMContentLoaded", function () {
  const subscriptionBlocks = document.querySelectorAll(
    ".cluutch-subscription-collection__wrapper-content"
  );

  subscriptionBlocks.forEach(function (block) {
    const container = block.querySelector(".addons-inputs-container");
    const planSelect = block.querySelector(".sub-select");
    const subPriceElement = block.querySelector(".sub-price");
    const addButton = block.querySelector(".find-plan__add-button");

    if (!container || !planSelect || !subPriceElement || !addButton) return;

    let planNameMap = {};

    document
      .querySelectorAll(".quantity-container")
      .forEach((quantityContainer) => {
        [...quantityContainer.attributes].forEach((attr) => {
          if (attr.name.startsWith("data-plan-")) {
            let [planId, planPrice, planName] = attr.value
              .split(",")
              .map((v) => v.trim());

            planName = planName
              .replace(
                /Livraison tous les (\d+) Months?/gi,
                "Livré tous les $1 Mois"
              )
              .replace(/Livré tous les 1 Mois/gi, "Livré tous les Mois");

            let priceElement = quantityContainer
              .closest(".cluutch-card")
              ?.querySelector(".price__regular");
            let oldPrice = priceElement
              ? parseFloat(priceElement.getAttribute("data-variant-price")) || 0
              : 0;
            let newPrice = parseFloat(planPrice);
            let priceDifference = Math.abs(newPrice - oldPrice);
            let percentageDifference =
              oldPrice > 0 ? Math.round((priceDifference / oldPrice) * 100) : 0;

            let planNameWithDiscount = planName;
            if (percentageDifference > 0) {
              planNameWithDiscount += ` (-${percentageDifference}%)`;
            }

            if (!planNameMap[planName]) {
              planNameMap[planName] = [];
              let option = document.createElement("option");
              option.value = planName;
              option.textContent = planNameWithDiscount;
              planSelect.appendChild(option);
            }

            planNameMap[planName].push({
              id: planId,
              price: newPrice,
              container: quantityContainer,
            });
          }
        });

        const minusBtn = quantityContainer.querySelector(".quantity-minus");
        const plusBtn = quantityContainer.querySelector(".quantity-plus");
        const quantityInput =
          quantityContainer.querySelector(".quantity-input");
        const productId = quantityContainer.getAttribute("data-product-id");

        if (quantityInput) {
          quantityInput.value = 0;
        }

        if (minusBtn) {
          minusBtn.addEventListener("click", function () {
            updateQuantity(productId, -1, quantityInput, quantityContainer);
          });
        }

        if (plusBtn) {
          plusBtn.addEventListener("click", function () {
            updateQuantity(productId, 1, quantityInput, quantityContainer);
          });
        }
      });

    function applyDefaultPlan() {
      let selectedPlanName = planSelect.value;

      if (planNameMap[selectedPlanName]) {
        planNameMap[selectedPlanName].forEach(
          ({ id, price, container: qtyContainer }) => {
            let productId = qtyContainer.getAttribute("data-product-id");

            document
              .querySelectorAll(
                `.quantity-container[data-product-id='${productId}'] .quantity-input`
              )
              .forEach((input) => {
                let priceElement = qtyContainer
                  .closest(".cluutch-card")
                  ?.querySelector(".price__regular");
                let oldPrice = priceElement
                  ? parseFloat(
                      priceElement.getAttribute("data-variant-price")
                    ) || 0
                  : 0;
                let newPrice = parseFloat(price);

                input.dataset.price = newPrice;
                let quantity = parseInt(input.value);
                if (isNaN(quantity)) {
                  input.value = 0;
                }

                let priceDifference = Math.abs(newPrice - oldPrice);
                let percentageDifference =
                  oldPrice > 0
                    ? Math.round((priceDifference / oldPrice) * 100)
                    : 0;

                let subTextElement = qtyContainer
                  .closest(".cluutch-card")
                  ?.querySelector(".cluutch-card__sub-text");
                if (subTextElement) {
                  subTextElement.textContent = `-${percentageDifference}%`;
                }
              });
          }
        );

        document
          .querySelectorAll(".product-inputs")
          .forEach((productWrapper) => {
            let productId = productWrapper.getAttribute("data-product-id");
            let sellingPlanInput = productWrapper.querySelector(
              `input[name='items[][selling_plan]']`
            );

            let selectedPlan = planNameMap[selectedPlanName]?.find(
              (p) => p.container.getAttribute("data-product-id") === productId
            );

            if (selectedPlan && sellingPlanInput) {
              sellingPlanInput.value = selectedPlan.id;
            }
          });
      }

      updateTotalPrice();
    }

    applyDefaultPlan();
    planSelect.addEventListener("change", applyDefaultPlan);

    function updateQuantity(productId, change, inputElement, parentContainer) {
      let productWrapper = container.querySelector(
        `.product-inputs[data-product-id='${productId}']`
      );

      if (!productWrapper) {
        productWrapper = document.createElement("div");
        productWrapper.classList.add("product-inputs");
        productWrapper.setAttribute("data-product-id", productId);
        container.appendChild(productWrapper);
      }

      let quantityInput = productWrapper.querySelector(
        `input[name='items[][quantity]']`
      );
      let idInput = productWrapper.querySelector(`input[name='items[][id]']`);
      let sellingPlanInput = productWrapper.querySelector(
        `input[name='items[][selling_plan]']`
      );

      let selectedPlanName = planSelect.value;
      let selectedPlan = planNameMap[selectedPlanName]?.find(
        (p) => p.container === parentContainer
      );
      let selectedPlanId = selectedPlan ? selectedPlan.id : "";
      let newQuantity = quantityInput
        ? parseInt(quantityInput.value) + change
        : change;

      if (newQuantity <= 0) {
        productWrapper.remove();
        inputElement.value = 0;
      } else {
        if (!quantityInput) {
          quantityInput = document.createElement("input");
          quantityInput.type = "hidden";
          quantityInput.name = "items[][quantity]";
          productWrapper.appendChild(quantityInput);
        }
        if (!idInput) {
          idInput = document.createElement("input");
          idInput.type = "hidden";
          idInput.name = "items[][id]";
          idInput.value = productId;
          productWrapper.appendChild(idInput);
        }
        if (!sellingPlanInput) {
          sellingPlanInput = document.createElement("input");
          sellingPlanInput.type = "hidden";
          sellingPlanInput.name = "items[][selling_plan]";
          sellingPlanInput.classList.add("selected-selling-plan-id");
          productWrapper.appendChild(sellingPlanInput);
        }

        sellingPlanInput.value = selectedPlanId;
        quantityInput.value = newQuantity;
        inputElement.value = newQuantity;
      }

      updateTotalPrice();
    }

    function formatPrice(price) {
      if (isNaN(price)) return "0.00€";
      return `${(parseFloat(price) / 100).toFixed(2)}€`;
    }

    function updateTotalPrice() {
      let total = 0;
      document
        .querySelectorAll(".quantity-container")
        .forEach((quantityContainer) => {
          let quantityInput =
            quantityContainer.querySelector(".quantity-input");
          let quantity = parseInt(quantityInput.value);
          let selectedPlan = planNameMap[planSelect.value]?.find(
            (p) => p.container === quantityContainer
          );
          let price = selectedPlan ? selectedPlan.price : 0;
          if (!isNaN(quantity) && !isNaN(price)) {
            total += quantity * price;
          }
        });
      document.querySelectorAll(".sub-price").forEach((el) => {
        el.textContent = formatPrice(total);
      });
    }

    function checkSubPrice() {
      const priceText = subPriceElement.textContent.trim();
      const isZeroPrice = /^0[\.,]00\s*[€$]?$/.test(priceText);
      addButton.disabled = priceText === "" || isZeroPrice;
    }

    const observer = new MutationObserver(checkSubPrice);
    observer.observe(subPriceElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    checkSubPrice();
  });
});
