import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { track } from './src/analytics/track';
import { acknowledgeBridgeOffer, askChat, BridgeDecision, ChatApiError, ChatSession, chatErrorMessage, chooseBridgeOption, deleteChatSession, GrowthChoice, startChatSession } from './src/api/chat';
import { clearChatSession, loadChatSession, saveChatSession } from './src/api/sessionStore';

type Screen = 'consent' | 'splash' | 'home' | 'chat' | 'nextStep';
type Message = { id: number; role: 'user' | 'ignite'; text: string };
const guardian = require('./assets/helix-polaris.png');
const FIRST_OPEN_KEY = 'ignite.hasSeenOpening.v2';
const CONSENT_KEY = 'ignite.betaConsent';
const CONSENT_VERSION = '2026-09-23';
const C = { ink: '#090A0B', panel: '#191A1C', text: '#F3F0EA', muted: '#A8A39B', ember: '#FF6A24', amber: '#F6A13A', line: 'rgba(255,255,255,0.11)' };

function DeleteButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.deleteCompact}>
    <Text style={s.deleteCompactText}>删除我的数据</Text>
  </Pressable>;
}

const terms = [
  { title: '1. 仅限成年人使用', body: '本服务仅面向年满 18 周岁的用户。勾选「我已阅读并同意」即表示你确认自己已年满 18 周岁。如果你未满 18 周岁，请不要使用本服务。' },
  { title: '2. 这是陪伴对话，不是医疗或心理诊疗', body: '本服务由人工智能生成回复，用于日常情绪陪伴与倾诉，不构成医学、心理、法律或其他专业意见，不能替代医生、心理咨询师或危机干预服务。\n如果你正处于危机之中，或有伤害自己或他人的想法，请立即联系：全国统一心理援助热线 12356（24 小时，免费）；医疗急救请拨打 120；遇到紧急人身危险请报警 110。' },
  { title: '3. 你的对话如何被保存和使用', body: '- 你与本服务的对话原文会保存在位于中国境内的腾讯云服务器上，用于让对话能够连续进行，以及在公测期间排查问题、改进服务。\n- 对话内容会发送给第三方大模型服务商（DeepSeek）生成回复。请不要在对话中输入身份证号、银行卡号、住址等敏感个人信息。\n- 你输入的手机号、座机号、身份证号、银行卡号和邮箱，系统会在保存前自动替换成「[手机号]」「[身份证]」这类占位符，回复里看到这类占位符属正常现象。即便如此，也请尽量不要输入这些信息。\n- 服务器每天自动备份一次，备份最多保留 14 天；存放在服务器以外的备份一律加密。\n- 能接触到原始对话数据的仅限 3 人：项目负责人、前端开发人员和心理辅导合规检查人员，且仅用于上述目的，不会出售或提供给无关第三方。公测团队不会把含对话内容的数据下载到个人电脑。' },
  { title: '4. 保存多久、怎么删除', body: '- 公测结束后 60 天内，删除全部对话数据，包括备份。\n- 你可以随时删除自己的数据：点击 App 里的「删除我的数据」，服务器上的对话记录会在 48 小时内删除；备份里的副本会随备份清理，在 14 天内消失。你也可以发邮件到 ignite202609@163.com 联系我们。\n- 本服务不需要注册账号，只靠你 App 里保存的会话凭证认出你。如果你删除了 App、清除了 App 数据或换了设备，我们就无法确认哪些对话属于你，也无法按你的要求单独删除；这些数据会在上面的统一期限内删除。' },
  { title: '5. 公测性质', body: '本服务处于公测阶段，可能随时中断、调整或终止，回复也可能出现错误。请不要依赖本服务做出重要决定。' },
  { title: '6. 联系我们', body: '对本须知有任何疑问，请联系：ignite202609@163.com。' },
];

function Consent({ accept }: { accept: () => Promise<void> }) {
  const [checked,setChecked]=useState(false);
  const [saving,setSaving]=useState(false);
  const submit=async()=>{if(!checked||saving)return;setSaving(true);try{await accept();}finally{setSaving(false);}};
  return <View style={s.screen}><LinearGradient colors={['#0A0B0C','#11100F','#090909']} style={StyleSheet.absoluteFill}/><StatusBar style="light"/><SafeAreaView style={s.consentSafe}>
    <View style={s.consentHeader}><Text style={s.logo}>ignite</Text><Text style={s.consentHeaderHint}>公测使用须知与隐私说明</Text></View>
    <ScrollView contentContainerStyle={s.consentContent} showsVerticalScrollIndicator={false}>
      <Text style={s.consentLead}>欢迎参加本服务的小范围公测。开始使用前，请阅读并确认以下内容。</Text>
      {terms.map(item=><View key={item.title} style={s.termSection}><Text style={s.termTitle}>{item.title}</Text><Text style={s.termBody}>{item.body}</Text></View>)}
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked}} onPress={()=>setChecked(value=>!value)} style={s.consentCheck}>
        <View style={[s.checkbox,checked&&s.checkboxChecked]}><Text style={s.checkmark}>{checked?'✓':''}</Text></View>
        <Text style={s.consentCheckText}>我已阅读并同意以上内容，并确认我已年满 18 周岁。</Text>
      </Pressable>
      <Pressable disabled={!checked||saving} onPress={()=>void submit()} style={[s.consentSubmit,(!checked||saving)&&s.disabled]}><Text style={s.consentSubmitText}>{saving?'正在保存…':'同意并开始'}</Text></Pressable>
    </ScrollView>
  </SafeAreaView></View>;
}

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

function Home({ start, replay, canDelete, deleteData }: { start: (seed?: string) => void; replay: () => void; canDelete: boolean; deleteData: () => void }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => { void track('home_viewed'); const a = Animated.loop(Animated.sequence([Animated.timing(bob,{toValue:1,duration:2400,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),Animated.timing(bob,{toValue:0,duration:2400,easing:Easing.inOut(Easing.sin),useNativeDriver:true})])); a.start(); return()=>a.stop(); }, []);
  return <View style={s.screen}><LinearGradient colors={['#0A0B0C','#0E0E0E','#090909']} style={StyleSheet.absoluteFill}/><StatusBar style="light" /><SafeAreaView style={s.safe}>
    <View style={s.top}><Text style={s.logo}>ignite</Text><View style={s.topActions}>{canDelete&&<DeleteButton onPress={deleteData}/>}<Pressable accessibilityRole="button" accessibilityLabel="重播开屏" onPress={replay} style={s.profile}><Text style={s.replayStar}>✦</Text></Pressable></View></View>
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

function Chat({ seed, back, nextStep, initialSession, updateSession, deleteData }: { seed?: string; back: () => void; nextStep: () => void; initialSession: ChatSession | null; updateSession: (session: ChatSession) => Promise<void>; deleteData: () => void }) {
  const [messages,setMessages]=useState<Message[]>([{id:1,role:'ignite',text:'不用马上知道答案。你可以从刚刚最想说的那一点开始。'}]);
  const [input,setInput]=useState(seed??'');
  const [count,setCount]=useState(0);
  const [thinking,setThinking]=useState(false);
  const [bridge,setBridge]=useState<BridgeDecision|null>(null);
  const [choiceSubmitting,setChoiceSubmitting]=useState(false);
  const [choiceError,setChoiceError]=useState<string>();
  const session=useRef<ChatSession|null>(initialSession);
  const sessionPromise=useRef<Promise<ChatSession>|null>(null);
  const requests=useRef(new Set<AbortController>());
  const acknowledgedOffers=useRef(new Set<string>());
  const offerShownAt=useRef(0);
  const scroll=useRef<ScrollView>(null);
  const choices=!!bridge?.ready&&!!bridge.offerId&&!thinking;

  const ensureSession=()=>{
    if(session.current)return Promise.resolve(session.current);
    if(!sessionPromise.current){
      sessionPromise.current=startChatSession().then(async value=>{session.current=value;await updateSession(value);return value;}).catch(error=>{sessionPromise.current=null;throw error;});
    }
    return sessionPromise.current;
  };

  const send=async()=>{
    const text=input;
    if(!text.trim()||thinking||choices)return;
    const turnIndex=count+1;
    void track(count===0?'first_message_sent':'message_sent',{turnIndex,charCount:text.length});
    setMessages(m=>[...m,{id:Date.now(),role:'user',text}]);
    setInput('');
    setThinking(true);
    setChoiceError(undefined);
    const started=Date.now();
    try{
      const activeSession=await ensureSession();
      const controller=new AbortController();
      requests.current.add(controller);
      const response=await askChat(activeSession,text,{signal:controller.signal,onSessionAdopt:async adopted=>{session.current=adopted;await updateSession(adopted);}});
      requests.current.delete(controller);
      setMessages(m=>[...m,{id:Date.now()+1,role:'ignite',text:response.message}]);
      void track('assistant_response_shown',{turnIndex,latencyMs:Date.now()-started});
      if(turnIndex===3)void track('three_turns_completed');
      setCount(turnIndex);
      const offer=response.bridge?.ready&&response.bridge.offerId?response.bridge:null;
      setBridge(offer);
      if(offer){offerShownAt.current=Date.now();}
    }catch(error){
      requests.current.clear();
      if(error instanceof Error&&error.name==='AbortError')return;
      setMessages(m=>[...m,{id:Date.now()+1,role:'ignite',text:chatErrorMessage(error)}]);
      void track('chat_request_failed',{turnIndex,errorCode:error instanceof Error?error.name:'unknown'});
    }finally{
      setThinking(false);
    }
  };

  useEffect(()=>{void track('chat_opened');void ensureSession().catch(()=>{});return()=>{requests.current.forEach(controller=>controller.abort());requests.current.clear();};},[]);
  useEffect(()=>{setTimeout(()=>scroll.current?.scrollToEnd({animated:true}),80);},[messages,thinking,choices]);
  useEffect(()=>{
    const offerId=bridge?.ready?bridge.offerId:null;
    if(!offerId||!session.current||acknowledgedOffers.current.has(offerId))return;
    acknowledgedOffers.current.add(offerId);
    offerShownAt.current=Date.now();
    void track('invitation_shown',{route:'backend_bridge'});
    void acknowledgeBridgeOffer(session.current,offerId,async adopted=>{session.current=adopted;await updateSession(adopted);}).catch(()=>{
      acknowledgedOffers.current.delete(offerId);
      void track('invitation_ack_failed',{offerIdPresent:true});
    });
  },[bridge]);

  const selectChoice=async(choice:GrowthChoice)=>{
    if(!session.current||!bridge?.offerId||choiceSubmitting)return;
    setChoiceSubmitting(true);
    setChoiceError(undefined);
    try{
      await chooseBridgeOption(session.current,bridge.offerId,choice,Date.now()-offerShownAt.current,async adopted=>{session.current=adopted;await updateSession(adopted);});
      setBridge(null);
      if(choice==='one_small_step'){
        void track('next_state_selected',{choice:'next_step'});void track('next_step_opened');nextStep();
      }else if(choice==='wait_a_while'){
        void track('next_state_selected',{choice:'continue_chat'});
      }else{
        void track('next_state_selected',{choice:'exit_home'});void track('chat_exited',{turnCount:count,exitStage:'invitation'});back();
      }
    }catch(error){
      setChoiceError(chatErrorMessage(error));
      void track('growth_choice_failed',{choice});
    }finally{
      setChoiceSubmitting(false);
    }
  };

  const options=[
    {id:'one_small_step' as const,title:'再走一小步',hint:'看看什么可能会有一点帮助'},
    {id:'wait_a_while' as const,title:'继续聊一会儿',hint:'留在这里，把刚才的话慢慢说下去'},
    {id:'stay_here' as const,title:'今天先到这里',hint:'结束这次对话，回到首页'},
  ];
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':undefined}><Atmosphere quiet/><StatusBar style="light"/><SafeAreaView style={s.chatSafe}>
    <View style={s.chatTop}><Pressable onPress={back} style={s.back}><Text style={s.backText}>‹</Text></Pressable><View style={s.identity}><View style={s.live}/><Text style={s.chatName}>Ignite</Text></View><DeleteButton onPress={()=>{requests.current.forEach(controller=>controller.abort());requests.current.clear();deleteData();}}/></View>
    <ScrollView ref={scroll} contentContainerStyle={s.messages} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.intro}><Image source={guardian} style={s.mini}/><Text style={s.introText}>这里没有需要完成的任务。{`\n`}你可以慢慢来，也可以随时停下。</Text></View>
      {messages.map(m=><View key={m.id} style={[s.bubble,m.role==='user'?s.userBubble:s.botBubble]}>{m.role==='ignite'&&<Text style={s.label}>IGNITE</Text>}<Text style={[s.bubbleText,m.role==='ignite'&&s.botText]}>{m.text}</Text></View>)}
      {thinking&&<View style={[s.bubble,s.botBubble,s.dots]}><View style={s.dot}/><View style={s.dot}/><View style={s.dot}/></View>}
      {choices&&<View style={s.choiceArea}><Text style={s.choiceTitle}>接下来，你更想怎么做？</Text><Text style={s.choiceSub}>{bridge?.reflection??'没有哪个选择更好，只选此刻适合你的。'}</Text>
        {options.map(option=><Pressable key={option.id} disabled={choiceSubmitting} onPress={()=>void selectChoice(option.id)} style={({pressed})=>[s.choice,(pressed||choiceSubmitting)&&s.pressed]}><View style={s.choiceIcon}><Text style={s.choiceIconText}>→</Text></View><View><Text style={s.choiceLabel}>{option.title}</Text><Text style={s.choiceHint}>{option.hint}</Text></View></Pressable>)}
        {choiceError&&<Text style={s.choiceError}>{choiceError}</Text>}
      </View>}
    </ScrollView>
    {!choices&&<View style={s.composeWrap}><View style={s.compose}><TextInput value={input} onChangeText={setInput} onSubmitEditing={send} placeholder="把此刻的一点点放在这里…" placeholderTextColor="#77746F" multiline style={s.input}/><Pressable onPress={send} style={[s.send,!input.trim()&&s.disabled]}><Text style={s.sendText}>↑</Text></Pressable></View><Text style={s.hint}>如果现在不想继续，随时可以停下</Text></View>}
  </SafeAreaView></KeyboardAvoidingView>;
}

function NextStep({ back, canDelete, deleteData }: { back: () => void; canDelete: boolean; deleteData: () => void }) {
  return <View style={s.screen}><LinearGradient colors={['#0A0B0C','#11100F','#090909']} style={StyleSheet.absoluteFill}/><StatusBar style="light"/><SafeAreaView style={s.nextSafe}>
    <View style={s.nextTop}><Pressable onPress={back} style={s.nextBack}><Text style={s.backText}>‹</Text></Pressable>{canDelete&&<DeleteButton onPress={deleteData}/>}</View>
    <View style={s.nextContent}><Text style={s.nextStar}>✦</Text><Text style={s.nextTitle}>下一步</Text><Text style={s.nextCopy}>新的练习会从这里开始。</Text></View>
  </SafeAreaView></View>;
}

export default function App(){
  const[screen,setScreen]=useState<Screen>('consent');
  const[seed,setSeed]=useState<string>();
  const[session,setSession]=useState<ChatSession|null>(null);
  const[ready,setReady]=useState(false);
  const[consentAccepted,setConsentAccepted]=useState(false);
  const[deleting,setDeleting]=useState(false);
  useEffect(()=>{Promise.all([AsyncStorage.getItem(FIRST_OPEN_KEY),AsyncStorage.getItem(CONSENT_KEY),loadChatSession()]).then(([opened,consent,saved])=>{let accepted=false;try{accepted=JSON.parse(consent??'null')?.version===CONSENT_VERSION;}catch{}setConsentAccepted(accepted);setScreen(accepted?(opened?'home':'splash'):'consent');setSession(saved);}).finally(()=>setReady(true));},[]);
  useEffect(()=>{if(ready&&consentAccepted)void track('app_opened');},[ready,consentAccepted]);
  const acceptConsent=async()=>{await AsyncStorage.setItem(CONSENT_KEY,JSON.stringify({version:CONSENT_VERSION,acceptedAt:new Date().toISOString()}));setConsentAccepted(true);const opened=await AsyncStorage.getItem(FIRST_OPEN_KEY);setScreen(opened?'home':'splash');};
  const updateSession=async(next:ChatSession)=>{await saveChatSession(next);setSession(next);};
  const performDelete=async()=>{
    if(!session||deleting)return;
    setDeleting(true);
    try{
      await deleteChatSession(session);
      await clearChatSession();
      setSession(null);
      setScreen('home');
      Alert.alert('已删除','这台设备上的会话凭证已经清除。');
    }catch(error){
      if(error instanceof ChatApiError&&error.status===403)Alert.alert('无法确认身份','当前凭证不匹配，无法确认要删除的数据。');
      else Alert.alert('暂时无法删除','当前会话仍然保留，请稍后重试。');
    }finally{setDeleting(false);}
  };
  const confirmDelete=()=>{
    const message='服务器上的对话记录会在 48 小时内删除，备份里的副本在 14 天内消失；删除后无法恢复。';
    if(Platform.OS==='web'){
      if(globalThis.confirm(`${message}\n\n确定删除吗？`))void performDelete();
      return;
    }
    Alert.alert('删除我的数据',message,[{text:'取消',style:'cancel'},{text:'确认删除',style:'destructive',onPress:()=>void performDelete()}]);
  };
  if(!ready)return <View style={s.screen}/>;
  if(screen==='consent')return <Consent accept={acceptConsent}/>;
  if(screen==='splash')return <Opening done={()=>setScreen('home')}/>;
  if(screen==='chat')return <Chat seed={seed} initialSession={session} updateSession={updateSession} deleteData={confirmDelete} back={()=>setScreen('home')} nextStep={()=>setScreen('nextStep')}/>;
  if(screen==='nextStep')return <NextStep canDelete={!!session} deleteData={confirmDelete} back={()=>setScreen('home')}/>;
  return <Home canDelete={!!session} deleteData={confirmDelete} replay={()=>setScreen('splash')} start={x=>{setSeed(x);setScreen('chat')}}/>;
}

const s=StyleSheet.create({
  consentSafe:{flex:1},consentHeader:{height:64,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line},consentHeaderHint:{color:'#8F8A84',fontSize:11},consentContent:{paddingHorizontal:22,paddingTop:24,paddingBottom:42},consentLead:{color:C.text,fontSize:17,lineHeight:26,fontWeight:'600',marginBottom:24},termSection:{marginBottom:22},termTitle:{color:C.text,fontSize:15,lineHeight:23,fontWeight:'700',marginBottom:7},termBody:{color:'#B7B2AB',fontSize:13,lineHeight:22},consentCheck:{flexDirection:'row',alignItems:'flex-start',padding:15,borderRadius:16,borderWidth:1,borderColor:'rgba(255,255,255,.15)',backgroundColor:'rgba(255,255,255,.04)',marginTop:4},checkbox:{width:20,height:20,borderRadius:5,borderWidth:1,borderColor:'#77736E',alignItems:'center',justifyContent:'center',marginRight:11,marginTop:1},checkboxChecked:{backgroundColor:C.ember,borderColor:C.ember},checkmark:{color:'#FFF',fontSize:13,fontWeight:'800'},consentCheckText:{flex:1,color:C.text,fontSize:13,lineHeight:21},consentSubmit:{height:50,borderRadius:25,backgroundColor:C.ember,alignItems:'center',justifyContent:'center',marginTop:16},consentSubmitText:{color:'#FFF',fontSize:14,fontWeight:'700'},
  screen:{flex:1,backgroundColor:C.ink},safe:{flex:1,paddingBottom:14},orb:{position:'absolute',width:340,height:460,borderRadius:220,left:'50%',marginLeft:-170,bottom:70,overflow:'hidden'},top:{height:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:24},topActions:{flexDirection:'row',alignItems:'center',gap:10},logo:{color:C.text,fontSize:20,fontWeight:'700',letterSpacing:-.7},skip:{borderWidth:1,borderColor:C.line,borderRadius:18,paddingHorizontal:14,paddingVertical:7,backgroundColor:'rgba(255,255,255,.05)'},skipText:{color:'#C9C5BF',fontSize:12},deleteCompact:{minWidth:40,height:36,alignItems:'center',justifyContent:'center',paddingHorizontal:8},deleteCompactText:{color:'#B9B3AC',fontSize:10},openCenter:{flex:1,alignItems:'center',justifyContent:'center',paddingBottom:42},openImage:{width:250,height:390,marginBottom:4},openTitle:{color:C.text,fontSize:22,textAlign:'center',fontWeight:'600'},openSub:{color:C.muted,fontSize:14,textAlign:'center',marginTop:9},track:{width:84,height:2,backgroundColor:'rgba(255,255,255,.13)',alignSelf:'center',overflow:'hidden'},fill:{width:'100%',height:'100%',backgroundColor:C.ember,transformOrigin:'left'},profile:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},replayStar:{color:C.amber,fontSize:17},hero:{flex:1,alignItems:'center',justifyContent:'center'},starGlow:{position:'absolute',width:116,height:116,borderRadius:58,backgroundColor:'rgba(255,112,38,.10)'},heroImage:{width:168,height:330},homeBody:{paddingHorizontal:46,paddingBottom:92},homeLine:{color:'#D8D4CE',fontSize:16,lineHeight:24,textAlign:'center',marginBottom:22,fontWeight:'500'},cta:{height:48,borderRadius:24,backgroundColor:'rgba(242,239,235,.72)',borderWidth:1,borderColor:'rgba(255,255,255,.34)',flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:19},ctaText:{color:'#181716',fontSize:14,fontWeight:'600'},arrow:{color:'#D86532',fontSize:21},pressed:{opacity:.75},chatSafe:{flex:1},chatTop:{height:64,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line,paddingHorizontal:16},back:{width:40,height:40,alignItems:'center',justifyContent:'center'},backText:{color:C.text,fontSize:33,fontWeight:'300'},identity:{flex:1,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},live:{width:7,height:7,borderRadius:4,backgroundColor:C.ember},chatName:{color:C.text,fontSize:15,fontWeight:'600'},messages:{paddingHorizontal:18,paddingBottom:28},intro:{alignItems:'center',paddingVertical:28},mini:{width:70,height:100,marginBottom:12},introText:{color:'#918D87',fontSize:12,lineHeight:19,textAlign:'center'},bubble:{maxWidth:'84%',borderRadius:20,paddingHorizontal:16,paddingVertical:13,marginBottom:12},botBubble:{alignSelf:'flex-start',backgroundColor:'rgba(30,30,31,.92)',borderWidth:1,borderColor:C.line,borderTopLeftRadius:7},userBubble:{alignSelf:'flex-end',backgroundColor:'#EEEAE4',borderTopRightRadius:7},label:{color:C.ember,fontSize:8,letterSpacing:1.3,fontWeight:'800',marginBottom:6},bubbleText:{color:'#282726',fontSize:15,lineHeight:22},botText:{color:C.text},dots:{flexDirection:'row',gap:5},dot:{width:5,height:5,borderRadius:3,backgroundColor:'#77736E'},choiceArea:{marginTop:12,paddingTop:20,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line},choiceTitle:{color:C.text,fontSize:21,fontWeight:'600'},choiceSub:{color:C.muted,fontSize:12,lineHeight:18,marginTop:7,marginBottom:17},choice:{minHeight:72,borderRadius:18,borderWidth:1,borderColor:C.line,backgroundColor:'rgba(24,24,25,.88)',flexDirection:'row',alignItems:'center',paddingHorizontal:16,marginBottom:10},choiceIcon:{width:24,height:24,borderRadius:12,borderWidth:1,borderColor:'rgba(255,255,255,.14)',alignItems:'center',justifyContent:'center',marginRight:13},choiceIconText:{color:C.ember,fontSize:13},choiceLabel:{color:C.text,fontSize:15,fontWeight:'600'},choiceHint:{color:'#8C8882',fontSize:11,marginTop:5},choiceError:{color:'#E99472',fontSize:11,lineHeight:17,marginTop:2,marginBottom:8},nextSafe:{flex:1},nextTop:{height:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingRight:16},nextBack:{width:48,height:48,marginLeft:14,alignItems:'center',justifyContent:'center'},nextContent:{flex:1,alignItems:'center',justifyContent:'center',paddingBottom:90},nextStar:{color:C.amber,fontSize:32,marginBottom:18},nextTitle:{color:C.text,fontSize:28,fontWeight:'600'},nextCopy:{color:C.muted,fontSize:14,marginTop:10},composeWrap:{paddingHorizontal:14,paddingTop:10,paddingBottom:Platform.OS==='ios'?8:14,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line,backgroundColor:'rgba(10,10,11,.96)'},compose:{minHeight:50,borderRadius:25,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,flexDirection:'row',alignItems:'flex-end',paddingLeft:17,paddingRight:5,paddingVertical:5},input:{flex:1,color:C.text,fontSize:14,maxHeight:100,minHeight:38,paddingTop:9,paddingBottom:8},send:{width:40,height:40,borderRadius:20,backgroundColor:C.ember,alignItems:'center',justifyContent:'center'},disabled:{opacity:.28},sendText:{color:'#FFF',fontSize:21,fontWeight:'600'},hint:{color:'#67645F',fontSize:10,textAlign:'center',marginTop:7}
});
