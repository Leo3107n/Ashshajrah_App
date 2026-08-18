/**
 * Student Profile and Account Management.
 *
 * Student profile details are read-only in mobile. Admission, enrollment,
 * guardian, role, account-state information, and password changes are managed
 * by authorized staff.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

const initials = (value) =>
  String(value || "Student").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const readableDate = (value) =>
  value ? new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "";

export default function StudentProfile() {
  const { isAuthenticating, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api.student.profile.get();
      setProfile(response?.profile || null);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load your Student profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function confirmLogout() {
    Alert.alert("Log out?", "You will need to sign in again to access your Student portal.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: logout },
    ]);
  }

  if (loading) return <DashboardSkeleton message="Preparing your Student profile..." />;
  if (error && !profile) {
    return <Screen contentContainerStyle={styles.errorScreen}><SurfaceCard style={styles.state}><Ionicons color={colors.error} name="cloud-offline-outline" size={32} /><AppText style={styles.stateTitle}>Profile unavailable</AppText><AppText style={styles.stateText}>{error}</AppText><PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton></SurfaceCard></Screen>;
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
    >
      <LinearGradient colors={[colors.primaryContainer, "#0D5C48"]} style={styles.hero}>
        <View style={styles.avatar}><AppText style={styles.initials}>{initials(profile?.full_name)}</AppText></View>
        <AppText style={styles.name}>{profile?.full_name || "Student"}</AppText>
        <AppText style={styles.admission}>{profile?.admission_no || profile?.username || "STUDENT"}</AppText>
      </LinearGradient>

      {error ? <SurfaceCard style={styles.warning}><AppText style={styles.warningText}>{error}</AppText></SurfaceCard> : null}

      <Section title="Account Information">
        <SurfaceCard style={styles.card}>
          <Row icon="mail-outline" label="Email" value={profile?.email} /><Divider />
          <Row icon="call-outline" label="Phone" value={profile?.phone} /><Divider />
          <Row icon="person-outline" label="Username" value={profile?.username} /><Divider />
          <Row icon="shield-checkmark-outline" label="Account Status" value={String(profile?.user_status || "Unavailable").toUpperCase()} />
        </SurfaceCard>
      </Section>

      <Section title="Academic Information">
        <SurfaceCard style={styles.card}>
          <Row icon="school-outline" label="Enrolled Class" value={profile?.course_title || profile?.grade_level} /><Divider />
          <Row icon="id-card-outline" label="Admission Number" value={profile?.admission_no} /><Divider />
          <Row icon="calendar-outline" label="Date of Birth" value={readableDate(profile?.date_of_birth)} /><Divider />
          <Row icon="person-circle-outline" label="Age" value={profile?.age ? `${profile.age} years` : ""} /><Divider />
          <Row icon="ribbon-outline" label="Program" value={profile?.program_name} />
        </SurfaceCard>
      </Section>

      <Section title="Guardian Information">
        <SurfaceCard style={styles.card}>
          <Row icon="people-outline" label="Parent or Guardian" value={profile?.father_name || profile?.lead_parent_name} /><Divider />
          <Row icon="git-branch-outline" label="Relationship" value={profile?.lead_parent_relation} /><Divider />
          <Row icon="call-outline" label="Guardian Phone" value={profile?.father_phone} /><Divider />
          <Row icon="mail-outline" label="Guardian Email" value={profile?.father_email} />
        </SurfaceCard>
      </Section>

      <Section title="Security">
        <SurfaceCard style={styles.security}>
          <View style={styles.securityIcon}><Ionicons color={colors.secondary} name="lock-closed-outline" size={22} /></View>
          <View style={styles.securityCopy}><AppText style={styles.securityTitle}>Password & Session</AppText><AppText style={styles.securityText}>Password changes are managed by authorized staff. You can end this device session below.</AppText></View>
        </SurfaceCard>
      </Section>

      <SurfaceCard elevated={false} style={styles.readOnly}><Ionicons color={colors.emeraldMid} name="information-circle-outline" size={21} /><AppText style={styles.readOnlyText}>Profile information is managed by authorized staff. Students can view details here but cannot edit them.</AppText></SurfaceCard>
      <PillButton icon={<Ionicons color={colors.white} name="log-out-outline" size={19} />} loading={isAuthenticating} onPress={confirmLogout} style={styles.logout}>Log Out</PillButton>
      <AppText style={styles.version}>ASH-SHAJRAH MOBILE - VERSION 1.0</AppText>
    </Screen>
  );
}

function Section({ children, title }) { return <View><AppText style={styles.sectionTitle}>{title}</AppText>{children}</View>; }
function Divider() { return <View style={styles.divider} />; }
function Row({ icon, label, value }) { return <View style={styles.row}><View style={styles.rowIcon}><Ionicons color={colors.secondary} name={icon} size={18} /></View><View style={styles.rowCopy}><AppText style={styles.rowLabel}>{label}</AppText><AppText style={styles.rowValue}>{value || "Not provided"}</AppText></View></View>; }

const styles = StyleSheet.create({
  content:{paddingTop:space.md,paddingBottom:space.xl},hero:{alignItems:"center",padding:space.xl,borderRadius:radius["2xl"],...shadows.hero},avatar:{width:82,height:82,alignItems:"center",justifyContent:"center",borderWidth:3,borderColor:colors.secondaryContainer,borderRadius:41,backgroundColor:"rgba(255,255,255,.12)"},initials:{color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize["2xl"]},name:{marginTop:space.md,color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize.xl,textAlign:"center"},admission:{marginTop:4,color:colors.secondaryContainer,fontFamily:fonts.bodyBold,fontSize:10,letterSpacing:1},
  sectionTitle:{marginTop:space.xl,marginBottom:space.sm,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.lg},card:{paddingVertical:space.xs},row:{minHeight:64,flexDirection:"row",alignItems:"center",padding:space.md},rowIcon:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.goldPale},rowCopy:{flex:1,marginLeft:space.md},rowLabel:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:8,textTransform:"uppercase"},rowValue:{marginTop:2,color:colors.onSurface,fontFamily:fonts.bodySemibold,fontSize:fontSize.xs},divider:{height:1,marginLeft:66,backgroundColor:colors.borderGreen},
  security:{flexDirection:"row",alignItems:"center"},securityIcon:{width:44,height:44,alignItems:"center",justifyContent:"center",borderRadius:22,backgroundColor:colors.goldPale},securityCopy:{flex:1,marginLeft:space.md},securityTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},securityText:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.xs,lineHeight:18},readOnly:{flexDirection:"row",alignItems:"flex-start",gap:space.md,marginTop:space.xl,backgroundColor:colors.surfaceLow},readOnlyText:{flex:1,color:colors.onSurfaceVariant,fontSize:fontSize.xs,lineHeight:18},logout:{marginTop:space.xl},version:{marginTop:space.xl,color:colors.outline,fontFamily:fonts.bodyBold,fontSize:9,letterSpacing:1,textAlign:"center"},
  warning:{marginTop:space.md,backgroundColor:colors.statusPendingBg},warningText:{color:colors.statusPendingText,fontSize:fontSize.xs},state:{alignItems:"center"},stateTitle:{marginTop:space.md,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},stateText:{marginTop:space.sm,color:colors.onSurfaceVariant,textAlign:"center"},retry:{marginTop:space.lg},errorScreen:{justifyContent:"center"},
});
