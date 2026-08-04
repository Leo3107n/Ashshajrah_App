/**
 * Teacher Notifications and Announcements.
 *
 * Notifications are scoped by the backend to the signed-in user and may only
 * be marked read. Active school headlines are shown as read-only announcements;
 * no publishing or administrative communication controls are exposed here.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../components/ui";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const dateTime = (value) => value ? new Date(value).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const readable = (value) => String(value || "system").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function notificationIcon(type) {
  const value = String(type || "").toLowerCase();
  if (value.includes("lecture")) return "videocam-outline";
  if (value.includes("payment") || value.includes("fee")) return "wallet-outline";
  if (value.includes("homework")) return "book-outline";
  if (value.includes("schedule")) return "calendar-outline";
  return "notifications-outline";
}

export default function TeacherNotifications({ audience = "teacher" }) {
  const [tab, setTab] = useState("notifications");
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [headlines, setHeadlines] = useState([]);
  const [summary, setSummary] = useState({ total: 0, unread: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [notificationData, headlineData] = await Promise.all([
        api.shared.notifications.list({ limit: 100 }),
        api.shared.activeHeadlines(),
      ]);
      setItems(notificationData?.items || []);
      setSummary(notificationData?.summary || { total: 0, unread: 0 });
      setHeadlines(headlineData?.headlines || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(item) {
    if (item.is_read) return;
    // Optimistic state makes a tap feel immediate; a failed request restores
    // authoritative values through the shared reload path.
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_read: true } : entry));
    setSummary((current) => ({ ...current, unread: Math.max(0, current.unread - 1) }));
    try {
      await api.shared.notifications.markRead(item.id);
    } catch (nextError) {
      Alert.alert("Unable to update notification", nextError?.message || "Please try again.");
      await load({ refresh: true });
    }
  }

  function confirmMarkAll() {
    if (!summary.unread) return;
    Alert.alert("Mark all as read?", `${summary.unread} unread notification${summary.unread === 1 ? "" : "s"} will be marked read.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Mark All Read", onPress: markAll },
    ]);
  }

  async function markAll() {
    setSaving(true);
    try {
      await api.shared.notifications.markAllRead();
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
      setSummary((current) => ({ ...current, unread: 0 }));
    } catch (nextError) {
      Alert.alert("Unable to update notifications", nextError?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const visibleItems = filter === "unread" ? items.filter((item) => !item.is_read) : items;
  const isStudent = audience === "student";

  if (loading) return <DashboardSkeleton message="Checking your notifications..."/>;
  return <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold}/>}>
    <View style={styles.heading}><View style={styles.headingCopy}><AppText variant="display">Updates</AppText><AppText style={styles.subtitle}>{isStudent ? "Your learning alerts and current school announcements." : "Your teaching alerts and current school announcements."}</AppText></View>{tab === "notifications" && summary.unread ? <Pressable disabled={saving} onPress={confirmMarkAll} style={styles.markAll}><Ionicons color={colors.primary} name="checkmark-done-outline" size={18}/></Pressable> : null}</View>
    <View style={styles.summary}><Metric label="Notifications" value={summary.total}/><Metric accent label="Unread" value={summary.unread}/><Metric label="Announcements" value={headlines.length}/></View>
    <View style={styles.tabs}><Tab active={tab === "notifications"} count={summary.unread} label="Notifications" onPress={() => setTab("notifications")}/><Tab active={tab === "announcements"} count={headlines.length} label="Announcements" onPress={() => setTab("announcements")}/></View>
    {tab === "notifications" ? <View style={styles.filters}>
      <Filter active={filter === "all"} label="All" onPress={() => setFilter("all")}/>
      <Filter active={filter === "unread"} label="Unread" onPress={() => setFilter("unread")}/>
    </View> : null}
    {error ? <SurfaceCard style={styles.error}><AppText style={styles.errorText}>{error}</AppText><PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton></SurfaceCard> : null}
    <View style={styles.list}>{tab === "notifications"
      ? visibleItems.length ? visibleItems.map((item) => <NotificationCard item={item} key={item.id} onPress={() => markRead(item)}/>) : <Empty icon="notifications-off-outline" title={filter === "unread" ? "You're all caught up" : "No notifications"} text={filter === "unread" ? "You have no unread notifications." : `New ${isStudent ? "learning" : "teaching"} updates will appear here.`}/>
      : headlines.length ? headlines.map((item) => <AnnouncementCard item={item} key={item.id}/>) : <Empty icon="megaphone-outline" title="No active announcements" text="Current school headlines will appear here."/ >}</View>
  </Screen>;
}

function Metric({ accent, label, value }) { return <View style={styles.metric}><AppText style={[styles.metricValue, accent && styles.accentValue]}>{value}</AppText><AppText style={styles.metricLabel}>{label}</AppText></View>; }
function Tab({ active, count, label, onPress }) { return <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}><AppText style={[styles.tabText, active && styles.activeTabText]}>{label}</AppText>{count ? <View style={[styles.badge, active && styles.activeBadge]}><AppText style={[styles.badgeText, active && styles.activeBadgeText]}>{count}</AppText></View> : null}</Pressable>; }
function Filter({ active, label, onPress }) { return <Pressable onPress={onPress} style={[styles.filter, active && styles.activeFilter]}><AppText style={[styles.filterText, active && styles.activeFilterText]}>{label}</AppText></Pressable>; }

function NotificationCard({ item, onPress }) {
  return <Pressable onPress={onPress} style={[styles.card, !item.is_read && styles.unreadCard]}><View style={[styles.icon, !item.is_read && styles.unreadIcon]}><Ionicons color={!item.is_read ? colors.white : colors.secondary} name={notificationIcon(item.type)} size={20}/></View><View style={styles.cardBody}><View style={styles.cardHead}><AppText style={styles.cardTitle}>{item.title}</AppText>{!item.is_read ? <View style={styles.dot}/> : null}</View><AppText style={styles.message}>{item.message}</AppText><View style={styles.meta}><AppText style={styles.type}>{readable(item.type)}</AppText><AppText style={styles.time}>{dateTime(item.created_at)}</AppText></View></View></Pressable>;
}

function AnnouncementCard({ item }) {
  return <SurfaceCard style={styles.announcement}><View style={styles.announcementIcon}><Ionicons color={colors.secondary} name="megaphone-outline" size={21}/></View><View style={styles.cardBody}><AppText style={styles.cardTitle}>School Announcement</AppText><AppText style={styles.announcementText}>{item.headline}</AppText><AppText style={styles.time}>Active {String(item.start_date).slice(0, 10)} to {String(item.end_date).slice(0, 10)}</AppText></View></SurfaceCard>;
}
function Empty({ icon, text, title }) { return <View style={styles.empty}><Ionicons color={colors.outline} name={icon} size={32}/><AppText style={styles.emptyTitle}>{title}</AppText><AppText style={styles.emptyText}>{text}</AppText></View>; }

const styles = StyleSheet.create({
  content:{paddingTop:space.lg,paddingBottom:space.xl},heading:{flexDirection:"row",alignItems:"center"},headingCopy:{flex:1},subtitle:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.sm},markAll:{width:44,height:44,alignItems:"center",justifyContent:"center",borderRadius:22,backgroundColor:colors.goldPale},
  summary:{flexDirection:"row",marginTop:space.lg,paddingVertical:space.md,borderRadius:radius.xl,backgroundColor:colors.primary},metric:{flex:1,alignItems:"center",borderRightWidth:1,borderRightColor:"rgba(255,255,255,.15)"},metricValue:{color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize.xl},accentValue:{color:colors.secondaryContainer},metricLabel:{marginTop:2,color:"#B9EEDB",fontFamily:fonts.bodyBold,fontSize:8,textTransform:"uppercase"},
  tabs:{flexDirection:"row",marginTop:space.lg,padding:4,borderRadius:radius.full,backgroundColor:colors.surfaceLow},tab:{flex:1,minHeight:42,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,borderRadius:radius.full},activeTab:{backgroundColor:colors.surface,...shadows.subtle},tabText:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},activeTabText:{color:colors.primary},badge:{minWidth:20,height:20,alignItems:"center",justifyContent:"center",borderRadius:10,backgroundColor:colors.primary},activeBadge:{backgroundColor:colors.gold},badgeText:{color:colors.white,fontFamily:fonts.bodyBold,fontSize:8},activeBadgeText:{color:colors.primary},
  filters:{flexDirection:"row",gap:space.sm,marginTop:space.md},filter:{width:104,height:38,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.outlineVariant,borderRadius:radius.full,backgroundColor:colors.surface},activeFilter:{borderColor:colors.primary,backgroundColor:colors.primary},filterText:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},activeFilterText:{color:colors.white},
  list:{gap:space.sm,marginTop:space.lg},card:{flexDirection:"row",alignItems:"flex-start",padding:space.md,borderWidth:1,borderColor:"transparent",borderRadius:radius.xl,backgroundColor:colors.surface,...shadows.subtle},unreadCard:{borderColor:colors.emeraldLight,backgroundColor:"#F2FBF7"},icon:{width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:21,backgroundColor:colors.goldPale},unreadIcon:{backgroundColor:colors.primary},cardBody:{flex:1,marginLeft:space.md},cardHead:{flexDirection:"row",alignItems:"center"},cardTitle:{flex:1,color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},dot:{width:8,height:8,marginLeft:space.sm,borderRadius:4,backgroundColor:colors.gold},message:{marginTop:4,color:colors.onSurfaceVariant,fontSize:fontSize.xs,lineHeight:18},meta:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:space.sm},type:{color:colors.emeraldMid,fontFamily:fonts.bodyBold,fontSize:8},time:{color:colors.outline,fontSize:8},
  announcement:{flexDirection:"row",alignItems:"flex-start",borderLeftWidth:4,borderLeftColor:colors.gold},announcementIcon:{width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:21,backgroundColor:colors.goldPale},announcementText:{marginTop:5,color:colors.onSurfaceVariant,fontSize:fontSize.xs,lineHeight:18},
  empty:{alignItems:"center",padding:space.xl,borderRadius:radius.xl,backgroundColor:colors.surfaceLow},emptyTitle:{marginTop:space.sm,color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},emptyText:{marginTop:3,color:colors.outline,fontSize:fontSize.xs,textAlign:"center"},error:{marginTop:space.md,backgroundColor:colors.errorContainer},errorText:{color:colors.error,fontSize:fontSize.xs},retry:{alignSelf:"flex-start",marginTop:space.sm},
});
