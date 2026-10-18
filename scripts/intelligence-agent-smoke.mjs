import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl=process.argv[2] ?? 'http://127.0.0.1:8098';
const browser=await chromium.launch({headless:true});
const errors=[];const consoleErrors=[];const failedResponses=[];
const artifact={id:'ui-test',kind:'answer',objective:'¿Qué cambió esta semana?',status:'ready',conversation_id:'conversation-test',
  saved:false,user_notes:'',revision:1,updated_at:new Date().toISOString(),confirmedClaims:[],
  content:{title:'Una semana más clara',summary:'Hay una compra de café confirmada.',
    claims:[{id:'c1',kind:'inference',text:'La compra podría relacionarse con tu rutina de trabajo.',citations:[{evidenceId:'event:source-test',quote:'Compra de café confirmada.'}]}],
    uncertainty:['Una compra aislada no permite establecer un hábito.'],actions:[]},
  evidence:[{id:'event:source-test',eventIds:['source-test'],source:'Nota personal',title:'Café',text:'Compra de café confirmada.',occurredAt:new Date().toISOString()}]};
let generated=false;let feedback=false;let saved=false;
try{
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)failedResponses.push(`${response.status()} ${response.url()}`);});
  await page.addInitScript(url=>localStorage.setItem('brainia_mobile.baseUrl',url),baseUrl);
  await page.route('**/health',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.route('**/api/v1/**',async route=>{
    const req=route.request();const path=new URL(req.url()).pathname;const method=req.method();
    let body={};
    if(method==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}});
    if(path.endsWith('/capabilities'))body={enabled:true,learning:true,jev:'shadow'};
    else if(path.endsWith('/artifacts')){
      if(method==='POST'){assert.equal(req.postDataJSON().kind,'answer');generated=true;body=artifact;}
      else body={artifacts:generated?[artifact]:[]};
    }else if(path.endsWith('/feedback')){assert.equal(req.postDataJSON().value,'useful');feedback=true;body={ok:true};}
    else if(path.endsWith('/confirm')){artifact.confirmedClaims=req.postDataJSON().confirmed?['c1']:[];body={ok:true};}
    else if(path.endsWith('/ui-test')){
      if(method==='PATCH'){artifact.user_notes=req.postDataJSON().userNotes;artifact.saved=true;saved=true;body={id:artifact.id};}
      else body=artifact;
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await mkdir('output',{recursive:true});
  for(const width of [390,1024,1440,1920]){
    await page.setViewportSize({width,height:900});
    await page.goto(`${baseUrl}/intelligence`,{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByText('Tu conocimiento, conectado',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Analizar con mis fuentes',exact:true}).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Horizontal overflow at ${width}`);
    await page.screenshot({path:`output/intelligence-${width}.png`,fullPage:true});
  }
  await page.getByPlaceholder('¿Qué cambió en mis gastos y compromisos esta semana?').fill(artifact.objective);
  await page.getByRole('button',{name:'Analizar con mis fuentes',exact:true}).click();
  await page.waitForURL('**/intelligence/ui-test');
  await page.getByText('Una semana más clara',{exact:true}).waitFor();assert.ok(generated);
  await page.getByRole('button',{name:'Confirmar como conocimiento personal',exact:true}).click();
  await page.getByRole('button',{name:'Confirmado por ti · Deshacer',exact:true}).waitFor();
  await page.getByRole('button',{name:'Útil',exact:true}).click();
  await page.getByText('Gracias. Tu valoración mejora las próximas perspectivas.',{exact:true}).waitFor();assert.ok(feedback);
  await page.getByRole('textbox',{name:'Notas personales',exact:true}).fill('Quiero observar otra semana.');
  await page.getByRole('button',{name:'Guardar conocimiento',exact:true}).click();
  await page.getByText('Guardado en tu conocimiento.',{exact:true}).waitFor();assert.ok(saved);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'output/intelligence-detail-mobile.png',fullPage:true});
  assert.equal(await page.locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay').count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[],failedResponses.join('\n'));
  console.log('INTELLIGENCE_UI_OK: four widths, generation, citations, confirmation, feedback, notes; mocked API.');
}finally{await browser.close();}
