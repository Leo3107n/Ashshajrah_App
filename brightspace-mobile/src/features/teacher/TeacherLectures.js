/**
 * Teacher Lecture Schedule and Classroom Controls. It consumes the scoped
 * calendar endpoint for range/date filters, fetches an owned lecture before
 * showing details, and exposes Meet, recording, and safe completion controls.
 */
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const RANGES = [
  ["today", "Today"],
  ["current_week", "This Week"],
  ["next_week", "Next Week"],
  ["upcoming", "Upcoming"],
  ["completed", "Completed"],
];

function readable(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter)=>letter.toUpperCase()); }
function dateOnly(value) { const date=value?new Date(value):new Date(); return Number.isNaN(date.getTime())?new Date().toISOString().slice(0,10):date.toISOString().slice(0,10); }
function dateTime(value) { return value ? new Date(value).toLocaleString([], { weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit" }) : "Time unavailable"; }
function statusTone(status) { const value=String(status||"").toLowerCase(); if(["live","completed_by_teacher","verified_by_coordinator"].includes(value))return"success";if(["missed","cancelled","disputed"].includes(value))return"danger";if(["upcoming","scheduled","rescheduled"].includes(value))return"warning";return"neutral"; }

export default function TeacherLectures() {
  const [data,setData]=useState({items:[],classes:[],subjects:[],markedDates:[]});
  const [range,setRange]=useState("current_week");
  const [selectedDate,setSelectedDate]=useState(dateOnly());
  const [showCalendar,setShowCalendar]=useState(false);
  const [subjectId,setSubjectId]=useState("");
  const [classLevel,setClassLevel]=useState("");
  const [selected,setSelected]=useState(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async({refresh=false}={})=>{
    refresh?setRefreshing(true):setLoading(true);setError("");
    try{
      const result=await api.teacher.calendarLectures({range,date:selectedDate,subjectId:subjectId||undefined,classLevel:classLevel||undefined});
      setData(result||{items:[],classes:[],subjects:[],markedDates:[]});
    }catch(nextError){setError(nextError?.message||"Unable to load your lecture schedule.");}
    finally{setLoading(false);setRefreshing(false);}
  },[classLevel,range,selectedDate,subjectId]);
  useEffect(()=>{load();},[load]);

  // Marked dates come from all Teacher assignments; the selected date uses a
  // gold fill so assignment and selection states remain visually distinct.
  const marked=useMemo(()=>{
    const output={};
    for(const value of data.markedDates||[])output[value.date||value]={marked:true,dotColor:colors.emeraldMid};
    output[selectedDate]={...(output[selectedDate]||{}),selected:true,selectedColor:colors.gold};
    return output;
  },[data.markedDates,selectedDate]);
  const grouped=useMemo(()=>{
    const map=new Map();
    for(const item of data.items||[]){const day=dateOnly(item.scheduled_start);if(!map.has(day))map.set(day,[]);map.get(day).push(item);}
    return [...map].sort(([a],[b])=>a.localeCompare(b));
  },[data.items]);

  async function openDetail(item){
    setSelected(item);setDetailLoading(true);
    try{const result=await api.teacher.lectures.detail(item.id);setSelected({...item,...(result?.item||{})});}
    catch(nextError){Alert.alert("Lecture details",nextError?.message||"Unable to load lecture details.");}
    finally{setDetailLoading(false);}
  }
  function chooseDate(day){setSelectedDate(day.dateString);setRange("selected_date");setShowCalendar(false);}
  function confirmConducted(item){
    Alert.alert("Mark lecture conducted?","This changes the lecture status and prepares it for its completion report.",[
      {text:"Cancel",style:"cancel"},
      {text:"Mark Conducted",onPress:async()=>{setDetailLoading(true);try{await api.teacher.lectures.update(item.id,{});setSelected(null);await load({refresh:true});}catch(nextError){Alert.alert("Unable to update lecture",nextError?.message||"Please try again.");}finally{setDetailLoading(false);}}},
    ]);
  }

  if(loading)return <DashboardSkeleton message="Organizing your lecture schedule..."/>;
  if(error&&!data.items.length)return <Screen contentContainerStyle={styles.errorScreen}><SurfaceCard><Ionicons color={colors.error} name="cloud-offline-outline" size={32}/><AppText style={styles.errorTitle} variant="heading">Schedule unavailable</AppText><AppText style={styles.errorBody}>{error}</AppText><PillButton onPress={()=>load()} style={styles.retry}>Try Again</PillButton></SurfaceCard></Screen>;

  return <>
    <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={()=>load({refresh:true})} refreshing={refreshing} tintColor={colors.gold}/>}>
      <AppText variant="display">Lectures</AppText><AppText style={styles.subtitle}>Your schedule, classroom links, recordings, and lecture status.</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.filters}>{RANGES.map(([value,label])=><Chip active={range===value} key={value} label={label} onPress={()=>{setRange(value);setShowCalendar(false);}}/>)}<Chip active={range==="selected_date"} icon="calendar-outline" label="Date" onPress={()=>setShowCalendar((current)=>!current)}/></ScrollView>
      {showCalendar?<SurfaceCard style={styles.calendarCard}><Calendar markedDates={marked} onDayPress={chooseDate} theme={{calendarBackground:colors.surface,dayTextColor:colors.onSurface,textDisabledColor:colors.outlineVariant,monthTextColor:colors.primary,arrowColor:colors.secondary,todayTextColor:colors.emeraldMid,textMonthFontFamily:fonts.displayBold,textDayFontFamily:fonts.body}}/></SurfaceCard>:null}
      {(data.subjects||[]).length>1?<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subRail} contentContainerStyle={styles.filters}><Chip active={!subjectId} label="All Subjects" onPress={()=>setSubjectId("")}/>{data.subjects.map((item)=><Chip active={subjectId===item.id} key={item.id} label={item.name} onPress={()=>setSubjectId(item.id)}/>)}</ScrollView>:null}
      {(data.classes||[]).length>1?<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subRail} contentContainerStyle={styles.filters}><Chip active={!classLevel} label="All Classes" onPress={()=>setClassLevel("")}/>{data.classes.map((item,index)=>{const value=item.class_level||item.course_title;return <Chip active={classLevel===value} key={`${value}-${index}`} label={value||"Unassigned"} onPress={()=>setClassLevel(value)}/>;})}</ScrollView>:null}
      {error?<SurfaceCard style={styles.warning}><AppText style={styles.warningText}>{error}</AppText></SurfaceCard>:null}
      <View style={styles.summary}><View><AppText style={styles.summaryValue}>{data.items?.length||0}</AppText><AppText style={styles.summaryLabel}>LECTURES IN VIEW</AppText></View><Ionicons color={colors.gold} name="calendar-outline" size={28}/></View>
      <View style={styles.list}>{grouped.length?grouped.map(([day,items])=><View key={day}><AppText style={styles.day}>{new Date(`${day}T12:00:00`).toLocaleDateString([],{weekday:"long",day:"numeric",month:"long"})}</AppText>{items.map((item)=><LectureCard item={item} key={item.id} onPress={()=>openDetail(item)}/>)}</View>):<View style={styles.empty}><Ionicons color={colors.outline} name="calendar-clear-outline" size={32}/><AppText style={styles.emptyTitle}>No lectures in this view</AppText><AppText style={styles.emptyBody}>Choose another date or schedule range.</AppText></View>}</View>
    </Screen>
    <LectureDetail item={selected} loading={detailLoading} onClose={()=>setSelected(null)} onConducted={confirmConducted}/>
  </>;
}

function Chip({active,icon,label,onPress}){return <Pressable onPress={onPress} style={[styles.chip,active&&styles.activeChip]}>{icon?<Ionicons color={active?colors.white:colors.outline} name={icon} size={14}/>:null}<AppText style={[styles.chipText,active&&styles.activeChipText]}>{label}</AppText></Pressable>;}
function LectureCard({item,onPress}){return <Pressable onPress={onPress} style={styles.card}><View style={styles.timeBlock}><AppText style={styles.time}>{new Date(item.scheduled_start).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</AppText><AppText style={styles.duration}>{Math.max(0,Math.round((new Date(item.scheduled_end)-new Date(item.scheduled_start))/60000))} min</AppText></View><View style={styles.cardBody}><AppText style={styles.cardTitle}>{item.subject_name||item.title}</AppText><AppText style={styles.cardMeta}>{item.class_level||item.course_title||"Class"} · {item.student_count||0} students</AppText><StatusChip tone={statusTone(item.display_status)}>{readable(item.display_status)}</StatusChip></View><Ionicons color={colors.outline} name="chevron-forward" size={18}/></Pressable>;}
function LectureDetail({item,loading,onClose,onConducted}){const status=String(item?.display_status||item?.status||"").toLowerCase();const canConduct=["ended","missed"].includes(status);return <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}><View style={styles.backdrop}><View style={styles.sheet}><View style={styles.sheetHead}><View style={styles.sheetTitleWrap}><AppText style={styles.sheetTitle}>{item?.subject_name||item?.title}</AppText><AppText style={styles.sheetMeta}>{item?.class_level||item?.course_title||"Assigned class"}</AppText></View><Pressable accessibilityLabel="Close lecture details" onPress={onClose} style={styles.close}><Ionicons color={colors.primary} name="close" size={22}/></Pressable></View>{loading?<DashboardSkeleton message="Loading lecture details..."/>:<ScrollView showsVerticalScrollIndicator={false}><StatusChip tone={statusTone(status)}>{readable(status)}</StatusChip><Detail icon="calendar-outline" label="Schedule" value={`${dateTime(item?.scheduled_start)} – ${dateTime(item?.scheduled_end)}`}/><Detail icon="people-outline" label="Students" value={item?.student_name||`${item?.student_count||0} assigned students`}/><Detail icon="document-text-outline" label="Description" value={item?.description||"No description provided."}/>{item?.topic_covered?<Detail icon="checkmark-done-outline" label="Topic Covered" value={item.topic_covered}/>:null}<View style={styles.controls}>{item?.google_meet_link?<PillButton icon={<Ionicons color={colors.white} name="videocam-outline" size={18}/>} onPress={()=>Linking.openURL(item.google_meet_link)}>Open Classroom</PillButton>:null}{item?.recording_drive_url?<PillButton icon={<Ionicons color={colors.secondary} name="play-circle-outline" size={18}/>} onPress={()=>Linking.openURL(item.recording_drive_url)} variant="outline">View Recording</PillButton>:null}{canConduct?<PillButton icon={<Ionicons color={colors.secondary} name="checkmark-circle-outline" size={18}/>} onPress={()=>onConducted(item)} variant="outline">Mark Conducted</PillButton>:null}</View>{!item?.google_meet_link&&!item?.recording_drive_url&&!canConduct?<View style={styles.noControls}><Ionicons color={colors.outline} name="information-circle-outline" size={18}/><AppText style={styles.noControlsText}>No classroom action is currently available for this lecture.</AppText></View>:null}</ScrollView>}</View></View></Modal>;}
function Detail({icon,label,value}){return <View style={styles.detail}><View style={styles.detailIcon}><Ionicons color={colors.secondary} name={icon} size={17}/></View><View style={styles.detailBody}><AppText style={styles.detailLabel}>{label}</AppText><AppText style={styles.detailValue}>{value}</AppText></View></View>;}

const styles=StyleSheet.create({
  content:{paddingTop:space.lg,paddingBottom:space.xl},subtitle:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.sm},rail:{flexGrow:0,marginTop:space.lg},subRail:{flexGrow:0,marginTop:space.xs},filters:{gap:space.xs,paddingRight:space.lg},chip:{height:38,flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:19,backgroundColor:colors.surface},activeChip:{backgroundColor:colors.primary},chipText:{color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold,fontSize:10},activeChipText:{color:colors.white},calendarCard:{marginTop:space.md,padding:0,overflow:"hidden"},warning:{marginTop:space.md,backgroundColor:colors.statusPendingBg},warningText:{color:colors.statusPendingText,fontSize:fontSize.xs},
  summary:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:space.lg,padding:space.md,borderRadius:radius.xl,backgroundColor:colors.primary},summaryValue:{color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize.xl},summaryLabel:{color:"#B9EEDB",fontFamily:fonts.bodyBold,fontSize:8,letterSpacing:1},list:{marginTop:space.lg},day:{marginTop:space.md,marginBottom:space.sm,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.lg},card:{minHeight:94,flexDirection:"row",alignItems:"center",marginBottom:space.sm,padding:space.md,borderRadius:radius.xl,backgroundColor:colors.surface,...shadows.subtle},timeBlock:{width:58,alignItems:"center",paddingRight:space.sm,borderRightWidth:1,borderRightColor:colors.borderGreen},time:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},duration:{marginTop:2,color:colors.outline,fontSize:8},cardBody:{flex:1,alignItems:"flex-start",marginHorizontal:space.md},cardTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},cardMeta:{marginVertical:4,color:colors.outline,fontSize:9},
  empty:{alignItems:"center",padding:space.xl,borderRadius:radius.xl,backgroundColor:colors.surfaceLow},emptyTitle:{marginTop:space.sm,color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},emptyBody:{marginTop:3,color:colors.outline,fontSize:fontSize.xs},errorScreen:{justifyContent:"center"},errorTitle:{marginTop:space.md},errorBody:{marginTop:space.sm,color:colors.onSurfaceVariant},retry:{marginTop:space.lg},
  backdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,39,30,0.35)"},sheet:{height:"86%",padding:space.lg,paddingBottom:space["2xl"],borderTopLeftRadius:radius.xl,borderTopRightRadius:radius.xl,backgroundColor:colors.background},sheetHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:space.lg},sheetTitleWrap:{flex:1,paddingRight:space.sm},sheetTitle:{color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},sheetMeta:{color:colors.emeraldMid,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},close:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.surfaceHigh},detail:{flexDirection:"row",paddingVertical:space.md,borderBottomWidth:1,borderBottomColor:colors.borderGreen},detailIcon:{width:36,height:36,alignItems:"center",justifyContent:"center",borderRadius:18,backgroundColor:colors.goldPale},detailBody:{flex:1,marginLeft:space.md},detailLabel:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:9,textTransform:"uppercase"},detailValue:{marginTop:3,color:colors.onSurface,fontSize:fontSize.xs,lineHeight:18},controls:{gap:space.sm,marginTop:space.lg},noControls:{flexDirection:"row",alignItems:"center",gap:space.sm,marginTop:space.lg,padding:space.md,borderRadius:radius.lg,backgroundColor:colors.surfaceLow},noControlsText:{flex:1,color:colors.outline,fontSize:fontSize.xs},
});
