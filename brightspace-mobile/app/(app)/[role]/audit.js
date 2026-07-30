/**
 * Immutable Audit History. Server filters and local search feed a read-only
 * detail sheet; no edit or deletion controls are exposed.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../../src/api";
import { AppText, DashboardSkeleton, Screen, SurfaceCard } from "../../../src/components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

function readable(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }

export default function AuditHistory() {
  const [data, setData] = useState({ items: [], summary: {}, actions: [], entityTypes: [] });
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [days, setDays] = useState(30);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try { setData(await api.admin.auditLogs({ action: action || undefined, entityType: entityType || undefined, days })); }
    catch (nextError) { setError(nextError?.message || "Unable to load audit history."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [action, days, entityType]);
  useEffect(() => { load(); }, [load]);
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? (data.items || []).filter((item) => [item.action, item.description, item.entity_type, item.actor_name, item.actor_email].some((value) => String(value || "").toLowerCase().includes(term))) : data.items || [];
  }, [data.items, search]);
  if (loading) return <DashboardSkeleton message="Reviewing system history..." />;
  return <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}>
    <View style={styles.headingRow}><View style={styles.headingBody}><AppText variant="display">Audit History</AppText><AppText style={styles.subtitle}>A traceable record of administrative system changes.</AppText></View><View style={styles.readOnly}><Ionicons color={colors.secondary} name="lock-closed-outline" size={13}/><AppText style={styles.readOnlyText}>READ ONLY</AppText></View></View>
    <View style={styles.stats}><Stat label="Matching" value={data.summary?.total} /><Stat label="Loaded" value={data.summary?.loaded} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rangeRail} contentContainerStyle={styles.ranges}>
      {[7,30,90,365].map((value) => <Chip active={days === value} key={value} label={value === 365 ? "1 Year" : `${value} Days`} onPress={() => setDays(value)} />)}
    </ScrollView>
    <View style={styles.search}><Ionicons color={colors.outline} name="search-outline" size={20} /><TextInput onChangeText={setSearch} placeholder="Search action, actor, or entity..." placeholderTextColor={colors.outline} style={styles.input} value={search} /></View>
    <FilterRail items={data.actions} selected={action} allLabel="All Actions" onSelect={setAction} />
    <FilterRail items={data.entityTypes} selected={entityType} allLabel="All Entities" onSelect={setEntityType} />
    {error ? <SurfaceCard style={styles.error}><AppText style={styles.errorText}>{error}</AppText></SurfaceCard> : null}
    <View style={styles.list}>{items.length ? items.map((item) => <Pressable key={item.id} onPress={() => setSelected(item)} style={styles.card}><View style={styles.icon}><Ionicons color={colors.secondary} name="shield-outline" size={19} /></View><View style={styles.body}><AppText style={styles.title}>{readable(item.action)}</AppText><AppText numberOfLines={2} style={styles.description}>{item.description || `${readable(item.entity_type)} updated`}</AppText><AppText style={styles.meta}>{item.actor_name || "System"} · {item.created_at ? new Date(item.created_at).toLocaleString() : "Time unavailable"}</AppText></View><Ionicons color={colors.outline} name="chevron-forward" size={18}/></Pressable>) : <View style={styles.empty}><AppText style={styles.description}>No audit records match these filters.</AppText></View>}</View>
    <AuditDetail item={selected} onClose={() => setSelected(null)} />
  </Screen>;
}
function Stat({ label, value }) { return <View style={styles.stat}><AppText style={styles.statValue}>{String(value || 0)}</AppText><AppText style={styles.statLabel}>{label}</AppText></View>; }
function Chip({ active, label, onPress }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.activeChip]}><AppText style={[styles.chipText, active && styles.activeChipText]}>{label}</AppText></Pressable>; }
function FilterRail({ allLabel, items = [], onSelect, selected }) { if (!items.length) return null; return <View style={styles.filterFrame}><ScrollView alwaysBounceVertical={false} horizontal showsHorizontalScrollIndicator={false} style={styles.filterRail} contentContainerStyle={styles.filters}><Chip active={!selected} label={allLabel} onPress={() => onSelect("")}/>{items.slice(0,12).map((item)=><Chip active={selected===item} key={item} label={readable(item)} onPress={()=>onSelect(item)}/>)}</ScrollView></View>; }
function AuditDetail({ item, onClose }) {
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}><View style={styles.modalBackdrop}><View style={styles.sheet}>
    <View style={styles.sheetHead}><View style={styles.sheetTitle}><Ionicons color={colors.secondary} name="shield-checkmark-outline" size={22}/><AppText style={styles.detailTitle}>Audit Record</AppText></View><Pressable accessibilityLabel="Close audit record" onPress={onClose} style={styles.close}><Ionicons color={colors.primary} name="close" size={22}/></Pressable></View>
    <Detail label="Action" value={readable(item?.action)} /><Detail label="Description" value={item?.description || "No description recorded."}/><Detail label="Actor" value={item?.actor_name || "System"}/><Detail label="Actor email" value={item?.actor_email || "Not recorded"}/><Detail label="Entity" value={readable(item?.entity_type)}/><Detail label="Entity ID" value={item?.entity_id || "Not recorded"}/><Detail label="Date and time" value={item?.created_at ? new Date(item.created_at).toLocaleString() : "Time unavailable"}/>
    <View style={styles.immutable}><Ionicons color={colors.emeraldMid} name="lock-closed" size={15}/><AppText style={styles.immutableText}>This system record cannot be edited or deleted.</AppText></View>
  </View></View></Modal>;
}
function Detail({ label, value }) { return <View style={styles.detail}><AppText style={styles.detailLabel}>{label}</AppText><AppText selectable style={styles.detailValue}>{value || "Not recorded"}</AppText></View>; }
const styles=StyleSheet.create({
  center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:colors.background},loading:{marginTop:space.md,color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold},content:{paddingTop:space.lg,paddingBottom:space.xl},headingRow:{flexDirection:"row",alignItems:"flex-start"},headingBody:{flex:1},subtitle:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.sm},readOnly:{flexDirection:"row",alignItems:"center",gap:4,marginLeft:space.sm,paddingHorizontal:8,paddingVertical:6,borderRadius:radius.lg,backgroundColor:colors.goldPale},readOnlyText:{color:colors.secondary,fontFamily:fonts.bodyBold,fontSize:8},
  stats:{flexDirection:"row",gap:space.sm,marginTop:space.lg},stat:{flex:1,alignItems:"center",padding:space.md,borderRadius:radius.xl,backgroundColor:colors.surface},statValue:{color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},statLabel:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:9,textTransform:"uppercase"},rangeRail:{flexGrow:0,marginTop:space.md},ranges:{gap:space.xs,paddingRight:space.lg},
  search:{minHeight:50,flexDirection:"row",alignItems:"center",marginTop:space.md,paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:radius.xl,backgroundColor:colors.surface},input:{flex:1,marginLeft:space.sm,color:colors.onSurface,fontFamily:fonts.body},filterFrame:{height:54,minHeight:54,maxHeight:54,marginTop:space.xs,overflow:"hidden"},filterRail:{height:54,minHeight:54,maxHeight:54,flexGrow:0,flexShrink:0},filters:{height:54,minHeight:54,maxHeight:54,alignItems:"center",paddingRight:space.lg},chip:{height:38,minHeight:38,maxHeight:38,alignSelf:"center",flexGrow:0,flexShrink:0,alignItems:"center",justifyContent:"center",marginRight:space.xs,paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:19,backgroundColor:colors.surface},activeChip:{backgroundColor:colors.primary},chipText:{color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold,fontSize:10,lineHeight:14},activeChipText:{color:colors.white},
  error:{marginTop:space.md},errorText:{color:colors.error},list:{gap:space.sm,marginTop:space.md},card:{minHeight:92,flexDirection:"row",alignItems:"center",padding:space.md,borderRadius:radius.xl,backgroundColor:colors.surface,...shadows.subtle},icon:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.goldPale},body:{flex:1,marginHorizontal:space.md},title:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},description:{marginTop:2,color:colors.onSurfaceVariant,fontSize:fontSize.xs},meta:{marginTop:5,color:colors.outline,fontSize:9},empty:{alignItems:"center",padding:space.xl,borderRadius:radius.xl,backgroundColor:colors.surfaceLow},
  modalBackdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,39,30,0.35)"},sheet:{maxHeight:"88%",padding:space.lg,paddingBottom:space["2xl"],borderTopLeftRadius:radius.xl,borderTopRightRadius:radius.xl,backgroundColor:colors.background},sheetHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:space.md},sheetTitle:{flexDirection:"row",alignItems:"center",gap:space.sm},detailTitle:{color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},close:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.surfaceHigh},detail:{paddingVertical:space.sm,borderBottomWidth:1,borderBottomColor:colors.borderGreen},detailLabel:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:9,textTransform:"uppercase"},detailValue:{marginTop:3,color:colors.onSurface,fontSize:fontSize.xs},immutable:{flexDirection:"row",alignItems:"center",gap:space.sm,marginTop:space.lg,padding:space.md,borderRadius:radius.lg,backgroundColor:"#DDF4EA"},immutableText:{flex:1,color:colors.emeraldMid,fontFamily:fonts.bodySemibold,fontSize:10},
});
