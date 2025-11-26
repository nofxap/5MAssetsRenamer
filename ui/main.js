const segment=document.getElementById('modeSegment')
const replaceField=document.getElementById('replaceField')
const prefixField=document.getElementById('prefixField')
const suffixField=document.getElementById('suffixField')
const findTextInput=document.getElementById('findText')
const executeBtn=document.getElementById('executeBtn')
const statusEl=document.getElementById('status')
const errorsEl=document.getElementById('errors')
const logsEl=document.getElementById('logs')
const onFinish=document.getElementById('onFinish')
const finishCmdField=document.getElementById('finishCmdField')
const finishCmd=document.getElementById('finishCmd')
const addFinishBtn=document.getElementById('addFinishBtn')
const onFinish2=document.getElementById('onFinish2')
const finishCmdField2=document.getElementById('finishCmdField2')
const finishCmd2=document.getElementById('finishCmd2')
const helpBtn=document.getElementById('helpBtn')
const helpModal=document.getElementById('helpModal')
const closeHelp=document.getElementById('closeHelp')
const fetchFilesBtn=document.getElementById('fetchFilesBtn')
const statusCli=document.getElementById('status-cli')
const creditsBtn=document.getElementById('creditsBtn')
const creditsModal=document.getElementById('creditsModal')
const closeCredits=document.getElementById('closeCredits')
const themeToggle=document.getElementById('themeToggle')
const themeIcon=document.getElementById('themeIcon')
const versionBtn=document.getElementById('versionBtn')
const changelogModal=document.getElementById('changelogModal')
const closeChangelog=document.getElementById('closeChangelog')
const updateBtn=document.getElementById('updateBtn')
const changelogList=document.getElementById('changelogList')
const browseInput=document.getElementById('browseInput')
const browseOutput=document.getElementById('browseOutput')
const githubBtn=document.getElementById('githubBtn')
const messageModal=document.getElementById('messageModal')
const messageTitle=document.getElementById('messageTitle')
const messageBody=document.getElementById('messageBody')
const closeMessage=document.getElementById('closeMessage')
const messageAction=document.getElementById('messageAction')
const renamerBtn=document.getElementById('renamerBtn')
const queueBtn=document.getElementById('queueBtn')
const recentBtn=document.getElementById('recentBtn')
const panelRename=document.getElementById('panelRename')
const panelQueue=document.getElementById('panelQueue')
const panelRecent=document.getElementById('panelRecent')
const recentList=document.getElementById('recentList')
const queueList=document.getElementById('queueList')
const startQueueBtn=document.getElementById('startQueueBtn')
const queueCurrent=document.getElementById('queueCurrent')
const queueFinishedList=document.getElementById('queueFinishedList')
const startQueueLogsBtn=document.getElementById('startQueueLogsBtn')
const queueInlineLogs=document.getElementById('queueInlineLogs')
const closeInlineLogs=document.getElementById('closeInlineLogs')
const closeQueueInlineLogs=document.getElementById('closeQueueInlineLogs')
const clearQueueBtn=document.getElementById('clearQueueBtn')
const clearFinishedBtn=document.getElementById('clearFinishedBtn')
const onFinishQ=document.getElementById('onFinishQ')
const finishCmdFieldQ=document.getElementById('finishCmdFieldQ')
const finishCmdQ=document.getElementById('finishCmdQ')
const addFinishBtnQ=document.getElementById('addFinishBtnQ')
const onFinishQ2=document.getElementById('onFinishQ2')
const finishCmdFieldQ2=document.getElementById('finishCmdFieldQ2')
const finishCmdQ2=document.getElementById('finishCmdQ2')
const runningSection=document.getElementById('runningSection')
const finishedSection=document.getElementById('finishedSection')

const LOCAL_VERSION='v1.0.0'
const GH_OWNER='nofxap'
const GH_REPO='5MAssetsRenamer'
let remoteVersion=null
let remoteCliUrl=null
let remoteUiUrl=null

let mode='replace'
function updateMode(){
  const v=mode
  replaceField.classList.toggle('hidden',v!=='replace')
  prefixField.classList.toggle('hidden',v!=='prefix')
  suffixField.classList.toggle('hidden',v!=='suffix')
  if(findTextInput){
    const label=findTextInput.previousElementSibling
    const hide=v!=='replace'
    if(label) label.classList.toggle('hidden',hide)
    findTextInput.classList.toggle('hidden',hide)
  }
}
segment.addEventListener('click',(e)=>{
  const t=e.target
  if(t.tagName==='BUTTON'){
    segment.querySelectorAll('button').forEach(b=>b.classList.remove('active'))
    t.classList.add('active')
    mode=t.getAttribute('data-mode')
    updateMode()
  }
})
updateMode()

onFinish.addEventListener('change',()=>{
  const v=onFinish.value
  finishCmdField.classList.toggle('hidden',v!=='run_cmd')
  const r=document.getElementById('onFinish2Row')
  addFinishBtn.classList.toggle('hidden',v==='none' || !r.classList.contains('hidden'))
  syncActionOptions()
})
if(onFinish2){
  onFinish2.addEventListener('change',()=>{
    const v=onFinish2.value
    finishCmdField2.classList.toggle('hidden',v!=='run_cmd')
    syncActionOptions()
  })
}
function syncActionOptions(){
  const v1=onFinish.value
  const v2=onFinish2?onFinish2.value:'none'
  const power=['shutdown','restart']
  const bothPowerSelected=(power.includes(v1) || power.includes(v2))
  Array.from(onFinish.options).forEach((opt)=>{
    if(power.includes(opt.value)){ opt.disabled = power.includes(v2) }
    if(opt.value==='close'){ opt.disabled = v2==='close' }
  })
  if(onFinish2){
    Array.from(onFinish2.options).forEach((opt)=>{
      if(power.includes(opt.value)){ opt.disabled = power.includes(v1) }
      if(opt.value==='close'){ opt.disabled = v1==='close' }
    })
  }
}
addFinishBtn.addEventListener('click',()=>{
  const r=document.getElementById('onFinish2Row')
  r.classList.remove('hidden')
  addFinishBtn.classList.add('hidden')
  syncActionOptions()
})
document.getElementById('removeFinishBtn').addEventListener('click',()=>{
  const r=document.getElementById('onFinish2Row')
  r.classList.add('hidden')
  if(onFinish2){ onFinish2.value='none' }
  finishCmdField2.classList.add('hidden')
  addFinishBtn.classList.toggle('hidden',onFinish.value==='none')
  syncActionOptions()
})

function setDot(el,ok){ el.classList.toggle('ok',!!ok) }
async function updateCliStatus(){
  try{
    const invoke=window.__TAURI__.core.invoke
    const ok=await invoke('check_cli_installed')
    setDot(statusCli,ok)
    let showBtn=!ok
    let btnText='Fetch CLI'
    try{
      const raw=await invoke('fetch_release_by_tag',{ owner: GH_OWNER, repo: GH_REPO, tag: 'CLI' })
      const rel=JSON.parse(raw)
      const remote=(rel.tag_name||rel.name||'').trim()
      const local=String(localStorage.getItem('cliVersion')||'').trim()
      if(ok && remote && local && normalizeVer(remote)!==normalizeVer(local)){
        showBtn=true
        btnText='Update CLI'
        let flag=document.getElementById('cliUpdateFlag')
        if(!flag){ flag=document.createElement('div'); flag.id='cliUpdateFlag'; flag.className='status-item'; flag.innerHTML='<span>Update available</span><span class="status-dot"></span>'; document.getElementById('cliStatus').appendChild(flag) }
        flag.querySelector('.status-dot').classList.add('ok')
      }else{
        const flag=document.getElementById('cliUpdateFlag'); if(flag){ flag.remove() }
      }
    }catch{}
    fetchFilesBtn.textContent=btnText
    fetchFilesBtn.classList.toggle('hidden',!showBtn)
  }catch{}
}
helpBtn.addEventListener('click',()=>{helpModal.classList.remove('hidden'); updateCliStatus()})
async function ensureCliOnBoot(){
  try{
    const invoke=window.__TAURI__.core.invoke
    const ok=await invoke('check_cli_installed')
    const raw=await invoke('fetch_release_by_tag',{ owner: GH_OWNER, repo: GH_REPO, tag: 'CLI' })
    const rel=JSON.parse(raw)
    const remote=(rel.tag_name||rel.name||'').trim()
    const local=String(localStorage.getItem('cliVersion')||'').trim()
    const needsInstall=!ok
    const needsUpdate=!!remote && !!local && normalizeVer(remote)!==normalizeVer(local)
    if(needsInstall || needsUpdate){
      let cliUrl=null
      const assets=Array.isArray(rel.assets)?rel.assets:[]
      for(let i=0;i<assets.length;i++){ const a=assets[i]; const name=String(a.name||''); const url=String(a.browser_download_url||''); if(/codewalkercli|\.exe$/i.test(name)){ cliUrl=url; break } }
      if(cliUrl){ await invoke('download_cli',{ url: cliUrl }); try{ if(remote) localStorage.setItem('cliVersion',remote) }catch{} }
    }
  }catch{}
}
ensureCliOnBoot()
closeHelp.addEventListener('click',()=>{helpModal.classList.add('hidden')})
creditsBtn.addEventListener('click',()=>{creditsModal.classList.remove('hidden')})
closeCredits.addEventListener('click',()=>{creditsModal.classList.add('hidden')})

function applyTheme(t){
  if(t==='light'){ document.body.classList.add('theme-light') } else { document.body.classList.remove('theme-light') }
  themeIcon.textContent = t==='light' ? 'light_mode' : 'dark_mode'
}

const savedTheme=localStorage.getItem('theme')||'dark'
applyTheme(savedTheme)

themeToggle.addEventListener('click',()=>{
  const next=document.body.classList.contains('theme-light')?'dark':'light'
  applyTheme(next)
  localStorage.setItem('theme',next)
})
versionBtn.addEventListener('click',()=>{
  if(versionBtn.classList.contains('outdated')){
    changelogModal.classList.remove('hidden')
  }
})
browseInput.addEventListener('click',async()=>{
  try{
    const invoke=window.__TAURI__.core.invoke
    const sel=await invoke('open_folder_dialog')
    if(sel){ document.getElementById('inputPath').value=sel }
  }catch{}
})
browseOutput.addEventListener('click',async()=>{
  try{
    const invoke=window.__TAURI__.core.invoke
    const sel=await invoke('open_folder_dialog')
    if(sel){ document.getElementById('outputPath').value=sel }
  }catch{}
})
closeChangelog.addEventListener('click',()=>{changelogModal.classList.add('hidden')})
function openExternal(url){
  const invoke=window.__TAURI__.core.invoke
  invoke('open_url',{ url })
}
githubBtn.addEventListener('click',()=>{ openExternal('https://github.com/nofxap/5MAssetsRenamer') })
document.querySelectorAll('.credits-list a.icon-link').forEach(a=>{
  a.addEventListener('click',(e)=>{ e.preventDefault(); openExternal(a.getAttribute('href')) })
})
closeMessage.addEventListener('click',()=>{messageModal.classList.add('hidden')})
function showMessage(title,body){ messageTitle.textContent=title; messageBody.textContent=body; messageAction.classList.add('hidden'); messageModal.classList.remove('hidden') }
function showActionMessage(title,body,text,onClick){ messageTitle.textContent=title; messageBody.textContent=body; messageAction.textContent=text; messageAction.onclick=onClick; messageAction.classList.remove('hidden'); messageModal.classList.remove('hidden') }

function setStatus(type){
  statusEl.innerHTML=''
  if(type==='running'){statusEl.innerHTML='<span>Processing...</span>'}
  else if(type==='failed'){statusEl.innerHTML='<span style="color:#ff6b6b">Failed</span>'}
  else if(type==='done'){statusEl.innerHTML='<span style="color:#2f80ed">Completed</span>'}
  else{statusEl.innerHTML='<span>Ready</span>'}
}

async function runWithTauri(payload){
  try{
    const invoke=window.__TAURI__.core.invoke
    const resp=await invoke('run_codewalker_cli',{config:payload})
    return { ok:true, data:resp }
  }catch(e){
    return { ok:false, error:e?.message||'Invoke failed' }
  }
}

async function runStreamWithTauri(payload, onLog){
  const listen=window.__TAURI__.event.listen
  const invoke=window.__TAURI__.core.invoke
  const unlisten=await listen('cli-log',e=>{ onLog(String(e.payload||'')) })
  try{
    const resp=await invoke('run_codewalker_cli_stream',{ config: payload })
    unlisten()
    return { ok:true, data:resp }
  }catch(e){
    unlisten()
    return { ok:false, error:e?.message||'Invoke failed' }
  }
}

function firstInt(s){ const m=String(s||'').match(/\d+/); return m?parseInt(m[0],10):null }
function updateStatsFromLine(l){
  const tf=document.getElementById('totalFiles')
  const pf=document.getElementById('processedFiles')
  const rf=document.getElementById('renamedFiles')
  const rs=document.getElementById('replacedStrings')
  const fl=document.getElementById('failed')
  const s=l.trim()
  if(/Found.*total files/i.test(s)){ const n=firstInt(s); if(n!==null) tf.textContent=String(n) }
  else if(/^Total Files:/i.test(s)){ const n=firstInt(s); if(n!==null) tf.textContent=String(n) }
  else if(/^Processed Files:/i.test(s)){ const n=firstInt(s); if(n!==null) pf.textContent=String(n) }
  else if(/Renamed.*files/i.test(s)){ const n=firstInt(s); if(n!==null) rf.textContent=String(n) }
  else if(/^Renamed Files:/i.test(s)){ const n=firstInt(s); if(n!==null) rf.textContent=String(n) }
  else if(/^Replaced Strings:/i.test(s)){ const n=firstInt(s); if(n!==null) rs.textContent=String(n) }
  else if(/Failed:/i.test(s)){
    const n=firstInt(s.split(/Failed:/i)[1]||'')
    if(n!==null) fl.textContent=String(n)
  }
}
function updateStatsFromChunk(chunk){ const lines=String(chunk||'').split(/\r?\n/); for(let i=0;i<lines.length;i++){ if(lines[i].trim()) updateStatsFromLine(lines[i]) } }

function normalizeVer(v){
  return String(v||'').trim().replace(/^v/i,'')
}

async function fetchChangelog(force){
  try{
    const invoke=window.__TAURI__.core.invoke
    const raw=await invoke('fetch_release_by_tag',{ owner: GH_OWNER, repo: GH_REPO, tag: 'Release' })
    const rel=JSON.parse(raw)
    remoteVersion=(rel.name||rel.tag_name||'').trim()
    remoteCliUrl=null
    remoteUiUrl=null
    const hasUpdate=!!remoteVersion && normalizeVer(remoteVersion)!==normalizeVer(LOCAL_VERSION)
    versionBtn.textContent=hasUpdate ? (LOCAL_VERSION+' \u2192 '+remoteVersion) : LOCAL_VERSION
    versionBtn.classList.toggle('outdated',hasUpdate)
    changelogList.innerHTML=''
    const body=String(rel.body||'')
    if(body){
      const lines=body.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
      for(let i=0;i<lines.length;i++){
        const row=document.createElement('div')
        row.className='row'
        const desc=document.createElement('span')
        desc.textContent=lines[i]
        row.appendChild(desc)
        changelogList.appendChild(row)
      }
    }
    const assets=Array.isArray(rel.assets)?rel.assets:[]
    for(let i=0;i<assets.length;i++){
      const a=assets[i]
      const name=String(a.name||'')
      const url=String(a.browser_download_url||'')
      if(/ui|package|\.zip$/i.test(name)){
        remoteUiUrl=url
        const row=document.createElement('div')
        row.className='row'
        const link=document.createElement('a')
        link.href=url
        link.textContent=url
        link.target='_blank'
        const desc=document.createElement('span')
        desc.textContent=name
        row.appendChild(link)
        row.appendChild(desc)
        changelogList.appendChild(row)
      }
    }
    if(force && hasUpdate){ changelogModal.classList.remove('hidden') }
    if(force && !hasUpdate){ showMessage('Up to date!','You are on the latest release') }
  }catch(e){
    if(force){ showMessage('Update check failed','Please try again') }
  }
}
fetchChangelog()
document.getElementById('checkUpdates').addEventListener('click',()=>{ fetchChangelog(true) })

fetchFilesBtn.addEventListener('click',async()=>{
  fetchFilesBtn.disabled=true
  try{
    const invoke=window.__TAURI__.core.invoke
    const raw=await invoke('fetch_release_by_tag',{ owner: GH_OWNER, repo: GH_REPO, tag: 'CLI' })
    const rel=JSON.parse(raw)
    let cliUrl=null
    const assets=Array.isArray(rel.assets)?rel.assets:[]
    for(let i=0;i<assets.length;i++){ const a=assets[i]; const name=String(a.name||''); const url=String(a.browser_download_url||''); if(/codewalkercli|\.exe$/i.test(name)){ cliUrl=url; break } }
    if(!cliUrl){ showMessage('Fetch failed','No CLI asset found'); fetchFilesBtn.disabled=false; return }
    await invoke('download_cli',{ url: cliUrl })
    setDot(statusCli,true)
    fetchFilesBtn.classList.add('hidden')
    showMessage('CLI downloaded','CodeWalkerCLI.exe has been installed')
  }catch(e){
    showMessage('Fetch failed',String(e?.message||'Unknown'))
  }
  fetchFilesBtn.disabled=false
})

function loadRecents(){
  try{ return JSON.parse(localStorage.getItem('recentOps')||'[]') }catch{ return [] }
}
function saveRecents(list){ localStorage.setItem('recentOps',JSON.stringify(list)) }
function renderRecents(){
  recentList.innerHTML=''
  const items=loadRecents()
  for(let i=items.length-1;i>=0;i--){
    const it=items[i]
    const row=document.createElement('div')
    row.className='recent-row'
    const info=document.createElement('div')
    info.className='recent-info'
    const base=(it.inputPath||'').split(/[\\\/]/).filter(Boolean).slice(-1)[0]||it.inputPath
    const title=document.createElement('div')
    title.className='recent-title'
    title.textContent=base
    const path=document.createElement('div')
    path.className='recent-path'
    path.textContent=it.inputPath
    const sub=document.createElement('div')
    sub.className='recent-sub'
    sub.textContent=(new Date(it.ts).toLocaleString())+' • '+String(it.mode||'').toUpperCase()
    info.appendChild(title)
    info.appendChild(sub)
    info.appendChild(path)
    const acts=document.createElement('div')
    acts.className='recent-actions'
    const open=document.createElement('button')
    open.className='icon-btn sm'
    open.setAttribute('aria-label','Open Folder')
    open.innerHTML='<span class="material-symbols-outlined">folder_open</span>'
    open.addEventListener('click',()=>{
      const invoke=window.__TAURI__.core.invoke
      invoke('open_folder',{ path: it.outputPath||it.inputPath })
    })
    const rev=document.createElement('button')
    rev.className='icon-btn sm'
    rev.setAttribute('aria-label','Revert')
    rev.innerHTML='<span class="material-symbols-outlined">undo</span>'
    rev.addEventListener('click',async()=>{
      const invoke=window.__TAURI__.core.invoke
      const input=it.outputPath||it.inputPath
      const cfg={
        inputPath: input,
        outputPath: null,
        findText: it.mode==='replace'?it.replaceTarget:it.mode==='prefix'?it.prefix:it.mode==='suffix'?it.suffix:'',
        replaceText: it.mode==='replace'?it.findTarget:'',
        prefix: null,
        suffix: null,
        mode: 'replace',
        codeWalkerPath: null
      }
      try{ await invoke('run_codewalker_cli',{ config: cfg }); showMessage('Reverted','Operation reverted') }catch(e){ showMessage('Revert failed',String(e?.message||'Unknown')) }
    })
    acts.appendChild(open)
    acts.appendChild(rev)
    row.appendChild(info)
    row.appendChild(acts)
    recentList.appendChild(row)
  }
}
function setView(v){
  const showRename=v==='rename'
  const showRecent=v==='recent'
  const showQueue=v==='queue'
  panelRename.classList.toggle('hidden',!showRename)
  panelRecent.classList.toggle('hidden',!showRecent)
  panelQueue.classList.toggle('hidden',!showQueue)
}
renamerBtn.addEventListener('click',()=>{ setView('rename') })
recentBtn.addEventListener('click',()=>{ setView('recent'); renderRecents() })
queueBtn.addEventListener('click',()=>{ setView('queue'); renderQueue() })

updateBtn.addEventListener('click',async()=>{
  if(!remoteUiUrl && !remoteCliUrl){ return }
  updateBtn.disabled=true
  try{
    const invoke=window.__TAURI__.core.invoke
    if(remoteUiUrl){
      const res=await invoke('perform_update_zip',{ req: { zipUrl: remoteUiUrl } })
      showMessage('Update','Downloaded. The app will restart to apply the update.')
      try{ const w=window.__TAURI__.window.getCurrent(); if(w){ await w.close(); } }catch{}
    }else{
      const res=await invoke('perform_update',{ req: { remoteVersion: remoteVersion||LOCAL_VERSION, cliUrl: remoteCliUrl, uiUrl: remoteUiUrl||null } })
      versionBtn.classList.remove('outdated')
      changelogModal.classList.add('hidden')
      showMessage('Update','Update complete')
    }
  }catch(e){
    showMessage('Update failed',String(e?.message||'Unknown'))
  }
  updateBtn.disabled=false
})

executeBtn.addEventListener('click',async()=>{
  const inputPath=document.getElementById('inputPath').value.trim()
  const outputPath=document.getElementById('outputPath').value.trim()
  const findText=document.getElementById('findText').value.trim()
  const currentMode=mode
  const replaceText=document.getElementById('replaceText').value.trim()
  const prefix=document.getElementById('prefix').value.trim()
  const suffix=document.getElementById('suffix').value.trim()

  if(!inputPath){ showMessage('Missing fields','Please provide input path'); return }
  if(currentMode==='replace'){
    if(!findText || !replaceText){ showMessage('Missing fields','Provide find and replace text'); return }
  }else if(currentMode==='prefix'){
    if(!prefix){ showMessage('Missing fields','Provide prefix text'); return }
  }else if(currentMode==='suffix'){
    if(!suffix){ showMessage('Missing fields','Provide suffix text'); return }
  }

  setStatus('running')
  executeBtn.disabled=true
  errorsEl.innerHTML=''
  logsEl.innerHTML=''

  const payload={
    inputPath,
    outputPath:outputPath||null,
    findText,
    replaceText:currentMode==='replace'?replaceText||null:null,
    prefix:currentMode==='prefix'?prefix||null:null,
    suffix:currentMode==='suffix'?suffix||null:null,
    mode:currentMode,
    codeWalkerPath:null
  }

  const res=await runWithTauri(payload)
  if(res.ok){
    const d=res.data
    const s=d.summary||null
    const tf=document.getElementById('totalFiles')
    const pf=document.getElementById('processedFiles')
    const rf=document.getElementById('renamedFiles')
    const rs=document.getElementById('replacedStrings')
    const fl=document.getElementById('failed')
    if(s){
      tf.textContent=String(s.total_files||0)
      pf.textContent=String(s.processed_files||0)
      rf.textContent=String(s.renamed_files||0)
      rs.textContent=String(s.replaced_strings||0)
      fl.textContent=String(s.failed||0)
    }
    if(d.stderr){
      const item=document.createElement('div')
      item.className='item'
      item.textContent=d.stderr
      errorsEl.appendChild(item)
      setStatus('failed')
    }else{
      setStatus('done')
      notify('Completed')
      showMessage('Success','Successfully renamed.')
      const rec=loadRecents()
      rec.push({
        ts: Date.now(),
        inputPath,
        outputPath: outputPath||null,
        mode: currentMode,
        findTarget: findText,
        replaceTarget: currentMode==='replace'?replaceText:'',
        prefix: currentMode==='prefix'?prefix:'',
        suffix: currentMode==='suffix'?suffix:''
      })
      saveRecents(rec)
      const acts=[]
      const a1=onFinish.value
      const a2=onFinish2?onFinish2.value:'none'
      if(a1&&a1!=='none'){ acts.push({ a:a1, c:a1==='run_cmd'?(finishCmd.value||'').trim():null }) }
      if(a2&&a2!=='none'){ acts.push({ a:a2, c:a2==='run_cmd'?(finishCmd2.value||'').trim():null }) }
      const rank=(x)=>x==='run_cmd'?0:(x==='shutdown'||x==='restart'?1:(x==='close'?2:0))
      acts.sort((x,y)=>rank(x.a)-rank(y.a))
      for(let i=0;i<acts.length;i++){
        const it=acts[i]
        if(it.a==='run_cmd'){
          if(it.c){ try{ const invoke=window.__TAURI__.core.invoke; await invoke('post_action',{ req: { action: 'run_cmd', cmdline: it.c } }) }catch{} }
        }else if(it.a==='shutdown'||it.a==='restart'){
          try{ const invoke=window.__TAURI__.core.invoke; await invoke('post_action',{ req: { action: it.a, cmdline: null } }) }catch{}
        }else if(it.a==='close'){
          try{ const w=window.__TAURI__.window.getCurrent(); if(w){ await w.close() } }
          catch{ try{ const invoke=window.__TAURI__.core.invoke; await invoke('close_app') }catch{} }
        }
      }
    }
    logsEl.innerHTML=''
  }else{
    const msg=String(res.error||'Invoke failed')
    if(/CodeWalkerCLI\.exe not found/i.test(msg)){
      showActionMessage('Unable to rename. Missing CodeWalkerCLI.exe.','','Download and Reprocess',async()=>{
        try{
          const invoke=window.__TAURI__.core.invoke
          const raw=await invoke('fetch_release_by_tag',{ owner: GH_OWNER, repo: GH_REPO, tag: 'CLI' })
          const rel=JSON.parse(raw)
          let cliUrl=null
          const assets=Array.isArray(rel.assets)?rel.assets:[]
          for(let i=0;i<assets.length;i++){ const a=assets[i]; const name=String(a.name||''); const url=String(a.browser_download_url||''); if(/codewalkercli|\.exe$/i.test(name)){ cliUrl=url; break } }
          if(cliUrl){ await invoke('download_cli',{ url: cliUrl }); try{ const v=(rel.tag_name||rel.name||'').trim(); if(v) localStorage.setItem('cliVersion',v) }catch{}; messageModal.classList.add('hidden'); const again=await runWithTauri(payload); if(again.ok){ const d2=again.data; const s2=d2.summary||null; if(s2){ document.getElementById('totalFiles').textContent=String(s2.total_files||0); document.getElementById('processedFiles').textContent=String(s2.processed_files||0); document.getElementById('renamedFiles').textContent=String(s2.renamed_files||0); document.getElementById('replacedStrings').textContent=String(s2.replaced_strings||0); document.getElementById('failed').textContent=String(s2.failed||0) } setStatus('done') } else { setStatus('failed') } }
        }catch{}
      })
    }else{
      const item=document.createElement('div'); item.className='item'; item.textContent=msg; errorsEl.appendChild(item); setStatus('failed')
    }
  }

  executeBtn.disabled=false
})
const addToQueueBtn=document.getElementById('addToQueueBtn')
let editingQueueIndex=null
function loadQueue(){ try{ return JSON.parse(localStorage.getItem('renameQueue')||'[]') }catch{ return [] } }
function saveQueue(q){ localStorage.setItem('renameQueue',JSON.stringify(q)) }
function renderQueue(){
  queueList.innerHTML=''
  const q=loadQueue()
  if(!q.length){
    const empty=document.createElement('div')
    empty.className='empty-state'
    const msg=document.createElement('span')
    const link=document.createElement('span')
    msg.textContent='The queue is empty...'
    link.className='link-accent'
    link.textContent='find something to add!'
    empty.appendChild(msg)
    empty.appendChild(link)
    link.addEventListener('click',()=>{ setView('rename') })
    queueList.appendChild(empty)
    return
  }
  for(let i=0;i<q.length;i++){
    const it=q[i]
    const row=document.createElement('div')
    row.className='recent-row'
    const idx=document.createElement('div')
    idx.className='recent-index'
    idx.textContent=String(i+1)
    const info=document.createElement('div')
    info.className='recent-info'
    const title=document.createElement('div')
    title.className='recent-title'
    title.textContent=(it.inputPath||'').split(/[\\\/]/).filter(Boolean).slice(-1)[0]||it.inputPath
    const sub=document.createElement('div')
    sub.className='recent-sub'
    sub.textContent=String(it.mode||'').toUpperCase()+ (it.findText?(' • '+it.findText):'')
    const path=document.createElement('div')
    path.className='recent-path'
    path.textContent=it.inputPath
    info.appendChild(title)
    info.appendChild(sub)
    info.appendChild(path)
    const acts=document.createElement('div')
    acts.className='recent-actions'
    const up=document.createElement('button')
    up.className='icon-btn sm'
    up.innerHTML='<span class="material-symbols-outlined">arrow_upward</span>'
    up.addEventListener('click',()=>{ const q2=loadQueue(); if(i>0){ const t=q2[i-1]; q2[i-1]=q2[i]; q2[i]=t; saveQueue(q2); renderQueue() } })
    const down=document.createElement('button')
    down.className='icon-btn sm'
    down.innerHTML='<span class="material-symbols-outlined">arrow_downward</span>'
    down.addEventListener('click',()=>{ const q2=loadQueue(); if(i<q2.length-1){ const t=q2[i+1]; q2[i+1]=q2[i]; q2[i]=t; saveQueue(q2); renderQueue() } })
    const edit=document.createElement('button')
    edit.className='icon-btn sm'
    edit.innerHTML='<span class="material-symbols-outlined">edit</span>'
    edit.addEventListener('click',()=>{
      document.getElementById('inputPath').value=it.inputPath||''
      document.getElementById('outputPath').value=it.outputPath||''
      document.getElementById('findText').value=it.findText||''
      document.getElementById('replaceText').value=it.replaceText||''
      document.getElementById('prefix').value=it.prefix||''
      document.getElementById('suffix').value=it.suffix||''
      mode=it.mode||'replace'
      segment.querySelectorAll('button').forEach(b=>{ b.classList.toggle('active',b.getAttribute('data-mode')===mode) })
      updateMode(); setView('rename'); editingQueueIndex=i; addToQueueBtn.textContent='Remove & Readd'
    })
    const del=document.createElement('button')
    del.className='icon-btn sm'
    del.innerHTML='<span class="material-symbols-outlined">delete</span>'
    del.addEventListener('click',()=>{ const q2=loadQueue(); q2.splice(i,1); saveQueue(q2); renderQueue() })
    acts.appendChild(up)
    acts.appendChild(down)
    acts.appendChild(edit)
    acts.appendChild(del)
    row.appendChild(idx)
    row.appendChild(info)
    row.appendChild(acts)
    queueList.appendChild(row)
  }
}
function loadQueueFinished(){ try{ return JSON.parse(localStorage.getItem('renameQueueFinished')||'[]') }catch{ return [] } }
function saveQueueFinished(v){ localStorage.setItem('renameQueueFinished',JSON.stringify(v)) }
function renderQueueFinished(){
  queueFinishedList.innerHTML=''
  const items=loadQueueFinished()
  finishedSection.classList.toggle('hidden',items.length===0)
  for(let i=items.length-1;i>=0;i--){
    const it=items[i]
    const row=document.createElement('div')
    row.className='recent-row'
    const info=document.createElement('div')
    info.className='recent-info'
    const title=document.createElement('div')
    title.className='recent-title'
    title.textContent=(it.inputPath||'').split(/[\\\/]/).filter(Boolean).slice(-1)[0]||it.inputPath
    const sub=document.createElement('div')
    sub.className='recent-sub'
    sub.textContent=(new Date(it.ts).toLocaleString())+' • '+String(it.mode||'').toUpperCase()
    const path=document.createElement('div')
    path.className='recent-path'
    path.textContent=it.inputPath
    info.appendChild(title)
    info.appendChild(sub)
    info.appendChild(path)
    const acts=document.createElement('div')
    acts.className='recent-actions'
    const open=document.createElement('button')
    open.className='icon-btn sm'
    open.innerHTML='<span class="material-symbols-outlined">folder_open</span>'
    open.addEventListener('click',()=>{ const invoke=window.__TAURI__.core.invoke; invoke('open_folder',{ path: it.outputPath||it.inputPath }) })
    const rev=document.createElement('button')
    rev.className='icon-btn sm'
    rev.innerHTML='<span class="material-symbols-outlined">undo</span>'
    rev.addEventListener('click',async()=>{
      const invoke=window.__TAURI__.core.invoke
      const input=it.outputPath||it.inputPath
      const cfg={ inputPath: input, outputPath: null, findText: it.mode==='replace'?it.replaceTarget:it.mode==='prefix'?it.prefix:it.mode==='suffix'?it.suffix:'', replaceText: it.mode==='replace'?it.findTarget:'', prefix: null, suffix: null, mode: 'replace', codeWalkerPath: null }
      try{ await invoke('run_codewalker_cli',{ config: cfg }); showMessage('Reverted','Operation reverted') }catch(e){ showMessage('Revert failed',String(e?.message||'Unknown')) }
    })
    acts.appendChild(open)
    acts.appendChild(rev)
    row.appendChild(info)
    row.appendChild(acts)
    queueFinishedList.appendChild(row)
  }
}
let queueRunning=false
async function startQueue(){
  if(queueRunning) return
  let q=loadQueue()
  if(!q.length){ showMessage('Queue empty','Add items to the queue'); return }
  queueRunning=true
  startQueueBtn.disabled=true
  pauseQueueBtn.classList.remove('hidden')
  pauseQueueBtn.disabled=false
  let queuePaused=false
  pauseQueueBtn.onclick=()=>{ queuePaused=true; pauseQueueBtn.disabled=true }
  runningSection.classList.remove('hidden')
  while(q.length){
    const it=q[0]
    queueCurrent.classList.remove('hidden')
    queueCurrent.innerHTML=''
    const info=document.createElement('div')
    info.className='recent-info'
    const title=document.createElement('div')
    title.className='recent-title'
    title.textContent=(it.inputPath||'').split(/[\\\/]/).filter(Boolean).slice(-1)[0]||it.inputPath
    const sub=document.createElement('div')
    sub.className='recent-sub'
    sub.textContent='Running • '+String(it.mode||'').toUpperCase()
    const path=document.createElement('div')
    path.className='recent-path'
    path.textContent=it.inputPath
    info.appendChild(title)
    info.appendChild(sub)
    info.appendChild(path)
    queueCurrent.appendChild(info)
    try{
      const invoke=window.__TAURI__.core.invoke
      const cfg={ inputPath: it.inputPath, outputPath: it.outputPath, findText: it.findText, replaceText: it.mode==='replace'?(it.replaceText||''):'', prefix: it.mode==='prefix'?(it.prefix||''):null, suffix: it.mode==='suffix'?(it.suffix||''):null, mode: it.mode||'replace', codeWalkerPath: null }
      await invoke('run_codewalker_cli',{ config: cfg })
      const done={ ts: Date.now(), inputPath: it.inputPath, outputPath: it.outputPath||null, mode: it.mode, findTarget: it.findText, replaceTarget: it.mode==='replace'?(it.replaceText||''):'', prefix: it.mode==='prefix'?(it.prefix||''):'', suffix: it.mode==='suffix'?(it.suffix||''):'' }
      const fin=loadQueueFinished(); fin.push(done); saveQueueFinished(fin); renderQueueFinished()
      const rec=loadRecents(); rec.push(done); saveRecents(rec)
      q.shift(); saveQueue(q)
    }catch(e){ showMessage('Queue error',String(e?.message||'Unknown')) }
    if(queuePaused) break
  }
  const acts=collectQueueFinishActions()
  for(let i=0;i<acts.length;i++){
    const it=acts[i]
    try{
      const invoke=window.__TAURI__.core.invoke
      if(it.a==='run_cmd'){ if(it.c){ await invoke('post_action',{ req:{ action:'run_cmd', cmdline: it.c } }) } }
      else{ await invoke('post_action',{ req:{ action: it.a, cmdline: null } }) }
    }catch{}
  }
  if(!q.length) notify('Completed')
  renderQueue(); queueCurrent.classList.add('hidden'); startQueueBtn.disabled=false; queueRunning=false
  runningSection.classList.add('hidden')
  pauseQueueBtn.classList.add('hidden')
}
startQueueBtn.addEventListener('click',startQueue)
clearQueueBtn.addEventListener('click',()=>{ saveQueue([]); renderQueue(); showMessage('Queue cleared','All items removed') })
renderQueueFinished()
addToQueueBtn.addEventListener('click',()=>{
  const inputPath=document.getElementById('inputPath').value.trim()
  const outputPath=document.getElementById('outputPath').value.trim()
  const findText=document.getElementById('findText').value.trim()
  const currentMode=mode
  const replaceText=document.getElementById('replaceText').value.trim()
  const prefix=document.getElementById('prefix').value.trim()
  const suffix=document.getElementById('suffix').value.trim()
  if(!inputPath){ showMessage('Missing fields','Please provide input path'); return }
  if(currentMode==='replace'){
    if(!findText || !replaceText){ showMessage('Missing fields','Provide find and replace text'); return }
  }else if(currentMode==='prefix'){
    if(!prefix){ showMessage('Missing fields','Provide prefix text'); return }
  }else if(currentMode==='suffix'){
    if(!suffix){ showMessage('Missing fields','Provide suffix text'); return }
  }
  const q=loadQueue()
  const item={ inputPath, outputPath:outputPath||null, findText, mode:currentMode, replaceText:currentMode==='replace'?replaceText||'':null, prefix:currentMode==='prefix'?prefix||'':null, suffix:currentMode==='suffix'?suffix||'':null }
  if(editingQueueIndex!==null){ q.splice(editingQueueIndex,1); q.push(item); editingQueueIndex=null; addToQueueBtn.textContent='Add to Queue'; showMessage('Queued','Removed & readded to queue') }
  else{ q.push(item); showMessage('Queued','Added to queue') }
  saveQueue(q); setView('queue'); renderQueue()
})
const resultsPanel=document.getElementById('resultsPanel')
const resultsToggle=document.getElementById('resultsToggle')
const resultsBarToggle=document.getElementById('resultsBarToggle')
const appEl=document.querySelector('.app')
function applyResultsClosed(closed){
  appEl.classList.toggle('results-closed',closed)
  const icon=closed?'chevron_left':'chevron_right'
  resultsToggle.innerHTML='<span class="material-symbols-outlined">'+icon+'</span>'
  resultsBarToggle.innerHTML='<span class="material-symbols-outlined">'+icon+'</span>'
  localStorage.setItem('resultsClosed',closed?'1':'0')
}
const initClosed=(localStorage.getItem('resultsClosed')||'0')==='1'
applyResultsClosed(initClosed)
resultsToggle.addEventListener('click',()=>{ const closed=appEl.classList.contains('results-closed'); applyResultsClosed(!closed) })
resultsBarToggle.addEventListener('click',()=>{ const closed=appEl.classList.contains('results-closed'); applyResultsClosed(!closed) })

const renameWithLogsBtn=document.getElementById('renameWithLogsBtn')
const inlineLogs=document.getElementById('inlineLogs')
renameWithLogsBtn.addEventListener('click',async()=>{
  const inputPath=document.getElementById('inputPath').value.trim()
  const outputPath=document.getElementById('outputPath').value.trim()
  const findText=document.getElementById('findText').value.trim()
  const currentMode=mode
  const replaceText=document.getElementById('replaceText').value.trim()
  const prefix=document.getElementById('prefix').value.trim()
  const suffix=document.getElementById('suffix').value.trim()
  if(!inputPath||!findText){ showMessage('Missing fields','Please provide input path and find text'); return }
  inlineLogs.classList.remove('hidden')
  closeInlineLogs.classList.remove('hidden')
  inlineLogs.textContent=''
  setStatus('running')
  executeBtn.disabled=true
  errorsEl.innerHTML=''
  logsEl.innerHTML=''
  applyResultsClosed(false)
  const payload={ inputPath, outputPath:outputPath||null, findText, replaceText:currentMode==='replace'?replaceText||null:null, prefix:currentMode==='prefix'?prefix||null:null, suffix:currentMode==='suffix'?suffix||null:null, mode:currentMode, codeWalkerPath:null }
  const res=await runStreamWithTauri(payload,(msg)=>{ inlineLogs.textContent+=msg; inlineLogs.scrollTop=inlineLogs.scrollHeight; updateStatsFromChunk(msg) })
  if(res.ok){
    const d=res.data
    if(d.stderr){ const item=document.createElement('div'); item.className='item'; item.textContent=d.stderr; errorsEl.appendChild(item); setStatus('failed') } else { setStatus('done'); notify('Completed') }
  }else{
    const msg=String(res.error||'Invoke failed')
    if(/CodeWalkerCLI\.exe not found/i.test(msg)){
      showActionMessage('Unable to rename. Missing CodeWalkerCLI.exe.','','Download and Reprocess',async()=>{
        try{
          const invoke=window.__TAURI__.core.invoke
          const raw=await invoke('fetch_release_by_tag',{ owner: GH_OWNER, repo: GH_REPO, tag: 'CLI' })
          const rel=JSON.parse(raw)
          let cliUrl=null
          const assets=Array.isArray(rel.assets)?rel.assets:[]
          for(let i=0;i<assets.length;i++){ const a=assets[i]; const name=String(a.name||''); const url=String(a.browser_download_url||''); if(/codewalkercli|\.exe$/i.test(name)){ cliUrl=url; break } }
          if(cliUrl){ await invoke('download_cli',{ url: cliUrl }); try{ const v=(rel.tag_name||rel.name||'').trim(); if(v) localStorage.setItem('cliVersion',v) }catch{}; messageModal.classList.add('hidden'); const again=await runStreamWithTauri(payload,(m)=>{ inlineLogs.textContent+=m; inlineLogs.scrollTop=inlineLogs.scrollHeight; updateStatsFromChunk(m) }); if(again.ok){ setStatus('done') } else { setStatus('failed') } }
        }catch{}
      })
    }else{
      const item=document.createElement('div'); item.className='item'; item.textContent=msg; errorsEl.appendChild(item); setStatus('failed')
    }
  }
  executeBtn.disabled=false
})

closeInlineLogs.addEventListener('click',()=>{ inlineLogs.classList.add('hidden'); inlineLogs.textContent=''; closeInlineLogs.classList.add('hidden') })

async function startQueueWithLogs(){
  if(queueRunning) return
  let q=loadQueue()
  if(!q.length){ showMessage('Queue empty','Add items to the queue'); return }
  queueRunning=true
  startQueueLogsBtn.disabled=true
  runningSection.classList.remove('hidden')
  queueInlineLogs.classList.remove('hidden')
  closeQueueInlineLogs.classList.remove('hidden')
  queueInlineLogs.textContent=''
  applyResultsClosed(false)
  pauseQueueBtn.classList.remove('hidden')
  pauseQueueBtn.disabled=false
  let queuePaused=false
  pauseQueueBtn.onclick=()=>{ queuePaused=true; pauseQueueBtn.disabled=true }
  while(q.length){
    const it=q[0]
    queueCurrent.classList.remove('hidden')
    queueCurrent.innerHTML=''
    const info=document.createElement('div')
    info.className='recent-info'
    const title=document.createElement('div')
    title.className='recent-title'
    title.textContent=(it.inputPath||'').split(/[\\\/]/).filter(Boolean).slice(-1)[0]||it.inputPath
    const sub=document.createElement('div')
    sub.className='recent-sub'
    sub.textContent='Running • '+String(it.mode||'').toUpperCase()
    const path=document.createElement('div')
    path.className='recent-path'
    path.textContent=it.inputPath
    info.appendChild(title)
    info.appendChild(sub)
    info.appendChild(path)
    queueCurrent.appendChild(info)
    try{
      const cfg={ inputPath: it.inputPath, outputPath: it.outputPath, findText: it.findText, replaceText: it.mode==='replace'?(it.replaceText||''):'', prefix: it.mode==='prefix'?(it.prefix||''):null, suffix: it.mode==='suffix'?(it.suffix||''):null, mode: it.mode||'replace', codeWalkerPath: null }
      const res=await runStreamWithTauri(cfg,(msg)=>{ queueInlineLogs.textContent+=msg; queueInlineLogs.scrollTop=queueInlineLogs.scrollHeight; updateStatsFromChunk(msg) })
      if(res.ok){
        const done={ ts: Date.now(), inputPath: it.inputPath, outputPath: it.outputPath||null, mode: it.mode, findTarget: it.findText, replaceTarget: it.mode==='replace'?(it.replaceText||''):'', prefix: it.mode==='prefix'?(it.prefix||''):'', suffix: it.mode==='suffix'?(it.suffix||''):'' }
        const fin=loadQueueFinished(); fin.push(done); saveQueueFinished(fin); renderQueueFinished()
        const rec=loadRecents(); rec.push(done); saveRecents(rec)
        queueInlineLogs.textContent+='\n'
        q.shift(); saveQueue(q)
      }else{
        const emsg=String(res.error||'Invoke failed')
        if(/CodeWalkerCLI\.exe not found/i.test(emsg)){
          showActionMessage('Unable to run queue. Missing CodeWalkerCLI.exe.','','Download and Reprocess',async()=>{
            try{
              const invoke=window.__TAURI__.core.invoke
              const raw=await invoke('fetch_release_by_tag',{ owner: GH_OWNER, repo: GH_REPO, tag: 'CLI' })
              const rel=JSON.parse(raw)
              let cliUrl=null
              const assets=Array.isArray(rel.assets)?rel.assets:[]
              for(let j=0;j<assets.length;j++){ const a=assets[j]; const name=String(a.name||''); const url=String(a.browser_download_url||''); if(/codewalkercli|\.exe$/i.test(name)){ cliUrl=url; break } }
              if(cliUrl){ await invoke('download_cli',{ url: cliUrl }); try{ const v=(rel.tag_name||rel.name||'').trim(); if(v) localStorage.setItem('cliVersion',v) }catch{}; messageModal.classList.add('hidden'); const again=await runStreamWithTauri(cfg,(m)=>{ queueInlineLogs.textContent+=m; queueInlineLogs.scrollTop=queueInlineLogs.scrollHeight; updateStatsFromChunk(m) }); if(again.ok){ const done2={ ts: Date.now(), inputPath: it.inputPath, outputPath: it.outputPath||null, mode: it.mode, findTarget: it.findText, replaceTarget: it.mode==='replace'?(it.replaceText||''):'', prefix: it.mode==='prefix'?(it.prefix||''):'', suffix: it.mode==='suffix'?(it.suffix||''):'' }; const fin2=loadQueueFinished(); fin2.push(done2); saveQueueFinished(fin2); renderQueueFinished(); const rec2=loadRecents(); rec2.push(done2); saveRecents(rec2) }
              }
            }catch{}
          })
        }else{
          showMessage('Queue error',emsg)
        }
      }
    }catch(e){
      const emsg=String(e?.message||'Unknown')
      if(/CodeWalkerCLI\.exe not found/i.test(emsg)){
        showActionMessage('Unable to run queue. Missing CodeWalkerCLI.exe.','','Download and Reprocess',async()=>{
          try{
            const invoke=window.__TAURI__.core.invoke
            const raw=await invoke('fetch_release_by_tag',{ owner: GH_OWNER, repo: GH_REPO, tag: 'CLI' })
            const rel=JSON.parse(raw)
            let cliUrl=null
            const assets=Array.isArray(rel.assets)?rel.assets:[]
            for(let j=0;j<assets.length;j++){ const a=assets[j]; const name=String(a.name||''); const url=String(a.browser_download_url||''); if(/codewalkercli|\.exe$/i.test(name)){ cliUrl=url; break } }
            if(cliUrl){ await invoke('download_cli',{ url: cliUrl }); try{ const v=(rel.tag_name||rel.name||'').trim(); if(v) localStorage.setItem('cliVersion',v) }catch{}; messageModal.classList.add('hidden'); try{ const again=await window.__TAURI__.core.invoke('run_codewalker_cli',{ config: cfg }); const done={ ts: Date.now(), inputPath: it.inputPath, outputPath: it.outputPath||null, mode: it.mode, findTarget: it.findText, replaceTarget: it.mode==='replace'?(it.replaceText||''):'', prefix: it.mode==='prefix'?(it.prefix||''):'', suffix: it.mode==='suffix'?(it.suffix||''):'' }; const fin=loadQueueFinished(); fin.push(done); saveQueueFinished(fin); renderQueueFinished(); const rec=loadRecents(); rec.push(done); saveRecents(rec) }catch{}
            }
          }catch{}
        })
      }else{
        showMessage('Queue error',emsg)
      }
    }
    if(queuePaused) break
  }
  const acts2=collectQueueFinishActions()
  for(let i=0;i<acts2.length;i++){
    const it=acts2[i]
    try{
      const invoke=window.__TAURI__.core.invoke
      if(it.a==='run_cmd'){ if(it.c){ await invoke('post_action',{ req:{ action:'run_cmd', cmdline: it.c } }) } }
      else{ await invoke('post_action',{ req:{ action: it.a, cmdline: null } }) }
    }catch{}
  }
  if(!q.length) notify('Completed')
  renderQueue(); queueCurrent.classList.add('hidden'); startQueueLogsBtn.disabled=false; queueRunning=false
  runningSection.classList.add('hidden')
  pauseQueueBtn.classList.add('hidden')
}
startQueueLogsBtn.addEventListener('click',startQueueWithLogs)
closeQueueInlineLogs.addEventListener('click',()=>{ queueInlineLogs.classList.add('hidden'); queueInlineLogs.textContent=''; closeQueueInlineLogs.classList.add('hidden') })
clearFinishedBtn.addEventListener('click',()=>{ saveQueueFinished([]); renderQueueFinished() })
function collectQueueFinishActions(){
  const a1=onFinishQ.value
  const a2=onFinishQ2?onFinishQ2.value:'none'
  const arr=[]
  if(a1&&a1!=='none'){ arr.push({ a:a1, c:a1==='run_cmd'?(finishCmdQ.value||'').trim():null }) }
  if(a2&&a2!=='none'){ arr.push({ a:a2, c:a2==='run_cmd'?(finishCmdQ2.value||'').trim():null }) }
  return arr
}
if(onFinishQ){
  onFinishQ.addEventListener('change',()=>{
    const v=onFinishQ.value
    finishCmdFieldQ.classList.toggle('hidden',v!=='run_cmd')
    const r=document.getElementById('onFinishQ2Row')
    addFinishBtnQ.classList.toggle('hidden',v==='none' || !r.classList.contains('hidden'))
    if(onFinishQ2){
      Array.from(onFinishQ.options).forEach((opt)=>{
        opt.disabled=false
        if(onFinishQ2.value && opt.value===onFinishQ2.value){ opt.disabled=true }
      })
      Array.from(onFinishQ2.options).forEach((opt)=>{
        opt.disabled=false
        if(onFinishQ.value && opt.value===onFinishQ.value){ opt.disabled=true }
      })
    }
  })
  addFinishBtnQ.addEventListener('click',()=>{
    const r=document.getElementById('onFinishQ2Row')
    r.classList.remove('hidden')
    addFinishBtnQ.classList.add('hidden')
  })
  document.getElementById('removeFinishBtnQ').addEventListener('click',()=>{
    const r=document.getElementById('onFinishQ2Row')
    r.classList.add('hidden')
    if(onFinishQ2){ onFinishQ2.value='none' }
    finishCmdFieldQ2.classList.add('hidden')
    addFinishBtnQ.classList.toggle('hidden',onFinishQ.value==='none')
  })
}
if(onFinishQ2){
  onFinishQ2.addEventListener('change',()=>{
    const v=onFinishQ2.value
    finishCmdFieldQ2.classList.toggle('hidden',v!=='run_cmd')
    Array.from(onFinishQ.options).forEach((opt)=>{
      opt.disabled=false
      if(onFinishQ2.value && opt.value===onFinishQ2.value){ opt.disabled=true }
    })
    Array.from(onFinishQ2.options).forEach((opt)=>{
      opt.disabled=false
      if(onFinishQ.value && opt.value===onFinishQ.value){ opt.disabled=true }
    })
  })
}
