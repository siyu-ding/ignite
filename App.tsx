import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { track } from './src/analytics/track';

type Screen = 'splash' | 'home' | 'chat' | 'nextStep';
type Message = { id: number; role: 'user' | 'ignite'; text: string };
const guardian = require('./assets/helix-polaris.png');
const FIRST_OPEN_KEY = 'ignite.hasSeenOpening.v2';
const C = { ink: '#090A0B', panel: '#191A1C', text: '#F3F0EA', muted: '#A8A39B', ember: '#FF6A24', amber: '#F6A13A', line: 'rgba(255,255,255,0.11)' };
const replies = [
  '我听到了。像是有很多东西同时压在一起，一时还很难把它们分开。',
  '不用急着说完整。此刻最占据你的，是身体里的疲惫，还是脑子里停不下来的声音？',
  '听起来你已经撑了一阵子。我们可以先停在这里，也可以只往前走很小的一步。',
];

function Atmosphere({ quiet = false }: { quiet?: boolean }) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])); loop.start(); return () => loop.stop();
  }, [drift]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={['#080A0C', '#11100F', '#090909']} style={StyleSheet.absoluteFill} />
    <Animated.View style={[s.orb, { opacity: quiet ? .18 : .34, transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [10, -20] }) }] }]}>
      <LinearGradient colors={['rgba(255,72,18,0)', 'rgba(255,92,25,.7)', 'rgba(255,176,64,0)']} style={StyleSheet.absoluteFill} />
    </Animated.View>
  </View>;
}

function Opening({ done }: { done: () => void }) {
  const [skip, setSkip] = useState(false); const reveal = useRef(new Animated.Value(0)).current; const completed = useRef(false); const startedAt=useRef(Date.now());
  const finish = async (wasSkipped=false) => { if (completed.current) return; completed.current = true; const elapsedMs=Date.now()-startedAt.current; void track(wasSkipped?'opening_skipped':'opening_completed',{elapsedMs,openingVersion:'v2'}); await AsyncStorage.setItem(FIRST_OPEN_KEY, 'true'); done(); };
  useEffect(() => {
    void track('opening_viewed',{openingVersion:'v2'}); const a = setTimeout(() => setSkip(true), 1000); const b = setTimeout(()=>finish(false), 7000);
    Animated.timing(reveal, { toValue: 1, duration: 5600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  return <View style={s.screen}><Atmosphere /><StatusBar style="light" /><SafeAreaView style={s.safe}>
    <View style={s.top}><Text style={s.logo}>ignite</Text>{skip && <Pressable onPress={()=>finish(true)} style={s.skip}><Text style={s.skipText}>跳过</Text></Pressable>}</View>
    <View style={s.openCenter}>
      <Animated.Image source={guardian} resizeMode="contain" style={[s.openImage, { opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [.82, 1] }) }] }]} />
      <Animated.View style={{ opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
        <Text style={s.openTitle}>先不用急着想清楚。</Text><Text style={s.openSub}>让外面的声音，慢一点。</Text>
      </Animated.View>
    </View>
    <View style={s.track}><Animated.View style={[s.fill, { transform: [{ scaleX: reveal }] }]} /></View>
  </SafeAreaView></View>;
}

function Home({ start, replay }: { start: (seed?: string) => void; replay: () => void }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => { void track('home_viewed'); const a = Animated.loop(Animated.sequence([Animated.timing(bob,{toValue:1,duration:2400,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),Animated.timing(bob,{toValue:0,duration:2400,easing:Easing.inOut(Easing.sin),useNativeDriver:true})])); a.start(); return()=>a.stop(); }, []);
  return <View style={s.screen}><LinearGradient colors={['#0A0B0C','#0E0E0E','#090909']} style={StyleSheet.absoluteFill}/><StatusBar style="light" /><SafeAreaView style={s.safe}>
    <View style={s.top}><Text style={s.logo}>ignite</Text><Pressable accessibilityRole="button" accessibilityLabel="重播开屏" onPress={replay} style={s.profile}><Text style={s.replayStar}>✦</Text></Pressable></View>
    <View style={s.hero}>
      <View style={s.starGlow}/>
      <Animated.Image source={guardian} resizeMode="contain" style={[s.heroImage,{opacity:.82,transform:[{translateY:bob.interpolate({inputRange:[0,1],outputRange:[3,-7]})}]}]} />
    </View>
    <View style={s.homeBody}>
      <Text style={s.homeLine}>不用马上知道答案。{`\n`}先从一句话开始。</Text>
      <Pressable onPress={() => {void track('chat_cta_clicked');start();}} style={({pressed})=>[s.cta,pressed&&s.pressed]}><Text style={s.ctaText}>把此刻放在这里</Text><Text style={s.arrow}>→</Text></Pressable>
    </View>
  </SafeAreaView></View>;
}

function Chat({ seed, back, nextStep }: { seed?: string; back: () => void; nextStep: () => void }) {
  const [messages,setMessages]=useState<Message[]>([{id:1,role:'ignite',text:'不用马上知道答案。你可以从刚刚最想说的那一点开始。'}]);
  const [input,setInput]=useState(seed??''); const [count,setCount]=useState(0); const [thinking,setThinking]=useState(false); const [choiceDismissed,setChoiceDismissed]=useState(false); const scroll=useRef<ScrollView>(null);
  const choices=count>=3&&!thinking&&!choiceDismissed;
  const send=()=>{const text=input.trim();if(!text||thinking||choices)return;const turnIndex=count+1;void track(count===0?'first_message_sent':'message_sent',{turnIndex,charCount:text.length});setMessages(m=>[...m,{id:Date.now(),role:'user',text}]);setInput('');setThinking(true);const started=Date.now();setTimeout(()=>{setMessages(m=>[...m,{id:Date.now()+1,role:'ignite',text:replies[Math.min(count,2)]}]);void track('assistant_response_shown',{turnIndex,latencyMs:Date.now()-started});if(turnIndex===3)void track('three_turns_completed');setCount(c=>c+1);setThinking(false)},900)};
  useEffect(()=>{void track('chat_opened');},[]);
  useEffect(()=>{setTimeout(()=>scroll.current?.scrollToEnd({animated:true}),80);if(choices)void track('invitation_shown',{route:'show_invitation'});},[messages,thinking,choices]);
  const options=[
    {title:'再走一小步',hint:'看看什么可能会有一点帮助',action:()=>{void track('next_state_selected',{choice:'next_step'});void track('next_step_opened');nextStep();}},
    {title:'继续聊一会儿',hint:'留在这里，把刚才的话慢慢说下去',action:()=>{void track('next_state_selected',{choice:'continue_chat'});setChoiceDismissed(true);}},
    {title:'今天先到这里',hint:'结束这次对话，回到首页',action:()=>{void track('next_state_selected',{choice:'exit_home'});void track('chat_exited',{turnCount:count,exitStage:'invitation'});back();}},
  ];
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':undefined}><Atmosphere quiet/><StatusBar style="light"/><SafeAreaView style={s.chatSafe}>
    <View style={s.chatTop}><Pressable onPress={back} style={s.back}><Text style={s.backText}>‹</Text></Pressable><View style={s.identity}><View style={s.live}/><Text style={s.chatName}>Ignite</Text></View><View style={s.back}/></View>
    <ScrollView ref={scroll} contentContainerStyle={s.messages} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.intro}><Image source={guardian} style={s.mini}/><Text style={s.introText}>这里没有需要完成的任务。{`\n`}你可以慢慢来，也可以随时停下。</Text></View>
      {messages.map(m=><View key={m.id} style={[s.bubble,m.role==='user'?s.userBubble:s.botBubble]}>{m.role==='ignite'&&<Text style={s.label}>IGNITE</Text>}<Text style={[s.bubbleText,m.role==='ignite'&&s.botText]}>{m.text}</Text></View>)}
      {thinking&&<View style={[s.bubble,s.botBubble,s.dots]}><View style={s.dot}/><View style={s.dot}/><View style={s.dot}/></View>}
      {choices&&<View style={s.choiceArea}><Text style={s.choiceTitle}>接下来，你更想怎么做？</Text><Text style={s.choiceSub}>没有哪个选择更好，只选此刻适合你的。</Text>
        {options.map(option=><Pressable key={option.title} onPress={option.action} style={({pressed})=>[s.choice,pressed&&s.pressed]}><View style={s.choiceIcon}><Text style={s.choiceIconText}>→</Text></View><View><Text style={s.choiceLabel}>{option.title}</Text><Text style={s.choiceHint}>{option.hint}</Text></View></Pressable>)}
      </View>}
    </ScrollView>
    {!choices&&<View style={s.composeWrap}><View style={s.compose}><TextInput value={input} onChangeText={setInput} onSubmitEditing={send} placeholder="把此刻的一点点放在这里…" placeholderTextColor="#77746F" multiline style={s.input}/><Pressable onPress={send} style={[s.send,!input.trim()&&s.disabled]}><Text style={s.sendText}>↑</Text></Pressable></View><Text style={s.hint}>如果现在不想继续，随时可以停下</Text></View>}
  </SafeAreaView></KeyboardAvoidingView>;
}

function NextStep({ back }: { back: () => void }) {
  return <View style={s.screen}><LinearGradient colors={['#0A0B0C','#11100F','#090909']} style={StyleSheet.absoluteFill}/><StatusBar style="light"/><SafeAreaView style={s.nextSafe}>
    <Pressable onPress={back} style={s.nextBack}><Text style={s.backText}>‹</Text></Pressable>
    <View style={s.nextContent}><Text style={s.nextStar}>✦</Text><Text style={s.nextTitle}>下一步</Text><Text style={s.nextCopy}>新的练习会从这里开始。</Text></View>
  </SafeAreaView></View>;
}

export default function App(){const[screen,setScreen]=useState<Screen>('splash');const[seed,setSeed]=useState<string>();useEffect(()=>{void track('app_opened');AsyncStorage.getItem(FIRST_OPEN_KEY).then(v=>v&&setScreen('home'))},[]);if(screen==='splash')return <Opening done={()=>setScreen('home')}/>;if(screen==='chat')return <Chat seed={seed} back={()=>setScreen('home')} nextStep={()=>setScreen('nextStep')}/>;if(screen==='nextStep')return <NextStep back={()=>setScreen('home')}/>;return <Home replay={()=>setScreen('splash')} start={x=>{setSeed(x);setScreen('chat')}}/>}

const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:C.ink},safe:{flex:1,paddingBottom:14},orb:{position:'absolute',width:340,height:460,borderRadius:220,left:'50%',marginLeft:-170,bottom:70,overflow:'hidden'},top:{height:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:24},logo:{color:C.text,fontSize:20,fontWeight:'700',letterSpacing:-.7},skip:{borderWidth:1,borderColor:C.line,borderRadius:18,paddingHorizontal:14,paddingVertical:7,backgroundColor:'rgba(255,255,255,.05)'},skipText:{color:'#C9C5BF',fontSize:12},openCenter:{flex:1,alignItems:'center',justifyContent:'center',paddingBottom:42},openImage:{width:250,height:390,marginBottom:4},openTitle:{color:C.text,fontSize:22,textAlign:'center',fontWeight:'600'},openSub:{color:C.muted,fontSize:14,textAlign:'center',marginTop:9},track:{width:84,height:2,backgroundColor:'rgba(255,255,255,.13)',alignSelf:'center',overflow:'hidden'},fill:{width:'100%',height:'100%',backgroundColor:C.ember,transformOrigin:'left'},profile:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},replayStar:{color:C.amber,fontSize:17},hero:{flex:1,alignItems:'center',justifyContent:'center'},starGlow:{position:'absolute',width:116,height:116,borderRadius:58,backgroundColor:'rgba(255,112,38,.10)'},heroImage:{width:168,height:330},homeBody:{paddingHorizontal:46,paddingBottom:92},homeLine:{color:'#D8D4CE',fontSize:16,lineHeight:24,textAlign:'center',marginBottom:22,fontWeight:'500'},cta:{height:48,borderRadius:24,backgroundColor:'rgba(242,239,235,.72)',borderWidth:1,borderColor:'rgba(255,255,255,.34)',flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:19},ctaText:{color:'#181716',fontSize:14,fontWeight:'600'},arrow:{color:'#D86532',fontSize:21},pressed:{opacity:.75},chatSafe:{flex:1},chatTop:{height:64,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line,paddingHorizontal:16},back:{width:40,height:40,alignItems:'center',justifyContent:'center'},backText:{color:C.text,fontSize:33,fontWeight:'300'},identity:{flex:1,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},live:{width:7,height:7,borderRadius:4,backgroundColor:C.ember},chatName:{color:C.text,fontSize:15,fontWeight:'600'},messages:{paddingHorizontal:18,paddingBottom:28},intro:{alignItems:'center',paddingVertical:28},mini:{width:70,height:100,marginBottom:12},introText:{color:'#918D87',fontSize:12,lineHeight:19,textAlign:'center'},bubble:{maxWidth:'84%',borderRadius:20,paddingHorizontal:16,paddingVertical:13,marginBottom:12},botBubble:{alignSelf:'flex-start',backgroundColor:'rgba(30,30,31,.92)',borderWidth:1,borderColor:C.line,borderTopLeftRadius:7},userBubble:{alignSelf:'flex-end',backgroundColor:'#EEEAE4',borderTopRightRadius:7},label:{color:C.ember,fontSize:8,letterSpacing:1.3,fontWeight:'800',marginBottom:6},bubbleText:{color:'#282726',fontSize:15,lineHeight:22},botText:{color:C.text},dots:{flexDirection:'row',gap:5},dot:{width:5,height:5,borderRadius:3,backgroundColor:'#77736E'},choiceArea:{marginTop:12,paddingTop:20,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line},choiceTitle:{color:C.text,fontSize:21,fontWeight:'600'},choiceSub:{color:C.muted,fontSize:12,marginTop:7,marginBottom:17},choice:{minHeight:72,borderRadius:18,borderWidth:1,borderColor:C.line,backgroundColor:'rgba(24,24,25,.88)',flexDirection:'row',alignItems:'center',paddingHorizontal:16,marginBottom:10},choiceIcon:{width:24,height:24,borderRadius:12,borderWidth:1,borderColor:'rgba(255,255,255,.14)',alignItems:'center',justifyContent:'center',marginRight:13},choiceIconText:{color:C.ember,fontSize:13},choiceLabel:{color:C.text,fontSize:15,fontWeight:'600'},choiceHint:{color:'#8C8882',fontSize:11,marginTop:5},nextSafe:{flex:1},nextBack:{width:48,height:48,marginLeft:14,marginTop:8,alignItems:'center',justifyContent:'center'},nextContent:{flex:1,alignItems:'center',justifyContent:'center',paddingBottom:90},nextStar:{color:C.amber,fontSize:32,marginBottom:18},nextTitle:{color:C.text,fontSize:28,fontWeight:'600'},nextCopy:{color:C.muted,fontSize:14,marginTop:10},composeWrap:{paddingHorizontal:14,paddingTop:10,paddingBottom:Platform.OS==='ios'?8:14,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line,backgroundColor:'rgba(10,10,11,.96)'},compose:{minHeight:50,borderRadius:25,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,flexDirection:'row',alignItems:'flex-end',paddingLeft:17,paddingRight:5,paddingVertical:5},input:{flex:1,color:C.text,fontSize:14,maxHeight:100,minHeight:38,paddingTop:9,paddingBottom:8},send:{width:40,height:40,borderRadius:20,backgroundColor:C.ember,alignItems:'center',justifyContent:'center'},disabled:{opacity:.28},sendText:{color:'#FFF',fontSize:21,fontWeight:'600'},hint:{color:'#67645F',fontSize:10,textAlign:'center',marginTop:7}
});
