var swiper = new Swiper(".cart-swiper", {
  slidesPerView: 1.4,
  spaceBetween: 12,
  navigation: {
    nextEl: ".swiper-button-next",
    prevEl: ".swiper-button-prev",
  },

  breakpoints: {
    420: {
      slidesPerView: 1.5,
    },
    480: {
      slidesPerView: 1.65,
    },
    550: {
      slidesPerView: 1.8,
    },
    600: {
      slidesPerView: 2,
    },
    650: {
      slidesPerView: 2.3,
    },
    700: {
      slidesPerView: 2.5,
    },
    768: {
      slidesPerView: 2.7,
    },
    820: {
      slidesPerView: 3,
    },
    880: {
      slidesPerView: 3.3,
    },
    950: {
      slidesPerView: 3.5,
    },
    1024: {
      slidesPerView: 3.7,
    },
    1200: {
      slidesPerView: 4,
    },
  },
});
