/**
 * Parent home dashboard. Shows an overview of each child's academic status —
 * upcoming classes, homework, attendance, and fee standing — sourced entirely
 * from the Parent-scoped API so no student or teacher data leaks across roles.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
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
import { WebView } from "react-native-webview";

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

function parentFeeBanners(status, dashboardChildren) {
  const statusChildren = Array.isArray(status?.children) ? status.children : [];
  const source = statusChildren.length
    ? statusChildren
    : (Array.isArray(dashboardChildren) ? dashboardChildren : []).map((child) => ({
        ...child,
        due_date: child.fee_due_date,
        effective_status: child.fee_status,
        overdue: child.fee_deadline_missed,
        student_name: childDisplayName(child),
        student_id: child.id,
      }));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const seen = new Set();

  return source
    .filter((item) => {
      const key = String(item?.student_id || item?.student_name || "");
      const paymentStatus = String(item?.effective_status || item?.fee_status || "").toLowerCase();
      const paid = Boolean(item?.is_paid) || ["verified", "approved", "paid"].includes(paymentStatus);
      if (!key || seen.has(key) || paid || !item?.due_date) return false;
      seen.add(key);
      return true;
    })
    .map((item) => {
      const dueDate = new Date(item.due_date);
      const overdue = Boolean(item.overdue)
        || (!Number.isNaN(dueDate.getTime()) && dueDate.getTime() < today.getTime());
      const childName = String(item.student_name || "your child").trim();
      const dueLabel = dateLabel(item.due_date);
      return {
        key: String(item.student_id || childName),
        tone: overdue ? "overdue" : "upcoming",
        message: overdue
          ? `Fee deadline has passed for ${childName}. It was ${dueLabel}.`
          : `Fee deadline for ${childName} is ${dueLabel}.`,
      };
    })
    .sort((left, right) => (left.tone === "overdue" ? -1 : 1) - (right.tone === "overdue" ? -1 : 1));
}

function dateLabel(value) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function pickDashboardPlan(plans) {
  const items = Array.isArray(plans) ? plans : [];
  return items.find((item) => String(item.status).toLowerCase() === "active") || null;
}

export default function ParentHome() {
  const { height: viewportHeight } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState({
    children: [],
    headlines: [],
    monthlyPlans: [],
    monthlyPlanSummary: {},
    monthlyFee: null,
    notifications: [],
    notificationSummary: {},
  });
  const [loading, setLoading] = useState(true);
  const [planFrame, setPlanFrame] = useState({ y: 0, height: 0 });
  const [planVisible, setPlanVisible] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedChildId, setParentSelectedChildId] = useParentChildSelection(data.children);
  const selectedChildren = useMemo(() => {
    if (data.children.length <= 1) return data.children;
    if (!selectedChildId) return [];
    return data.children.filter((child) => child.id === selectedChildId);
  }, [data.children, selectedChildId]);
  const deadlineBanners = useMemo(() => {
    return parentFeeBanners(data.monthlyFee, data.children);
  }, [data.children, data.monthlyFee]);
  const showChildPrompt = data.children.length > 1 && !selectedChildren.length;
  const dashboardPlan = useMemo(() => pickDashboardPlan(data.monthlyPlans), [data.monthlyPlans]);

  const handleDashboardScroll = useCallback((event) => {
    if (!planFrame.height) return;
    const scrollY = event.nativeEvent.contentOffset.y;
    const visible = scrollY < planFrame.y + planFrame.height
      && scrollY + viewportHeight > planFrame.y;
    setPlanVisible((current) => current === visible ? current : visible);
  }, [planFrame, viewportHeight]);
  const visibleSelectedChildId = selectedChildId;

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [dashboard, notifications, monthlyPlans, monthlyFee] = await Promise.all([
        api.parent.dashboard(),
        api.shared.notifications.list({ limit: 5 }),
        api.shared.monthlyPlans({ status: "active" }),
        api.payment.monthlyFeeStatus(),
      ]);
      setData({
        children: uniqueChildren(dashboard?.children),
        headlines: dashboard?.headlines || [],
        monthlyPlans: monthlyPlans?.items || [],
        monthlyPlanSummary: monthlyPlans?.summary || {},
        monthlyFee,
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
      onScroll={handleDashboardScroll}
      scrollEventThrottle={100}
        refreshControl={
          <RefreshControl
            colors={[colors.gold]}
            onRefresh={() => load({ refresh: true })}
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

      {deadlineBanners.map((deadlineBanner) => (
        <SurfaceCard
          key={deadlineBanner.key}
          style={[
            styles.deadlineBanner,
            deadlineBanner.tone === "upcoming" && styles.deadlineBannerUpcoming,
          ]}
        >
          <Ionicons
            color={deadlineBanner.tone === "upcoming" ? "#A87900" : colors.error}
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
      ))}

      <SectionHeader title="Monthly Plan" />
      <View
        onLayout={(event) => setPlanFrame(event.nativeEvent.layout)}
      >
        <MonthlyPlanPreview
          isVisible={planVisible}
          item={dashboardPlan}
        />
      </View>

      {/* Announcements sit directly below the Monthly Plan so parents see
          current school updates before selecting a child. */}
      {data.headlines.length ? (
        <>
          <SectionHeader title="Announcements" />
          <View style={styles.stack}>
            {data.headlines.slice(0, 3).map((item, index) => (
              <View key={item.id || index} style={styles.announcement}>
                <View style={styles.announcementIcon}>
                  <Ionicons color={colors.white} name="megaphone-outline" size={18} />
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
      </View>

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
              <Ionicons color={colors.gold} name="download-outline" size={15} />
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

function MonthlyPlanPreview({ isVisible = true, item }) {
  const { width } = useWindowDimensions();
  const carouselRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState(null);
  const media = Array.isArray(item?.media) ? item.media : [];
  const slideWidth = Math.max(260, Math.min(width - space.xl * 2 - space.md * 2, 340));
  const slideHeight = Math.round(slideWidth * 1.25);
  const pageSize = slideWidth + space.sm;

  function moveSlide(direction) {
    if (!media.length) return;
    const nextIndex = Math.max(0, Math.min(media.length - 1, activeIndex + direction));
    setActiveIndex(nextIndex);
    carouselRef.current?.scrollTo({ x: nextIndex * pageSize, animated: true });
  }

  if (!item) {
    return (
      <SurfaceCard style={styles.planPreview}>
        <AppText style={styles.noPlanText}>No active monthly plan yet.</AppText>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard style={styles.planPreviewMediaOnly}>
        {media.length ? (
          <ScrollView
            ref={carouselRef}
            contentContainerStyle={styles.planSlideshowMediaOnly}
            horizontal
            pagingEnabled
            snapToAlignment="center"
            snapToInterval={pageSize}
            decelerationRate="fast"
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageSize);
              setActiveIndex(Math.max(0, Math.min(media.length - 1, nextIndex)));
            }}
            showsHorizontalScrollIndicator={false}
          >
            {media.map((asset, index) => (
              <Pressable
                key={`${asset.path || asset.url || index}`}
                onPress={() => setViewerIndex(index)}
                style={[styles.planSlide, { width: slideWidth, height: slideHeight }]}
              >
                {asset.type === "image" && asset.url ? (
                  <Image resizeMode="cover" source={{ uri: asset.url }} style={styles.planSlideImage} />
                ) : asset.type === "video" && asset.url && index === activeIndex && isVisible ? (
                  <DashboardPlanVideo asset={asset} />
                ) : (
                  <View style={styles.planSlideVideo}>
                    <Ionicons color={colors.secondary} name="videocam-outline" size={26} />
                    <AppText style={styles.planSlideText}>Video {index + 1}</AppText>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {media.length > 1 ? (
          <>
            <CarouselArrow
              disabled={activeIndex === 0}
              direction="left"
              onPress={() => moveSlide(-1)}
            />
            <CarouselArrow
              disabled={activeIndex === media.length - 1}
              direction="right"
              onPress={() => moveSlide(1)}
            />
          </>
        ) : null}
        <DashboardMediaViewer
          initialIndex={viewerIndex || 0}
          media={media}
          onClose={() => setViewerIndex(null)}
          visible={viewerIndex !== null}
        />
    </SurfaceCard>
  );
}

function CarouselArrow({ direction, disabled, onPress }) {
  const isLeft = direction === "left";
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.carouselArrow,
        isLeft ? styles.carouselArrowLeft : styles.carouselArrowRight,
        disabled && styles.carouselArrowDisabled,
      ]}
    >
      <Ionicons color={colors.white} name={isLeft ? "chevron-back" : "chevron-forward"} size={24} />
    </Pressable>
  );
}

function DashboardPlanVideo({ asset }) {
  const escapedUrl = String(asset?.url || "").replace(/"/g, "&quot;");
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
            object-fit: cover;
            background: #003B2D;
          }
        </style>
      </head>
      <body>
        <video autoplay controls loop playsinline preload="auto" src="${escapedUrl}"></video>
      </body>
    </html>
  `;

  return (
    <WebView
      allowsInlineMediaPlayback
      javaScriptEnabled
      mediaPlaybackRequiresUserAction={false}
      originWhitelist={["*"]}
      scrollEnabled={false}
      source={{ html }}
      style={styles.planSlideWebVideo}
    />
  );
}

function DashboardMediaViewer({ initialIndex = 0, media, onClose, visible }) {
  const { width } = useWindowDimensions();
  const viewerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      setActiveIndex(initialIndex);
      requestAnimationFrame(() => {
        viewerRef.current?.scrollTo({ x: width * initialIndex, animated: false });
      });
    }
  }, [initialIndex, visible]);

  function moveFullscreen(direction) {
    if (!media.length) return;
    const nextIndex = Math.max(0, Math.min(media.length - 1, activeIndex + direction));
    setActiveIndex(nextIndex);
    viewerRef.current?.scrollTo({ x: width * nextIndex, animated: true });
  }

  if (!visible) return null;

  return (
    <Modal animationType="fade" onRequestClose={onClose} visible={visible}>
      <View style={styles.fullscreenViewer}>
        <View style={styles.fullscreenHeader}>
          <AppText style={styles.fullscreenCounter}>
            {activeIndex + 1} / {media.length}
          </AppText>
          <Pressable onPress={onClose} style={styles.fullscreenClose}>
            <Ionicons color={colors.white} name="close" size={26} />
          </Pressable>
        </View>
        <ScrollView
          ref={viewerRef}
          contentOffset={{ x: width * initialIndex, y: 0 }}
          horizontal
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
            setActiveIndex(Math.max(0, Math.min(media.length - 1, nextIndex)));
          }}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.fullscreenScroller}
        >
          {media.map((asset, index) => (
            <View key={`${asset.path || asset.url || index}-fullscreen`} style={[styles.fullscreenSlide, { width }]}>
              <FullscreenMedia active={activeIndex === index} asset={asset} index={index} />
            </View>
          ))}
        </ScrollView>
        {media.length > 1 ? (
          <>
            <FullscreenArrow
              disabled={activeIndex === 0}
              direction="left"
              onPress={() => moveFullscreen(-1)}
            />
            <FullscreenArrow
              disabled={activeIndex === media.length - 1}
              direction="right"
              onPress={() => moveFullscreen(1)}
            />
          </>
        ) : null}
      </View>
    </Modal>
  );
}

function FullscreenArrow({ direction, disabled, onPress }) {
  const isLeft = direction === "left";
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.fullscreenArrow,
        isLeft ? styles.fullscreenArrowLeft : styles.fullscreenArrowRight,
        disabled && styles.carouselArrowDisabled,
      ]}
    >
      <Ionicons color={colors.white} name={isLeft ? "chevron-back" : "chevron-forward"} size={30} />
    </Pressable>
  );
}

function FullscreenMedia({ active, asset, index }) {
  if (asset?.type === "video") {
    return active ? (
      <FullscreenVideo asset={asset} />
    ) : (
      <View style={styles.fullscreenUnavailable}>
        <Ionicons color={colors.white} name="videocam-outline" size={42} />
        <AppText style={styles.fullscreenUnavailableText}>Video {index + 1}</AppText>
      </View>
    );
  }
  return asset?.url ? (
    <Image resizeMode="contain" source={{ uri: asset.url }} style={styles.fullscreenImage} />
  ) : (
    <View style={styles.fullscreenUnavailable}>
      <Ionicons color={colors.white} name="cloud-offline-outline" size={36} />
      <AppText style={styles.fullscreenUnavailableText}>Media unavailable</AppText>
    </View>
  );
}

function FullscreenVideo({ asset }) {
  if (!asset?.url) return <FullscreenMedia asset={{ type: "image", url: "" }} />;
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
            background: #000;
            overflow: hidden;
          }
          video {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
          }
        </style>
      </head>
      <body>
        <video autoplay controls playsinline preload="auto" src="${escapedUrl}"></video>
      </body>
    </html>
  `;

  return (
    <WebView
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      javaScriptEnabled
      mediaPlaybackRequiresUserAction={false}
      originWhitelist={["*"]}
      source={{ html }}
      style={styles.fullscreenVideo}
    />
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
  deadlineBannerUpcoming: { backgroundColor: "#FFF4CC", borderColor: "#D6A700" },
  deadlineBannerText: { flex: 1, marginLeft: space.sm, color: colors.error, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  deadlineBannerTextUpcoming: { color: "#7A5700" },
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
  documentsDropdown: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.sm, paddingHorizontal: space.md, paddingVertical: space.xs, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.full, backgroundColor: colors.goldPale },
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
  planSlideshow: { gap: space.sm, paddingVertical: space.md },
  planSlide: { overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.goldPale },
  planSlideImage: { width: "100%", height: "100%" },
  planSlideWebVideo: { width: "100%", height: "100%", backgroundColor: colors.primary },
  planSlideVideo: { flex: 1, alignItems: "center", justifyContent: "center" },
  planSlideText: { marginTop: 4, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10 },
  planFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.borderGreen },
  planFooterText: { flex: 1, color: colors.onSurfaceVariant, fontSize: fontSize.xs },
  planPreviewMediaOnly: { padding: space.sm },
  planSlideshowMediaOnly: { gap: space.sm },
  carouselArrow: {
    position: "absolute",
    top: "46%",
    zIndex: 5,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(0, 59, 45, 0.72)",
  },
  carouselArrowLeft: { left: space.md },
  carouselArrowRight: { right: space.md },
  carouselArrowDisabled: { opacity: 0.3 },
  fullscreenViewer: { flex: 1, backgroundColor: "#000" },
  fullscreenHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space["3xl"],
    paddingBottom: space.sm,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  fullscreenCounter: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  fullscreenClose: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(255,255,255,0.14)" },
  fullscreenScroller: { flex: 1 },
  fullscreenSlide: { flex: 1, alignItems: "center", justifyContent: "center" },
  fullscreenImage: { width: "100%", height: "100%" },
  fullscreenVideo: { width: "100%", height: "100%", backgroundColor: "#000" },
  fullscreenUnavailable: { alignItems: "center", justifyContent: "center", padding: space.xl },
  fullscreenUnavailableText: { marginTop: space.sm, color: colors.white, fontFamily: fonts.bodyBold },
  fullscreenArrow: {
    position: "absolute",
    top: "48%",
    zIndex: 50,
    elevation: 50,
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.36)",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  fullscreenArrowLeft: { left: space.md },
  fullscreenArrowRight: { right: space.md },
  noPlanText: { color: colors.onSurfaceVariant, fontSize: fontSize.xs, textAlign: "center" },
  stack: { gap: space.sm },
  announcement: { flexDirection: "row", padding: space.md, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  announcementIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.gold },
  announcementBody: { flex: 1, marginLeft: space.sm },
  announcementTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  announcementText: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: fontSize.xs, lineHeight: 18 },
  errorScreen: { justifyContent: "center" },
  errorTitle: { marginTop: space.md },
  errorBody: { marginTop: space.sm, color: colors.onSurfaceVariant },
  retry: { marginTop: space.lg },
});
