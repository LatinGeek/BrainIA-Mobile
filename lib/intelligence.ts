import { useMemo } from 'react';
import { useAppState } from './app-state';
export type Artifact = {
  id:string;kind:'answer'|'page'|'daily'|'weekly';objective:string;status:string;conversation_id:string|null;
  saved:boolean;user_notes:string;revision:number;updated_at:string;confirmedClaims?:string[];
  content:null|{title:string;summary:string;claims:{id:string;text:string;kind:'fact'|'calculation'|'inference';citations:{evidenceId:string;quote:string}[]}[];uncertainty:string[];actions:string[]};
  evidence:{id:string;title:string;source:string;text:string;eventIds:string[];occurredAt:string}[];
};
export function useIntelligenceClient() {
  const {settings}=useAppState();
  return useMemo(()=>{
    async function request<T>(path:string,method='GET',body?:unknown):Promise<T> {
      // React Native exposes a window-like global, but it does not guarantee a
      // browser Location object. Resolve the origin defensively so native
      // intelligence requests do not crash before reaching the API.
      const browserOrigin=typeof window==='undefined'||typeof window.location?.origin!=='string'?'':window.location.origin;
      if(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(browserOrigin)
        && /^https:\/\/brain-ia-six\.vercel\.app\/?$/.test(settings.baseUrl)) {
        if(path==='/intelligence/artifacts'&&method==='GET')return {artifacts:[]} as T;
        if(path==='/intelligence/capabilities')return {enabled:false,learning:false,jev:'off'} as T;
        if(path==='/interactions/batch')return {ok:true} as T;
        throw new Error('Conecta un backend local en Ajustes para usar el análisis en esta vista previa.');
      }
      const response=await fetch(`${settings.baseUrl.replace(/\/$/,'')}/api/v1${path}`,{method,
        headers:{'Content-Type':'application/json',...(settings.apiKey?{'x-brainia-api-key':settings.apiKey}:{}),...(settings.clientId?{'x-brainia-client-id':settings.clientId}:{})},
        ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(response.status===503?'La inteligencia todavía no está habilitada.':response.status===401?'Configura tu conexión en Ajustes.':'No se pudo completar la solicitud. Intenta nuevamente.');
      return response.json();
    }
    return {request,list:()=>request<{artifacts:Artifact[]}>('/intelligence/artifacts'),
      get:(id:string)=>request<Artifact>(`/intelligence/artifacts/${encodeURIComponent(id)}`),
      create:(input:{kind:Artifact['kind'];objective:string;parentId?:string;conversationId?:string})=>request<Artifact>('/intelligence/artifacts','POST',input),
      action:(id:string,action:string,body?:unknown)=>request(`/intelligence/artifacts/${encodeURIComponent(id)}/${action}`,'POST',body),
      save:(id:string,body:{saved?:boolean;userNotes?:string})=>request(`/intelligence/artifacts/${encodeURIComponent(id)}`,'PATCH',body),
    };
  },[settings.baseUrl,settings.apiKey,settings.clientId]);
}
