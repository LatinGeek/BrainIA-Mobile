type Screen='today'|'explore'|'money'|'review'|'capture'|'detail'|'settings'|'intelligence';
type Action='view'|'search'|'open'|'capture'|'correct'|'review'|'ask'|'feedback'|'error';
type Event={id:string;sessionId:string;screen:Screen;action:Action;occurredAt:string;outcome?:'success'|'failure'|'cancelled';durationMs?:number};
const sessionId=`session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
let queue:Event[]=[];
let sender:((events:Event[])=>Promise<unknown>)|null=null;
let flushing=false;
export function setTelemetrySender(value:typeof sender){sender=value;}
export function recordInteraction(screen:Screen,action:Action,outcome?:Event['outcome'],durationMs?:number){
  queue.push({id:`${sessionId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,sessionId,screen,action,occurredAt:new Date().toISOString(),outcome,durationMs});
  queue=queue.slice(-100);
}
export async function flushInteractions(){
  if(!sender||flushing||!queue.length)return;
  flushing=true;const batch=queue.slice(0,50);
  try{await sender(batch);const ids=new Set(batch.map(e=>e.id));queue=queue.filter(e=>!ids.has(e.id));}catch{/* bounded in-memory retry, capture never waits */}finally{flushing=false;}
}
export function screenForPath(path:string):Screen{
  if(path==='/')return 'today';if(path.includes('search'))return 'explore';if(path.includes('financial'))return 'money';
  if(path.includes('review'))return 'review';if(path.includes('capture'))return 'capture';if(path.includes('settings'))return 'settings';
  return path.includes('intelligence')?'intelligence':'detail';
}
