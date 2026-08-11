
const STORAGE_KEY='juntaTreasury_v1';
const money = n => new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP'}).format(Number(n||0));
const dateText = s => s ? new Date(s+'T12:00:00').toLocaleDateString('es-DO',{year:'numeric',month:'short',day:'numeric'}) : '';
const uid = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

const seed = {
  meta:{organization:'Junta de Vecinos',treasurer:'Hector Medina',created:'2026-08-10'},
  members:[
    'Apolinar Peralta','María Peralta','Joseph Decena','Felania Decena','Pedro García','Doña Grecia',
    'Sr. Otoniel Carvajal','Robert Tejeda','Porfirio Tejeda','Hector Medina','Alejandrina Pérez','Michel','Enrique Ramirez','Ramón Nova'
  ].map((name,i)=>({id:`m${i+1}`,name,phone:'',status:'active'})),
  activities:[{id:'a1',name:'Ayuntamiento – Juramentación',date:'2026-08-03',description:'Juramentación ante el Ayuntamiento'}],
  movements:[
    ['Apolinar Peralta',200],['María Peralta',200],['Joseph Decena',200],['Felania Decena',200],['Pedro García',200],
    ['Doña Grecia',200],['Sr. Otoniel Carvajal',200],['Robert Tejeda',200],['Porfirio Tejeda',200],['Hector Medina',100],
    ['Alejandrina Pérez',200],['Michel',200],['Enrique Ramirez',500],['Ramón Nova',150]
  ].map((x,i)=>({id:`t${i+1}`,type:'income',date:'2026-08-10',person:x[0],amount:x[1],concept:'Aporte al fondo de la Junta',activityId:'',method:'Efectivo',notes:'',status:'active',createdAt:new Date().toISOString()}))
  .concat([
    {id:'t20',type:'expense',date:'2026-08-03',person:'Junta de Vecinos',amount:850,concept:'Manual de obligaciones y funciones',activityId:'a1',method:'Efectivo',notes:'',status:'active',createdAt:new Date().toISOString()},
    {id:'t21',type:'expense',date:'2026-08-03',person:'Junta de Vecinos',amount:500,concept:'Formularios de certificación',activityId:'a1',method:'Efectivo',notes:'',status:'active',createdAt:new Date().toISOString()},
    {id:'t22',type:'sponsored',date:'2026-08-03',person:'Dra. Jenny Kranwinkel',amount:500,concept:'Papel timbrado',activityId:'a1',method:'Pago directo',notes:'Costo asumido directamente; no entra ni sale del fondo.',status:'active',createdAt:new Date().toISOString()},
    {id:'t23',type:'sponsored',date:'2026-08-03',person:'Dra. Jenny Kranwinkel',amount:1600,concept:'Sello de la Junta',activityId:'a1',method:'Pago directo',notes:'Costo asumido directamente; no entra ni sale del fondo.',status:'active',createdAt:new Date().toISOString()}
  ]),
  audit:[]
};
let db = load();
function load(){ try {return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(seed)} catch(e){return structuredClone(seed)}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(db)); renderAll()}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function movementLabel(t){return t==='income'?'Ingreso':t==='expense'?'Gasto':'Aporte directo'}
function totals(list=db.movements.filter(x=>x.status==='active')){
  return list.reduce((a,m)=>{if(m.type==='income')a.income+=+m.amount;if(m.type==='expense')a.expense+=+m.amount;if(m.type==='sponsored')a.sponsored+=+m.amount;return a},{income:0,expense:0,sponsored:0});
}
function setView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===id));
  if(id==='reports') renderReport();
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelectorAll('[data-view-jump]').forEach(b=>b.onclick=()=>setView(b.dataset.viewJump));

function renderDashboard(){
  const t=totals();
  balanceCard.textContent=money(t.income-t.expense); incomeCard.textContent=money(t.income); expenseCard.textContent=money(t.expense); sponsoredCard.textContent=money(t.sponsored);
  const items=db.movements.filter(x=>x.status==='active').sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).slice(0,6);
  lastCount.textContent=`${items.length} mostrados`; latestMovements.innerHTML=items.length?items.map(m=>movementItem(m,false)).join(''):'<div class="empty">Sin movimientos</div>';
}
function movementItem(m,actions=true){
  const activity=db.activities.find(a=>a.id===m.activityId);
  const cls=m.type, sign=m.type==='expense'?'-':m.type==='income'?'+':'';
  return `<div class="item"><div class="item-main"><div class="item-title">${esc(m.concept)}</div><div class="item-sub">${esc(m.person)} · ${dateText(m.date)}${activity?' · '+esc(activity.name):''}</div><span class="badge">${movementLabel(m.type)}${m.status==='void'?' · ANULADO':''}</span></div><div><div class="amount ${cls}">${sign}${money(m.amount)}</div>${actions&&m.status==='active'?`<button class="ghost" onclick="showMovement('${m.id}')">Ver</button>`:''}</div></div>`;
}
function renderMovements(){
  const type=movementTypeFilter.value, q=movementSearch.value.trim().toLowerCase();
  const list=db.movements.filter(m=>(!type||m.type===type)&&(!q||`${m.person} ${m.concept}`.toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
  movementList.innerHTML=list.length?list.map(m=>movementItem(m,true)).join(''):'<div class="empty">No hay resultados</div>';
}
movementTypeFilter.onchange=renderMovements; movementSearch.oninput=renderMovements;

function renderMembers(){
  memberList.innerHTML=db.members.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(m=>{
    const contrib=db.movements.filter(x=>x.status==='active'&&x.type==='income'&&x.person===m.name).reduce((s,x)=>s+x.amount,0);
    return `<div class="item"><div><div class="item-title">${esc(m.name)}</div><div class="item-sub">${m.status==='active'?'Activo':'Inactivo'}${m.phone?' · '+esc(m.phone):''}</div></div><div><div class="amount income">${money(contrib)}</div><button class="ghost" onclick="editMember('${m.id}')">Editar</button></div></div>`
  }).join('');
}
function renderActivities(){
  activityList.innerHTML=db.activities.length?db.activities.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(a=>{
    const ms=db.movements.filter(m=>m.status==='active'&&m.activityId===a.id), t=totals(ms);
    return `<div class="item"><div><div class="item-title">${esc(a.name)}</div><div class="item-sub">${dateText(a.date)} · ${esc(a.description||'')}</div><span class="badge">Fondo: ${money(t.expense)} · Directo: ${money(t.sponsored)}</span></div><button class="ghost" onclick="editActivity('${a.id}')">Editar</button></div>`
  }).join(''):'<div class="empty">No hay actividades</div>';
}
function fillActivitySelect(){
  movementActivity.innerHTML='<option value="">Sin actividad</option>'+db.activities.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
}
function renderAll(){fillActivitySelect();renderDashboard();renderMovements();renderMembers();renderActivities();}

function openMovement(type='income'){
  movementForm.reset();movementId.value='';movementDate.value=new Date().toISOString().slice(0,10);movementType.value=type;movementDialogTitle.textContent='Nuevo movimiento';movementDialog.showModal()
}
newMovementBtn.onclick=()=>openMovement();document.querySelectorAll('[data-open-movement]').forEach(b=>b.onclick=()=>openMovement(b.dataset.openMovement));
saveMovementBtn.onclick=e=>{
  e.preventDefault();
  if(!movementForm.reportValidity())return;
  const data={id:movementId.value||uid('t'),type:movementType.value,date:movementDate.value,person:movementPerson.value.trim(),amount:+movementAmount.value,concept:movementConcept.value.trim(),activityId:movementActivity.value,method:movementMethod.value,notes:movementNotes.value.trim(),status:'active',createdAt:new Date().toISOString()};
  if(movementId.value){const i=db.movements.findIndex(x=>x.id===movementId.value);db.movements[i]=data}else db.movements.push(data);
  db.audit.push({id:uid('audit'),at:new Date().toISOString(),action:movementId.value?'edit':'create',entity:'movement',entityId:data.id,snapshot:data});
  save();movementDialog.close();toast('Movimiento guardado');
}
window.showMovement=id=>{
  const m=db.movements.find(x=>x.id===id); if(!m)return;
  detailBody.innerHTML=`<p><strong>${esc(m.concept)}</strong></p><p>${esc(m.person)} · ${dateText(m.date)}</p><p class="amount ${m.type}">${money(m.amount)}</p><p>${esc(m.method)}</p><p class="muted">${esc(m.notes||'Sin observaciones')}</p>${m.status==='active'?`<div class="quick-actions"><button class="secondary" onclick="editMovement('${m.id}')">Editar</button><button class="danger-soft" onclick="voidMovement('${m.id}')">Anular</button></div>`:''}`;detailDialog.showModal()
}
closeDetailBtn.onclick=()=>detailDialog.close();
window.editMovement=id=>{
  const m=db.movements.find(x=>x.id===id);detailDialog.close();movementId.value=m.id;movementType.value=m.type;movementDate.value=m.date;movementPerson.value=m.person;movementAmount.value=m.amount;movementConcept.value=m.concept;movementActivity.value=m.activityId||'';movementMethod.value=m.method;movementNotes.value=m.notes||'';movementDialogTitle.textContent='Editar movimiento';movementDialog.showModal();
}
window.voidMovement=id=>{
  if(!confirm('¿Anular este movimiento? No se borrará; quedará en el historial.'))return;
  const m=db.movements.find(x=>x.id===id);m.status='void';m.voidedAt=new Date().toISOString();db.audit.push({id:uid('audit'),at:new Date().toISOString(),action:'void',entity:'movement',entityId:id,snapshot:m});save();detailDialog.close();toast('Movimiento anulado');
}

newMemberBtn.onclick=()=>{memberForm.reset();memberId.value='';memberStatus.value='active';memberDialog.showModal()}
window.editMember=id=>{const m=db.members.find(x=>x.id===id);memberId.value=m.id;memberName.value=m.name;memberPhone.value=m.phone||'';memberStatus.value=m.status;memberDialog.showModal()}
saveMemberBtn.onclick=e=>{e.preventDefault();if(!memberForm.reportValidity())return;const d={id:memberId.value||uid('m'),name:memberName.value.trim(),phone:memberPhone.value.trim(),status:memberStatus.value};if(memberId.value){db.members[db.members.findIndex(x=>x.id===d.id)]=d}else db.members.push(d);save();memberDialog.close();toast('Miembro guardado')}

newActivityBtn.onclick=()=>{activityForm.reset();activityId.value='';activityDate.value=new Date().toISOString().slice(0,10);activityDialog.showModal()}
window.editActivity=id=>{const a=db.activities.find(x=>x.id===id);activityId.value=a.id;activityName.value=a.name;activityDate.value=a.date;activityDescription.value=a.description||'';activityDialog.showModal()}
saveActivityBtn.onclick=e=>{e.preventDefault();if(!activityForm.reportValidity())return;const d={id:activityId.value||uid('a'),name:activityName.value.trim(),date:activityDate.value,description:activityDescription.value.trim()};if(activityId.value){db.activities[db.activities.findIndex(x=>x.id===d.id)]=d}else db.activities.push(d);save();activityDialog.close();toast('Actividad guardada')}

function reportData(){
  const from=reportFrom.value||'0000-01-01',to=reportTo.value||'9999-12-31';
  return db.movements.filter(m=>m.status==='active'&&m.date>=from&&m.date<=to);
}
function renderReport(){
  const list=reportData(),t=totals(list),balance=t.income-t.expense;
  const incomes=list.filter(x=>x.type==='income');
  const sponsored=list.filter(x=>x.type==='sponsored');
  reportPreview.innerHTML=`<h3>Informe Financiero – ${esc(db.meta.organization)}</h3>
  <p>Período: ${reportFrom.value?dateText(reportFrom.value):'Todos los registros'} ${reportTo.value?'al '+dateText(reportTo.value):''}</p>
  <table><tr><th>Concepto</th><th>Monto</th></tr><tr><td>Ingresos al fondo</td><td>${money(t.income)}</td></tr><tr><td>Gastos del fondo</td><td>${money(t.expense)}</td></tr><tr><td>Aportes directos / patrocinados</td><td>${money(t.sponsored)}</td></tr><tr><th>Balance del fondo</th><th>${money(balance)}</th></tr></table>
  <h4>Aportes recibidos</h4><table>${incomes.map(x=>`<tr><td>${esc(x.person)}</td><td>${money(x.amount)}</td></tr>`).join('')||'<tr><td colspan="2">Sin aportes en el período</td></tr>'}</table>
  ${sponsored.length?`<h4>Aportes directos</h4><table>${sponsored.map(x=>`<tr><td>${esc(x.person)} – ${esc(x.concept)}</td><td>${money(x.amount)}</td></tr>`).join('')}</table>`:''}
  <p class="muted">Generado desde Tesorería de la Junta. Los aportes directos no se suman al balance del fondo porque no entran a caja.</p>`;
}
refreshReportBtn.onclick=renderReport;reportFrom.onchange=renderReport;reportTo.onchange=renderReport;
printReportBtn.onclick=()=>window.print();
copyReportBtn.onclick=async()=>{
  const t=totals(reportData()), balance=t.income-t.expense;
  const text=`📋 INFORME FINANCIERO – ${db.meta.organization}\n\n💰 Ingresos al fondo: ${money(t.income)}\n📤 Gastos del fondo: ${money(t.expense)}\n🤝 Aportes directos: ${money(t.sponsored)}\n\n✅ Balance actual del fondo: ${money(balance)}\n\nLos aportes directos no se contabilizan como dinero que entra al fondo.`;
  await navigator.clipboard.writeText(text);toast('Informe copiado');
}
exportCsvBtn.onclick=()=>{
  const rows=[['Fecha','Tipo','Persona','Monto','Concepto','Método','Estado'],...db.movements.map(m=>[m.date,movementLabel(m.type),m.person,m.amount,m.concept,m.method,m.status])];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  downloadBlob(new Blob(["\ufeff"+csv],{type:'text/csv;charset=utf-8'}),'tesoreria_movimientos.csv');
}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
backupBtn.onclick=()=>downloadBlob(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),`respaldo_tesoreria_${new Date().toISOString().slice(0,10)}.json`);
restoreInput.onchange=async e=>{
  const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d.members||!d.movements)throw Error();db=d;save();toast('Respaldo restaurado')}catch{alert('El archivo no parece ser un respaldo válido.')}e.target.value='';
}
resetBtn.onclick=()=>{if(confirm('Esto reemplazará los datos actuales por los datos iniciales de ejemplo. ¿Continuar?')){db=structuredClone(seed);save();toast('Datos restablecidos')}}

let deferredPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.classList.remove('hidden')});
installBtn.onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.classList.add('hidden')};
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))}
renderAll();renderReport();
