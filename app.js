// XRP Paper Desk UI — PAPER ONLY. Public read-only price data; nothing is ever sent to an exchange.
const $=id=>document.getElementById(id), LS=localStorage;
const load=(k,d)=>{try{return JSON.parse(LS.getItem(k))??d}catch{return d}}, save=(k,v)=>LS.setItem(k,JSON.stringify(v));
XL.setConfig(load('knobs',{}));
let S=load('state',{nav:XL.getConfig().bankroll,pos:null,news:[],journal:[],lastScary:null,lastLossMs:null});
let M={XRP:null,BTC:null,xrp4h:null,btc4h:null,atr:null,btcLongOk:null,btcRiskOff:null};
const persist=()=>save('state',S), f=(x,d=4)=>x==null?'n/a':(+x).toFixed(d);
// ---------- prices (Coinbase Exchange public candles, CORS-enabled) ----------
async function candles(prod,gran,n){const r=await fetch(`https://api.exchange.coinbase.com/products/${prod}/candles?granularity=${gran}`);const j=await r.json();
  return j.slice(0,n).reverse().map(x=>({t:x[0],l:x[1],h:x[2],o:x[3],c:x[4]}));}
async function refresh(){$('upd').textContent='Loading…';
 try{const C=XL.getConfig(),now=Date.now()/1000;
  const [xh,bh,xd,bd]=await Promise.all([candles('XRP-USD',3600,30),candles('BTC-USD',3600,30),candles('XRP-USD',86400,30),candles('BTC-USD',86400,15)]);
  const closed=a=>a.filter(b=>b.t+3600<=now).map(b=>b.c);
  M.XRP=xh.at(-1).c;M.BTC=bh.at(-1).c;M.xrp4h=XL.chg4h(closed(xh));M.btc4h=XL.chg4h(closed(bh));M.atr=XL.atr(xd.slice(0,-1));
  const bc=bd.slice(0,-1),prevWeekLow=Math.min(...bc.slice(-8,-1).map(b=>b.l)),last=bc.at(-1).c,prev=bc.at(-2).c;
  M.btcLongOk=last>=prevWeekLow;M.btcRiskOff=last<prevWeekLow||(last/prev-1)*100<=-3;
  $('upd').textContent='Updated '+new Date().toLocaleTimeString()+' · Coinbase public data';
 }catch(e){$('upd').textContent='Price feed unavailable ('+e.message+') — values n/a, no guessing.';}
 render();}
// ---------- desk ----------
function shockNow(){const v=$('spx').value;return XL.priceShock(M.btc4h,M.xrp4h,v===''?null:+v);}
function render(){const C=XL.getConfig(),sh=shockNow();
 $('pxXRP').textContent='$'+f(M.XRP);$('pxBTC').textContent='BTC $'+f(M.BTC,0);
 $('chXRP').textContent=`${M.xrp4h>0?'+':''}${f(M.xrp4h,2)}% · ${C.shockWindowH}h`;$('chBTC').textContent=`${f(M.btc4h,1)}%`;
 $('shock').className='pill '+(sh.shock?'bad':'ok');
 $('shock').textContent=sh.shock?'MARKET SHOCK: '+sh.fires.join('; '):`No shock (BTC ≤−${C.shockBtcPct}% / XRP ≤−${C.shockXrpPct}% / S&P fut ≤−${C.shockSpxPct}%)`+(sh.notes.length?' · '+sh.notes.join(', '):'');
 const losers=(()=>{let n=0;for(const j of [...S.journal].reverse()){if(j.net<=0)n++;else break}return n})();
 const today=new Date().toISOString().slice(0,10);
 const g=XL.bestGuess({price:M.XRP,atr14:M.atr,btcLongOk:M.btcLongOk,btcRiskOff:M.btcRiskOff,catalyst:$('cat').value,shock:sh.shock,
   inSkip:XL.inSkip(today),openPos:!!S.pos,kill:losers>=C.killLosers,cooldown:S.lastLossMs&&Date.now()-S.lastLossMs<C.cooldownH*3600e3});
 $('guess').textContent=g.call;
 $('guessWhy').innerHTML=g.why.join('; ')+(g.entry?`<br>Entry ${f(g.entry)} · Stop ${f(g.stop)} · Trail ${f(g.trail)} (${C.trailAtrMult}×ATR) · Breakeven at ${f(g.breakevenAt)}`:'')+`<br>ATR(14) ${f(M.atr)} · BTC long filter ${M.btcLongOk??'n/a'} · risk-off ${M.btcRiskOff??'n/a'}`;
 // v2 desk chips (display only)
 $('guess').className='callbadge '+(/LONG/.test(g.call)?'c-long':/SHORT/.test(g.call)?'c-short':/EXIT/.test(g.call)?'c-exit':/HOLD/.test(g.call)?'c-hold':'c-aside');
 $('chXRP').className='hchg '+(M.xrp4h==null?'':M.xrp4h>=0?'up':'dn');
 $('chipShock').textContent=sh.shock?'⚠️ Shock ON':'✅ No shock';$('chipShock').className='chip '+(sh.shock?'bad':'ok');
 const sc=S.news.filter(n=>n.scary&&!n.dupeOf).at(-1),left=sc?Math.ceil((C.coolOffMin*60000-(Date.now()-sc.ms))/60000):0;
 $('chipCool').textContent=left>0?`⏳ Cool-off ${left}m`:'Cool-off clear';$('chipCool').className='chip '+(left>0?'warnc':'ok');
 $('chipBTC').className='chip';
 const p=S.pos;$('pos').innerHTML=p?`${p.side.toUpperCase()} ${f(p.qty,1)} XRP @ ${f(p.entry)} · stop ${f(p.stop)} · opened ${new Date(p.t).toLocaleString()}`:`Flat · NAV $${f(S.nav,2)} (fake)`;
 renderNews();renderJournal();}
function psychOk(){const bad=[...document.querySelectorAll('#checks input')].filter(c=>c.dataset.need==='yes'?!c.checked:c.checked);
 const emo=$('emo').value;if(emo==='revenge'||emo==='excited')bad.push({dataset:{l:'emotion: '+emo}});
 $('psychMsg').textContent=bad.length?'Not clear: '+bad.map(b=>b.dataset.l).join('; '):'Checklist clear.';return bad.length===0;}
function open(side){if(S.pos)return alert('One ticket max.');if(!M.XRP||!M.atr)return alert('No live price/ATR — n/a, no trade.');
 if(!psychOk())return alert('Psych checklist not clear → default FLAT. See Psych tab.');
 const C=XL.getConfig(),d=C.atrMult*M.atr,z=XL.size(S.nav,M.XRP,d);
 S.pos={side,entry:M.XRP,qty:z.qty,stop:side==='long'?M.XRP-d:M.XRP+d,t:Date.now(),emo:$('emo').value,note:z.note};persist();render();}
function close(why){const p=S.pos,r=XL.tradePnl({side:p.side,entry:p.entry,exit:M.XRP,qty:p.qty});S.nav+=r.net;
 S.journal.push({open:p.t,close:Date.now(),side:p.side,entry:p.entry,exit:M.XRP,qty:p.qty,gross:r.gross,fees:r.fees,net:r.net,why,emo:p.emo,knobs:JSON.stringify(XL.getConfig())});
 if(r.net<=0)S.lastLossMs=Date.now();S.pos=null;persist();render();}
$('tryExit').onclick=()=>{if(!S.pos)return;const recent=S.news.filter(n=>n.scary&&!n.dupeOf).at(-1);
 const a=XL.exitAllowed({nowMs:Date.now(),lastScaryMs:recent?recent.ms:null,stopHit:false,xrpSpecificHighSev:!!(recent&&recent.high&&recent.rel==='xrp'),marketShock:shockNow().shock});
 $('exitMsg').textContent=a.why;if(a.ok&&psychOk()&&confirm('Paper exit at '+f(M.XRP)+'? ('+a.why+')'))close(a.why);};
$('stopHit').onclick=()=>{if(S.pos)close('stop hit');};
$('goLong').onclick=()=>open('long');$('goShort').onclick=()=>{if(!XL.getConfig().shortsEnabled)return alert('Shorts disabled in knobs.');open('short');};
$('refresh').onclick=refresh;$('spx').oninput=render;$('cat').onchange=render;
// ---------- news ----------
$('addNews').onclick=()=>{const h=$('nh').value.trim();if(!h)return;const it={headline:h,url:$('nu').value.trim(),time:new Date().toISOString(),ms:Date.now(),scary:$('nscary').checked,high:$('nhigh').checked};
 it.rel=XL.relevance(h);it.dupeOf=XL.findDupe(it,S.news);it.counts=!it.dupeOf&&XL.counts(h,h,shockNow().shock);
 if(!it.counts){it.scary=false;} S.news.push(it);persist();
 $('newsMsg').textContent=it.dupeOf?'Duplicate of an earlier story — counted once, no action.':!it.counts?'Not XRP-relevant and no market shock → log only, no action.':it.scary?`Counts. ${XL.getConfig().coolOffMin}-min no-panic-exit cool-off started.`:'Counts (logged).';
 $('nh').value=$('nu').value='';render();};
function renderNews(){$('newsList').innerHTML=S.news.slice(-30).reverse().map(n=>`<div class="j">${n.headline}<br><span class="small">${new Date(n.ms).toLocaleString()} · ${n.rel}${n.dupeOf?' · DUPE':''}${n.scary?' · scary':''}${n.counts?'':' · log-only'}</span></div>`).join('')||'<span class="small">No headlines yet.</span>';}
// ---------- psych ----------
const CHECKS=[['Rules-based primary catalyst with a source URL (not a tip/post/clip)','yes'],['Stop and exit path written before entry','yes'],['Unlock headline only / ETF rumor / ETF holdings as demand','no'],
 ['Chasing a bounce, flush or squeeze','no'],['Moon target / social-proof post','no'],['Within 3 sessions of a panic exit (revenge risk)','no'],['Sizing up during a flush / adding to a loser','no']];
$('checks').innerHTML=CHECKS.map(([l,n],i)=>`<label><input type="checkbox" data-need="${n}" data-l="${l}"> ${n==='yes'?'✅ ':'⚠️ '}${l}</label><br>`).join('');
$('checks').onchange=psychOk;$('emo').onchange=psychOk;
// ---------- journal ----------
function renderJournal(){const J=S.journal,w=J.filter(j=>j.net>0).length,net=J.reduce((a,j)=>a+j.net,0),fees=J.reduce((a,j)=>a+j.fees,0);
 $('stats').innerHTML=`Trades ${J.length} · fee-net W/L ${w}/${J.length-w} · Net $${f(net,2)} · Fees $${f(fees,2)} · NAV $${f(S.nav,2)} (fake)<br><span class="small">edge_claimed=false — W/L is a record, not proof of an edge.</span>`;
 $('jlist').innerHTML=J.slice().reverse().map(j=>`<div class="j ${j.net>0?'win':'loss'}">${j.side} ${f(j.entry)}→${f(j.exit)} net $${f(j.net,2)} (fees $${f(j.fees,2)}) · ${j.why}</div>`).join('');}
$('exportJ').onclick=()=>{const h='open,close,side,entry,exit,qty,gross,fees,net,why,emo';const csv=[h,...S.journal.map(j=>h.split(',').map(k=>JSON.stringify(j[k]??'')).join(','))].join('\n');navigator.clipboard?.writeText(csv);alert('Journal copied.');};
// ---------- knobs ----------
const KN=[['coolOffMin','Dire-news cool-off (min)',0,240,5,'dial'],['shockBtcPct','Shock: BTC drop %',1,10,0.5,'dial'],['shockXrpPct','Shock: XRP drop %',1,15,0.5,'dial'],['shockSpxPct','Shock: S&P fut drop %',0.5,5,0.1,'dial'],
 ['shockWindowH','Shock window (hours)',1,24,1],['feeBpsSide','Fee bps per side',0,100,1],['slippageBps','Event slippage bps/side',0,50,1],['riskPct','Risk per idea % NAV',0.25,2,0.25],
 ['grossCapPct','Gross cap % NAV',5,50,1],['atrMult','Stop distance (× ATR14)',1,4,0.1],['trailAtrMult','Trailing stop (× ATR14)',0.5,4,0.1],['breakevenR','Breakeven trigger (R multiple)',0.5,3,0.1],
 ['timeStopSessions','Time stop (sessions, max 10)',1,10,1],['volTrapH','Bad-news volume trap window (h)',1,12,1],['volTrapZ','Volume trap z-score',1.5,5,0.1],['killLosers','Kill switch: losers in a row',2,10,1],
 ['cooldownH','Post-loss cooldown (h)',0,72,1],['etfStreakDays','ETF inflow streak (days)',2,10,1],['bankroll','Starting fake bankroll $',100,10000,100]];
function setK(k,v){const c=Object.assign({},XL.getConfig(),{[k]:v});XL.setConfig(c);save('knobs',c);paintK();render();}
function paintK(){const C=XL.getConfig();KN.forEach(([k,,lo,hi])=>{const s=$('s_'+k);if(s){s.value=C[k];$('v_'+k).textContent=C[k];}
  const d=$('d_'+k);if(d){const a=-135+270*(C[k]-lo)/(hi-lo);d.querySelector('line').setAttribute('transform',`rotate(${a} 45 45)`);d.querySelector('.dv').textContent=C[k];}});$('s_shorts').checked=C.shortsEnabled;}
$('sliders').innerHTML=KN.map(([k,l,lo,hi,st])=>`<div class="knob">${l}<span class="v" id="v_${k}"></span><input type="range" id="s_${k}" min="${lo}" max="${hi}" step="${st}"></div>`).join('')+'<label><input type="checkbox" id="s_shorts"> Shorts enabled</label>';
$('dials').innerHTML=KN.filter(x=>x[5]).map(([k,l])=>`<div class="dial" id="d_${k}"><svg viewBox="0 0 90 90"><circle cx="45" cy="45" r="38" fill="#0e1730" stroke="#2b6cff" stroke-width="4"/><line x1="45" y1="45" x2="45" y2="12" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg><div class="dv"></div><div class="small">${l}</div></div>`).join('');
KN.forEach(([k,,lo,hi,st,t])=>{$('s_'+k).oninput=e=>setK(k,+e.target.value);
 if(t){const d=$('d_'+k);let y0,v0;d.onpointerdown=e=>{d.setPointerCapture(e.pointerId);y0=e.clientY;v0=XL.getConfig()[k];};
  d.onpointermove=e=>{if(y0==null)return;let v=v0+Math.round((y0-e.clientY)/6)*st;v=Math.min(hi,Math.max(lo,+v.toFixed(2)));if(v!==XL.getConfig()[k])setK(k,v);};d.onpointerup=()=>y0=null;}});
$('s_shorts').onchange=e=>setK('shortsEnabled',e.target.checked);
$('reset').onclick=()=>{if(confirm('Reset all knobs to desk defaults?')){LS.removeItem('knobs');XL.setConfig({});paintK();render();}};
// ---------- nav / boot ----------
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,nav button').forEach(x=>x.classList.remove('on'));$(b.dataset.t).classList.add('on');b.classList.add('on');});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
paintK();refresh();setInterval(refresh,5*60e3);
