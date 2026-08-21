/**
 * Teacher Attendance Management. The backend supplies a staged class, subject,
 * lecture, and roster workflow. Changes are saved as pending manual attendance
 * for coordinator approval instead of overwriting verified attendance.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import api from "../../api";
import SubjectDropdown from "../../components/SubjectDropdown";
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const STATUSES=[
  ["present","Present","checkmark-circle","success"],
  ["absent","Absent","close-circle","danger"],
  ["leave","Leave","calendar","warning"],
];
function dateTime(value){return value?new Date(value).toLocaleString([],{weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"Time unavailable";}
function classValue(item){return String(item?.class_level||item?.course_title||"").trim();}

export default function TeacherAttendance(){
  const[data,setData]=useState({classes:[],subjects:[],lectures:[],students:[],selectedLecture:null});
  const[classLevel,setClassLevel]=useState("");
  const[subjectId,setSubjectId]=useState("");
  const[lectureId,setLectureId]=useState("");
  const[records,setRecords]=useState({});
  const[loading,setLoading]=useState(true);
  const[refreshing,setRefreshing]=useState(false);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState("");
  const[notice,setNotice]=useState("");

  const load=useCallback(async({refresh=false,preserveNotice=false}={})=>{
    refresh?setRefreshing(true):setLoading(true);setError("");
    if(!preserveNotice)setNotice("");
    try{
      const result=await api.teacher.attendance.list({classLevel:classLevel||undefined,subjectId:subjectId||undefined,lectureId:lectureId||undefined});
      setData(result||{classes:[],subjects:[],lectures:[],students:[],selectedLecture:null});
      if(lectureId){
        const next={};
        for(const student of result?.students||[])next[student.user_id]=String(student.status||"absent").toLowerCase();
        setRecords(next);
      }
    }catch(nextError){setError(nextError?.message||"Unable to load attendance.");}
    finally{setLoading(false);setRefreshing(false);}
  },[classLevel,lectureId,subjectId]);
  useEffect(()=>{load();},[load]);

  // Changing an earlier selection clears dependent identifiers so an old
  // lecture can never be submitted under a newly selected class or subject.
  function chooseClass(value){setClassLevel(value);setSubjectId("");setLectureId("");setRecords({});}
  function chooseSubject(value){setSubjectId(value);setLectureId("");setRecords({});}
  function chooseLecture(value){setLectureId(value);setRecords({});}
  function markAll(status){setRecords(Object.fromEntries((data.students||[]).map((student)=>[student.user_id,status])));}

  const counts=useMemo(()=>STATUSES.reduce((output,[key])=>({...output,[key]:Object.values(records).filter((value)=>value===key).length}),{}),[records]);
  const selectedStatus=String(data.selectedLecture?.status||"").toLowerCase();
  const now=Date.now(),start=new Date(data.selectedLecture?.scheduled_start||0).getTime(),end=new Date(data.selectedLecture?.scheduled_end||0).getTime();
  const canSave=Boolean(lectureId&&data.students?.length&&(selectedStatus==="live"||selectedStatus==="completed_by_teacher"||(start<=now&&end>=now)));
  const subjects=(data.subjects||[]).filter((item)=>!classLevel||String(item.class_level||"").toLowerCase()===classLevel.toLowerCase());

  async function save(){
    if(!canSave)return;
    const students=(data.students||[]).map((student)=>({studentUserId:student.user_id,status:records[student.user_id]||"absent"}));
    Alert.alert("Submit attendance?","These records will be saved for coordinator approval.",[
      {text:"Cancel",style:"cancel"},
      {text:"Submit",onPress:async()=>{setSaving(true);setError("");try{const result=await api.teacher.attendance.save({lectureId,students});setNotice(result?.message||"Attendance saved for coordinator approval.");await load({refresh:true,preserveNotice:true});}catch(nextError){setError(nextError?.message||"Unable to save attendance.");}finally{setSaving(false);}}},
    ]);
  }

  if(loading)return <DashboardSkeleton message="Preparing the attendance roster..."/>;
  return <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={()=>load({refresh:true})} refreshing={refreshing} tintColor={colors.gold}/>}>
    <AppText variant="display">Attendance</AppText><AppText style={styles.subtitle}>Record attendance for your completed or live classrooms.</AppText>
    {error&&!data.selectedLecture?<SurfaceCard style={styles.error}><AppText style={styles.errorText}>{error}</AppText><PillButton label="Try Again" onPress={()=>load()} style={styles.retry}/></SurfaceCard>:null}
    <Step number="1" title="Select Class"/><Rail>{(data.classes||[]).map((item,index)=>{const value=classValue(item);return <Chip active={classLevel===value} key={`${value}-${index}`} label={value||"Unassigned"} onPress={()=>chooseClass(value)}/>;})}</Rail>
    {classLevel?<><Step number="2" title="Select Subject"/><SubjectDropdown allowAll={false} onChange={chooseSubject} options={subjects} placeholder="Choose a subject" selectedId={subjectId}/></>:null}
    {classLevel&&subjectId?<><Step number="3" title="Select Lecture"/><View style={styles.lectureList}>{(data.lectures||[]).length?data.lectures.map((item)=><Pressable key={item.id} onPress={()=>chooseLecture(item.id)} style={[styles.lecture,item.id===lectureId&&styles.selectedLecture]}><View style={styles.lectureIcon}><Ionicons color={colors.secondary} name="videocam-outline" size={18}/></View><View style={styles.lectureBody}><AppText style={styles.lectureTitle}>{item.title||item.subject_name}</AppText><AppText style={styles.lectureMeta}>{dateTime(item.scheduled_start)} · {String(item.status||"").replaceAll("_"," ")}</AppText></View>{item.id===lectureId?<Ionicons color={colors.emeraldMid} name="checkmark-circle" size={22}/>:null}</Pressable>):<Empty text="No completed or active lectures are available for this selection."/ >}</View></>:null}
    {data.selectedLecture?<><View style={styles.rosterHead}><View><AppText style={styles.rosterTitle}>Student Roster</AppText><AppText style={styles.rosterMeta}>{data.students?.length||0} assigned students</AppText></View><Pressable onPress={()=>markAll("present")} style={styles.allPresent}><Ionicons color={colors.emeraldMid} name="checkmark-done-outline" size={15}/><AppText style={styles.allPresentText}>All Present</AppText></Pressable></View>
      <View style={styles.counts}>{STATUSES.map(([key,label,,tone])=><View key={key} style={[styles.count,styles[`${tone}Count`]]}><AppText style={styles.countValue}>{counts[key]||0}</AppText><AppText style={styles.countLabel}>{label}</AppText></View>)}</View>
      <View style={styles.roster}>{(data.students||[]).length?data.students.map((student)=><StudentRow key={student.user_id} onChange={(status)=>setRecords((current)=>({...current,[student.user_id]:status}))} status={records[student.user_id]||"absent"} student={student}/>):<Empty text="No active students were found for this class."/ >}</View>
      {!canSave?<View style={styles.locked}><Ionicons color={colors.statusPendingText} name="lock-closed-outline" size={18}/><AppText style={styles.lockedText}>Attendance can be submitted only while a lecture is live or after it is marked conducted.</AppText></View>:null}
      {notice?<SurfaceCard style={styles.success}><AppText style={styles.successText}>{notice}</AppText></SurfaceCard>:null}
      {error?<SurfaceCard style={styles.error}><AppText style={styles.errorText}>{error}</AppText></SurfaceCard>:null}
      <PillButton disabled={!canSave} icon={<Ionicons color={colors.white} name="cloud-upload-outline" size={18}/>} loading={saving} onPress={save} style={styles.save}>Save for Approval</PillButton>
    </>:null}
    {!classLevel&&(data.classes||[]).length===0?<Empty text="No assigned classes are available for attendance."/ >:null}
  </Screen>;
}

/** Numbered label makes the dependent selection workflow explicit. */
function Step({number,title}){return <View style={styles.step}><View style={styles.stepNumber}><AppText style={styles.stepNumberText}>{number}</AppText></View><AppText style={styles.stepTitle}>{title}</AppText></View>;}
function Rail({children}){return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>{children}</ScrollView>;}
function Chip({active,label,onPress}){return <Pressable onPress={onPress} style={[styles.chip,active&&styles.activeChip]}><AppText style={[styles.chipText,active&&styles.activeChipText]}>{label}</AppText></Pressable>;}
function StudentRow({onChange,status,student}){return <View style={styles.student}><View style={styles.avatar}><AppText style={styles.initial}>{String(student.full_name||"S")[0].toUpperCase()}</AppText></View><View style={styles.studentBody}><AppText style={styles.studentName}>{student.full_name||"Student"}</AppText><AppText style={styles.studentMeta}>{student.username||student.email||student.phone||"Student account"}</AppText><View style={styles.statuses}>{STATUSES.map(([value,label,icon,tone])=><Pressable key={value} onPress={()=>onChange(value)} style={[styles.status,styles[`${tone}Status`],status===value&&styles[`${tone}Active`]]}><Ionicons color={status===value?colors.white:styles[`${tone}Text`].color} name={icon} size={13}/><AppText style={[styles.statusText,styles[`${tone}Text`],status===value&&styles.activeStatusText]}>{label}</AppText></Pressable>)}</View></View></View>;}
function Empty({text}){return <View style={styles.empty}><Ionicons color={colors.outline} name="people-outline" size={24}/><AppText style={styles.emptyText}>{text}</AppText></View>;}

const styles=StyleSheet.create({
  content:{paddingTop:space.lg,paddingBottom:space.xl},subtitle:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.sm},step:{flexDirection:"row",alignItems:"center",marginTop:space.xl,marginBottom:space.sm},stepNumber:{width:28,height:28,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:colors.primary},stepNumberText:{color:colors.white,fontFamily:fonts.bodyBold,fontSize:10},stepTitle:{marginLeft:space.sm,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.lg},rail:{flexGrow:0},railContent:{gap:space.xs,paddingRight:space.lg},chip:{height:40,justifyContent:"center",paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:20,backgroundColor:colors.surface},activeChip:{backgroundColor:colors.primary},chipText:{color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold,fontSize:10},activeChipText:{color:colors.white},
  lectureList:{gap:space.sm},lecture:{minHeight:70,flexDirection:"row",alignItems:"center",padding:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:radius.xl,backgroundColor:colors.surface},selectedLecture:{borderColor:colors.emeraldLight,backgroundColor:"#DDF4EA"},lectureIcon:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.goldPale},lectureBody:{flex:1,marginLeft:space.md},lectureTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},lectureMeta:{marginTop:2,color:colors.outline,fontSize:9},
  rosterHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:space.xl,marginBottom:space.sm},rosterTitle:{color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},rosterMeta:{color:colors.outline,fontSize:9},allPresent:{flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:space.sm,paddingVertical:8,borderRadius:radius.full,backgroundColor:"#DDF4EA"},allPresentText:{color:colors.emeraldMid,fontFamily:fonts.bodyBold,fontSize:9},counts:{flexDirection:"row",gap:space.sm,marginBottom:space.md},count:{flex:1,alignItems:"center",padding:space.sm,borderRadius:radius.lg},successCount:{backgroundColor:colors.statusPresentBg},dangerCount:{backgroundColor:colors.statusAbsentBg},warningCount:{backgroundColor:colors.statusPendingBg},countValue:{color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.lg},countLabel:{color:colors.onSurfaceVariant,fontFamily:fonts.bodyBold,fontSize:8,textTransform:"uppercase"},
  roster:{gap:space.sm},student:{flexDirection:"row",alignItems:"flex-start",padding:space.md,borderRadius:radius.xl,backgroundColor:colors.surface,...shadows.subtle},avatar:{width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:21,backgroundColor:colors.primaryContainer},initial:{color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize.base},studentBody:{flex:1,marginLeft:space.md},studentName:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},studentMeta:{color:colors.outline,fontSize:9},statuses:{flexDirection:"row",gap:4,marginTop:space.sm},status:{flex:1,minHeight:34,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:3,borderWidth:1,borderRadius:17},successStatus:{borderColor:colors.statusPresentText,backgroundColor:colors.statusPresentBg},dangerStatus:{borderColor:colors.statusAbsentText,backgroundColor:colors.statusAbsentBg},warningStatus:{borderColor:colors.statusPendingText,backgroundColor:colors.statusPendingBg},successActive:{backgroundColor:colors.statusPresentText},dangerActive:{backgroundColor:colors.statusAbsentText},warningActive:{backgroundColor:colors.statusPendingText},statusText:{fontFamily:fonts.bodyBold,fontSize:8},successText:{color:colors.statusPresentText},dangerText:{color:colors.statusAbsentText},warningText:{color:colors.statusPendingText},activeStatusText:{color:colors.white},
  locked:{flexDirection:"row",alignItems:"center",gap:space.sm,marginTop:space.md,padding:space.md,borderRadius:radius.lg,backgroundColor:colors.statusPendingBg},lockedText:{flex:1,color:colors.statusPendingText,fontSize:fontSize.xs},success:{marginTop:space.md,backgroundColor:colors.statusPresentBg},error:{marginTop:space.md,backgroundColor:colors.errorContainer},errorText:{color:colors.error,fontSize:fontSize.xs},retry:{alignSelf:"flex-start",marginTop:space.sm},save:{marginTop:space.lg},empty:{alignItems:"center",padding:space.xl,borderRadius:radius.xl,backgroundColor:colors.surfaceLow},emptyText:{marginTop:space.sm,color:colors.outline,fontSize:fontSize.xs,textAlign:"center"},
});
