const catalogConfig = window.MPS_CATALOG || {};

const state = {
  pageFlip: null,
  pageCount: 0
};

const els = {
  stage: document.getElementById("flipbookStage"),
  book: document.getElementById("flipbook"),
  status: document.getElementById("catalogStatus"),
  prev: document.getElementById("prevPage"),
  next: document.getElementById("nextPage"),
  counter: document.getElementById("pageCounter"),
  download: document.getElementById("downloadPdf")
};

function setStatus(message, isError = false) {
  if (!els.status) return;
  els.status.hidden = false;
  els.status.innerHTML = isError ? `<strong>No se pudo cargar el catalogo.</strong><br>${message}` : message;
}

function hideStatus() {
  if (els.status) els.status.hidden = true;
}

function updateCounter() {
  if (!state.pageFlip || !els.counter) return;
  const current = state.pageFlip.getCurrentPageIndex() + 1;
  els.counter.textContent = `${current} / ${state.pageCount}`;
  els.prev.disabled = current <= 1;
  els.next.disabled = current >= state.pageCount;
}

function getStageSize() {
  const bounds = els.stage.getBoundingClientRect();
  const width = Math.max(280, Math.min(bounds.width - 24, 980));
  const height = Math.max(360, Math.min(bounds.height - 24, 720));

  if (window.matchMedia("(max-width: 760px)").matches) {
    return {
      width: Math.min(width, 420),
      height: Math.min(height, 620)
    };
  }

  return { width, height };
}

async function renderPdfPages(pdf) {
  const pages = [];
  const size = getStageSize();
  const singlePageWidth = window.matchMedia("(max-width: 760px)").matches ? size.width : size.width / 2;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const initialViewport = page.getViewport({ scale: 1 });
    const scale = singlePageWidth / initialViewport.width;
    const viewport = page.getViewport({ scale: Math.max(scale, 0.6) });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    await page.render({
      canvasContext: context,
      viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null
    }).promise;

    const wrapper = document.createElement("div");
    wrapper.className = "flip-page";
    wrapper.appendChild(canvas);
    pages.push(wrapper);
  }

  return pages;
}

function mountPageFlip(pages) {
  els.book.innerHTML = "";
  pages.forEach((page) => els.book.appendChild(page));

  const size = getStageSize();

  state.pageFlip = new St.PageFlip(els.book, {
    width: Math.round(window.matchMedia("(max-width: 760px)").matches ? size.width : size.width / 2),
    height: Math.round(size.height),
    size: "stretch",
    minWidth: 280,
    maxWidth: 520,
    minHeight: 360,
    maxHeight: 720,
    maxShadowOpacity: 0.22,
    showCover: true,
    usePortrait: true,
    mobileScrollSupport: true,
    flippingTime: 700
  });

  state.pageFlip.loadFromHTML(els.book.querySelectorAll(".flip-page"));
  state.pageFlip.on("flip", updateCounter);
  updateCounter();
}

async function initFlipbook() {
  if (!catalogConfig.pdf) {
    setStatus("Falta configurar la ruta del PDF.");
    return;
  }

  els.download.href = catalogConfig.pdf;
  setStatus("Cargando catalogo...");

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument(catalogConfig.pdf).promise;
    state.pageCount = pdf.numPages;

    const pages = await renderPdfPages(pdf);
    hideStatus();
    mountPageFlip(pages);
  } catch (error) {
    setStatus(
      `Verifica que el archivo exista en <code>${catalogConfig.pdf}</code>.`,
      true
    );
  }
}

els.prev.addEventListener("click", () => state.pageFlip?.flipPrev());
els.next.addEventListener("click", () => state.pageFlip?.flipNext());

window.addEventListener("resize", () => {
  if (!state.pageFlip) return;
  state.pageFlip.destroy();
  initFlipbook();
});

initFlipbook();
