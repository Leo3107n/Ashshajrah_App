/**
 * Student landing dashboard. It combines the protected Student overview,
 * next class, dashboard metrics, and announcements
 * while keeping every action inside the Student route boundary.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
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
import { WebView } from "react-native-webview";

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

function pickDashboardPlan(plans) {
  const items = Array.isArray(plans) ? plans : [];
  return items.find((item) => String(item.status).toLowerCase() === "active") || null;
}

function isOtherEducationalDocument(item) {
  const type = String(item?.type || item?.document_type || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
  return ["other", "other document", "other documents", "parent guide", "yearly plan"].includes(type);
}

export default function StudentHome() {
  const { height: viewportHeight } = useWindowDimensions();
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
  const [planFrame, setPlanFrame] = useState({ y: 0, height: 0 });
  const [planVisible, setPlanVisible] = useState(true);
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
        api.shared.monthlyPlans({ status: "active" }),
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

  const handleDashboardScroll = useCallback((event) => {
    if (!planFrame.height) return;
    const scrollY = event.nativeEvent.contentOffset.y;
    const visible = scrollY < planFrame.y + planFrame.height
      && scrollY + viewportHeight > planFrame.y;
    setPlanVisible((current) => current === visible ? current : visible);
  }, [planFrame, viewportHeight]);

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
            <Ionicons color="#A87900" name="calendar-outline" size={22} />
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
      <View
        onLayout={(event) => setPlanFrame(event.nativeEvent.layout)}
      >
        <MonthlyPlanPreview
          isVisible={planVisible}
          item={dashboardPlan}
        />
      </View>

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
    borderColor: "#D6A700",
    backgroundColor: "#FFF4CC",
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
    color: "#7A5700",
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  feeNoticeText: {
    marginTop: space.xs,
    color: "#6B4E00",
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
