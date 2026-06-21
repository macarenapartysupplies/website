const catalogConfig = window.MPS_CATALOG || {};

const state = {
  pdf: null,
  pageFlip: null,
  pageCount: 0,
  currentPage: 1,
  mode: "loading"
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

const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

function setStatus(message, isError = false) {
  if (!els.status) return;
  els.status.hidden = false;
  els.status.innerHTML = isError ? `<strong>No se pudo cargar el catalogo.</strong><br>${message}` : message;
}

function hideStatus() {
  if (els.status) els.status.hidden = true;
}

function setControlsDisabled(disabled) {
  els.prev.disabled = disabled;
  els.next.disabled = disabled;
}

function updateCounter() {
  if (!els.counter) return;

  if (state.mode === "flipbook" && state.pageFlip) {
    const current = state.pageFlip.getCurrentPageIndex() + 1;
    els.counter.textContent = `${current} / ${state.pageCount}`;
    els.prev.disabled = current <= 1;
    els.next.disabled = current >= state.pageCount;
    return;
  }

  els.counter.textContent = `${state.currentPage} / ${state.pageCount}`;
  els.prev.disabled = state.currentPage <= 1;
  els.next.disabled = state.currentPage >= state.pageCount;
}

function getStageSize() {
  const bounds = els.stage.getBoundingClientRect();
  const width = Math.max(280, Math.min(bounds.width - 24, 980));
  const height = Math.max(360, Math.min(bounds.height - 24, 720));

  if (isMobile()) {
    return {
      width: Math.min(width, 430),
      height: Math.min(height, 660)
    };
  }

  return { width, height };
}

async function renderPageToCanvas(pageNumber, targetWidth) {
  const page = await state.pdf.getPage(pageNumber);
  const initialViewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / initialViewport.width;
  const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });

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

  return canvas;
}

async function renderSinglePage(pageNumber) {
  state.mode = "single";
  state.currentPage = pageNumber;
  setControlsDisabled(true);

  const size = getStageSize();
  const canvas = await renderPageToCanvas(pageNumber, size.width);

  const wrapper = document.createElement("div");
  wrapper.className = "single-pdf-page";
  wrapper.appendChild(canvas);

  els.book.innerHTML = "";
  els.book.appendChild(wrapper);
  hideStatus();
  updateCounter();
}

async function renderPdfPagesForFlipbook() {
  const pages = [];
  const size = getStageSize();
  const targetWidth = size.width / 2;

  for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber += 1) {
    const canvas = await renderPageToCanvas(pageNumber, targetWidth);
    const wrapper = document.createElement("div");
    wrapper.className = "flip-page";
    wrapper.appendChild(canvas);
    pages.push(wrapper);
  }

  return pages;
}

function mountPageFlip(pages) {
  if (!window.St?.PageFlip) {
    throw new Error("StPageFlip no esta disponible");
  }

  els.book.innerHTML = "";
  pages.forEach((page) => els.book.appendChild(page));

  const size = getStageSize();

  state.pageFlip = new St.PageFlip(els.book, {
    width: Math.round(size.width / 2),
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
  state.mode = "flipbook";
  hideStatus();
  updateCounter();
}

function showPdfFallback(reason) {
  state.mode = "fallback";
  setControlsDisabled(true);
  els.book.innerHTML = "";
  setStatus(
    `${reason}<br><br><a class="catalog-button" href="${catalogConfig.pdf}" target="_blank" rel="noopener">Abrir PDF</a>`,
    true
  );
}

async function initCatalogViewer() {
  if (!catalogConfig.pdf) {
    showPdfFallback("Falta configurar la ruta del PDF.");
    return;
  }

  els.download.href = catalogConfig.pdf;
  setControlsDisabled(true);
  setStatus("Cargando catalogo...");

  if (!window.pdfjsLib) {
    showPdfFallback("PDF.js no se cargo correctamente.");
    return;
  }

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    state.pdf = await pdfjsLib.getDocument(catalogConfig.pdf).promise;
    state.pageCount = state.pdf.numPages;

    if (isMobile()) {
      await renderSinglePage(1);
      return;
    }

    try {
      const pages = await renderPdfPagesForFlipbook();
      mountPageFlip(pages);
    } catch (flipbookError) {
      await renderSinglePage(1);
    }
  } catch (error) {
    showPdfFallback(`Verifica que el archivo exista en <code>${catalogConfig.pdf}</code>.`);
  }
}

async function goToRelativePage(direction) {
  if (state.mode === "flipbook") {
    if (direction < 0) state.pageFlip?.flipPrev();
    if (direction > 0) state.pageFlip?.flipNext();
    return;
  }

  if (state.mode === "single") {
    const nextPage = Math.min(Math.max(state.currentPage + direction, 1), state.pageCount);
    if (nextPage !== state.currentPage) {
      await renderSinglePage(nextPage);
    }
  }
}

els.prev.addEventListener("click", () => goToRelativePage(-1));
els.next.addEventListener("click", () => goToRelativePage(1));

initCatalogViewer();
