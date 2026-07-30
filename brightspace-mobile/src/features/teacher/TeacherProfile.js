/**
 * Teacher Profile and Account Management.
 *
 * The editable form sends only the four fields permitted by the Teacher
 * profile API. Identity, role, status, email, username, and assignments remain
 * read-only, while logout continues through the centralized session provider.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import api from "../../api";
import { AppText, DashboardSkeleton, PillButton, Screen, SurfaceCard } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../theme";

function initials(value) {
  return String(value || "Teacher").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function assignmentGroups(items) {
  const map = new Map();
  for (const item of items || []) {
    const className = item.class_level || item.course_title || "Assigned Class";
    const subject = item.subject_name || item.title || "Subject";
    const key = `${className}::${subject}`;
    if (!map.has(key)) map.set(key, { key, className, subject, students: new Set(), lectures: 0 });
    const group = map.get(key);
    group.lectures += 1;
    String(item.student_name || "").split(",").map((name) => name.trim()).filter(Boolean).forEach((name) => group.students.add(name));
  }
  return [...map.values()];
}

export default function TeacherProfile() {
  const { isAuthenticating, logout, role, updateSessionUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [profileData, classData] = await Promise.all([
        api.teacher.profile.get(),
        api.teacher.classes({ range: "all" }),
      ]);
      setProfile(profileData?.profile || null);
      setLectures(classData?.items || []);
    } catch (nextError) {
      setError(nextError?.message || "Unable to load your Teacher profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const assignments = useMemo(() => assignmentGroups(lectures), [lectures]);

  function edit() {
    setForm({
      fullName: profile?.full_name || "",
      phone: profile?.phone || "",
      qualification: profile?.qualification || "",
      experience: profile?.experience || "",
    });
  }

  async function save() {
    if (!form.fullName.trim()) {
      Alert.alert("Full name required", "Enter your full name before saving.");
      return;
    }
    setSaving(true);
    try {
      const result = await api.teacher.profile.update({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        qualification: form.qualification.trim(),
        experience: form.experience.trim(),
      });
      updateSessionUser({ name: form.fullName.trim(), full_name: form.fullName.trim(), phone: form.phone.trim() });
      setForm(null);
      Alert.alert("Profile updated", result?.message || "Your permitted profile details were saved.");
      await load({ refresh: true });
    } catch (nextError) {
      Alert.alert("Unable to update profile", nextError?.message || "Please review the information.");
    } finally {
      setSaving(false);
    }
  }

  function confirmLogout() {
    Alert.alert("Log out?", "You will need to sign in again to access your Teacher portal.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: logout },
    ]);
  }

  if (loading) return <DashboardSkeleton message="Preparing your Teacher profile..."/>;
  if (error && !profile) return <Screen contentContainerStyle={styles.errorScreen}><SurfaceCard><Ionicons color={colors.error} name="cloud-offline-outline" size={32}/><AppText style={styles.errorTitle} variant="heading">Profile unavailable</AppText><AppText style={styles.errorBody}>{error}</AppText><PillButton onPress={() => load()} style={styles.retry}>Try Again</PillButton></SurfaceCard></Screen>;

  return <>
    <Screen contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.gold]} onRefresh={() => load({ refresh: true })} refreshing={refreshing} tintColor={colors.gold}/>}>
      <LinearGradient colors={[colors.primaryContainer, "#0D5C48"]} style={styles.hero}>
        <View style={styles.avatar}><AppText style={styles.initials}>{initials(profile?.full_name)}</AppText></View>
        <AppText style={styles.name}>{profile?.full_name || "Teacher"}</AppText>
        <View style={styles.rolePill}><Ionicons color={colors.secondaryContainer} name="school-outline" size={14}/><AppText style={styles.role}>{String(role).toUpperCase()}</AppText></View>
        <Pressable onPress={edit} style={styles.edit}><Ionicons color={colors.primary} name="create-outline" size={17}/><AppText style={styles.editText}>Edit Profile</AppText></Pressable>
      </LinearGradient>
      {error ? <SurfaceCard style={styles.warning}><AppText style={styles.warningText}>{error}</AppText></SurfaceCard> : null}

      <Section title="Account Information"><SurfaceCard style={styles.card}><Row icon="mail-outline" label="Email" value={profile?.email}/><Divider/><Row icon="call-outline" label="Phone" value={profile?.phone}/><Divider/><Row icon="shield-checkmark-outline" label="Account Status" value={profile?.status ? String(profile.status).toUpperCase() : "Unavailable"}/><Divider/><Row icon="key-outline" label="Role and Permissions" value="Teacher · Managed by administration"/></SurfaceCard></Section>
      <Section title="Professional Information"><SurfaceCard style={styles.card}><Row icon="ribbon-outline" label="Qualification" value={profile?.qualification}/><Divider/><Row icon="briefcase-outline" label="Experience" value={profile?.experience}/></SurfaceCard></Section>

      <View style={styles.sectionHead}><AppText style={styles.sectionTitle}>Teaching Assignments</AppText><AppText style={styles.count}>{assignments.length}</AppText></View>
      <View style={styles.assignments}>{assignments.length ? assignments.map((item) => <Assignment item={item} key={item.key}/>) : <View style={styles.empty}><Ionicons color={colors.outline} name="school-outline" size={28}/><AppText style={styles.emptyText}>No active teaching assignments.</AppText></View>}</View>

      <SurfaceCard elevated={false} style={styles.security}><Ionicons color={colors.emeraldMid} name="lock-closed-outline" size={22}/><View style={styles.securityCopy}><AppText style={styles.securityTitle}>Protected Account</AppText><AppText style={styles.securityText}>Role, account status, email, username, and permissions can only be changed by authorized administration.</AppText></View></SurfaceCard>
      <PillButton icon={<Ionicons color={colors.white} name="log-out-outline" size={19}/>} loading={isAuthenticating} onPress={confirmLogout} style={styles.logout}>Log Out</PillButton>
      <AppText style={styles.version}>ASH-SHAJRAH MOBILE · VERSION 1.0</AppText>
    </Screen>
    <EditProfile form={form} onChange={setForm} onClose={() => setForm(null)} onSave={save} saving={saving}/>
  </>;
}

function Section({ children, title }) { return <View><AppText style={styles.sectionTitle}>{title}</AppText>{children}</View>; }
function Divider() { return <View style={styles.divider}/>; }
function Row({ icon, label, value }) { return <View style={styles.row}><View style={styles.rowIcon}><Ionicons color={colors.secondary} name={icon} size={18}/></View><View style={styles.rowCopy}><AppText style={styles.rowLabel}>{label}</AppText><AppText style={styles.rowValue}>{value || "Not provided"}</AppText></View></View>; }
function Assignment({ item }) { return <SurfaceCard style={styles.assignment}><View style={styles.assignmentIcon}><Ionicons color={colors.secondary} name="book-outline" size={19}/></View><View style={styles.assignmentCopy}><AppText style={styles.assignmentClass}>{item.className}</AppText><AppText style={styles.assignmentSubject}>{item.subject}</AppText><AppText style={styles.assignmentMeta}>{item.students.size} students · {item.lectures} lecture{item.lectures === 1 ? "" : "s"}</AppText></View></SurfaceCard>; }

function EditProfile({ form, onChange, onClose, onSave, saving }) {
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(form)}><View style={styles.backdrop}><View style={styles.sheet}><View style={styles.sheetHead}><AppText style={styles.sheetTitle}>Edit Profile</AppText><Pressable accessibilityLabel="Close profile editor" onPress={onClose} style={styles.close}><Ionicons color={colors.primary} name="close" size={22}/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <Field label="Full Name" maxLength={150} onChange={(fullName) => onChange({ ...form, fullName })} value={form?.fullName}/>
    <Field keyboardType="phone-pad" label="Phone" maxLength={50} onChange={(phone) => onChange({ ...form, phone })} value={form?.phone}/>
    <Field label="Qualification" maxLength={255} onChange={(qualification) => onChange({ ...form, qualification })} value={form?.qualification}/>
    <Field label="Experience" maxLength={255} multiline onChange={(experience) => onChange({ ...form, experience })} value={form?.experience}/>
    <View style={styles.readOnlyNotice}><Ionicons color={colors.outline} name="information-circle-outline" size={18}/><AppText style={styles.readOnlyText}>Email, role, status, username, and permissions are read-only.</AppText></View>
    <PillButton disabled={saving} loading={saving} onPress={onSave} style={styles.save}>Save Profile</PillButton>
  </ScrollView></View></View></Modal>;
}

function Field({ keyboardType, label, maxLength, multiline = false, onChange, value }) { return <View><AppText style={styles.label}>{label}</AppText><TextInput keyboardType={keyboardType} maxLength={maxLength} multiline={multiline} onChangeText={onChange} placeholder={`Enter ${label.toLowerCase()}`} placeholderTextColor={colors.outline} style={[styles.input, multiline && styles.textarea]} textAlignVertical={multiline ? "top" : "center"} value={value}/></View>; }

const styles = StyleSheet.create({
  content:{paddingTop:space.md,paddingBottom:space.xl},hero:{alignItems:"center",padding:space.xl,borderRadius:radius["2xl"],...shadows.hero},avatar:{width:80,height:80,alignItems:"center",justifyContent:"center",borderWidth:3,borderColor:colors.secondaryContainer,borderRadius:40,backgroundColor:"rgba(255,255,255,.12)"},initials:{color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize["2xl"]},name:{marginTop:space.md,color:colors.white,fontFamily:fonts.displayBold,fontSize:fontSize.xl,textAlign:"center"},rolePill:{flexDirection:"row",alignItems:"center",gap:5,marginTop:space.sm,paddingHorizontal:space.md,paddingVertical:6,borderRadius:radius.full,backgroundColor:"rgba(255,255,255,.10)"},role:{color:colors.secondaryContainer,fontFamily:fonts.bodyBold,fontSize:9,letterSpacing:1},edit:{flexDirection:"row",alignItems:"center",gap:5,marginTop:space.md,paddingHorizontal:space.md,paddingVertical:9,borderRadius:radius.full,backgroundColor:colors.white},editText:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:9},
  sectionTitle:{marginTop:space.xl,marginBottom:space.sm,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.lg},card:{paddingVertical:space.xs},row:{minHeight:64,flexDirection:"row",alignItems:"center",padding:space.md},rowIcon:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.goldPale},rowCopy:{flex:1,marginLeft:space.md},rowLabel:{color:colors.outline,fontFamily:fonts.bodyBold,fontSize:8,textTransform:"uppercase"},rowValue:{marginTop:2,color:colors.onSurface,fontFamily:fonts.bodySemibold,fontSize:fontSize.xs},divider:{height:1,marginLeft:66,backgroundColor:colors.borderGreen},
  sectionHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},count:{marginTop:space.xl,marginBottom:space.sm,color:colors.emeraldMid,fontFamily:fonts.displayBold,fontSize:fontSize.lg},assignments:{gap:space.sm},assignment:{flexDirection:"row",alignItems:"center"},assignmentIcon:{width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:21,backgroundColor:colors.goldPale},assignmentCopy:{flex:1,marginLeft:space.md},assignmentClass:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},assignmentSubject:{color:colors.emeraldMid,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},assignmentMeta:{marginTop:4,color:colors.outline,fontSize:8},empty:{alignItems:"center",padding:space.xl,borderRadius:radius.xl,backgroundColor:colors.surfaceLow},emptyText:{marginTop:space.sm,color:colors.outline,fontSize:fontSize.xs},
  security:{flexDirection:"row",alignItems:"flex-start",marginTop:space.lg,backgroundColor:colors.surfaceLow},securityCopy:{flex:1,marginLeft:space.md},securityTitle:{color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.sm},securityText:{marginTop:3,color:colors.onSurfaceVariant,fontSize:fontSize.xs,lineHeight:18},logout:{marginTop:space.xl},version:{marginTop:space.xl,color:colors.outline,fontFamily:fonts.bodyBold,fontSize:9,letterSpacing:1,textAlign:"center"},warning:{marginTop:space.md,backgroundColor:colors.statusPendingBg},warningText:{color:colors.statusPendingText,fontSize:fontSize.xs},
  backdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,39,30,.35)"},sheet:{height:"82%",padding:space.lg,paddingBottom:space["2xl"],borderTopLeftRadius:radius.xl,borderTopRightRadius:radius.xl,backgroundColor:colors.background},sheetHead:{flexDirection:"row",alignItems:"center",marginBottom:space.sm},sheetTitle:{flex:1,color:colors.primary,fontFamily:fonts.displayBold,fontSize:fontSize.xl},close:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:colors.surfaceHigh},label:{marginTop:space.md,marginBottom:space.xs,color:colors.primary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs},input:{minHeight:48,paddingHorizontal:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:radius.lg,backgroundColor:colors.surface,color:colors.onSurface,fontFamily:fonts.body,fontSize:fontSize.xs},textarea:{minHeight:96,paddingTop:space.md},readOnlyNotice:{flexDirection:"row",alignItems:"center",gap:space.sm,marginTop:space.lg,padding:space.md,borderRadius:radius.lg,backgroundColor:colors.surfaceLow},readOnlyText:{flex:1,color:colors.outline,fontSize:fontSize.xs},save:{marginTop:space.xl},
  errorScreen:{justifyContent:"center"},errorTitle:{marginTop:space.md},errorBody:{marginTop:space.sm,color:colors.onSurfaceVariant},retry:{marginTop:space.lg},
});
