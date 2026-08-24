/**
 * Shared Student/Parent monthly study-plan viewer. Plans are read-only and
 * loaded from the protected backend route, which signs Supabase media URLs
 * before they reach the mobile app.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { WebView } from "react-native-webview";
import api from "../../api";
import {
  AppText,
  DashboardSkeleton,
  PillButton,
  Screen,
  StatusChip,
  SurfaceCard,
} from "../../components/ui";
import { colors, fonts, fontSize, radius, space } from "../../theme";

const FILTERS = [
  ["all", "All"],
  ["active", "Active"],
  ["upcoming", "Upcoming"],
  ["expired", "Expired"],
];

function readable(value) {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function statusTone(value) {
  const status = String(value || "").toLowerCase();
  if (status === "active") return "success";
  if (status === "upcoming") return "warning";
  if (status === "expired") return "neutral";
  return "neutral";
}

export default function MonthlyPlans({ audience = "student" }) {
  const [filter, setFilter] = useState("all");
  const [data, setData] = useState({ items: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.shared.monthlyPlans({ status: filter });
      setData({
        items: response?.items || [],
        summary: response?.summary || {},
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load monthly plans.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const title = audience === "parent" ? "Children's Monthly Plans" : "Study Monthly Plan";
  const subtitle =
    audience === "parent"
      ? "Review the study plan resources shared for your children's learning cycle."
      : "View the current and upcoming study resources shared by the academy.";

  const summary = useMemo(() => [
    ["Total", data.summary.total || 0, "albums-outline"],
    ["Active", data.summary.active || 0, "sparkles-outline"],
    ["Upcoming", data.summary.upcoming || 0, "calendar-outline"],
  ], [data.summary]);

  if (loading) {
    return <DashboardSkeleton message="Loading monthly plans..." />;
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[colors.gold]}
          onRefresh={() => load({ refresh: true })}
          refreshing={refreshing}
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.heading}>
        <AppText style={styles.eyebrow}>STUDY RESOURCES</AppText>
        <AppText variant="display">{title}</AppText>
        <AppText style={styles.subtitle}>{subtitle}</AppText>
      </View>

      <View style={styles.summary}>
        {summary.map(([label, value, icon]) => (
          <SurfaceCard key={label} style={styles.summaryCard}>
            <Ionicons color={colors.secondary} name={icon} size={20} />
            <AppText style={styles.summaryValue}>{value}</AppText>
            <AppText style={styles.summaryLabel}>{label}</AppText>
          </SurfaceCard>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.filters}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {FILTERS.map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setFilter(value)}
            style={[styles.filter, filter === value && styles.filterActive]}
          >
            <AppText style={[styles.filterText, filter === value && styles.filterTextActive]}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      {error ? (
        <SurfaceCard style={styles.state}>
          <Ionicons color={colors.error} name="alert-circle-outline" size={24} />
          <AppText style={styles.stateTitle}>Monthly plans unavailable</AppText>
          <AppText style={styles.stateText}>{error}</AppText>
          <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
        </SurfaceCard>
      ) : data.items.length ? (
        <View style={styles.list}>
          {data.items.map((item) => (
            <PlanCard item={item} key={item.id} />
          ))}
        </View>
      ) : (
        <SurfaceCard style={styles.state}>
          <Ionicons color={colors.secondary} name="leaf-outline" size={30} />
          <AppText style={styles.stateTitle}>No monthly plans found</AppText>
          <AppText style={styles.stateText}>
            Plans uploaded by the academy will appear here.
          </AppText>
        </SurfaceCard>
      )}
    </Screen>
  );
}

function PlanCard({ item }) {
  const media = Array.isArray(item.media) ? item.media : [];
  const [viewerIndex, setViewerIndex] = useState(null);
  return (
    <SurfaceCard style={styles.plan}>
      <View style={styles.planTop}>
        <View style={styles.planIcon}>
          <Ionicons color={colors.secondary} name="calendar-number-outline" size={22} />
        </View>
        <View style={styles.planCopy}>
          <AppText style={styles.planTitle}>{item.name || "Monthly Plan"}</AppText>
          <AppText style={styles.planDate}>
            {dateLabel(item.start_date)} to {dateLabel(item.end_date)}
          </AppText>
        </View>
        <StatusChip tone={statusTone(item.status)}>{readable(item.status)}</StatusChip>
      </View>

      <View style={styles.mediaHeader}>
        <AppText style={styles.mediaTitle}>Attached resources</AppText>
        <AppText style={styles.mediaCount}>{media.length}</AppText>
      </View>

      {media.length ? (
        <View style={styles.mediaGrid}>
          {media.map((asset, index) => (
            <Pressable
              key={`${asset.path || asset.url || index}`}
              onPress={() => setViewerIndex(index)}
              style={styles.mediaItem}
            >
              <Ionicons
                color={colors.primary}
                name={asset.type === "video" ? "videocam-outline" : "image-outline"}
                size={20}
              />
              <AppText numberOfLines={2} style={styles.mediaText}>
                {asset.type === "video" ? "Open video" : "Open image"} {index + 1}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : (
        <AppText style={styles.noMedia}>No files attached to this plan.</AppText>
      )}
      <MediaSlideshow
        initialIndex={viewerIndex || 0}
        media={media}
        onClose={() => setViewerIndex(null)}
        visible={viewerIndex !== null}
      />
    </SurfaceCard>
  );
}

function MediaSlideshow({ initialIndex = 0, media, onClose, visible }) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) setActiveIndex(initialIndex);
  }, [initialIndex, visible]);

  if (!visible) return null;

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={styles.viewer}>
        <View style={styles.viewerHeader}>
          <View style={styles.viewerTitleWrap}>
            <AppText style={styles.viewerEyebrow}>MONTHLY PLAN</AppText>
            <AppText style={styles.viewerTitle}>
              Resource {activeIndex + 1} of {media.length}
            </AppText>
          </View>
          <Pressable accessibilityLabel="Close monthly plan slideshow" onPress={onClose} style={styles.viewerClose}>
            <Ionicons color={colors.primary} name="close" size={24} />
          </Pressable>
        </View>

        <ScrollView
          contentOffset={{ x: width * initialIndex, y: 0 }}
          horizontal
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
            setActiveIndex(nextIndex);
          }}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.viewerScroller}
        >
          {media.map((asset, index) => (
            <View key={`${asset.path || asset.url || index}`} style={[styles.viewerSlide, { width }]}>
              <MediaSlide asset={asset} />
            </View>
          ))}
        </ScrollView>

        <View style={styles.viewerDots}>
          {media.map((asset, index) => (
            <View
              key={`${asset.path || asset.url || index}-dot`}
              style={[styles.viewerDot, activeIndex === index && styles.viewerDotActive]}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

function MediaSlide({ asset }) {
  if (asset?.type === "video") {
    return <VideoSlide asset={asset} />;
  }

  return (
    <View style={styles.imageSlide}>
      {asset?.url ? (
        <Image resizeMode="contain" source={{ uri: asset.url }} style={styles.planImage} />
      ) : (
        <UnavailableMedia label="Image unavailable" />
      )}
    </View>
  );
}

function VideoSlide({ asset }) {
  if (!asset?.url) return <UnavailableMedia label="Video unavailable" />;

  const escapedUrl = String(asset.url).replace(/"/g, "&quot;");
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            background: #003B2D;
            overflow: hidden;
          }
          video {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #003B2D;
          }
        </style>
      </head>
      <body>
        <video controls playsinline preload="metadata" src="${escapedUrl}"></video>
      </body>
    </html>
  `;

  return (
    <View style={styles.videoSlide}>
      <WebView
        allowsFullscreenVideo
        javaScriptEnabled
        mediaPlaybackRequiresUserAction
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.planVideo}
      />
      <AppText style={styles.videoHint}>Use the controls to play, pause, or open fullscreen.</AppText>
    </View>
  );
}

function UnavailableMedia({ label }) {
  return (
    <View style={styles.unavailableMedia}>
      <Ionicons color={colors.outline} name="cloud-offline-outline" size={34} />
      <AppText style={styles.unavailableText}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.md, paddingBottom: space.xl },
  heading: { marginBottom: space.lg },
  eyebrow: {
    color: colors.secondary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  subtitle: {
    marginTop: space.sm,
    color: colors.onSurfaceVariant,
    fontSize: fontSize.sm,
    lineHeight: 21,
  },
  summary: { flexDirection: "row", gap: space.sm },
  summaryCard: { flex: 1, alignItems: "center", padding: space.md },
  summaryValue: {
    marginTop: space.xs,
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
  },
  summaryLabel: {
    color: colors.outline,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: "uppercase",
  },
  filters: { gap: space.sm, paddingVertical: space.lg },
  filter: {
    minWidth: 106,
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.borderGreen,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  filterActive: {
    borderColor: colors.primaryContainer,
    backgroundColor: colors.primaryContainer,
  },
  filterText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  filterTextActive: { color: colors.white },
  list: { gap: space.md },
  plan: { gap: space.md },
  planTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  planIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: colors.goldPale,
  },
  planCopy: { flex: 1 },
  planTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.base },
  planDate: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  mediaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderGreen,
  },
  mediaTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  mediaCount: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  mediaItem: {
    width: "48%",
    minHeight: 72,
    justifyContent: "center",
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.borderGreen,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLow,
  },
  mediaText: {
    marginTop: space.xs,
    color: colors.primary,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
  },
  viewer: { flex: 1, backgroundColor: colors.background },
  viewerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.lg, paddingTop: space["3xl"], borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  viewerTitleWrap: { flex: 1, marginRight: space.md },
  viewerEyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.2 },
  viewerTitle: { marginTop: 2, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  viewerClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.surfaceLow },
  viewerScroller: { flex: 1 },
  viewerSlide: { flex: 1, padding: space.md },
  imageSlide: { flex: 1, alignItems: "center", justifyContent: "center" },
  videoSlide: { flex: 1, justifyContent: "center" },
  planImage: { width: "100%", height: "100%", borderRadius: radius.xl },
  planVideo: { width: "100%", aspectRatio: 9 / 16, maxHeight: "82%", borderRadius: radius.xl, backgroundColor: colors.primary },
  videoHint: { marginTop: space.sm, color: colors.onSurfaceVariant, fontSize: fontSize.xs, textAlign: "center" },
  unavailableMedia: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  unavailableText: { marginTop: space.sm, color: colors.outline, fontFamily: fonts.bodyBold },
  viewerDots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, padding: space.lg },
  viewerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.outlineVariant },
  viewerDotActive: { width: 22, backgroundColor: colors.primaryContainer },
  noMedia: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  state: { alignItems: "center", paddingVertical: space.xl },
  stateTitle: {
    marginTop: space.md,
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.base,
    textAlign: "center",
  },
  stateText: {
    marginTop: space.xs,
    color: colors.onSurfaceVariant,
    fontSize: fontSize.xs,
    textAlign: "center",
  },
  retry: { marginTop: space.lg },
});
