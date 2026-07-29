import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import api from "../../../src/api";
import { AppText, Screen, StatusChip, SurfaceCard } from "../../../src/components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

const RANGES = [7, 30, 90, 365];
function readable(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function total(items) { return (items || []).reduce((sum, item) => sum + Number(item.total || 0), 0); }

export default function Reports() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState({ summary: {}, recentLeads: [], recentLectures: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try { setData(await api.coordinator.reports({ days })); }
    catch (nextError) { setError(nextError?.message || "Unable to load reports."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [days]);
  useEffect(() => { load(); }, [load]);
  const summary = data.summary || {};
  const overview = useMemo(() => [
    { label: "New Leads", value: total(summary.registrationPipeline), icon: "people-outline" },
    { label: "Payments", value: total(summary.feeVerification), icon: "wallet-outline" },
    { label: "Lectures", value: total(summary.teacherClassReport), icon: "school-outline" },
    { label: "Learner Activity", value: total(summary.studentActivity), icon: "pulse-outline" },
  ], [summary]);

  if (loading) return <View style={styles.center}><Ionicons color={colors.gold} name="bar-chart-outline" size={34} /><AppText style={styles.loading}>Building your insights...</AppText></View>;
  return <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}>
    <View style={styles.headingRow}><View style={styles.headingBody}><AppText variant="display">Reports</AppText><AppText style={styles.subtitle}>Read-only operational performance and activity.</AppText></View><View style={styles.readOnly}><Ionicons color={colors.secondary} name="eye-outline" size={14}/><AppText style={styles.readOnlyText}>READ ONLY</AppText></View></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rangeRail} contentContainerStyle={styles.ranges}>
      {RANGES.map((value) => <Pressable key={value} onPress={() => setDays(value)} style={[styles.range, days === value && styles.rangeActive]}><AppText style={[styles.rangeText, days === value && styles.rangeTextActive]}>{value === 365 ? "1 Year" : `${value} Days`}</AppText></Pressable>)}
    </ScrollView>
    {error ? <SurfaceCard style={styles.error}><AppText style={styles.errorText}>{error}</AppText></SurfaceCard> : null}
    <View style={styles.overview}>{overview.map((item) => <SurfaceCard key={item.label} style={styles.overviewCard}><Ionicons color={colors.emeraldMid} name={item.icon} size={20}/><AppText style={styles.overviewValue}>{item.value}</AppText><AppText numberOfLines={1} style={styles.overviewLabel}>{item.label}</AppText></SurfaceCard>)}</View>
    <ReportBlock icon="people-outline" items={summary.registrationPipeline} title="Admission Pipeline" />
    <ReportBlock icon="wallet-outline" items={summary.feeVerification} title="Payment Verification" />
    <ReportBlock icon="school-outline" items={summary.teacherClassReport} title="Teacher Workload" />
    <ReportBlock icon="pulse-outline" items={summary.studentActivity} title="Student Activity" />
    <AppText style={styles.sectionTitle}>Recent Admissions</AppText>
    <SurfaceCard style={styles.list}>{(data.recentLeads || []).length ? data.recentLeads.map((item) => <View key={item.id} style={styles.row}><View style={styles.rowBody}><AppText style={styles.rowTitle}>{item.student_name || "Unnamed student"}</AppText><AppText style={styles.rowMeta}>{item.class_level || "Class not assigned"} · {item.parent_name || "Parent unavailable"}</AppText></View><StatusChip tone="neutral">{readable(item.status)}</StatusChip></View>) : <Empty />}</SurfaceCard>
    <AppText style={styles.sectionTitle}>Recent Lectures</AppText>
    <SurfaceCard style={styles.list}>{(data.recentLectures || []).length ? data.recentLectures.map((item) => <View key={item.id} style={styles.row}><View style={styles.rowBody}><AppText style={styles.rowTitle}>{item.title || item.subject_name}</AppText><AppText style={styles.rowMeta}>{item.teacher_name} · {item.class_name}</AppText></View><StatusChip tone={["verified","completed"].includes(item.display_status) ? "success" : "neutral"}>{readable(item.display_status)}</StatusChip></View>) : <Empty />}</SurfaceCard>
  </Screen>;
}
function Empty() { return <AppText style={styles.empty}>No activity in this period.</AppText>; }
function ReportBlock({ icon, items = [], title }) { const max=Math.max(...items.map((item)=>Number(item.total||0)),1); return <View style={styles.block}><View style={styles.blockHead}><View style={styles.icon}><Ionicons color={colors.primary} name={icon} size={20}/></View><AppText style={styles.blockTitle}>{title}</AppText></View><SurfaceCard>{items.length ? items.map((item,index)=><View key={`${item.label}-${index}`} style={styles.metric}><View style={styles.metricTop}><AppText style={styles.metricLabel}>{readable(item.label)}</AppText><AppText style={styles.metricValue}>{String(item.total||0)}</AppText></View><View style={styles.track}><View style={[styles.fill,{width:`${Math.max(4,(Number(item.total||0)/max)*100)}%`}]} /></View></View>):<Empty />}</SurfaceCard></View>; }
const styles=StyleSheet.create({
  center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:colors.background},loading:{marginTop:space.md,color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold},content:{paddingTop:space.lg,paddingBottom:space.xl},headingRow:{flexDirection:"row",alignItems:"flex-start"},headingBody:{flex:1},subtitle:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.sm},readOnly:{flexDirection:"row",alignItems:"center",gap:4,marginLeft:space.sm,paddingHorizontal:8,paddingVertical:6,borderRadius:radius.lg,backgroundColor:colors.goldPale},readOnlyText:{color:colors.secondary,fontFamily:fonts.bodyBold,fontSize:8},
  rangeRail:{flexGrow:0,marginTop:space.lg},ranges:{gap:space.xs,paddingRight:space.lg},range:{height:38,justifyContent:"center",paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:19,backgroundColor:colors.surface},rangeActive:{backgroundColor:colors.primary},rangeText:{color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold,fontSize:10},rangeTextActive:{color:colors.white},error:{marginTop:space.md},errorText:{color:colors.error},
  overview:{flexDirection:"row",flexWrap:"wrap",gap:space.sm,marginTop:space.lg},overviewCard:{width:"48%",minHeight:112,padding:space.md},overviewValue:{marginTop:space.sm,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},overviewLabel:{color:colors.outline,fontFamily:fonts.bodySemibold,fontSize:10},
  block:{marginTop:space.xl},blockHead:{flexDirection:"row",alignItems:"center",marginBottom:space.sm},icon:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:"#DDF4EA"},blockTitle:{marginLeft:space.sm,color:colors.primary,fontFamily:fonts.display,fontSize:fontSize.lg},
  metric:{marginBottom:space.md},metricTop:{flexDirection:"row",justifyContent:"space-between"},metricLabel:{flex:1,color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold,fontSize:fontSize.xs},metricValue:{marginLeft:space.sm,color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},track:{height:7,marginTop:5,borderRadius:4,backgroundColor:colors.surfaceLow},fill:{height:7,borderRadius:4,backgroundColor:colors.emeraldMid},
  sectionTitle:{marginTop:space.xl,marginBottom:space.sm,color:colors.primary,fontFamily:fonts.display,fontSize:fontSize.lg},list:{paddingVertical:space.xs},row:{minHeight:64,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:colors.borderGreen},rowBody:{flex:1,paddingRight:space.sm},rowTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},rowMeta:{marginTop:2,color:colors.outline,fontSize:10},empty:{paddingVertical:space.md,color:colors.outline,fontSize:fontSize.xs},
});
