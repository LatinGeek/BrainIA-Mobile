import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
await mkdir('output/playwright',{recursive:true});
const taskTemp=resolve('output/playwright/tmp');
await mkdir(taskTemp,{recursive:true});
process.env.TEMP=taskTemp;
process.env.TMP=taskTemp;
process.env.TMPDIR=taskTemp;
const baseUrl=process.argv[2] || 'http://localhost:8094';
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(() => localStorage.setItem('brainia_mobile.baseUrl','http://127.0.0.1:4999'));
let mode='complete', taught=false;
const explanation = () => ({eventId:'detail-fixture',contentAvailable:mode!=='private',source:'notification',occurredAt:mode==='historical'?null:'2026-10-24T14:00:00Z',ingestedAt:'2026-10-24T14:01:00Z',evidence:mode==='private'?null:{title:'Aviso de compra',body:'Compra aprobada en Café del Centro por UYU 250.'},classification:{version:mode==='pending'?null:'rules-v1',model:null,provider:null,modelApplied:null,reason:null,hasAppliedCorrections:taught},fields:mode==='pending'?[]:[{type:'merchant',value:'Café del Centro'}],corrections:taught?[{field:'inferredKind',value:'expense',createdAt:'2026-10-24T15:00:00Z',reused:false}]:[],links:mode==='complete'?[{id:'tx-fixture',kind:'transaction',label:'Movimiento vinculado'}]:[]});
await context.route('**/api/**',async route=>{
 const url=new URL(route.request().url()); let data={};
 if(url.pathname.endsWith('/explanation') && mode.includes('unavailable')) return route.fulfill({status:404,contentType:'application/json',body:'{}'});
 if(url.pathname.endsWith('/explanation')) data=explanation();
 else if(url.pathname.endsWith('/events/detail-fixture')) data={id:'detail-fixture',source:'notification',kind:'notification',privacyStatus:mode.includes('private')?'private':'standard',title:'Aviso de compra',body:'Compra aprobada en Café del Centro por UYU 250.',displayTitle:mode==='pending'?'Actividad capturada':'Compra en Café del Centro',displayDescription:mode==='pending'?null:'Compra aprobada por UYU 250.',rawEventCreatedAt:'2026-10-24T14:01:00Z',timestamp:mode==='historical'?null:'2026-10-24T14:00:00Z',inferredKind:mode==='pending'?null:'expense',confidence:0.93};
 else if(url.pathname.endsWith('/capabilities')) data={learning:true,enabled:true};
 else if(url.pathname.endsWith('/jobs')) data={jobs:[]};
 else if(url.pathname.endsWith('/categories')) data={expense:['Alimentación'],income:[]};
 else if(url.pathname.endsWith('/classification/teach')) {taught=true;data={ok:true};}
 else if(url.pathname.includes('/financial/transactions/')) data={id:'tx-fixture',kind:'expense',amount:'250',currency:'UYU',merchantLabel:'Café del Centro',eventIds:['detail-fixture']};
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
});
const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(`${baseUrl}/event/detail-fixture`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByText('Compra aprobada por UYU 250.',{exact:true}).waitFor({timeout:120000});
 await page.getByRole('button',{name:'Contenido original',exact:true}).waitFor();
 assert.equal(await page.getByText('Compra aprobada en Café del Centro por UYU 250.',{exact:true}).count(),0);
 await page.screenshot({path:'output/playwright/event-summary.png',fullPage:true});
 await page.getByRole('button',{name:'Contenido original',exact:true}).click();
 await page.getByText('Compra aprobada en Café del Centro por UYU 250.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cómo se clasificó',exact:true}).click();
 await page.getByText('No se guardó un motivo de clasificación',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Campos y correcciones',exact:true}).click();
 await page.getByText('Compra aprobada en Café del Centro por UYU 250.',{exact:true}).evaluate(element => element.scrollIntoView({ block: 'center' }));
 await page.screenshot({path:'output/playwright/event-evidence.png',fullPage:true});
 await page.getByRole('button',{name:'Corregir y aprender',exact:true}).click();
 await page.getByRole('button',{name:'Guardar y enseñar a BrainIA',exact:true}).click();
 await page.getByRole('button',{name:'Campos y correcciones',exact:true}).click();
 await page.getByText('Corregido por ti',{exact:false}).waitFor();
 assert.ok(taught);
 await page.getByRole('button',{name:'Cerrar aviso',exact:true}).click();
 await page.getByText('Corregido por ti',{exact:false}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'output/playwright/event-corrected.png',fullPage:true});
 await page.getByRole('button',{name:'Movimiento vinculado',exact:true}).click();
 await page.waitForURL('**/transaction/tx-fixture');
 await page.goto(`${baseUrl}/event/detail-fixture`);
 console.log('COMPLETE_EVIDENCE_CORRECTION_OK');
 for(const variant of ['pending','historical','private','unavailable','private-unavailable']){
   mode=variant;taught=false;
   await page.reload({waitUntil:'domcontentloaded'});
   await page.getByRole('button',{name:'Contenido original',exact:true}).waitFor();
   if(variant==='pending') await page.getByText('La interpretación aún no está disponible',{exact:true}).waitFor();
   if(variant==='historical') await page.getByText('No registrada',{exact:true}).waitFor();
   if(variant.includes('private')) {await page.getByText('Actividad protegida',{exact:true}).waitFor();assert.equal(await page.getByText('Compra aprobada por UYU 250.',{exact:true}).count(),0);}
   if(variant.includes('unavailable')) {
     await page.getByText('Explicación no disponible',{exact:true}).waitFor();
     await page.getByRole('button',{name:'Contenido original',exact:true}).click();
     if(variant==='unavailable') await page.getByText('Compra aprobada en Café del Centro por UYU 250.',{exact:true}).waitFor();
     else {await page.getByText('El contenido no está disponible con la información de privacidad actual.',{exact:true}).waitFor();assert.equal(await page.getByText('Compra aprobada en Café del Centro por UYU 250.',{exact:true}).count(),0);}
   }
   await page.screenshot({path:`output/playwright/event-${variant}.png`,fullPage:true});
   console.log(variant.toUpperCase()+'_OK');
 }
 assert.deepEqual(errors,[]);
} catch (error) {
 await page.screenshot({path:'output/playwright/event-smoke-failure.png',fullPage:true});
 console.error(await page.locator('body').innerText());
 throw error;
} finally {await browser.close();}
