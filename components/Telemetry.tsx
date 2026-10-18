import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useIntelligenceClient } from '@/lib/intelligence';
import { recordInteraction,screenForPath,setTelemetrySender,flushInteractions } from '@/lib/interaction-telemetry';
export function Telemetry(){
  const path=usePathname();const api=useIntelligenceClient();
  useEffect(()=>{setTelemetrySender(events=>api.request('/interactions/batch','POST',{events}));const timer=setInterval(()=>void flushInteractions(),15000);return()=>{clearInterval(timer);setTelemetrySender(null);};},[api]);
  useEffect(()=>{const started=Date.now();return()=>recordInteraction(screenForPath(path),'view',undefined,Math.min(Date.now()-started,86400000));},[path]);return null;
}
