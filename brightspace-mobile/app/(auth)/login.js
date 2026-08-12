/**
 * Mobile login based on the supplied Ash-Shajrah reference. Validates input,
 * authenticates through AuthContext, and routes users to their role home.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../src/api";
import { AppText, PillButton, Screen } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { colors, fonts, fontSize, radius, shadows, space } from "../../src/theme";

function messageFor(error) {
  if (error?.code === "NETWORK_ERROR" || error?.code === "REQUEST_TIMEOUT") return error.message;
  if (error?.status === 401) return "The email, username, or password is incorrect.";
  return "Sign in failed. Please try again.";
}

export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef(null);
  const { clearError, clearNotice, homeRoute, isAuthenticated, login, loginWithRole, notice } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [roleOptions, setRoleOptions] = useState([]);
  const [roleSelectorVisible, setRoleSelectorVisible] = useState(false);
  const [rolePending, setRolePending] = useState(false);

  useEffect(() => { clearError(); }, [clearError]);
  useEffect(() => { if (isAuthenticated) router.replace(homeRoute); }, [homeRoute, isAuthenticated, router]);

  async function submit() {
    if (pending) return;
    if (!identifier.trim() || !password.trim()) {
      setError("Enter your email or username and password.");
      return;
    }
    Keyboard.dismiss();
    setPending(true);
    setError("");
    try {
      // First request only tells us whether this account has one role or many.
      // When multiple portals are available, the AuthContext returns a
      // requiresRoleSelection flag so we can open the modal instead of routing
      // immediately.
      const result = await login({ identifier, password });
      if (result?.requiresRoleSelection) {
        setRoleOptions(result.roles || []);
        setRoleSelectorVisible(true);
        return;
      }
      router.replace(result.route);
    } catch (nextError) {
      setError(messageFor(nextError instanceof ApiError ? nextError : new ApiError("Sign in failed.")));
    } finally {
      setPending(false);
    }
  }

  async function submitRole(role) {
    // The second step completes the real sign-in for the exact chosen role.
    if (rolePending) return;
    setRolePending(true);
    setError("");
    try {
      const result = await loginWithRole({ identifier, password, selectedRole: role });
      setRoleSelectorVisible(false);
      setRoleOptions([]);
      router.replace(result.route);
    } catch (nextError) {
      setError(messageFor(nextError instanceof ApiError ? nextError : new ApiError("Sign in failed.")));
      setRoleSelectorVisible(false);
    } finally {
      setRolePending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <Screen contentContainerStyle={styles.content}>
          <View style={styles.brand}>
            <Image source={require("../../assets/logo.webp")} resizeMode="contain" style={styles.logo} />
          </View>

          <View style={styles.card}>
            <View style={styles.hero}>
              <View style={styles.heroIcon}><Ionicons color={colors.secondaryContainer} name="book-outline" size={26} /></View>
              <AppText style={styles.welcome} variant="heading">Welcome back to your learning portal</AppText>
              <AppText style={styles.subtitle} variant="label">Deep roots, endless growth.</AppText>
            </View>

            <View style={styles.form}>
              <AppText variant="label">Email or username</AppText>
              <View style={styles.inputWrap}>
                <Ionicons color={colors.outline} name="mail-outline" size={19} />
                <TextInput
                  autoCapitalize="none"
                  autoComplete="username"
                  keyboardType="email-address"
                  onChangeText={(value) => { setIdentifier(value); setError(""); }}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  placeholder="student@ash-shajrah.edu"
                  placeholderTextColor={colors.outline}
                  returnKeyType="next"
                  style={styles.input}
                  value={identifier}
                />
              </View>

              <AppText style={styles.passwordLabel} variant="label">Password</AppText>
              <View style={styles.inputWrap}>
                <Ionicons color={colors.outline} name="lock-closed-outline" size={19} />
                <TextInput
                  autoComplete="password"
                  onChangeText={(value) => { setPassword(value); setError(""); }}
                  onSubmitEditing={submit}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.outline}
                  ref={passwordRef}
                  returnKeyType="done"
                  secureTextEntry={!visible}
                  style={styles.input}
                  value={password}
                />
                <Pressable hitSlop={12} onPress={() => setVisible((current) => !current)}>
                  <Ionicons color={colors.onSurfaceVariant} name={visible ? "eye-off-outline" : "eye-outline"} size={20} />
                </Pressable>
              </View>

              {notice && !error ? <Pressable onPress={clearNotice} style={styles.notice}><Ionicons color={colors.secondary} name="time-outline" size={18} /><AppText style={styles.noticeText}>{notice}</AppText></Pressable> : null}
              {error ? <View style={styles.error}><Ionicons color={colors.error} name="alert-circle-outline" size={18} /><AppText style={styles.errorText}>{error}</AppText></View> : null}
              <PillButton icon={<Ionicons color={colors.white} name="log-in-outline" size={19} />} loading={pending} onPress={submit} style={styles.signInButton}>Sign In</PillButton>
              <View style={styles.secure}><Ionicons color={colors.outline} name="shield-checkmark-outline" size={15} /><AppText style={styles.secureText}>Secure access managed by Ash-Shajrah</AppText></View>
            </View>
          </View>
        </Screen>
      </KeyboardAvoidingView>

      <Modal animationType="fade" transparent visible={roleSelectorVisible}>
        {/* Multi-role accounts share one credential set, but only one portal
            should open per active session. This modal lets the user choose
            Teacher / Coordinator / etc before the session is finalized. */}
        <View style={styles.modalOverlay}>
          <View pointerEvents="none" style={styles.modalGlowLeft} />
          <View pointerEvents="none" style={styles.modalGlowRight} />
          <Pressable
            disabled={rolePending}
            onPress={() => {
              if (rolePending) return;
              setRoleSelectorVisible(false);
              setRoleOptions([]);
            }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderCopy}>
                <AppText style={styles.modalEyebrow}>Select your role</AppText>
                <AppText style={styles.modalTitle}>This account has multiple portals</AppText>
                <AppText style={styles.modalSubtitle}>Choose the role you want to continue with.</AppText>
              </View>
              <Pressable
                disabled={rolePending}
                onPress={() => {
                  if (rolePending) return;
                  setRoleSelectorVisible(false);
                  setRoleOptions([]);
                }}
                style={styles.closeButton}
              >
                <Ionicons color={colors.onSurfaceVariant} name="close" size={18} />
              </Pressable>
            </View>

            <View style={styles.roleList}>
              {roleOptions.map((role) => (
                <Pressable
                  key={role}
                  disabled={rolePending}
                  onPress={() => submitRole(role)}
                  style={styles.roleButton}
                >
                  {rolePending ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <AppText style={styles.roleButtonText}>
                      {String(role || "").replace(/^\w/, (c) => c.toUpperCase())}
                    </AppText>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { justifyContent: "center", paddingTop: space.xl, paddingBottom: space.xl },
  brand: { alignItems: "center", marginBottom: space.xl },
  logo: { width: 130, height: 116 },
  card: { overflow: "hidden", borderWidth: 1, borderColor: colors.borderGreen, borderRadius: radius["2xl"], backgroundColor: colors.surface, ...shadows.card },
  hero: { padding: space.xl, backgroundColor: colors.primaryContainer },
  heroIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginBottom: space.md, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.08)" },
  welcome: { color: colors.white },
  subtitle: { marginTop: space.xs, color: "#B9EEDB" },
  form: { padding: space.xl },
  passwordLabel: { marginTop: space.md },
  inputWrap: { minHeight: 52, flexDirection: "row", alignItems: "center", marginTop: space.sm, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  input: { flex: 1, paddingHorizontal: space.sm, color: colors.onSurface, fontFamily: fonts.body, fontSize: fontSize.sm },
  signInButton: { marginTop: space.md },
  error: { flexDirection: "row", alignItems: "center", marginBottom: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.errorContainer },
  errorText: { flex: 1, marginLeft: space.sm, color: colors.error, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs, lineHeight: 18 },
  notice: { flexDirection: "row", alignItems: "center", marginBottom: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldPale },
  noticeText: { flex: 1, marginLeft: space.sm, color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs, lineHeight: 18 },
  secure: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: space.lg },
  secureText: { marginLeft: space.xs, color: colors.outline, fontSize: 10 },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    backgroundColor: "rgba(248, 245, 236, 0.82)",
  },
  modalGlowLeft: {
    position: "absolute",
    left: -48,
    top: "26%",
    width: 208,
    height: 208,
    borderRadius: 999,
    backgroundColor: "rgba(45,138,106,0.16)",
  },
  modalGlowRight: {
    position: "absolute",
    right: -36,
    bottom: "28%",
    width: 176,
    height: 176,
    borderRadius: 999,
    backgroundColor: "rgba(201,162,39,0.12)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: space.xl,
    paddingTop: 22,
    paddingBottom: 24,
    ...shadows.modal,
  },
  modalHeaderRow: { flexDirection: "row", alignItems: "flex-start" },
  modalHeaderCopy: { flex: 1, paddingRight: space.md },
  modalEyebrow: {
    color: colors.textMuted,
    fontSize: fontSize["2xs"],
    letterSpacing: 2.6,
    textTransform: "uppercase",
    fontFamily: fonts.bodyBold,
  },
  modalTitle: {
    marginTop: 10,
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 19,
    lineHeight: 28,
  },
  modalSubtitle: {
    marginTop: 8,
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    lineHeight: 24,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radius.full,
    backgroundColor: "rgba(252,249,242,0.96)",
  },
  roleList: { marginTop: 24, gap: 12 },
  roleButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  roleButtonText: {
    color: colors.textSecondary,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
});
