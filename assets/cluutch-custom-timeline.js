document.addEventListener("DOMContentLoaded", function () {
  const swiperBody = new Swiper(".timeline-swiper--body", {
    slidesPerView: 1,
    spaceBetween: 30,
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
  });

  const slideButtons = document.querySelectorAll(".slide-button");

  function updateActiveButton(index) {
    slideButtons.forEach((btn) => btn.classList.remove("active"));
    if (slideButtons[index]) {
      slideButtons[index].classList.add("active");
    }
  }

  swiperBody.on("slideChange", function () {
    updateActiveButton(swiperBody.activeIndex);
  });

  slideButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      const slideIndex = parseInt(this.getAttribute("data-slide"));
      swiperBody.slideTo(slideIndex);
    });
  });
});
