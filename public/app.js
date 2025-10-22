async function j(url, opts){
  const r = await fetch(url, opts); if(!r.ok) throw new Error(`${r.status}`); return r.json();
}
function el(tag, cls, text){ const e=document.createElement(tag); if(cls)e.className=cls; if(text)e.textContent=text; return e; }
function fmtTs(ts){ const d=new Date(ts); return d.toLocaleString(); }

async function loadStatus(){
  try{
    const s = await j('/api/status');
    const c = document.getElementById('status');
    c.innerHTML = '';
    const grid = el('div'); grid.className='kv';
    const addKV=(k,v)=>{ const b=el('b',null,k); const vEl=el('div','mono',typeof v==='object'?JSON.stringify(v):String(v)); const row=el('div','kv'); row.append(b,vEl); c.append(row); }
    addKV('PID', s.pid);
    addKV('Uptime (s)', s.uptimeSec);
    addKV('Version', s.version);
    addKV('Disabled', s.disabled);
    if(s.network) addKV('Network', JSON.stringify(s.network));
    if(s.disk) addKV('Disk use %', s.disk.use);
  }catch(e){ console.error('status',e); }
}

async function loadSync(){
  try{
    const { status } = await j('/api/sync/status');
    const c = document.getElementById('sync');
    if(!c) return;
    c.innerHTML='';
    const add=(k,v)=>{ const row=document.createElement('div'); row.className='kv'; row.append(el('b',null,k), el('div','mono',typeof v==='object'?JSON.stringify(v):String(v))); c.append(row) }
    add('Notion', JSON.stringify({ configured: status.notion.configured, alertsDb: status.notion.alertsDb, actionsDb: status.notion.actionsDb }))
    add('Neon', JSON.stringify({ configured: status.neon.configured, counts: status.neon.counts }))
    add('Cloudflare', JSON.stringify(status.cloudflare))
    add('DataVault', JSON.stringify({ root: status.dataVault.root, filesApprox: status.dataVault.filesApprox }))
    add('Differences', JSON.stringify(status.differences))
  }catch(e){ console.error('sync',e) }
}

async function loadIntake(){
  try{
    const { items=[] } = await j('/api/intake/recent');
    const box = document.getElementById('intake'); if(!box) return; box.innerHTML='';
    items.forEach(it=>{
      const row = el('div','item');
      const head = el('div');
      const tag = el('span','pill ok', (it.categories && it.categories[0]) || 'Unassigned');
      const ts = el('span','ts',' '+new Date(it.ts).toLocaleString());
      head.append(tag, ts);
      const meta = el('div','mono', `${(it.subject||'').slice(0,120)}  from: ${(it.from && it.from[0] && it.from[0].address)||''}  to: ${(it.to && it.to[0] && it.to[0].address)||''}  files:${it.attachments}`);
      row.append(head, meta);
      box.append(row);
    })
  }catch(e){ console.error('intake',e) }
}

async function loadActions(){
  try{
    const { actions=[] } = await j('/api/actions');
    const box = document.getElementById('actions');
    box.innerHTML='';
    actions.slice().reverse().forEach(a=>{
      const it = el('div','item');
      const head = el('div');
      const tag = el('span','pill '+(a.type==='move'?'ok':'err'), a.type);
      const ts = el('span','ts', ' '+fmtTs(a.ts));
      head.append(tag, ts);
      const body = el('div','mono');
      body.textContent = a.type==='move' ? `${a.from} → ${a.to} (${a.size||0}B)` : (a.message || a.error || JSON.stringify(a));
      it.append(head, body);
      box.append(it);
    })
  }catch(e){ console.error('actions',e); }
}

async function loadAlerts(){
  try{
    const { alerts=[] } = await j('/api/alerts');
    const box = document.getElementById('alerts'); box.innerHTML='';
    alerts.slice().reverse().forEach(a=>{
      const it=el('div','item');
      const head=el('div');
      const cls=a.type==='low-space'?'warn':'err';
      const tag=el('span','pill '+cls, a.type);
      const ts=el('span','ts',' '+fmtTs(a.ts));
      head.append(tag, ts);
      const msg=el('div','mono',a.message);
      it.append(head,msg);
      box.append(it);
    })
  }catch(e){ console.error('alerts',e); }
}

async function organizeDryRun(){
  try{
    await j('/api/organize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dryRun:true})});
    await loadActions();
  }catch(e){alert('Organize failed: '+e.message)}
}
async function backupDryRun(){
  try{
    await j('/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dryRun:true})});
  }catch(e){alert('Backup failed: '+e.message)}
}

async function snapshotNow(){
  try{
    await j('/api/snapshot',{method:'POST'});
    await loadStatus();
  }catch(e){alert('Snapshot failed: '+e.message)}
}

function init(){
  document.getElementById('refresh').onclick=()=>{loadStatus();loadActions();loadAlerts()};
  document.getElementById('organize').onclick=organizeDryRun;
  document.getElementById('backup').onclick=backupDryRun;
  const snapBtn=document.getElementById('snapshot'); if(snapBtn) snapBtn.onclick=snapshotNow;
  loadStatus(); loadActions(); loadAlerts();
  loadSync();
  loadIntake();
  setInterval(loadStatus, 10000);
  setInterval(loadActions, 12000);
  setInterval(loadAlerts, 15000);
  setInterval(loadSync, 20000);
  setInterval(loadIntake, 25000);
}

window.addEventListener('DOMContentLoaded', init);
