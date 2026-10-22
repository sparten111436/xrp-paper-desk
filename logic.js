// XRP Paper Desk core logic — PAPER ONLY. edge_claimed=false. Mirrors research/news_watch.py + RULES-v1.2.
(function(root){
const FEE_BPS_SIDE=20, EDGE_CLAIMED=false, BANKROLL=1000;
const DEFAULTS={feeBpsSide:20,stressBpsSide:20,slippageBps:0,riskPct:1,grossCapPct:25,atrMult:2.0,trailAtrMult:2.0,breakevenR:1.0,
  timeStopSessions:5,coolOffMin:60,shockBtcPct:3.0,shockXrpPct:4.0,shockSpxPct:1.5,shockWindowH:4,volTrapH:4,volTrapZ:3,killLosers:5,
  cooldownH:24,bankroll:1000,shortsEnabled:true,etfStreakDays:3,feeVenue:'desk',publicFeeBpsSide:60,publicSpreadBps:15};
// Public venue (RULES-v1.3, Warren 2026-10-22): 60 bps/side API fee + spread (round trip) => 135 bps RT default
function sideBps(venue){const C=CFG;return (venue||C.feeVenue)==='public'?C.publicFeeBpsSide+C.publicSpreadBps/2:C.feeBpsSide;}
function publicSized(entry,stop,target,atrDaily){const d=Math.abs(entry-stop),rt=(2*CFG.publicFeeBpsSide+CFG.publicSpreadBps)/1e4;return !!atrDaily&&d>=1.5*atrDaily&&Math.abs(target-entry)/entry>=3*rt;}
let CFG=Object.assign({},DEFAULTS);
function setConfig(c){CFG=Object.assign({},DEFAULTS,c||{});return CFG;} function getConfig(){return CFG;}
const SHOCK_TH={get BTC(){return -CFG.shockBtcPct},get XRP(){return -CFG.shockXrpPct},get SPX(){return -CFG.shockSpxPct}};
// (2) price-based market shock. spx may be null (unavailable) -> BTC/XRP still checked, note logged.
function priceShock(btc4h,xrp4h,spx){
  const fires=[],notes=[];
  if(btc4h==null)notes.push('btc_unavailable');else if(btc4h<=SHOCK_TH.BTC)fires.push(`BTC ${CFG.shockWindowH}h ${btc4h.toFixed(2)}%`);
  if(xrp4h==null)notes.push('xrp_unavailable');else if(xrp4h<=SHOCK_TH.XRP)fires.push(`XRP ${CFG.shockWindowH}h ${xrp4h.toFixed(2)}%`);
  if(spx==null)notes.push('spx_unavailable');else if(spx<=SHOCK_TH.SPX)fires.push(`S&P fut ${spx.toFixed(2)}%`);
  return {shock:fires.length>0,fires,notes};
}
function chg4h(closes,win){win=win||CFG.shockWindowH; // hourly closes oldest->newest, closed bars
  if(!closes||closes.length<win+1)return null; const a=closes[closes.length-1-win],b=closes[closes.length-1]; return (b/a-1)*100;
}
// (3) relevance gate
const XRP_RE=/\b(xrp|ripple|xrpl|evernorth|rlusd)\b/i, TOP5=/(binance|coinbase|okx|bybit|upbit)/i;
const TOP5_HIT=/\b(hack|hacked|exploit\w*|drained|stolen|insolven\w*|bankrupt\w*|halts? withdrawals|pauses withdrawals|collapse\w*)\b/i;
const SHOCK=[[/\b(sec|cftc)\b/i,/\b(crypto|industry|all|exchanges?|tokens?|altcoins?|sues|charges|ban\w*|enforcement|rule)\b/i,/\b(sues|sued|charges|charged|ban\w*|crackdown|enforcement|lawsuit|emergency)\b/i],
  [/\btariffs?\b/i,/\b(100%|new|additional|china|retaliat\w*|trump)\b/i],[/\b(fed|fomc|powell)\b/i,/\b(emergency|surprise|unscheduled|intermeeting)\b/i]];
function relevance(text,headline){const t=text.toLowerCase(),h=(headline??text.split(' . ')[0]).toLowerCase();
  if(XRP_RE.test(t))return 'xrp'; if(SHOCK.some(g=>g.every(r=>r.test(t))))return 'market-shock';
  if(TOP5.test(h)&&TOP5_HIT.test(h))return 'market-shock'; return 'not-XRP';}
function counts(text,headline,priceShockOn){const r=relevance(text,headline);return priceShockOn||r!=='not-XRP';}
// dedupe — Jaccard>=0.5 on content words within 36h, or identical entity pair (news_watch.py fix)
const STOP=new Set('the a an of to in on for and or as at by with from after amid is are be its it this that new says said'.split(' '));
const ENT=new Set('finma sec cftc blackrock bitget ledger qubic coinbase binance okx bybit upbit ripple evernorth sparkassen swell mastercard visa swift dtcc grayscale bitwise franklin 21shares canary wisdomtree'.split(' '));
function toks(t){return new Set((t.toLowerCase().match(/[a-z0-9$]+/g)||[]).filter(w=>!STOP.has(w)&&w.length>2));}
function jacc(a,b){let i=0;a.forEach(x=>{if(b.has(x))i++});const u=new Set([...a,...b]).size;return i/Math.max(1,u);}
function findDupe(item,prior){const a=toks(item.headline),ts=Date.parse(item.time||0);
  for(const q of prior){if(q.dupeOf||q.url===item.url)continue;const gap=Math.abs(ts-Date.parse(q.time||0))/1000||0;
    const b=toks(q.headline); if(gap<=36*3600&&jacc(a,b)>=0.5)return q.url||q.headline;
    const ka=[...a].filter(w=>ENT.has(w)).sort().join(),kb=[...b].filter(w=>ENT.has(w)).sort().join();
    if(gap<=36*3600&&ka.split(',').length>=2&&ka&&ka===kb)return q.url||q.headline;}
  return '';}
// (1) cool-off: no panic exit within 60 min of a scary headline, unless stop hit or high-sev XRP-specific / market shock
function exitAllowed({nowMs,lastScaryMs,stopHit,xrpSpecificHighSev,marketShock}){
  if(stopHit)return {ok:true,why:'stop hit'}; if(marketShock)return {ok:true,why:'market-wide shock'};
  if(xrpSpecificHighSev)return {ok:true,why:'real XRP-specific event'};
  if(lastScaryMs!=null&&nowMs-lastScaryMs<CFG.coolOffMin*60000){const m=Math.ceil((CFG.coolOffMin*60000-(nowMs-lastScaryMs))/60000);return {ok:false,why:`cool-off: ${m} min left — panic exit blocked (would be tagged panic_exit)`};}
  return {ok:true,why:'outside cool-off (exit only on stop/time/thesis)'};}
// fee math: 20 bps per side, netted
function tradePnl({side,entry,exit,qty,feeBps=sideBps()+CFG.slippageBps}){const gross=(side==='long'?exit-entry:entry-exit)*qty;
  const fees=(entry*qty+exit*qty)*feeBps/10000;const net=gross-fees;return {gross,fees,net,win:net>0};}
function atr(bars,n=14){if(bars.length<n+1)return null;const tr=[];for(let i=1;i<bars.length;i++){const[h,l,pc]=[bars[i].h,bars[i].l,bars[i-1].c];tr.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));}
  let a=tr.slice(0,n).reduce((x,y)=>x+y)/n;for(let i=n;i<tr.length;i++)a=(a*(n-1)+tr[i])/n;return a;}
function size(nav,entry,stopDist){if(!stopDist)return {qty:nav*0.05/entry,note:'ATR missing: fixed 5% notional (education)'};
  let qty=nav*CFG.riskPct/100/stopDist;const cap=nav*CFG.grossCapPct/100/entry;if(qty>cap)qty=cap;return {qty,note:`${CFG.riskPct}% risk, capped ${CFG.grossCapPct}% NAV`};}
// (5) best-guess: conservative, default stand aside. Needs a confirmable catalyst to lean.
function bestGuess({price,atr14,btcLongOk,btcRiskOff,catalyst,shock,inSkip,openPos,kill,cooldown}){
  const out={call:'STAND ASIDE',entry:null,stop:null,trail:null,why:[]};
  if(openPos&&(shock||catalyst==='reversed')){out.call='EXIT';out.why.push(shock?'market shock fired':'thesis reversed');return out;}
  if(openPos){out.call='HOLD (no new entry)';out.why.push('one ticket max; exit only on stop/time/thesis');return out;}
  if(kill){out.why.push('kill switch: 5 net losers');return out;} if(cooldown){out.why.push('24h post-loss cooldown');return out;}
  if(inSkip){out.why.push('CPI/FOMC window: skip');return out;} if(shock){out.why.push('market shock: no new longs');return out;}
  if(!atr14||!price){out.why.push('no ATR/price — n/a');return out;}
  if(catalyst==='pos'&&btcLongOk){out.call='LEAN LONG';out.entry=price;out.stop=price-CFG.atrMult*atr14;out.trail=CFG.trailAtrMult*atr14;out.breakevenAt=price+CFG.breakevenR*CFG.atrMult*atr14;out.why.push('confirmed catalyst + BTC filter pass');}
  else if(catalyst==='neg'&&btcRiskOff&&CFG.shortsEnabled){out.call='LEAN SHORT';out.entry=price;out.stop=price+CFG.atrMult*atr14;out.trail=CFG.trailAtrMult*atr14;out.breakevenAt=price-CFG.breakevenR*CFG.atrMult*atr14;out.why.push('confirmed negative shock + BTC risk-off');}
  else out.why.push('no confirmable primary catalyst with regime pass');
  return out;}
const SKIP=[['FOMC','2026-10-27','2026-10-28']];
function inSkip(dateStr){const s=SKIP.find(([n,a,b])=>a<=dateStr&&dateStr<=b);return s?s[0]:'';}
const api={DEFAULTS,sideBps,publicSized,setConfig,getConfig,FEE_BPS_SIDE,EDGE_CLAIMED,BANKROLL,SHOCK_TH,priceShock,chg4h,relevance,counts,toks,jacc,findDupe,exitAllowed,tradePnl,atr,size,bestGuess,SKIP,inSkip};
if(typeof module!=='undefined')module.exports=api;else root.XL=api;
})(this);
