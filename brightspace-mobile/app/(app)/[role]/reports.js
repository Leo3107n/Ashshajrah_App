import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import api from "../../../src/api";
import { AppText, Screen, StatusChip, SurfaceCard } from "../../../src/components/ui";
import { colors, fonts, fontSize, radius, space } from "../../../src/theme";

function readable(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }

export default function Reports() {
  const [data, setData] = useState({ summary: {}, recentLeads: [], recentLectures: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true); setError("");
    try { setData(await api.coordinator.reports()); }
    catch (nextError) { setError(nextError?.message || "Unable to load reports."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <View style={styles.center}><Ionicons color={colors.gold} name="bar-chart-outline" size={34} /><AppText style={styles.loading}>Building your insights...</AppText></View>;
  const summary = data.summary || {};
  return <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}>
    <AppText variant="display">Reports & Insights</AppText><AppText style={styles.subtitle}>Operational trends across admissions, finance, teachers, and learners.</AppText>
    {error ? <SurfaceCard style={styles.error}><AppText style={styles.errorText}>{error}</AppText></SurfaceCard> : null}
    <ReportBlock color="mint" icon="people-outline" items={summary.registrationPipeline} title="Admission Pipeline" />
    <ReportBlock color="gold" icon="wallet-outline" items={summary.feeVerification} title="Payment Verification" />
    <ReportBlock color="blue" icon="school-outline" items={summary.teacherClassReport} title="Teacher Workload" />
    <ReportBlock color="rose" icon="pulse-outline" items={summary.studentActivity} title="Student Activity" />
    <AppText style={styles.sectionTitle}>Recent Lectures</AppText>
    <SurfaceCard style={styles.list}>{(data.recentLectures || []).map((item) => <View key={item.id} style={styles.row}><View style={styles.rowBody}><AppText style={styles.rowTitle}>{item.title || item.subject_name}</AppText><AppText style={styles.rowMeta}>{item.teacher_name} · {item.class_name}</AppText></View><StatusChip tone={["verified","completed"].includes(item.display_status) ? "success" : "neutral"}>{readable(item.display_status)}</StatusChip></View>)}</SurfaceCard>
  </Screen>;
}
function ReportBlock({ color, icon, items = [], title }) { const max=Math.max(...items.map((item)=>Number(item.total||0)),1); return <View style={styles.block}><View style={styles.blockHead}><View style={[styles.icon,styles[`${color}Icon`]]}><Ionicons color={colors.primary} name={icon} size={20}/></View><AppText style={styles.blockTitle}>{title}</AppText></View><SurfaceCard>{items.length ? items.map((item,index)=><View key={`${item.label}-${index}`} style={styles.metric}><View style={styles.metricTop}><AppText style={styles.metricLabel}>{readable(item.label)}</AppText><AppText style={styles.metricValue}>{String(item.total||0)}</AppText></View><View style={styles.track}><View style={[styles.fill,{width:`${Math.max(4,(Number(item.total||0)/max)*100)}%`}]} /></View></View>):<AppText style={styles.rowMeta}>No report data available.</AppText>}</SurfaceCard></View>; }
const styles=StyleSheet.create({
 center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:colors.background},loading:{marginTop:space.md,color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold},content:{paddingTop:space.lg,paddingBottom:space.xl},subtitle:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.sm},error:{marginTop:space.md},errorText:{color:colors.error},
 block:{marginTop:space.xl},blockHead:{flexDirection:"row",alignItems:"center",marginBottom:space.sm},icon:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19},mintIcon:{backgroundColor:"#DDF4EA"},goldIcon:{backgroundColor:colors.goldPale},blueIcon:{backgroundColor:colors.statusScheduledBg},roseIcon:{backgroundColor:colors.roseBg},blockTitle:{marginLeft:space.sm,color:colors.primary,fontFamily:fonts.display,fontSize:fontSize.lg},
 metric:{marginBottom:space.md},metricTop:{flexDirection:"row",justifyContent:"space-between"},metricLabel:{color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold,fontSize:fontSize.xs},metricValue:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},track:{height:7,marginTop:5,borderRadius:4,backgroundColor:colors.surfaceLow},fill:{height:7,borderRadius:4,backgroundColor:colors.emeraldMid},
 sectionTitle:{marginTop:space.xl,marginBottom:space.sm,color:colors.primary,fontFamily:fonts.display,fontSize:fontSize.lg},list:{paddingVertical:space.xs},row:{minHeight:58,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:colors.borderGreen},rowBody:{flex:1},rowTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},rowMeta:{color:colors.outline,fontSize:10},
});
