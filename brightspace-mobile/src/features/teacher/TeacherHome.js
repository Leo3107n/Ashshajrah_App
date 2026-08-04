/**
 * Teacher home dashboard. It consumes the role-scoped Teacher dashboard API
 * and turns lecture, student, subject, and report totals into a mobile-first
 * operational view with direct links to the next Teacher workflows.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, StatusChip, SurfaceCard } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function firstName(user) {
  // The welcome area intentionally uses a first name to match the compact
  // greeting used throughout the supplied mobile design.
  return String(user?.name || user?.full_name || "Teacher").trim().split(/\s+/)[0];
}

function readable(value) {
  return String(value || "scheduled").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function lectureStatus(item) {
  // The dashboard API returns the stored lecture status. Time comparisons add
  // live/upcoming meaning on the device without modifying the database value.
  const status = String(item?.display_status || item?.status || "").toLowerCase();
  const now = Date.now();
  const start = new Date(item?.scheduled_start || 0).getTime();
  const end = new Date(item?.scheduled_end || 0).getTime();
  if (["completed_by_teacher", "verified_by_coordinator"].includes(status)) return "completed";
  if (start <= now && end >= now) return "live";
  if (start > now) return "upcoming";
  return status || "ended";
}

function time(value) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TeacherHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState({ stats: {}, today: [], headlines: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    // Initial loads use the branded skeleton; pull-to-refresh keeps existing
    // content visible and uses the platform refresh state instead.
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const result = await api.teacher.dashboard();
      setData({
        stats: result?.stats || {},
        today: result?.today || [],
        headlines: result?.headlines || [],
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load your Teacher dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nextLecture = useMemo(
    // Prioritize a classroom that can be entered now, then the next upcoming
    // lecture, while retaining the first record as a useful fallback.
    () => data.today.find((item) => ["live", "upcoming"].includes(lectureStatus(item))) || data.today[0],
    [data.today]
  );
  const stats = data.stats || {};
  const cards = [
    // These values come directly from the teacher-filtered backend query, so a
    // Teacher never sees another teacher's workload or student totals.
    ["Today's Lectures", stats.today_lectures || 0, "calendar-outline", "mint"],
    ["Assigned Students", stats.assigned_students || 0, "people-outline", "gold"],
    ["Subjects", stats.assigned_subjects || 0, "book-outline", "blue"],
    ["Reports Pending", stats.pending_completion_reports || 0, "document-text-outline", "rose"],
  ];

  if (loading) return <DashboardSkeleton message="Preparing your teaching workspace..." />;
  if (error) return <Screen contentContainerStyle={styles.errorScreen}><SurfaceCard><Ionicons color={colors.error} name="cloud-offline-outline" size={32}/><AppText style={styles.errorTitle} variant="heading">Teacher dashboard unavailable</AppText><AppText style={styles.errorBody}>{error}</AppText><PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton></SurfaceCard></Screen>;

  return <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold}/>}>
    <LinearGradient colors={[colors.primaryContainer, "#0D5C48"]} style={styles.hero}>
      <AppText style={styles.eyebrow}>TEACHER PORTAL</AppText>
      <AppText style={styles.greeting} variant="display">Salaam, {firstName(user)}!</AppText>
      <AppText style={styles.heroBody}>Guide today’s learning with clarity and care.</AppText>
    </LinearGradient>

    {data.headlines[0] ? <View style={styles.notice}><Ionicons color={colors.secondary} name="megaphone-outline" size={18}/><View style={styles.noticeBody}><AppText style={styles.noticeTitle}>{data.headlines[0].title || "School Update"}</AppText><AppText numberOfLines={2} style={styles.noticeText}>{data.headlines[0].content || data.headlines[0].message}</AppText></View></View> : null}

    <View style={styles.stats}>{cards.map(([label,value,icon,tone])=><View key={label} style={styles.statCard}><View style={[styles.statIcon,styles[`${tone}Tone`]]}><Ionicons color={colors.primary} name={icon} size={20}/></View><AppText style={styles.statValue}>{String(value)}</AppText><AppText style={styles.statLabel}>{label}</AppText></View>)}</View>

    <View style={styles.sectionHead}><AppText style={styles.sectionTitle}>Next Lecture</AppText><Pressable onPress={() => router.push("/(app)/teacher/lectures")}><AppText style={styles.link}>View schedule →</AppText></Pressable></View>
    {nextLecture ? <SurfaceCard style={styles.nextCard}><View style={styles.nextTop}><View style={styles.nextBody}><AppText style={styles.subject}>{nextLecture.subject_name || nextLecture.title || "Scheduled lecture"}</AppText><AppText style={styles.lectureMeta}>{time(nextLecture.scheduled_start)} – {time(nextLecture.scheduled_end)} · {nextLecture.student_count || 0} students</AppText></View><StatusChip tone={lectureStatus(nextLecture)==="live"?"success":"warning"}>{readable(lectureStatus(nextLecture))}</StatusChip></View>{nextLecture.student_name ? <AppText numberOfLines={2} style={styles.students}>{nextLecture.student_name}</AppText>:null}{nextLecture.google_meet_link ? <PillButton icon={<Ionicons color={colors.white} name="videocam-outline" size={18}/>} onPress={() => Linking.openURL(nextLecture.google_meet_link)} style={styles.join}>Open Classroom</PillButton>:null}</SurfaceCard> : <Empty icon="calendar-outline" text="No lectures are scheduled for today."/>}

    <AppText style={styles.sectionTitleStandalone}>Today’s Schedule</AppText>
    <View style={styles.list}>{data.today.length ? data.today.map((item,index)=><Pressable key={item.id || index} onPress={() => router.push("/(app)/teacher/lectures")} style={styles.lectureRow}><View style={[styles.timelineDot,index%2&&styles.timelineGold]}/><View style={styles.lectureBody}><AppText style={styles.lectureTitle}>{item.subject_name || item.title}</AppText><AppText style={styles.lectureMeta}>{time(item.scheduled_start)} – {time(item.scheduled_end)} · {item.student_count || 0} students</AppText></View><Ionicons color={colors.outline} name="chevron-forward" size={18}/></Pressable>) : <Empty icon="leaf-outline" text="Your teaching schedule is clear today."/>}</View>

    <AppText style={styles.sectionTitleStandalone}>Quick Actions</AppText>
    <View style={styles.actions}><Action icon="checkbox-outline" label="Attendance" onPress={() => router.push("/(app)/teacher/attendance")}/><Action icon="book-outline" label="Homework" onPress={() => router.push("/(app)/teacher/homework")}/><Action icon="document-text-outline" label="Completion Reports" onPress={() => router.push("/(app)/teacher/completion-reports")}/><Action icon="chatbubbles-outline" label="Notes" onPress={() => router.push("/(app)/teacher/notes")}/><Action icon="people-outline" label="Students" onPress={() => router.push("/(app)/teacher/students")}/><Action icon="calendar-number-outline" label="Internal Events" onPress={() => router.push("/(app)/teacher/internal-events")}/></View>
  </Screen>;
}

/** Compact role-safe shortcut used for the Teacher's primary workflows. */
function Action({ icon, label, onPress }) { return <Pressable onPress={onPress} style={styles.action}><View style={styles.actionIcon}><Ionicons color={colors.secondary} name={icon} size={21}/></View><AppText style={styles.actionLabel}>{label}</AppText></Pressable>; }

/** Shared empty state keeps no-data conditions informative and visually quiet. */
function Empty({ icon, text }) { return <View style={styles.empty}><Ionicons color={colors.outline} name={icon} size={22}/><AppText style={styles.emptyText}>{text}</AppText></View>; }

const styles=StyleSheet.create({
  content:{paddingTop:space.md,paddingBottom:space.xl},hero:{padding:space.xl,borderRadius:radius["2xl"],...shadows.hero},eyebrow:{color:"#B9EEDB",fontFamily:fonts.bodyBold,fontSize:10,letterSpacing:1.2},greeting:{marginTop:space.xs,color:colors.white,fontSize:27,lineHeight:34},heroBody:{marginTop:space.xs,color:"#D6E9E2",fontSize:fontSize.sm},
  notice:{flexDirection:"row",alignItems:"flex-start",marginTop:space.md,padding:space.md,borderRadius:radius.xl,backgroundColor:colors.goldPale},noticeBody:{flex:1,marginLeft:space.sm},noticeTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},noticeText:{marginTop:2,color:colors.onSurfaceVariant,fontSize:10},
  stats:{flexDirection:"row",flexWrap:"wrap",gap:space.sm,marginTop:space.md},statCard:{flexBasis:"47%",flexGrow:1,minHeight:112,padding:space.md,borderRadius:radius.xl,backgroundColor:colors.surface,...shadows.subtle},statIcon:{width:36,height:36,alignItems:"center",justifyContent:"center",borderRadius:18},mintTone:{backgroundColor:"#DDF4EA"},goldTone:{backgroundColor:colors.goldPale},blueTone:{backgroundColor:colors.statusScheduledBg},roseTone:{backgroundColor:colors.roseBg},statValue:{marginTop:space.sm,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},statLabel:{color:colors.onSurfaceVariant,fontFamily:fonts.bodyBold,fontSize:9,textTransform:"uppercase"},
  sectionHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:space.xl,marginBottom:space.sm},sectionTitle:{color:colors.primary,fontFamily:fonts.display,fontSize:fontSize.lg},link:{color:colors.secondary,fontFamily:fonts.bodyBold,fontSize:10},nextCard:{borderLeftWidth:4,borderLeftColor:colors.gold},nextTop:{flexDirection:"row",alignItems:"flex-start"},nextBody:{flex:1,paddingRight:space.sm},subject:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.base},lectureMeta:{marginTop:3,color:colors.outline,fontSize:fontSize.xs},students:{marginTop:space.sm,color:colors.onSurfaceVariant,fontSize:10},join:{marginTop:space.md},
  sectionTitleStandalone:{marginTop:space.xl,marginBottom:space.sm,color:colors.primary,fontFamily:fonts.display,fontSize:fontSize.lg},list:{gap:space.sm},lectureRow:{minHeight:68,flexDirection:"row",alignItems:"center",padding:space.md,borderRadius:radius.lg,backgroundColor:colors.surface},timelineDot:{width:10,height:10,marginRight:space.md,borderRadius:5,backgroundColor:colors.emeraldLight},timelineGold:{backgroundColor:colors.gold},lectureBody:{flex:1},lectureTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:space.sm},action:{flexBasis:"47%",flexGrow:1,minHeight:88,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.borderGreen,borderRadius:radius.xl,backgroundColor:colors.surfaceLow},actionIcon:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.goldPale},actionLabel:{marginTop:space.xs,color:colors.primary,fontFamily:fonts.bodyBold,fontSize:9,textAlign:"center"},empty:{flexDirection:"row",alignItems:"center",padding:space.lg,borderRadius:radius.xl,backgroundColor:colors.surfaceLow},emptyText:{flex:1,marginLeft:space.sm,color:colors.outline,fontSize:fontSize.xs},
  errorScreen:{justifyContent:"center"},errorTitle:{marginTop:space.md},errorBody:{marginTop:space.sm,color:colors.onSurfaceVariant},retry:{marginTop:space.lg},
});
