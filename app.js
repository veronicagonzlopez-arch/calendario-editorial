// ===== Config =====
const DAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

const PILLARS = [
  "Educación",
  "Entretenimiento",
  "Promocional o Venta",
  "Posicionamiento de marca",
  "Interacción",
  "Noticias o Novedades",
];

const DOCS = ["Imagen","Vídeo","Carrusel","Stories","Otro"];
const STATUS = ["En proceso","Trabajando","Publicado"];
const SOCIAL = ["Instagram","TikTok","LinkedIn","Pinterest","Facebook","Web / Blog"];

const STORAGE_KEY = "editorial_calendar_v2";
const DB_NAME = "editorial_media_db_v1";
const STORE = "files";

// ===== IndexedDB helpers =====
function idbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE)){
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutFile(fileObj){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(fileObj);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetFile(id){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeleteFile(id){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function uid(){
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

// ===== Generic helpers =====
function isoDate(d){
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function formatES(d){
  return d.toLocaleDateString("es-ES", { day:"2-digit", month:"2-digit", year:"numeric" });
}

function mondayOf(date){
  const d = new Date(date);
  const day = (d.getDay()+6)%7; // Monday=0
  d.setDate(d.getDate()-day);
  d.setHours(0,0,0,0);
  return d;
}

function statusClass(s){
  if(s === "Publicado") return "published";
  if(s === "Trabajando") return "working";
  return "process";
}
function pilarClass(pilar){
  return "pilar-" + pilar.replace(/\s+/g, "-");
}


function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{
    return null;
  }
}

function saveState(state){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeDefaultState(startISO){
  const start = mondayOf(startISO || new Date());
  const days = [];
  for(let i=0;i<14;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);

    days.push({
      id: isoDate(d),
      date: isoDate(d),

      programar: false,
      estado: "En proceso",
      pilar: "Educación",

      contenido: "",
      proyecto: "",
      documento: "Imagen",

      media: [], // [{id, name, type}]

      copy: "",
      cta: "",
      hashtags: "",
      red: "Instagram",
      hora: "",

      alcance: "",
      interaccion: "",
      notas: ""
    });
  }
  return { start: isoDate(start), days };
}

// ===== UI refs =====
const grid = document.getElementById("grid");
const startDate = document.getElementById("startDate");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");
const resetBtn = document.getElementById("resetBtn");

// ===== State =====
let state = loadState() || makeDefaultState();
saveState(state);

// ===== Media paint =====
async function paintMedia(card, item){
  const mg = card.querySelector('[data-k="mediaGrid"]');
  if(!mg) return;
  mg.innerHTML = "";

  for(const m of (item.media || [])){
    const rec = await idbGetFile(m.id);
    if(!rec) continue;

    const wrap = document.createElement("div");
    wrap.className = "mediaItem";

    const del = document.createElement("button");
    del.className = "mediaDel";
    del.type = "button";
    del.textContent = "✕";
    del.addEventListener("click", async () => {
      await idbDeleteFile(m.id);
      item.media = item.media.filter(x => x.id !== m.id);
      saveState(state);
      await paintMedia(card, item);
    });

    wrap.appendChild(del);

    if(rec.type && rec.type.startsWith("video/")){
      const v = document.createElement("video");
      v.src = rec.dataUrl;
      v.controls = true;
      wrap.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.src = rec.dataUrl;
      img.alt = rec.name || "media";
      wrap.appendChild(img);
    }

    mg.appendChild(wrap);
  }
}

// ===== Render =====
function render(){
  grid.innerHTML = "";
  startDate.value = state.start;

  state.days.forEach((day, idx) => {
    const d = new Date(day.date + "T00:00:00");
    const dow = DAYS[idx % 7];

    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = day.id;

    card.innerHTML = `
      <div class="cardHeader">
        <div>
          <h2 class="dayTitle">${dow}</h2>
          <div class="dateLabel">${formatES(d)}</div>
        </div>
        <span class="badge ${statusClass(day.estado)}">${day.estado}</span>
      </div>

      <div class="row">
        <label class="k">Programar</label>
        <div class="small">
          <input type="checkbox" data-k="programar" ${day.programar ? "checked" : ""} />
          <span class="k">listo</span>
        </div>
      </div>

      <div class="row">
        <label class="k">Estado</label>
        <select data-k="estado">
          ${STATUS.map(x=>`<option ${x===day.estado?"selected":""}>${x}</option>`).join("")}
        </select>
      </div>

      <div class="row">
        <label class="k">Pilar</label>
        <select data-k="pilar" class="${pilarClass(day.pilar)}">

          ${PILLARS.map(x=>`<option ${x===day.pilar?"selected":""}>${x}</option>`).join("")}
        </select>
      </div>

      <div class="row">
        <label class="k">Contenido</label>
        <input type="text" data-k="contenido" value="${escapeHtml(day.contenido)}" placeholder="Ej: Carrusel tips..." />
      </div>

      <div class="row">
        <label class="k">Proyecto</label>
        <input type="text" data-k="proyecto" value="${escapeHtml(day.proyecto)}" placeholder="Ej: Diseño con Alma / cliente..." />
      </div>

      <div class="row">
        <label class="k">Documento</label>
        <select data-k="documento">
          ${DOCS.map(x=>`<option ${x===day.documento?"selected":""}>${x}</option>`).join("")}
        </select>
      </div>

      <div class="row">
        <label class="k">Media</label>
        <div class="mediaWrap">
          <input type="file" data-k="mediaUpload" multiple accept="image/*,video/*" />
          <div class="mediaGrid" data-k="mediaGrid"></div>
        </div>
      </div>

      <hr/>

      <div class="row">
        <label class="k">Copy</label>
        <textarea data-k="copy" placeholder="Escribe el copy...">${escapeHtml(day.copy)}</textarea>
      </div>

      <div class="row">
        <label class="k">CTA/Enlace</label>
        <input type="url" data-k="cta" value="${escapeHtml(day.cta)}" placeholder="https://... o 'Visita el blog'" />
      </div>

      <div class="row">
        <label class="k">Hashtags</label>
        <textarea data-k="hashtags" placeholder="#diseñoconalma #branding...">${escapeHtml(day.hashtags)}</textarea>
      </div>

      <div class="row">
        <label class="k">Red social</label>
        <select data-k="red">
          ${SOCIAL.map(x=>`<option ${x===day.red?"selected":""}>${x}</option>`).join("")}
        </select>
      </div>

      <div class="row">
        <label class="k">Hora</label>
        <input type="time" data-k="hora" value="${escapeHtml(day.hora)}" />
      </div>

      <hr/>

      <div class="row">
        <label class="k">Alcance</label>
        <input type="number" data-k="alcance" value="${escapeHtml(day.alcance)}" placeholder="0" min="0" />
      </div>

      <div class="row">
        <label class="k">Interacción</label>
        <input type="number" data-k="interaccion" value="${escapeHtml(day.interaccion)}" placeholder="0" min="0" />
      </div>

      <div class="row">
        <label class="k">Notas</label>
        <textarea data-k="notas" placeholder="Observaciones...">${escapeHtml(day.notas)}</textarea>
      </div>
    `;

    card.addEventListener("input", async (e) => {
      const el = e.target;
      const k = el.getAttribute("data-k");
      if(!k) return;

      const id = card.dataset.id;
      const item = state.days.find(x => x.id === id);
      if(!item) return;
      if (k === "pilar") {
  // 1. Actualizar el valor en el estado
  item.pilar = el.value;

  // 2. Eliminar cualquier clase de pilar previa
  el.classList.forEach(cls => {
    if (cls.startsWith("pilar-")) {
      el.classList.remove(cls);
    }
  });

  // 3. Añadir SOLO la clase del pilar actual
  el.classList.add(pilarClass(item.pilar));

  saveState(state);
  return;
}

// Header hide/show on scroll
const topbar = document.querySelector(".topbar");
let lastY = window.scrollY;

window.addEventListener("scroll", () => {
  const y = window.scrollY;

  // si estás arriba del todo, siempre visible
  if (y < 10){
    topbar.classList.remove("is-hidden");
    lastY = y;
    return;
  }

  // si bajas, ocultar; si subes, mostrar
  if (y > lastY + 6){
    topbar.classList.add("is-hidden");
  } else if (y < lastY - 6){
    topbar.classList.remove("is-hidden");
  }

  lastY = y;
}, { passive: true });



      // Subida de media
      if(k === "mediaUpload"){
        const files = Array.from(el.files || []);
        for(const f of files){
          const dataUrl = await fileToDataURL(f);
          const fid = uid();
          await idbPutFile({ id: fid, name: f.name, type: f.type, dataUrl });
          item.media = item.media || [];
          item.media.push({ id: fid, name: f.name, type: f.type });
        }
        saveState(state);
        await paintMedia(card, item);
        el.value = "";
        return;
      }

      // Campos normales
      if(el.type === "checkbox"){
        item[k] = el.checked;
      } else {
        item[k] = el.value;
      }

      if(k === "estado"){
        const badge = card.querySelector(".badge");
        badge.textContent = item.estado;
        badge.className = `badge ${statusClass(item.estado)}`;
      }

      saveState(state);
    });

    grid.appendChild(card);
    paintMedia(card, day);
  });
}

// ===== Events =====
startDate.addEventListener("change", () => {
  const newStart = mondayOf(startDate.value || new Date());
  // MVP: al cambiar inicio, se reinicia el calendario (si quieres, luego lo hacemos "inteligente")
  state = makeDefaultState(isoDate(newStart));
  saveState(state);
  render();
});

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `calendario-editorial-${state.start}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if(!file) return;

  try{
    const text = await file.text();
    const incoming = JSON.parse(text);
    if(!incoming?.days?.length) throw new Error("JSON inválido");

    // Importa estado (ojo: media usa IndexedDB; el JSON solo trae referencias)
    state = incoming;
    saveState(state);
    render();
  }catch{
    alert("No he podido importar ese JSON.");
  }finally{
    importInput.value = "";
  }
});

resetBtn.addEventListener("click", async () => {
  if(!confirm("¿Seguro que quieres resetear el calendario?")) return;

  // Reinicia estado (no borra IndexedDB para no liarla; si quieres lo añadimos)
  state = makeDefaultState();
  saveState(state);
  render();
});

// init
render();
