const catalogConfig = window.MPS_CATALOG || {};

const state = {
  pdf: null,
  pageCount: 0,
  currentPage: 1,
  isRendering: false,
  renderToken: 0
};

const els = {
  stage: document.getElementById("flipbookStage"),
  book: document.getElementById("flipbook"),
  status: document.getElementById("catalogStatus"),
  prev: document.getElementById("prevPage"),
  next: document.getElementById("nextPage"),
  prevMobile: document.getElementById("prevPageMobile"),
  nextMobile: document.getElementById("nextPageMobile"),
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
  if (!els.prev || !els.next) return;
  els.prev.disabled = disabled;
  els.next.disabled = disabled;
}

function updateCounter() {
  if (!els.counter || !state.pageCount) return;

  els.counter.textContent = `${state.currentPage} / ${state.pageCount}`;
  if (els.prev && els.next) {
    els.prev.disabled = state.isRendering || state.currentPage <= 1;
    els.next.disabled = state.isRendering || state.currentPage >= state.pageCount;
  }

  if (els.prevMobile && els.nextMobile) {
    els.prevMobile.disabled = state.isRendering || state.currentPage <= 1;
    els.nextMobile.disabled = state.isRendering || state.currentPage >= state.pageCount;
  }
}

function getStageSize() {
  const bounds = els.stage.getBoundingClientRect();
  return {
    width: Math.max(280, Math.min(bounds.width - 24, 1080)),
    height: Math.max(360, Math.min(bounds.height - 24, 760))
  };
}

async function renderPageToCanvas(pageNumber, targetWidth, maxHeight) {
  const page = await state.pdf.getPage(pageNumber);
  const initialViewport = page.getViewport({ scale: 1 });
  const widthScale = targetWidth / initialViewport.width;
  const heightScale = maxHeight / initialViewport.height;
  const scale = Math.max(Math.min(widthScale, heightScale), 0.4);
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

async function renderViewer(pageNumber) {
  if (!state.pdf) return;

  const safePage = Math.min(Math.max(pageNumber, 1), state.pageCount);
  if (state.isRendering && safePage === state.currentPage) return;

  const token = state.renderToken + 1;
  state.renderToken = token;
  state.isRendering = true;
  updateCounter();

  const size = getStageSize();
  const pageWidth = Math.min(size.width, 760);
  const pageMaxHeight = Math.min(size.height, 820);
  const spread = document.createElement("div");
  spread.className = "pdf-spread is-single";

  try {
    const shell = createPageShell(safePage);
    const canvas = await renderPageToCanvas(safePage, pageWidth, pageMaxHeight);
    shell.appendChild(canvas);

    if (token !== state.renderToken) return;

    spread.appendChild(shell);
    els.book.innerHTML = "";
    els.book.appendChild(spread);
    state.currentPage = safePage;
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
    await renderViewer(1);
  } catch (error) {
    showPdfFallback(`Verifica que el archivo exista en <code>${catalogConfig.pdf}</code>.`);
  }
}

async function goToRelativePage(direction) {
  if (state.isRendering || !state.pageCount) return;

  const nextPage = Math.min(Math.max(state.currentPage + direction, 1), state.pageCount);
  if (nextPage !== state.currentPage) {
    await renderViewer(nextPage);
  }
}

els.prev?.addEventListener("click", () => goToRelativePage(-1));
els.next?.addEventListener("click", () => goToRelativePage(1));
els.prevMobile?.addEventListener("click", () => goToRelativePage(-1));
els.nextMobile?.addEventListener("click", () => goToRelativePage(1));

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

els.stage.addEventListener("click", (event) => {
  if (event.target.closest("button, a")) return;
  if (!state.pageCount || state.isRendering) return;
  const bounds = els.stage.getBoundingClientRect();
  const clickX = event.clientX - bounds.left;
  const direction = clickX > bounds.width / 2 ? 1 : -1;
  goToRelativePage(direction);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    goToRelativePage(1);
  }

  if (event.key === "ArrowLeft") {
    goToRelativePage(-1);
  }
});

initCatalogViewer();
