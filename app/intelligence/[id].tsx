import { router,useLocalSearchParams } from 'expo-router';
import { useCallback,useEffect,useState } from 'react';
import { ActivityIndicator,Text,View } from 'react-native';
import { AppScreen,TopBar,Section } from '@/components/layout';
import { Button,Panel,Input } from '@/components/primitives';
import { statusLabels } from '@/components/intelligence';
import { useTheme } from '@/lib/app-state';
import { useIntelligenceClient,type Artifact } from '@/lib/intelligence';
import { recordInteraction } from '@/lib/interaction-telemetry';

export default function KnowledgeDetail(){
  const {id}=useLocalSearchParams<{id:string}>();const api=useIntelligenceClient();const theme=useTheme();
  const [artifact,setArtifact]=useState<Artifact|null>(null);const [error,setError]=useState('');
  const [question,setQuestion]=useState('');const [noteDraft,setNoteDraft]=useState<{id:string;text:string}|null>(null);const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
  const notes=noteDraft?.id===id?noteDraft.text:artifact?.user_notes ?? '';
  const setNotes=(text:string)=>setNoteDraft({id,text});
  const load=useCallback((silent=false)=>api.get(id).then(a=>{setArtifact(a);setError('');}).catch(e=>{
    // Polling is best-effort: keep a queued analysis visible and retry on the
    // next interval instead of presenting a transient database wait as a
    // failed analysis.
    if(!silent)setError(e instanceof Error?e.message:'No se pudo cargar.');
  }),[api,id]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{if(!artifact||!['queued','running'].includes(artifact.status))return;const timer=setInterval(()=>void load(true),6000);return()=>clearInterval(timer);},[artifact,load]);
  const action=async(name:string,body?:unknown)=>{setBusy(true);try{await api.action(id,name,body);if(name==='feedback')recordInteraction('intelligence','feedback','success');setNotice(name==='feedback'?'Gracias. Tu valoración mejora las próximas perspectivas.':'Listo.');await load();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar.');}finally{setBusy(false);}};
  const ask=async()=>{setBusy(true);try{const a=await api.create({kind:'answer',objective:question,parentId:artifact?.conversation_id?id:undefined,conversationId:artifact?.conversation_id ?? undefined});router.push(`/intelligence/${a.id}`);}catch(e){setError(e instanceof Error?e.message:'No se pudo iniciar.');}finally{setBusy(false);}};
  const save=async()=>{setBusy(true);try{await api.save(id,{saved:true,userNotes:notes});setNotice('Guardado en tu conocimiento.');await load();}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}};
  return <AppScreen onRefresh={()=>void load()}>
    <TopBar title={artifact?.content?.title ?? 'Construyendo una perspectiva'} subtitle={artifact?statusLabels[artifact.status]:undefined} showBack/>
    {error?<Text accessibilityRole="alert" style={{color:theme.colors.danger}}>{error}</Text>:null}
    {notice?<Text accessibilityLiveRegion="polite" style={{color:theme.colors.success}}>{notice}</Text>:null}
    {artifact&&['queued','running'].includes(artifact.status)?<Panel style={{gap:16}}><ActivityIndicator color={theme.colors.accent}/><Text style={[theme.typography.body,{color:theme.colors.textSecondary}]}>Buscando evidencia, conectando información y verificando conclusiones. Puedes salir y volver más tarde.</Text><Button label="Cancelar análisis" variant="secondary" onPress={()=>void action('cancel')} disabled={busy}/></Panel>:null}
    {artifact&&['failed','stale','cancelled'].includes(artifact.status)?<Button label="Actualizar análisis" onPress={()=>void action('refresh')} disabled={busy}/>:null}
    {artifact?.content?<>
      <Text style={[theme.typography.headline,{color:theme.colors.textPrimary}]}>{artifact.content.summary}</Text>
      {artifact.content.claims.map(claim=><Panel key={claim.id} style={{gap:12}}>
        <Text style={[theme.typography.overline,{color:claim.kind==='inference'?theme.colors.warning:theme.colors.accentStrong}]}>{claim.kind==='inference'?'Hipótesis':claim.kind==='calculation'?'Cálculo verificado':'Observación'}</Text>
        <Text style={[theme.typography.body,{color:theme.colors.textPrimary}]}>{claim.text}</Text>
        {claim.kind==='inference'&&artifact.status==='ready'?<Button
          label={artifact.confirmedClaims?.includes(claim.id)?'Confirmado por ti · Deshacer':'Confirmar como conocimiento personal'}
          variant="secondary" disabled={busy} onPress={()=>void action('confirm',{claimId:claim.id,revision:artifact.revision,confirmed:!artifact.confirmedClaims?.includes(claim.id)})}/>:null}
        {claim.citations.map((citation,index)=>{const source=artifact.evidence.find(e=>e.id===citation.evidenceId);return <View key={`${citation.evidenceId}:${index}`} style={{gap:6,borderLeftWidth:2,borderLeftColor:theme.colors.border,paddingLeft:12}}>
          <Text style={[theme.typography.caption,{color:theme.colors.textSecondary}]}>{citation.quote}</Text>
          {source?<Button label={`Ver fuente · ${source.source}`} variant="ghost" onPress={()=>source.eventIds[0]&&router.push(`/event/${source.eventIds[0]}`)}/>:null}
        </View>;})}
      </Panel>)}
      {artifact.content.uncertainty.length?<Section title="Lo que aún no sabemos">{artifact.content.uncertainty.map((text,i)=><Text key={i} style={[theme.typography.body,{color:theme.colors.textSecondary}]}>{text}</Text>)}</Section>:null}
      {artifact.content.actions.length?<Section title="Posibles próximos pasos">{artifact.content.actions.map((text,i)=><Text key={i} style={[theme.typography.body,{color:theme.colors.textPrimary}]}>{text}</Text>)}</Section>:null}
      <Section title="¿Te sirvió?">
        <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{[['useful','Útil'],['irrelevant','No relevante'],['incorrect','Incorrecto'],['known','Ya lo sabía']].map(([value,label])=><Button key={value} label={label} variant="secondary" onPress={()=>void action('feedback',{value})} disabled={busy}/>)}</View>
      </Section>
      <Section title="Tu perspectiva"><Input label="Notas personales" value={notes} onChangeText={setNotes} multiline/><Button label="Guardar conocimiento" onPress={()=>void save()} disabled={busy}/></Section>
      <Section title="Profundiza"><Input label="Pregunta de seguimiento" value={question} onChangeText={setQuestion}/><Button label="Seguir explorando" onPress={()=>void ask()} disabled={busy||question.trim().length<3}/></Section>
    </>:null}
  </AppScreen>;
}
