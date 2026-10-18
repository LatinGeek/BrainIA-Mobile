import { useCallback,useEffect,useState } from 'react';
import { Text,View } from 'react-native';
import { AppScreen,TopBar } from '@/components/layout';
import { Button,FilterChip,Panel } from '@/components/primitives';
import { useIntelligenceClient } from '@/lib/intelligence';
import { useTheme } from '@/lib/app-state';
type Correction={id:string;event_id:string;field:string;value:string};
type Preview={id:string;changes:{eventId:string;title?:string;field:string;value:string}[]};
export default function LearningScreen(){
  const api=useIntelligenceClient();const theme=useTheme();const [items,setItems]=useState<Correction[]>([]);
  const [enabled,setEnabled]=useState<boolean|null>(null);
  const [preview,setPreview]=useState<Preview|null>(null);const [selected,setSelected]=useState<string[]>([]);
  const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);const [applied,setApplied]=useState('');
  const load=useCallback(()=>api.request<{corrections:Correction[]}>('/classification/corrections').then(r=>setItems(r.corrections)).catch(e=>setStatus(e.message)),[api]);
  useEffect(()=>{let active=true;api.request<{learning:boolean}>('/intelligence/capabilities').then(result=>{
    if(!active)return;setEnabled(result.learning);if(result.learning)void load();
  }).catch(()=>{if(active)setEnabled(false);});return()=>{active=false;};},[api,load]);
  async function prepare(id:string){setBusy(true);try{const p=await api.request<Preview>(`/classification/corrections/${id}/preview`,'POST');setPreview(p);setSelected([]);setStatus('Selecciona los eventos que quieres actualizar.');}catch(e){setStatus(e instanceof Error?e.message:'No se pudo preparar.');}finally{setBusy(false);}}
  async function apply(){if(!preview)return;setBusy(true);try{await api.request(`/classification/reclassification/${preview.id}/apply`,'POST',{eventIds:selected});setApplied(preview.id);setPreview(null);setStatus('Historial actualizado. Puedes deshacer este cambio.');}catch(e){setStatus(e instanceof Error?e.message:'No se pudo aplicar.');}finally{setBusy(false);}}
  async function undo(id:string,run=false){setBusy(true);try{await api.request(`/classification/${run?'reclassification':'corrections'}/${id}/undo`,'POST');setStatus('Cambio deshecho.');if(run)setApplied('');await load();}catch(e){setStatus(e instanceof Error?e.message:'No se pudo deshacer.');}finally{setBusy(false);}}
  return <AppScreen onRefresh={()=>void load()}><TopBar title="Lo que Brain IA aprendió" subtitle="Tus correcciones guían eventos futuros. Tú decides cuándo actualizar el pasado." showBack/>
    {enabled===false?<Panel><Text style={[theme.typography.body,{color:theme.colors.textSecondary}]}>El aprendizaje confirmado todavía no está habilitado en este backend.</Text></Panel>:null}
    {status?<Text accessibilityLiveRegion="polite" style={[theme.typography.body,{color:theme.colors.textSecondary}]}>{status}</Text>:null}
    {applied?<Button label="Deshacer actualización del historial" disabled={busy} onPress={()=>void undo(applied,true)}/>:null}
    {preview?<Panel style={{gap:12}}><Text style={[theme.typography.headline,{color:theme.colors.textPrimary}]}>{preview.changes.length} eventos equivalentes</Text>
      {preview.changes.map((c,i)=><FilterChip key={c.eventId} label={`${c.title || `Evento ${i+1}`} → ${c.value}`} selected={selected.includes(c.eventId)} onPress={()=>setSelected(current=>current.includes(c.eventId)?current.filter(id=>id!==c.eventId):[...current,c.eventId])}/>)}
      <Button label={`Aplicar a ${selected.length} eventos`} disabled={busy||!selected.length} onPress={()=>void apply()}/><Button label="Cerrar vista previa" variant="ghost" onPress={()=>setPreview(null)}/>
    </Panel>:null}
    {enabled&&!items.length?<Text style={[theme.typography.body,{color:theme.colors.textSecondary}]}>Las correcciones confirmadas aparecerán aquí.</Text>:null}
    {items.map(item=><Panel key={item.id} style={{gap:12}}><Text style={[theme.typography.overline,{color:theme.colors.accent}]}>{item.field==='merchant'?'Comercio':item.field==='category'?'Categoría':'Tipo de evento'}</Text><Text style={[theme.typography.headline,{color:theme.colors.textPrimary}]}>{item.value}</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><Button label="Revisar historial equivalente" variant="secondary" onPress={()=>void prepare(item.id)} disabled={busy}/><Button label="Deshacer aprendizaje" variant="ghost" onPress={()=>void undo(item.id)} disabled={busy}/></View>
    </Panel>)}
  </AppScreen>;
}
