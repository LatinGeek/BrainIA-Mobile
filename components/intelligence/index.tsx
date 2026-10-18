import { router,useFocusEffect } from 'expo-router';
import { useCallback,useState } from 'react';
import { Pressable,Text,View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/app-state';
import { type Artifact,useIntelligenceClient } from '@/lib/intelligence';
import { Button,Panel } from '@/components/primitives';

export const statusLabels:Record<string,string>={queued:'En espera',running:'Analizando tus fuentes',ready:'Con evidencia',insufficient:'Información insuficiente',failed:'Análisis interrumpido',cancelled:'Cancelado',stale:'Hay información nueva'};
export function ArtifactCard({artifact}:{artifact:Artifact}) {
  const theme=useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={artifact.content?.title ?? artifact.objective}
    onPress={()=>router.push(`/intelligence/${artifact.id}`)} style={({pressed})=>({opacity:pressed?.75:1})}>
    <Panel style={{gap:12}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',gap:12}}>
        <Text style={[theme.typography.overline,{color:theme.colors.accentStrong}]}>{artifact.kind==='page'?'Conocimiento':artifact.kind==='weekly'?'Tu semana':artifact.kind==='daily'?'Tu día':'Respuesta'}</Text>
        <Feather name="arrow-up-right" size={18} color={theme.colors.textMuted}/>
      </View>
      <Text style={[theme.typography.headline,{color:theme.colors.textPrimary}]}>{artifact.content?.title ?? artifact.objective}</Text>
      {artifact.content?.summary?<Text numberOfLines={3} style={[theme.typography.body,{color:theme.colors.textSecondary}]}>{artifact.content.summary}</Text>:null}
      <Text style={[theme.typography.caption,{color:artifact.status==='stale'?theme.colors.warning:theme.colors.textMuted}]}>{statusLabels[artifact.status] ?? artifact.status}</Text>
    </Panel>
  </Pressable>;
}
export function IntelligenceOverview() {
  const api=useIntelligenceClient();const theme=useTheme();
  const [items,setItems]=useState<Artifact[]>([]);const [failed,setFailed]=useState(false);
  const load=useCallback(()=>api.list().then(r=>{setItems(r.artifacts);setFailed(false);}).catch(()=>setFailed(true)),[api]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const active=items.filter(a=>a.status==='queued'||a.status==='running');
  return <View style={{gap:12}}>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
      <Text style={[theme.typography.headline,{color:theme.colors.textPrimary}]}>Tu perspectiva, más clara</Text>
      <Button label="Preguntar a Brain IA" variant="secondary" onPress={()=>router.push('/intelligence')}/>
    </View>
    {active.length?<View style={{gap:10}}>
      <Text style={[theme.typography.overline,{color:theme.colors.accentStrong}]}>ANÁLISIS EN CURSO</Text>
      {active.slice(0,2).map(a=><ArtifactCard key={a.id} artifact={a}/>)}</View>:null}
    {items.filter(a=>(a.kind==='daily'||a.kind==='weekly')&&!active.some(activeArtifact=>activeArtifact.id===a.id)).slice(0,3).map(a=><ArtifactCard key={a.id} artifact={a}/>)}
    {!items.length?<Text style={[theme.typography.body,{color:theme.colors.textSecondary}]}>{failed?'No pudimos actualizar tu perspectiva.':'Conecta lo que sabes. Explora preguntas, cambios y decisiones con tus propias fuentes.'}</Text>:null}
    {failed?<Button label="Reintentar" variant="ghost" onPress={()=>void load()}/>:null}
  </View>;
}
