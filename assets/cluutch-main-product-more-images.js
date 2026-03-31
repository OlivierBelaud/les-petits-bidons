var swiperMain = new Swiper(".imgswiper", {
  spaceBetween: 2,
  slidesPerView: 1,
  loop: true,
  navigation: {
    nextEl: ".swiper-button-next",
    prevEl: ".swiper-button-prev",
  },
});

var swiperThumb = new Swiper(".thumb-swiper", {
  spaceBetween: 12,
  slidesPerView: 2,
  initialSlide: 1,
  direction: "vertical",
  loop: true,
  navigation: {
    nextEl: ".swiper-button-next",
    prevEl: ".swiper-button-prev",
  },
});

swiperMain.controller.control = swiperThumb;
swiperThumb.controller.control = swiperMain;
