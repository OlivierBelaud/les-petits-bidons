var swiper = new Swiper(".card-swiper", {
  spaceBetween: 12,
  slidesPerView: 1.3,
  loop: true,

  navigation: {
    nextEl: ".swiper-button-next",
    prevEl: ".swiper-button-prev",
  },

  breakpoints: {
    420: {
      slidesPerView: 1.45,
    },
    480: {
      slidesPerView: 1.66,
    },
    550: {
      slidesPerView: 1.91,
    },
    600: {
      slidesPerView: 2.09,
    },
    650: {
      slidesPerView: 2.26,
    },
    700: {
      slidesPerView: 2.44,
    },
    750: {
      slidesPerView: 2.61,
    },
    768: {
      slidesPerView: 2,
    },
    850: {
      slidesPerView: 2.5,
    },
    1024: {
      slidesPerView: 3,
      centeredSlides: true,
    },
  },
});
