/**
 * Student Profile and Account Management.
 *
 * Personal contact fields are editable through the student-scoped endpoint.
 * Admission, enrollment, guardian, role, and account-state information remains
 * read-only. Password changes require the current password and are handled
 * separately so profile edits never accidentally alter authentication data.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
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
  const { isAuthenticating, logout, updateSessionUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editor, setEditor] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
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

  function openEditor() {
    setEditor({
      fullName: profile?.full_name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
    });
  }

  async function saveProfile() {
    if (!editor.fullName.trim()) {
      Alert.alert("Full name required", "Enter your full name before saving.");
      return;
    }
    setSaving(true);
    try {
      const response = await api.student.profile.update({
        fullName: editor.fullName.trim(),
        email: editor.email.trim(),
        phone: editor.phone.trim(),
      });
      const nextProfile = response?.profile || profile;
      setProfile(nextProfile);
      updateSessionUser({
        name: nextProfile?.full_name,
        full_name: nextProfile?.full_name,
        email: nextProfile?.email,
        phone: nextProfile?.phone,
      });
      setEditor(null);
      Alert.alert("Profile updated", "Your permitted account details were saved.");
    } catch (nextError) {
      Alert.alert("Unable to update profile", nextError?.message || "Please review your details.");
    } finally {
      setSaving(false);
    }
  }

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
    <>
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold} />}
      >
        <LinearGradient colors={[colors.primaryContainer, "#0D5C48"]} style={styles.hero}>
          <View style={styles.avatar}><AppText style={styles.initials}>{initials(profile?.full_name)}</AppText></View>
          <AppText style={styles.name}>{profile?.full_name || "Student"}</AppText>
          <AppText style={styles.admission}>{profile?.admission_no || profile?.username || "STUDENT"}</AppText>
          <Pressable onPress={openEditor} style={styles.edit}><Ionicons color={colors.primary} name="create-outline" size={17} /><AppText style={styles.editText}>Edit Profile</AppText></Pressable>
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
            <View style={styles.securityCopy}><AppText style={styles.securityTitle}>Password & Session</AppText><AppText style={styles.securityText}>Change your password securely or end this device session.</AppText></View>
          </SurfaceCard>
          <PillButton onPress={() => setPasswordOpen(true)} style={styles.passwordButton} variant="outline">Change Password</PillButton>
        </Section>

        <SurfaceCard elevated={false} style={styles.readOnly}><Ionicons color={colors.emeraldMid} name="information-circle-outline" size={21} /><AppText style={styles.readOnlyText}>Class, admission number, guardian links, role, status, and permissions are managed by authorized staff.</AppText></SurfaceCard>
        <PillButton icon={<Ionicons color={colors.white} name="log-out-outline" size={19} />} loading={isAuthenticating} onPress={confirmLogout} style={styles.logout}>Log Out</PillButton>
        <AppText style={styles.version}>ASH-SHAJRAH MOBILE · VERSION 1.0</AppText>
      </Screen>
      <EditSheet form={editor} onChange={setEditor} onClose={() => setEditor(null)} onSave={saveProfile} saving={saving} />
      <PasswordSheet onClose={() => setPasswordOpen(false)} onSaved={() => { setPasswordOpen(false); Alert.alert("Password changed", "Your new password will be used the next time you sign in."); }} visible={passwordOpen} />
    </>
  );
}

function Section({ children, title }) { return <View><AppText style={styles.sectionTitle}>{title}</AppText>{children}</View>; }
function Divider() { return <View style={styles.divider} />; }
function Row({ icon, label, value }) { return <View style={styles.row}><View style={styles.rowIcon}><Ionicons color={colors.secondary} name={icon} size={18} /></View><View style={styles.rowCopy}><AppText style={styles.rowLabel}>{label}</AppText><AppText style={styles.rowValue}>{value || "Not provided"}</AppText></View></View>; }

function EditSheet({ form, onChange, onClose, onSave, saving }) {
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(form)}><View style={styles.backdrop}><View style={styles.sheet}><SheetHead onClose={onClose} title="Edit Profile" /><ScrollView keyboardShouldPersistTaps="handled">
    <Field label="Full Name" onChangeText={(fullName) => onChange({ ...form, fullName })} value={form?.fullName} />
    <Field autoCapitalize="none" keyboardType="email-address" label="Email" onChangeText={(email) => onChange({ ...form, email })} value={form?.email} />
    <Field keyboardType="phone-pad" label="Phone" onChangeText={(phone) => onChange({ ...form, phone })} value={form?.phone} />
    <View style={styles.notice}><Ionicons color={colors.outline} name="lock-closed-outline" size={18} /><AppText style={styles.noticeText}>Academic, guardian, role, and status fields are read-only.</AppText></View>
    <PillButton loading={saving} onPress={onSave} style={styles.save}>Save Profile</PillButton>
  </ScrollView></View></View></Modal>;
}

function PasswordSheet({ onClose, onSaved, visible }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setError(""); }
  }, [visible]);

  async function save() {
    if (newPassword.length < 8) return setError("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("New password and confirmation do not match.");
    setSaving(true);
    setError("");
    try {
      await api.student.profile.update({ currentPassword, newPassword });
      onSaved();
    } catch (nextError) {
      setError(nextError?.message || "Unable to change your password.");
    } finally {
      setSaving(false);
    }
  }

  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}><View style={styles.backdrop}><View style={styles.passwordSheet}><SheetHead onClose={onClose} title="Change Password" />
    <Field label="Current Password" onChangeText={setCurrentPassword} secureTextEntry value={currentPassword} />
    <Field label="New Password" onChangeText={setNewPassword} secureTextEntry value={newPassword} />
    <Field label="Confirm New Password" onChangeText={setConfirmPassword} secureTextEntry value={confirmPassword} />
    {error ? <AppText style={styles.inlineError}>{error}</AppText> : null}
    <PillButton loading={saving} onPress={save} style={styles.save}>Update Password</PillButton>
  </View></View></Modal>;
}

function SheetHead({ onClose, title }) { return <View style={styles.sheetHead}><AppText style={styles.sheetTitle}>{title}</AppText><Pressable onPress={onClose} style={styles.close}><Ionicons color={colors.primary} name="close" size={22} /></Pressable></View>; }
function Field({ label, ...props }) { return <View><AppText style={styles.label}>{label}</AppText><TextInput placeholder={`Enter ${label.toLowerCase()}`} placeholderTextColor={colors.outline} style={styles.input} {...props} /></View>; }

const styles = StyleSheet.create({
  content:{paddingTop:space.md,paddingBottom:space.xl},hero:{alignItems:"center",padding:space.xl,borderRadius:radius["2xl"],...shadows.hero},avatar:{width:82,height:82,alignItems:"center",justifyContent:"center",borderWidth:3,borderColor:colors.secondaryContainer,borderRadius:41,backgroundColor:"rgba(255,255,255,.12)"},initials:{color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize["2xl"]},name:{marginTop:space.md,color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize.xl,textAlign:"center"},admission:{marginTop:4,color:colors.secondaryContainer,fontFamily:fonts.bodyBold,fontSize:10,letterSpacing:1},edit:{flexDirection:"row",alignItems:"center",gap:5,marginTop:space.md,paddingHorizontal:space.md,paddingVertical:9,borderRadius:radius.full,backgroundColor:colors.white},editText:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:9},
  sectionTitle:{marginTop:space.xl,marginBottom:space.sm,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.lg},card:{paddingVertical:space.xs},row:{minHeight:64,flexDirection:"row",alignItems:"center",padding:space.md},rowIcon:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.goldPale},rowCopy:{flex:1,marginLeft:space.md},rowLabel:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:8,textTransform:"uppercase"},rowValue:{marginTop:2,color:colors.onSurface,fontFamily:fonts.bodySemibold,fontSize:fontSize.xs},divider:{height:1,marginLeft:66,backgroundColor:colors.borderGreen},
  security:{flexDirection:"row",alignItems:"center"},securityIcon:{width:44,height:44,alignItems:"center",justifyContent:"center",borderRadius:22,backgroundColor:colors.goldPale},securityCopy:{flex:1,marginLeft:space.md},securityTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},securityText:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.xs,lineHeight:18},passwordButton:{marginTop:space.sm},readOnly:{flexDirection:"row",alignItems:"flex-start",gap:space.md,marginTop:space.xl,backgroundColor:colors.surfaceLow},readOnlyText:{flex:1,color:colors.onSurfaceVariant,fontSize:fontSize.xs,lineHeight:18},logout:{marginTop:space.xl},version:{marginTop:space.xl,color:colors.outline,fontFamily:fonts.bodyBold,fontSize:9,letterSpacing:1,textAlign:"center"},
  warning:{marginTop:space.md,backgroundColor:colors.statusPendingBg},warningText:{color:colors.statusPendingText,fontSize:fontSize.xs},state:{alignItems:"center"},stateTitle:{marginTop:space.md,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},stateText:{marginTop:space.sm,color:colors.onSurfaceVariant,textAlign:"center"},retry:{marginTop:space.lg},errorScreen:{justifyContent:"center"},
  backdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,39,30,.42)"},sheet:{height:"70%",padding:space.lg,paddingBottom:space["2xl"],borderTopLeftRadius:radius.xl,borderTopRightRadius:radius.xl,backgroundColor:colors.background},passwordSheet:{padding:space.lg,paddingBottom:space["2xl"],borderTopLeftRadius:radius.xl,borderTopRightRadius:radius.xl,backgroundColor:colors.background},sheetHead:{flexDirection:"row",alignItems:"center",marginBottom:space.sm},sheetTitle:{flex:1,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},close:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.surfaceHigh},label:{marginTop:space.md,marginBottom:space.xs,color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},input:{height:48,paddingHorizontal:space.md,borderWidth:1,borderColor:colors.outlineVariant,borderRadius:radius.lg,color:colors.onSurface,fontFamily:fonts.body,backgroundColor:colors.surface},notice:{flexDirection:"row",alignItems:"center",gap:space.sm,marginTop:space.lg,padding:space.md,borderRadius:radius.lg,backgroundColor:colors.surfaceLow},noticeText:{flex:1,color:colors.outline,fontSize:fontSize.xs},save:{marginTop:space.xl},inlineError:{marginTop:space.md,color:colors.error,fontSize:fontSize.xs},
});
