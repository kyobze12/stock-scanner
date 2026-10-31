(()=>{"use strict";const{useState:M,useEffect:P,useMemo:X,useRef:z,useCallback:B}=React,c=htm.bind(React.createElement),ve=60,Ae=2e4,nt=2,at=24*3600*1e3,rt=10*60*1e3,te=1500,ot=2e4,V="ftc-stock-scanner-v1",st="scan-worker.2031b8c745.js",ct="vendor/zxing-0.21.3.min.js",U="",G=["dept","subdept","supplier","category","brand"],K={get(e){try{return JSON.parse(localStorage.getItem(e)||"null")}catch{return null}},set(e,t){try{localStorage.setItem(e,JSON.stringify(t))}catch{}}},le=(()=>{let e=null;const t=()=>e||(e=new Promise((a,n)=>{const o=indexedDB.open("ftc-stock-scanner",1);o.onupgradeneeded=()=>o.result.createObjectStore("kv"),o.onsuccess=()=>a(o.result),o.onerror=()=>n(o.error)})),r=async(a,n)=>{const o=await t();return new Promise((l,s)=>{const d=o.transaction("kv",a),p=n(d.objectStore("kv"));d.oncomplete=()=>l(p&&p.result),d.onerror=()=>s(d.error),d.onabort=()=>s(d.error)})};return{async get(a){try{return await r("readonly",n=>n.get(a))}catch{return null}},async set(a,n){try{return await r("readwrite",o=>o.put(n,a)),!0}catch{return!1}},async del(a){try{await r("readwrite",n=>n.delete(a))}catch{}}}})(),_=e=>{const t=parseFloat(String(e!=null?e:"").replace(/[^0-9.\-]/g,""));return isFinite(t)?t:0},Ee=e=>{const t=String(e!=null?e:"").trim();if(t==="")return NaN;const r=parseFloat(t.replace(/[^0-9.\-]/g,""));return isFinite(r)?r:NaN},_e=e=>e!==e?"":Math.round(e*1e4)/1e4,De=e=>{const t=Number(e)||0;return Number.isInteger(t)?t.toLocaleString():t.toLocaleString(void 0,{maximumFractionDigits:2})},ne=(e,t="$")=>e===""||e==null||isNaN(e)?"\u2014":t+Number(e).toLocaleString(void 0,{minimumFractionDigits:2,maximumFractionDigits:2}),fe=e=>String(e!=null?e:"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""),Ie=()=>{try{navigator.vibrate&&navigator.vibrate(60)}catch{}},he=e=>{if(!e)return"never";const t=Math.round((Date.now()-e)/6e4);if(t<1)return"just now";if(t<60)return t+" min ago";const r=Math.round(t/60);return r<24?r+" h ago":Math.round(r/24)+" days ago"},it=e=>{let t="",r=e+1;for(;r;){const a=(r-1)%26;t=String.fromCharCode(65+a)+t,r=Math.floor((r-1)/26)}return t},qt=e=>"'"+String(e).replace(/'/g,"''")+"'",ke=()=>"scheduler"in window&&scheduler.yield?scheduler.yield():new Promise(e=>setTimeout(e,0)),lt=/[^\x00-\x7f]/;function Y(e){if(e=String(e!=null?e:""),!lt.test(e))return e.toLowerCase();let t="";for(let r=0;r<e.length;r++){const a=e.charAt(r);a.charCodeAt(0)<128?t+=a.toLowerCase():t+=a.normalize("NFD").charAt(0).toLowerCase().charAt(0)||a}return t}const de=e=>String(e!=null?e:"").replace(/[\u0001\n\r\t]+/g," ").trim(),je=e=>{const t=de(e);return t==="-"||t==="#N/A"?"":t},Oe={code:["ga_codearticle","code","item code","sku"],barcode:["barcode","bar code","upc","ean"],name:["item name","description","name"],supplier:["supplier"],dept:["department"],subdept:["subdepartment"],trade:["trade"],retail:["retail","selling price","price"],brand:["brand"],category:["category"],subcategory:["subcategory"],stock:["phisyque","physique","stock","qty"],gst:["gst","tax"],pmap:["pmap","avg cost"],uscost:["us cost"],type:["item type"],collection:["ga_collection"],tracked:["ga_tenuestock"],ref:["ga_charlibre1"],dpa:["ga_dpa"],byHowMany:["by how many"],scale:["scale item"]},dt=["code","barcode","name","supplier","dept","subdept","category","brand","retail","stock","pmap"];function ut(e){const t=e.map(a=>fe(a).trim()),r={};for(const[a,n]of Object.entries(Oe)){const o=t.findIndex(l=>n.includes(l));o>=0&&(r[a]=o)}return r}const Vt={out:{label:"Out",pill:"bg-bad-soft text-bad",num:"text-bad"},ok:{label:"In stock",pill:"bg-accent-soft text-accent",num:"text-fg"}};function ge(e){const t=e&&e.code;return t==="not_connected"?{title:"Connect your sheet",text:"Add the connection link and key from your Google Sheet's Stock Scanner script in Settings.",settings:!0}:t==="bad_key"?{title:"Wrong connection key",text:"The sheet refused the key. Check the key in Settings matches the KEY line in the sheet's script.",settings:!0}:t==="no_tab"?{title:"Tab not found",text:"The script couldn't find the item tab. Check the TAB line in the sheet's script matches the tab name."}:t==="network"?{title:"Can't reach the sheet",text:"Check your internet connection. If it keeps happening, make sure the script is deployed as a web app with access for Anyone.",retry:!0}:t==="bad_response"?{title:"The sheet didn't answer properly",text:"The connection link may be wrong. It should end in /exec. Check it in Settings.",settings:!0}:{title:"Couldn't read the sheet",text:"The sheet's script reported: "+String(e&&(e.message||e.code)||"unknown error").slice(0,160),retry:!0}}function pt(e,t,r,a){const n=(l,s)=>{var d;return a[l]===void 0?"":(d=s[r[a[l]]])!=null?d:""},o={lines:[],hay:[],rows:[],stock:[],retail:[],pmap:[]};for(const l of G)o[l]=[];for(let l=0;l<e.length;l++){const s=e[l],d=de(n("code",s)),p=de(n("barcode",s));if(!d&&!p)continue;const m=d+U+p+U+de(n("name",s))+U+de(n("brand",s));o.lines.push(m),o.hay.push(Y(m)),o.rows.push(t+l),o.stock.push(_(n("stock",s))),o.retail.push(Ee(n("retail",s))),o.pmap.push(Ee(n("pmap",s)));for(const g of G)o[g].push(je(n(g,s)))}return o}async function mt(e){e=e.filter(i=>i.rows.length);const t=e.reduce((i,h)=>i+h.rows.length,0),r=new Int32Array(t+1),a=new Int32Array(t),n=new Float64Array(t),o=new Float64Array(t),l=new Float64Array(t),s={},d={},p={};for(const i of G)s[i]=new Uint32Array(t),d[i]=[""],p[i]=new Map([["",0]]);let m=0,g=1;for(const i of e){for(let h=0;h<i.rows.length;h++,m++)r[m]=g,g+=i.lines[h].length+1,a[m]=i.rows[h],n[m]=i.stock[h],o[m]=i.retail[h],l[m]=i.pmap[h];for(const h of G){const L=p[h],y=d[h],b=s[h],N=m-i.rows.length,S=i[h];for(let A=0;A<S.length;A++){let D=L.get(S[A]);D===void 0&&(D=y.length,y.push(S[A]),L.set(S[A],D)),b[N+A]=D}}await ke()}r[t]=g;const v=`
`+e.map(i=>i.lines.join(`
`)).join(`
`)+`
`;await ke();const f=`
`+e.map(i=>i.hay.join(`
`)).join(`
`)+`
`;return{v:2,n:t,R:v,H:f,off:r,rows:a,stock:n,retail:o,pmap:l,dim:s,dict:d}}const Fe=(e,t)=>(e.maps||(e.maps={}))[t]||(e.maps[t]=new Map(e.dict[t].map((r,a)=>[r,a])));function Ne(e,t){const[r,a,n,o]=e.R.slice(e.off[t],e.off[t+1]-1).split(U),l={};for(const s of G)l[s]=e.dict[s][e.dim[s][t]];return{idx:t,row:e.rows[t],code:r,barcode:a,name:n,brand:o,stock:e.stock[t],retail:_e(e.retail[t]),pmap:_e(e.pmap[t]),f:l}}function ft(e,t,r){const a=s=>{var d;return t[s]===void 0?"":String((d=e[t[s]])!=null?d:"").trim()},n={};for(const s of G)n[s]=je(a(s));const o=a("retail"),l=a("pmap");return{idx:-1,row:r,code:a("code"),barcode:a("barcode"),name:a("name"),brand:a("brand"),stock:_(a("stock")),retail:o===""?"":_(o),pmap:l===""?"":_(l),f:n,extra:!0}}const Be=(e,t)=>{let r=0,a=e.length-2;for(;r<a;){const n=r+a+1>>1;e[n]<=t?r=n:a=n-1}return r};function ht(e,t){const r=e.rows;let a=0,n=r.length-1;for(;a<=n;){const o=a+n>>1;if(r[o]===t)return o;r[o]<t?a=o+1:n=o-1}return-1}function gt(e,t){const r=Y(String(t).trim());if(!r)return-1;const a=r.replace(/^0+/,""),n=[...new Set([r,a,.../^\d+$/.test(a)?[8,12,13,14].filter(s=>s>=a.length).map(s=>a.padStart(s,"0")):[]].filter(Boolean))],{H:o,off:l}=e;for(const s of n){let d=o.indexOf(`
`+s+U);if(d>=0)return Be(l,d+1);for(d=0;(d=o.indexOf(U+s+U,d))>=0;){const p=Be(l,d);if(o.indexOf(U,l[p])===d)return p;d++}}return-1}const bt=[["dept","Department"],["subdept","Subdepartment"],["supplier","Supplier"],["category","Category"],["brand","Brand"]],ue={dept:"",subdept:"",supplier:"",category:"",brand:"",stock:"",min:"",max:""},xt=e=>Object.entries(e).filter(([,t])=>t!=="").length;function Ge(e,t){const r=t.min===""?null:_(t.min),a=t.max===""?null:_(t.max);if(!t.stock&&r===null&&a===null)return null;const{stock:n,retail:o}=e;return l=>(t.stock==="in"?n[l]>0:t.stock==="out"?n[l]<=0:!0)&&(r===null||o[l]>=r)&&(a===null||o[l]<=a)}function $t(e,t){const r=[];for(const n of G)if(t[n]!==""){const o=Fe(e,n).get(t[n]);r.push(o===void 0?()=>!1:l=>e.dim[n][l]===o)}const a=Ge(e,t);return a&&r.push(a),r.length?n=>{for(let o=0;o<r.length;o++)if(!r[o](n))return!1;return!0}:null}function wt(e,t,r){const a=Y(t).split(/\s+/).filter(Boolean),n=$t(e,r),o=[],l=[],s=[];let d=0;if(!a.length){for(let h=0;h<e.n;h++)(!n||n(h))&&(d++,s.length<te&&s.push(h));return{total:d,list:s}}let p=a[0];for(const h of a)h.length>p.length&&(p=h);const m=a.join(" "),{H:g,off:v}=e;let f=0,i=0;for(;f=g.indexOf(p,f),!(f<0);){for(;v[i+1]<=f;)i++;const h=v[i],L=v[i+1]-1;let y=!0;if(a.length>1){const b=g.slice(h,L);for(const N of a)if(N!==p&&!b.includes(N)){y=!1;break}}if(y&&(!n||n(i)))if(d++,d<=ot){const b=g.indexOf(U,h),N=g.indexOf(U,b+1);g.startsWith(m+U,h)||g.startsWith(m+U,b+1)?o.push(i):g.startsWith(m,N+1)?l.length<te&&l.push(i):s.length<te&&s.push(i)}else s.length<te&&s.push(i);f=v[i+1]}return{total:d,list:o.concat(l,s).slice(0,te)}}function Pe(e,t){const r={};for(const m of G)r[m]=new Uint32Array(e.dict[m].length);const a=G.map(m=>{var g;return t[m]===""?-1:(g=Fe(e,m).get(t[m]))!=null?g:-2}),n=G.map(m=>e.dim[m]),o=G.map(m=>r[m]),l=G.length,s=Ge(e,t);let d=0;for(let m=0;m<e.n;m++){if(s&&!s(m))continue;let g=0,v=-1;for(let f=0;f<l&&!(a[f]!==-1&&n[f][m]!==a[f]&&(g++,v=f,g>1));f++);if(g===0){d++;for(let f=0;f<l;f++)o[f][n[f][m]]++}else g===1&&o[v][n[v][m]]++}const p={};for(const m of G){const g=[],v=r[m],f=e.dict[m];for(let i=1;i<v.length;i++)v[i]>0&&g.push([f[i],v[i]]);g.sort((i,h)=>h[1]-i[1]),p[m]=g}return{match:d,options:p}}const ze=e=>/^https:\/\/script\.google(usercontent)?\.com\//.test(e||"");function Ce(e){const t=String(e||"").match(/connect=([^&\s]+)/);if(!t)return null;try{const[r,a]=atob(decodeURIComponent(t[1]).replace(/ /g,"+")).split("|");return ze(r)&&a?{url:r,key:a}:null}catch{return null}}function Ue(){const e=Ce(location.hash);return e&&(K.set(V+":conn",e),history.replaceState(null,"",location.pathname+location.search)),e}const yt=e=>location.origin+location.pathname+"#connect="+encodeURIComponent(btoa(e.url+"|"+e.key));function vt(){const[e,t]=M(()=>(Ue(),K.get(V+":conn")||{url:"",key:""})),[r,a]=M(null),[n,o]=M([]),[l,s]=M({syncedAt:0,checkedAt:0,header:[],map:{},updated:"",lastRow:0}),[d,p]=M({kind:"loading"}),m=z(e);m.current=e;const g=z(r);g.current=r;const v=z(n);v.current=n;const f=z(l);f.current=l;const i=z(!1),h=z(null),L=!!(e.url&&e.key),y="idx4:"+e.url,b=B(async(w,$={})=>{const x=m.current;if(!x.url||!x.key)throw{code:"not_connected"};let R;try{R=await fetch(x.url+"?"+new URLSearchParams({action:w,key:x.key,...$}),{redirect:"follow"})}catch{throw{code:"network"}}let E;try{E=await R.json()}catch{throw{code:"bad_response"}}if(E&&E.error)throw{code:E.error,message:E.error};return E},[]),N=B(async()=>{const w=await b("meta"),$=w.header||[],x=ut($);if(x.code===void 0&&x.barcode===void 0)throw{code:"no_columns",message:"The first row needs a GA_CODEARTICLE or BARCODE column."};const R={...f.current,header:$,map:x};return f.current=R,s(R),{m0:w,header:$,map:x}},[b]),S=B(async(w={})=>{if(i.current)return;i.current=!0;const $=f.current.syncedAt&&g.current?f.current:null;try{const{m0:x,header:R,map:E}=await N();if($&&!w.force&&(x.updated?x.updated===$.updated&&x.lastRow===$.lastRow:Date.now()-$.syncedAt<at)){const I={...f.current,checkedAt:Date.now()};f.current=I,s(I),le.set(y+":meta",I),p({kind:"ready"});return}const ce=[...new Set(dt.map(I=>E[I]).filter(I=>I!==void 0))].sort((I,ie)=>I-ie),ye={};ce.forEach((I,ie)=>{ye[I]=ie});const ee=Math.max(0,x.lastRow-1),me=[];for(let I=2;I<=x.lastRow;I+=Ae)me.push(I);const Je=new Array(me.length);let Qe=0,et=0;p({kind:"syncing",done:0,total:ee,quiet:!!$});const Ht=async()=>{for(;Qe<me.length;){const I=Qe++,ie=me[I],tt=await b("index",{start:ie,count:Ae,cols:ce.join(",")});Je[I]=pt(tt.rows||[],ie,ye,E),et+=(tt.rows||[]).length,p({kind:"syncing",done:Math.min(et,ee),total:ee,quiet:!!$}),await ke()}};await Promise.all(Array.from({length:Math.min(nt,me.length)},Ht));const Te=await mt(Je),Re={syncedAt:Date.now(),checkedAt:Date.now(),header:R,map:E,updated:x.updated||"",lastRow:x.lastRow};g.current=Te,f.current=Re,a(Te),s(Re),o([]),p({kind:"ready"}),le.set(y+":db",Te),le.set(y+":meta",Re)}catch(x){p(g.current&&w.quiet?{kind:"ready"}:{kind:"error",err:x})}finally{i.current=!1}},[b,y,N]);P(()=>{let w=!1;return(async()=>{if(!L){a(null),p({kind:"error",err:{code:"not_connected"}});return}p({kind:"loading"});const[$,x]=await Promise.all([le.get(y+":db"),le.get(y+":meta")]);w||($&&$.v===2&&x&&(g.current=$,f.current=x,a($),s(x),p({kind:"ready"})),(!($&&$.v===2&&x)||Date.now()-(x.checkedAt||x.syncedAt||0)>rt)&&S({quiet:!0}))})(),()=>{w=!0}},[y,L]),P(()=>{const w=()=>{const $=Ue();$&&t($)};return window.addEventListener("hashchange",w),()=>window.removeEventListener("hashchange",w)},[]),P(()=>{const w=()=>{!document.hidden&&g.current&&Date.now()-(f.current.checkedAt||0)>18e5&&S({quiet:!0})};return document.addEventListener("visibilitychange",w),()=>document.removeEventListener("visibilitychange",w)},[S]);const A=B(w=>{const $=Y(String(w).trim());if(!$)return null;const x=v.current.find(W=>Y(W.code)===$||Y(W.barcode)===$);if(x)return x;const R=g.current;if(!R)return null;const E=gt(R,w);return E>=0?Ne(R,E):null},[]),D=B(w=>{const $=g.current,x=$?ht($,w):-1;return x>=0?Ne($,x):v.current.find(R=>R.row===w)||null},[]),Z=(w,$)=>{const x={};return Object.keys(Oe).forEach(R=>{var E;x[R]=$.map[R]===void 0?"":String((E=w[$.map[R]])!=null?E:"").trim()}),x},Q=B(async w=>{f.current.header.length||await N();const $=f.current,x=await b("row",{row:w.row}),R=Z(x.values||[],$);if(R.code!==w.code)throw{code:"row_moved"};return R},[b,N]),u=B(async w=>{f.current.header.length||await N();const $=f.current,x=await b("find",{code:w});if(!x.row)return null;const R=await b("row",{row:x.row}),E=ft(R.values||[],$.map,x.row),W=[...v.current.filter(ce=>ce.row!==E.row),E];return v.current=W,o(W),E},[b,N]),C=B((w,$)=>{const x=g.current;w.idx>=0&&x&&x.rows[w.idx]===w.row&&("stock"in $&&(x.stock[w.idx]=$.stock),"retail"in $&&(x.retail[w.idx]=$.retail===""?NaN:$.retail))},[]),k=B(async w=>{h.current||(h.current=b("photos").then(R=>new Set(R.codes||[]),()=>"unknown"));const $=await h.current;if($!=="unknown"&&!$.has(w))return null;const x=await b("photo",{code:w});return x.data?"data:"+(x.type||"image/jpeg")+";base64,"+x.data:null},[b]),T=B(async(w,$)=>{const x=await new Promise((ce,ye)=>{const ee=new FileReader;ee.onload=()=>ce(String(ee.result).split(",")[1]),ee.onerror=ye,ee.readAsDataURL($)});let R;try{R=await fetch(m.current.url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({key:m.current.key,action:"photo",code:w,data:x})})}catch{throw{code:"network"}}const E=await R.json().catch(()=>({error:"bad_response"}));if(E.error)throw{code:E.error};const W=h.current&&await h.current;W&&W!=="unknown"&&W.add(w)},[]),q=w=>{K.set(V+":conn",w),t(w)},H=(r?r.n:0)+n.length;return{conn:e,saveConn:q,connected:L,db:r,extras:n,count:H,meta:l,status:d,sync:S,find:A,itemByRow:D,readRow:Q,findLive:u,patchLocal:C,getPhoto:k,savePhoto:T}}const kt=["ean_13","ean_8","upc_a","upc_e","code_128","code_39","code_93","itf","codabar","qr_code","data_matrix"];let Se=null,ae=null,Nt=0,be=null,pe=null;function He(){return Se||(Se=(async()=>{try{if(!("BarcodeDetector"in window))return null;const e=await window.BarcodeDetector.getSupportedFormats(),t=kt.filter(r=>e.includes(r));return t.length?new window.BarcodeDetector({formats:t}):null}catch{return null}})()),Se}function qe(){if(ae===null)try{ae=new Worker(st),ae.onerror=()=>{ae=!1}}catch{ae=!1}return ae}function xe(){He().then(e=>{e||qe()})}const J=document.createElement("canvas");function Ct(e,t){return new Promise(r=>{const a=++Nt,n=o=>{o.data.id===a&&(e.removeEventListener("message",n),r(o.data.text))};e.addEventListener("message",n),e.postMessage({id:a,width:t.width,height:t.height,buf:t.data.buffer},[t.data.buffer])})}function St(){return window.ZXing?Promise.resolve(window.ZXing):(be||(be=new Promise((e,t)=>{const r=document.createElement("script");r.src=ct,r.onload=()=>e(window.ZXing),r.onerror=()=>{be=null,t(new Error("zxing"))},document.head.appendChild(r)})),be)}function Lt(e,t){if(!pe){const l=new Map,s=e.BarcodeFormat;l.set(e.DecodeHintType.TRY_HARDER,!0),l.set(e.DecodeHintType.POSSIBLE_FORMATS,[s.EAN_13,s.EAN_8,s.UPC_A,s.UPC_E,s.CODE_128,s.CODE_39,s.CODE_93,s.ITF,s.CODABAR,s.QR_CODE,s.DATA_MATRIX]),pe=new e.MultiFormatReader,pe.setHints(l)}const{width:r,height:a}=t,n=t.getContext("2d",{willReadFrequently:!0}).getImageData(0,0,r,a).data,o=new Uint8ClampedArray(r*a);for(let l=0,s=0;s<o.length;l+=4,s++)o[s]=n[l]*77+n[l+1]*150+n[l+2]*29>>8;try{return pe.decodeWithState(new e.BinaryBitmap(new e.HybridBinarizer(new e.RGBLuminanceSource(o,r,a,r,a,0,0)))).getText()}catch{return null}finally{pe.reset()}}async function Le(e,t,r,{crop:a,maxSide:n}){const o=await He();if(o)try{const i=await o.detect(e);if(i&&i.length)return i[0].rawValue}catch{}let l=0,s=0,d=t,p=r;a&&(d=t*.9,p=r*.5,l=(t-d)/2,s=(r-p)/2);const m=Math.min(1,n/Math.max(d,p));J.width=Math.round(d*m),J.height=Math.round(p*m);const g=J.getContext("2d",{willReadFrequently:!0});g.drawImage(e,l,s,d,p,0,0,J.width,J.height);const v=qe();if(v)return Ct(v,g.getImageData(0,0,J.width,J.height));let f;try{f=await St()}catch{return null}return Lt(f,J)}const re={ctx:null};function Mt(){try{re.ctx=re.ctx||new(window.AudioContext||window.webkitAudioContext),re.ctx.state==="suspended"&&re.ctx.resume()}catch{}}function Tt(){if(!((K.get(V+":prefs")||{}).beep===!1||!re.ctx))try{const t=re.ctx,r=t.createOscillator(),a=t.createGain();r.type="sine",r.frequency.value=1568,a.gain.setValueAtTime(1e-4,t.currentTime),a.gain.exponentialRampToValueAtTime(.25,t.currentTime+.01),a.gain.exponentialRampToValueAtTime(1e-4,t.currentTime+.14),r.connect(a).connect(t.destination),r.start(),r.stop(t.currentTime+.15)}catch{}}const F=({d:e,size:t=22,sw:r=2,className:a=""})=>c`
    <svg width=${t} height=${t} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${r} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" className=${a}>
      ${[].concat(e).map((n,o)=>c`<path key=${o} d=${n} />`)}
    </svg>`,j={search:["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z","m20 20-3.5-3.5"],scan:["M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2","M7 8v8M10.5 8v8M14 8v8M17 8v8"],x:"M6 6l12 12M18 6 6 18",list:"M4 6h16M4 12h16M4 18h10",download:["M12 3v12m0 0-4-4m4 4 4-4","M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"],camera:["M4 8h3l2-3h6l2 3h3v11H4z","M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"],pin:["M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z","M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],clock:["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z","M12 7v5l3 2"]},oe={base:"inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border px-4 font-semibold transition-colors disabled:opacity-50",primary:"bg-accent text-accent-ink border-accent hover:brightness-110",plain:"bg-surface text-fg border-line hover:border-accent",danger:"bg-surface text-bad border-line hover:border-bad"},O=({kind:e="plain",className:t="",...r})=>c`<button type="button" className=${`${oe.base} ${oe[e]} ${t}`} ...${r} />`,Ve=({label:e,d:t,onClick:r,className:a=""})=>c`
    <button type="button" aria-label=${e} onClick=${r} className=${"grid place-items-center w-11 h-11 flex-none rounded-xl hover:bg-surface2 "+a}><${F} d=${t} /></button>`,Kt=({className:e,children:t})=>c`<span className=${"inline-block rounded-md px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide "+e}>${t}</span>`,Wt=({title:e,aside:t,children:r})=>c`
    <section className="mt-3 rounded-2xl border border-line bg-surface p-4">
      ${e&&c`<div className="mb-3 flex items-center gap-2"><h3 className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">${e}</h3>${t}</div>`}
      ${r}
    </section>`;function Ke({text:e,words:t}){if(!t.length||!e)return e||null;const r=new RegExp("("+t.map(a=>a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")+")","gi");return String(e).split(r).map((a,n)=>n%2?c`<mark key=${n} className="rounded bg-accent-soft px-px text-fg">${a}</mark>`:a)}function $e({onClose:e,title:t,sub:r,children:a}){return P(()=>{const n=o=>o.key==="Escape"&&e();return document.addEventListener("keydown",n),()=>document.removeEventListener("keydown",n)},[e]),c`
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick=${n=>n.target===n.currentTarget&&e()}>
        <div role="dialog" aria-modal="true" aria-label=${t} className="sheet-in gutter max-h-[92%] w-full max-w-[640px] overflow-y-auto rounded-t-3xl bg-bg pt-2 pb-safe">
          <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded bg-line"></div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[1.35rem] font-bold leading-tight [text-wrap:balance] break-words">${t}</h2>
              ${r&&c`<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">${r}</div>`}
            </div>
            <${Ve} label="Close" d=${j.x} onClick=${e} />
          </div>
          <div className="pb-6">${a}</div>
        </div>
      </div>`}function Rt({msg:e}){return e?c`<div role="status" className="fixed left-1/2 z-[70] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-xl bg-fg px-4 py-2.5 text-sm text-bg shadow-card" style=${{bottom:"calc(104px + env(safe-area-inset-bottom, 0px))"}}>${e.text}</div>`:null}const we={blocked:!1};function We({mode:e,children:t}){const r=e==="hit"?"vf-hit":e==="live"||e==="idle"?"vf-live":"",a=(n,o,l,s)=>c`<span className=${"vf-corner "+n} style=${{"--dx":o,"--dy":l,...s}}></span>`;return c`
      <div className=${"vf-mask relative overflow-hidden rounded-[22px] "+r+(e==="miss"?" shake":"")}
        style=${{width:"min(84vw, 360px)",height:"calc(min(84vw, 360px) * .625)","--vf-h":"calc(min(84vw, 360px) * .625)"}}>
        ${t}
        <div className="vf-grid"></div>
        ${(e==="live"||e==="idle"||e==="reading")&&c`<div className="vf-beam"></div>`}
        ${a("left-2 top-2 rounded-tl-[14px] border-l-[4px] border-t-[4px]","-3px","-3px",{borderRight:0,borderBottom:0})}
        ${a("right-2 top-2 rounded-tr-[14px] border-r-[4px] border-t-[4px]","3px","-3px",{borderLeft:0,borderBottom:0})}
        ${a("bottom-2 left-2 rounded-bl-[14px] border-b-[4px] border-l-[4px]","-3px","3px",{borderRight:0,borderTop:0})}
        ${a("bottom-2 right-2 rounded-br-[14px] border-b-[4px] border-r-[4px]","3px","3px",{borderLeft:0,borderTop:0})}
        ${e==="hit"&&c`<div className="absolute inset-0 grid place-items-center bg-[rgba(61,220,151,.18)]">
          <span className="pop grid h-16 w-16 place-items-center rounded-full bg-[#3ddc97] text-[#03140d] shadow-[0_0_40px_rgba(61,220,151,.8)]"><${F} d="M5 12.5l4.5 4.5L19 7.5" size=${34} sw=${3} /></span>
        </div>`}
      </div>`}function At({onClose:e,onCode:t,initialFile:r}){const a=!!r||we.blocked,n=z(null),o=z(null),l=z(null),[s,d]=M(a?"idle":"starting"),[p,m]=M(""),[g,v]=M(null),[f,i]=M(!1),[h,L]=M(""),[y,b]=M(0),N=z(!1),S=u=>{N.current||(N.current=!0,Ie(),Tt(),d("hit"),b(C=>C+1),setTimeout(()=>t(u),380))};P(()=>{if(a)return;let u=null,C=0,k=!1;const T=()=>{k=!0,clearTimeout(C),u&&u.getTracks().forEach(H=>H.stop()),u=null};(async()=>{try{if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error("nocam");if(u=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:!1}),k)return T();const H=n.current;H.srcObject=u,await H.play();const w=u.getVideoTracks()[0];l.current=w;try{await w.applyConstraints({advanced:[{focusMode:"continuous"}]})}catch{}try{const x=w.getCapabilities&&w.getCapabilities();x&&x.torch&&v(!1)}catch{}d("live");const $=async()=>{if(!k){if(!document.hidden&&H.videoWidth){const x=await Le(H,H.videoWidth,H.videoHeight,{crop:!0,maxSide:1200});if(x&&!k)return T(),S(x)}C=setTimeout($,120)}};$()}catch{T(),we.blocked=!0,d("idle"),xe()}})();const q=()=>{document.hidden&&e()};return document.addEventListener("visibilitychange",q),()=>{T(),document.removeEventListener("visibilitychange",q)}},[]),P(()=>{const u=C=>C.key==="Escape"&&e();return document.addEventListener("keydown",u),r?A(r):a&&xe(),()=>document.removeEventListener("keydown",u)},[]);async function A(u){const C=URL.createObjectURL(u);m(C),d("reading");try{let k,T,q;window.createImageBitmap?(k=await createImageBitmap(u),T=k.width,q=k.height):(k=new Image,k.src=C,await k.decode(),T=k.naturalWidth,q=k.naturalHeight);const H=await Le(k,T,q,{crop:!1,maxSide:1600})||await Le(k,T,q,{crop:!0,maxSide:1600});if(H)return S(H);d("miss")}catch{d("miss")}}const D=()=>o.current&&o.current.click(),Z=async()=>{try{await l.current.applyConstraints({advanced:[{torch:!g}]}),v(!g)}catch{v(null)}},Q={starting:"Starting camera\u2026",live:"Hold the barcode inside the frame",hit:"Got it",idle:"Tap the shutter to snap the barcode",reading:"Reading barcode\u2026",miss:"No barcode found. Get closer, keep the bars sharp and level, and snap again."}[s];return c`
      <div className="pt-safe pb-safe fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#020806] text-[#eef6f2]">
        <div className="pointer-events-none absolute inset-0 opacity-70" style=${{background:"radial-gradient(60% 40% at 50% 35%, rgba(61,220,151,.16), transparent 70%), radial-gradient(50% 35% at 60% 70%, rgba(46,197,216,.12), transparent 70%)"}}></div>
        <video ref=${n} playsInline muted className=${"absolute inset-0 h-full w-full object-cover transition-opacity duration-500 "+(s==="live"||s==="hit"?"opacity-100":"opacity-0")}></video>
        ${y>0&&c`<div key=${y} className="flash pointer-events-none absolute inset-0 z-10 bg-white"></div>`}

        <div className="gutter relative z-20 flex items-center justify-between py-2.5">
          <button type="button" onClick=${e} aria-label="Close scanner" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20"><${F} d=${j.x} /></button>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold tracking-wide backdrop-blur-md">${s==="live"||s==="hit"?"\u25CF LIVE":"SCAN"}</span>
          ${g!==null?c`<button type="button" onClick=${Z} aria-label=${g?"Turn flashlight off":"Turn flashlight on"} aria-pressed=${g}
              className=${"grid h-11 w-11 place-items-center rounded-full backdrop-blur-md "+(g?"bg-[#3ddc97] text-[#03140d]":"bg-white/10 hover:bg-white/20")}><${F} d=${j.bolt} /></button>`:c`<span className="h-11 w-11"></span>`}
        </div>

        <div className="relative z-20 grid min-h-0 flex-1 place-items-center">
          <div className="grid justify-items-center gap-5">
            <${We} mode=${s}>
              ${(s==="reading"||s==="miss")&&p&&c`<img src=${p} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />`}
              ${(s==="idle"||s==="starting")&&c`<div className="absolute inset-0 grid place-items-center">
                <div className="flex h-[46%] items-end gap-[5px] opacity-50" aria-hidden="true">
                  ${[3,1,2,1,4,1,2,3,1,1,3,2,1,4,1,2,1,3].map((u,C)=>c`<span key=${C} className="emblem-bar block h-full rounded-sm bg-white" style=${{width:u*2+"px",animationDelay:C*.08+"s"}}></span>`)}
                </div>
              </div>`}
            </${We}>
            <p className="max-w-[300px] text-center text-[15px] leading-snug [text-shadow:0_1px_6px_rgba(0,0,0,.8)]" role="status">${Q}</p>
          </div>
        </div>

        <div className="gutter relative z-20 grid justify-items-center gap-3 pb-4 pt-2">
          <input ref=${o} id="photo" type="file" accept="image/*" capture="environment" hidden onChange=${u=>{const C=u.target.files[0];u.target.value="",C&&A(C)}} />
          ${s!=="live"&&s!=="hit"&&s!=="starting"&&c`
            <button type="button" onClick=${D} aria-label="Snap barcode with camera" className="group relative grid h-[84px] w-[84px] place-items-center rounded-full border-[3px] border-white/80 fade-in">
              <span className="grad-fill block h-[66px] w-[66px] rounded-full transition-transform group-active:scale-90"></span>
            </button>`}
          ${f?c`
            <form className="flex w-full max-w-[420px] gap-2 fade-in" onSubmit=${u=>{u.preventDefault(),h.trim()&&S(h)}}>
              <input autoFocus value=${h} onChange=${u=>L(u.target.value)} inputMode="numeric" autoComplete="off" placeholder="Barcode or item code"
                aria-label="Type a barcode or item code" className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 font-mono text-base text-white backdrop-blur-md placeholder:text-white/70" />
              <button type="submit" className="rounded-2xl bg-white px-5 font-semibold text-[#03140d]">Find</button>
            </form>`:c`<button type="button" onClick=${()=>i(!0)} className="min-h-[44px] rounded-full px-4 text-[14px] text-white/75 underline-offset-4 hover:underline">Type the code instead</button>`}
          ${s==="idle"&&we.blocked&&c`<p className="max-w-[340px] text-center text-[12px] text-white/50">Camera access is off for this site. Allow the camera in your browser's site settings for live scanning, or snap a photo with the shutter.</p>`}
        </div>
      </div>`}Object.assign(j,{refresh:["M20 11a8 8 0 0 0-14.9-3.9L4 9","M4 4v5h5","M4 13a8 8 0 0 0 14.9 3.9L20 15","M20 20v-5h-5"],sheet:["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z","M3 9h18M3 15h18M9 3v18"],back:"M15 18l-6-6 6-6",more:["M5 12h.01M12 12h.01M19 12h.01"],sliders:["M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0","M16 4v4M10 10v4M18 16v4"],bolt:"M13 2 4 14h7l-1 8 9-12h-7l1-8Z",gear:["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z","M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"]});function Et(e){let t=String(e);if(/^\d{12}$/.test(t)&&(t="0"+t),!/^\d{13}$/.test(t))return null;const r=t.split("").map(Number);if((10-r.slice(0,12).reduce((p,m,g)=>p+m*(g%2?3:1),0)%10)%10!==r[12])return null;const n=["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"],o=n.map(p=>p.split("").map(m=>m==="1"?"0":"1").reverse().join("")),l=n.map(p=>p.split("").map(m=>m==="1"?"0":"1").join("")),s=["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"][r[0]];let d="101";for(let p=1;p<7;p++)d+=s[p-1]==="L"?n[r[p]]:o[r[p]];d+="01010";for(let p=7;p<13;p++)d+=l[r[p]];return d+="101",d}function _t({code:e}){const t=X(()=>Et(e),[e]);return t?c`<svg viewBox=${`0 0 ${t.length} 40`} preserveAspectRatio="none" className="h-14 w-full max-w-[260px]" aria-hidden="true">
      ${t.split("").map((r,a)=>r==="1"&&c`<rect key=${a} x=${a} y="0" width="1.02" height="40" fill="currentColor" />`)}
    </svg>`:null}function Dt(){const e=[3,1,2,1,4,1,1,3,2,1,1,4,2,1,3,1,2,1,4];let t=0;return c`<svg viewBox="0 0 150 120" className="h-[120px] w-[150px]" aria-hidden="true">
      <defs><linearGradient id="eg" x1="0" x2="1"><stop offset="0" stop-color="var(--accent)" /><stop offset="1" stop-color="var(--accent-2)" /></linearGradient></defs>
      ${e.map((r,a)=>{const n=c`<rect key=${a} className="emblem-bar" style=${{animationDelay:a*.09+"s"}} x=${t} y="4" width=${r*2.4} height="112" rx="1.2" fill="url(#eg)" />`;return t+=r*2.4+3.2,n})}
      <g className="emblem-beam"><rect x="-6" y="0" width="162" height="2.5" rx="1.25" fill="var(--laser)" /><rect x="-6" y="-10" width="162" height="10" fill="var(--laser)" opacity=".12" /></g>
    </svg>`}function It({sheet:e,onScan:t,onSearch:r,onSettings:a}){const n=e.status,o=n.kind==="error"?ge(n.err):null;return c`
      <div className="relative flex min-h-full flex-col overflow-hidden">
        <div className="aurora"></div>
        <header className="gutter pt-safe relative z-10 flex items-center justify-between" style=${{paddingTop:"calc(16px + env(safe-area-inset-top, 0px))"}}>
          <div className="min-w-0">
            <p className="font-display text-[1.15rem] font-extrabold leading-none tracking-tight">Stock Scanner</p>
            <p className="mt-1 truncate text-[11px] uppercase tracking-[.12em] text-muted">Farmers Trading Center</p>
          </div>
          <button type="button" onClick=${a} aria-label="Settings" className="relative grid h-11 w-11 place-items-center rounded-full border border-line bg-surface/70 backdrop-blur hover:border-accent">
            <${F} d=${j.gear} size=${20} />
            ${(n.kind==="syncing"||o)&&c`<span className=${"absolute right-2 top-2 h-2 w-2 rounded-full "+(o?"bg-bad":"bg-warn")}></span>`}
          </button>
        </header>

        <main className="gutter relative z-10 flex flex-1 flex-col items-center justify-center pb-10 pt-6 text-center">
          <div className="fade-in"><${Dt} /></div>
          <h1 className="mt-6 font-display text-[2.4rem] font-extrabold leading-[1.02] tracking-tight [text-wrap:balance]">Scan any <span className="grad-text">item</span></h1>
          <p className="mt-2 max-w-[300px] text-[15px] text-muted">Point your camera at a barcode for price, stock and details from your Google Sheet.</p>

          <div className="relative mt-10 h-[112px] w-[112px]">
            <span className="ring"></span><span className="ring"></span><span className="ring"></span>
            <button type="button" id="scanBtn" onClick=${t} aria-label="Scan a barcode"
              className="grad-fill relative grid h-full w-full place-items-center rounded-full text-accent-ink shadow-glow transition-transform active:scale-95">
              <${F} d=${j.scan} size=${42} sw=${2.2} />
            </button>
          </div>
          <p className="mt-3 text-[13px] font-semibold tracking-wide text-accent">Tap to scan</p>

          <button type="button" onClick=${r}
            className="mt-10 flex w-full max-w-[420px] items-center gap-3 rounded-2xl border border-line bg-surface/80 px-4 py-3.5 text-left text-muted shadow-card backdrop-blur hover:border-accent">
            <${F} d=${j.search} size=${20} />
            <span className="min-w-0 flex-1 truncate">Search <span className="hidden min-[360px]:inline">${e.count?e.count.toLocaleString()+" ":""}</span>items</span>
            <span className="flex items-center gap-1 rounded-lg bg-surface2 px-2 py-1 text-[12px] font-semibold"><${F} d=${j.sliders} size=${14} />Filters</span>
          </button>

          ${e.count>0&&n.kind!=="syncing"&&c`<p className="mt-3 text-[12px] text-muted tabular-nums">${e.count.toLocaleString()} items · checked ${he(e.meta.checkedAt||e.meta.syncedAt)}${typeof navigator!="undefined"&&navigator.onLine===!1?" \xB7 offline":""}</p>`}
          ${n.kind==="syncing"&&c`<div className="mt-5 w-full max-w-[420px] fade-in"><${Ze} s=${n} /></div>`}
          ${o&&c`<div className="mt-5 w-full max-w-[420px] rounded-2xl border border-bad bg-bad-soft p-3.5 text-left text-[13px] fade-in" role="alert">
            <b className="block text-bad">${o.title}</b><p className="mt-0.5">${o.text}</p>
            <${O} className="mt-2" onClick=${o.settings?a:()=>e.sync({force:!0})}>${o.settings?"Open settings":"Try again"}</${O}>
          </div>`}
        </main>
      </div>`}function Ze({s:e}){const t=e.total?Math.round(e.done/e.total*100):0;return e.quiet?c`<p className="text-[12px] text-muted tabular-nums" role="status">Updating the item list in the background… ${t}%</p>`:c`<div className="rounded-2xl border border-line bg-surface/80 px-3.5 py-2.5 text-left text-[12px] backdrop-blur" role="status">
      <div className="flex justify-between gap-2"><span>Getting items from Google Sheets…</span><span className="tabular-nums text-muted">${e.total?t+"%":""}</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface2"><div className="grad-fill h-full rounded-full transition-all duration-500" style=${{width:Math.max(4,t)+"%"}}></div></div>
    </div>`}function se({children:e,label:t}){return c`<div role="dialog" aria-modal="true" aria-label=${t} className="layer-in fixed inset-0 z-40 overflow-y-auto overflow-x-hidden bg-bg pt-safe pb-safe">${e}</div>`}const Me=({onClick:e,label:t="Back"})=>c`
    <button type="button" onClick=${e} aria-label=${t} className="grid h-11 w-11 flex-none place-items-center rounded-full border border-line bg-surface hover:border-accent"><${F} d=${j.back} /></button>`;function jt({db:e,filters:t,setFilters:r,onClose:a}){const[n,o]=M(t),[l,s]=M({}),d=React.useDeferredValue(n),p=X(()=>Pe(e,d),[e,d]),m=p.options,g=p.match,v=(i,h)=>o(L=>({...L,[i]:L[i]===h?"":h})),f=(i,h,L)=>c`<button type="button" key=${h} aria-pressed=${n[i]===h} onClick=${()=>v(i,h)}
      className=${"min-h-[38px] rounded-full border px-3.5 text-[13px] "+(n[i]===h?"border-transparent grad-fill text-accent-ink":"border-line bg-surface text-fg")}>
      ${h}${L!=null&&c`<span className="ml-1.5 font-mono text-[11px] opacity-70">${L.toLocaleString()}</span>`}</button>`;return c`<${$e} title="Filters" onClose=${a}>
      ${bt.map(([i,h])=>{const L=m[i];if(!L.length&&!n[i])return null;const y=fe(l[i]||""),b=(y?L.filter(([N])=>fe(N).includes(y)):L).slice(0,24);return n[i]&&!b.some(([N])=>N===n[i])&&b.unshift([n[i],null]),c`<section key=${i} className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted">${h}</h3>
            ${L.length>24&&c`<input value=${l[i]||""} onChange=${N=>s({...l,[i]:N.target.value})} placeholder=${"Find "+h.toLowerCase()}
              aria-label=${"Find "+h.toLowerCase()} className="w-[150px] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px]" />`}
          </div>
          <div className="flex flex-wrap gap-1.5">${b.map(([N,S])=>f(i,N,S))}</div>
        </section>`})}
      <section className="mt-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Stock</h3>
        <div className="flex flex-wrap gap-1.5">${[["in","In stock"],["out","Out of stock"]].map(([i,h])=>c`<button type="button" key=${i} aria-pressed=${n.stock===i} onClick=${()=>v("stock",i)}
          className=${"min-h-[38px] rounded-full border px-3.5 text-[13px] "+(n.stock===i?"border-transparent grad-fill text-accent-ink":"border-line bg-surface")}>${h}</button>`)}</div>
      </section>
      <section className="mt-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Retail price</h3>
        <div className="grid grid-cols-2 gap-2">
          <input id="pmin" type="number" inputMode="decimal" placeholder="Min $" value=${n.min} onChange=${i=>o({...n,min:i.target.value})} aria-label="Minimum price" className="rounded-xl border border-line bg-surface px-3 py-2.5 text-base" />
          <input id="pmax" type="number" inputMode="decimal" placeholder="Max $" value=${n.max} onChange=${i=>o({...n,max:i.target.value})} aria-label="Maximum price" className="rounded-xl border border-line bg-surface px-3 py-2.5 text-base" />
        </div>
      </section>
      <div className="sticky bottom-0 -mx-4 mt-5 flex gap-2 bg-bg px-4 py-3">
        <${O} className="flex-1" onClick=${()=>o(ue)}>Clear</${O}>
        <${O} kind="primary" className="flex-[2] grad-fill border-transparent" onClick=${()=>{r(n),a()}}>Show ${g.toLocaleString()} ${g===1?"item":"items"}</${O}>
      </div>
    </${$e}>`}function Xe({it:e,words:t,onOpen:r}){const a=e.stock<=0;return c`<button type="button" onClick=${()=>r(e)}
      className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-accent">
      <span className="min-w-0 break-words font-semibold"><${Ke} text=${e.name||e.code} words=${t} /></span>
      <span className="row-span-2 text-right">
        <b className="block font-display text-[1.15rem] leading-tight tabular-nums">${ne(e.retail)}</b>
        <span className=${"text-[12px] font-semibold tabular-nums "+(a?"text-bad":"text-accent")}>${a?"Out":De(e.stock)+" in stock"}</span>
      </span>
      <span className="flex min-w-0 flex-wrap gap-x-2.5 text-[12px] text-muted">
        <span className="break-all font-mono"><${Ke} text=${e.code} words=${t} /></span>
        ${e.f&&e.f.dept&&c`<span>${e.f.dept}${e.f.subdept?" \xB7 "+e.f.subdept:""}</span>`}
      </span>
    </button>`}function Ot(e,t,r){for(const n of G)if(t[n]!==""&&e.f[n]!==t[n])return!1;if(t.stock==="in"&&!(e.stock>0)||t.stock==="out"&&!(e.stock<=0)||t.min!==""&&!(_(e.retail)>=_(t.min))||t.max!==""&&!(_(e.retail)<=_(t.max)))return!1;const a=Y([e.code,e.barcode,e.name,e.brand].join(U));return r.every(n=>a.includes(Y(n)))}function Ft({sheet:e,recent:t,onOpen:r,onClose:a}){const{db:n,extras:o}=e,[l,s]=M(""),[d,p]=M(ue),[m,g]=M(!1),[v,f]=M(ve),i=React.useDeferredValue(l),h=X(()=>fe(i).split(/\s+/).filter(Boolean),[i]),L=xt(d),y=h.length>0||L>0;P(()=>f(ve),[i,d]);const b=X(()=>{if(!y||!n)return{total:0,ex:[],idx:[]};const u=wt(n,i,d),C=o.filter(k=>Ot(k,d,h));return{total:u.total+C.length,ex:C,idx:u.list}},[n,o,i,d,y]),N=X(()=>b.ex.concat(b.idx.slice(0,Math.max(0,v-b.ex.length)).map(u=>Ne(n,u))),[b,v]),S=b.ex.length+b.idx.length,A=X(()=>t.map(u=>e.itemByRow(u)).filter(Boolean).slice(0,8),[t,n]),D=X(()=>n?Pe(n,ue).options.dept.slice(0,12):[],[n]),Z=Object.entries(d).filter(([,u])=>u!==""),Q=(u,C)=>u==="stock"?C==="in"?"In stock":"Out of stock":u==="min"?"From $"+C:u==="max"?"Up to $"+C:C;return c`<${se} label="Search items">
      <h1 className="sr-only">Search items</h1>
      <div className="top-safe gutter sticky z-10 grid grid-cols-[minmax(0,1fr)] gap-2.5 bg-bg pb-3 pt-3">
        <div className="flex items-center gap-2">
          <${Me} onClick=${a} />
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl border border-line bg-surface pl-3 pr-1 shadow-card focus-within:border-accent">
            <span className="text-muted"><${F} d=${j.search} size=${20} /></span>
            <input id="q" autoFocus type="search" value=${l} onChange=${u=>s(u.target.value)} autoComplete="off" autoCorrect="off" spellCheck="false" enterKeyHint="search"
              placeholder="Name, code or barcode" aria-label="Search items by name, code or barcode"
              onKeyDown=${u=>{if(u.key==="Enter"){const C=e.find(u.target.value);C?(u.preventDefault(),r(C)):u.target.blur()}}}
              className="min-w-0 flex-1 bg-transparent py-3 pl-1 text-base outline-none" />
            ${l&&c`<${Ve} label="Clear search" d=${j.x} onClick=${()=>s("")} />`}
          </div>
          <button type="button" onClick=${()=>g(!0)} aria-label=${"Filters"+(L?`, ${L} on`:"")} disabled=${!n}
            className=${"relative grid h-12 w-12 flex-none place-items-center rounded-2xl border disabled:opacity-50 "+(L?"grad-fill border-transparent text-accent-ink":"border-line bg-surface")}>
            <${F} d=${j.sliders} size=${20} />
            ${L>0&&c`<span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-fg px-1 text-[11px] font-bold text-bg">${L}</span>`}
          </button>
        </div>
        ${Z.length>0&&c`<div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          ${Z.map(([u,C])=>c`<button type="button" key=${u} onClick=${()=>p({...d,[u]:""})} aria-label=${"Remove filter "+Q(u,C)}
            className="flex min-h-[34px] flex-none items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[13px] text-accent">${Q(u,C)}<${F} d=${j.x} size=${14} /></button>`)}
          <button type="button" onClick=${()=>p(ue)} className="min-h-[34px] flex-none px-2 text-[13px] text-muted underline">Clear all</button>
        </div>`}
        ${y&&c`<p className="text-[12px] text-muted tabular-nums" role="status">${b.total.toLocaleString()} ${b.total===1?"item":"items"}${S<b.total?` \xB7 showing the first ${S.toLocaleString()}, add a word or filter to narrow`:""}</p>`}
      </div>
      <div className="gutter pb-10">
        ${n?y?N.length?c`<div className="grid gap-2">${N.map(u=>c`<${Xe} key=${u.row} it=${u} words=${h} onOpen=${r} />`)}</div>
            ${S>v&&c`<${O} className="mt-3 w-full" onClick=${()=>f(v+ve)}>Show more (${Math.min(S,te)-v>0?(S-v).toLocaleString():0} left)</${O}>`}`:c`<div className="grid justify-items-center gap-2 py-12 text-center text-muted">
            <h2 className="font-display text-lg font-bold text-fg">Nothing matches</h2><p>Try fewer words or remove a filter.</p></div>`:c`<div className="fade-in grid gap-6 pt-2">
            ${A.length>0&&c`<section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Recently viewed</h2>
              <div className="grid gap-2">${A.map(u=>c`<${Xe} key=${u.row} it=${u} words=${[]} onOpen=${r} />`)}</div>
            </section>`}
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Browse by department</h2>
              <div className="flex flex-wrap gap-1.5">${D.map(([u,C])=>c`<button type="button" key=${u} onClick=${()=>p({...ue,dept:u})}
                className="min-h-[40px] rounded-full border border-line bg-surface px-3.5 text-[13px] hover:border-accent">${u}<span className="ml-1.5 font-mono text-[11px] text-muted">${C.toLocaleString()}</span></button>`)}</div>
            </section>
            <p className="text-[13px] text-muted">Tip: tap Filters to narrow by supplier, category, brand, stock or price.</p>
          </div>`:c`<div className="grid gap-2">${[0,1,2,3].map(u=>c`<div key=${u} className="skeleton h-[68px] rounded-2xl"></div>`)}</div>
          ${e.status.kind==="error"?c`<p className="mt-3 text-center text-[13px] text-muted">${ge(e.status.err).title}. Search will work once the item list has downloaded.</p>`:c`<p className="mt-3 text-center text-[13px] text-muted">Getting the item list…</p>`}`}
      </div>
      ${m&&n&&c`<${jt} db=${n} filters=${d} setFilters=${p} onClose=${()=>g(!1)} />`}
    </${se}>`}const Zt=e=>[...String(e)].map(t=>/[A-Za-z0-9_.-]/.test(t)?t:"~"+t.charCodeAt(0).toString(16)).join("");async function Bt(e){const t=await createImageBitmap(e),r=Math.min(1,1400/Math.max(t.width,t.height)),a=document.createElement("canvas");return a.width=Math.round(t.width*r),a.height=Math.round(t.height*r),a.getContext("2d").drawImage(t,0,0,a.width,a.height),new Promise(n=>a.toBlob(n,"image/jpeg",.82))}function Gt({it:e,sheet:t,onClose:r,onScan:a,toast:n}){const[o,l]=M(null),[s,d]=M(null),[p,m]=M(!1),[g,v]=M(null),[f,i]=M(!1),h=z(null),L=B(()=>{d(null),t.readRow(e).then(k=>{l(k);const T=_(k.stock),q=k.retail===""?"":_(k.retail);t.patchLocal(e,{stock:T,retail:q})},d)},[e.row]);P(()=>{t.connected?L():d({code:"not_connected"})},[e.row]),P(()=>{let k=!1;return t.connected&&t.getPhoto(e.code).then(T=>{!k&&T&&v({url:T})},()=>{}),()=>{k=!0}},[e.code]);async function y(k){i(!0),m(!1);try{const T=await Bt(k);await t.savePhoto(e.code,T),v({url:URL.createObjectURL(T)}),n("Photo saved to your Google Drive")}catch{n("Couldn't save the photo. Try again.")}i(!1)}const b=o||{},N=o?_(o.stock):e.stock,S=o?o.retail===""?"":_(o.retail):e.retail,A=o?o.pmap===""?"":_(o.pmap):e.pmap,D=N<=0,Z=S&&A!==""&&A>0?(S-A)/S*100:null,Q=k=>k&&k!=="-"&&k!=="#N/A"&&k!=="0",u=(k,T)=>Q(T)?c`<div key=${k} className="flex justify-between gap-3 border-b border-dashed border-line py-2.5 last:border-0"><dt className="text-muted">${k}</dt><dd className="break-all text-right font-mono">${T}</dd></div>`:null,C=(k,T)=>c`<div key=${k} className="min-w-0 rounded-xl bg-surface2 px-3 py-2.5"><small className="block truncate text-[11px] text-muted">${k}</small><b className="font-mono text-[1rem] tabular-nums">${T}</b></div>`;return c`<${se} label=${e.name||e.code}>
      <div className="top-safe gutter sticky z-10 flex items-center justify-between bg-bg/80 py-3 backdrop-blur">
        <${Me} onClick=${r} />
        <span className=${"rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide "+(o?"bg-accent-soft text-accent":"bg-surface2 text-muted")}>
          ${o?"\u25CF Live from sheet":s?"Saved list":"Checking sheet\u2026"}</span>
        <div className="relative">
          <button type="button" onClick=${()=>m(!p)} aria-label="More options" aria-expanded=${p} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface hover:border-accent"><${F} d=${j.more} sw=${3} /></button>
          ${p&&c`<div className="fade-in absolute right-0 top-12 z-20 w-[230px] overflow-hidden rounded-2xl border border-line bg-surface shadow-card" role="menu">
            ${t.connected&&c`<button type="button" role="menuitem" onClick=${()=>h.current.click()} className="block w-full px-4 py-3 text-left text-[14px] hover:bg-surface2">${g?"Replace item photo":"Add photo of item"}</button>`}
            <button type="button" role="menuitem" onClick=${()=>{m(!1),L()}} disabled=${!t.connected} className="block w-full px-4 py-3 text-left text-[14px] hover:bg-surface2">Re-check the sheet</button>
          </div>`}
          <input ref=${h} type="file" accept="image/*" capture="environment" hidden onChange=${k=>{const T=k.target.files[0];k.target.value="",T&&y(T)}} />
        </div>
      </div>

      <div className="gutter pb-12">
        ${(g||f)&&c`<div className="fade-in mt-1 overflow-hidden rounded-3xl border border-line bg-surface">
          ${f?c`<div className="skeleton aspect-[4/3] w-full max-w-full"></div>`:c`<img src=${g.url} alt=${"Photo of "+(e.name||e.code)} className="aspect-[4/3] w-full max-w-full object-cover" />`}
        </div>`}

        <section className="fade-in pt-3">
          <h1 className="font-display text-[1.9rem] font-extrabold leading-[1.08] tracking-tight [text-wrap:balance] break-words">${o&&o.name||e.name||e.code}</h1>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
            <span className="font-mono">${e.code}</span>
            ${b.dept&&c`<span>${b.dept}${b.subdept?" \xB7 "+b.subdept:""}</span>`}
            ${b.supplier&&c`<span>${b.supplier}</span>`}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-[1.25fr_1fr] gap-2.5">
          <div className="relative overflow-hidden rounded-3xl p-4 text-accent-ink grad-fill shadow-glow">
            <small className="text-[12px] font-semibold uppercase tracking-[.1em] opacity-80">Retail price</small>
            <b className="mt-1 block font-display text-[2.3rem] font-extrabold leading-none tabular-nums">${ne(S)}</b>
            ${b.gst&&c`<small className="mt-2 block text-[12px] opacity-80">${b.gst==="EXO"?"GST exempt":b.gst==="NOR"?"Includes standard GST":"Tax "+b.gst}</small>`}
          </div>
          <div className=${"rounded-3xl border p-4 "+(D?"border-bad bg-bad-soft":"border-line bg-surface")}>
            <small className="text-[12px] font-semibold uppercase tracking-[.1em] text-muted">In stock</small>
            <b className=${"mt-1 block font-display text-[2.3rem] font-extrabold leading-none tabular-nums "+(D?"text-bad":"text-fg")}>${De(N)}</b>
            <small className=${"mt-2 block text-[12px] "+(D?"text-bad":"text-muted")}>${D?"Out of stock":o&&o.tracked==="-"?"Not stock-tracked":"On hand"}</small>
          </div>
        </section>

        ${e.barcode&&c`<section className="mt-2.5 grid justify-items-center gap-1 rounded-3xl border border-line bg-surface px-4 py-4 text-fg">
          <${_t} code=${e.barcode} />
          <span className="font-mono text-[15px] tracking-[.18em]">${e.barcode}</span>
        </section>`}

        <section className="mt-2.5 rounded-3xl border border-line bg-surface p-4">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Prices</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            ${C("Trade",ne(o&&o.trade!==""?_(o.trade):""))}
            ${C("Avg cost (PMAP)",ne(A))}
            ${C("Last purchase",ne(o&&o.dpa!==""&&_(o.dpa)?_(o.dpa):""))}
            ${C("Margin",Z===null?"\u2014":Z.toFixed(1)+"%")}
            ${o&&_(o.uscost)?C("US cost",ne(_(o.uscost))):null}
          </div>
          ${!o&&!s&&c`<div className="mt-2 grid grid-cols-2 gap-2"><div className="skeleton h-12 rounded-xl"></div><div className="skeleton h-12 rounded-xl"></div></div>`}
        </section>

        ${o&&c`<section className="mt-2.5 rounded-3xl border border-line bg-surface px-4 pb-2 pt-4">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Details</h2>
          <dl className="text-[14px]">
            ${u("Supplier",o.supplier)}${u("Department",o.dept)}${u("Subdepartment",o.subdept)}${u("Brand",o.brand)}
            ${u("Category",o.category)}${u("Subcategory",o.subcategory)}${u("Item type",o.type)}${u("Reference",o.ref)}
            ${u("Collection",o.collection)}${u("By how many",o.byHowMany)}${u("Scale item",o.scale)}${u("Sheet row",String(e.row))}
          </dl>
        </section>`}

        ${s&&c`<p className="mt-3 rounded-2xl bg-surface2 px-4 py-3 text-[13px] text-muted">${s.code==="row_moved"?"This item has moved in the sheet. Refresh the list in Sheet settings to see its current numbers.":ge(s).title+". Showing numbers saved "+he(t.meta.syncedAt)+"."}</p>`}

        <button type="button" onClick=${a} className="grad-fill mt-6 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-accent-ink shadow-glow active:scale-[.98]">
          <${F} d=${j.scan} size=${22} />Scan next item</button>
      </div>
    </${se}>`}function Pt({code:e,syncing:t,onClose:r,onScan:a,onSearch:n}){return c`<${$e} title="Not in the sheet" sub=${c`<span className="font-mono">${e}</span>`} onClose=${r}>
      <p className="my-3 text-[14px] text-muted">${t?"The item list is still downloading and the sheet doesn't have this barcode yet. Wait a moment and scan again, or search by name.":"No item has this barcode or code. The barcode may be missing from the sheet, so try searching by name."}</p>
      <div className="grid grid-cols-2 gap-2"><${O} onClick=${n}>Search by name</${O}><${O} kind="primary" className="grad-fill border-transparent" onClick=${a}>Scan again</${O}></div>
    </${$e}>`}function Ye({id:e,label:t,...r}){return c`<div className="grid min-w-0 gap-1">
      <label htmlFor=${"f_"+e} className="text-[12px] font-semibold tracking-wide text-muted">${t}</label>
      <input id=${"f_"+e} name=${e} className="w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5 text-base" ...${r} />
    </div>`}function zt({sheet:e,onClose:t,toast:r}){const{conn:a,meta:n,status:o}=e,[l,s]=M(a.url),[d,p]=M(a.key),m=o.kind==="error"?ge(o.err):null,g=(f,i)=>c`<section className="mt-3 rounded-3xl border border-line bg-surface p-4">
      <h2 className="mb-2 font-display text-lg font-bold">${f}</h2>${i}</section>`,v=async()=>{const f=yt(a);try{await navigator.clipboard.writeText(f),r("Setup link copied")}catch{window.prompt&&window.prompt("Copy this setup link",f)}};return c`<${se} label="Settings">
      <div className="top-safe gutter sticky z-10 flex items-center gap-3 bg-bg py-3">
        <${Me} onClick=${t} /><h1 className="font-display text-xl font-extrabold">Settings</h1>
      </div>
      <div className="gutter pb-12">
        ${o.kind==="syncing"&&c`<${Ze} s=${o} />`}
        ${m&&c`<div className="rounded-2xl border border-bad bg-bad-soft p-3.5 text-[13px]" role="alert"><b className="block text-bad">${m.title}</b><p className="mt-0.5">${m.text}</p>
          ${m.retry&&c`<${O} className="mt-2" onClick=${()=>e.sync({force:!0})}>Try again</${O}>`}</div>`}
        ${g("Sheet connection",c`<form className="grid gap-3" onSubmit=${f=>{f.preventDefault();const h=Ce(l)||Ce(d)||{url:l.trim(),key:d.trim()};if(!ze(h.url)||!h.key){r("Paste the web app link (it starts with https://script.google.com) and the key.");return}s(h.url),p(h.key),e.saveConn(h),r("Connecting\u2026")}}>
          <${Ye} id="connUrl" label="Web app link (ends in /exec)" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck="false" value=${l} onChange=${f=>s(f.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
          <${Ye} id="connKey" label="Connection key" value=${d} onChange=${f=>p(f.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck="false" />
          <button type="submit" className=${`${oe.base} ${oe.primary} grad-fill border-transparent`}>Save and connect</button>
          ${e.connected&&c`<button type="button" onClick=${v} className=${`${oe.base} ${oe.plain}`}>Copy setup link for staff</button>
            <p className="text-[12px] text-muted">Send this link to staff. Opening it once on their phone connects the app, so they don't type anything. Treat it like a password: anyone with it can look up prices and costs.</p>`}
        </form>`)}
        ${e.connected&&g("Search list",c`
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
            <dt className="text-muted">Items</dt><dd className="tabular-nums">${e.count.toLocaleString()}</dd>
            <dt className="text-muted">Downloaded</dt><dd>${he(n.syncedAt)}</dd>
            <dt className="text-muted">Last checked</dt><dd>${he(n.checkedAt||n.syncedAt)}</dd>
            <dt className="text-muted">Item details</dt><dd>Read live when you open an item</dd>
          </dl>
          <${O} kind="primary" className="mt-3 w-full grad-fill border-transparent" disabled=${o.kind==="syncing"} onClick=${()=>e.sync({force:!0})}>
            <${F} d=${j.refresh} size=${18} />${o.kind==="syncing"?"Updating\u2026":"Update search list now"}</${O}>
          <p className="mt-2 text-[12px] text-muted">The app checks the sheet for changes whenever you open it and downloads again only when something changed. Scanning a barcode that isn't in the list yet checks the sheet directly. This app never changes the sheet.</p>`)}
        ${Object.keys(n.map||{}).length>0&&g("Columns found",c`<div className="flex flex-wrap gap-1.5 text-[12px]">
          ${Object.entries(n.map).sort((f,i)=>f[1]-i[1]).map(([f,i])=>c`<span key=${f} className="rounded-md bg-surface2 px-2 py-1 font-mono">${it(i)} · ${n.header[i]}</span>`)}
        </div>`)}
        ${g("Scanning",c`<label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-[14px]"><span>Beep when a barcode is read</span>
          <input id="beepToggle" type="checkbox" className="h-6 w-6 accent-[var(--accent)]" defaultChecked=${(K.get(V+":prefs")||{}).beep!==!1} onChange=${f=>K.set(V+":prefs",{...K.get(V+":prefs")||{},beep:f.target.checked})} /></label>`)}
        ${g("Install on your phone",c`<p className="text-[14px] text-muted">Add this app to your home screen so it opens full screen like a regular app. On iPhone: Share → Add to Home Screen. On Android: menu ⋮ → Add to Home screen.</p>`)}
        ${g("Barcode scanner guns",c`<p className="text-[14px] text-muted">Bluetooth and USB scanners work too. Pair the scanner as a keyboard, keep this app open and scan: the item opens on its own.</p>`)}
      </div>
    </${se}>`}function Ut(){const e=vt(),t=z(e);t.current=e;const r=X(()=>K.get(V+":prefs")||{},[]),[a,n]=M(null),[o,l]=M(null),[s,d]=M(r.recentRows||[]),[p,m]=M(null),g=z(null),v=B(y=>m({text:y,id:Date.now()}),[]);P(()=>{if(!p)return;const y=setTimeout(()=>m(null),2800);return()=>clearTimeout(y)},[p]),P(()=>{K.set(V+":prefs",{...K.get(V+":prefs")||{},recentRows:s})},[s]),P(()=>{const y="requestIdleCallback"in window?requestIdleCallback(xe):setTimeout(xe,800);return()=>"cancelIdleCallback"in window?cancelIdleCallback(y):clearTimeout(y)},[]);const f=B(y=>{n({kind:"item",item:y}),d(b=>[y.row,...b.filter(N=>N!==y.row)].slice(0,12))},[]),i=B(async y=>{const b=String(y).trim();if(l(null),!b)return;const N=t.current,S=N.find(b);if(S)return f(S);if(N.connected){m({text:"Checking the sheet\u2026",id:Date.now()});try{const A=await N.findLive(b);if(A)return m(null),f(A)}catch{}m(null)}n({kind:"notfound",code:b})},[f]),h=()=>{Mt(),we.blocked&&g.current?g.current.click():l({})};P(()=>{let y="",b=0;const N=S=>{const A=S.target;if(A&&/^(INPUT|TEXTAREA|SELECT)$/.test(A.tagName)&&A.id!=="q"||S.ctrlKey||S.metaKey||S.altKey)return;const D=performance.now();D-b>60&&(y=""),b=D,S.key==="Enter"?(y.length>=4&&(S.preventDefault(),Ie(),i(y)),y=""):S.key.length===1&&(y+=S.key)};return document.addEventListener("keydown",N,!0),()=>document.removeEventListener("keydown",N,!0)},[i]);const L=a&&a.kind==="item"?a.item:null;return c`
      <div className="mx-auto h-full max-w-[640px]">
        <${It} sheet=${e} onScan=${h} onSearch=${()=>n({kind:"search"})} onSettings=${()=>n({kind:"settings"})} />
      </div>
      <input ref=${g} type="file" accept="image/*" capture="environment" hidden onChange=${y=>{const b=y.target.files[0];y.target.value="",b&&l({file:b})}} />

      ${a&&a.kind==="search"&&c`<${Ft} sheet=${e} recent=${s} onOpen=${f} onClose=${()=>n(null)} />`}
      ${a&&a.kind==="settings"&&c`<${zt} sheet=${e} toast=${v} onClose=${()=>n(null)} />`}
      ${L&&c`<${Gt} key=${L.row} it=${L} sheet=${e} toast=${v} onClose=${()=>n(null)} onScan=${h} />`}
      ${a&&a.kind==="notfound"&&c`<${Pt} code=${a.code} syncing=${e.status.kind==="syncing"} onClose=${()=>n(null)} onScan=${()=>{n(null),h()}}
        onSearch=${()=>n({kind:"search"})} />`}
      ${o&&c`<${At} initialFile=${o.file} onClose=${()=>l(null)} onCode=${i} />`}
      <${Rt} msg=${p} />`}ReactDOM.createRoot(document.getElementById("root")).render(c`<${Ut} />`),"serviceWorker"in navigator&&addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}))})();
