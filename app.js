/* ========= Firebase ========= */
import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ======== Fecha / Día automático ========
function parseDateLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const fecha = document.getElementById("fecha");
const dia   = document.getElementById("dia");

fecha.addEventListener("change", () => {
  const f = parseDateLocal(fecha.value);
  dia.value = f ? dias[f.getDay()] : "";
});

window.addEventListener("load", () => {
  if (fecha.value) {
    const f = parseDateLocal(fecha.value);
    dia.value = f ? dias[f.getDay()] : "";
  }
});


// ======== Cronograma ========
const CG_STATE_KEY = 'cronograma_v1';

const cg = {
  rango: '06-18',
  toMin(hhmm) { const [h,m]=hhmm.split(':').map(Number); return h*60+(m||0); },
  relMin(hhmm, rango) {
    const m = this.toMin(hhmm);
    if (rango === '06-18') return m - 6*60;
    return (m >= 18*60) ? (m - 18*60) : (m + (24*60 - 18*60));
  }
};


// ======== Construye el eje ========
function cgBuildAxis() {
  const eje = document.getElementById('cgEje');
  eje.innerHTML = '';
  const rango = document.getElementById('cgRango').value;
  const horas = [];

  if (rango === '06-18') {
    for (let h = 6; h < 18; h++) horas.push(h);
    window.cgStartHour = 6;
  } else {
    for (let i = 0; i < 12; i++) horas.push((18 + i) % 24);
    window.cgStartHour = 18;
  }

  const total = horas.length;
  horas.forEach((h, i) => {
    const lab = document.createElement('div');
    lab.className = 'lab';
    lab.textContent = window.innerWidth < 768
      ? `${h}` 
      : `${String(h).padStart(2, '0')}:00`;
    lab.style.flex = i === total - 1 ? '0 0 auto' : '1';
    eje.appendChild(lab);
  });
}


// ======== Agrega una barra ========
// ======== Agrega una barra ========
function cgAddBar(linea, inicio, fin, sabor, restored = false) {
  const lane = document.querySelector(`.cg-lane[data-linea="${linea}"]`);
  if (!lane) return;

  const rangeText = `${inicio}|${fin}`;
  const dupe = Array.from(lane.children).find(
    b => b.dataset.timeRange === rangeText && b.textContent === sabor
  );
  if (dupe) dupe.remove();

  // --- cálculos con precisión de minutos ---
  const [iniH, iniM] = inicio.split(":").map(Number);
  const [finH, finM] = fin.split(":").map(Number);

  const iniTotal = iniH * 60 + iniM;
  const finTotal = finH * 60 + finM;
  const totalHoras = 12 * 60; // rango de 12h en minutos

  // punto de inicio del rango según selector
  const startRange = window.cgStartHour * 60;
  const endRange = (startRange + totalHoras) % (24 * 60);

  let startMin, endMin;

  if (startRange < endRange) {
    startMin = Math.max(0, iniTotal - startRange);
    endMin   = Math.min(totalHoras, finTotal - startRange);
  } else {
    // caso 18→06 (cruza medianoche)
    startMin = (iniTotal >= startRange) ? iniTotal - startRange : (24 * 60 - startRange) + iniTotal;
    endMin   = (finTotal >= startRange) ? finTotal - startRange : (24 * 60 - startRange) + finTotal;
  }

  const startPercent = (startMin / totalHoras) * 100;
  const widthPercent = Math.max(1, ((endMin - startMin) / totalHoras) * 100);

  // --- offset y render ---
  const existingBars = lane.querySelectorAll(".cg-bar").length;
  const offsetY = 8 + existingBars * 28;

  const bar = document.createElement("div");
  bar.className = "cg-bar";
  bar.textContent = sabor;
  bar.dataset.timeRange = rangeText;
  bar.style.left = `${startPercent}%`;
  bar.style.width = `${widthPercent}%`;
  bar.style.top = `${offsetY}px`;
  bar.dataset.restored = restored ? "true" : "false";

  lane.appendChild(bar);
  lane.style.height = `${40 + existingBars * 28}px`;

  if (!restored) {
    const saved = JSON.parse(localStorage.getItem("corridas") || "[]");
    saved.push({ linea, inicio, fin, sabor });
    localStorage.setItem("corridas", JSON.stringify(saved));
  }
}

// ======== Limpia todo ========
function cgClear() {
  if (!confirm("¿Borrar todas las corridas del gráfico?")) return;

  // 1️⃣ Limpia visualmente todas las lanes
  document.querySelectorAll('.cg-lane').forEach(lane => {
    lane.innerHTML = '';
    lane.style.height = '40px'; // altura base
  });

  // 2️⃣ Borra todas las posibles claves del storage
  ["corridas", "cronograma_v1", "CG_STATE_KEY"].forEach(k => localStorage.removeItem(k));

  // 3️⃣ Mensaje opcional de confirmación
  console.log("🧹 Corridas borradas correctamente.");

  // 4️⃣ Evita que restoreCorridas repinte justo después
  setTimeout(() => {
    document.querySelectorAll('.cg-lane').forEach(l => l.innerHTML = '');
  }, 100);
}




// ======== Restaura guardadas ========
function restoreCorridas() {
  document.querySelectorAll('.cg-lane').forEach(l => l.innerHTML='');
  const saved = JSON.parse(localStorage.getItem("corridas") || "[]");
  saved.forEach(c => cgAddBar(c.linea, c.inicio, c.fin, c.sabor, true));
}


// ======== Inicializa ========
function cgInit() {
  cgBuildAxis();
  restoreCorridas();

  const rangoSel = document.getElementById('cgRango');
  rangoSel.addEventListener('change', () => {
    cgBuildAxis();
    restoreCorridas();
  });

  window.addEventListener('resize', () => {
    cgBuildAxis();
    restoreCorridas();
  });
}
document.addEventListener('DOMContentLoaded', cgInit);


// ======== FORMULARIO ========
const form = document.getElementById('formBarra');
const cgLinea = document.getElementById('cgLinea');
const cgSabor = document.getElementById('cgSabor');
const cgInicio = document.getElementById('cgInicio');
const cgFin = document.getElementById('cgFin');
const cgClearBtn = document.getElementById('cgClear');

form.addEventListener('submit', e => {
  e.preventDefault();
  const linea = cgLinea.value;
  const sabor = cgSabor.value.trim();
  const ini = cgInicio.value;
  const fin = cgFin.value;
  const rango = document.getElementById("cgRango").value;

  if (!linea || !sabor || !ini || !fin) {
    alert('Por favor completá todos los campos.');
    return;
  }

  // === Validación del rango horario ===
  const iniH = parseInt(ini.split(':')[0]);
  const finH = parseInt(fin.split(':')[0]);
  const [rIni, rFin] = rango === '06-18' ? [6, 18] : [18, 6];

  // Caso rango 06→18
  if (rango === '06-18') {
    if (iniH < 6 || iniH >= 18 || finH < 6 || finH > 18) {
      alert("⚠️ Los horarios deben estar entre 06:00 y 18:00.");
      return;
    }
  }
  // Caso rango 18→06
  else {
    const validoInicio = (iniH >= 18 && iniH <= 23) || (iniH >= 0 && iniH < 6);
    const validoFin    = (finH >= 18 && finH <= 23) || (finH >= 0 && finH <= 6);
    if (!validoInicio || !validoFin) {
      alert("⚠️ Los horarios deben estar entre 18:00 y 06:00.");
      return;
    }
  }

  // === Si pasa la validación, agregar la barra ===
  // === Si pasa la validación, agregar la barra ===
cgAddBar(linea, ini, fin, sabor);
form.reset();
// 🔔 subo YA la nueva corrida
if (window.syncNow) window.syncNow();

});

// === NOVEDADES ===
const FORM_KEY = "novedades_v1";

const formNovedad = document.getElementById("formNovedad");
const nvLinea = document.getElementById("nvLinea");
const nvHora = document.getElementById("nvHora");
const nvTexto = document.getElementById("nvTexto");
const nvClear = document.getElementById("nvClear");

// === Agregar novedad ===
function addNovedad(linea, hora, texto, restored = false) {
  const cards = document.querySelectorAll(".linea-card");
  const card = Array.from(cards).find(c => 
    c.querySelector("h3").textContent.trim() === linea
  );
  if (!card) return;

  const ul = card.querySelector("ul");
  const li = document.createElement("li");
  li.innerHTML = `<b>${hora}:</b> ${texto}`;
  ul.appendChild(li);

  if (!restored) {
    const saved = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
    saved.push({ linea, hora, texto });
    // 🔹 Ordenar por línea y hora antes de guardar
    saved.sort((a, b) => {
      if (a.linea !== b.linea) return a.linea.localeCompare(b.linea);
      return a.hora.localeCompare(b.hora);
    });
    localStorage.setItem(FORM_KEY, JSON.stringify(saved));
  }
}

// === Cargar novedades guardadas ===
function loadNovedades() {
  const saved = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  saved.forEach(nv => addNovedad(nv.linea, nv.hora, nv.texto, true));
}
if (window.syncNow) window.syncNow();

// === Borrar todas ===
function clearNovedades() {
  if (!confirm("¿Borrar todas las novedades guardadas?")) return;
  localStorage.removeItem(FORM_KEY);
  document.querySelectorAll(".linea-card ul").forEach(u => u.innerHTML = "");
}

// === Manejo del formulario ===
formNovedad.addEventListener("submit", e => {
  e.preventDefault();
  const linea = nvLinea.value.trim();
  const hora = nvHora.value.trim();
  const texto = nvTexto.value.trim();
  const rango = document.getElementById("cgRango").value;

  if (!linea || !hora || !texto) {
    alert("Por favor completá todos los campos.");
    return;
  }

  // 🔹 Validar que la hora esté dentro del rango
  const h = parseInt(hora.split(":")[0]);
  let valido = false;
  if (rango === "06-18" && h >= 6 && h < 18) valido = true;
  if (rango === "18-06" && (h >= 18 || h < 6)) valido = true;

  if (!valido) {
    alert("⚠️ La hora ingresada está fuera del rango seleccionado.");
    return;
  }

  addNovedad(linea, hora, texto);
  formNovedad.reset();

  // 🔹 Redibujar la lista ordenada
  document.querySelectorAll(".linea-card ul").forEach(u => u.innerHTML = "");
  loadNovedades();
});

nvClear.addEventListener("click", () => { 
  clearNovedades(); 
  if (window.syncNow) window.syncNow();
});

cgClearBtn.addEventListener('click', () => {
  cgClear();
  if (window.syncNow) window.syncNow();
});

function toggleBotoneras(visible) {
  const secciones = document.querySelectorAll(
    '.cg-form, .form-novedad, .acciones, button'
  );
  secciones.forEach(el => {
    el.style.display = visible ? '' : 'none';
  });
}






// ======== PERSISTENCIA ÚNICA DE LA TABLA PRINCIPAL ========
const TABLA_KEY = "tabla_produccion_v1";

// 🔹 Guarda automáticamente al editar
document.addEventListener("DOMContentLoaded", () => {
  restoreTabla();
  document.querySelectorAll(".tabla-produccion td[contenteditable]").forEach(td => {
    td.addEventListener("input", saveTabla);
  });
});

// Guarda
function saveTabla() {
  const filas = [];
  document.querySelectorAll(".tabla-produccion tbody tr").forEach(tr => {
    const linea = tr.querySelector("th").textContent.trim();
    const celdas = Array.from(tr.querySelectorAll("td")).map(td => td.textContent.trim());
    filas.push({ linea, celdas });
  });
  localStorage.setItem(TABLA_KEY, JSON.stringify(filas));
}

// Restaura
function restoreTabla() {
  const saved = JSON.parse(localStorage.getItem(TABLA_KEY) || "[]");
  saved.forEach(({ linea, celdas }) => {
    const fila = Array.from(document.querySelectorAll(".tabla-produccion tbody tr"))
      .find(tr => tr.querySelector("th").textContent.trim() === linea);
    if (fila) {
      const tds = fila.querySelectorAll("td");
      celdas.forEach((txt, i) => {
        if (tds[i]) tds[i].textContent = txt;
      });
    }
  });
}

// Limpia
function clearTabla() {
  localStorage.removeItem(TABLA_KEY);
  document.querySelectorAll(".tabla-produccion td[contenteditable]").forEach(td => td.textContent = "");
  console.log("🧹 Tabla principal vaciada.");
}

// Extiende los botones existentes
const oldCgClear = cgClear;
cgClear = function() {
  oldCgClear();
  clearTabla();
};

const oldClearNovedades = clearNovedades;
clearNovedades = function() {
  oldClearNovedades();
  clearTabla();
};

// ======== FIX: BORRADO DEFINITIVO DE DATOS DE LA TABLA PRINCIPAL ========

// Sobrescribimos todas las posibles claves antiguas
function clearTablaTotal() {
  // Elimina todas las variantes que pudieron quedar activas
  ["tablaDatos", "tabla_produccion_v1"].forEach(k => localStorage.removeItem(k));

  // Limpia visualmente
  document.querySelectorAll(".tabla-produccion td[contenteditable]").forEach(td => td.textContent = "");
  console.log("🧹 Tabla principal completamente vaciada.");
}

// Vinculamos con ambos botones (corridas y novedades)
document.getElementById("cgClear").addEventListener("click", clearTablaTotal);
document.getElementById("nvClear").addEventListener("click", clearTablaTotal);

// Además, ejecutamos una limpieza automática si detecta datos corruptos
document.addEventListener("DOMContentLoaded", () => {
  const oldA = localStorage.getItem("tablaDatos");
  const oldB = localStorage.getItem("tabla_produccion_v1");
  if (oldA && oldB) {
    // Si existen ambas, mantenemos solo la más reciente
    try {
      const a = JSON.parse(oldA);
      const b = JSON.parse(oldB);
      if (b.length >= a.length) localStorage.removeItem("tablaDatos");
      else localStorage.removeItem("tabla_produccion_v1");
    } catch {
      localStorage.removeItem("tablaDatos");
      localStorage.removeItem("tabla_produccion_v1");
    }
  }
});

// ======== PERSISTENCIA DEL ENCABEZADO ========
const ENC_KEY = "encabezado_v1";

// Guarda los valores del encabezado
function saveEncabezado() {
  const data = {
    turno: document.getElementById("turno").value,
    tn: document.getElementById("tn").value,
    fecha: document.getElementById("fecha").value,
    dia: document.getElementById("dia").value
  };
  localStorage.setItem(ENC_KEY, JSON.stringify(data));
}

// Restaura los valores guardados
function restoreEncabezado() {
  const saved = JSON.parse(localStorage.getItem(ENC_KEY) || "{}");
  if (saved.turno) document.getElementById("turno").value = saved.turno;
  if (saved.tn) document.getElementById("tn").value = saved.tn;
  if (saved.fecha) document.getElementById("fecha").value = saved.fecha;
  if (saved.dia) document.getElementById("dia").value = saved.dia;
}

// Limpia el encabezado (usado al borrar todo)
function clearEncabezado() {
  localStorage.removeItem(ENC_KEY);
  document.getElementById("turno").value = "";
  document.getElementById("tn").value = "";
  document.getElementById("fecha").value = "";
  document.getElementById("dia").value = "";
  console.log("🧹 Encabezado borrado.");
}

// Guarda automáticamente al cambiar cualquier campo
["turno", "tn", "fecha", "dia"].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener("change", saveEncabezado);
});

// Restaura al cargar la página
document.addEventListener("DOMContentLoaded", restoreEncabezado);

// Integra con los botones de borrado globales
document.getElementById("cgClear").addEventListener("click", clearEncabezado);
document.getElementById("nvClear").addEventListener("click", clearEncabezado);


const btnInforme = document.getElementById("btnInforme");

btnInforme.addEventListener("click", async () => {
  // Ocultá las botoneras como ya hacés
  toggleBotoneras(false);

  // Estado ocupado visual
  btnInforme.classList.add("is-busy");
  btnInforme.setAttribute("aria-busy", "true");
  btnInforme.disabled = true;

  try {
    await new Promise(r => setTimeout(r, 600)); // tu espera de layout

    const area = document.body;
const canvas = await html2canvas(area, { scale: 2 });
const { jsPDF } = window.jspdf;
const pdf = new jsPDF("p", "mm", "a4");

const imgData = canvas.toDataURL("image/png");
const pageW = pdf.internal.pageSize.getWidth();
const pageH = pdf.internal.pageSize.getHeight();
const imgH  = (canvas.height * pageW) / canvas.width;

// ✅ Si la imagen entra en una sola página, agregamos solo una
if (imgH <= pageH) {
  pdf.addImage(imgData, "PNG", 0, 0, pageW, imgH);
} else {
  // Caso multipágina (informe largo)
  let y = 0;
  while (y < imgH) {
    pdf.addImage(imgData, "PNG", 0, -y * (pageH / imgH), pageW, imgH);
    y += pageH;
    if (y < imgH - 10) pdf.addPage();
  }
}

pdf.save("informe-produccion.pdf");

  } finally {
    // Restaurá la vista y el botón
    toggleBotoneras(true);
    btnInforme.classList.remove("is-busy");
    btnInforme.removeAttribute("aria-busy");
    btnInforme.disabled = false;
  }
});


/* =========================
   Botón de MODO (CARGA / LECTURA)
   ========================= */
(function () {
  const MODE_KEY = "modo_app_v1";

  // Referencia o crea el botón (por si no existe aún en el HTML)
  let modeBtn = document.getElementById("modeBtn");
  if (!modeBtn) {
    modeBtn = document.createElement("button");
    modeBtn.id = "modeBtn";
    modeBtn.className = "mode-btn-header";
    modeBtn.innerHTML =
      '<span class="mode-icon"></span><span class="mode-label"></span>';
    const logoBox = document.querySelector(".logo-encabezado");
    if (logoBox) logoBox.prepend(modeBtn);
    else document.body.appendChild(modeBtn);
  }

  const label = modeBtn.querySelector(".mode-label");

  // --- Mostrar u ocultar zonas editables según el modo ---
  function showEditUI(show) {
    const selectors = [
      ".cg-form",
      ".form-novedad",
      "#btnInforme",
      "#cgClear",
      "#nvClear",
      "#formBarra button",
      "#formNovedad button"
    ];
    selectors.forEach((sel) =>
      document.querySelectorAll(sel).forEach((el) => {
        if (el.id === "modeBtn" || el.closest("#modeBtn")) return;
        el.style.display = show ? "" : "none";
      })
    );

    // Encabezado
    ["turno", "tn", "fecha"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !show;
    });

    // Bloquea edición en lectura
    document
      .querySelectorAll(".tabla-produccion tbody td")
      .forEach((td) =>
        td.setAttribute("contenteditable", show ? "true" : "false")
      );
  }

  // --- Aplica el modo ---
  function applyMode(mode) {
    const lectura = mode === "lectura";
    modeBtn.classList.toggle("is-lectura", lectura);
    label.textContent = lectura ? "Modo: LECTURA" : "Modo: CARGA";
    showEditUI(!lectura);
    localStorage.setItem(MODE_KEY, mode);
  }

  // --- Cambiar modo al hacer clic ---
  modeBtn.addEventListener("click", () => {
    const newMode = modeBtn.classList.contains("is-lectura")
      ? "carga"
      : "lectura";
    applyMode(newMode);
  });

  // --- Inicialización ---
  applyMode(localStorage.getItem(MODE_KEY) || "carga");

  // --- Sobrescribe la función toggleBotoneras ---
  window.toggleBotoneras = function (visible) {
    showEditUI(visible);
  };
})();

/* =========================
   🔄 FIRESTORE — Sync en vivo + puntero global al informe activo
   ========================= */
(() => {
  const informesRef = collection(db, "informes_produccion");
  const pointerRef  = doc(collection(db, "informes_pointer"), "global"); // <- puntero único

  const CLIENT_ID = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const SYNC = { applying:false, writing:false, lastSeen:0, unsubDoc:null, unsubPointer:null, debounce:null };
  let CURRENT_DOC_ID = null;

  // ------- Helpers -------
  function makeDocId(fecha, turno) {
    const f = (fecha || "sin_fecha").trim();
    const t = (turno || "sin_turno").trim().replace(/\s+/g, "_");
    return `${f}_${t}`;
  }
  function readHeader() {
    return {
      fecha: document.getElementById("fecha")?.value || "",
      turno: document.getElementById("turno")?.value || ""
    };
  }
  function currentDocIdFromInputs() {
    const { fecha, turno } = readHeader();
    if (!fecha || !turno) return null;
    return makeDocId(fecha, turno);
  }
  function docRef(id = CURRENT_DOC_ID || currentDocIdFromInputs()) {
    if (!id) return null;
    return doc(informesRef, id);
  }
  function readLocalPayload() {
    return {
      encabezado: JSON.parse(localStorage.getItem("encabezado_v1") || "{}"),
      tabla:      JSON.parse(localStorage.getItem("tabla_produccion_v1") || "[]"),
      corridas:   JSON.parse(localStorage.getItem("corridas") || "[]"),
      novedades:  JSON.parse(localStorage.getItem("novedades_v1") || "[]"),
    };
  }
  function parseIdToHeader(id) {
    // id es "YYYY-MM-DD_TURNO X" (con _ por espacios)
    const [fechaGuess, ...turnoParts] = (id || "").split("_");
    const turnoGuess = (turnoParts.join("_") || "").replace(/_/g, " ");
    return { fechaGuess, turnoGuess };
  }

  // ------- Aplicar remoto a localStorage + DOM -------
  function applyRemote(data) {
    SYNC.applying = true;
    try {
      localStorage.setItem("encabezado_v1",       JSON.stringify(data.encabezado || {}));
      localStorage.setItem("tabla_produccion_v1", JSON.stringify(data.tabla || []));
      localStorage.setItem("corridas",            JSON.stringify(data.corridas || []));
      localStorage.setItem("novedades_v1",        JSON.stringify(data.novedades || []));

      // Limpio y repinto con tus funciones
      document.querySelectorAll(".cg-lane").forEach(l => (l.innerHTML = ""));
      document.querySelectorAll(".linea-card ul").forEach(u => (u.innerHTML = ""));

      restoreEncabezado();
      restoreTabla();
      if (typeof cgBuildAxis === "function") cgBuildAxis();
      restoreCorridas();
      loadNovedades();
    } finally {
      SYNC.applying = false;
    }
  }

  // ------- Subir cambios locales (debounced) -------
  async function pushToFirestore() {
    if (SYNC.applying || SYNC.writing) return;
    const ref = docRef();
    if (!ref) return; // aún no hay fecha/turno

    SYNC.writing = true;
    const payload = { ...readLocalPayload(), updatedAt: Date.now(), sourceId: CLIENT_ID };
    try {
      await setDoc(ref, payload, { merge: true });
      SYNC.lastSeen = payload.updatedAt;
    } catch (err) {
      console.error("❌ Error al sincronizar:", err);
    } finally {
      SYNC.writing = false;
    }
  }

  // ------- Forzar escritura del puntero global -------
  async function pushPointer(newId) {
    if (!newId) return;
    try {
      await setDoc(pointerRef, { currentId: newId, updatedAt: Date.now(), sourceId: CLIENT_ID }, { merge: true });
    } catch (e) {
      console.error("❌ Error actualizando puntero:", e);
    }
  }

  // ------- Pull inicial del doc actual -------
  async function pullOnce(id = CURRENT_DOC_ID || currentDocIdFromInputs()) {
    const ref = id ? doc(informesRef, id) : null;
    if (!ref) return;
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.sourceId === CLIENT_ID) return;
      if (data.updatedAt && data.updatedAt <= SYNC.lastSeen) return;
      SYNC.lastSeen = data.updatedAt || Date.now();
      applyRemote(data);
    } catch (err) {
      console.error("❌ Error al restaurar:", err);
    }
  }

  // ------- Listener en vivo del documento -------
  function startDocListener() {
    if (!CURRENT_DOC_ID) return;
    if (SYNC.unsubDoc) { SYNC.unsubDoc(); SYNC.unsubDoc = null; }
    const ref = doc(informesRef, CURRENT_DOC_ID);
    SYNC.unsubDoc = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.sourceId === CLIENT_ID) return;
      if (SYNC.applying || SYNC.writing) return;
      if (data.updatedAt && data.updatedAt <= SYNC.lastSeen) return;
      SYNC.lastSeen = data.updatedAt || Date.now();
      applyRemote(data);
    });
  }

  // ------- Listener del puntero global -------
  function startPointerListener() {
    if (SYNC.unsubPointer) { SYNC.unsubPointer(); SYNC.unsubPointer = null; }
    SYNC.unsubPointer = onSnapshot(pointerRef, async (snap) => {
      if (!snap.exists()) return;
      const p = snap.data();
      if (!p.currentId) return;
      if (p.sourceId === CLIENT_ID) return; // yo mismo acabo de mover el puntero

      // Si el puntero cambió a otro informe, me muevo
      if (p.currentId !== CURRENT_DOC_ID) {
        CURRENT_DOC_ID = p.currentId;

        // Actualizo inputs con el id (sin disparar sync)
        const { fechaGuess, turnoGuess } = parseIdToHeader(CURRENT_DOC_ID);
        SYNC.applying = true;
        try {
          const fEl = document.getElementById("fecha");
          const tEl = document.getElementById("turno");
          if (fEl && fechaGuess) fEl.value = fechaGuess;
          if (tEl && turnoGuess) tEl.value = turnoGuess;

          // también refresco encabezado en localStorage
          const enc = JSON.parse(localStorage.getItem("encabezado_v1") || "{}");
          enc.fecha = fechaGuess || enc.fecha || "";
          enc.turno = turnoGuess || enc.turno || "";
          localStorage.setItem("encabezado_v1", JSON.stringify(enc));
        } finally {
          SYNC.applying = false;
        }

        await pullOnce(CURRENT_DOC_ID);
        startDocListener();
      }
    });
  }

  // ------- Auto-enganche al iniciar -------
  async function ensureDocSelectedAtStart() {
    const idFromInputs = currentDocIdFromInputs();
    if (idFromInputs) {
      CURRENT_DOC_ID = idFromInputs;
      await pullOnce(CURRENT_DOC_ID);
      startDocListener();
      startPointerListener();
      // Publico puntero para que los demás sigan este informe
      pushPointer(CURRENT_DOC_ID);
      return;
    }

    // Si no hay fecha/turno local, intento seguir el puntero global
    try {
      const snap = await getDoc(pointerRef);
      if (snap.exists() && snap.data().currentId) {
        CURRENT_DOC_ID = snap.data().currentId;

        // Pinto inputs con el puntero (sin disparar sync)
        const { fechaGuess, turnoGuess } = parseIdToHeader(CURRENT_DOC_ID);
        SYNC.applying = true;
        try {
          if (document.getElementById("fecha") && fechaGuess) document.getElementById("fecha").value = fechaGuess;
          if (document.getElementById("turno") && turnoGuess) document.getElementById("turno").value = turnoGuess;

          const enc = JSON.parse(localStorage.getItem("encabezado_v1") || "{}");
          enc.fecha = fechaGuess || enc.fecha || "";
          enc.turno = turnoGuess || enc.turno || "";
          localStorage.setItem("encabezado_v1", JSON.stringify(enc));
        } finally {
          SYNC.applying = false;
        }

        await pullOnce(CURRENT_DOC_ID);
        startDocListener();
        startPointerListener();
        return;
      }
    } catch {}

    // Si no hay puntero, caigo al último informe por updatedAt
    try {
      const q = query(informesRef, orderBy("updatedAt", "desc"), limit(1));
      const qs = await getDocs(q);
      if (!qs.empty) {
        CURRENT_DOC_ID = qs.docs[0].id;
        const { fechaGuess, turnoGuess } = parseIdToHeader(CURRENT_DOC_ID);
        SYNC.applying = true;
        try {
          if (document.getElementById("fecha") && fechaGuess) document.getElementById("fecha").value = fechaGuess;
          if (document.getElementById("turno") && turnoGuess) document.getElementById("turno").value = turnoGuess;
          const enc = JSON.parse(localStorage.getItem("encabezado_v1") || "{}");
          enc.fecha = fechaGuess || enc.fecha || "";
          enc.turno = turnoGuess || enc.turno || "";
          localStorage.setItem("encabezado_v1", JSON.stringify(enc));
        } finally {
          SYNC.applying = false;
        }
        await pullOnce(CURRENT_DOC_ID);
        startDocListener();
        startPointerListener();
        // y fijo puntero para todos
        pushPointer(CURRENT_DOC_ID);
      } else {
        // nada que escuchar aún, pero arranco pointer listener
        startPointerListener();
      }
    } catch (err) {
      console.error("❌ Error auto-seleccionando informe:", err);
      startPointerListener();
    }
  }

  // ======== Arranque ========
  document.addEventListener("DOMContentLoaded", ensureDocSelectedAtStart);

  // ======== Si cambia fecha/turno local: re-suscribo y publico puntero ========
  ["fecha", "turno"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", async () => {
      if (SYNC.applying) return; // cambio programático
      const newId = currentDocIdFromInputs();
      if (!newId || newId === CURRENT_DOC_ID) return;
      CURRENT_DOC_ID = newId;
      await pullOnce(CURRENT_DOC_ID);
      startDocListener();
      pushPointer(CURRENT_DOC_ID); // <- todos los demás se mueven a este doc
      // subo mis datos
      setTimeout(pushToFirestore, 80);
    });
  });

  // ======== Disparar sync en cambios locales (debounced) ========
  ["input", "change"].forEach(evt => {
    window.addEventListener(evt, () => {
      if (SYNC.applying || SYNC.writing) return;
      clearTimeout(SYNC.debounce);
      SYNC.debounce = setTimeout(pushToFirestore, 700);
    });
  });

  // ======== Botones que fuerzan sync ========
  ["btnInforme", "cgClear", "nvClear"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => setTimeout(pushToFirestore, 60));
  });
    // --- Exponer un sync inmediato para usar desde cualquier lugar ---
  window.syncNow = () => {
    // dispara una subida inmediata y segura
    setTimeout(() => {
      if (!SYNC.applying && !SYNC.writing) {
        // misma función que ya usás internamente
        // (no la marcamos global para no ensuciar el scope)
        // simplemente reusamos pushToFirestore
        (async () => {
          const ref = docRef();
          if (!ref) return;
          SYNC.writing = true;
          const payload = { ...readLocalPayload(), updatedAt: Date.now(), sourceId: CLIENT_ID };
          try {
            await setDoc(ref, payload, { merge: true });
            SYNC.lastSeen = payload.updatedAt;
          } catch (err) {
            console.error("❌ Error al sincronizar:", err);
          } finally {
            SYNC.writing = false;
          }
        })();
      }
    }, 0);
  };


})();
