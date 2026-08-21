/**
 * Student landing dashboard. It combines the protected Student overview,
 * next class, dashboard metrics, and announcements
 * while keeping every action inside the Student route boundary.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import {
  AppText,
  DashboardSkeleton,
  PillButton,
  Screen,
  StatusChip,
  SurfaceCard,
} from "../../components/ui";
import {
  colors,
  fonts,
  fontSize,
  radius,
  shadows,
  space,
} from "../../theme";

function firstName(user) {
  return String(user?.name || user?.full_name || "Student")
    .trim()
    .split(/\s+/)[0];
}

function time(value) {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function readable(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function overdueFeeMessage(status) {
  if (!status?.overdue) return "";
  const dueLabel = dateLabel(status.due_date);
  return dueLabel
    ? `Fee Deadline was ${dueLabel}. Your student portal is locked until payment is cleared.`
    : "Fee Deadline is missed. Your student portal is locked until payment is cleared.";
}

function pendingFeeMessage(status) {
  if (!status?.deadline_pending || status?.overdue || status?.is_paid) return "";
  const dueLabel = dateLabel(status.due_date);
  return dueLabel
    ? `Fee Deadline is ${dueLabel}. Please submit payment before the due date.`
    : "Fee voucher deadline is pending. Please submit payment before the due date.";
}

function feeStatusLabel(stats, monthlyFee) {
  if (monthlyFee?.available) {
    if (monthlyFee.is_paid) return "Paid / Verified";
    if (monthlyFee.overdue) return "Overdue";
    if (monthlyFee.is_submitted) return "Payment Submitted";
    if (monthlyFee.deadline_pending) return "Deadline Pending";
  }
  return stats?.fee_status_label || "Not Paid";
}

function planTone(value) {
  const status = String(value || "").toLowerCase();
  if (status === "active") return "success";
  if (status === "upcoming") return "warning";
  return "neutral";
}

function pickDashboardPlan(plans) {
  const items = Array.isArray(plans) ? plans : [];
  return (
    items.find((item) => String(item.status).toLowerCase() === "active") ||
    items.find((item) => String(item.status).toLowerCase() === "upcoming") ||
    items[0] ||
    null
  );
}

function isOtherEducationalDocument(item) {
  const type = String(item?.type || item?.document_type || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
  return ["other", "other document", "other documents", "parent guide", "yearly plan"].includes(type);
}

export default function StudentHome() {
  const router = useRouter();
  const { isAuthenticating, logout, user } = useAuth();
  const [data, setData] = useState({
    stats: {},
    classDocuments: [],
    educationalDocuments: [],
    headlines: [],
    lectures: [],
    monthlyPlans: [],
    monthlyPlanSummary: {},
    otherDocuments: [],
    monthlyFee: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const go = useCallback(
    (section) => router.push(`/(app)/student/${section}`),
    [router]
  );

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const [dashboard, calendar, monthlyFee, monthlyPlans] = await Promise.all([
        api.student.dashboard(),
        api.student.calendarLectures({ range: "today" }),
        api.payment.monthlyFeeStatus(),
        api.shared.monthlyPlans({ status: "all" }),
      ]);

      setData({
        stats: dashboard?.stats || {},
        classDocuments: dashboard?.class_documents || [],
        educationalDocuments: dashboard?.educational_documents || [],
        headlines: dashboard?.headlines || [],
        lectures: calendar?.items || [],
        monthlyPlans: monthlyPlans?.items || [],
        monthlyPlanSummary: monthlyPlans?.summary || {},
        monthlyFee,
        otherDocuments: dashboard?.other_documents || [],
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load your dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const nextClass = useMemo(
    () =>
      data.lectures.find((item) =>
        ["live", "upcoming", "scheduled"].includes(
          String(item.display_status || item.status).toLowerCase()
        )
      ) || data.lectures[0],
    [data.lectures]
  );
  const lockMessage = overdueFeeMessage(data.monthlyFee);
  const isPortalLocked = Boolean(lockMessage);
  const feeNoticeMessage = pendingFeeMessage(data.monthlyFee);
  const dashboardPlan = useMemo(() => pickDashboardPlan(data.monthlyPlans), [data.monthlyPlans]);

  const tiles = [
    {
      label: "Overall Attendance",
      value: `${data.stats.attendance_percentage ?? 0}%`,
      icon: "checkmark-circle-outline",
      tone: "green",
      section: "attendance",
    },
    {
      label: "Subjects",
      value: data.stats.total_subjects ?? 0,
      icon: "book-outline",
      tone: "gold",
      section: "classes",
    },
    {
      label: "Homework",
      value: `${data.stats.pending_homeworks ?? 0} Pending`,
      icon: "clipboard-outline",
      tone: "rose",
      section: "homework",
    },
    {
      label: "Fee Status",
      value: feeStatusLabel(data.stats, data.monthlyFee),
      icon: "wallet-outline",
      tone: "mint",
      section: "fees",
    },
  ];

  if (loading) {
    return <DashboardSkeleton message="Growing your dashboard..." />;
  }

  if (error) {
    return (
      <Screen contentContainerStyle={styles.errorScreen}>
        <SurfaceCard>
          <Ionicons
            color={colors.error}
            name="cloud-offline-outline"
            size={32}
          />
          <AppText style={styles.errorTitle} variant="heading">
            We could not load your portal
          </AppText>
          <AppText style={styles.errorBody}>{error}</AppText>
          <PillButton onPress={() => load()} style={styles.retry}>
            Try Again
          </PillButton>
        </SurfaceCard>
      </Screen>
    );
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
      <LinearGradient
        colors={[colors.primaryContainer, "#0D5C48"]}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <AppText style={styles.eyebrow}>WELCOME BACK</AppText>
            <AppText style={styles.greeting} variant="display">
              Salaam, {firstName(user)}!
            </AppText>
            <AppText style={styles.heroBody}>
              Deep roots, endless growth.
            </AppText>
          </View>
        </View>
      </LinearGradient>

      {isPortalLocked ? (
        <SurfaceCard style={styles.lockBanner}>
          <View style={styles.lockIcon}>
            <Ionicons color={colors.error} name="lock-closed-outline" size={24} />
          </View>
          <View style={styles.lockCopy}>
            <AppText style={styles.lockEyebrow}>FEE OVERDUE</AppText>
            <AppText style={styles.lockTitle}>Student portal locked</AppText>
            <AppText style={styles.lockText}>{lockMessage}</AppText>
            <PillButton
              icon={<Ionicons color={colors.white} name="wallet-outline" size={18} />}
              onPress={() => go("fees")}
              style={styles.lockButton}
            >
              View Fees
            </PillButton>
            <PillButton
              icon={<Ionicons color={colors.white} name="log-out-outline" size={18} />}
              loading={isAuthenticating}
              onPress={logout}
              style={styles.lockButton}
            >
              Log Out
            </PillButton>
          </View>
        </SurfaceCard>
      ) : null}

      {!isPortalLocked && feeNoticeMessage ? (
        <SurfaceCard style={styles.feeNoticeBanner}>
          <View style={styles.feeNoticeIcon}>
            <Ionicons color="#2563EB" name="calendar-outline" size={22} />
          </View>
          <View style={styles.lockCopy}>
            <AppText style={styles.feeNoticeEyebrow}>FEE DEADLINE</AppText>
            <AppText style={styles.feeNoticeText}>{feeNoticeMessage}</AppText>
          </View>
        </SurfaceCard>
      ) : null}

      {isPortalLocked ? null : (
        <>

      <SectionHeader title="Monthly Plan" />
      <MonthlyPlanPreview
        item={dashboardPlan}
        onPress={() => go("monthly-plans")}
      />

      <SectionHeader title="Announcements" />
      <View style={styles.stack}>
        {data.headlines.length ? (
          data.headlines.slice(0, 3).map((item, index) => (
            <View key={item.id || index} style={styles.announcement}>
              <View style={styles.announcementIcon}>
                <Ionicons color={colors.white} name="megaphone-outline" size={18} />
              </View>
              <View style={styles.announcementBody}>
                <AppText style={styles.announcementTitle}>
                  {item.headline || item.title || "Announcement"}
                </AppText>
                <AppText numberOfLines={3} style={styles.announcementText}>
                  {item.message ||
                    item.content ||
                    item.description ||
                    (item.end_date ? `Active until ${item.end_date}` : "")}
                </AppText>
              </View>
            </View>
          ))
        ) : (
          <EmptyRow icon="megaphone-outline" text="No active announcements." />
        )}
      </View>

      <EducationalDocuments
        classDocuments={data.classDocuments}
        documents={data.educationalDocuments}
        otherDocuments={data.otherDocuments}
      />

      <Pressable onPress={() => go("lectures")}>
        <SurfaceCard style={styles.nextCard}>
          <View style={styles.nextTop}>
            <View style={styles.nextCopy}>
              <AppText style={styles.nextLabel}>NEXT CLASS</AppText>
              <AppText style={styles.nextTitle} variant="title">
                {nextClass?.subject_name ||
                  nextClass?.title ||
                  "No class scheduled"}
              </AppText>
              <AppText style={styles.teacher}>
                {nextClass ? "Scheduled class" : "Enjoy your open study time"}
              </AppText>
            </View>
            <StatusChip tone="success">
              {nextClass
                ? readable(nextClass.display_status || nextClass.status)
                : "Clear"}
            </StatusChip>
          </View>
          {nextClass ? (
            <View style={styles.metaRow}>
              <Meta
                icon="time-outline"
                text={`Today, ${time(nextClass.scheduled_start)}`}
              />
              <Meta
                icon={
                  nextClass.google_meet_link
                    ? "videocam-outline"
                    : "location-outline"
                }
                text={
                  nextClass.google_meet_link
                    ? "Virtual Class"
                    : nextClass.class_level || "Classroom"
                }
              />
            </View>
          ) : null}
          {nextClass?.google_meet_link ? (
            <PillButton
              icon={
                <Ionicons color={colors.white} name="videocam-outline" size={18} />
              }
              onPress={() => Linking.openURL(nextClass.google_meet_link)}
              style={styles.join}
            >
              Join Class
            </PillButton>
          ) : null}
        </SurfaceCard>
      </Pressable>

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <StatTile key={tile.label} onPress={() => go(tile.section)} {...tile} />
        ))}
      </View>

        </>
      )}
    </Screen>
  );
}

function Meta({ icon, text }) {
  return (
    <View style={styles.meta}>
      <Ionicons color={colors.onSurfaceVariant} name={icon} size={15} />
      <AppText style={styles.metaText}>{text}</AppText>
    </View>
  );
}

function StatTile({ icon, label, onPress, tone, value }) {
  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <View style={[styles.tileIcon, styles[`${tone}Tone`]]}>
        <Ionicons color={colors.primary} name={icon} size={19} />
      </View>
      <AppText style={styles.tileLabel}>{label}</AppText>
      <AppText numberOfLines={2} style={styles.tileValue}>
        {String(value)}
      </AppText>
      <Ionicons
        color={colors.outline}
        name="arrow-forward-outline"
        size={15}
        style={styles.tileArrow}
      />
    </Pressable>
  );
}

function EducationalDocuments({ classDocuments: classBucket, documents, otherDocuments: otherBucket }) {
  const [documentGroup, setDocumentGroup] = useState("class");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const items = Array.isArray(documents) ? documents.filter((item) => item?.url || item?.path) : [];
  const fallbackClassDocuments = items.filter((item) => String(item?.class_level || "").trim());
  const fallbackOtherDocuments = items.filter(isOtherEducationalDocument);
  const classDocuments = (Array.isArray(classBucket) ? classBucket : [])
    .filter((item) => item?.url || item?.path);
  const otherDocuments = (Array.isArray(otherBucket) ? otherBucket : [])
    .filter((item) => item?.url || item?.path);
  const resolvedClassDocuments = classDocuments.length ? classDocuments : fallbackClassDocuments;
  const resolvedOtherDocuments = otherDocuments.length ? otherDocuments : fallbackOtherDocuments;
  const groups = [
    { key: "class", label: "Class Documents", items: resolvedClassDocuments },
    { key: "other", label: "Other Documents", items: resolvedOtherDocuments },
  ];
  const activeGroup = groups.find((group) => group.key === documentGroup);
  const visibleItems = activeGroup?.items || [];

  return (
    <SurfaceCard style={styles.documents}>
      <View style={styles.documentsHeader}>
        <View style={styles.documentsTitleWrap}>
          <Ionicons color={colors.secondary} name="document-text-outline" size={17} />
          <AppText style={styles.documentsTitle}>Educational Documents</AppText>
        </View>
        <AppText style={styles.documentsCount}>{items.length}</AppText>
      </View>

      <Pressable onPress={() => setSelectorOpen(true)} style={styles.documentsDropdown}>
        <View style={styles.documentsDropdownCopy}>
          <AppText style={styles.documentsDropdownLabel}>DOCUMENT GROUP</AppText>
          <AppText style={[styles.documentsDropdownValue, !activeGroup && styles.documentsDropdownPlaceholder]}>
            {activeGroup?.label || "Select document type"}
          </AppText>
        </View>
        <Ionicons color={colors.outline} name="chevron-down" size={18} />
      </Pressable>

      {visibleItems.length ? (
        <View style={styles.documentList}>
          {visibleItems.map((item) => (
            <Pressable
              disabled={!item.url}
              key={item.key || item.label || item.path}
              onPress={() => item.url && Linking.openURL(item.url)}
              style={styles.documentRow}
            >
              <View style={styles.documentIcon}>
                <Ionicons color={colors.secondary} name="document-attach-outline" size={16} />
              </View>
              <View style={styles.documentCopy}>
                <AppText numberOfLines={1} style={styles.documentLabel}>
                  {item.label || "Educational Document"}
                </AppText>
                {item.type ? (
                  <AppText numberOfLines={1} style={styles.documentType}>
                    {readable(item.type)}
                  </AppText>
                ) : null}
              </View>
              <Ionicons color={colors.gold} name="download-outline" size={15} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.noDocuments}>
          <Ionicons color={colors.outline} name="folder-open-outline" size={17} />
          <AppText style={styles.noDocumentsText}>No {(activeGroup?.label || "documents").toLowerCase()} available yet.</AppText>
        </View>
      )}

      <Modal animationType="slide" onRequestClose={() => setSelectorOpen(false)} transparent visible={selectorOpen}>
        <View style={styles.documentsModalBackdrop}>
          <View style={styles.documentsSheet}>
            <View style={styles.documentsSheetHandle} />
            <View style={styles.documentsSheetHeader}>
              <AppText style={styles.documentsSheetTitle}>Educational Documents</AppText>
              <Pressable accessibilityLabel="Close document selector" onPress={() => setSelectorOpen(false)} style={styles.documentsCloseButton}>
                <Ionicons color={colors.onSurfaceVariant} name="close" size={22} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.documentsOptions} showsVerticalScrollIndicator={false}>
              {groups.map((group) => {
                const active = group.key === activeGroup?.key;
                return (
                  <Pressable
                    key={group.key}
                    onPress={() => {
                      setDocumentGroup(group.key);
                      setSelectorOpen(false);
                    }}
                    style={[styles.documentsOption, active && styles.documentsOptionActive]}
                  >
                    <View style={styles.documentsOptionCopy}>
                      <AppText style={[styles.documentsOptionTitle, active && styles.documentsOptionTitleActive]}>
                        {group.label}
                      </AppText>
                      <AppText style={[styles.documentsOptionMeta, active && styles.documentsOptionMetaActive]}>
                        {group.items.length} document{group.items.length === 1 ? "" : "s"}
                      </AppText>
                    </View>
                    <Ionicons
                      color={active ? colors.white : colors.outline}
                      name={active ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SurfaceCard>
  );
}

function MonthlyPlanPreview({ item, onPress }) {
  const mediaCount = Array.isArray(item?.media)
    ? item.media.length
    : Array.isArray(item?.image_urls)
      ? item.image_urls.length
      : 0;

  if (!item) {
    return (
      <SurfaceCard style={styles.planPreview}>
        <View style={styles.planPreviewTop}>
          <View style={styles.planIcon}>
            <Ionicons color={colors.secondary} name="calendar-number-outline" size={22} />
          </View>
          <View style={styles.planCopy}>
            <AppText style={styles.planTitle}>No monthly plan yet</AppText>
            <AppText style={styles.planDate}>
              Plans uploaded by the academy will appear here.
            </AppText>
          </View>
        </View>
      </SurfaceCard>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <SurfaceCard style={styles.planPreview}>
        <View style={styles.planPreviewTop}>
          <View style={styles.planIcon}>
            <Ionicons color={colors.secondary} name="calendar-number-outline" size={22} />
          </View>
          <View style={styles.planCopy}>
            <AppText style={styles.planEyebrow}>STUDY MONTHLY PLAN</AppText>
            <AppText style={styles.planTitle}>{item.name || "Monthly Plan"}</AppText>
            <AppText style={styles.planDate}>
              {dateLabel(item.start_date) || "Not set"} to {dateLabel(item.end_date) || "Not set"}
            </AppText>
          </View>
          <StatusChip tone={planTone(item.status)}>{readable(item.status)}</StatusChip>
        </View>
        <View style={styles.planMetaRow}>
          <View style={styles.planMeta}>
            <Ionicons color={colors.primary} name="attach-outline" size={16} />
            <AppText style={styles.planMetaText}>{mediaCount} resources</AppText>
          </View>
        </View>
        <View style={styles.planFooter}>
          <AppText style={styles.planFooterText}>Tap to view images, videos, and all plans in the app</AppText>
          <Ionicons color={colors.secondary} name="arrow-forward-outline" size={17} />
        </View>
      </SurfaceCard>
    </Pressable>
  );
}

function SectionHeader({ badge, onPress, title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <AppText style={styles.sectionTitle}>{title}</AppText>
        {Number(badge || 0) > 0 ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>{badge}</AppText>
          </View>
        ) : null}
      </View>
      {onPress ? (
        <Pressable accessibilityLabel={`View all ${title}`} onPress={onPress}>
          <AppText style={styles.viewAll}>View All -&gt;</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyRow({ icon, text }) {
  return (
    <View style={styles.empty}>
      <Ionicons color={colors.outline} name={icon} size={21} />
      <AppText style={styles.emptyText}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.md, paddingBottom: space.xl },
  hero: { padding: space.xl, borderRadius: radius["2xl"], ...shadows.hero },
  heroTop: { flexDirection: "row", alignItems: "flex-start" },
  heroCopy: { flex: 1 },
  eyebrow: {
    color: "#B9EEDB",
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  greeting: {
    marginTop: space.xs,
    color: colors.white,
    fontSize: 27,
    lineHeight: 34,
  },
  heroBody: { marginTop: space.xs, color: "#D6E9E2", fontSize: fontSize.sm },
  lockBanner: {
    flexDirection: "row",
    marginTop: space.md,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorContainer,
  },
  lockIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  lockCopy: { flex: 1, marginLeft: space.md },
  lockEyebrow: {
    color: colors.error,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  lockTitle: {
    marginTop: 2,
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
  },
  lockText: {
    marginTop: space.xs,
    color: colors.error,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  lockButton: { marginTop: space.md },
  feeNoticeBanner: {
    flexDirection: "row",
    marginTop: space.md,
    borderWidth: 1,
    borderColor: "#2563EB",
    backgroundColor: "#DBEAFE",
  },
  feeNoticeIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  feeNoticeEyebrow: {
    color: "#1D4ED8",
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  feeNoticeText: {
    marginTop: space.xs,
    color: "#1E3A8A",
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  nextCard: {
    marginTop: space.md,
    marginHorizontal: space.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  nextTop: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  nextCopy: { flex: 1 },
  nextLabel: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  nextTitle: { marginTop: space.xs, fontSize: fontSize.base },
  teacher: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.md },
  meta: { flexDirection: "row", alignItems: "center" },
  metaText: { marginLeft: space.xs, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  join: { marginTop: space.md },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xl },
  tile: {
    width: "48.5%",
    minHeight: 120,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceLow,
  },
  tileIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  greenTone: { backgroundColor: "#D1FAE5" },
  goldTone: { backgroundColor: colors.goldPale },
  roseTone: { backgroundColor: colors.roseBg },
  mintTone: { backgroundColor: "#DDF4EA" },
  tileLabel: {
    marginTop: space.sm,
    color: colors.onSurfaceVariant,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: "uppercase",
  },
  tileValue: { paddingRight: 16, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  tileArrow: { position: "absolute", right: space.md, bottom: space.md },
  planPreview: { gap: space.md },
  planPreviewTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  planIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: colors.goldPale },
  planCopy: { flex: 1 },
  planEyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  planTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.base },
  planDate: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  planMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  planMeta: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.surfaceLow },
  planMetaText: { marginLeft: space.xs, color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  planFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.borderGreen },
  planFooterText: { flex: 1, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center" },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  badge: {
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: space.sm,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.secondaryContainer,
  },
  badgeText: { color: colors.onSecondaryContainer, fontFamily: fonts.bodyBold, fontSize: 9 },
  viewAll: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  list: { gap: space.sm },
  stack: { gap: space.sm },
  announcement: {
    flexDirection: "row",
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    backgroundColor: colors.goldPale,
  },
  announcementIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.gold,
  },
  announcementBody: { flex: 1, marginLeft: space.sm },
  announcementTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  announcementText: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  documents: { marginTop: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.borderGreen },
  documentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  documentsTitleWrap: { flexDirection: "row", alignItems: "center", gap: space.xs },
  documentsTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  documentsCount: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  documentsDropdown: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.md, paddingVertical: space.xs, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.full, backgroundColor: colors.goldPale },
  documentsDropdownCopy: { flex: 1, marginRight: space.sm },
  documentsDropdownLabel: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 1 },
  documentsDropdownValue: { marginTop: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  documentsDropdownPlaceholder: { color: colors.outline },
  documentList: { gap: space.xs },
  documentRow: { minHeight: 50, flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.md, backgroundColor: colors.surface },
  documentIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginRight: space.sm, borderRadius: 14, backgroundColor: colors.goldPale },
  documentCopy: { flex: 1 },
  documentLabel: { color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  documentType: { marginTop: 2, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  noDocuments: { flexDirection: "row", alignItems: "center", paddingVertical: space.xs },
  noDocumentsText: { flex: 1, marginLeft: space.xs, color: colors.outline, fontSize: 10 },
  documentsModalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  documentsSheet: { maxHeight: "72%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  documentsSheetHandle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  documentsSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  documentsSheetTitle: { flex: 1, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  documentsCloseButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surfaceLow },
  documentsOptions: { padding: space.lg, gap: space.sm, paddingBottom: space["3xl"] },
  documentsOption: { flexDirection: "row", alignItems: "center", padding: space.md, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.xl, backgroundColor: colors.surface },
  documentsOptionActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  documentsOptionCopy: { flex: 1, marginRight: space.sm },
  documentsOptionTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  documentsOptionTitleActive: { color: colors.white },
  documentsOptionMeta: { marginTop: 2, color: colors.outline, fontSize: 10 },
  documentsOptionMetaActive: { color: "#D6E9E2" },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLow,
  },
  emptyText: { marginLeft: space.sm, color: colors.outline, fontSize: fontSize.xs },
  errorScreen: { justifyContent: "center" },
  errorTitle: { marginTop: space.md },
  errorBody: { marginTop: space.sm, color: colors.onSurfaceVariant },
  retry: { marginTop: space.lg },
});
