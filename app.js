// Minimal IndexedDB + editor logic
const DB_NAME = 'nameboard-db';
const STORE = 'projects';
const KEY = 'default';

function openDB(){
  return new Promise((resolve, reject)=>{
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = ()=>{
      const db = r.result;
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    r.onsuccess = ()=> resolve(r.result);
    r.onerror = ()=> reject(r.error);
  });
}
async function putData(value){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}
async function getData(){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = ()=> resolve(req.result || null);
    req.onerror = ()=> reject(req.error);
  });
}

// UI
const pages = document.getElementById('pages');
const btnAddPage = document.getElementById('addPage');
const btnAddVH = document.getElementById('addVH');
const btnAddHH = document.getElementById('addHH');
const btnToggle = document.getElementById('toggle');
const btnDup = document.getElementById('dup');
const btnDel = document.getElementById('del');
const slider = document.getElementById('font');
const btnExport = document.getElementById('export');
const inputImport = document.getElementById('import');

let selected = null;
let saveTimer = null;

function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=> putData(serialize()), 400);
}

function newPage(data){
  const p = document.createElement('div');
  p.className = 'page';
  p.addEventListener('pointerdown', ()=>select(null));
  pages.appendChild(p);
  if(data?.items){ data.items.forEach(it=>addTextbox(p, it)); }
  scheduleSave();
  return p;
}

function addTextbox(page, data={}){
  const tb = document.createElement('div');
  tb.className = 'textbox ' + (data.mode || 'vh');
  tb.contentEditable = "true";
  tb.style.left = (data.x ?? 40) + 'px';
  tb.style.top = (data.y ?? 40) + 'px';
  tb.style.width = (data.w ?? 140) + 'px';
  tb.style.height = (data.h ?? 220) + 'px';
  tb.style.fontSize = (data.fs ?? 20) + 'px';
  tb.innerText = data.text ?? 'ここに入力';
  tb.dataset.mode = data.mode || 'vh';

  let dragging=false, sx=0, sy=0, ox=0, oy=0;
  tb.addEventListener('pointerdown', (e)=>{
    if(e.target.classList.contains('handle')) return;
    dragging=true; sx=e.clientX; sy=e.clientY;
    const r = tb.getBoundingClientRect();
    const pr = page.getBoundingClientRect();
    ox = r.left - pr.left; oy = r.top - pr.top;
    tb.setPointerCapture(e.pointerId);
    select(tb); e.preventDefault();
  });
  tb.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    tb.style.left = Math.max(0, ox+dx) + 'px';
    tb.style.top  = Math.max(0, oy+dy) + 'px';
  });
  tb.addEventListener('pointerup', ()=>{ dragging=false; scheduleSave(); });

  const h = document.createElement('div');
  h.className = 'handle'; h.textContent = '↘';
  tb.appendChild(h);
  let resizing=false, sw=0, sh=0, rw=0, rh=0;
  h.addEventListener('pointerdown', (e)=>{
    resizing=true; sw=e.clientX; sh=e.clientY;
    rw = tb.offsetWidth; rh = tb.offsetHeight;
    h.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });
  h.addEventListener('pointermove', (e)=>{
    if(!resizing) return;
    tb.style.width = Math.max(40, rw + (e.clientX - sw)) + 'px';
    tb.style.height= Math.max(40, rh + (e.clientY - sh)) + 'px';
  });
  h.addEventListener('pointerup', ()=>{ resizing=false; scheduleSave(); });

  tb.addEventListener('input', scheduleSave);
  tb.addEventListener('focus', ()=>select(tb));
  page.appendChild(tb);
  select(tb);
  scheduleSave();
  return tb;
}

function select(el){
  document.querySelectorAll('.textbox').forEach(x=>x.classList.remove('selected'));
  selected = el;
  if(el){ el.classList.add('selected'); slider.value = parseInt(el.style.fontSize)||20; }
}

btnAddPage.onclick = ()=> newPage();
btnAddVH.onclick = ()=>{ const p = pages.lastElementChild || newPage(); addTextbox(p, {mode:'vh'}); };
btnAddHH.onclick = ()=>{ const p = pages.lastElementChild || newPage(); addTextbox(p, {mode:'hh'}); };
slider.oninput = ()=>{ if(!selected) return; selected.style.fontSize = slider.value + 'px'; scheduleSave(); };
btnToggle.onclick = ()=>{
  if(!selected) return;
  if(selected.dataset.mode === 'vh'){
    selected.dataset.mode = 'hh'; selected.classList.remove('vh'); selected.classList.add('hh');
  }else{
    selected.dataset.mode = 'vh'; selected.classList.remove('hh'); selected.classList.add('vh');
  }
  scheduleSave();
};
btnDup.onclick = ()=>{
  if(!selected) return;
  const page = selected.closest('.page');
  const rect = selected.getBoundingClientRect();
  const pr = page.getBoundingClientRect();
  addTextbox(page, {
    mode: selected.dataset.mode,
    x: Math.min(rect.left - pr.left + 20, page.clientWidth-60),
    y: Math.min(rect.top - pr.top + 20, page.clientHeight-60),
    w: selected.offsetWidth, h: selected.offsetHeight,
    fs: parseInt(selected.style.fontSize)||20,
    text: selected.innerText
  });
};
btnDel.onclick = ()=>{
  if(!selected) return;
  const nxt = selected.nextElementSibling || selected.previousElementSibling;
  selected.remove();
  select(nxt && nxt.classList.contains('textbox') ? nxt : null);
  scheduleSave();
};

function serialize(){
  const data = [];
  document.querySelectorAll('.page').forEach(pg=>{
    const items=[];
    pg.querySelectorAll('.textbox').forEach(tb=>{
      items.push({
        mode: tb.dataset.mode,
        x: parseInt(tb.style.left)||0,
        y: parseInt(tb.style.top)||0,
        w: tb.offsetWidth, h: tb.offsetHeight,
        fs: parseInt(tb.style.fontSize)||20,
        text: tb.innerText
      });
    });
    data.push({items});
  });
  return {version:1, pages:data, savedAt:Date.now()};
}

function restore(data){
  pages.innerHTML='';
  (data?.pages||[]).forEach(p=>newPage(p));
  if(!pages.children.length) newPage();
}

btnExport.onclick = ()=>{
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nameboard.json';
  a.click();
  URL.revokeObjectURL(a.href);
};
inputImport.onchange = async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  restore(data);
  await putData(serialize());
};

(async function init(){
  const data = await getData();
  if(data) restore(data); else newPage();
})();
