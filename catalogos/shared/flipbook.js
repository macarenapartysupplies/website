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

const smartCartProfiles = {
  personajes: {
    questions: {
      2: {
        id: "deliveryPoint",
        title: "Punto de entrega preferido",
        help: "Elige el punto de entrega que te resulte más cómodo para coordinar tu entrega.",
        type: "choice",
        options: [
          "Parques de Tesistán",
          "Calandrías",
          "Arboreto Residencial",
          "Valle Imperial",
          "La Cima",
          "Zona Real"
        ],
        other: {
          label: "Otro",
          note: "Pueden aplicar costos adicionales"
        }
      },
      3: {
        id: "package",
        title: "Paquete",
        help: "Selecciona el paquete o los paquetes que te interesan. Puedes elegir más de uno.",
        note: "Puedes ver la distribución de etiquetas en las páginas 5 y 6.",
        type: "multiQuantity",
        options: [
          "Paquete 1",
          "Paquete 2",
          "Paquete 3",
          "Paquete 4"
        ]
      },
      4: {
        id: "addons",
        title: "Complementos",
        help: "Selecciona los complementos que te gustaría agregar a tu pedido.",
        type: "multiQuantity",
        options: [
          "Tag para mochila",
          "Nombre en vinil (un color)",
          "Nombre en vinil (dos colores)",
          "Plantilla de nombre al contorno con personaje",
          "Planilla escolar individual - papel",
          "Planilla escolar individual - vinil",
          "Tira larga para cuaderno"
        ]
      },
      6: {
        id: "pencilLabels",
        title: "Etiqueta para lápiz",
        help: "Elige el tipo de etiqueta para lápiz de cada paquete seleccionado.",
        type: "packageLabelChoice",
        sourceAnswerId: "package",
        packages: ["Paquete 2", "Paquete 3", "Paquete 4"],
        options: ["Etiqueta Mini", "Etiqueta Full Cover"]
      },
      7: {
        id: "studentInfo",
        title: "Datos para personalizar",
        help: "Escribe los datos como quieres que aparezcan en tus etiquetas.",
        type: "textFields",
        fields: [
          { id: "name", label: "Nombre", placeholder: "Nombre" },
          { id: "lastName", label: "Apellidos", placeholder: "Apellidos" },
          { id: "group", label: "Grupo", placeholder: "Grupo" }
        ]
      }
    }
  },
  contorno: {
    questions: {}
  }
};

function getSmartCartProfile() {
  return smartCartProfiles[catalogConfig.id] || { questions: {} };
}

function getCurrentQuestion() {
  const question = getSmartCartProfile().questions[state.currentPage] || null;
  return isQuestionAvailable(question) ? question : null;
}

function hasAnswerForQuestion(question) {
  if (!question) return false;

  const answer = state.smartCart?.answers?.[question.id];
  if (!answer) return false;

  if (question.type === "packageLabelChoice") {
    const targets = getPackageLabelTargets(question);
    const answeredIds = new Set((answer.items || []).map((item) => item.id));
    return targets.length > 0 && targets.every((target) => answeredIds.has(target.id));
  }

  return true;
}

function getPackageLabelTargets(question) {
  const packageAnswer = state.smartCart?.answers?.[question.sourceAnswerId];
  if (!packageAnswer?.items?.length) return [];

  return packageAnswer.items
    .filter((item) => question.packages.includes(item.label) && item.quantity > 0)
    .flatMap((item) => Array.from({ length: item.quantity }, (_, index) => ({
      id: `${item.label}-${index + 1}`.toLowerCase().replace(/\s+/g, "-"),
      label: item.quantity > 1 ? `${item.label} #${index + 1}` : item.label,
      package: item.label
    })));
}

function isQuestionAvailable(question) {
  if (!question) return false;
  if (question.type !== "packageLabelChoice") return true;
  return getPackageLabelTargets(question).length > 0;
}

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
    promptedAgain: false,
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

  const answers = Object.values(cart.answers || {});
  if (answers.length) {
    lines.push("", "Preferencias:");
    answers.forEach((answer) => {
      if (answer.items?.length) {
        lines.push(`- ${answer.label}:`);
        answer.items.forEach((item) => {
          const detail = item.quantity ? `${item.label} x${item.quantity}` : `${item.label}: ${item.value}`;
          lines.push(`  • ${detail}`);
        });
      } else {
        lines.push(`- ${answer.label}: ${answer.value}`);
      }
    });
  }

  return lines.join("\n");
}

function showSmartCartBubble() {
  if (!state.smartCart || document.querySelector(".smart-cart-fab")) {
    updateSmartCartBubble();
    return;
  }

  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "smart-cart-fab";
  fab.setAttribute("aria-label", "Abrir MPS Smart Cart");
  fab.innerHTML = `
    <span class="smart-cart-fab-icon" aria-hidden="true">MPS</span>
  `;

  fab.addEventListener("click", openSmartCartPanel);
  document.body.appendChild(fab);
  updateSmartCartBubble();
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

function closeSmartCartPanel() {
  document.querySelector(".smart-cart-note")?.remove();
}

function renderChoiceQuestion(question, savedAnswer) {
  return `
    <div class="smart-cart-question-options">
      ${question.options.map((option) => `
        <button type="button" class="smart-cart-option" data-value="${option}">${option}</button>
      `).join("")}
      <label class="smart-cart-other">
        <span>${question.other.label}</span>
        <input type="text" value="${savedAnswer.other || ""}" placeholder="Escribe otra zona">
        <small>${question.other.note}</small>
      </label>
    </div>
  `;
}

function renderMultiQuantityQuestion(question, savedAnswer) {
  const savedItems = savedAnswer.items || [];
  return `
    <div class="smart-cart-question-options">
      ${question.options.map((option) => {
        const item = savedItems.find((saved) => saved.label === option);
        const quantity = item?.quantity || 0;
        return `
          <div class="smart-cart-quantity-row${quantity > 0 ? " selected" : ""}" data-value="${option}" data-increment="${option === "Tira larga para cuaderno" ? 2 : 1}">
            <span>${option}</span>
            <div class="smart-cart-stepper">
              <button type="button" data-step="-1" aria-label="Quitar ${option}">-</button>
              <strong>${quantity}</strong>
              <button type="button" data-step="1" aria-label="Agregar ${option}">+</button>
            </div>
          </div>
        `;
      }).join("")}
      ${question.note ? `<small class="smart-cart-question-note">${question.note}</small>` : ""}
    </div>
  `;
}

function renderPackageLabelQuestion(question, savedAnswer) {
  const savedItems = savedAnswer.items || [];
  const targets = getPackageLabelTargets(question);

  return `
    <div class="smart-cart-question-options">
      ${targets.map((target) => {
        const saved = savedItems.find((item) => item.id === target.id);
        return `
          <fieldset class="smart-cart-choice-group" data-target-id="${target.id}" data-target-label="${target.label}">
            <legend>${target.label}</legend>
            <div class="smart-cart-choice-buttons">
              ${question.options.map((option) => `
                <button type="button" class="smart-cart-option${saved?.value === option ? " selected" : ""}" data-value="${option}">${option}</button>
              `).join("")}
            </div>
          </fieldset>
        `;
      }).join("")}
    </div>
  `;
}

function renderTextFieldsQuestion(question, savedAnswer) {
  const values = savedAnswer.values || {};
  return `
    <div class="smart-cart-text-fields">
      ${question.fields.map((field) => `
        <label>
          <span>${field.label}</span>
          <input type="text" name="${field.id}" value="${values[field.id] || ""}" placeholder="${field.placeholder || field.label}">
        </label>
      `).join("")}
      <div class="smart-cart-name-preview" aria-live="polite">
        <span>${values.name || "Nombre"}</span>
        <strong>${values.lastName || "Apellidos"}</strong>
        <small>${values.group || "Grupo"}</small>
      </div>
    </div>
  `;
}

function renderQuestionBody(question, savedAnswer) {
  if (question.type === "multiQuantity") return renderMultiQuantityQuestion(question, savedAnswer);
  if (question.type === "packageLabelChoice") return renderPackageLabelQuestion(question, savedAnswer);
  if (question.type === "textFields") return renderTextFieldsQuestion(question, savedAnswer);
  return renderChoiceQuestion(question, savedAnswer);
}

function showQuestionPanel(question) {
  closeSmartCartPanel();

  const savedAnswer = state.smartCart?.answers?.[question.id] || {};
  const note = document.createElement("div");
  note.className = "smart-cart-note smart-cart-question";
  note.setAttribute("role", "dialog");
  note.setAttribute("aria-label", question.title);
  note.innerHTML = `
    <strong>MPS SMART CART</strong>
    <h3>${question.title}</h3>
    <p>${question.help}</p>
    ${renderQuestionBody(question, savedAnswer)}
    <div class="smart-cart-note-actions">
      <button type="button" class="smart-cart-note-secondary" data-close>Después</button>
      <button type="button" data-save>Guardar</button>
    </div>
  `;

  if (question.type === "choice") {
    note.querySelectorAll(".smart-cart-option").forEach((button) => {
      if (savedAnswer.value === button.dataset.value) {
        button.classList.add("selected");
      }

      button.addEventListener("click", () => {
        note.querySelectorAll(".smart-cart-option").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        note.querySelector(".smart-cart-other input").value = "";
      });
    });
  }

  if (question.type === "multiQuantity") {
    note.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest(".smart-cart-quantity-row");
        const output = row.querySelector("strong");
        const current = Number(output.textContent) || 0;
        const increment = Number(row.dataset.increment) || 1;
        const next = Math.max(0, current + (Number(button.dataset.step) * increment));
        output.textContent = String(next);
        row.classList.toggle("selected", next > 0);
      });
    });
  }

  if (question.type === "packageLabelChoice") {
    note.querySelectorAll(".smart-cart-choice-group").forEach((group) => {
      group.querySelectorAll(".smart-cart-option").forEach((button) => {
        button.addEventListener("click", () => {
          group.querySelectorAll(".smart-cart-option").forEach((item) => item.classList.remove("selected"));
          button.classList.add("selected");
        });
      });
    });
  }

  if (question.type === "textFields") {
    const preview = note.querySelector(".smart-cart-name-preview");
    const refreshPreview = () => {
      const values = Object.fromEntries(Array.from(note.querySelectorAll(".smart-cart-text-fields input")).map((input) => [input.name, input.value.trim()]));
      preview.querySelector("span").textContent = values.name || "Nombre";
      preview.querySelector("strong").textContent = values.lastName || "Apellidos";
      preview.querySelector("small").textContent = values.group || "Grupo";
    };

    note.querySelectorAll(".smart-cart-text-fields input").forEach((input) => {
      input.addEventListener("input", refreshPreview);
    });
  }

  note.querySelector("[data-close]").addEventListener("click", () => note.remove());
  note.querySelector("[data-save]").addEventListener("click", () => {
    if (question.type === "multiQuantity") {
      const items = Array.from(note.querySelectorAll(".smart-cart-quantity-row"))
        .map((row) => ({
          label: row.dataset.value,
          quantity: Number(row.querySelector("strong").textContent) || 0
        }))
        .filter((item) => item.quantity > 0);

      if (!items.length) {
        showSmartCartNote("Elige al menos una opción para guardarla.");
        return;
      }

      state.smartCart.answers[question.id] = {
        page: state.currentPage,
        label: question.title,
        items
      };
      saveSmartCartSession();
      note.remove();
      updateSmartCartBubble();
      return;
    }

    if (question.type === "packageLabelChoice") {
      const items = Array.from(note.querySelectorAll(".smart-cart-choice-group"))
        .map((group) => ({
          id: group.dataset.targetId,
          label: group.dataset.targetLabel,
          value: group.querySelector(".smart-cart-option.selected")?.dataset.value || ""
        }))
        .filter((item) => item.value);

      const expectedCount = note.querySelectorAll(".smart-cart-choice-group").length;
      if (items.length !== expectedCount) {
        showSmartCartNote("Elige una opción para cada paquete.");
        return;
      }

      state.smartCart.answers[question.id] = {
        page: state.currentPage,
        label: question.title,
        items
      };
      saveSmartCartSession();
      note.remove();
      updateSmartCartBubble();
      return;
    }

    if (question.type === "textFields") {
      const values = Object.fromEntries(Array.from(note.querySelectorAll(".smart-cart-text-fields input")).map((input) => [input.name, input.value.trim()]));
      const value = question.fields
        .map((field) => values[field.id])
        .filter(Boolean)
        .join(" ");

      if (!value) {
        showSmartCartNote("Escribe al menos un dato para guardarlo.");
        return;
      }

      state.smartCart.answers[question.id] = {
        page: state.currentPage,
        label: question.title,
        value,
        values
      };
      saveSmartCartSession();
      note.remove();
      updateSmartCartBubble();
      return;
    }

    const selected = note.querySelector(".smart-cart-option.selected")?.dataset.value || "";
    const other = note.querySelector(".smart-cart-other input").value.trim();
    const value = other || selected;
    if (!value) {
      showSmartCartNote("Elige una opción o escribe otro punto de entrega para guardarlo.");
      return;
    }

    state.smartCart.answers[question.id] = {
      page: state.currentPage,
      label: question.title,
      value,
      other
    };
    saveSmartCartSession();
    note.remove();
    updateSmartCartBubble();
  });

  document.body.appendChild(note);
}

function updateSmartCartBubble() {
  const fab = document.querySelector(".smart-cart-fab");
  if (!fab || !state.smartCart) return;

  const question = getCurrentQuestion();
  const needsAnswer = Boolean(state.smartCart.enabled && question && !hasAnswerForQuestion(question));
  fab.classList.toggle("is-disabled", !state.smartCart.enabled);
  fab.classList.toggle("is-ready", needsAnswer);
  fab.classList.toggle("is-active", Boolean(state.smartCart.enabled && !needsAnswer));
  fab.setAttribute(
    "aria-label",
    state.smartCart.enabled ? "Abrir MPS Smart Cart" : "Activar MPS Smart Cart"
  );
}

function openSmartCartPanel() {
  if (document.querySelector(".smart-cart-note")) {
    closeSmartCartPanel();
    return;
  }

  if (!state.smartCart?.enabled) {
    createSmartCartPrompt({ fromDisabledBubble: true });
    return;
  }

  if (state.currentPage <= 1) {
    showSmartCartNote("Revisa el catálogo para registrar tus preferencias.");
    return;
  }

  const question = getCurrentQuestion();
  if (question) {
    showQuestionPanel(question);
    return;
  }

  showSmartCartNote("Esta página aún no tiene preguntas activas. Sigue explorando el catálogo.");
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
  const existing = state.smartCart || loadSmartCartSession();
  state.smartCart = existing || createSmartCartSession(enabled);
  state.smartCart.enabled = enabled;
  saveSmartCartSession();
  document.querySelector(".smart-cart-modal")?.remove();
  showSmartCartBubble();
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
    closeSmartCartPanel();
    saveSmartCartSession();
    updateSmartCartBubble();
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
