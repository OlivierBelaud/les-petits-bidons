document.addEventListener("DOMContentLoaded", function () {
  const collectionContainer = document.querySelector("#collection-content");

  document.addEventListener("click", function (e) {
    const link = e.target.closest(".collection-link");
    if (!link) return;

    e.preventDefault();

    const url = link.getAttribute("href") || link.dataset.url;
    if (!url) {
      console.error("URL collection not found");
      return;
    }

    link.classList.add("loading");

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Error");
        }
        return response.text();
      })
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const newContent = doc.querySelector("#collection-content");
        if (newContent) {
          collectionContainer.innerHTML = newContent.innerHTML;
        } else {
          collectionContainer.innerHTML = html;
        }

        const newTitleEl = doc.querySelector(".cluutch-banner__text");
        if (newTitleEl) {
          const currentTitleEl = document.querySelector(
            ".cluutch-banner__text"
          );
          if (currentTitleEl) {
            currentTitleEl.textContent = newTitleEl.textContent;
          }
        }

        const newImageEl = doc.querySelector(".cluutch-banner__image");
        if (newImageEl) {
          const currentImageEl = document.querySelector(
            ".cluutch-banner__image"
          );
          if (currentImageEl) {
            currentImageEl.src = newImageEl.src;
            currentImageEl.srcset = newImageEl.getAttribute("srcset");
          }
        }
      })
      .catch((error) => {
        console.error("Error loading collection:", error);
      })
      .finally(() => {
        link.classList.remove("loading");
      });
  });
});
