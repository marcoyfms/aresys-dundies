/* ============================================================
   CONFIG
============================================================ */
const STORAGE = {
  users:   "dundies_users_v1",
  session: "dundies_session_v1",
  rows:    "dundies_rows_v1",
  poll:    "dundies_poll_v1"
};

const AWARDS = [
  "Best Bug Hunter","Deploy Master","Caffeine Champion","Code Wizard",
  "Meeting Survivor","Documentation Hero","Rubber Duck Whisperer","Git Master",
  "Pixel Perfect","Data Ninja","Radar Whisperer","SAR Sensei",
  "MVP of the Year","Rookie of the Year","Late Night Legend","Keyboard Warrior",
  "The Debugger","Best Coffee Maker"
];

/* ============================================================
   STATE
============================================================ */
let users   = load(STORAGE.users, {});
let session = load(STORAGE.session, null);
let rows    = load(STORAGE.rows, []);
let poll    = load(STORAGE.poll, { responses: [] });
let selectedDates = new Set();
let attendChoice = null;
let pendingRole = null;

/* ============================================================
   UTILS
============================================================ */
function load(key, fallback){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e){ return fallback; }
}
function save(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
}
function esc(s){
  return String(s==null?"":s).replace(/[&<>"']/g, c => (
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]
  ));
}
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(()=>t.classList.remove("show"), 2400);
}
function userKey(nome, cognome){
  return `${nome.trim().toLowerCase()}|${cognome.trim().toLowerCase()}`;
}
function isoDate(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
function formatDateIT(iso){
  const [y,m,d] = iso.split("-");
  const dt = new Date(y,m-1,d);
  const dow = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][dt.getDay()];
  const mon = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"][dt.getMonth()];
  return { dow, day:d, mon, full:`${dow} ${d} ${mon}` };
}

/* ============================================================
   NAVIGATION
============================================================ */
document.querySelectorAll("[data-nav]").forEach(btn=>{
  btn.addEventListener("click", ()=> goto(btn.dataset.nav));
});
document.getElementById("navBrand").addEventListener("click", ()=> goto("home"));

function goto(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const el = document.getElementById("page-"+page);
  if(el) el.classList.add("active");
  document.querySelectorAll("[data-nav]").forEach(b=>{
    b.classList.toggle("active", b.dataset.nav===page);
  });
  window.scrollTo({top:0,behavior:"smooth"});

  // Se sto andando in una pagina protetta senza login, torno alla home
  if(!session && (page==="poll" || page==="organizers")){
    goto("home");
    toast("Effettua il login per accedere");
  }
}

/* ============================================================
   LOGIN / LOGOUT
============================================================ */
document.querySelectorAll(".role-btn").forEach(btn=>{
  btn.addEventListener("click", ()=> openLogin(btn.dataset.role));
});

function openLogin(role){
  pendingRole = role;
  document.getElementById("loginRoleTitle").textContent =
    role==="organizer" ? "Accesso Organizzatore" : "Accesso Plebeo";
  document.getElementById("loginRoleDesc").textContent =
    role==="organizer"
      ? "Entra per gestire partecipanti, awards e scaletta."
      : "Entra per votare la data e confermare la presenza.";
  document.getElementById("loginSubmit").textContent =
    role==="organizer" ? "Entra come Organizzatore" : "Entra come Plebeo";

  document.getElementById("loginNome").value = "";
  document.getElementById("loginCognome").value = "";
  document.getElementById("loginPwd").value = "";
  updateLoginHint();
  goto("login");
}

document.getElementById("loginBack").addEventListener("click", ()=> goto("home"));

["loginNome","loginCognome"].forEach(id=>{
  document.getElementById(id).addEventListener("input", updateLoginHint);
});

function updateLoginHint(){
  const nome = document.getElementById("loginNome").value.trim();
  const cognome = document.getElementById("loginCognome").value.trim();
  const hint = document.getElementById("loginHint");
  hint.className = "login-hint";
  if(!nome || !cognome){ hint.textContent = ""; return; }

  const key = userKey(nome, cognome);
  const u = users[key];
  if(u){
    hint.textContent = `Bentornato ${u.nome}! Inserisci la tua password.`;
    hint.classList.add("info");
  } else {
    hint.textContent = "Primo accesso: la password che scegli ora diventerà la tua password.";
    hint.classList.add("warn");
  }
}

document.getElementById("loginForm").addEventListener("submit", e=>{
  e.preventDefault();
  const nome = document.getElementById("loginNome").value.trim();
  const cognome = document.getElementById("loginCognome").value.trim();
  const pwd = document.getElementById("loginPwd").value;
  const hint = document.getElementById("loginHint");

  if(!nome || !cognome || !pwd){
    hint.textContent = "Compila tutti i campi.";
    hint.className = "login-hint error";
    return;
  }

  const key = userKey(nome, cognome);
  const existing = users[key];

  if(existing){
    // Utente esistente → verifica password
    if(existing.password !== pwd){
      hint.textContent = "Password errata.";
      hint.className = "login-hint error";
      return;
    }
    if(existing.role !== pendingRole){
      hint.textContent = `Questo utente è registrato come "${existing.role}". Accedi da lì.`;
      hint.className = "login-hint error";
      return;
    }
  } else {
    // Primo accesso → registra
    users[key] = {
      nome, cognome, password: pwd, role: pendingRole,
      createdAt: Date.now()
    };
    save(STORAGE.users, users);
    toast("Account creato ✦");
  }

  // Salva sessione
  session = { nome, cognome, role: pendingRole };
  save(STORAGE.session, session);
  applySession();
  toast(`Benvenuto, ${nome}!`);

  // Redirect in base al ruolo
  goto(pendingRole === "organizer" ? "organizers" : "poll");
});

document.getElementById("logoutBtn").addEventListener("click", ()=>{
  session = null;
  save(STORAGE.session, null);
  applySession();
  goto("home");
  toast("Logout effettuato");
});

function applySession(){
  const body = document.body;
  body.classList.toggle("logged-in", !!session);
  body.classList.toggle("logged-organizer", !!session && session.role==="organizer");

  const navUser = document.getElementById("navUser");
  if(session){
    navUser.textContent = `${session.nome} ${session.cognome}`;
    document.getElementById("pollUserName").textContent = `${session.nome} ${session.cognome}`;
  } else {
    navUser.textContent = "";
  }

  // se organizzsatore, prepara tabella
  if(session && session.role==="organizer") renderTable();
}

/* ============================================================
   POLL
============================================================ */
function generateNextDays(n){
  const out = [];
  const today = new Date();
  today.setHours(0,0,0,0);
  for(let i=1;i<=n;i++){
    const d = new Date(today);
    d.setDate(today.getDate()+i);
    out.push(d);
  }
  return out;
}

function renderPollCalendar(){
  const wrap = document.getElementById("pollCalendar");
  if(!wrap) return;
  const days = generateNextDays(45);
  const counts = {};
  poll.responses.forEach(r=>{
    (r.dates||[]).forEach(d=>{ counts[d] = (counts[d]||0)+1; });
  });

  wrap.innerHTML = days.map(d=>{
    const iso = isoDate(d);
    const f = formatDateIT(iso);
    const c = counts[iso]||0;
    return `<div class="day-card ${selectedDates.has(iso)?"selected":""}" data-date="${iso}">
      ${c>0?`<span class="count">${c}</span>`:``}
      <div class="dow">${f.dow}</div>
      <div class="day">${f.day}</div>
      <div class="mon">${f.mon}</div>
    </div>`;
  }).join("");

  wrap.querySelectorAll(".day-card").forEach(card=>{
    card.addEventListener("click", ()=>{
      const iso = card.dataset.date;
      if(selectedDates.has(iso)) selectedDates.delete(iso);
      else selectedDates.add(iso);
      card.classList.toggle("selected");
    });
  });
}

document.querySelectorAll(".attend-opt").forEach(opt=>{
  opt.addEventListener("click", ()=>{
    document.querySelectorAll(".attend-opt").forEach(o=>o.classList.remove("selected"));
    opt.classList.add("selected");
    attendChoice = opt.dataset.attend;
  });
});

document.getElementById("submitPoll").addEventListener("click", ()=>{
  if(!session){ toast("Devi effettuare il login"); return; }
  if(!attendChoice){ toast("Indica se partecipi"); return; }
  if(attendChoice!=="no" && selectedDates.size===0){ toast("Seleziona almeno una data"); return; }

  const name = `${session.nome} ${session.cognome}`;
  const dates = attendChoice==="no" ? [] : Array.from(selectedDates).sort();
  poll.responses = poll.responses.filter(r => r.name.toLowerCase() !== name.toLowerCase());
  poll.responses.push({ name, dates, attendance: attendChoice, ts: Date.now() });
  save(STORAGE.poll, poll);
  renderPollResults();
  renderPollCalendar();
  toast("Voto registrato ✦");
});

document.getElementById("resetPoll").addEventListener("click", ()=>{
  selectedDates.clear();
  attendChoice = null;
  document.querySelectorAll(".attend-opt").forEach(o=>o.classList.remove("selected"));
  renderPollCalendar();
});

function renderPollResults(){
  const wrap = document.getElementById("pollResults");
  if(!wrap) return;
  if(!poll.responses.length){
    wrap.innerHTML = `<div class="empty-state">Ancora nessun voto.</div>`;
    return;
  }
  const counts = {};
  poll.responses.forEach(r=>{
    (r.dates||[]).forEach(d=>{
      if(!counts[d]) counts[d] = [];
      counts[d].push(r.name);
    });
  });

  const dateRows = Object.keys(counts).sort().map(d=>{
    const f = formatDateIT(d);
    const names = counts[d];
    return `<div class="result-row">
      <span class="date">${f.full} (${names.length})</span>
      <span class="names">${esc(names.join(", "))}</span>
    </div>`;
  }).join("");

  const yes = poll.responses.filter(r=>r.attendance==="yes");
  const maybe = poll.responses.filter(r=>r.attendance==="maybe");
  const no = poll.responses.filter(r=>r.attendance==="no");

  wrap.innerHTML = `
    ${dateRows || `<div class="empty-state">Nessuna data selezionata.</div>`}
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:6px">
      <div class="result-row" style="border-left-color:#98c379">
        <span class="date" style="color:#98c379">✓ Confermati (${yes.length})</span>
        <span class="names">${esc(yes.map(r=>r.name).join(", ")||"—")}</span>
      </div>
      <div class="result-row" style="border-left-color:#d4af37">
        <span class="date" style="color:#f0d878">? Forse (${maybe.length})</span>
        <span class="names">${esc(maybe.map(r=>r.name).join(", ")||"—")}</span>
      </div>
      <div class="result-row" style="border-left-color:#e06c75">
        <span class="date" style="color:#e06c75">✕ Non può (${no.length})</span>
        <span class="names">${esc(no.map(r=>r.name).join(", ")||"—")}</span>
      </div>
    </div>
  `;
}

/* ============================================================
   ORGANIZER TABLE
============================================================ */
function renderTable(){
  const tbody = document.getElementById("orgTableBody");
  const empty = document.getElementById("orgEmpty");
  if(!tbody) return;

  if(!rows.length){
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = rows.map((r, i)=>`
    <tr data-idx="${i}">
      <td style="color:var(--text-dim);font-family:'JetBrains Mono',monospace;font-size:11px">${i+1}</td>
      <td><input type="text" data-field="nome" value="${esc(r.nome)}" placeholder="—"></td>
      <td><input type="text" data-field="cognome" value="${esc(r.cognome)}" placeholder="—"></td>
      <td style="text-align:center">
        <input type="checkbox" class="check" data-field="presente" ${r.presente?"checked":""}>
      </td>
      <td>
        <div class="award-cell" data-idx="${i}" data-field="awards">
          ${r.awards && r.awards.length
            ? `<div class="tag-list">${r.awards.map(a=>`<span class="tag">${esc(a)}</span>`).join("")}</div>`
            : `<span class="placeholder">Seleziona award…</span>`}
        </div>
      </td>
      <td><input type="text" data-field="award2" value="${esc(r.award2)}" placeholder="—"></td>
      <td><button class="row-del" title="Elimina">✕</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("input[data-field]").forEach(inp=>{
    const idx = +inp.closest("tr").dataset.idx;
    const field = inp.dataset.field;
    const handler = ()=>{
      rows[idx][field] = field==="presente" ? inp.checked : inp.value;
      save(STORAGE.rows, rows);
    };
    inp.addEventListener("input", handler);
    inp.addEventListener("change", handler);
  });

  tbody.querySelectorAll(".row-del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = +btn.closest("tr").dataset.idx;
      rows.splice(idx,1);
      save(STORAGE.rows, rows);
      renderTable();
    });
  });

  tbody.querySelectorAll(".award-cell").forEach(cell=>{
    cell.addEventListener("click", e=>{
      e.stopPropagation();
      openAwardDropdown(+cell.dataset.idx, cell);
    });
  });
}

/* AWARD DROPDOWN */
let dropdown = null;
function closeDropdown(){
  if(dropdown){ dropdown.remove(); dropdown = null; document.removeEventListener("click", outsideHandler); }
}
function outsideHandler(e){
  if(dropdown && !dropdown.contains(e.target) && !e.target.closest(".award-cell")) closeDropdown();
}
function openAwardDropdown(idx, anchor){
  closeDropdown();
  const row = rows[idx];
  dropdown = document.createElement("div");
  dropdown.className = "award-dropdown";
  dropdown.innerHTML = AWARDS.map(a=>`
    <label>
      <input type="checkbox" value="${esc(a)}" ${row.awards.includes(a)?"checked":""}>
      <span>${esc(a)}</span>
    </label>
  `).join("");
  document.body.appendChild(dropdown);

  const rect = anchor.getBoundingClientRect();
  const dw = 240;
  let top = rect.bottom + window.scrollY + 6;
  let left = rect.left + window.scrollX;
  if(left + dw > window.innerWidth - 12) left = window.innerWidth - dw - 12;

  dropdown.style.top = top + "px";
  dropdown.style.left = left + "px";
  dropdown.style.width = dw + "px";

  dropdown.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    cb.addEventListener("change", ()=>{
      const val = cb.value;
      if(cb.checked){
        if(!row.awards.includes(val)) row.awards.push(val);
      } else {
        row.awards = row.awards.filter(x=>x!==val);
      }
      save(STORAGE.rows, rows);
      anchor.innerHTML = row.awards.length
        ? `<div class="tag-list">${row.awards.map(a=>`<span class="tag">${esc(a)}</span>`).join("")}</div>`
        : `<span class="placeholder">Seleziona award…</span>`;
    });
  });

  setTimeout(()=>document.addEventListener("click", outsideHandler),0);
}

/* ============================================================
   EXCEL
============================================================ */
document.getElementById("btnAddRow").addEventListener("click", ()=>{
  rows.push({ nome:"", cognome:"", presente:false, awards:[], award2:"" });
  save(STORAGE.rows, rows);
  renderTable();
});

document.getElementById("btnClear").addEventListener("click", ()=>{
  if(!confirm("Svuotare completamente la lista?")) return;
  rows = [];
  save(STORAGE.rows, rows);
  renderTable();
});

document.getElementById("btnExport").addEventListener("click", ()=>{
  const data = rows.map(r=>({
    "NOME": r.nome||"", "COGNOME": r.cognome||"",
    "PRESENTE": r.presente?"SI":"NO",
    "AWARD": (r.awards||[]).join(", "),
    "AWARD 2": r.award2||""
  }));
  const ws = XLSX.utils.json_to_sheet(data.length?data:[
    {NOME:"",COGNOME:"",PRESENTE:"",AWARD:"","AWARD 2":""}
  ]);
  ws["!cols"] = [{wch:18},{wch:18},{wch:10},{wch:40},{wch:20}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dundies");
  XLSX.writeFile(wb, "Aresys_Dundies.xlsx");
  toast("Excel esportato ✦");
});

document.getElementById("btnTemplate").addEventListener("click", ()=>{
  const template = [
    { "NOME":"Mario","COGNOME":"Rossi","PRESENTE":"SI","AWARD":"Best Bug Hunter, Code Wizard","AWARD 2":"MVP of the Year" },
    { "NOME":"Luigi","COGNOME":"Verdi","PRESENTE":"NO","AWARD":"","AWARD 2":"" }
  ];
  const ws = XLSX.utils.json_to_sheet(template);
  ws["!cols"] = [{wch:18},{wch:18},{wch:10},{wch:40},{wch:20}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dundies");
  XLSX.writeFile(wb, "Aresys_Dundies_Template.xlsx");
});

document.getElementById("btnImport").addEventListener("click", ()=>{
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", e=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = evt=>{
    try{
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, {type:"array"});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, {defval:""});
      const norm = json.map(r=>{
        const presenteRaw = (r["PRESENTE"]||"").toString().trim().toUpperCase();
        const awardsStr = (r["AWARD"]||"").toString();
        return {
          nome: (r["NOME"]||"").toString().trim(),
          cognome: (r["COGNOME"]||"").toString().trim(),
          presente: ["SI","SÌ","YES","TRUE"].includes(presenteRaw) || r["PRESENTE"]===true,
          awards: awardsStr ? awardsStr.split(",").map(s=>s.trim()).filter(Boolean) : [],
          award2: (r["AWARD 2"]||"").toString().trim()
        };
      }).filter(r=> r.nome || r.cognome);

      if(!norm.length){ toast("Nessuna riga valida trovata"); return; }
      rows = norm;
      save(STORAGE.rows, rows);
      renderTable();
      toast(`${norm.length} righe importate ✦`);
    }catch(err){
      console.error(err);
      toast("Errore durante l'import");
    }finally{
      e.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
});

/* ============================================================
   INIT
============================================================ */
(function init(){
  renderPollCalendar();
  renderPollResults();
  applySession();
})();
