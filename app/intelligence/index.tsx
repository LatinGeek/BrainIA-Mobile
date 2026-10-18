import { router,useFocusEffect } from 'expo-router';
import { useCallback,useState } from 'react';
import { Text,View,useWindowDimensions } from 'react-native';
import { AppScreen,TopBar,Section } from '@/components/layout';
import { Button,Input,FilterChip,Panel } from '@/components/primitives';
import { ArtifactCard } from '@/components/intelligence';
import { useTheme } from '@/lib/app-state';
import { useIntelligenceClient,type Artifact } from '@/lib/intelligence';
import { recordInteraction } from '@/lib/interaction-telemetry';

export default function IntelligenceScreen(){
  const theme=useTheme();const api=useIntelligenceClient();const {width}=useWindowDimensions();
  const [question,setQuestion]=useState('');const [kind,setKind]=useState<'answer'|'page'>('answer');
  const [items,setItems]=useState<Artifact[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const load=useCallback(()=>api.list().then(r=>{setItems(r.artifacts);setError('');}).catch(e=>setError(e.message)),[api]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const active=items.filter(a=>a.status==='queued'||a.status==='running');
  const submit=async()=>{if(question.trim().length<3)return;setBusy(true);setError('');try{
    const a=await api.create({kind,objective:question.trim()});recordInteraction('intelligence','ask','success');router.push(`/intelligence/${a.id}`);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo iniciar el análisis.');}finally{setBusy(false);}};
  return <AppScreen onRefresh={()=>void load()}>
    <TopBar title="Tu conocimiento, conectado" subtitle="Pregunta, descubre y conserva lo que importa. Siempre con tus fuentes." showBack/>
    <View style={{flexDirection:width>=1200?'row':'column',gap:24,alignItems:'flex-start'}}>
      <View style={{flex:1,width:'100%',gap:20}}>
        <Panel style={{gap:16}}>
          <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
            <FilterChip label="Preguntar" selected={kind==='answer'} onPress={()=>setKind('answer')}/>
            <FilterChip label="Crear página" selected={kind==='page'} onPress={()=>setKind('page')}/>
          </View>
          <Input label={kind==='page'?'Tema que quieres comprender':'¿Qué quieres entender?'} value={question} onChangeText={setQuestion} multiline placeholder="¿Qué cambió en mis gastos y compromisos esta semana?"/>
          <Button label={busy?'Preparando análisis…':kind==='page'?'Crear conocimiento':'Analizar con mis fuentes'} loading={busy} disabled={busy||question.trim().length<3} onPress={()=>void submit()}/>
          <Text style={[theme.typography.caption,{color:theme.colors.textSecondary}]}>Análisis profundo. Las conclusiones incluyen evidencia y distinguen lo observado de las hipótesis.</Text>
        </Panel>
        {error?<Text accessibilityRole="alert" style={[theme.typography.body,{color:theme.colors.danger}]}>{error}</Text>:null}
        <Section title="Explora una pregunta">
          {['¿Qué merece mi atención hoy?','¿Qué compras o servicios se repiten?','¿Qué compromisos explícitos siguen abiertos?'].map(q=><Button key={q} label={q} variant="secondary" onPress={()=>setQuestion(q)}/>)}
        </Section>
      </View>
      <View style={{flex:1,width:'100%',gap:12}}>
        <Section title="Tu biblioteca" subtitle="Respuestas, páginas y perspectivas que puedes volver a consultar.">
          {active.length?<><Text style={[theme.typography.overline,{color:theme.colors.accentStrong}]}>ANÁLISIS EN CURSO</Text>{active.map(a=><ArtifactCard key={a.id} artifact={a}/>)}</>:null}
          {items.filter(a=>!active.some(activeArtifact=>activeArtifact.id===a.id)).map(a=><ArtifactCard key={a.id} artifact={a}/>)}
          {!items.length?<Text style={[theme.typography.body,{color:theme.colors.textSecondary}]}>Tu primera pregunta es el comienzo.</Text>:null}
        </Section>
      </View>
    </View>
  </AppScreen>;
}
