/**
 * Parent home dashboard. Shows an overview of each child's academic status —
 * upcoming classes, homework, attendance, and fee standing — sourced entirely
 * from the Parent-scoped API so no student or teacher data leaks across roles.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import api from "../../api";
import {
  AppText,
  DashboardSkeleton,
  PillButton,
  Screen,
  StatusChip,
  SurfaceCard,
} from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import ChildDropdown from "./components/ChildDropdown";
import useParentChildSelection from "./useParentChildSelection";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function firstName(user) {
  return String(user?.name || user?.full_name || "Parent").trim().split(/\s+/)[0];
}

function time(value) {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function readable(value) {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function feeTone(status) {
  const value = String(status || "").toLowerCase();
  if (["verified", "approved", "paid"].includes(value)) return "success";
  if (["submitted", "pending"].includes(value)) return "warning";
  if (["rejected", "overdue"].includes(value)) return "danger";
  return "neutral";
}

function attendanceTone(value) {
  const pct = Number(value || 0);
  if (pct >= 80) return "success";
  if (pct >= 60) return "warning";
  return "danger";
}

function childDisplayName(child) {
  return String(child?.full_name || child?.name || "Child").trim();
}

function childLectures(child) {
  return Array.isArray(child?.today_lectures) ? child.today_lectures : [];
}

function uniqueChildren(children) {
  const seen = new Set();
  const result = [];
  for (const child of Array.isArray(children) ? children : []) {
    const key = child?.id || childDisplayName(child);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(child);
  }
  return result;
}

function isOtherEducationalDocument(item) {
  const type = String(item?.type || item?.document_type || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
  return ["other", "other document", "other documents", "parent guide", "yearly plan"].includes(type);
}

function feeDeadlineBanner(children) {
  const target = (Array.isArray(children) ? children : [])
    .filter((child) => {
      const status = String(child?.fee_status || "").toLowerCase();
      return child?.fee_due_date && !["verified", "approved", "paid", "submitted"].includes(status);
    })
    .sort((left, right) => {
      const leftOverdue = left?.fee_deadline_missed ? 0 : 1;
      const rightOverdue = right?.fee_deadline_missed ? 0 : 1;
      if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;
      const leftTime = left?.fee_due_date ? new Date(left.fee_due_date).getTime() : 0;
      const rightTime = right?.fee_due_date ? new Date(right.fee_due_date).getTime() : 0;
      return rightTime - leftTime;
    })[0];

  if (!target) return null;

  const parsed = target.fee_due_date ? new Date(target.fee_due_date) : null;
  const dueLabel = parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })
    : "";

  if (target.fee_deadline_missed) {
    return {
      tone: "overdue",
      message: dueLabel
      ? `Fee Deadline was ${dueLabel} for ${childDisplayName(target)}.`
      : `Fee Deadline is missed for ${childDisplayName(target)}.`,
    };
  }

  return {
    tone: "upcoming",
    message: dueLabel
    ? `Fee Deadline is ${dueLabel} for ${childDisplayName(target)}.`
    : `Fee voucher deadline is pending for ${childDisplayName(target)}.`,
  };
}

function dateLabel(value) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
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

export default function ParentHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState({
    children: [],
    headlines: [],
    monthlyPlans: [],
    monthlyPlanSummary: {},
    notifications: [],
    notificationSummary: {},
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedChildId, setParentSelectedChildId] = useParentChildSelection(data.children);
  const selectedChildren = useMemo(() => {
    if (data.children.length <= 1) return data.children;
    if (!selectedChildId) return [];
    return data.children.filter((child) => child.id === selectedChildId);
  }, [data.children, selectedChildId]);
  const deadlineBanner = useMemo(() => {
    return feeDeadlineBanner(data.children);
  }, [data.children]);
  const showChildPrompt = data.children.length > 1 && !selectedChildren.length;
  const dashboardPlan = useMemo(() => pickDashboardPlan(data.monthlyPlans), [data.monthlyPlans]);
  const visibleSelectedChildId = selectedChildId;

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [dashboard, notifications, monthlyPlans] = await Promise.all([
        api.parent.dashboard(),
        api.shared.notifications.list({ limit: 5 }),
        api.shared.monthlyPlans({ status: "all" }),
      ]);
      setData({
        children: uniqueChildren(dashboard?.children),
        headlines: dashboard?.headlines || [],
        monthlyPlans: monthlyPlans?.items || [],
        monthlyPlanSummary: monthlyPlans?.summary || {},
        notifications: notifications?.items || [],
        notificationSummary: notifications?.summary || {},
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to load your dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <DashboardSkeleton message="Preparing your parent portal..." />;

  if (error) {
    return (
      <Screen contentContainerStyle={styles.errorScreen}>
        <SurfaceCard>
          <Ionicons color={colors.error} name="cloud-offline-outline" size={32} />
          <AppText style={styles.errorTitle} variant="heading">Dashboard unavailable</AppText>
          <AppText style={styles.errorBody}>{error}</AppText>
          <PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton>
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
            onRefresh={() => {
              setParentSelectedChildId("");
              load({ refresh: true });
            }}
            refreshing={refreshing}
            tintColor={colors.gold}
          />
      }
    >
      <LinearGradient colors={[colors.primaryContainer, "#0D5C48"]} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <AppText style={styles.eyebrow}>PARENT PORTAL</AppText>
            <AppText style={styles.greeting} variant="display">
              Salaam, {firstName(user)}!
            </AppText>
            <AppText style={styles.heroBody}>
              Stay close to your child's learning journey.
            </AppText>
          </View>
        </View>
      </LinearGradient>

      {deadlineBanner ? (
        <SurfaceCard style={[
          styles.deadlineBanner,
          deadlineBanner.tone === "upcoming" && styles.deadlineBannerUpcoming,
        ]}>
          <Ionicons
            color={deadlineBanner.tone === "upcoming" ? "#2563EB" : colors.error}
            name={deadlineBanner.tone === "upcoming" ? "calendar-outline" : "alert-circle-outline"}
            size={20}
          />
          <AppText style={[
            styles.deadlineBannerText,
            deadlineBanner.tone === "upcoming" && styles.deadlineBannerTextUpcoming,
          ]}>
            {deadlineBanner.message}
          </AppText>
        </SurfaceCard>
      ) : null}

      <SectionHeader title="Monthly Plan" />
      <MonthlyPlanPreview
        item={dashboardPlan}
        onPress={() => router.push("/(app)/parent/monthly-plans")}
        summary={data.monthlyPlanSummary}
      />

      {/* Children cards */}
      <SectionHeader title={`${data.children.length} ${data.children.length === 1 ? "Child" : "Children"}`} />
      {data.children.length > 1 ? (
        <ChildDropdown
          children={data.children}
          label="SELECT CHILD"
          onChange={setParentSelectedChildId}
          placeholder="Choose a child to view class schedule"
          selectedId={visibleSelectedChildId}
        />
      ) : null}
      {data.children.length ? (
        showChildPrompt ? (
          <SurfaceCard style={styles.empty}>
            <Ionicons color={colors.secondary} name="chevron-down-circle-outline" size={28} />
            <AppText style={styles.emptyTitle}>Select a child</AppText>
            <AppText style={styles.emptyText}>
              Choose a child from the dropdown to view that child&apos;s class and lecture schedule.
            </AppText>
          </SurfaceCard>
        ) : (
          selectedChildren.map((child) => (
            <ChildCard
              child={child}
              key={child.id || childDisplayName(child)}
              onCalendar={() => router.push("/(app)/parent/calendar")}
              onFees={() => router.push("/(app)/parent/fees")}
            />
          ))
        )
      ) : (
        <SurfaceCard style={styles.empty}>
          <Ionicons color={colors.secondary} name="people-outline" size={28} />
          <AppText style={styles.emptyTitle}>No enrolled children</AppText>
          <AppText style={styles.emptyText}>
            Your children's academic profiles will appear here once they are enrolled.
          </AppText>
        </SurfaceCard>
      )}

      {/* Quick actions */}
      <SectionHeader title="Quick Access" />
      <View style={styles.quickActions}>
        <QuickAction
          icon="calendar-outline"
          label="Calendar"
          onPress={() => router.push("/(app)/parent/calendar")}
        />
        <QuickAction
          icon="wallet-outline"
          label="Fees"
          onPress={() => router.push("/(app)/parent/fees")}
        />
        <QuickAction
          icon="checkmark-circle-outline"
          label="Attendance"
          onPress={() => router.push("/(app)/parent/attendance")}
        />
        <QuickAction
          icon="book-outline"
          label="Homework"
          onPress={() => router.push("/(app)/parent/homework")}
        />
        <QuickAction
          icon="chatbubbles-outline"
          label="Notes"
          onPress={() => router.push("/(app)/parent/notes")}
        />
        <QuickAction
          icon="person-outline"
          label="Profile"
          onPress={() => router.push("/(app)/parent/profile")}
        />
      </View>

      {/* Announcements */}
      {data.headlines.length ? (
        <>
          <SectionHeader title="Announcements" />
          <View style={styles.stack}>
            {data.headlines.slice(0, 3).map((item, index) => (
              <View key={item.id || index} style={styles.announcement}>
                <View style={styles.announcementIcon}>
                  <Ionicons color={colors.secondary} name="megaphone-outline" size={18} />
                </View>
                <View style={styles.announcementBody}>
                  <AppText style={styles.announcementTitle}>
                    {item.headline || item.title || "Announcement"}
                  </AppText>
                  <AppText numberOfLines={3} style={styles.announcementText}>
                    {item.message || item.content || item.description || ""}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function ChildCard({ child, onCalendar, onFees }) {
  const attendancePct = Number(child.attendance_percentage || 0);
  const pendingHomework = Number(child.pending_homeworks || 0);
  const feeStatus = String(child.fee_status || "").toLowerCase();
  const displayName = childDisplayName(child);
  const lectures = childLectures(child);

  const nextLecture = useMemo(
    () =>
      lectures.find((item) =>
        ["live", "upcoming", "scheduled"].includes(String(item.display_status || item.status).toLowerCase())
      ) || lectures[0],
    [lectures]
  );

  return (
    <SurfaceCard style={styles.childCard}>
      {/* Child header */}
      <View style={styles.childHeader}>
        <View style={styles.childAvatar}>
          <AppText style={styles.childInitial}>
            {displayName[0].toUpperCase()}
          </AppText>
        </View>
        <View style={styles.childCopy}>
          <AppText style={styles.childName}>{displayName}</AppText>
          <AppText style={styles.childClass}>
            {child.course_title || child.class_level || "Enrolled student"}
          </AppText>
        </View>
        <StatusChip tone={feeTone(feeStatus)}>
          {child.fee_status_label || readable(feeStatus) || "Fees"}
        </StatusChip>
      </View>

      {/* Stats row */}
      <View style={styles.childStats}>
        <Stat
          icon="checkmark-circle-outline"
          label="Attendance"
          tone={attendanceTone(attendancePct)}
          value={`${attendancePct}%`}
        />
        <Stat
          icon="videocam-outline"
          label="Attended"
          tone="neutral"
          value={String(child.attended_lectures ?? child.attended_classes ?? 0)}
        />
        <Stat
          icon="clipboard-outline"
          label="Homework"
          tone={pendingHomework > 0 ? "warning" : "success"}
          value={`${pendingHomework} pending`}
        />
      </View>

      {/* Next class */}
      {nextLecture ? (
        <>
        <Pressable onPress={onCalendar} style={styles.nextLecture}>
          <View style={styles.nextDot} />
          <View style={styles.nextCopy}>
            <AppText style={styles.nextSubject}>
              {nextLecture.subject_name || nextLecture.title || "Class"}
            </AppText>
            <AppText style={styles.nextTime}>
              Today, {time(nextLecture.scheduled_start)}
            </AppText>
          </View>
          <StatusChip tone="warning">
            {readable(nextLecture.display_status || nextLecture.status)}
          </StatusChip>
        </Pressable>
        {nextLecture.google_meet_link ? (
          <PillButton
            icon={<Ionicons color={colors.white} name="videocam-outline" size={18} />}
            onPress={() => Linking.openURL(nextLecture.google_meet_link)}
            style={styles.meetButton}
          >
            Open Google Meet
          </PillButton>
        ) : null}
        </>
      ) : (
        <View style={styles.noCLass}>
          <Ionicons color={colors.outline} name="calendar-clear-outline" size={15} />
          <AppText style={styles.noClassText}>No classes scheduled today</AppText>
        </View>
      )}

      <EducationalDocuments documents={child.educational_documents} />

      {/* Actions */}
      <View style={styles.childActions}>
        <Pressable onPress={onCalendar} style={styles.childAction}>
          <Ionicons color={colors.secondary} name="calendar-outline" size={16} />
          <AppText style={styles.childActionText}>Schedule</AppText>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable onPress={onFees} style={styles.childAction}>
          <Ionicons color={colors.secondary} name="wallet-outline" size={16} />
          <AppText style={styles.childActionText}>Fees</AppText>
        </Pressable>
      </View>
    </SurfaceCard>
  );
}

function EducationalDocuments({ documents }) {
  const [documentGroup, setDocumentGroup] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const items = Array.isArray(documents) ? documents.filter((item) => item?.url || item?.path) : [];
  const classDocuments = items.filter((item) => !isOtherEducationalDocument(item));
  const otherDocuments = items.filter(isOtherEducationalDocument);
  const groups = [
    { key: "class", label: "Class Documents", items: classDocuments },
    { key: "other", label: "Other Documents", items: otherDocuments },
  ];
  const activeGroup = groups.find((group) => group.key === documentGroup);
  const visibleItems = activeGroup?.items || [];

  return (
    <View style={styles.documents}>
      <View style={styles.documentsHeader}>
        <View style={styles.documentsTitleWrap}>
          <Ionicons color={colors.secondary} name="document-text-outline" size={16} />
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

      {!activeGroup ? (
        <View style={styles.noDocuments}>
          <Ionicons color={colors.outline} name="chevron-down-circle-outline" size={16} />
          <AppText style={styles.noDocumentsText}>Choose Class Documents or Other Documents to view files.</AppText>
        </View>
      ) : visibleItems.length ? (
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
              <Ionicons color={colors.outline} name="download-outline" size={15} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.noDocuments}>
          <Ionicons color={colors.outline} name="folder-open-outline" size={16} />
          <AppText style={styles.noDocumentsText}>No {activeGroup.label.toLowerCase()} available yet.</AppText>
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
            <View style={styles.documentsOptions}>
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
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ icon, label, tone, value }) {
  const bgColors = {
    success: "#D1FAE5",
    warning: colors.goldPale,
    danger: colors.errorContainer,
    neutral: colors.surfaceLow,
  };
  return (
    <View style={[styles.stat, { backgroundColor: bgColors[tone] || bgColors.neutral }]}>
      <Ionicons color={colors.primary} name={icon} size={16} />
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
    </View>
  );
}

function SectionHeader({ title }) {
  return (
    <AppText style={styles.sectionTitle}>{title}</AppText>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.quick}>
      <View style={styles.quickIcon}>
        <Ionicons color={colors.secondary} name={icon} size={22} />
      </View>
      <AppText style={styles.quickLabel}>{label}</AppText>
    </Pressable>
  );
}

function MonthlyPlanPreview({ item, onPress, summary }) {
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
              {dateLabel(item.start_date)} to {dateLabel(item.end_date)}
            </AppText>
          </View>
          <StatusChip tone={planTone(item.status)}>{readable(item.status)}</StatusChip>
        </View>
        <View style={styles.planMetaRow}>
          <View style={styles.planMeta}>
            <Ionicons color={colors.primary} name="attach-outline" size={16} />
            <AppText style={styles.planMetaText}>{mediaCount} resources</AppText>
          </View>
          <View style={styles.planMeta}>
            <Ionicons color={colors.primary} name="albums-outline" size={16} />
            <AppText style={styles.planMetaText}>{summary?.total || 0} total plans</AppText>
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

const styles = StyleSheet.create({
  content: { paddingTop: space.md, paddingBottom: space.xl },
  hero: { padding: space.xl, borderRadius: radius["2xl"], ...shadows.hero },
  heroTop: { flexDirection: "row", alignItems: "flex-start" },
  heroCopy: { flex: 1 },
  eyebrow: { color: "#B9EEDB", fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.2 },
  greeting: { marginTop: space.xs, color: colors.white, fontSize: 27, lineHeight: 34 },
  heroBody: { marginTop: space.xs, color: "#D6E9E2", fontSize: fontSize.sm },
  deadlineBanner: { flexDirection: "row", alignItems: "center", marginTop: space.md, backgroundColor: colors.errorContainer, borderColor: colors.error, borderWidth: 1 },
  deadlineBannerUpcoming: { backgroundColor: "#DBEAFE", borderColor: "#2563EB" },
  deadlineBannerText: { flex: 1, marginLeft: space.sm, color: colors.error, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  deadlineBannerTextUpcoming: { color: "#1D4ED8" },
  sectionTitle: { marginTop: space.xl, marginBottom: space.sm, color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.lg },
  childCard: { marginBottom: space.md },
  childHeader: { flexDirection: "row", alignItems: "center" },
  childAvatar: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: "#B9EEDB" },
  childInitial: { color: colors.primary, fontFamily: fonts.display, fontSize: fontSize.xl },
  childCopy: { flex: 1, marginHorizontal: space.sm },
  childName: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.base },
  childClass: { color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  childStats: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  stat: { flex: 1, alignItems: "center", padding: space.sm, borderRadius: radius.lg },
  statValue: { marginTop: 3, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs, textAlign: "center" },
  statLabel: { color: colors.outline, fontFamily: fonts.bodySemibold, fontSize: 8, textTransform: "uppercase", textAlign: "center" },
  nextLecture: { flexDirection: "row", alignItems: "center", marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  nextDot: { width: 9, height: 9, marginRight: space.md, borderRadius: 5, backgroundColor: colors.gold },
  nextCopy: { flex: 1 },
  nextSubject: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  nextTime: { color: colors.onSurfaceVariant, fontSize: 9 },
  meetButton: { marginTop: space.sm },
  noCLass: { flexDirection: "row", alignItems: "center", marginTop: space.md, padding: space.sm },
  noClassText: { marginLeft: space.sm, color: colors.outline, fontSize: fontSize.xs },
  documents: { marginTop: space.md, padding: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  documentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  documentsTitleWrap: { flexDirection: "row", alignItems: "center", gap: space.xs },
  documentsTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  documentsCount: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  documentsDropdown: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.sm, paddingHorizontal: space.md, paddingVertical: space.xs, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  documentsDropdownCopy: { flex: 1, marginRight: space.sm },
  documentsDropdownLabel: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 1 },
  documentsDropdownValue: { marginTop: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  documentList: { gap: space.xs, marginTop: space.sm },
  documentRow: { minHeight: 50, flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.md, backgroundColor: colors.surface },
  documentIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginRight: space.sm, borderRadius: 14, backgroundColor: colors.goldPale },
  documentCopy: { flex: 1 },
  documentLabel: { color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  documentType: { marginTop: 2, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 9, textTransform: "uppercase" },
  noDocuments: { flexDirection: "row", alignItems: "center", marginTop: space.sm, paddingVertical: space.xs },
  noDocumentsText: { flex: 1, marginLeft: space.xs, color: colors.outline, fontSize: 10 },
  documentsModalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  documentsSheet: { paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
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
  childActions: { flexDirection: "row", marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderGreen },
  childAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs },
  childActionText: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  actionDivider: { width: 1, backgroundColor: colors.borderGreen },
  empty: { alignItems: "center", paddingVertical: space.xl },
  emptyTitle: { marginTop: space.md, color: colors.primary, fontFamily: fonts.bodyBold },
  emptyText: { marginTop: space.xs, color: colors.onSurfaceVariant, textAlign: "center", fontSize: fontSize.xs },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  quick: { width: "31%", minHeight: 86, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.xl, backgroundColor: colors.surfaceLow },
  quickIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.goldPale },
  quickLabel: { marginTop: space.xs, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 10 },
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
  stack: { gap: space.sm },
  announcement: { flexDirection: "row", padding: space.md, borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius.lg, backgroundColor: colors.surface },
  announcementIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.goldPale },
  announcementBody: { flex: 1, marginLeft: space.sm },
  announcementTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  announcementText: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  errorScreen: { justifyContent: "center" },
  errorTitle: { marginTop: space.md },
  errorBody: { marginTop: space.sm, color: colors.onSurfaceVariant },
  retry: { marginTop: space.lg },
});
