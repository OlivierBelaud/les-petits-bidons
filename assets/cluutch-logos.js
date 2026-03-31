var swiperLogo = new Swiper(".logo-swiper", {
  spaceBetween: 2,
  centeredSlides: true,
  slidesPerView: 1,
  allowTouchMove: false,
  loop: true,
  autoplay: {
    delay: 2500,
    disableOnInteraction: false,
  },
  pagination: {
    el: ".swiper-pagination",
    clickable: false,
  },
  breakpoints: {
    420: {
      slidesPerView: 2,
    },
    600: {
      slidesPerView: 3,
    },
    768: {
      slidesPerView: 4,
    },
    900: {
      slidesPerView: 5,
    },
  },
});

var swiperTextLogo = new Swiper(".logo-swiper-text", {
  spaceBetween: 2,
  centeredSlides: true,
  slidesPerView: 1,
  allowTouchMove: false,
  loop: true,
  autoplay: {
    delay: 2500,
    disableOnInteraction: false,
  },
});
