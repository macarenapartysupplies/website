const catalogConfig = window.MPS_CATALOG || {};

const state = {
  pdf: null,
  pageCount: 0,
  currentPage: 1,
  isRendering: false,
  renderToken: 0,
  smartCart: null
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

const smartCartKey = `mps-smart-cart:${catalogConfig.id || catalogConfig.pdf || "catalog"}`;

function getCatalogName() {
  return catalogConfig.name || document.title.replace("| Macarena Party Supplies", "").trim() || "Catálogo";
}

function createSmartCartSession(enabled) {
  return {
    enabled,
    catalog: {
      id: catalogConfig.id || "catalog",
      name: getCatalogName(),
      pdf: catalogConfig.pdf || ""
    },
    currentPage: state.currentPage,
    pageCount: state.pageCount,
    answers: {},
    selections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function saveSmartCartSession() {
  if (!state.smartCart) return;
  state.smartCart.currentPage = state.currentPage;
  state.smartCart.pageCount = state.pageCount;
  state.smartCart.updatedAt = new Date().toISOString();
  try {
    sessionStorage.setItem(smartCartKey, JSON.stringify(state.smartCart));
  } catch (error) {
    // The catalog should keep working even if storage is unavailable.
  }
}

function loadSmartCartSession() {
  try {
    const saved = sessionStorage.getItem(smartCartKey);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    return null;
  }
}

function buildSmartCartWhatsappText() {
  const cart = state.smartCart || createSmartCartSession(false);
  const lines = [
    "Hola, quiero cotizar un pedido desde el catálogo.",
    `Catálogo: ${cart.catalog.name}`,
    `Página actual: ${cart.currentPage || state.currentPage} de ${cart.pageCount || state.pageCount || "?"}`
  ];

  if (cart.selections?.length) {
    lines.push("", "Selecciones:");
    cart.selections.forEach((selection) => {
      lines.push(`- Pág. ${selection.page}: ${selection.label || selection.value || "Referencia guardada"}`);
    });
  }

  return lines.join("\n");
}

function showSmartCartBubble() {
  if (!state.smartCart?.enabled || document.querySelector(".smart-cart-fab")) return;

  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "smart-cart-fab";
  fab.setAttribute("aria-label", "Abrir MPS Smart Cart");
  fab.innerHTML = `
    <span class="smart-cart-fab-icon" aria-hidden="true">MPS</span>
    <span class="smart-cart-fab-text">Haz click para agregar tus preferencias</span>
  `;

  fab.addEventListener("click", openSmartCartPanel);
  document.body.appendChild(fab);
}

function removeSmartCartBubble() {
  document.querySelector(".smart-cart-fab")?.remove();
  document.querySelector(".smart-cart-note")?.remove();
}

function showSmartCartNote(message) {
  document.querySelector(".smart-cart-note")?.remove();

  const note = document.createElement("div");
  note.className = "smart-cart-note";
  note.setAttribute("role", "status");
  note.innerHTML = `
    <strong>MPS SMART CART</strong>
    <p>${message}</p>
    <button type="button" aria-label="Cerrar mensaje">Entendido</button>
  `;

  note.querySelector("button").addEventListener("click", () => note.remove());
  document.body.appendChild(note);
}

function openSmartCartPanel() {
  if (!state.smartCart?.enabled) return;

  if (state.currentPage <= 1) {
    showSmartCartNote("Explora las páginas del catálogo y vuelve aquí cuando encuentres una opción que quieras guardar para tu pedido.");
    return;
  }

  showSmartCartNote(`Estás en la página ${state.currentPage}. En el siguiente paso aquí guardaremos tus preferencias para esta opción.`);
}

function createSmartCartPrompt() {
  if (document.querySelector(".smart-cart-modal")) return;

  const modal = document.createElement("div");
  modal.className = "smart-cart-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "smartCartTitle");
  modal.innerHTML = `
    <div class="smart-cart-dialog">
      <h2 id="smartCartTitle">MPS SMART CART</h2>
      <p>¿Te gustaría ir registrando tus preferencias del pedido conforme leas el catálogo?</p>
      <div class="smart-cart-actions">
        <button type="button" class="smart-cart-choice secondary" data-smart-cart="no">No</button>
        <button type="button" class="smart-cart-choice" data-smart-cart="yes">Sí</button>
      </div>
    </div>
  `;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      setSmartCartPreference(false);
    }
  });

  modal.querySelectorAll("[data-smart-cart]").forEach((button) => {
    button.addEventListener("click", () => {
      setSmartCartPreference(button.dataset.smartCart === "yes");
    });
  });

  document.body.appendChild(modal);
}

function setSmartCartPreference(enabled) {
  state.smartCart = createSmartCartSession(enabled);
  saveSmartCartSession();
  document.querySelector(".smart-cart-modal")?.remove();
  if (enabled) {
    showSmartCartBubble();
  } else {
    removeSmartCartBubble();
  }
}

function initSmartCartPrompt() {
  const existing = loadSmartCartSession();
  if (existing) {
    state.smartCart = existing;
    saveSmartCartSession();
    showSmartCartBubble();
    return;
  }

  createSmartCartPrompt();
}

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
    saveSmartCartSession();
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
    initSmartCartPrompt();
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

window.MPSSmartCart = {
  getSession: () => state.smartCart,
  save: saveSmartCartSession,
  buildWhatsappText: buildSmartCartWhatsappText
};

initCatalogViewer();
