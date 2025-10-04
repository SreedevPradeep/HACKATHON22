// ====== CONFIG ======
const API_BASE = "https://YOUR-RENDER-URL.com"; // <-- replace with your Render backend URL

// ====== ELEMENTS ======
let chartInstance = null;
let lastTotal = Number(localStorage.getItem("lastTotalKg") || 0);
let myPoints = Number(localStorage.getItem("myPoints") || 0);

const els = {
  name: document.getElementById("name"),
  locality: document.getElementById("locality"),
  bill: document.getElementById("bill"),
  lpg: document.getElementById("lpg"),

  vehiclesWrap: document.getElementById("vehicles"),
  addVehicleBtn: document.getElementById("addVehicle"),

  enableNotify: document.getElementById("enableNotify"),
  notice: document.getElementById("notice"),

  commuteVal: document.getElementById("commuteVal"),
  energyVal: document.getElementById("energyVal"),
  lpgVal: document.getElementById("lpgVal"),
  fuelVal: document.getElementById("fuelVal"),
  totalVal: document.getElementById("totalVal"),

  moneyElec: document.getElementById("moneyElec"),
  moneyLpg: document.getElementById("moneyLpg"),
  moneyPetrol: document.getElementById("moneyPetrol"),
  moneyDiesel: document.getElementById("moneyDiesel"),
  moneyTotal: document.getElementById("moneyTotal"),

  tipsList: document.getElementById("tipsList"),
  leaderLoc: document.getElementById("leaderLoc"),
  leaderList: document.getElementById("leaderList"),
  submitScoreBtn: document.getElementById("submitScoreBtn"),
  rewardsList: document.getElementById("rewardsList"),
  pointsVal: document.getElementById("pointsVal"),

  cityBox: document.getElementById("citySuggestions")
};
if (els.pointsVal) els.pointsVal.textContent = myPoints;

// ====== CITY SEARCH (offline + online, instant update) ======
const CITY_LIST = [
  “Thiruvananthapuram”, “Neyyattinkara”, “Nedumangad”, “Attingal”, “Varkala”, “Kollam”, “Paravur”, “Punalur”, “Karunagapally”, “Kottarakkara”, “Pathanamthitta”, “Adoor”, “Pandalam”, “Thiruvalla”, “Alappuzha”, “Chengannur”, “Cherthala”, “Kayamkulam”, “Mavelikara”, “Haripad”, “Kottayam”, “Changanacherry”, “Pala”, “Vaikom”, “Ettumanoor”, “Erattupetta”, “Thodupuzha”, “Kattappana”, “Kochi”, “Thrippunithura”, “Thrikkakara”, “Kalamassery”, “Aluva”, “Perumbavoor”, “North Paravur”, “Angamaly”, “Muvattupuzha”, “Kothamangalam”, “Maradu”, “Eloor”, “Piravom”, “Koothattukulam”, “Thrissur”, “Irinjalakuda”, “Kunnamkulam”, “Chalakkudy”, “Kodungallur”, “Guruvayur”, “Chavakkad”, “Wadakkanchery”, “Palakkad”, “Ottappalam”, “Shornur”, “Mannarkkad”, “Chittur-Thathamangalam”, “Pattambi”, “Cherpulassery”, “Malappuram”, “Manjeri”, “Perinthalmanna”, “Tirur”, “Ponnani”, “Kottakkal”, “Nilambur”, “Kondotty”, “Tanur”, “Parappanangadi”, “Tirurangadi”, “Valanchery”, “Kozhikode”, “Vatakara”, “Koyilandy”, “Ramanattukara”, “Feroke”, “Koduvally”, “Payyoli”, “Mukkam”, “Kalpetta”, “Mananthavady”, “Sulthan Bathery”, “Kannur”, “Thalassery”, “Taliparamba”, “Payyanur”, “Mattannur”, “Koothuparamba”, “Anthoor”, “Iritty”, “Panoor”, “Sreekandapuram”, “Kasaragod”, “Kanhangad”, “Nileshwaram”
];
const uniq = arr => [...new Set(arr)];
function offlineCities(q) {
  if (!q) return [];
  const s = q.trim().toLowerCase();
  const starts = CITY_LIST.filter(c => c.toLowerCase().startsWith(s));
  const contains = CITY_LIST.filter(c => !starts.includes(c) && c.toLowerCase().includes(s));
  return [...starts, ...contains];
}
async function onlineCities(q, { countryOnly = "in", limit = 8 } = {}) {
  if (!q || q.trim().length < 2) return [];
  const params = new URLSearchParams({
    q: q.trim(),
    format: "json",
    addressdetails: "1",
    limit: String(limit)
  });
  if (countryOnly) params.set("countrycodes", countryOnly);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(item => {
      const a = item.address || {};
      const name = a.city || a.town || a.village || a.hamlet || a.suburb || item.display_name;
      return (name || "").toString()
        .split(" ")
        .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");
    }).filter(Boolean);
  } catch { return []; }
}
function setupCitySearch() {
  const input = els.locality, box = els.cityBox;
  if (!input || !box) return;
  let idx = -1, items = [], inflight = 0, netTimer;
  function render(list) {
    box.innerHTML = list.map((name, i) =>
      `<div class="item${i===idx?' active':''}" data-name="${name}">${name}</div>`).join("");
    box.style.display = list.length ? "block" : "none";
    items = Array.from(box.querySelectorAll(".item"));
    items.forEach(el => el.onclick = () => select(el.getAttribute("data-name")));
  }
  function select(name){ input.value = name; box.style.display="none"; idx=-1; }
  input.addEventListener("input", ()=>{
    const q = input.value || ""; idx=-1;
    if (!q.trim()){ box.style.display="none"; items=[]; return; }
    // offline instant
    render(offlineCities(q).slice(0,8));
    // async online
    clearTimeout(netTimer);
    netTimer = setTimeout(async ()=>{
      const ticket = ++inflight;
      const on = await onlineCities(q, { countryOnly:"in", limit:8 });
      if (ticket !== inflight) return;
      render(uniq([...(offlineCities(q)), ...on]).slice(0,8));
    },200);
  });
  input.addEventListener("keydown", (e)=>{
    if (box.style.display !== "block" || items.length === 0) return;
    const names = items.map(i=>i.getAttribute("data-name"));
    if (e.key==="ArrowDown"){ idx=Math.min(idx+1, names.length-1); render(names); e.preventDefault(); }
    else if (e.key==="ArrowUp"){ idx=Math.max(idx-1,0); render(names); e.preventDefault(); }
    else if (e.key==="Enter"){ if (idx>=0 && items[idx]){ select(items[idx].getAttribute("data-name")); e.preventDefault(); } }
    else if (e.key==="Escape"){ box.style.display="none"; idx=-1; }
  });
  input.addEventListener("blur", ()=>setTimeout(()=>box.style.display="none",150));
  input.addEventListener("focus", ()=>{
    const q = input.value || "";
    const off = offlineCities(q).slice(0,8);
    if (off.length) render(off);
  });
}

// ====== VEHICLE ROW UI ======
function makeVehicleRow() {
  const row = document.createElement("div");
  row.className = "vehicles-row";
  row.innerHTML = `
    <div><label>Vehicle Type</label>
      <select class="v-type">
        <option value="car">Car</option><option value="bike">Bike</option>
        <option value="bus">Bus</option><option value="metro">Metro</option>
        <option value="auto">Auto</option><option value="ev">EV</option>
      </select>
    </div>
    <div><label>Fuel</label>
      <select class="v-fuel">
        <option value="petrol">Petrol</option><option value="diesel">Diesel</option><option value="electric">Electric</option>
      </select>
    </div>
    <div><label class="v-km-label">Km/day</label>
      <input class="v-km" type="number" min="0" step="0.1" placeholder="e.g., 10" />
    </div>
    <div><label class="v-fuel-amt-label">Fuel/month (L)</label>
      <input class="v-fuel-amt" type="number" min="0" step="0.1" placeholder="e.g., 15" />
    </div>
    <div><button type="button" class="v-remove" title="Remove">×</button></div>
  `;
  const fuelSel = row.querySelector(".v-fuel");
  const km = row.querySelector(".v-km");
  const fuelAmt = row.querySelector(".v-fuel-amt");
  const fuelAmtLabel = row.querySelector(".v-fuel-amt-label");
  km.addEventListener("input", ()=>{ if (parseFloat(km.value||0)>0) fuelAmt.value=""; });
  fuelAmt.addEventListener("input", ()=>{ if (parseFloat(fuelAmt.value||0)>0) km.value=""; });
  function applyFuelUI(){
    const f=fuelSel.value;
    if (f==="electric"){ fuelAmtLabel.textContent="Energy/month (kWh)"; fuelAmt.placeholder="e.g., 40"; }
    else { fuelAmtLabel.textContent="Fuel/month (L)"; fuelAmt.placeholder="e.g., 15"; }
  }
  fuelSel.addEventListener("change", applyFuelUI); applyFuelUI();
  row.querySelector(".v-remove").onclick = ()=>row.remove();
  return row;
}
function getVehiclesPayload() {
  const rows = els.vehiclesWrap.querySelectorAll(".vehicles-row");
  const vehicles=[];
  rows.forEach(r=>{
    const type=r.querySelector(".v-type").value;
    const fuelType=r.querySelector(".v-fuel").value;
    const distancePerDay=parseFloat(r.querySelector(".v-km").value||0);
    const fuelAmountPerMonth=parseFloat(r.querySelector(".v-fuel-amt").value||0);
    if (distancePerDay||fuelAmountPerMonth) vehicles.push({type,fuelType,distancePerDay,fuelAmountPerMonth});
  });
  return vehicles;
}
if (els.addVehicleBtn && els.vehiclesWrap) {
  els.addVehicleBtn.onclick=()=>els.vehiclesWrap.appendChild(makeVehicleRow());
  els.vehiclesWrap.appendChild(makeVehicleRow());
}

// ====== NOTIFY ======
function notify(title, body) {
  if (!els.notice) return;
  els.notice.style.display="block"; els.notice.textContent=`${title}: ${body}`;
  if (!els.enableNotify?.checked) return;
  if (!("Notification" in window)) return;
  if (Notification.permission==="granted") new Notification(title,{body});
  else if (Notification.permission!=="denied"){
    Notification.requestPermission().then(p=>{ if(p==="granted") new Notification(title,{body}); });
  }
}

// ====== CHART ======
function drawChart(commute, electricity, lpg, fuel) {
  const ctx=document.getElementById("myChart");
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  chartInstance=new Chart(ctx,{ type:"pie", data:{ labels:["Commute","Electricity","LPG","Vehicle Energy/Fuel"], datasets:[{data:[commute,electricity,lpg,fuel]}] } });
}

// ====== REWARDS & LEADERBOARD ======
async function loadRewards(){/* ... same as before ... */}
async function loadLeaderboard(locality){/* ... same as before ... */}
els.submitScoreBtn?.addEventListener("click", async ()=>{/* ... same as before ... */});

// ====== FORM SUBMIT ======
document.getElementById("carbonForm")?.addEventListener("submit", async (e)=>{/* ... same as before ... */});

// ====== INIT ======
setupCitySearch();
loadRewards();
loadLeaderboard("Global");
