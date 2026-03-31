// const input = document.querySelector(".myInput"),
//   questions = document.querySelectorAll(".question"),
//   questionsList = document.querySelector(".search-question__list");
// function searchFunction() {
//   let filter, title, text, i, txtValue;
//   for (filter = input.value.toUpperCase(), i = 0; i < questions.length; i++)
//     (title = questions[i].getElementsByTagName("h3")[0]),
//       (txtValue = title.textContent || title.innerText),
//       txtValue.toUpperCase().includes(filter)
//         ? (questions[i].classList.add("_active"),
//           questionsList.classList.add("_active"))
//         : questions[i].classList.remove("_active"),
//       filter == "" &&
//         (questions[i].classList.remove("_active"),
//         questionsList.classList.remove("_active"));
// }
// const questionPopupClose = document.querySelectorAll(".question__popup-close"),
//   questionPopup = document.querySelectorAll(".question__popup-wrapper"),
//   gotButton = document.querySelectorAll(".got-button");
// for (let index = 0; index < questions.length; index++)
//   questions[index].addEventListener("click", function (e) {
//     questionPopup[index].classList.add("_active"),
//       document.body.parentNode.classList.add("body-lock");
//   }),
//     questionPopupClose[index].addEventListener("click", function (e) {
//       questionPopup[index].classList.remove("_active"),
//         document.body.parentNode.classList.remove("body-lock");
//     }),
//     gotButton[index].addEventListener("click", function (e) {
//       questionPopup[index].classList.remove("_active"),
//         document.body.parentNode.classList.remove("body-lock");
//     });
// let tabs = document.querySelectorAll("._tabs");
// for (let index = 0; index < tabs.length; index++) {
//   let tab = tabs[index],
//     tabs_items = tab.querySelectorAll("._tabs-item"),
//     tabs_blocks = tab.querySelectorAll("._tabs-block");
//   for (let index2 = 0; index2 < tabs_items.length; index2++) {
//     let tabs_item = tabs_items[index2];
//     tabs_item.addEventListener("click", function (e) {
//       for (let index3 = 0; index3 < tabs_items.length; index3++)
//         tabs_items[index3].classList.remove("_active"),
//           tabs_blocks[index3].classList.remove("_active");
//       tabs_item.classList.add("_active"),
//         tabs_blocks[index2].classList.add("_active"),
//         e.preventDefault();
//     });
//   }
// }
// const faqTracking = document.querySelectorAll(".faq-details-tracking"),
//   faqAccount = document.querySelectorAll(".faq-details-account"),
//   faqCheckout = document.querySelectorAll(".faq-details-checkout"),
//   faqReturn = document.querySelectorAll(".faq-details-return"),
//   faqPurchase = document.querySelectorAll(".faq-details-purchase"),
//   allFaq = document.querySelectorAll(".faq-details-all"),
//   trackingTab = document.querySelector(".tracking-tab"),
//   accountTab = document.querySelector(".account-tab"),
//   checkoutTab = document.querySelector(".checkout-tab"),
//   returnTab = document.querySelector(".return-tab"),
//   purchaseTab = document.querySelector(".purchase-tab"),
//   allTabs = document.querySelector(".all-tabs");
// (trackingTab.innerHTML = faqTracking.length),
//   (accountTab.innerHTML = faqAccount.length),
//   (checkoutTab.innerHTML = faqCheckout.length),
//   (faqReturn.innerHTML = returnTab.length),
//   (purchaseTab.innerHTML = faqPurchase.length),
//   (returnTab.innerHTML = faqPurchase.length),
//   (allTabs.innerHTML = allFaq.length);
// Recherche FAQ désactivée
// document.getElementById("search-btn").addEventListener("click", function () {
//   const searchInput = document.getElementById("search-input");
//   const searchValue = searchInput.value.toLowerCase().trim();
//   const detailsList = document.querySelectorAll("details");
//
//   if (searchValue === "") {
//     detailsList.forEach((details) => {
//       details.classList.remove("hidden");
//       details.open = false;
//     });
//     return;
//   }
//
//   detailsList.forEach((details) => {
//     const summaryText = details
//       .querySelector("summary")
//       .textContent.toLowerCase();
//     const contentText = details.textContent.toLowerCase();
//
//     if (
//       summaryText.includes(searchValue) ||
//       contentText.includes(searchValue)
//     ) {
//       details.classList.remove("hidden");
//       details.open = true;
//     } else {
//       details.classList.add("hidden");
//       details.open = false;
//     }
//   });
// });

