import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../../src/api";
import { AppText, Screen, SurfaceCard } from "../../../src/components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../../src/theme";

function readable(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }

export default function AuditHistory() {
  const [data, setData] = useState({ items: [], summary: {}, actions: [] });
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true); setError("");
    try { setData(await api.admin.auditLogs({ action: action || undefined })); }
    catch (nextError) { setError(nextError?.message || "Unable to load audit history."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [action]);
  useEffect(() => { load(); }, [load]);
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? (data.items || []).filter((item) => [item.action, item.description, item.entity_type, item.actor_name].some((value) => String(value || "").toLowerCase().includes(term))) : data.items || [];
  }, [data.items, search]);
  if (loading) return <View style={styles.center}><Ionicons color={colors.gold} name="shield-checkmark-outline" size={34} /><AppText style={styles.loading}>Reviewing system history...</AppText></View>;
  return <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}>
    <AppText variant="display">Audit History</AppText><AppText style={styles.subtitle}>A traceable record of administrative system changes.</AppText>
    <View style={styles.stats}><Stat label="Loaded" value={data.summary?.total} /><Stat label="Last 7 Days" value={data.summary?.recent} /></View>
    <View style={styles.search}><Ionicons color={colors.outline} name="search-outline" size={20} /><TextInput onChangeText={setSearch} placeholder="Search action, actor, or entity..." placeholderTextColor={colors.outline} style={styles.input} value={search} /></View>
    <View style={styles.filterFrame}>
      <ScrollView
        alwaysBounceVertical={false}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRail}
        contentContainerStyle={styles.filters}
      >
        <Chip active={!action} label="All" onPress={() => setAction("")} />
        {(data.actions || []).slice(0, 10).map((item) => (
          <Chip
            active={action === item}
            key={item}
            label={readable(item)}
            onPress={() => setAction(item)}
          />
        ))}
      </ScrollView>
    </View>
    {error ? <SurfaceCard style={styles.error}><AppText style={styles.errorText}>{error}</AppText></SurfaceCard> : null}
    <View style={styles.list}>{items.length ? items.map((item) => <View key={item.id} style={styles.card}><View style={styles.icon}><Ionicons color={colors.secondary} name="shield-outline" size={19} /></View><View style={styles.body}><AppText style={styles.title}>{readable(item.action)}</AppText><AppText numberOfLines={2} style={styles.description}>{item.description || `${readable(item.entity_type)} updated`}</AppText><AppText style={styles.meta}>{item.actor_name || "System"} · {item.created_at ? new Date(item.created_at).toLocaleString() : "Time unavailable"}</AppText></View></View>) : <View style={styles.empty}><AppText style={styles.description}>No audit records match these filters.</AppText></View>}</View>
  </Screen>;
}
function Stat({ label, value }) { return <View style={styles.stat}><AppText style={styles.statValue}>{String(value || 0)}</AppText><AppText style={styles.statLabel}>{label}</AppText></View>; }
function Chip({ active, label, onPress }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.activeChip]}><AppText style={[styles.chipText, active && styles.activeChipText]}>{label}</AppText></Pressable>; }
const styles = StyleSheet.create({
  center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:colors.background},loading:{marginTop:space.md,color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold},content:{paddingTop:space.lg,paddingBottom:space.xl},subtitle:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.sm},
  stats:{flexDirection:"row",gap:space.sm,marginTop:space.lg},stat:{flex:1,alignItems:"center",padding:space.md,borderRadius:radius.xl,backgroundColor:colors.surface},statValue:{color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},statLabel:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:9,textTransform:"uppercase"},
  search:{minHeight:50,flexDirection:"row",alignItems:"center",marginTop:space.md,paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:radius.xl,backgroundColor:colors.surface},input:{flex:1,marginLeft:space.sm,color:colors.onSurface,fontFamily:fonts.body},
  filterFrame:{height:54,minHeight:54,maxHeight:54,marginTop:space.md,overflow:"hidden"},
  filterRail:{height:54,minHeight:54,maxHeight:54,flexGrow:0,flexShrink:0},
  filters:{height:54,minHeight:54,maxHeight:54,alignItems:"center",paddingRight:space.lg},
  chip:{height:38,minHeight:38,maxHeight:38,alignSelf:"center",flexGrow:0,flexShrink:0,alignItems:"center",justifyContent:"center",marginRight:space.xs,paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:19,backgroundColor:colors.surface},
  activeChip:{height:38,minHeight:38,maxHeight:38,backgroundColor:colors.primary},
  chipText:{flexGrow:0,flexShrink:0,color:colors.onSurfaceVariant,fontFamily:fonts.bodySemibold,fontSize:10,lineHeight:14},
  activeChipText:{color:colors.white},
  error:{marginTop:space.md},errorText:{color:colors.error},list:{gap:space.sm,marginTop:space.lg},card:{minHeight:92,flexDirection:"row",alignItems:"flex-start",padding:space.md,borderRadius:radius.xl,backgroundColor:colors.surface,...shadows.subtle},icon:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.goldPale},body:{flex:1,marginLeft:space.md},title:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},description:{marginTop:2,color:colors.onSurfaceVariant,fontSize:fontSize.xs},meta:{marginTop:5,color:colors.outline,fontSize:9},empty:{alignItems:"center",padding:space.xl,borderRadius:radius.xl,backgroundColor:colors.surfaceLow},
});
