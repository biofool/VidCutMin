'use strict';
// VidCutMin core — state, timeline, playback, export
const S = {url:null, name:null, dur:0, cuts:[], active:null, mi:null, mo:null, drag:null, playAll:null, rec:null};
let cutN = 0;
const COLS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
const $ = id => document.getElementById(id);
const vid = $('vid'), tl = $('tl'), ctx = tl.getContext('2d');
const TLP = 8;

const fmt = s => (isNaN(s)||s==null) ? '--:--' :
  (s>=3600 ? Math.floor(s/3600)+':'+String(Math.floor(s%3600/60)).padStart(2,'0') : Math.floor(s/60))+':'+(s%60).toFixed(2).padStart(5,'0');
const fmts = s => { s=Math.max(0,s||0); return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'); };
const parse = v => { const p=String(v).trim().split(':').map(Number); if(p.some(isNaN)) return NaN;
  return p.reduce((a,b)=>a*60+b,0); };
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const activeCut = () => S.cuts.find(c=>c.id===S.active) || null;
const col = i => COLS[i%COLS.length];
const status = m => $('status').textContent = m;

// ---------- media ----------
function loadFile(file){
  if(S.url) URL.revokeObjectURL(S.url);
  S.url = URL.createObjectURL(file); S.name = file.name;
  vid.src = S.url; vid.load();
  $('stage').classList.add('filled');
  $('media-info').textContent = file.name + ' · ' + (file.size/1048576).toFixed(1) + ' MB';
}
vid.addEventListener('loadedmetadata', () => { S.dur = vid.duration; drawTL(); });
vid.addEventListener('timeupdate', () => {
  if(S.playAll){
    const c = S.playAll.list[S.playAll.i];
    if(vid.currentTime >= c.end - 0.03){ nextInSeq(); }
  }
});
vid.addEventListener('ended', () => { if(S.playAll) nextInSeq(); });

$('btn-open').onclick = () => $('file-input').click();
$('file-input').onchange = e => e.target.files[0] && loadFile(e.target.files[0]);
const stage = $('stage');
['dragover','dragleave','drop'].forEach(ev => document.addEventListener(ev, e => {
  e.preventDefault();
  stage.classList.toggle('dragover', ev==='dragover');
  if(ev==='drop' && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
}));

// ---------- cuts ----------
function newCut(st,en){
  const c = {id:++cutN, name:'Cut '+cutN, start:st, end:en, fadeIn:0, fadeOut:0, vol:1, cap:''};
  S.cuts.push(c); S.active = c.id; renderCuts(); drawTL(); bindSettings();
}
$('btn-addcut').onclick = () => { if(!S.dur) return; const t=vid.currentTime;
  newCut(t, clamp(t+Math.min(30,S.dur-t), 0, S.dur)); };
$('btn-markcut').onclick = () => {
  if(S.mi==null||S.mo==null){ status('Mark In and Out first'); return; }
  newCut(Math.min(S.mi,S.mo), Math.max(S.mi,S.mo)); S.mi=S.mo=null; updMarks(); };
$('btn-in').onclick = () => { S.mi=vid.currentTime; updMarks(); drawTL(); };
$('btn-out').onclick = () => { S.mo=vid.currentTime; updMarks(); drawTL(); };
function updMarks(){ $('mi-disp').textContent = fmt(S.mi); $('mo-disp').textContent = fmt(S.mo); }

function delCut(id){ S.cuts = S.cuts.filter(c=>c.id!==id);
  if(S.active===id){ S.active = S.cuts[0]?.id ?? null; bindSettings(); }
  renderCuts(); drawTL(); }
function selCut(id){ S.active=id; renderCuts(); bindSettings();
  const c=activeCut(); if(c) vid.currentTime=c.start; }

function renderCuts(){
  const el = $('cuts-list');
  if(!S.cuts.length){ el.innerHTML='<div class="empty">No cuts yet</div>'; return; }
  el.innerHTML = S.cuts.map((c,i)=>
    `<div class="cut-item${c.id===S.active?' active':''}" data-id="${c.id}">
      <span class="cut-dot" style="background:${col(i)}"></span>
      <div style="flex:1;min-width:0">
        <div class="cut-name">${esc(c.name)}</div>
        <div class="cut-times">${fmt(c.start)} → ${fmt(c.end)} <span class="dim">(${fmt(c.end-c.start)})</span></div>
      </div>
      <button class="cut-del" data-del="${c.id}" title="Delete cut">✕</button>
    </div>`).join('');
}
$('cuts-list').addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if(del){ delCut(+del.dataset.del); return; }
  const it = e.target.closest('.cut-item');
  if(it) selCut(+it.dataset.id);
});

// ---------- settings panel ----------
const F = {name:'s-name', start:'s-start', end:'s-end', fadeIn:'s-fadein', fadeOut:'s-fadeout', vol:'s-vol', cap:'s-cap'};
function bindSettings(){
  const c = activeCut();
  for(const k in F){ $(F[k]).disabled = !c; }
  if(!c){ for(const k in F) $(F[k]).value=''; return; }
  $('s-name').value=c.name; $('s-start').value=fmt(c.start); $('s-end').value=fmt(c.end);
  $('s-fadein').value=c.fadeIn; $('s-fadeout').value=c.fadeOut; $('s-vol').value=c.vol; $('s-cap').value=c.cap;
}
for(const k in F){
  $(F[k]).addEventListener('change', e => {
    const c = activeCut(); if(!c) return;
    if(k==='start'||k==='end'){
      const v = parse(e.target.value);
      if(isNaN(v)||v<0){ e.target.value=fmt(c[k]); return; }
      c[k]=clamp(v,0,S.dur);
      if(c.end<=c.start){ k==='start' ? c.end=clamp(c.start+1,0,S.dur) : c.start=clamp(c.end-1,0,S.dur); }
      e.target.value=fmt(c[k]); drawTL();
    } else if(k==='vol'||k==='fadeIn'||k==='fadeOut'){ c[k]=+e.target.value||0; }
    else c[k]=e.target.value;
    renderCuts();
  });
}

// ---------- timeline ----------
function t2x(t){ const W=tl.width; return TLP + (t/(S.dur||1))*(W-TLP*2); }
function x2t(x){ const r=tl.getBoundingClientRect(); return clamp(((x-r.left-TLP)/(r.width-TLP*2))*S.dur,0,S.dur); }
function drawTL(){
  const W = tl.width = tl.parentElement.clientWidth - 4, H = 56, dur=S.dur||1;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='rgba(128,128,128,.25)'; ctx.fillRect(TLP,20,W-TLP*2,16);
  const step = dur>300?60:dur>60?10:5;
  ctx.font='9px system-ui'; ctx.textAlign='center';
  for(let t=0;t<=dur;t+=step){ const x=t2x(t);
    ctx.fillStyle='rgba(128,128,128,.5)'; ctx.fillRect(x,18,1,4);
    ctx.fillText(fmts(t),x,12); }
  S.cuts.forEach((c,i)=>{ const x1=t2x(c.start),x2=t2x(c.end),act=c.id===S.active,cc=col(i);
    ctx.fillStyle=cc+(act?'cc':'66'); ctx.fillRect(x1,20,x2-x1,16);
    ctx.fillStyle=cc; ctx.fillRect(x1-2,18,4,20); ctx.fillRect(x2-2,18,4,20);
    if(x2-x1>34){ ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--tx')||'#fff';
      ctx.textAlign='left'; ctx.fillText(c.name,x1+5,32); ctx.textAlign='center'; } });
  if(S.mi!=null){ vline(S.mi,'#4ade80'); }
  if(S.mo!=null){ vline(S.mo,'#f87171'); }
  drawPlayhead();
  $('tl-s').textContent=fmts(0); $('tl-m').textContent=fmts(dur/2); $('tl-e').textContent=fmts(dur);
}
function vline(t,c){ const x=t2x(t); ctx.strokeStyle=c; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x,14); ctx.lineTo(x,40); ctx.stroke(); }
function drawPlayhead(){
  if(!tl.width) return;
  const x = t2x(vid.currentTime||0);
  ctx.strokeStyle='#fff'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(x,8); ctx.lineTo(x,44); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x,8,3.5,0,7); ctx.fill();
}
// redraw whole TL on playhead move so old playhead doesn't smear
let lastPH = 0;
vid.addEventListener('timeupdate', () => { const t=vid.currentTime;
  if(Math.abs(t-lastPH)>0.08){ lastPH=t; drawTL(); } });
window.addEventListener('resize', drawTL);

tl.addEventListener('mousedown', e => {
  const t = x2t(e.clientX), pps = (tl.getBoundingClientRect().width-TLP*2)/(S.dur||1);
  for(const c of S.cuts){
    if(Math.abs(t-c.end)*pps < 6){ S.drag={id:c.id,h:'end'}; return selCut(c.id); }
    if(Math.abs(t-c.start)*pps < 6){ S.drag={id:c.id,h:'start'}; return selCut(c.id); }
    if(t>=c.start && t<=c.end){ S.drag={id:c.id,h:'body',t0:t,s:c.start,e:c.end}; return selCut(c.id); }
  }
  vid.currentTime = t;
});
window.addEventListener('mousemove', e => {
  if(!S.drag) return;
  const c = S.cuts.find(x=>x.id===S.drag.id); if(!c) return;
  const t = x2t(e.clientX);
  if(S.drag.h==='start') c.start = clamp(t,0,c.end-.2);
  else if(S.drag.h==='end') c.end = clamp(t,c.start+.2,S.dur);
  else { const len=S.drag.e-S.drag.s; c.start=clamp(S.drag.s+(t-S.drag.t0),0,S.dur-len); c.end=c.start+len; }
  renderCuts(); drawTL(); bindSettings();
});
window.addEventListener('mouseup', () => S.drag=null);

// ---------- transport ----------
$('btn-jump').onclick = () => { const t=parse($('jump-input').value);
  if(isNaN(t)||!S.dur) return; vid.currentTime=clamp(t,0,S.dur); $('jump-input').value=''; };
$('jump-input').addEventListener('keydown', e => { if(e.key==='Enter') $('btn-jump').click(); });

document.addEventListener('keydown', e => {
  if(e.target.matches('input,textarea,select')) return;
  if(e.code==='Space'){ e.preventDefault(); vid.paused?vid.play():vid.pause(); }
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
    e.preventDefault(); vid.currentTime=clamp(vid.currentTime+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?5:1/30),0,S.dur); }
  else if(e.key==='i'||e.key==='I') $('btn-in').click();
  else if(e.key==='o'||e.key==='O') $('btn-out').click();
  else if(e.key==='n'||e.key==='N') $('btn-addcut').click();
  else if(e.key==='Delete'&&S.active!=null) delCut(S.active);
});

// ---------- playback of full sequence ----------
$('btn-playall').onclick = () => {
  if(S.playAll){ S.playAll=null; vid.pause(); status(''); return; }
  if(!S.cuts.length){ status('No cuts'); return; }
  S.playAll = {list:[...S.cuts].sort((a,b)=>a.start-b.start), i:0};
  playSeqItem();
};
function playSeqItem(){
  const c = S.playAll.list[S.playAll.i];
  selCut(c.id); vid.volume = c.vol; vid.currentTime = c.start; vid.play();
  status(`Playing ${S.playAll.i+1}/${S.playAll.list.length}: ${c.name}`);
}
function nextInSeq(){
  if(++S.playAll.i < S.playAll.list.length) playSeqItem();
  else { S.playAll=null; vid.pause(); vid.volume=1; status('Sequence done'); }
}

// ---------- export ----------
function download(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
}
$('btn-edl').onclick = () => {
  const edl = {source:S.name, duration:S.dur,
    cuts:S.cuts.map(c=>({name:c.name,start:c.start,end:c.end,fadeIn:c.fadeIn,fadeOut:c.fadeOut,vol:c.vol,caption:c.cap}))};
  download(new Blob([JSON.stringify(edl,null,2)],{type:'application/json'}),(S.name||'edit')+'.edl.json');
  // also ffmpeg concat script for lossless-ish render
  const ff = ['# ffmpeg render script','# usage: bash render.sh',`INPUT="${S.name||'input.mp4'}"`,
    'FILTER='+S.cuts.map((c,i)=>`[0:v]trim=${c.start}:${c.end},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${c.start}:${c.end},asetpts=PTS-STARTPTS[a${i}];`).join('\\\n  '),
    '  '+S.cuts.map((c,i)=>`[v${i}][a${i}]`).join('')+`concat=n=${S.cuts.length}:v=1:a=1[v][a]`,
    `ffmpeg -i "$INPUT" -filter_complex "$FILTER" -map "[v]" -map "[a]" output.mp4`].join('\n');
  download(new Blob([ff],{type:'text/x-sh'}),'render.sh');
};

// MediaRecorder render: plays each cut through a canvas + audio graph
$('btn-render').onclick = async () => {
  if(!S.cuts.length){ status('No cuts to render'); return; }
  if(!('captureStream' in vid) || !('MediaRecorder' in window)){ status('MediaRecorder not supported'); return; }
  const cv = document.createElement('canvas');
  cv.width = vid.videoWidth||1280; cv.height = vid.videoHeight||720;
  const cx = cv.getContext('2d');
  const cs = cv.captureStream(30);
  const actx = new AudioContext(), src = actx.createMediaElementSource(vid),
    gain = actx.createGain(), dest = actx.createMediaStreamDestination();
  src.connect(gain); gain.connect(dest); gain.connect(actx.destination);
  cs.addTrack(dest.stream.getAudioTracks()[0]);
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
  const rec = new MediaRecorder(cs, {mimeType:mime, videoBitsPerSecond:8e6});
  const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
  rec.onstop = () => {
    download(new Blob(chunks,{type:'video/webm'}),'vidcutmin.webm');
    src.disconnect(); actx.close(); status('Rendered vidcutmin.webm');
  };
  const list = [...S.cuts].sort((a,b)=>a.start-b.start);
  status('Rendering… do not navigate away');
  rec.start(500);
  let raf;
  const paint = () => {
    cx.fillStyle='#000'; cx.fillRect(0,0,cv.width,cv.height);
    cx.drawImage(vid,0,0,cv.width,cv.height);
    raf = requestAnimationFrame(paint);
  };
  paint();
  for(const c of list){
    vid.currentTime = c.start; gain.gain.value = c.vol;
    await vid.play();
    await new Promise(res => {
      const chk = () => vid.currentTime >= c.end - 0.04 ? res() : setTimeout(chk,40); chk();
    });
    vid.pause();
  }
  cancelAnimationFrame(raf); rec.stop();
};

// ---------- skins ----------
const skinSel = $('skin-select');
function setSkin(s){ document.documentElement.dataset.skin = s;
  $('skin-css').href = `css/skins/${s}.css`; localStorage.setItem('vcm-skin',s); drawTL(); }
skinSel.onchange = e => setSkin(e.target.value);
skinSel.value = localStorage.getItem('vcm-skin') || 'snapcut';
setSkin(skinSel.value);
