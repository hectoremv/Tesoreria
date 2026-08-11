const DB_NAME='tesoreriaJuntaDB',DB_VERSION=3;let dbi,settings={},currentReceipt=null,privacy=false;const $=id=>document.getElementById(id),uid=p=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,nowDate=()=>new Date().toISOString().slice(0,10),ym=d=>(d||nowDate()).slice(0,7),money=n=>new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP'}).format(Number(n||0)),dateText=s=>s?new Date(s+'T12:00:00').toLocaleDateString('es-DO',{year:'numeric',month:'short',day:'numeric'}):'',esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function normName(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es-DO')}
function toast(m){const e=$('toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}function openDB(){return new Promise((r,j)=>{const q=indexedDB.open(DB_NAME,DB_VERSION);q.onupgradeneeded=()=>{const d=q.result;['settings','members','transactions','activities','dues','closures','audit'].forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'})})};q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})}function st(n,m='readonly'){return dbi.transaction(n,m).objectStore(n)}function all(n){return new Promise((r,j)=>{const q=st(n).getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})}function get(n,id){return new Promise((r,j)=>{const q=st(n).get(id);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})}function put(n,o){return new Promise((r,j)=>{const q=st(n,'readwrite').put(o);q.onsuccess=()=>r(o);q.onerror=()=>j(q.error)})}function del(n,id){return new Promise((r,j)=>{const q=st(n,'readwrite').delete(id);q.onsuccess=()=>r();q.onerror=()=>j(q.error)})}async function audit(action,entity,entityId,snapshot){await put('audit',{id:uid('audit'),at:new Date().toISOString(),action,entity,entityId,snapshot})}async function loadSettings(){settings=await get('settings','main')||{};$('orgLabel').textContent=settings.organization||'Junta de Vecinos'}async function saveSettings(o){settings={...settings,...o,id:'main'};await put('settings',settings);await loadSettings()}
async function migrateLegacy(){if(await get('settings','migration_v2'))return;const raw=localStorage.getItem('juntaTreasury_v1');if(raw){try{const l=JSON.parse(raw);if(!(await all('transactions')).length&&!(await all('members')).length){for(const m of l.members||[])await put('members',{id:m.id||uid('m'),name:m.name,phone:m.phone||'',status:m.status||'active'});for(const a of l.activities||[])await put('activities',{id:a.id||uid('a'),name:a.name,date:a.date,budget:0,description:a.description||''});for(const t of l.movements||[])await put('transactions',{...t,id:t.id||uid('t'),category:t.type==='income'?'Aporte':'Otro',receiptNo:'',receiptGenerated:false});if(l.meta)await saveSettings({organization:l.meta.organization||'Junta de Vecinos',treasurer:l.meta.treasurer||'',dueAmount:200});localStorage.removeItem('juntaTreasury_v1');toast('Datos anteriores migrados a IndexedDB')}}catch(e){}}await put('settings',{id:'migration_v2',done:true,at:new Date().toISOString()})}
function setView(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===id));if(id==='reports')renderReport();if(id==='dues')renderDues();window.scrollTo({top:0,behavior:'smooth'})}document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelectorAll('[data-view-jump]').forEach(b=>b.onclick=()=>setView(b.dataset.viewJump));async function activeTx(){return(await all('transactions')).filter(x=>x.status!=='void')}function totals(l){return l.reduce((a,m)=>{if(m.type==='income')a.income+=+m.amount;if(m.type==='expense')a.expense+=+m.amount;if(m.type==='sponsored')a.sponsored+=+m.amount;return a},{income:0,expense:0,sponsored:0})}function ml(t){return t==='income'?'Ingreso':t==='expense'?'Gasto':'Patrocinado'}function mi(m,a=true){const s=m.type==='expense'?'-':m.type==='income'?'+':'';return `<div class="item"><div><div class="item-title">${esc(m.concept)}</div><div class="item-sub">${esc(m.person)} · ${dateText(m.date)} · ${esc(m.category||'')}</div><span class="badge">${ml(m.type)}${m.status==='void'?' · ANULADO':''}${m.receiptNo?' · '+esc(m.receiptNo):''}</span></div><div><div class="amount ${m.type}" data-money>${s}${money(m.amount)}</div>${a?`<button class="ghost" onclick="showMovement('${m.id}')">Ver</button>`:''}</div></div>`}

async function repairMemberDuplicates(){
  const members=await all('members');
  const groups=new Map();
  for(const m of members){
    const key=normName(m.name);
    if(!key) continue;
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(m);
  }
  let repaired=0;
  const dues=await all('dues');
  for(const group of groups.values()){
    if(group.length<2) continue;
    group.sort((a,b)=>{
      const ap=a.phone?1:0,bp=b.phone?1:0;
      if(bp!==ap) return bp-ap;
      const aa=a.status==='active'?1:0,ba=b.status==='active'?1:0;
      if(ba!==aa) return ba-aa;
      return String(a.id).localeCompare(String(b.id));
    });
    const keep=group[0];
    for(const dup of group.slice(1)){
      for(const d of dues.filter(x=>x.memberId===dup.id)){
        const targetId=`due_${d.month}_${keep.id}`;
        const existing=await get('dues',targetId);
        if(existing){
          existing.amountDue=Math.max(+existing.amountDue||0,+d.amountDue||0);
          existing.amountPaid=Math.max(+existing.amountPaid||0,+d.amountPaid||0);
          existing.memberName=keep.name;
          existing.status=existing.amountPaid>=existing.amountDue?'paid':existing.amountPaid>0?'partial':'pending';
          existing.updatedAt=new Date().toISOString();
          await put('dues',existing);
          await del('dues',d.id);
        }else{
          await del('dues',d.id);
          d.id=targetId;
          d.memberId=keep.id;
          d.memberName=keep.name;
          await put('dues',d);
        }
      }
      await del('members',dup.id);
      repaired++;
    }
  }
  if(repaired) await audit('repair','members','duplicates',{removed:repaired,at:new Date().toISOString()});
  return repaired;
}

async function propagateMemberRename(memberId,oldName,newName){
  if(oldName===newName) return;
  const tx=await all('transactions');
  for(const t of tx){
    if(t.memberId===memberId || normName(t.person)===normName(oldName)){
      t.memberId=memberId;
      t.person=newName;
      t.updatedAt=new Date().toISOString();
      await put('transactions',t);
    }
  }
  const dues=await all('dues');
  for(const d of dues){
    if(d.memberId===memberId || normName(d.memberName)===normName(oldName)){
      d.memberId=memberId;
      d.memberName=newName;
      d.updatedAt=new Date().toISOString();
      await put('dues',d);
    }
  }
  await audit('rename-propagation','member',memberId,{oldName,newName,at:new Date().toISOString()});
}

async function validateUniqueMemberName(name,currentId=''){
  const members=await all('members');
  return !members.some(m=>m.id!==currentId && normName(m.name)===normName(name));
}

async function repairTransactionMemberLinks(){const ms=await all('members'),tx=await all('transactions');let n=0;for(const t of tx){const m=t.memberId?ms.find(x=>x.id===t.memberId):ms.find(x=>normName(x.name)===normName(t.person));if(m&&(t.memberId!==m.id||t.person!==m.name)){t.memberId=m.id;t.person=m.name;t.updatedAt=new Date().toISOString();await put('transactions',t);n++}}if(n)await audit('repair','transaction-member-links','all',{linked:n,at:new Date().toISOString()});return n}
function txBelongsToMember(t,m){return t.memberId===m.id||(!t.memberId&&normName(t.person)===normName(m.name))}
let currentProfileMemberId='';
async function showMemberProfile(id){try{const m=await get('members',id);if(!m){toast('No encontré ese miembro');return;}currentProfileMemberId=id;const tx=(await activeTx()).filter(t=>txBelongsToMember(t,m)).sort((a,b)=>b.date.localeCompare(a.date)),dues=(await all('dues')).filter(d=>d.memberId===m.id).sort((a,b)=>b.month.localeCompare(a.month)),acts=await all('activities'),cd=dues.find(d=>d.month===ym()),inc=tx.filter(t=>t.type==='income'),total=inc.reduce((s,t)=>s+(+t.amount||0),0),mp=cd?+cd.amountPaid||0:inc.filter(t=>ym(t.date)===ym()).reduce((s,t)=>s+(+t.amount||0),0),da=cd?+cd.amountDue||0:+settings.dueAmount||0,p=Math.max(0,da-mp),receipts=tx.filter(t=>t.receiptNo);$('profileMemberName').textContent=m.name;$('profileTotalContrib').textContent=money(total);$('profileMonthPaid').textContent=money(mp);$('profilePending').textContent=money(p);$('profileReceiptCount').textContent=receipts.length;$('profileDueStatus').textContent=!cd?'Sin cuota generada':cd.status==='paid'?'Al día':cd.status==='partial'?'Pago parcial':'Pendiente';$('profileDuesList').innerHTML=dues.length?dues.map(d=>`<div class="compact-row"><div><div class="compact-title">${esc(d.month)}</div><div class="compact-sub">${d.status}</div></div><div><strong data-money>${money(d.amountPaid)} / ${money(d.amountDue)}</strong><div class="compact-sub">Pendiente ${money(Math.max(0,d.amountDue-d.amountPaid))}</div></div></div>`).join(''):'<div class="empty">No hay cuotas generadas</div>';$('profileTransactionsList').innerHTML=tx.length?tx.slice(0,30).map(t=>{const a=acts.find(x=>x.id===t.activityId);return `<div class="compact-row"><div><div class="compact-title">${esc(t.concept)}</div><div class="compact-sub">${dateText(t.date)} · ${ml(t.type)}${a?' · '+esc(a.name):''}</div></div><strong class="${t.type}" data-money>${money(t.amount)}</strong></div>`}).join(''):'<div class="empty">No hay movimientos</div>';$('profileReceiptsList').innerHTML=receipts.length?receipts.map(t=>`<div class="compact-row"><div><div class="compact-title">${esc(t.receiptNo)}</div><div class="compact-sub">${dateText(t.date)} · ${esc(t.concept)}</div></div><button class="ghost" onclick="showReceipt('${t.id}')">Ver</button></div>`).join(''):'<div class="empty">No hay recibos</div>';const h=[...tx.map(t=>({date:t.date,title:`${ml(t.type)}: ${t.concept}`,detail:`${money(t.amount)}${t.receiptNo?' · '+t.receiptNo:''}`})),...dues.map(d=>({date:`${d.month}-01`,title:`Cuota ${d.month}`,detail:`${d.status} · ${money(d.amountPaid)} de ${money(d.amountDue)}`}))].sort((a,b)=>b.date.localeCompare(a.date));$('profileHistoryList').innerHTML=h.length?h.slice(0,40).map(x=>`<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-content"><div class="compact-title">${esc(x.title)}</div><div class="compact-sub">${dateText(x.date)} · ${esc(x.detail)}</div></div></div>`).join(''):'<div class="empty">Sin actividad histórica</div>';setView('memberProfile')}catch(err){console.error('Member profile error',err);alert('No pude abrir la ficha del miembro. Detalle: '+(err?.message||String(err)))}}
window.showMemberProfile=showMemberProfile;

async function renderDashboard(){const tx=await activeTx(),t=totals(tx),m=ym(),mt=totals(tx.filter(x=>ym(x.date)===m));$('balanceHero').textContent=money(t.income-t.expense);$('monthIncome').textContent=money(mt.income);$('monthExpense').textContent=money(mt.expense);$('monthSponsored').textContent=money(mt.sponsored);const dues=(await all('dues')).filter(d=>d.month===m),pending=dues.reduce((s,d)=>s+Math.max(0,+d.amountDue-(+d.amountPaid||0)),0);$('monthPending').textContent=money(pending);const active=(await all('members')).filter(x=>x.status==='active'),paid=dues.filter(d=>+d.amountPaid>=+d.amountDue&&+d.amountDue>0).length;$('memberSummary').textContent=`${paid} al día de ${active.length}`;$('memberProgress').style.width=`${active.length?Math.round(paid/active.length*100):0}%`;$('latestMovements').innerHTML=tx.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(x=>mi(x,false)).join('')||'<div class="empty">Sin movimientos</div>';$('backupStatus').textContent=settings.lastBackupAt?`Último respaldo: ${new Date(settings.lastBackupAt).toLocaleDateString('es-DO')}`:'⚠️ Aún no has creado respaldo'}
async function renderMovements(){const type=$('movementTypeFilter').value,q=$('movementSearch').value.toLowerCase().trim(),l=(await all('transactions')).filter(m=>(!type||m.type===type)&&(!q||`${m.person} ${m.concept}`.toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date));$('movementList').innerHTML=l.map(m=>mi(m,true)).join('')||'<div class="empty">Sin resultados</div>'}
async function renderMembers(){
  const q=$('memberSearch').value.toLowerCase().trim(),
        raw=(await all('members')).filter(m=>!q||m.name.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)),
        tx=await activeTx(),dues=await all('dues');
  const seen=new Set(),ms=[];
  for(const m of raw){const k=normName(m.name);if(seen.has(k))continue;seen.add(k);ms.push(m)}
  $('memberList').innerHTML=ms.map(m=>{
    const total=tx.filter(x=>x.type==='income'&&txBelongsToMember(x,m)).reduce((s,x)=>s+(+x.amount||0),0),
          d=dues.find(x=>x.memberId===m.id&&x.month===ym()),
          st=d?(+d.amountPaid>=+d.amountDue?'Al día':+d.amountPaid>0?'Parcial':'Pendiente'):'Sin cuota';
    return `<div class="item member-item-clickable">
      <div>
        <button class="member-name-link" onclick="showMemberProfile('${m.id}')">${esc(m.name)}</button>
        <div class="item-sub">${m.status==='active'?'Activo':'Inactivo'} · ${st}</div>
        <button class="secondary member-open-btn" onclick="showMemberProfile('${m.id}')">Ver ficha completa</button>
      </div>
      <div>
        <div class="amount income" data-money>${money(total)}</div>
        <button class="ghost" onclick="editMember('${m.id}')">Editar</button>
      </div>
    </div>`
  }).join('')||'<div class="empty">Sin miembros</div>'
}
async function renderActivities(){const as=(await all('activities')).sort((a,b)=>b.date.localeCompare(a.date)),tx=await activeTx();$('activityList').innerHTML=as.map(a=>{const t=totals(tx.filter(x=>x.activityId===a.id)),spent=t.expense+t.sponsored;return `<div class="item"><div><div class="item-title">${esc(a.name)}</div><div class="item-sub">${dateText(a.date)} · Presupuesto ${money(a.budget||0)}</div><span class="badge">Gastado ${money(spent)} · Restante ${money((+a.budget||0)-spent)}</span></div><button class="ghost" onclick="editActivity('${a.id}')">Editar</button></div>`}).join('')||'<div class="empty">Sin actividades</div>'}async function fillActivities(){const as=await all('activities');$('movementActivity').innerHTML='<option value="">Sin actividad</option>'+as.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}
async function generateDues(month=$('duesMonth').value||ym()){const ms=(await all('members')).filter(m=>m.status==='active'),a=+settings.dueAmount||0,e=await all('dues');for(const m of ms)if(!e.find(d=>d.memberId===m.id&&d.month===month))await put('dues',{id:`due_${month}_${m.id}`,memberId:m.id,memberName:m.name,month,amountDue:a,amountPaid:0,status:'pending',updatedAt:new Date().toISOString()});await audit('generate','dues',month,{amount:a,members:ms.length});await renderDues();await renderDashboard();toast('Cuotas del mes generadas')}async function syncDue(t){if(t.type!=='income')return;const members=await all('members'),m=members.find(x=>x.id===t.memberId)||members.find(x=>normName(x.name)===normName(t.person));if(!m)return;const month=ym(t.date),d=await get('dues',`due_${month}_${m.id}`);if(!d)return;const paid=(await activeTx()).filter(x=>x.type==='income'&&normName(x.person)===normName(m.name)&&ym(x.date)===month&&x.category==='Aporte').reduce((s,x)=>s+x.amount,0);d.amountPaid=paid;d.status=paid>=d.amountDue?'paid':paid>0?'partial':'pending';await put('dues',d)}async function renderDues(){const month=$('duesMonth').value||ym(),f=$('duesStatusFilter').value,l=(await all('dues')).filter(d=>d.month===month&&(!f||d.status===f));$('duesList').innerHTML=l.map(d=>`<div class="item"><div><div class="item-title">${esc(d.memberName)}</div><div class="item-sub">${d.status==='paid'?'Pagado':d.status==='partial'?'Parcial':'Pendiente'} · ${d.month}</div></div><div class="amount ${d.status==='paid'?'income':'expense'}" data-money>${money(d.amountPaid)} / ${money(d.amountDue)}</div></div>`).join('')||'<div class="empty">No hay cuotas generadas para este mes</div>'}
async function nextReceiptNo(date){const y=(date||nowDate()).slice(0,4),nums=(await all('transactions')).map(x=>x.receiptNo).filter(x=>x&&x.startsWith(`REC-${y}-`)).map(x=>+x.split('-').pop()).filter(Number.isFinite);return`REC-${y}-${String(Math.max(0,...nums)+1).padStart(4,'0')}`}function receiptHtml(m){return `<h2>${esc(settings.organization||'Junta de Vecinos')}</h2><p style="text-align:center"><strong>RECIBO ${esc(m.receiptNo||'')}</strong></p><div class="receipt-total">${money(m.amount)}</div><p><strong>Recibido de:</strong> ${esc(m.person)}</p><p><strong>Concepto:</strong> ${esc(m.concept)}</p><p><strong>Fecha:</strong> ${dateText(m.date)}</p><p><strong>Método:</strong> ${esc(m.method)}</p><p><strong>Tesorero:</strong> ${esc(settings.treasurer||'')}</p>`};window.showReceipt=async id=>{const m=await get('transactions',id);if(!m?.receiptNo)return;currentReceipt=m;$('receiptBody').innerHTML=receiptHtml(m);$('receiptBody').classList.add('print-target');$('receiptDialog').showModal()}
async function openMovement(type='income'){await fillActivities();$('movementForm').reset();$('movementId').value='';$('movementDate').value=nowDate();$('movementType').value=type;$('movementCategory').value=type==='income'?'Aporte':'Otro';$('movementGenerateReceipt').checked=type==='income';$('movementDialogTitle').textContent='Nuevo movimiento';$('movementDialog').showModal()}document.querySelectorAll('[data-new-type]').forEach(b=>b.onclick=()=>openMovement(b.dataset.newType));$('newMovementBtn').onclick=()=>openMovement();$('saveMovementBtn').onclick=async e=>{e.preventDefault();if(!$('movementForm').reportValidity())return;const oid=$('movementId').value,old=oid?await get('transactions',oid):null;let rn=old?.receiptNo||'';if($('movementGenerateReceipt').checked&&!rn)rn=await nextReceiptNo($('movementDate').value);const membersForTx=await all('members'),personName=$('movementPerson').value.trim().replace(/\s+/g,' '),matchedMember=membersForTx.find(x=>normName(x.name)===normName(personName));const d={id:oid||uid('t'),type:$('movementType').value,date:$('movementDate').value,person:matchedMember?matchedMember.name:personName,memberId:matchedMember?.id||old?.memberId||'',amount:+$('movementAmount').value,concept:$('movementConcept').value.trim(),category:$('movementCategory').value,activityId:$('movementActivity').value,method:$('movementMethod').value,notes:$('movementNotes').value.trim(),status:old?.status||'active',receiptNo:rn,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};await put('transactions',d);await audit(oid?'edit':'create','transaction',d.id,d);await syncDue(d);$('movementDialog').close();await renderAll();toast(rn?'Movimiento y recibo guardados':'Movimiento guardado');if(rn)showReceipt(d.id)}
window.showMovement=async id=>{const m=await get('transactions',id);$('detailBody').innerHTML=`<p><strong>${esc(m.concept)}</strong></p><p>${esc(m.person)} · ${dateText(m.date)}</p><p class="amount ${m.type}" data-money>${money(m.amount)}</p><p>${esc(m.method)} · ${esc(m.category||'')}</p><p class="muted">${esc(m.notes||'Sin observaciones')}</p><div class="quick-actions">${m.receiptNo?`<button class="secondary" onclick="showReceipt('${m.id}')">Ver recibo</button>`:''}${m.status!=='void'?`<button class="secondary" onclick="editMovement('${m.id}')">Editar</button><button class="danger-soft" onclick="voidMovement('${m.id}')">Anular</button>`:''}</div>`;$('detailDialog').showModal()};window.editMovement=async id=>{const m=await get('transactions',id);$('detailDialog').close();await fillActivities();$('movementId').value=m.id;$('movementType').value=m.type;$('movementDate').value=m.date;$('movementPerson').value=m.person;$('movementAmount').value=m.amount;$('movementConcept').value=m.concept;$('movementCategory').value=m.category||'Otro';$('movementActivity').value=m.activityId||'';$('movementMethod').value=m.method;$('movementNotes').value=m.notes||'';$('movementGenerateReceipt').checked=!!m.receiptNo;$('movementDialogTitle').textContent='Editar movimiento';$('movementDialog').showModal()};window.voidMovement=async id=>{if(!confirm('¿Anular este movimiento? Quedará en auditoría.'))return;const m=await get('transactions',id);m.status='void';m.voidedAt=new Date().toISOString();await put('transactions',m);await audit('void','transaction',id,m);await syncDue(m);$('detailDialog').close();await renderAll();toast('Movimiento anulado')}
$('newMemberBtn').onclick=()=>{$('memberForm').reset();$('memberId').value='';$('memberStatus').value='active';$('memberDialog').showModal()} ;window.editMember=async id=>{const m=await get('members',id);$('memberId').value=m.id;$('memberName').value=m.name;$('memberPhone').value=m.phone||'';$('memberStatus').value=m.status;$('memberDialog').showModal()} ;$('saveMemberBtn').onclick=async e=>{
  e.preventDefault();
  if(!$('memberForm').reportValidity())return;
  const existingId=$('memberId').value;
  const name=$('memberName').value.trim().replace(/\s+/g,' ');
  if(!(await validateUniqueMemberName(name,existingId))){
    alert('Ya existe un miembro con ese nombre. Edita el registro existente para evitar duplicados.');
    return;
  }
  const old=existingId?await get('members',existingId):null;
  const id=existingId||uid('m');
  const d={id,name,phone:$('memberPhone').value.trim(),status:$('memberStatus').value};
  await put('members',d);
  if(old && old.name!==d.name) await propagateMemberRename(id,old.name,d.name);
  await audit(existingId?'edit':'create','member',id,{...d,oldName:old?.name||''});
  $('memberDialog').close();
  await repairMemberDuplicates();
  await renderAll();
  toast(old && old.name!==d.name?'Miembro y registros históricos actualizados':'Miembro guardado')
}

$('newActivityBtn').onclick=()=>{$('activityForm').reset();$('activityId').value='';$('activityDate').value=nowDate();$('activityDialog').showModal()} ;window.editActivity=async id=>{const a=await get('activities',id);$('activityId').value=a.id;$('activityName').value=a.name;$('activityDate').value=a.date;$('activityBudget').value=a.budget||0;$('activityDescription').value=a.description||'';$('activityDialog').showModal()} ;$('saveActivityBtn').onclick=async e=>{e.preventDefault();if(!$('activityForm').reportValidity())return;const id=$('activityId').value||uid('a'),d={id,name:$('activityName').value.trim(),date:$('activityDate').value,budget:+$('activityBudget').value||0,description:$('activityDescription').value.trim()};await put('activities',d);await audit($('activityId').value?'edit':'create','activity',id,d);$('activityDialog').close();await renderAll();toast('Actividad guardada')}
async function closeMonth(){const month=prompt('Mes a cerrar (AAAA-MM):',ym());if(!month)return;if(await get('closures',month)){alert('Ese mes ya fue cerrado.');return}const alltx=await activeTx(),tx=alltx.filter(x=>ym(x.date)===month),t=totals(tx),bt=totals(alltx.filter(x=>x.date<`${month}-01`)),opening=bt.income-bt.expense,c={id:month,month,opening,income:t.income,expense:t.expense,sponsored:t.sponsored,closing:opening+t.income-t.expense,closedAt:new Date().toISOString(),closedBy:settings.treasurer||''};await put('closures',c);await audit('close','month',month,c);await renderClosures();toast('Mes cerrado')}async function renderClosures(){const cs=(await all('closures')).sort((a,b)=>b.month.localeCompare(a.month));$('closureList').innerHTML=cs.map(c=>`<div class="item"><div><div class="item-title">${esc(c.month)}</div><div class="item-sub">Cerrado ${new Date(c.closedAt).toLocaleDateString('es-DO')} · ${esc(c.closedBy)}</div></div><div><div class="amount income" data-money>${money(c.closing)}</div><span class="badge">Inicial ${money(c.opening)} · +${money(c.income)} · -${money(c.expense)}</span></div></div>`).join('')||'<div class="empty">Todavía no hay cierres</div>'}
async function renderReport(){const from=$('reportFrom').value||'0000-01-01',to=$('reportTo').value||'9999-12-31',list=(await all('transactions')).filter(m=>m.status!=='void'&&m.date>=from&&m.date<=to),t=totals(list);$('reportPreview').classList.add('print-target');$('reportPreview').innerHTML=`<h3>Informe Financiero – ${esc(settings.organization||'Junta de Vecinos')}</h3><p>Período: ${$('reportFrom').value?dateText($('reportFrom').value):'Todos los registros'} ${$('reportTo').value?'al '+dateText($('reportTo').value):''}</p><table><tr><th>Concepto</th><th>Monto</th></tr><tr><td>Ingresos</td><td>${money(t.income)}</td></tr><tr><td>Gastos</td><td>${money(t.expense)}</td></tr><tr><td>Patrocinados</td><td>${money(t.sponsored)}</td></tr><tr><th>Balance del período</th><th>${money(t.income-t.expense)}</th></tr></table><h4>Movimientos</h4><table>${list.map(x=>`<tr><td>${dateText(x.date)} · ${esc(x.person)} · ${esc(x.concept)}</td><td>${money(x.amount)}</td></tr>`).join('')||'<tr><td colspan="2">Sin movimientos</td></tr>'}</table><p class="muted">Los aportes directos no se consideran dinero que entra a caja.</p>`}

async function importLegacyData(legacy,{replace=false}={}){
  if(!legacy || typeof legacy!=='object') throw new Error('legacy-invalid');

  if(replace){
    for(const s of ['members','transactions','activities','dues','closures','audit']){
      for(const x of await all(s)) await del(s,x.id);
    }
  }

  // Settings/meta
  if(legacy.meta){
    await saveSettings({
      organization: legacy.meta.organization || settings.organization || 'Junta de Vecinos',
      treasurer: legacy.meta.treasurer || settings.treasurer || '',
      dueAmount: +settings.dueAmount || 200
    });
  }

  // Members: merge by normalized name.
  const existingMembers = await all('members');
  const byName = new Map(existingMembers.map(m=>[normName(m.name),m]));
  for(const lm of legacy.members||[]){
    const name=String(lm.name||'').trim().replace(/\s+/g,' ');
    if(!name) continue;
    const key=normName(name);
    const ex=byName.get(key);
    if(ex){
      ex.phone = ex.phone || lm.phone || '';
      ex.status = ex.status || lm.status || 'active';
      await put('members',ex);
    }else{
      const m={id:lm.id||uid('m'),name,phone:lm.phone||'',status:lm.status||'active'};
      await put('members',m);byName.set(key,m);
    }
  }

  // Activities: merge by normalized name + date.
  const existingActs=await all('activities');
  const actKey=a=>`${normName(a.name)}|${a.date||''}`;
  const acts=new Map(existingActs.map(a=>[actKey(a),a]));
  for(const la of legacy.activities||[]){
    if(!la.name) continue;
    const k=actKey(la);
    if(!acts.has(k)){
      const a={id:la.id||uid('a'),name:la.name,date:la.date||nowDate(),budget:+la.budget||0,description:la.description||''};
      await put('activities',a);acts.set(k,a);
    }
  }

  // Movements/transactions: merge by ID first, then signature.
  const legacyTx=legacy.movements||legacy.transactions||[];
  const existingTx=await all('transactions');
  const sig=t=>`${t.date||''}|${normName(t.person)}|${+t.amount||0}|${normName(t.concept)}`;
  const txById=new Map(existingTx.map(t=>[t.id,t]));
  const txSigs=new Set(existingTx.map(sig));
  for(const lt of legacyTx){
    const signature=sig(lt);
    if((lt.id && txById.has(lt.id)) || txSigs.has(signature)) continue;
    const t={
      ...lt,
      id:lt.id||uid('t'),
      category:lt.category || (lt.type==='income'?'Aporte':'Otro'),
      receiptNo:lt.receiptNo||'',
      receiptGenerated:!!lt.receiptNo,
      memberId:lt.memberId||'',
      status:lt.status||'active',
      createdAt:lt.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };
    await put('transactions',t);
    txSigs.add(signature);
  }

  // Old audit is optional.
  for(const a of legacy.audit||[]){
    if(a?.id && !(await get('audit',a.id))) await put('audit',a);
  }

  await repairMemberDuplicates();
  await repairTransactionMemberLinks();

  // Rebuild dues for current month if members exist and there are none.
  const members=(await all('members')).filter(m=>m.status==='active');
  const currentDues=(await all('dues')).filter(d=>d.month===ym());
  if(members.length && !currentDues.length && (+settings.dueAmount||0)>0){
    await generateDues(ym());
  }

  await audit('import','legacy','v2',{members:(legacy.members||[]).length,transactions:legacyTx.length,activities:(legacy.activities||[]).length,at:new Date().toISOString()});
  await renderAll();
}

function isV3Backup(d){
  return d && Number(d.version)>=3 && Array.isArray(d.members) && Array.isArray(d.transactions);
}
function isLegacyBackup(d){
  return d && !d.version && Array.isArray(d.members) && (Array.isArray(d.movements)||Array.isArray(d.transactions));
}


function normalizeBackupShape(d){
  if(!d || typeof d!=='object') throw new Error('El archivo no contiene un objeto JSON válido.');
  const tx = Array.isArray(d.transactions) ? d.transactions : (Array.isArray(d.movements) ? d.movements : []);
  if(!Array.isArray(d.members) || !Array.isArray(tx)) throw new Error('El respaldo no contiene las colecciones members y transactions/movements.');

  const groups=new Map();
  for(const m of d.members){
    const name=String(m?.name||'').trim().replace(/\s+/g,' ');
    if(!name) continue;
    const k=normName(name);
    if(!groups.has(k)) groups.set(k,[]);
    groups.get(k).push({...m,name});
  }

  const members=[], oldToNew=new Map(), nameToMember=new Map();
  for(const [k,g] of groups){
    g.sort((a,b)=>{
      const ap=a.phone?1:0,bp=b.phone?1:0;if(bp!==ap)return bp-ap;
      const as=/^m\d+$/.test(String(a.id||''))?1:0,bs=/^m\d+$/.test(String(b.id||''))?1:0;if(bs!==as)return bs-as;
      return String(a.id||'').localeCompare(String(b.id||''));
    });
    const keep={...g[0],id:g[0].id||uid('m'),status:g.some(x=>x.status==='active')?'active':(g[0].status||'active')};
    if(!keep.phone) keep.phone=g.find(x=>x.phone)?.phone||'';
    members.push(keep);nameToMember.set(k,keep);
    for(const x of g) if(x.id) oldToNew.set(x.id,keep.id);
  }

  const transactions=tx.map(x=>{
    const t={...x};
    const byId=t.memberId?members.find(m=>m.id===oldToNew.get(t.memberId)||m.id===t.memberId):null;
    const byName=nameToMember.get(normName(t.person));
    const m=byId||byName;
    if(m){t.memberId=m.id;t.person=m.name}else t.memberId=t.memberId||'';
    t.id=t.id||uid('t');t.status=t.status||'active';t.category=t.category||(t.type==='income'?'Aporte':'Otro');
    t.receiptNo=t.receiptNo||'';t.receiptGenerated=!!t.receiptNo;t.createdAt=t.createdAt||new Date().toISOString();
    return t;
  });

  const dueMap=new Map();
  for(const x of Array.isArray(d.dues)?d.dues:[]){
    const q={...x};q.memberId=oldToNew.get(q.memberId)||q.memberId;
    const m=members.find(mm=>mm.id===q.memberId)||nameToMember.get(normName(q.memberName));
    if(m){q.memberId=m.id;q.memberName=m.name}
    const key=`${q.month||''}|${q.memberId||''}`;
    if(dueMap.has(key)){
      const e=dueMap.get(key);e.amountDue=Math.max(+e.amountDue||0,+q.amountDue||0);e.amountPaid=Math.max(+e.amountPaid||0,+q.amountPaid||0);
      e.status=e.amountPaid>=e.amountDue?'paid':e.amountPaid>0?'partial':'pending';
    }else{q.id=`due_${q.month}_${q.memberId}`;dueMap.set(key,q)}
  }

  return {
    version:4,
    settings:d.settings||d.meta||{},
    members,
    transactions,
    activities:Array.isArray(d.activities)?d.activities:[],
    dues:[...dueMap.values()],
    closures:Array.isArray(d.closures)?d.closures:[],
    audit:Array.isArray(d.audit)?d.audit:[]
  };
}

async function restoreCompatibleBackup(d){
  const n=normalizeBackupShape(d);

  // Write in a deterministic order. No render until all records exist.
  for(const s of ['members','transactions','activities','dues','closures','audit']){
    for(const x of await all(s)) await del(s,x.id);
  }

  for(const m of n.members) await put('members',m);
  for(const a of n.activities) await put('activities',{budget:0,description:'',...a});
  for(const t of n.transactions) await put('transactions',t);
  for(const q of n.dues) await put('dues',q);
  for(const c of n.closures) await put('closures',c);
  for(const a of n.audit) if(a?.id) await put('audit',a);

  if(n.settings) await put('settings',{...n.settings,id:'main'});
  await loadSettings();

  // Repair member links one last time after every table is loaded.
  await repairMemberDuplicates();
  await repairTransactionMemberLinks();

  const memberCount=(await all('members')).length;
  const txCount=(await all('transactions')).length;
  const activityCount=(await all('activities')).length;
  if(!memberCount) throw new Error('La restauración terminó sin miembros; se canceló la validación.');

  await audit('restore','backup','compatible',{members:memberCount,transactions:txCount,activities:activityCount,at:new Date().toISOString()});
  await renderAll();
  return `Respaldo restaurado: ${memberCount} miembros, ${txCount} movimientos y ${activityCount} actividad(es).`;
}

async function recoverLegacyFromDevice(){
  const raw=localStorage.getItem('juntaTreasury_v1');
  if(!raw) throw new Error('legacy-not-found');
  const legacy=JSON.parse(raw);
  if(!isLegacyBackup(legacy) && !(legacy.members||legacy.movements||legacy.activities)) throw new Error('legacy-invalid');
  await importLegacyData(legacy,{replace:false});
}

async function exportAll(){return{format:'tesoreria-junta',version:6,schemaVersion:6,exportedAt:new Date().toISOString(),settings:await get('settings','main'),members:await all('members'),transactions:await all('transactions'),activities:await all('activities'),dues:await all('dues'),closures:await all('closures'),audit:await all('audit')}}async function restoreAll(d){for(const s of ['members','transactions','activities','dues','closures','audit'])for(const x of await all(s))await del(s,x.id);for(const s of ['members','transactions','activities','dues','closures','audit'])for(const x of d[s]||[])await put(s,x);if(d.settings)await put('settings',{...d.settings,id:'main'});await loadSettings();await renderAll()}function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
$('generateDuesBtn').onclick=()=>generateDues();$('duesMonth').onchange=renderDues;$('duesStatusFilter').onchange=renderDues;$('closeMonthBtn').onclick=closeMonth;$('refreshReportBtn').onclick=renderReport;$('reportFrom').onchange=renderReport;$('reportTo').onchange=renderReport;
async function buildWhatsAppReport(){
  const tx=reportData(await all('transactions'));
  const t=totals(tx);
  const from=$('reportFrom').value,to=$('reportTo').value;
  const period=from||to ? `${from?dateText(from):'Inicio'} al ${to?dateText(to):'Hoy'}` : 'Todos los registros';

  const incomes=tx.filter(x=>x.type==='income');
  const expenses=tx.filter(x=>x.type==='expense');
  const sponsored=tx.filter(x=>x.type==='sponsored');

  const lines=[
    `📋 *INFORME FINANCIERO – ${settings.organization||'Junta de Vecinos'}*`,
    ``,
    `📅 *Período:* ${period}`,
    ``,
    `💰 *RESUMEN*`,
    `• Ingresos al fondo: ${money(t.income)}`,
    `• Gastos del fondo: ${money(t.expense)}`,
    `• Aportes directos/patrocinados: ${money(t.sponsored)}`,
    `• *Balance del fondo: ${money(t.income-t.expense)}*`
  ];

  if(incomes.length){
    lines.push(``,`👥 *APORTES RECIBIDOS*`);
    for(const x of incomes) lines.push(`• ${x.person}: ${money(x.amount)}`);
  }

  if(expenses.length){
    lines.push(``,`📤 *GASTOS DEL FONDO*`);
    for(const x of expenses) lines.push(`• ${x.concept}: ${money(x.amount)}`);
  }

  if(sponsored.length){
    lines.push(``,`🤝 *APORTES DIRECTOS / PATROCINADOS*`);
    for(const x of sponsored) lines.push(`• ${x.person} – ${x.concept}: ${money(x.amount)}`);
  }

  lines.push(``,`ℹ️ Los aportes directos no se contabilizan como dinero que entra al fondo.`);
  return lines.join('\n');
}

async function shareWhatsAppReport(){
  const text=await buildWhatsAppReport();
  if(navigator.share){
    await navigator.share({title:`Informe financiero – ${settings.organization||'Junta de Vecinos'}`,text});
  }else{
    await navigator.clipboard.writeText(text);
    toast('Informe copiado. Pégalo en WhatsApp');
  }
}

$('printReportBtn').onclick=()=>window.print();$('shareReportBtn').onclick=async()=>{const txt=$('reportPreview').innerText;if(navigator.share)await navigator.share({title:'Informe financiero',text:txt});else{await navigator.clipboard.writeText(txt);toast('Informe copiado')}};$('exportCsvBtn').onclick=async()=>{const tx=await all('transactions'),rows=[['Fecha','Tipo','Persona','Monto','Concepto','Categoria','Metodo','Recibo','Estado'],...tx.map(m=>[m.date,ml(m.type),m.person,m.amount,m.concept,m.category,m.method,m.receiptNo,m.status])],csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');downloadBlob(new Blob(['\ufeff'+csv],{type:'text/csv'}),'tesoreria_movimientos.csv')}
$('backupBtn').onclick=async()=>{downloadBlob(new Blob([JSON.stringify(await exportAll(),null,2)],{type:'application/json'}),`respaldo_tesoreria_${nowDate()}.json`);await saveSettings({lastBackupAt:new Date().toISOString()});await renderDashboard();toast('Respaldo exportado')};$('restoreInput').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const d=JSON.parse(await f.text());
    const msg=await restoreCompatibleBackup(d);
    toast(msg);
  }catch(err){
    console.error(err);
    alert('No se pudo restaurar el respaldo. Detalle: ' + (err?.message || String(err)));
  }
  e.target.value=''
};

$('recoverLegacyBtn').onclick=async()=>{
  try{
    await recoverLegacyFromDevice();
    toast('Datos anteriores recuperados');
  }catch(err){
    console.error(err);
    if(err.message==='legacy-not-found') alert('No encontré datos de la versión anterior en este navegador. Usa Restaurar respaldo y selecciona tu archivo JSON anterior.');
    else alert('Encontré datos anteriores, pero no pude convertirlos automáticamente.');
  }
};
$('resetBtn').onclick=()=>{if(confirm('¿Borrar TODOS los datos locales?')){indexedDB.deleteDatabase(DB_NAME);localStorage.clear();location.reload()}};$('saveSettingsBtn').onclick=async e=>{e.preventDefault();await saveSettings({organization:$('settingOrg').value.trim(),treasurer:$('settingTreasurer').value.trim(),dueAmount:+$('settingDueAmount').value||0,pin:$('settingPin').value.trim()});toast('Configuración guardada');await renderAll()};$('privacyBtn').onclick=()=>{privacy=!privacy;document.body.classList.toggle('money-hidden',privacy);$('privacyBtn').textContent=privacy?'🙈':'👁️'};$('closeReceiptBtn').onclick=()=>$('receiptDialog').close();$('closeDetailBtn').onclick=()=>$('detailDialog').close();$('printReceiptBtn').onclick=()=>window.print();$('shareReceiptBtn').onclick=async()=>{
  if(!currentReceipt)return;
  const r=currentReceipt;
  const txt=[
    `🧾 *RECIBO ${r.receiptNo||''}*`,
    `🏘️ ${settings.organization||'Junta de Vecinos'}`,
    ``,
    `👤 Recibido de: *${r.person}*`,
    `💵 Monto: *${money(r.amount)}*`,
    `📝 Concepto: ${r.concept}`,
    `📅 Fecha: ${dateText(r.date)}`,
    `💳 Método: ${r.method||'-'}`,
    ``,
    `Tesorero: ${settings.treasurer||'-'}`
  ].join('\n');
  if(navigator.share)await navigator.share({title:`Recibo ${r.receiptNo||''}`,text:txt});
  else{await navigator.clipboard.writeText(txt);toast('Recibo copiado. Pégalo en WhatsApp')}
};$('quickReceiptBtn').onclick=async()=>{const tx=(await all('transactions')).filter(x=>x.receiptNo).sort((a,b)=>b.date.localeCompare(a.date));if(!tx.length){toast('Aún no hay recibos');return}showReceipt(tx[0].id)};$('movementTypeFilter').onchange=renderMovements;$('movementSearch').oninput=renderMovements;$('memberSearch').oninput=renderMembers;
async function renderSettings(){$('settingOrg').value=settings.organization||'';$('settingTreasurer').value=settings.treasurer||'';$('settingDueAmount').value=settings.dueAmount||200;$('settingPin').value=settings.pin||''}async function renderAll(){await loadSettings();await Promise.all([fillActivities(),renderDashboard(),renderMovements(),renderMembers(),renderActivities(),renderDues(),renderClosures(),renderSettings()]);if(document.querySelector('.view.active')?.id==='reports')await renderReport()}async function setup(){if((await get('settings','main'))?.organization)return;return new Promise(r=>{$('setupDialog').showModal();$('finishSetupBtn').onclick=async e=>{e.preventDefault();if(!$('setupForm').reportValidity())return;await saveSettings({organization:$('setupOrg').value.trim(),treasurer:$('setupTreasurer').value.trim(),dueAmount:+$('setupDueAmount').value||0,pin:$('setupPin').value.trim(),createdAt:new Date().toISOString()});$('setupDialog').close();r()}})}async function unlockIfNeeded(){if(!settings.pin)return;$('pinDialog').showModal();$('unlockBtn').onclick=e=>{e.preventDefault();if($('pinInput').value===settings.pin){$('pinDialog').close();$('pinInput').value=''}else toast('PIN incorrecto')}}let deferredPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});$('installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')};$('closeMemberProfileBtn').onclick=()=>setView('members');$('profileEditMemberBtn').onclick=()=>{const id=currentProfileMemberId;setView('members');if(id)editMember(id)};$('profileAddContributionBtn').onclick=async()=>{const m=await get('members',currentProfileMemberId);if(!m)return;setView('members');await openMovement('income');$('movementPerson').value=m.name;$('movementConcept').value='Aporte al fondo de la Junta';$('movementCategory').value='Aporte';$('movementGenerateReceipt').checked=true};
(async()=>{dbi=await openDB();await migrateLegacy();await loadSettings();await setup();await loadSettings();$('duesMonth').value=ym();await renderAll();await unlockIfNeeded();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})})();