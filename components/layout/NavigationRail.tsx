import { Feather } from '@expo/vector-icons';
import { router,usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform,Pressable,Text,View } from 'react-native';
import { useTheme } from '@/lib/app-state';
import { Button } from '@/components/primitives';

const destinations=[{path:'/',label:'Hoy',icon:'sun'},{path:'/search',label:'Explorar',icon:'compass'},
  {path:'/financials',label:'Dinero',icon:'credit-card'},{path:'/review',label:'Revisar',icon:'check-circle'}] as const;
export function NavigationRail(){
  const theme=useTheme();const pathname=usePathname();
  useEffect(()=>{
    if(Platform.OS!=='web')return;
    const handler=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key==='k'){event.preventDefault();router.push('/search');}};
    document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);
  },[]);
  return <View style={{width:236,borderRightWidth:1,borderRightColor:theme.colors.border,backgroundColor:theme.colors.surface,padding:24,gap:32}}>
    <View style={{gap:8,paddingTop:18}}><Text style={{fontFamily:'Inter_700Bold',fontSize:24,letterSpacing:-1,color:theme.colors.textPrimary}}>brain ia<Text style={{color:theme.colors.accent}}> /</Text></Text>
      <Text style={[theme.typography.caption,{color:theme.colors.textMuted}]}>INTELIGENCIA PERSONAL</Text></View>
    <Button label="Capturar" onPress={()=>router.push('/capture')}/>
    <View style={{gap:8}}>{destinations.map(item=>{const selected=pathname===item.path;return <Pressable key={item.path} accessibilityRole="link" accessibilityState={{selected}} onPress={()=>router.push(item.path)} style={({pressed})=>({minHeight:48,flexDirection:'row',gap:12,alignItems:'center',paddingHorizontal:14,borderRadius:12,backgroundColor:selected?theme.colors.accentSoft:pressed?theme.colors.surfaceRaised:'transparent'})}>
      <Feather name={item.icon} size={19} color={selected?theme.colors.accent:theme.colors.textSecondary}/><Text style={[theme.typography.bodyStrong,{color:selected?theme.colors.textPrimary:theme.colors.textSecondary}]}>{item.label}</Text>
    </Pressable>;})}</View>
    <View style={{gap:12,borderTopWidth:1,borderTopColor:theme.colors.border,paddingTop:24}}>
      <Text style={[theme.typography.overline,{color:theme.colors.textMuted}]}>Tu espacio</Text>
      <Button label="Conocimiento" variant="ghost" onPress={()=>router.push('/intelligence')}/>
      <Button label="Aprendizaje" variant="ghost" onPress={()=>router.push('/learning')}/>
      <Button label="Ajustes" variant="ghost" onPress={()=>router.push('/settings')}/>
    </View>
    <View style={{flex:1}}/><Text style={[theme.typography.caption,{color:theme.colors.textMuted}]}>Buscar  Ctrl / ⌘ K</Text>
  </View>;
}
