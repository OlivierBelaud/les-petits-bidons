onProductReady(function () {
  const buyNowButton = document.querySelector(
    "#product-form button.cluutch-add-to-cart--reverse"
  );

  if (buyNowButton) {
    buyNowButton.addEventListener("click", function (e) {
      e.preventDefault();

      const form = document.getElementById("product-form");
      if (!form) {
        console.error("form 'product-form' not found");
        return;
      }

      const formData = new FormData(form);
      const data = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });

      fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(data),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Error when adding");
          }
          return response.json();
        })
        .then((result) => {
          window.location.href = "/checkout";
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    });
  }
  const form = document.getElementById("product-form");
  if (form) {
    form.dataset.buyReady = "true";
    const status = form.querySelector('[data-purchase-status]');
    if (status && form.dataset.productReady === 'true' && !form.dataset.variantPending && !form.dataset.variantError) status.hidden = true;
  }
});
