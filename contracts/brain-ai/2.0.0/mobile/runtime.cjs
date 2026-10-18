// Mobile adaptation: canonical() and semantic checks copied from the approved
// B02-r3 sealed sources. Parity against every approved schema/canonical fixture
// is required by mobile/verify.mjs.
const validators = require('../validators.cjs');
function utf8(text) {
  const out=[];
  for (const char of text) {
    const c=char.codePointAt(0);
    if(c<128)out.push(c);
    else if(c<2048)out.push(192|(c>>6),128|(c&63));
    else if(c<65536)out.push(224|(c>>12),128|((c>>6)&63),128|(c&63));
    else out.push(240|(c>>18),128|((c>>12)&63),128|((c>>6)&63),128|(c&63));
  }
  return out;
}
// FIPS 180-4 SHA-256 over UTF-8; no Node, browser crypto or native dependency.
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const rotr=(v,n)=>(v>>>n)|(v<<(32-n));
function sha256(text) {
 const data=utf8(text),length=data.length*8;
 data.push(128);while(data.length%64!==56)data.push(0);
 const high=Math.floor(length/4294967296),low=length>>>0;
 for(const n of [high,low])for(let s=24;s>=0;s-=8)data.push((n>>>s)&255);
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
 for(let offset=0;offset<data.length;offset+=64){
  const w=new Int32Array(64);
  for(let i=0;i<16;i++){const j=offset+i*4;w[i]=(data[j]<<24)|(data[j+1]<<16)|(data[j+2]<<8)|data[j+3];}
  for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotr(a,7)^rotr(a,18)^(a>>>3))+w[i-7]+(rotr(b,17)^rotr(b,19)^(b>>>10)))|0;}
  let [a,b,c,d,e,f,g,z]=h;
  for(let i=0;i<64;i++){const t1=(z+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+w[i])|0;const t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))|0;z=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
  [a,b,c,d,e,f,g,z].forEach((n,i)=>{h[i]=(h[i]+n)|0;});
 }
 return h.map(n=>(n>>>0).toString(16).padStart(8,'0')).join('');
}
function canonical(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw Error('Nonfinite JSON number');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(++i);
        if (!(next >= 0xdc00 && next <= 0xdfff)) throw Error('Lone surrogate');
      } else if (code >= 0xdc00 && code <= 0xdfff) throw Error('Lone surrogate');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value === 'object') return '{' + Object.keys(value).sort().map(k => canonical(k) + ':' + canonical(value[k])).join(',') + '}';
  throw Error('Not JSON');
}
const fingerprintInput = e => ({ changeKind: e.changeKind, content: e.content, sourceOccurredAt: e.sourceOccurredAt ?? null, sourceUpdatedAt: e.sourceUpdatedAt ?? null });
const fingerprint = e => sha256(canonical(fingerprintInput(e)));
const bytes=value=>utf8(JSON.stringify(value)).length;
function semantic(name,value){
  // These cannot be expressed portably in JSON Schema: byte lengths, int64,
  // fingerprint recomputation, decimal comparisons and cross-field policy.
  canonical(value); // Reject invalid Unicode everywhere, including raw keys.
  if(name==='Envelope'){
    if(BigInt(value.producerSequence)>9223372036854775807n) return false;
    if(bytes(value)>65536 || (value.content.title!==null && utf8(value.content.title).length>1024) || (value.content.body!==null && utf8(value.content.body).length>49152))return false;
    if(fingerprint(value)!==value.contentFingerprint)return false;
    if(value.content.type==='location'){
      const c=value.content;
      if(compare(c.latitude,'-90')<0 || compare(c.latitude,'90')>0 || compare(c.longitude,'-180')<0 || compare(c.longitude,'180')>0 || Date.parse(c.intervalEnd)<Date.parse(c.intervalStart))return false;
    }
    if(value.content.type==='activity'){
      const c=value.content;
      if(Date.parse(c.interval.end)<Date.parse(c.interval.start))return false;
    }
  }
  if(name==='BatchRequest')return bytes(value)<=1048576&&value.items.every(e=>valid('Envelope',e));
  if(name==='BatchResponse')return value.results.every((r,i)=>r.index===i&&(r.status>=400?(r.deliveryId===null||typeof r.deliveryId==='string'):r.deliveryId===r.receipt.deliveryId));
  if(name==='PolicyRequest'||name==='PolicyResponse')return value.externalModelsAllowed||!value.externalEmbeddingsAllowed;
  if(name==='Fact'){
    const e=value.evidence;
    if((e.start===null)!==(e.end===null))return false;
    if(e.start!==null&&e.end<=e.start)return false;
  }
  if(name==='Episode'||name==='EpisodeDetail')return value.endAt===null||Date.parse(value.endAt)>=Date.parse(value.startAt);
  if(name==='QueryRequest'){
    const f=value.filters;
    return !(f.from&&f.to)||Date.parse(f.from)<=Date.parse(f.to);
  }
  if(name==='FinancialTransaction')return value.adjustments.every(a=>a.currency===value.currency);
  if(name==='FinancialSummary'){
    const span=Date.parse(value.to)-Date.parse(value.from);
    return span>=0&&span<=366*86400000;
  }
  if(name==='FinancialSummaryQuery'){
    const span=Date.parse(value.to)-Date.parse(value.from);
    return span>=0&&span<=366*86400000;
  }
  return true;
}
function valid(name,value){try{return !!validators[name](value)&&semantic(name,value);}catch{return false;}}
function scaled(value){const neg=value.startsWith('-');const [integer,fraction='']=value.replace(/^-/,'').split('.');const n=BigInt(integer)*1000000n+BigInt(fraction.padEnd(6,'0'));return neg?-n:n;}
function compare(a,b){const x=scaled(a),y=scaled(b);return x<y?-1:x>y?1:0;}

function assertContract(name,value) {
 if(!valid(name,value))throw new Error('Invalid v2 contract: '+name);
 return value;
}
function acceptsReceipt(status,envelope,receipt) {
 return [200,201].includes(status)&&valid('Receipt',receipt)&&['deliveryId','producerRevisionId','contentFingerprint'].every(k=>envelope[k]===receipt[k]);
}
module.exports={canonical,sha256,fingerprint,valid,assertContract,acceptsReceipt};
