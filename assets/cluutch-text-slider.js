var swiperText = new Swiper(".text-swiper", {
  spaceBetween: 5,
  centeredSlides: true,
  slidesPerView: 1,
  speed: 800,
  pagination: {
    el: ".swiper-pagination",
    clickable: true,
  },
  navigation: {
    nextEl: ".swiper-button-next",
    prevEl: ".swiper-button-prev",
  },
});
var swiperImg = new Swiper(".img-swiper", {
  spaceBetween: 5,
  centeredSlides: true,
  slidesPerView: 1,
});

swiperText.controller.control = swiperImg;
swiperImg.controller.control = swiperText;
