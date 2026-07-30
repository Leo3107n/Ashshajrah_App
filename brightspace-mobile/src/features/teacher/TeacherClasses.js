/**
 * Assigned Classes and Subjects for the Teacher role. The Teacher classes API
 * returns scoped lecture assignments; this screen groups them by class and
 * subject, deduplicates students, and retains lectures for detail inspection.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function clean(value, fallback) {
  return String(value || "").trim() || fallback;
}

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function time(value) {
  if (!value) return "--:--";
  return new Date(value).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function displayStatus(item) {
  const stored = String(item?.display_status || item?.status || "").toLowerCase();
  if (stored) return stored;
  return new Date(item?.scheduled_start || 0).getTime() > Date.now() ? "upcoming" : "ended";
}

function groupAssignments(items) {
  const grouped = new Map();
  for (const item of items || []) {
    const className = clean(item.class_level || item.course_title, "Unassigned Class");
    const subjectName = clean(item.subject_name, "Unassigned Subject");
    const key = `${className.toLowerCase()}::${subjectName.toLowerCase()}`;
    if (!grouped.has(key)) grouped.set(key, { id: key, className, subjectName, lectures: [], students: new Set() });
    const group = grouped.get(key);
    group.lectures.push(item);
    String(item.student_name || "").split(",").map((name) => name.trim()).filter(Boolean).forEach((name) => group.students.add(name));
  }
  return [...grouped.values()].map((group) => {
    const lectures = [...group.lectures].sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start));
    const upcoming = lectures.filter((item)=>["upcoming","live","scheduled"].includes(displayStatus(item)));
    return { ...group, students:[...group.students].sort(), lectureCount:lectures.length, upcomingCount:upcoming.length, nextLecture:upcoming[0] || null };
  }).sort((a,b)=>a.className.localeCompare(b.className)||a.subjectName.localeCompare(b.subjectName));
}

export default function TeacherClasses() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const result = await api.teacher.classes({ range: "all" });
      setItems(result?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load assigned classes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Aggregation is memoized because search input should filter existing groups
  // without rebuilding their student sets and lecture order on every keypress.
  const groups = useMemo(() => groupAssignments(items), [items]);
  const subjects = useMemo(() => [...new Set(groups.map((item)=>item.subjectName))].sort(), [groups]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groups.filter((group) => (!subject || group.subjectName === subject) && (!term || [group.className, group.subjectName, ...group.students].some((value)=>value.toLowerCase().includes(term))));
  }, [groups, search, subject]);
  const uniqueStudents = useMemo(() => new Set(groups.flatMap((group)=>group.students)).size, [groups]);

  if (loading) return <DashboardSkeleton message="Gathering your assigned classes..." />;
  if (error && !items.length) return <Screen contentContainerStyle={styles.errorScreen}><SurfaceCard><Ionicons color={colors.error} name="cloud-offline-outline" size={32}/><AppText style={styles.errorTitle} variant="heading">Classes unavailable</AppText><AppText style={styles.errorBody}>{error}</AppText><PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton></SurfaceCard></Screen>;

  return <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold}/>}>
    <AppText variant="display">My Classes</AppText>
    <AppText style={styles.subtitle}>Your assigned classes, subjects, students, and lecture activity.</AppText>
    <View style={styles.summary}><Summary icon="school-outline" label="Assignments" value={groups.length}/><Summary icon="people-outline" label="Students" value={uniqueStudents}/><Summary icon="book-outline" label="Subjects" value={subjects.length}/></View>
    <View style={styles.search}><Ionicons color={colors.outline} name="search-outline" size={20}/><TextInput onChangeText={setSearch} placeholder="Search class, subject, or student..." placeholderTextColor={colors.outline} style={styles.input} value={search}/>{search ? <Pressable onPress={()=>setSearch("")}><Ionicons color={colors.outline} name="close-circle" size={19}/></Pressable>:null}</View>
    {subjects.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRail} contentContainerStyle={styles.filters}><Chip active={!subject} label="All Subjects" onPress={()=>setSubject("")}/>{subjects.map((item)=><Chip active={subject===item} key={item} label={item} onPress={()=>setSubject(item)}/>)}</ScrollView>:null}
    {error ? <SurfaceCard style={styles.warning}><AppText style={styles.warningText}>{error}</AppText></SurfaceCard>:null}
    <View style={styles.list}>{filtered.length ? filtered.map((group)=><ClassCard group={group} key={group.id} onPress={()=>setSelected(group)}/>) : <View style={styles.empty}><Ionicons color={colors.outline} name="school-outline" size={30}/><AppText style={styles.emptyTitle}>No assignments found</AppText><AppText style={styles.emptyBody}>{groups.length ? "Try changing the search or subject filter." : "Class assignments will appear when lectures are scheduled for you."}</AppText></View>}</View>
    <ClassDetail group={selected} onClose={()=>setSelected(null)}/>
  </Screen>;
}

function Summary({ icon, label, value }) { return <View style={styles.summaryItem}><Ionicons color={colors.emeraldMid} name={icon} size={18}/><AppText style={styles.summaryValue}>{String(value)}</AppText><AppText numberOfLines={1} style={styles.summaryLabel}>{label}</AppText></View>; }
function Chip({ active, label, onPress }) { return <Pressable onPress={onPress} style={[styles.chip,active&&styles.activeChip]}><AppText style={[styles.chipText,active&&styles.activeChipText]}>{label}</AppText></Pressable>; }
function ClassCard({ group, onPress }) { return <Pressable onPress={onPress} style={styles.card}><View style={styles.cardIcon}><Ionicons color={colors.secondary} name="school-outline" size={22}/></View><View style={styles.cardBody}><AppText style={styles.className}>{group.className}</AppText><AppText style={styles.subjectName}>{group.subjectName}</AppText><View style={styles.cardMeta}><Meta icon="people-outline" text={`${group.students.length} students`}/><Meta icon="calendar-outline" text={`${group.lectureCount} lectures`}/></View>{group.nextLecture ? <AppText style={styles.nextText}>Next: {time(group.nextLecture.scheduled_start)}</AppText>:<AppText style={styles.nextText}>No upcoming lecture</AppText>}</View><View style={styles.cardEnd}>{group.upcomingCount ? <StatusChip tone="warning">{group.upcomingCount} upcoming</StatusChip>:null}<Ionicons color={colors.outline} name="chevron-forward" size={18}/></View></Pressable>; }
function Meta({ icon, text }) { return <View style={styles.meta}><Ionicons color={colors.outline} name={icon} size={13}/><AppText style={styles.metaText}>{text}</AppText></View>; }
function ClassDetail({ group, onClose }) { return <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(group)}><View style={styles.backdrop}><View style={styles.sheet}><View style={styles.sheetHead}><View><AppText style={styles.sheetClass}>{group?.className}</AppText><AppText style={styles.sheetSubject}>{group?.subjectName}</AppText></View><Pressable accessibilityLabel="Close class details" onPress={onClose} style={styles.close}><Ionicons color={colors.primary} name="close" size={22}/></Pressable></View><ScrollView showsVerticalScrollIndicator={false}><AppText style={styles.detailHeading}>Students ({group?.students?.length || 0})</AppText><AppText style={styles.studentNames}>{group?.students?.join(", ") || "No active students found."}</AppText><AppText style={styles.detailHeading}>Lecture Activity</AppText>{(group?.lectures||[]).length ? group.lectures.map((item)=><View key={item.id} style={styles.lecture}><View style={styles.lectureBody}><AppText style={styles.lectureTitle}>{item.title || item.subject_name}</AppText><AppText style={styles.lectureTime}>{time(item.scheduled_start)} – {time(item.scheduled_end)}</AppText></View><StatusChip tone={["live","completed_by_teacher","verified_by_coordinator"].includes(displayStatus(item))?"success":"neutral"}>{readable(displayStatus(item))}</StatusChip></View>):<AppText style={styles.studentNames}>No lecture records.</AppText>}</ScrollView></View></View></Modal>; }

const styles=StyleSheet.create({
  content:{paddingTop:space.lg,paddingBottom:space.xl},subtitle:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.sm},summary:{flexDirection:"row",gap:space.sm,marginTop:space.lg},summaryItem:{flex:1,minWidth:0,alignItems:"center",paddingVertical:space.md,paddingHorizontal:space.xs,borderRadius:radius.xl,backgroundColor:colors.surface},summaryValue:{marginTop:3,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.lg},summaryLabel:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:8,textTransform:"uppercase"},
  search:{minHeight:50,flexDirection:"row",alignItems:"center",marginTop:space.md,paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:radius.xl,backgroundColor:colors.surface},input:{flex:1,marginHorizontal:space.sm,color:colors.onSurface,fontFamily:fonts.body},filterRail:{flexGrow:0,marginTop:space.md},filters:{gap:space.xs,paddingRight:space.lg},chip:{height:38,justifyContent:"center",paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:19,backgroundColor:colors.surface},activeChip:{backgroundColor:colors.primary},chipText:{color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold,fontSize:10},activeChipText:{color:colors.white},
  warning:{marginTop:space.md,backgroundColor:colors.statusPendingBg},warningText:{color:colors.statusPendingText,fontSize:fontSize.xs},list:{gap:space.sm,marginTop:space.lg},card:{minHeight:126,flexDirection:"row",alignItems:"flex-start",padding:space.md,borderRadius:radius.xl,backgroundColor:colors.surface,...shadows.subtle},cardIcon:{width:44,height:44,alignItems:"center",justifyContent:"center",borderRadius:22,backgroundColor:colors.goldPale},cardBody:{flex:1,minWidth:0,marginLeft:space.md},className:{color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.lg},subjectName:{color:colors.emeraldMid,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},cardMeta:{flexDirection:"row",flexWrap:"wrap",gap:space.sm,marginTop:space.sm},meta:{flexDirection:"row",alignItems:"center"},metaText:{marginLeft:3,color:colors.outline,fontSize:9},nextText:{marginTop:space.sm,color:colors.onSurfaceVariant,fontSize:9},cardEnd:{alignItems:"flex-end",gap:space.md,marginLeft:space.xs},
  empty:{alignItems:"center",padding:space.xl,borderRadius:radius.xl,backgroundColor:colors.surfaceLow},emptyTitle:{marginTop:space.sm,color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},emptyBody:{marginTop:3,color:colors.outline,fontSize:fontSize.xs,textAlign:"center"},errorScreen:{justifyContent:"center"},errorTitle:{marginTop:space.md},errorBody:{marginTop:space.sm,color:colors.onSurfaceVariant},retry:{marginTop:space.lg},
  backdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,39,30,0.35)"},sheet:{maxHeight:"88%",padding:space.lg,paddingBottom:space["2xl"],borderTopLeftRadius:radius.xl,borderTopRightRadius:radius.xl,backgroundColor:colors.background},sheetHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:space.lg},sheetClass:{color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},sheetSubject:{color:colors.emeraldMid,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},close:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.surfaceHigh},detailHeading:{marginTop:space.md,marginBottom:space.sm,color:colors.primary,fontFamily:fonts.display,fontSize:fontSize.lg},studentNames:{color:colors.onSurfaceVariant,fontSize:fontSize.xs,lineHeight:19},lecture:{minHeight:66,flexDirection:"row",alignItems:"center",paddingVertical:space.sm,borderBottomWidth:1,borderBottomColor:colors.borderGreen},lectureBody:{flex:1,paddingRight:space.sm},lectureTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},lectureTime:{marginTop:2,color:colors.outline,fontSize:9},
});
