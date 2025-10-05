// ====== CONFIG ======
const API_BASE = "http://localhost:5000"; // <-- replace with your Render backend URL

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

  cityBox: document.getElementById("citySuggestions"),
  calcBtn: document.getElementById("calcBtn"),
  form: document.getElementById("carbonForm"),
  resultsSection: document.getElementById("resultsSection"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText")
};
if (els.pointsVal) els.pointsVal.textContent = myPoints;

// ====== City Search (offline + online) ======
const CITY_LIST = [
  "Thiruvananthapuram","Neyyattinkara","Nedumangad","Attingal","Varkala",
  "Kollam","Paravur","Punalur","Karunagapally","Kottarakkara",
  "Pathanamthitta","Adoor","Pandalam","Thiruvalla","Alappuzha",
  "Chengannur","Cherthala","Kayamkulam","Mavelikara","Haripad",
  "Kottayam","Changanacherry","Pala","Vaikom","Ettumanoor",
  "Erattupetta","Thodupuzha","Kattappana","Kochi","Thrippunithura",
  "Thrikkakara","Kalamassery","Aluva","Perumbavoor","North Paravur",
  "Angamaly","Muvattupuzha","Kothamangalam","Maradu","Eloor",
  "Piravom","Koothattukulam","Thrissur","Irinjalakuda","Kunnamkulam",
  "Chalakkudy","Kodungallur","Guruvayur","Chavakkad","Wadakkanchery",
  "Palakkad","Ottappalam","Shornur","Mannarkkad","Chittur-Thathamangalam",
  "Pattambi","Cherpulassery","Malappuram","Manjeri","Perinthalmanna",
  "Tirur","Ponnani","Kottakkal","Nilambur","Kondotty",
  "Tanur","Parappanangadi","Tirurangadi","Valanchery","Kozhikode",
  "Vatakara","Koyilandy","Ramanattukara","Feroke","Koduvally",
  "Payyoli","Mukkam","Kalpetta","Mananthavady","Sulthan Bathery",
  "Kannur","Thalassery","Taliparamba","Payyanur","Mattannur",
  "Koothuparamba","Anthoor","Iritty","Panoor","Sreekandapuram",
  "Kasaragod","Kanhangad","Nileshwaram",
  "Mumbai","Delhi","Bengaluru","Kolkata","Chennai","Hyderabad","Pune",
  "Ahmedabad","Jaipur","Surat"
];
const uniq = arr => [...new Set(arr)];
function offlineCities(q){
  if (!q) return [];
  const s=q.trim().toLowerCase();
  const starts=CITY_LIST.filter(c=>c.toLowerCase().startsWith(s));
  const contains=CITY_LIST.filter(c=>!starts.includes(c)&&c.toLowerCase().includes(s));
  return [...starts,...contains];
}
async function onlineCities(q,{countryOnly="in",limit=8}={}){
  if (!q || q.trim().length<2) return [];
  const params=new URLSearchParams({q:q.trim(),format:"json",addressdetails:"1",limit:String(limit)});
  if (countryOnly) params.set("countrycodes",countryOnly);
  try{
    const res=await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`,{headers:{"Accept":"application/json"}});
    if (!res.ok) return [];
    const data=await res.json();
    return data.map(item=>{
      const a=item.address||{};
      const name=a.city||a.town||a.village||a.hamlet||a.suburb||item.display_name;
      return (name||"").split(" ").map(w=>w? w[0].toUpperCase()+w.slice(1):w).join(" ");
    }).filter(Boolean);
  }catch{return [];}
}
function setupCitySearch(){
  const input=els.locality, box=els.cityBox;
  if (!input || !box) return;
  let idx=-1, items=[], inflight=0, netTimer;
  function render(list){
    box.innerHTML=list.map((name,i)=>`<div class="item${i===idx?' active':''}" data-name="${name}">${name}</div>`).join("");
    box.style.display=list.length?"block":"none";
    items=Array.from(box.querySelectorAll(".item"));
    items.forEach(el=>el.onclick=()=>select(el.getAttribute("data-name")));
  }
  function select(name){ input.value=name; box.style.display="none"; idx=-1; }
  input.addEventListener("input", ()=>{
    const q=input.value||""; idx=-1;
    if (!q.trim()){ box.style.display="none"; items=[]; return; }
    render(offlineCities(q).slice(0,8));
    clearTimeout(netTimer);
    netTimer=setTimeout(async ()=>{
      const ticket=++inflight;
      const on=await onlineCities(q,{countryOnly:"in",limit:8});
      if (ticket!==inflight) return;
      render(uniq([...(offlineCities(q)),...on]).slice(0,8));
    },200);
  });
  input.addEventListener("keydown",(e)=>{
    if (box.style.display!=="block"||items.length===0) return;
    const names=items.map(i=>i.getAttribute("data-name"));
    if (e.key==="ArrowDown"){ idx=Math.min(idx+1, names.length-1); render(names); e.preventDefault(); }
    else if (e.key==="ArrowUp"){ idx=Math.max(idx-1,0); render(names); e.preventDefault(); }
    else if (e.key==="Enter"){ if (idx>=0&&items[idx]){ select(items[idx].getAttribute("data-name")); e.preventDefault(); } }
    else if (e.key==="Escape"){ box.style.display="none"; idx=-1; }
  });
  input.addEventListener("blur", ()=>setTimeout(()=>box.style.display="none",150));
  input.addEventListener("focus", ()=>{
    const q=input.value||"";
    const off=offlineCities(q).slice(0,8);
    if (off.length) render(off);
  });
}

// ====== Frontend factors (for live previews only) ======
const EF = {
  commute: { car:0.21, bus:0.10, bike:0.05, metro:0.07, auto:0.13, ev:0.12 }, // kg/km
  grid_kg_per_kwh: 0.82,
  petrol_kg_per_l: 2.31,
  diesel_kg_per_l: 2.68
};

// ====== Vehicle UI ======
function makeVehicleRow(){
  const row=document.createElement("div");
  row.className="vehicles-row";
  row.innerHTML=`
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
    <div><label>Km/day</label>
      <input class="v-km" type="number" min="0" step="0.1" placeholder="e.g., 10" />
    </div>
    <div><label class="v-fuel-amt-label">Fuel/month (L)</label>
      <input class="v-fuel-amt" type="number" min="0" step="0.1" placeholder="e.g., 15" />
      <div class="v-preview">—</div>
    </div>
    <div><button type="button" class="v-remove remove">Remove</button></div>
  `;
  const typeSel=row.querySelector(".v-type");
  const fuelSel=row.querySelector(".v-fuel");
  const km=row.querySelector(".v-km");
  const fuelAmt=row.querySelector(".v-fuel-amt");
  const fuelAmtLabel=row.querySelector(".v-fuel-amt-label");
  const preview=row.querySelector(".v-preview");

  function applyFuelUI(){
    const f=fuelSel.value;
    if (f==="electric"){ fuelAmtLabel.textContent="Energy/month (kWh)"; fuelAmt.placeholder="e.g., 40"; }
    else { fuelAmtLabel.textContent="Fuel/month (L)"; fuelAmt.placeholder="e.g., 15"; }
  }
  function format(n){ return isFinite(n)? (+n.toFixed(1)).toString() : "—"; }
  function updatePreview(){
    const type=typeSel.value;
    const fuel=fuelSel.value;
    const kmv=parseFloat(km.value||0);
    const fv=parseFloat(fuelAmt.value||0);
    let commute=0, energy=0;

    if (kmv>0){ const perKm=EF.commute[type] ?? EF.commute.car; commute = kmv * 30 * perKm; }
    if (fuel==="petrol" && fv>0) energy = fv * EF.petrol_kg_per_l;
    else if (fuel==="diesel" && fv>0) energy = fv * EF.diesel_kg_per_l;
    else if (fuel==="electric" && fv>0) energy = fv * EF.grid_kg_per_kwh;

    const total = commute + energy;
    const parts = [];
    if (commute>0) parts.push(`Commute ~ ${format(commute)} kg`);
    if (energy>0) parts.push(`${fuel==="electric"?"Energy":"Fuel"} ~ ${format(energy)} kg`);
    preview.textContent = parts.length? parts.join(" + ") + ` = ${format(total)} kg/mo` : "—";
  }

  fuelSel.addEventListener("change", ()=>{ applyFuelUI(); updatePreview(); });
  typeSel.addEventListener("change", updatePreview);
  km.addEventListener("input", updatePreview);
  fuelAmt.addEventListener("input", updatePreview);

  row.querySelector(".v-remove").onclick=()=>row.remove();
  applyFuelUI(); updatePreview();
  return row;
}
function getVehiclesPayload(){
  const rows=els.vehiclesWrap?.querySelectorAll(".vehicles-row")||[];
  const vehicles=[];
  rows.forEach(r=>{
    const type=r.querySelector(".v-type").value;
    const fuelType=r.querySelector(".v-fuel").value;
    const distancePerDay=parseFloat(r.querySelector(".v-km").value||0);
    const fuelAmountPerMonth=parseFloat(r.querySelector(".v-fuel-amt").value||0);
    if (distancePerDay || fuelAmountPerMonth) vehicles.push({ type, fuelType, distancePerDay, fuelAmountPerMonth });
  });
  return vehicles;
}

// ====== Notify ======
function notify(title, body){
  if (els.notice){
    els.notice.style.display="block";
    els.notice.textContent=`${title}: ${body}`;
  }
  if (!els.enableNotify?.checked) return;
  if (!("Notification" in window)) return;
  if (Notification.permission==="granted") new Notification(title,{body});
  else if (Notification.permission!=="denied"){
    Notification.requestPermission().then(p=>{ if (p==="granted") new Notification(title,{body}); });
  }
}

// ====== Chart (light-green palette) ======
function drawChart(commute, electricity, lpg, fuel){
  const ctx=document.getElementById("myChart");
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  chartInstance=new Chart(ctx,{
    type:"pie",
    data:{
      labels:["Commute","Electricity","LPG","Vehicle Energy/Fuel"],
      datasets:[{
        data:[commute,electricity,lpg,fuel],
        backgroundColor:[
          "rgba(34,197,94,.9)",   // leaf
          "rgba(99,200,150,.9)",  // moss
          "rgba(255,204,77,.9)",  // sun (LPG)
          "rgba(94,184,255,.9)"   // sky (energy/fuel)
        ],
        borderColor:["rgba(0,0,0,.1)"], borderWidth:1
      }]
    },
    options:{ plugins:{ legend:{ labels:{ color:"#0f2418" } } } }
  });
}

// ====== Rewards & Leaderboard ======
async function loadRewards(){
  try{
    const r=await fetch(`${API_BASE}/rewards`);
    const data=await r.json();
    if (!els.rewardsList) return;
    els.rewardsList.innerHTML=data.catalog.map(c=>`<li>${c.label} — <strong>${c.cost}</strong> pts <button data-reward="${c.id}" class="btn btn-ghost" style="padding:6px 10px">Redeem</button></li>`).join("");
    els.rewardsList.querySelectorAll("button").forEach(btn=>{
      btn.onclick=async ()=>{
        const name=els.name?.value||"Guest";
        const rewardId=btn.getAttribute("data-reward");
        const res=await fetch(`${API_BASE}/redeem`,{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ name, rewardId })});
        const out=await res.json();
        if (!out.ok) return alert(out.error||"Redeem failed");
        myPoints=out.remainingPoints;
        localStorage.setItem("myPoints", String(myPoints));
        if (els.pointsVal) els.pointsVal.textContent=myPoints;
        notify("Reward Redeemed", `You got: ${out.reward.label}`);
      };
    });
  }catch{}
}
async function loadLeaderboard(locality){
  if (!els.leaderLoc||!els.leaderList) return;
  els.leaderLoc.textContent=locality||"Global";
  try{
    const r=await fetch(`${API_BASE}/leaderboard?locality=${encodeURIComponent(locality||"Global")}`);
    const data=await r.json();
    els.leaderList.innerHTML=(data.top||[]).map(row=>`<li><strong>${row.name}</strong> — ${row.points} pts (Total: ${row.totalKg} kg)</li>`).join("")||"<li>No entries yet</li>";
  }catch{
    els.leaderList.innerHTML="<li>Leaderboard not available yet.</li>";
  }
}
function bindSubmitScore(){
  els.submitScoreBtn?.addEventListener("click", async ()=>{
    const name=els.name?.value||"Guest";
    const locality=els.locality?.value||"Global";
    const totalKg=Number(els.totalVal?.textContent)||0;
    try{
      const r=await fetch(`${API_BASE}/score`,{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ name, locality, totalKg })});
      const data=await r.json();
      if (!data.ok) return alert("Could not submit score.");
      myPoints=data.totalPoints;
      localStorage.setItem("myPoints", String(myPoints));
      if (els.pointsVal) els.pointsVal.textContent=myPoints;
      notify("Score Submitted", `+${data.pointsEarned} pts! Total: ${data.totalPoints}`);
      loadLeaderboard(locality);
    }catch{ alert("Leaderboard API not reachable."); }
  });
}

// ====== Form Submit ======
function bindFormSubmit(){
  els.form?.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const payload={
      bill: parseFloat(els.bill?.value||0),
      lpgCylinders: parseFloat(els.lpg?.value||0),
      vehicles: getVehiclesPayload()
    };

    try{
      const res=await fetch(`${API_BASE}/calculate`,{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(payload)});
      if (!res.ok) throw new Error("API error");
      const data=await res.json();

      const commute=+(data.parts.commuteVehiclesKg||0).toFixed(1);
      const electricity=+(data.parts.electricityKg||0).toFixed(1);
      const lpg=+(data.parts.lpgKg||0).toFixed(1);
      const fuel=+((data.parts.petrolVehiclesKg||0)+(data.parts.dieselVehiclesKg||0)+(data.parts.evEnergyKg||0)).toFixed(1);
      const total=+(data.totalKg||0).toFixed(1);

      els.commuteVal.textContent=commute;
      els.energyVal.textContent=electricity;
      els.lpgVal.textContent=lpg;
      els.fuelVal.textContent=fuel;
      els.totalVal.textContent=total;

      drawChart(commute, electricity, lpg, fuel);

      if (els.moneyElec) els.moneyElec.textContent=Math.round(data.money.electricity||0);
      if (els.moneyLpg) els.moneyLpg.textContent=Math.round(data.money.lpg||0);
      if (els.moneyPetrol) els.moneyPetrol.textContent=Math.round(data.money.petrol||0);
      if (els.moneyDiesel) els.moneyDiesel.textContent=Math.round(data.money.diesel||0);
      if (els.moneyTotal) els.moneyTotal.textContent=Math.round(data.money.total||0);

      els.tipsList.innerHTML=(data.tips||[]).map(t=>`<li>${t}</li>`).join("")||"<li>Great job!</li>";

      // Progress bar text & color
      const goal=170;
      if (els.progressBar && els.progressText){
        const pct=Math.max(0,Math.min(100,Math.round((total/goal)*100)));
        els.progressBar.style.width=pct+"%";
        if (total>goal){
          els.progressBar.style.background="linear-gradient(90deg,#ffcc4d,#ff6b81)";
          els.progressText.textContent=`Above goal by ${(total-goal).toFixed(1)} kg (${pct}% of goal)`;
        }else{
          els.progressBar.style.background="linear-gradient(90deg,#22c55e,#12b8a3)";
          els.progressText.textContent=`Good! ${(goal-total).toFixed(1)} kg under goal (${pct}% of goal)`;
        }
      }

      if (lastTotal && total<lastTotal){
        const saved=+(lastTotal-total).toFixed(1);
        notify("Progress",`You reduced ${saved} kg CO₂ vs last time!`);
      }
      lastTotal=total;
      localStorage.setItem("lastTotalKg", String(lastTotal));

      loadLeaderboard(els.locality?.value||"Global");
      els.resultsSection?.scrollIntoView({behavior:"smooth",block:"start"});
    }catch(err){
      alert("Backend not reachable. Check your API URL in script.js.");
      console.error(err);
    }
  });

  // Sticky Calculate triggers form submit
  els.calcBtn?.addEventListener("click", ()=>els.form?.requestSubmit());
}

// ====== App init ======
function initApp(){
  if (els.addVehicleBtn && els.vehiclesWrap){
    els.addVehicleBtn.addEventListener("click", ()=>els.vehiclesWrap.appendChild(makeVehicleRow()));
    if (!els.vehiclesWrap.querySelector(".vehicles-row")){
      els.vehiclesWrap.appendChild(makeVehicleRow());
    }
  }
  setupCitySearch();
  loadRewards();
  loadLeaderboard("Global");
  bindSubmitScore();
  bindFormSubmit();
}
if (document.readyState==="loading"){ document.addEventListener("DOMContentLoaded", initApp); }
else { initApp(); }
