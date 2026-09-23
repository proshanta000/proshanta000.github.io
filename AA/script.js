const KEY="financeTracker_v1";
const defaultCategories={income:["Salary","Freelance","Business","Other Income"],expense:["Food","Transport","Rent","Shopping","Bills","Mobile/Internet","Medical","Education","Other"],other:["Other Cost"]};
let state={transactions:[],openingBalance:0,categories:JSON.parse(JSON.stringify(defaultCategories)),theme:"light"};
let selectedMonth="";

const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("en-BD",{style:"currency",currency:"BDT",minimumFractionDigits:2}).format(Number(n)||0);
const todayISO=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const monthISO=()=>todayISO().slice(0,7);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
function save(){localStorage.setItem(KEY,JSON.stringify(state));$("saveStatus").textContent="✓ Saved locally";renderAll()}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||"null");if(x){state={...state,...x,categories:{...defaultCategories,...(x.categories||{})}}}}catch(e){console.error(e)}}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove("show"),2200)}
function totals(list=state.transactions){return list.reduce((a,t)=>{const v=Number(t.amount)||0;if(t.type==="income")a.income+=v;else if(t.type==="expense")a.expense+=v;else a.other+=v;return a},{income:0,expense:0,other:0})}
function net(t){return t.income-t.expense-t.other}
function txForMonth(m){return state.transactions.filter(t=>t.date.startsWith(m))}
function fillCategories(){const type=$("type").value;const cats=state.categories[type]||[];$("category").innerHTML=cats.map(c=>`<option>${esc(c)}</option>`).join("");const all=[...new Set(Object.values(state.categories).flat())].sort();$("categoryFilter").innerHTML='<option value="">All Categories</option>'+all.map(c=>`<option>${esc(c)}</option>`).join("")}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderDashboard(){
 const t=totals(), mt=totals(txForMonth(monthISO())); $("totalIncome").textContent=money(t.income);$("totalExpense").textContent=money(t.expense);$("totalOther").textContent=money(t.other);$("currentBalance").textContent=money(Number(state.openingBalance)+net(t));$("monthIncome").textContent=money(mt.income);$("monthExpense").textContent=money(mt.expense);$("monthBalance").textContent=money(net(mt));$("transactionCount").textContent=state.transactions.length;
 $("openingBalance").value=state.openingBalance||"";
 const td=totals(state.transactions.filter(t=>t.date===todayISO())); const now=new Date(); const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-6);const wd=totals(state.transactions.filter(t=>new Date(t.date+"T00:00:00")>=start));$("todayNet").textContent=money(net(td));$("weekNet").textContent=money(net(wd));
 $("quickSummary").textContent=state.transactions.length?`${state.transactions.length} transaction${state.transactions.length===1?"":"s"} recorded. Current balance includes opening balance.`:"No transactions yet. Add your first transaction below.";
}
function renderTransactions(){
 let list=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
 const q=$("searchFilter").value.trim().toLowerCase(), sd=$("startDate").value, ed=$("endDate").value, ty=$("typeFilter").value, cat=$("categoryFilter").value;
 list=list.filter(t=>(!q||`${t.description} ${t.category}`.toLowerCase().includes(q))&&(!sd||t.date>=sd)&&(!ed||t.date<=ed)&&(!ty||t.type===ty)&&(!cat||t.category===cat));
 const ft=totals(list);$("filteredIncome").textContent=money(ft.income);$("filteredExpense").textContent=money(ft.expense);$("filteredOther").textContent=money(ft.other);$("filteredNet").textContent=money(net(ft));
 $("transactionBody").innerHTML=list.map(t=>`<tr><td>${t.date}</td><td><span class="badge badge-${t.type}">${labelType(t.type)}</span></td><td>${esc(t.category)}</td><td>${esc(t.description||"—")}</td><td class="amount-${t.type}">${t.type==="income"?"+":"−"}${money(t.amount)}</td><td><div class="row-actions"><button class="small-btn" onclick="editTx('${t.id}')">Edit</button><button class="small-btn" onclick="deleteTx('${t.id}')">Delete</button></div></td></tr>`).join("");
 $("emptyTransactions").classList.toggle("hidden",list.length!==0);
}
function labelType(t){return t==="income"?"Income":t==="expense"?"Expense":"Other Cost"}
function renderMonthly(){
 const m=$("monthPicker").value||monthISO();selectedMonth=m;$("monthPicker").value=m;
 const t=totals(txForMonth(m));$("selectedIncome").textContent=money(t.income);$("selectedExpense").textContent=money(t.expense);$("selectedOther").textContent=money(t.other);$("selectedNet").textContent=money(net(t));
 const year=m.slice(0,4);$("yearLabel").textContent=year;
 $("yearBody").innerHTML=Array.from({length:12},(_,i)=>{const mm=`${year}-${String(i+1).padStart(2,"0")}`,x=totals(txForMonth(mm));return `<tr><td>${new Date(year,i,1).toLocaleString("en",{month:"long"})}</td><td class="amount-income">${money(x.income)}</td><td class="amount-expense">${money(x.expense+x.other)}</td><td class="${net(x)>=0?"amount-income":"amount-expense"}">${money(net(x))}</td></tr>`}).join("");
 drawMonthlyChart();drawCategoryChart();
}
function drawCanvas(id){const c=$(id),ctx=c.getContext("2d"),r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=r.width*d;c.height=r.height*d;ctx.scale(d,d);return {c,ctx,w:r.width,h:r.height}}
function drawMonthlyChart(){
 const {ctx,w,h}=drawCanvas("monthlyChart"),year=selectedMonth.slice(0,4);const vals=Array.from({length:12},(_,i)=>totals(txForMonth(`${year}-${String(i+1).padStart(2,"0")}`)));const max=Math.max(1,...vals.flatMap(x=>[x.income,x.expense+x.other]));ctx.clearRect(0,0,w,h);const pad={l:42,r:12,t:20,b:32},cw=(w-pad.l-pad.r)/12,base=h-pad.b;ctx.strokeStyle=getComputedStyle(document.body).color+"22";ctx.lineWidth=1;for(let i=0;i<5;i++){const y=pad.t+(base-pad.t)*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke()}vals.forEach((v,i)=>{const x=pad.l+i*cw+cw*.18;const bh=(v.income/max)*(base-pad.t);const eh=((v.expense+v.other)/max)*(base-pad.t);ctx.fillStyle="#15966a";ctx.fillRect(x,base-bh,cw*.25,bh);ctx.fillStyle="#dc4651";ctx.fillRect(x+cw*.3,base-eh,cw*.25,eh);ctx.fillStyle=getComputedStyle(document.body).color;ctx.font="10px sans-serif";ctx.textAlign="center";ctx.fillText(new Date(year,i,1).toLocaleString("en",{month:"short"}),x+cw*.27,base+17)});ctx.textAlign="left";ctx.font="11px sans-serif";ctx.fillStyle="#15966a";ctx.fillText("Income",pad.l,11);ctx.fillStyle="#dc4651";ctx.fillText("Expenses",pad.l+58,11)
}
function drawCategoryChart(){
 const {ctx,w,h}=drawCanvas("categoryChart"),t=totals(txForMonth(selectedMonth));const map={};txForMonth(selectedMonth).filter(x=>x.type==="expense").forEach(x=>map[x.category]=(map[x.category]||0)+Number(x.amount));const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);ctx.clearRect(0,0,w,h);if(!arr.length){ctx.fillStyle="#718096";ctx.font="14px sans-serif";ctx.textAlign="center";ctx.fillText("No expenses for this month.",w/2,h/2);return}const max=Math.max(...arr.map(x=>x[1]));arr.forEach(([name,v],i)=>{const y=20+i*28;ctx.fillStyle="#6d7fe0";ctx.fillRect(120,y,Math.max(3,(w-150)*v/max),15);ctx.fillStyle=getComputedStyle(document.body).color;ctx.font="11px sans-serif";ctx.textAlign="right";ctx.fillText(name.slice(0,18),113,y+12);ctx.textAlign="left";ctx.fillText(money(v),125+Math.max(3,(w-150)*v/max),y+12)})}
function renderReports(){
 const now=new Date(),start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-6);const wt=totals(state.transactions.filter(t=>new Date(t.date+"T00:00:00")>=start));$("weekReport").innerHTML=`<div class="report-row"><span>Income</span><b class="amount-income">${money(wt.income)}</b></div><div class="report-row"><span>Expenses</span><b class="amount-expense">${money(wt.expense)}</b></div><div class="report-row"><span>Other Costs</span><b class="amount-other">${money(wt.other)}</b></div><div class="report-row"><span>Net</span><b>${money(net(wt))}</b></div>`;
 const map={};state.transactions.filter(t=>t.type==="expense").forEach(t=>map[t.category]=(map[t.category]||0)+Number(t.amount));const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,7);$("topCategories").innerHTML=arr.length?arr.map(x=>`<div class="report-row"><span>${esc(x[0])}</span><b>${money(x[1])}</b></div>`).join(""):"<div class='empty-state'>No expense data yet.</div>";
}
function renderCategories(){const types=[["income","Income"],["expense","Expense"],["other","Other Cost"]];$("categoryList").innerHTML=types.flatMap(([type,label])=>(state.categories[type]||[]).map((c,i)=>`<span class="category-chip">${label}: ${esc(c)} <button onclick="removeCategory('${type}',${i})" title="Remove">×</button></span>`)).join("")}
function renderAll(){renderDashboard();renderTransactions();renderMonthly();renderReports();renderCategories()}
function resetForm(){ $("transactionForm").reset();$("date").value=todayISO();$("type").value="income";fillCategories();$("editId").value="";$("formTitle").textContent="Add Transaction";$("submitBtn").textContent="Add Transaction";$("cancelEdit").classList.add("hidden")}
function editTx(id){const t=state.transactions.find(x=>x.id===id);if(!t)return;$("editId").value=t.id;$("date").value=t.date;$("type").value=t.type;fillCategories();$("category").value=t.category;$("description").value=t.description||"";$("amount").value=t.amount;$("formTitle").textContent="Edit Transaction";$("submitBtn").textContent="Save Changes";$("cancelEdit").classList.remove("hidden");showSection("dashboard");$("addPanel").scrollIntoView({behavior:"smooth",block:"start"})}
function deleteTx(id){const t=state.transactions.find(x=>x.id===id);if(!t)return;if(confirm(`Delete this transaction of ${money(t.amount)}?`)){state.transactions=state.transactions.filter(x=>x.id!==id);save();toast("Transaction deleted.")}}
function removeCategory(type,i){const c=state.categories[type][i];if(confirm(`Remove category "${c}"? Existing transactions will not be changed.`)){state.categories[type].splice(i,1);save();fillCategories();toast("Category removed.")}}
function showSection(id){document.querySelectorAll(".page-section").forEach(x=>x.classList.toggle("active",x.id===id));document.querySelectorAll(".nav-btn").forEach(x=>x.classList.toggle("active",x.dataset.section===id));if(id==="monthly")renderMonthly()}
function download(name,data,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function exportJSON(){download(`finance-backup-${todayISO()}.json`,JSON.stringify(state,null,2),"application/json");toast("JSON backup exported.")}
function exportCSV(){const rows=[["Date","Type","Category","Description","Amount"],...state.transactions.map(t=>[t.date,t.type,t.category,t.description||"",t.amount])];const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");download(`finance-transactions-${todayISO()}.csv`,csv,"text/csv;charset=utf-8");toast("CSV exported.")}
function printReport(){showSection("monthly");window.print()}
function init(){
 load(); $("date").value=todayISO();$("monthPicker").value=monthISO();$("openingBalance").value=state.openingBalance||"";if(state.theme==="dark")document.body.classList.add("dark");fillCategories();renderAll();
 document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>showSection(b.dataset.section)));
 document.querySelectorAll("[data-scroll-add]").forEach(b=>b.addEventListener("click",()=>{$("addPanel").scrollIntoView({behavior:"smooth"})}));
 $("type").addEventListener("change",fillCategories);
 $("transactionForm").addEventListener("submit",e=>{e.preventDefault();const id=$("editId").value,t={id:id||uid(),date:$("date").value,type:$("type").value,category:$("category").value,description:$("description").value.trim(),amount:Number($("amount").value),createdAt:Date.now()};if(!t.date||!t.category||!t.amount||t.amount<=0){toast("Please enter a valid date, category and amount.");return}if(id){const old=state.transactions.find(x=>x.id===id);t.createdAt=old.createdAt;state.transactions=state.transactions.map(x=>x.id===id?t:x);toast("Transaction updated.")}else{state.transactions.push(t);toast("Transaction added.")}save();resetForm()});
 $("cancelEdit").addEventListener("click",resetForm);
 $("saveOpening").addEventListener("click",()=>{const n=Number($("openingBalance").value);if(n<0||Number.isNaN(n)){toast("Opening balance cannot be negative.");return}state.openingBalance=n;save();toast("Opening balance saved.")});
 ["searchFilter","startDate","endDate","typeFilter","categoryFilter"].forEach(id=>$(id).addEventListener("input",renderTransactions));
 $("clearFilters").addEventListener("click",()=>{["searchFilter","startDate","endDate"].forEach(id=>$(id).value="");$("typeFilter").value="";$("categoryFilter").value="";renderTransactions()});
 $("monthPicker").addEventListener("change",renderMonthly);
 $("prevMonth").addEventListener("click",()=>changeMonth(-1));$("nextMonth").addEventListener("click",()=>changeMonth(1));
 $("exportJson").addEventListener("click",exportJSON);$("exportCsv").addEventListener("click",exportCSV);
 $("importJson").addEventListener("change",importJSON);
 $("clearAll").addEventListener("click",()=>{if(confirm("Delete ALL transactions, balance and custom categories? This cannot be undone unless you have a backup.")){localStorage.removeItem(KEY);state={transactions:[],openingBalance:0,categories:JSON.parse(JSON.stringify(defaultCategories)),theme:state.theme};resetForm();save();toast("All data cleared.")}});
 $("categoryForm").addEventListener("submit",e=>{e.preventDefault();const c=$("newCategory").value.trim(),ty=$("newCategoryType").value;if(!c)return;if(!state.categories[ty].includes(c))state.categories[ty].push(c);$("newCategory").value="";save();fillCategories();toast("Category added.")});
 $("themeToggle").addEventListener("click",()=>{state.theme=state.theme==="dark"?"light":"dark";document.body.classList.toggle("dark",state.theme==="dark");save()});
 $("printReport").addEventListener("click",printReport);
 window.addEventListener("resize",()=>{if($("monthly").classList.contains("active")){drawMonthlyChart();drawCategoryChart()}});
}
function changeMonth(delta){const d=new Date(($("monthPicker").value||monthISO())+"-01T00:00:00");d.setMonth(d.getMonth()+delta);$("monthPicker").value=d.toISOString().slice(0,7);renderMonthly()}
function importJSON(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!Array.isArray(x.transactions)||typeof x.openingBalance!=="number"||!x.categories)throw Error("Invalid backup");if(!confirm("Import this backup and replace the current data?"))return;state={...state,transactions:x.transactions,openingBalance:x.openingBalance,categories:{...defaultCategories,...x.categories}};save();fillCategories();toast("Backup restored successfully.")}catch(err){toast("Invalid backup file.")}e.target.value=""};r.readAsText(file)}
window.editTx=editTx;window.deleteTx=deleteTx;window.removeCategory=removeCategory;init();
