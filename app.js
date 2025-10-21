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
// ¿Estoy en modo lectura?
function isLectura() {
  const btn = document.getElementById("modeBtn");
  return !!btn && btn.classList.contains("is-lectura");
}

// Mostrar/ocultar botoncitos "x" según el modo
function updateBarDeleteVisibility(show) {
  document.querySelectorAll(".cg-bar .cg-bar-close").forEach(btn => {
    btn.classList.toggle("is-hidden", !show);
  });
}

// Remueve una corrida del storage (por coincidencia exacta)
function removeCorrida(linea, inicio, fin, sabor) {
  const saved = JSON.parse(localStorage.getItem("corridas") || "[]");
  const next  = saved.filter(c => !(c.linea==linea && c.inicio==inicio && c.fin==fin && c.sabor==sabor));
  localStorage.setItem("corridas", JSON.stringify(next));
  if (window.syncNow) window.syncNow();
}


function cgAddBar(linea, inicio, fin, sabor, restored = false) {
  const lane = document.querySelector(`.cg-lane[data-linea="${linea}"]`);
  if (!lane) return;

  const rangeText = `${inicio}|${fin}`;
  const dupe = Array.from(lane.children).find(
    b => b.dataset.timeRange === rangeText && b.textContent.replace(/^\s*×\s*/,'') === sabor
  );
  if (dupe) dupe.remove();

  // --- cálculos ---
  const [iniH, iniM] = inicio.split(":").map(Number);
  const [finH, finM] = fin.split(":").map(Number);
  const iniTotal = iniH * 60 + iniM;
  const finTotal = finH * 60 + finM;
  const totalHoras = 12 * 60;
  const startRange = window.cgStartHour * 60;

  let startMin, endMin;
  if ((startRange + totalHoras) % (24*60) > startRange) {
    startMin = Math.max(0, iniTotal - startRange);
    endMin   = Math.min(totalHoras, finTotal - startRange);
  } else {
    startMin = (iniTotal >= startRange) ? iniTotal - startRange : (24*60 - startRange) + iniTotal;
    endMin   = (finTotal >= startRange) ? finTotal - startRange : (24*60 - startRange) + finTotal;
  }
  const startPercent = (startMin / totalHoras) * 100;
  const widthPercent = Math.max(1, ((endMin - startMin) / totalHoras) * 100);

  const existingBars = lane.querySelectorAll(".cg-bar").length;
  const offsetY = 8 + existingBars * 28;

  const bar = document.createElement("div");
  bar.className = "cg-bar";
  bar.dataset.timeRange = rangeText;
  bar.dataset.linea = String(linea);
  bar.dataset.sabor = sabor;
  bar.style.left = `${startPercent}%`;
  bar.style.width = `${widthPercent}%`;
  bar.style.top = `${offsetY}px`;
  bar.dataset.restored = restored ? "true" : "false";

  // botón "x"
  const x = document.createElement("button");
  x.type = "button";
  x.className = "cg-bar-close";
  x.textContent = "×";
  if (isLectura()) x.classList.add("is-hidden");
  x.addEventListener("click", (e) => {
    e.stopPropagation();
    const l = bar.dataset.linea;
    const [ini, fin] = bar.dataset.timeRange.split("|");
    const sab = bar.dataset.sabor;
    bar.remove();
    // recalcular altura del carril
    const left = lane.querySelectorAll(".cg-bar").length;
    lane.style.height = `${Math.max(40, 40 + (left-1) * 28)}px`;
    removeCorrida(l, ini, fin, sab);
  });

  bar.appendChild(x);
  // el texto de la barra después del botón
  bar.appendChild(document.createTextNode(sabor));

  lane.appendChild(bar);
  lane.style.height = `${40 + existingBars * 28}px`;

  if (!restored) {
    const saved = JSON.parse(localStorage.getItem("corridas") || "[]");
    saved.push({ linea, inicio, fin, sabor });
    localStorage.setItem("corridas", JSON.stringify(saved));
    if (window.syncNow) window.syncNow();
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
  updateBarDeleteVisibility(!isLectura()); // asegura visibilidad correcta
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

/* === Horas en punto (alta de novedades) — SELECT con opciones === */

// Si #nvHora no es <select>, lo convertimos manteniendo id y required
(function ensureNvHoraSelect(){
  const el = document.getElementById("nvHora");
  if (!el) return;
  if (el.tagName.toLowerCase() === "select") return; // ya es select
  const sel = document.createElement("select");
  sel.id = el.id;
  if (el.hasAttribute("required")) sel.setAttribute("required", "");
  el.parentNode.replaceChild(sel, el);
})();

function buildNvHoraOptions(){
  const sel = document.getElementById("nvHora");
  const rangoSel = document.getElementById("cgRango");
  if (!sel || !rangoSel) return;

  const rango = rangoSel.value;
  const opts = [];
  if (rango === "06-18"){
    for (let h=6; h<18; h++){
      const v = String(h).padStart(2,"0") + ":00";
      opts.push(`<option value="${v}">${v}</option>`);
    }
  } else {
    for (let h=18; h<=23; h++){
      const v = String(h).padStart(2,"0") + ":00";
      opts.push(`<option value="${v}">${v}</option>`);
    }
    for (let h=0; h<=6; h++){
      const v = String(h).padStart(2,"0") + ":00";
      opts.push(`<option value="${v}">${v}</option>`);
    }
  }

  const prev = sel.value;
  sel.innerHTML = opts.join("");
  const still = Array.from(sel.options).some(o => o.value === prev);
  sel.value = still ? prev : (sel.options[0]?.value || "");
}

// construir al cargar y cuando cambia la franja
document.addEventListener("DOMContentLoaded", () => {
  buildNvHoraOptions();
  renderNovedades?.();   // pinta lo guardado si lo tenés
});
document.getElementById("cgRango")?.addEventListener("change", buildNvHoraOptions);


// Construir al cargar y cuando cambia la franja
document.addEventListener("DOMContentLoaded", buildNvHoraOptions);
document.getElementById("cgRango")?.addEventListener("change", buildNvHoraOptions);



// ======== EDITAR NOVEDADES (modo masivo) ========
let NV_EDITING = false; // flag del modo edición masiva

function rangoActual() {
  return document.getElementById("cgRango")?.value === "18-06" ? "18-06" : "06-18";
}

function horaEnPuntoValida(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return false;
  const [h, m] = hhmm.split(":").map(Number);
  if (m !== 0) return false; // sólo en punto
  if (rangoActual() === "06-18") return h >= 6 && h <= 18; // 18:00 permitido como tope visual
  // 18-06: 18..23 o 0..6
  return (h >= 18 && h <= 23) || (h >= 0 && h <= 6);
}

// Crea barra de acciones de novedades (una sola vez)
function ensureNvControls() {
  const cont = document.querySelector(".novedades");
  if (!cont || cont.querySelector(".nv-actions")) return;

  const bar = document.createElement("div");
  bar.className = "nv-actions";
  bar.style.display = "flex";
  bar.style.gap = "8px";
  bar.style.padding = "10px";
  bar.style.borderTop = "1px solid #000";
  bar.style.background = "#f1f1f1";

  const btnEditAll = document.createElement("button");
  btnEditAll.id = "nvEditAll";
  btnEditAll.type = "button";
  btnEditAll.textContent = "Editar novedades";
  const btnSaveAll = document.createElement("button");
  btnSaveAll.id = "nvSaveAll";
  btnSaveAll.type = "button";
  btnSaveAll.textContent = "Guardar";
  const btnCancelAll = document.createElement("button");
  btnCancelAll.id = "nvCancelAll";
  btnCancelAll.type = "button";
  btnCancelAll.textContent = "Cancelar";

  // estilos simples
  [btnEditAll, btnSaveAll, btnCancelAll].forEach(b => {
    b.style.background = "#e10600";
    b.style.color = "#fff";
    b.style.border = "0";
    b.style.borderRadius = "8px";
    b.style.padding = "8px 12px";
    b.style.fontWeight = "700";
    b.style.cursor = "pointer";
  });
  btnEditAll.style.background = "#3e3e3e";
  btnCancelAll.style.background = "#555";

  bar.appendChild(btnEditAll);
  bar.appendChild(btnSaveAll);
  bar.appendChild(btnCancelAll);

  // al crear, en lectura quedan ocultos
  const isLecturaNow = document.getElementById("modeBtn")?.classList.contains("is-lectura");
  bar.style.display = isLecturaNow ? "none" : "flex";

  cont.insertBefore(bar, cont.querySelector(".linea-card")); // debajo del h2

  // handlers
  btnEditAll.addEventListener("click", enterNvEditMode);
  btnSaveAll.addEventListener("click", saveNvEdits);
  btnCancelAll.addEventListener("click", cancelNvEdits);
}

function enterNvEditMode() {
  NV_EDITING = true;
  // Para cada <li>, convertir en inputs
  document.querySelectorAll(".linea-card li").forEach(li => {
    const linea = li.closest(".linea-card")?.querySelector("h3")?.textContent.trim() || "";
    // leer actuales
    const b = li.querySelector("b");
    const horaActual = li.dataset.hora || (b ? b.textContent.replace(/:$/, "").trim() : "06:00");

    const txtNode = li.querySelector(".nv-text");
    const textoActual = txtNode ? txtNode.textContent : (li.dataset.texto || "");

    // guardar originales para poder localizar y/o cancelar
    li.dataset.originalLinea = linea;
    li.dataset.originalHora = horaActual;
    li.dataset.originalTexto = textoActual;

    // limpiar y armar UI de edición
    li.innerHTML = "";

    const inHora = document.createElement("input");
    inHora.type = "time";
    inHora.step = 3600; // sólo en punto
    inHora.value = horaActual;
    inHora.style.width = "110px";
    inHora.style.fontWeight = "700";

    // marcar visualmente si queda fuera de franja
    function validateHourInput() {
      const ok = horaEnPuntoValida(inHora.value);
      inHora.style.outline = ok ? "2px solid transparent" : "2px solid #e10600";
      return ok;
    }
    inHora.addEventListener("input", validateHourInput);
    setTimeout(validateHourInput, 0);

    const ta = document.createElement("textarea");
    ta.rows = 2;
    ta.value = textoActual;
    ta.style.width = "100%";
    ta.style.marginLeft = "8px";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    row.appendChild(inHora);
    row.appendChild(ta);

    li.appendChild(row);
  });
}

function saveNvEdits() {
  if (!NV_EDITING) return;

  const items = Array.from(document.querySelectorAll(".linea-card li"));
  const list = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");

  for (const li of items) {
    const input = li.querySelector('input[type="time"]');
    const ta    = li.querySelector('textarea');
    if (!input || !ta) continue;

    const oldLinea = li.dataset.originalLinea;
    const oldHora  = li.dataset.originalHora;
    const oldTexto = li.dataset.originalTexto;

    const newHora  = input.value;
    const newTexto = ta.value.trim();

    if (!newTexto) { alert("Hay una novedad sin descripción."); ta.focus(); return; }
    if (!horaEnPuntoValida(newHora)) { alert("Hay una hora fuera de la franja o no es 'en punto'."); input.focus(); return; }

    // ⬇️ AQUÍ va:
    const idx = list.findIndex(nv => nv.linea === oldLinea && nv.hora === oldHora && nv.texto === oldTexto);
    if (idx !== -1) list[idx] = { linea: oldLinea, hora: newHora, texto: newTexto };
  }

  list.sort((a,b)=> (a.linea||"").localeCompare(b.linea||"") || (a.hora||"").localeCompare(b.hora||""));
  localStorage.setItem(FORM_KEY, JSON.stringify(list));
  if (window.syncNow) window.syncNow();

  NV_EDITING = false;
  renderNovedades();
}

function cancelNvEdits() {
  NV_EDITING = false;
  renderNovedades();
}

// Render de novedades SIN botón "Editar" por item
function renderNovedades() {
  ensureNvControls();

  // Mostrar/ocultar barra de acciones según el modo
  const bar = document.querySelector(".nv-actions");
  const isLectura = document.getElementById("modeBtn")?.classList.contains("is-lectura");
  if (bar) bar.style.display = isLectura ? "none" : "flex";

  // Limpiar listas
  document.querySelectorAll(".linea-card ul").forEach(u => u.innerHTML = "");

  // Leer y ordenar
  const saved = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  saved.sort((a, b) =>
    (a.linea || "").localeCompare(b.linea || "") ||
    (a.hora || "").localeCompare(b.hora || "")
  );

  // Pintar
  saved.forEach(({ linea, hora, texto }) => {
    const card = Array.from(document.querySelectorAll(".linea-card"))
      .find(c => c.querySelector("h3").textContent.trim() === linea);
    if (!card) return;

    const ul = card.querySelector("ul");

    const li = document.createElement("li");
    li.dataset.linea = linea;
    li.dataset.hora  = hora;   // sin dos puntos
    li.dataset.texto = texto;

    const b = document.createElement("b");
    b.textContent = `${hora}:`;

    const spanTxt = document.createElement("span");
    spanTxt.className = "nv-text";
    spanTxt.textContent = " " + texto;

    // Botón borrar
    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "nv-del";
    btnDel.textContent = "×";
    btnDel.title = "Eliminar novedad";
    btnDel.addEventListener("click", (e) => {
      e.stopPropagation();
      const { linea, hora, texto } = li.dataset;
      if (confirm("¿Eliminar esta novedad?")) {
        deleteNovedad(linea, hora, texto);
      }
    });
    // Ocultar en modo lectura
    if (isLectura) btnDel.style.display = "none";

    // Orden final: hora, texto, botón
    li.appendChild(b);
    li.appendChild(spanTxt);
    li.appendChild(btnDel);
    ul.appendChild(li);
  });
}

// Crea un <select> de horas "en punto" según la franja actual y setea valor inicial
function createHoraSelect(initialValue){
  const sel = document.createElement("select");
  sel.required = true;

  const rango = document.getElementById("cgRango")?.value || "06-18";
  const hours = [];
  if (rango === "06-18") {
    for (let h=6; h<18; h++) hours.push(h);
  } else {
    for (let h=18; h<=23; h++) hours.push(h);
    for (let h=0; h<=6; h++) hours.push(h);
  }
  sel.innerHTML = hours.map(h=>{
    const v = String(h).padStart(2,"0")+":00";
    return `<option value="${v}">${v}</option>`;
  }).join("");

  if (initialValue && Array.from(sel.options).some(o=>o.value===initialValue)){
    sel.value = initialValue;
  }
  return sel;
}



if (window.syncNow) window.syncNow();

// === Borrar todas ===
function clearNovedades() {
  if (!confirm("¿Borrar todas las novedades guardadas?")) return;
  localStorage.removeItem(FORM_KEY);
  document.querySelectorAll(".linea-card ul").forEach(u => u.innerHTML = "");
}



function addNovedad(linea, hora, texto, restored = false) {
  if (!restored) {
    const saved = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
    saved.push({ linea, hora, texto });
    saved.sort((a,b)=> (a.linea||"").localeCompare(b.linea||"") || (a.hora||"").localeCompare(b.hora||""));
    localStorage.setItem(FORM_KEY, JSON.stringify(saved));
    if (window.syncNow) window.syncNow();
  }
  renderNovedades();
}

function deleteNovedad(linea, hora, texto) {
  const list = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  const idx = list.findIndex(nv => nv.linea === linea && nv.hora === hora && nv.texto === texto);
  if (idx !== -1) {
    list.splice(idx, 1);
    localStorage.setItem(FORM_KEY, JSON.stringify(list));
    if (window.syncNow) window.syncNow();
  }
  renderNovedades();
}

// === Manejo del formulario ===
formNovedad.addEventListener("submit", e => {
  e.preventDefault();

  // ⚠️ Asegurar que el select tenga opciones (por si aún no se generaron)
  const selHora = document.getElementById("nvHora");
  if (selHora && selHora.tagName.toLowerCase() === "select" && selHora.options.length === 0) {
    buildNvHoraOptions();
  }

  const linea = nvLinea.value.trim();
  const hora  = (document.getElementById("nvHora")?.value || "").trim();
  const texto = nvTexto.value.trim();
  const rango = document.getElementById("cgRango").value;

  if (!linea || !hora || !texto) {
    alert("Por favor completá todos los campos.");
    return;
  }

  // HH:00 solamente
  if (!/^\d{2}:00$/.test(hora)) {
    alert("Usá horas en punto (HH:00).");
    return;
  }

  // Validar franja
  const h = parseInt(hora.split(":")[0], 10);
  let valido = false;
  if (rango === "06-18" && h >= 6 && h < 18) valido = true;
  if (rango === "18-06" && (h >= 18 || h < 6)) valido = true;
  if (!valido) {
    alert("⚠️ La hora ingresada está fuera del rango seleccionado.");
    return;
  }

  addNovedad(linea, hora, texto);
  formNovedad.reset();
  buildNvHoraOptions(); // reponer opciones y dejar seleccionada la primera
  renderNovedades();
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
const TABLA_FILTRO_KEY = "tabla_filtrar_completas_v1"; // true => mostrar solo filas completadas


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
    filas.push({ linea, celdas }); // celdas.length === 6
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
      // Escribo hasta 6 celdas, limpio extras si las hubiera
      for (let i = 0; i < tds.length; i++) {
        tds[i].textContent = (celdas && celdas[i]) ? celdas[i] : "";
      }
    }
  });

  // aplicar filtro si estaba activo
  const onlyCompleted = localStorage.getItem(TABLA_FILTRO_KEY) === "true";
  aplicarFiltroFilasCompletadas(onlyCompleted);
}

function filaTieneContenido(tr) {
  const celdas = Array.from(tr.querySelectorAll("td")).map(td => td.textContent.trim());
  // Consideramos "completada" la línea si hay contenido en al menos Sabor 1 o Formato 1 o Vel 1
  // (si querés que sea “todas las 6 llenas”, cambiá la condición)
  return celdas.some(txt => txt.length > 0);
}

function aplicarFiltroFilasCompletadas(onlyCompleted) {
  const filas = document.querySelectorAll(".tabla-produccion tbody tr");
  filas.forEach(tr => {
    const visible = !onlyCompleted || filaTieneContenido(tr);
    tr.style.display = visible ? "" : "none";
  });
  localStorage.setItem(TABLA_FILTRO_KEY, onlyCompleted ? "true" : "false");
}

// ======== Estado de edición de la tabla ========
let TABLE_EDITING = false;

function setTableEditing(on) {
  TABLE_EDITING = !!on;
  const tds = document.querySelectorAll(".tabla-produccion tbody td");
  tds.forEach(td => {
    td.setAttribute("contenteditable", on ? "true" : "false");
    td.classList.toggle("is-editing", on);
  });
}

function enterEditMode() {
  // mostrar todas las filas para editar
  aplicarFiltroFilasCompletadas(false);
  setTableEditing(true);
  const first = document.querySelector(".tabla-produccion tbody td");
  if (first) first.focus();
}

function saveAndLock() {
  // guardar y mostrar solo filas con contenido, luego bloquear edición
  saveTabla();
  aplicarFiltroFilasCompletadas(true);
  setTableEditing(false);
  // empujar sync inmediato si está disponible
  if (window.syncNow) window.syncNow();
}

const btnEditarFormatos = document.getElementById("btnEditarFormatos");
const btnGrabarFormatos = document.getElementById("btnGrabarFormatos");

if (btnEditarFormatos) {
  btnEditarFormatos.addEventListener("click", enterEditMode);
}
if (btnGrabarFormatos) {
  btnGrabarFormatos.addEventListener("click", saveAndLock);
}





// Limpia
function clearTabla() {
  localStorage.removeItem(TABLA_KEY);
  document.querySelectorAll(".tabla-produccion td[contenteditable]").forEach(td => td.textContent = "");
  console.log("🧹 Tabla principal vaciada.");
}




// ======== FIX: BORRADO DEFINITIVO DE DATOS DE LA TABLA PRINCIPAL ========

// Sobrescribimos todas las posibles claves antiguas
function clearTablaTotal() {
  // Elimina todas las variantes que pudieron quedar activas
  ["tablaDatos", "tabla_produccion_v1"].forEach(k => localStorage.removeItem(k));

  // Limpia visualmente
  document.querySelectorAll(".tabla-produccion td[contenteditable]").forEach(td => td.textContent = "");
  console.log("🧹 Tabla principal completamente vaciada.");
}


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
   Botón de MODO (CARGA / LECTURA) — robusto
   ========================= */
(function () {
  const MODE_KEY = "modo_app_v1";

  // 1) Asegurar el botón y sus spans
  let modeBtn = document.getElementById("modeBtn");
  if (!modeBtn) {
    modeBtn = document.createElement("button");
    modeBtn.id = "modeBtn";
    modeBtn.type = "button";
    modeBtn.className = "mode-btn-header";
    modeBtn.innerHTML = '<span class="mode-icon" aria-hidden="true"></span><span class="mode-label"></span>';
    (document.querySelector(".logo-encabezado") || document.body).prepend(modeBtn);
  }
  function ensureParts(){
    if (!modeBtn.querySelector(".mode-icon")) {
      const i = document.createElement("span");
      i.className = "mode-icon";
      i.setAttribute("aria-hidden","true");
      modeBtn.prepend(i);
    }
    if (!modeBtn.querySelector(".mode-label")) {
      const l = document.createElement("span");
      l.className = "mode-label";
      modeBtn.appendChild(l);
    }
  }
  ensureParts();

  const label = () => modeBtn.querySelector(".mode-label");

  // 2) Mostrar/ocultar controles de edición (sin tocar contenteditable de la tabla)
  function showEditUI(show) {
    const selectors = [
      ".cg-form",
      ".form-novedad",
      "#btnInforme",
      "#cgClear",
      "#nvClear",
      "#formBarra button",
      "#formNovedad button",
      ".tabla-acciones",
      "#btnEditarFormatos",
      "#btnGrabarFormatos",
    ];
    selectors.forEach((sel) =>
      document.querySelectorAll(sel).forEach((el) => {
        if (el.id === "modeBtn" || el.closest("#modeBtn")) return;
        el.style.display = show ? "" : "none";
      })
    );
    // inputs de encabezado
    ["turno", "tn", "fecha"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !show;
    });
  }

  // 3) Estado edición tabla (lo usa grabar/editar). Si lo tenés en otro sitio, dejamos estas no-ops seguras
  if (typeof window.setTableEditing !== "function") {
    window.setTableEditing = function(on){
      document.querySelectorAll(".tabla-produccion tbody td")
        .forEach(td => td.setAttribute("contenteditable", on ? "true" : "false"));
    };
  }

  // 4) Aplicar modo + accesibilidad
  function applyMode(mode) {
  const lectura = mode === "lectura";
  modeBtn.classList.toggle("is-lectura", lectura);
  const text = lectura ? "Modo: LECTURA" : "Modo: CARGA";
  
  
  showEditUI(!lectura);
  updateBarDeleteVisibility(!lectura);
  if (lectura && typeof cancelNvEdits === "function") cancelNvEdits();
if (typeof renderNovedades === "function") renderNovedades();
  if (lectura) setTableEditing(false);
  localStorage.setItem(MODE_KEY, mode);
}


  // 5) Click handler (evitamos listeners duplicados)
  modeBtn.onclick = () => {
    const newMode = modeBtn.classList.contains("is-lectura") ? "carga" : "lectura";
    applyMode(newMode);
  };

  // 6) Init
  applyMode(localStorage.getItem(MODE_KEY) || "carga");

  // 7) Exponer hook para otras partes que te llamaban
  window.toggleBotoneras = function (visible) { showEditUI(visible); };
})();

function loadNovedades(){ renderNovedades(); }


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
      renderNovedades();
    } finally {
      SYNC.applying = false;
    }
    // asegurar que el estado de edición se respete tras repintar
    if (!TABLE_EDITING) setTableEditing(false);

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
