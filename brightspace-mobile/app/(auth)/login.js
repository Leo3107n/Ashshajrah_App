import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
  const { clearError, homeRoute, isAuthenticated, login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

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
      const result = await login({ identifier, password });
      router.replace(result.route);
    } catch (nextError) {
      setError(messageFor(nextError instanceof ApiError ? nextError : new ApiError("Sign in failed.")));
    } finally {
      setPending(false);
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

              <Pressable style={styles.forgot}><AppText style={styles.forgotText}>Forgot Password?</AppText></Pressable>
              {error ? <View style={styles.error}><Ionicons color={colors.error} name="alert-circle-outline" size={18} /><AppText style={styles.errorText}>{error}</AppText></View> : null}
              <PillButton icon={<Ionicons color={colors.white} name="log-in-outline" size={19} />} loading={pending} onPress={submit}>Sign In</PillButton>
              <View style={styles.secure}><Ionicons color={colors.outline} name="shield-checkmark-outline" size={15} /><AppText style={styles.secureText}>Secure access managed by Ash-Shajrah</AppText></View>
            </View>
          </View>
        </Screen>
      </KeyboardAvoidingView>
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
  forgot: { alignSelf: "flex-end", paddingVertical: space.md },
  forgotText: { color: colors.secondary, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs },
  error: { flexDirection: "row", alignItems: "center", marginBottom: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.errorContainer },
  errorText: { flex: 1, marginLeft: space.sm, color: colors.error, fontFamily: fonts.bodySemibold, fontSize: fontSize.xs, lineHeight: 18 },
  secure: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: space.lg },
  secureText: { marginLeft: space.xs, color: colors.outline, fontSize: 10 },
});
