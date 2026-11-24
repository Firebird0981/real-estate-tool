(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
var SRC=(document.currentScript&&document.currentScript.src)||"";
var BASE=new URL("../",SRC).href;
/* ---------- search box (all pages) ---------- */
var inp=$("tsearch"),list=$("tresults"),IDX=null;
function loadIdx(cb){ if(IDX) return cb(); fetch(BASE+"towns.json").then(function(r){return r.json()}).then(function(j){IDX=j;cb()}).catch(function(){}); }
function find(q){ q=q.trim().toLowerCase(); if(!q) return []; var out=[];
  if(/^\d{3,5}$/.test(q)){ IDX.forEach(function(t){ if(t.z.some(function(z){return z.indexOf(q)===0})) out.push(t); }); return out.slice(0,8); }
  IDX.forEach(function(t){ var n=t.n.toLowerCase(); if(n.indexOf(q)===0) out.push([0,t]); else if(n.indexOf(q)>0||t.a.toLowerCase().indexOf(q)>=0) out.push([1,t]); });
  out.sort(function(a,b){return a[0]-b[0]||a[1].n.localeCompare(b[1].n)}); return out.slice(0,8).map(function(x){return x[1]}); }
function show(){ var r=find(inp.value); list.innerHTML="";
  if(!r.length){ list.hidden=true; return; }
  r.forEach(function(t){ var li=document.createElement("li"),a=document.createElement("a"); a.href=BASE+t.s+"/";
    var s1=document.createElement("span"); s1.textContent=t.n; var s2=document.createElement("small"); s2.textContent=t.c; a.appendChild(s1); a.appendChild(s2); li.appendChild(a); list.appendChild(li); });
  list.hidden=false; }
if(inp&&list){
  inp.addEventListener("input",function(){ loadIdx(show) });
  inp.addEventListener("focus",function(){ loadIdx(function(){}) });
  inp.addEventListener("keydown",function(e){ if(e.key==="Enter"){ var a=list.querySelector("a"); if(a){ e.preventDefault(); location.href=a.href; } } else if(e.key==="Escape"){ list.hidden=true; } else if(e.key==="ArrowDown"){ var f=list.querySelector("a"); if(f){ e.preventDefault(); f.focus(); } } });
  document.addEventListener("click",function(e){ if(!e.target.closest(".srch")) list.hidden=true; });
}
/* ---------- directory filter ---------- */
var flt=$("tfilter");
if(flt){ flt.addEventListener("input",function(){ var q=flt.value.trim().toLowerCase();
  document.querySelectorAll(".dir li").forEach(function(li){ li.hidden=!!q&&li.getAttribute("data-s").indexOf(q)<0; });
  document.querySelectorAll(".dir section").forEach(function(s){ s.hidden=!!q&&!s.querySelector("li:not([hidden])"); }); }); }
/* ---------- "for you" card: same payment math as the main app ---------- */
var dEl=$("town-data"); if(!dEl) return;
var T=JSON.parse(dEl.textContent);
var CREDIT={"760":{conv:0,gov:0,pmi:.30,ins:1},"720":{conv:.15,gov:0,pmi:.45,ins:1},"680":{conv:.35,gov:0,pmi:.80,ins:1.15},"640":{conv:.60,gov:.125,pmi:1.31,ins:1.40},"620":{conv:1,gov:.25,pmi:1.5,ins:1.8}};
var LOANS={fha:{down:3.5,mi:.55,uf:1.75},conv:{down:5,mi:.6,uf:0},va:{down:0,mi:0,uf:2.15}};
var INS_COUNTY={"Cape May":1.4,"Atlantic":1.35,"Ocean":1.25,"Monmouth":1.15,"Essex":1.15,"Hudson":1.1,"Passaic":1.1,"Union":1.1,"Camden":1.05};
function creditOf(v){return CREDIT[v]||CREDIT["720"]}
function rateFor(loan,credit){var c=creditOf(credit);return +(T.mort+(loan==="conv"?c.conv:c.gov)).toFixed(3)}
function miFor(loan,down,credit){ if(loan==="fha")return .55; if(loan==="va")return 0; if(down>=20)return 0; var ltv=100-down,f=ltv>95?1.3:ltv>90?1.15:ltv>85?1:.55; return +(creditOf(credit).pmi*f).toFixed(2); }
function insFor(price,county,credit){ var f=(INS_COUNTY[county]||1)*creditOf(credit).ins; return Math.max(1200,Math.round(price*.004*f/50)*50); }
function pmt(loan,rate,years){ var r=rate/100/12,n=years*12; if(loan<=0)return 0; if(r===0)return loan/n; return loan*r/(1-Math.pow(1+r,-n)); }
function closeItems(price,loan,rate,taxMo,insYr){ var attorney=1800,title=Math.max(1800,Math.round(price*.005/50)*50),lender=2200,insp=1000,prepaid=Math.round(taxMo*2+insYr+loan*rate/100/365*15); return {total:attorney+title+lender+insp+prepaid}; }
function computeOwn(d,price){ price=price==null?d.price:price;
  var downAmt=price*d.down/100,base=price-downAmt,loan=base*(1+(d.uf||0)/100),pi=pmt(loan,d.rate,30),
  miOn=d.loan==="fha"||(d.loan==="conv"&&d.down<20),mi=miOn?base*(d.mi||0)/100/12:0,tax=price*d.tax/100/12,ins=d.ins/12,
  close=closeItems(price,loan,d.rate,tax,ins*12).total;
  return {pi:pi,mi:mi,tax:tax,ins:ins,total:pi+mi+tax+ins,cash:downAmt+close,down:downAmt,close:close}; }
function maxPrice(d,gross,hs,as){ function ok(p){var c=computeOwn(d,p);return c.total<=hs*gross&&c.total+d.debt<=as*gross}
  var lo=0,hi=Math.max(d.price*4,2e6); for(var i=0;i<50;i++){var mid=(lo+hi)/2; if(ok(mid))lo=mid; else hi=mid;} return Math.floor(lo/5000)*5000; }
var fmt$=function(v){return "$"+Math.round(v).toLocaleString("en-US")};
function stored(){ try{ var s=JSON.parse(localStorage.getItem("njinv_binp")||"null"); return s&&typeof s==="object"?s:null; }catch(e){ return null; } }
var S=stored(), mine=!!(S&&S.inc>0);
var loan=S&&LOANS[S.loan]?S.loan:"conv", credit=S&&S.credit?String(S.credit):"720";
var down=S&&S.down!=null&&isFinite(S.down)&&(S.down>0||loan==="va")?+S.down:20;
var rate=(S&&S.rateManual&&S.rate>0)?+S.rate:rateFor(loan,credit);
var debt=S&&S.debt>0?+S.debt:0, income=S&&S.inc>0?+S.inc:0;
var box=$("foryou-body"), inc=$("inc-in");
if(inc&&income) inc.value=income.toLocaleString("en-US");
function render(){
  var d={price:T.price,down:down,rate:rate,loan:loan,mi:miFor(loan,down,credit),uf:LOANS[loan].uf,tax:T.tax,
    ins:Math.round(insFor(T.price,T.county,credit)/50)*50+(T.floodAdd||0),debt:debt};
  var o=computeOwn(d), gross=income/12, h=income>0?o.total/gross:null, b=income>0?(o.total+debt)/gross:null;
  var tag="",cls="",msg;
  var pi=Math.round(o.pi+o.mi),tx=Math.round(o.tax),ins=Math.round(o.ins),tot=pi+tx+ins;
  if(income>0){
    var cmf=maxPrice(d,gross,.28,.36), lnd=maxPrice(d,gross,1,.43);
    if(h<=.28&&b<=.36){tag="Comfortable";cls="good"} else if(h<=.36&&b<=.43){tag="A stretch";cls="ok"} else {tag="Likely too high";cls="bad"}
    msg="A typical "+fmt$(T.price)+" home here takes <b>"+Math.round(h*100)+"%</b> of your income. Comfortable for you is up to about <b>"+fmt$(cmf)+"</b>; many lenders would go to about "+fmt$(lnd)+".";
  } else msg="A typical "+fmt$(T.price)+" home here, with "+down+"% down. Add your household income to see whether it fits.";
  var chip=$("foryou-chip"); chip.textContent=tag; chip.className="chip "+cls; chip.hidden=!tag;
  $("fy-total").innerHTML=fmt$(o.total)+" <small>a month</small>";
  $("fy-msg").innerHTML=msg;
  var bar=$("fy-bar"); bar.setAttribute("aria-label","Payment split: mortgage "+fmt$(pi)+", tax "+fmt$(tx)+", insurance "+fmt$(ins));
  bar.innerHTML='<i style="width:'+(pi/tot*100).toFixed(1)+'%;background:#0f5c4d"></i><i style="width:'+(tx/tot*100).toFixed(1)+'%;background:#c98a1e"></i><i style="width:'+(ins/tot*100).toFixed(1)+'%;background:#4a6fa5"></i>';
  $("fy-pi").textContent=fmt$(pi); $("fy-tax").textContent=fmt$(tx); $("fy-ins").textContent=fmt$(ins); $("fy-cash").textContent=fmt$(o.cash);
  $("fy-assume").textContent=(income>0?fmt$(income)+" income · ":"")+down+"% down · "+rate.toFixed(2)+"% rate";
}
if(box){ render(); if(inc) inc.addEventListener("input",function(){ var v=inc.value.replace(/[^0-9]/g,""); income=+v||0; inc.value=income?income.toLocaleString("en-US"):""; render(); }); }
})();
