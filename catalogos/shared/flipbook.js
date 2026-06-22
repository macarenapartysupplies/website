const catalogConfig = window.MPS_CATALOG || {};

const state = {
  pdf: null,
  pageCount: 0,
  currentPage: 1,
  isRendering: false,
  renderToken: 0,
  pageFlip: null,
  mode: "single"
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
  els.status.style.display = "grid";
  els.status.innerHTML = isError ? `<strong>No se pudo cargar el catálogo.</strong><br>${message}` : message;
}

function hideStatus() {
  if (!els.status) return;
  els.status.hidden = true;
  els.status.style.display = "none";
  els.status.textContent = "";
}

function setControlsDisabled(disabled) {
  els.prev.disabled = disabled;
  els.next.disabled = disabled;
}

function updateCounter() {
  if (!els.counter || !state.pageCount) return;

  els.counter.textContent = `${state.currentPage} / ${state.pageCount}`;
  els.prev.disabled = state.isRendering || state.currentPage <= 1;
  els.next.disabled = state.isRendering || state.currentPage >= state.pageCount;
}

function getStageSize() {
  const bounds = els.stage.getBoundingClientRect();
  return {
    width: Math.max(280, Math.min(bounds.width - 24, 1120)),
    height: Math.max(360, Math.min(bounds.height - 24, 780))
  };
}

async function renderPageToCanvas(pageNumber, targetWidth, maxHeight) {
  const page = await state.pdf.getPage(pageNumber);
  const initialViewport = page.getViewport({ scale: 1 });
  const widthScale = targetWidth / initialViewport.width;
  const heightScale = maxHeight / initialViewport.height;
  const scale = Math.max(Math.min(widthScale, heightScale), 0.35);
  const viewport = page.getViewport({ scale });

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

function createPageShell(pageNumber) {
  const shell = document.createElement("article");
  shell.className = "pdf-page-shell";
  shell.setAttribute("aria-label", `Página ${pageNumber}`);
  return shell;
}

async function renderSingleViewer(pageNumber) {
  if (!state.pdf) return;

  const token = state.renderToken + 1;
  state.renderToken = token;
  state.isRendering = true;
  updateCounter();

  const size = getStageSize();
  const pageWidth = Math.min(size.width, 760);
  const pageMaxHeight = Math.min(size.height, 760);
  const spread = document.createElement("div");
  spread.className = "pdf-spread is-single";

  try {
    const shell = createPageShell(pageNumber);
    const canvas = await renderPageToCanvas(pageNumber, pageWidth, pageMaxHeight);
    shell.appendChild(canvas);

    if (token !== state.renderToken) return;

    spread.appendChild(shell);
    els.book.innerHTML = "";
    els.book.appendChild(spread);
    state.currentPage = pageNumber;
    state.mode = "single";
    hideStatus();
  } catch (error) {
    showPdfFallback("Hubo un problema renderizando esta página.");
  } finally {
    if (token === state.renderToken) {
      state.isRendering = false;
      updateCounter();
    }
  }
}

async function renderFlipbookViewer() {
  if (!state.pdf || !window.St?.PageFlip) {
    await renderSingleViewer(1);
    return;
  }

  state.isRendering = true;
  updateCounter();
  setStatus("Cargando catálogo...");

  const size = getStageSize();
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const pageWidth = isMobile ? Math.min(size.width, 640) : Math.min(size.width / 2, 620);
  const pageMaxHeight = Math.min(size.height, 760);

  try {
    const pages = [];

    for (let pageNumber = 1; pageNumber <= state.pageCount; pageNumber += 1) {
      const shell = createPageShell(pageNumber);
      const canvas = await renderPageToCanvas(pageNumber, pageWidth, pageMaxHeight);
      shell.appendChild(canvas);
      pages.push(shell);
    }

    els.book.innerHTML = "";
    pages.forEach((page) => els.book.appendChild(page));

    state.pageFlip?.destroy?.();
    const firstCanvas = pages[0].querySelector("canvas");
    const renderedHeight = parseFloat(firstCanvas?.style.height) || pageMaxHeight;

    state.pageFlip = new St.PageFlip(els.book, {
      width: Math.round(pageWidth),
      height: Math.round(Math.min(pageMaxHeight, renderedHeight)),
      size: "stretch",
      minWidth: 280,
      maxWidth: Math.round(pageWidth),
      minHeight: 360,
      maxHeight: Math.round(pageMaxHeight),
      showCover: false,
      usePortrait: true,
      mobileScrollSupport: false,
      drawShadow: true,
      flippingTime: 650
    });

    state.pageFlip.loadFromHTML(pages);
    state.pageFlip.on("flip", (event) => {
      state.currentPage = Math.min((event.data || 0) + 1, state.pageCount);
      updateCounter();
    });

    state.mode = "flipbook";
    state.currentPage = 1;
    hideStatus();
  } catch (error) {
    state.pageFlip?.destroy?.();
    state.pageFlip = null;
    await renderSingleViewer(1);
  } finally {
    state.isRendering = false;
    updateCounter();
  }
}

function showPdfFallback(reason) {
  state.isRendering = false;
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
  setStatus("Cargando catálogo...");

  if (!window.pdfjsLib) {
    showPdfFallback("PDF.js no se cargó correctamente.");
    return;
  }

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    state.pdf = await pdfjsLib.getDocument(catalogConfig.pdf).promise;
    state.pageCount = state.pdf.numPages;
    await renderFlipbookViewer();
  } catch (error) {
    showPdfFallback(`Verifica que el archivo exista en <code>${catalogConfig.pdf}</code>.`);
  }
}

async function goToRelativePage(direction) {
  if (state.isRendering) return;

  if (state.mode === "flipbook" && state.pageFlip) {
    if (direction > 0) {
      state.pageFlip.flipNext();
    } else {
      state.pageFlip.flipPrev();
    }
    return;
  }

  const nextPage = Math.min(Math.max(state.currentPage + direction, 1), state.pageCount);
  if (nextPage !== state.currentPage) {
    await renderSingleViewer(nextPage);
  }
}

els.prev.addEventListener("click", () => goToRelativePage(-1));
els.next.addEventListener("click", () => goToRelativePage(1));

let touchStartX = 0;
els.stage.addEventListener("touchstart", (event) => {
  touchStartX = event.changedTouches[0]?.clientX || 0;
}, { passive: true });

els.stage.addEventListener("touchend", (event) => {
  const endX = event.changedTouches[0]?.clientX || 0;
  const delta = endX - touchStartX;
  if (Math.abs(delta) < 44) return;
  goToRelativePage(delta > 0 ? -1 : 1);
}, { passive: true });

let resizeTimer;
window.addEventListener("resize", () => {
  if (!state.pdf || state.mode !== "flipbook") return;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    state.pageFlip?.destroy?.();
    state.pageFlip = null;
    renderFlipbookViewer();
  }, 220);
});

initCatalogViewer();
