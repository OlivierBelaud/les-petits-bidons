(function() {
  const swiperEl = document.querySelector(".swiper-reviews");
  if (!swiperEl) return;

  const singleRow = swiperEl.dataset.singleRow === "true";
  const columnsDesktop = parseInt(swiperEl.dataset.columnsDesktop) || 3;

  let swiperConfig;

  if (singleRow) {
    // Mode une seule ligne
    swiperConfig = {
      slidesPerView: 1.15,
      spaceBetween: 10,
      breakpoints: {
        768: {
          slidesPerView: columnsDesktop,
          spaceBetween: 12,
        },
      },
      navigation: {
        nextEl: ".swiper-button-next",
        prevEl: ".swiper-button-prev",
      },
    };
  } else {
    // Mode par defaut (2 lignes)
    swiperConfig = {
      slidesPerView: 1.23,
      spaceBetween: 10,
      breakpoints: {
        420: {
          slidesPerView: 1.44,
        },
        480: {
          slidesPerView: 1.65,
        },
        550: {
          slidesPerView: 1.91,
        },
        600: {
          slidesPerView: 2.09,
        },
        650: {
          slidesPerView: 2.27,
        },
        700: {
          slidesPerView: 2.46,
        },
        750: {
          slidesPerView: 2.63,
        },
        768: {
          slidesPerView: 2,
          spaceBetween: 12,
        },
        820: {
          slidesPerView: 2.3,
        },
        1024: {
          slidesPerView: 2.5,
        },
        1200: {
          slidesPerView: 2.8,
        },
        1300: {
          slidesPerView: 3,
        },
      },
      grid: {
        rows: 2,
        fill: "row",
      },
      navigation: {
        nextEl: ".swiper-button-next",
        prevEl: ".swiper-button-prev",
      },
    };
  }

  var swiper = new Swiper(".swiper-reviews", swiperConfig);
})();

