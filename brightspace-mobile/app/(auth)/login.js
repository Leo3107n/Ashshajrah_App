import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError } from "../../src/api";
import { useAuth } from "../../src/context/AuthContext";
import {
  colors,
  fonts,
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  shadows,
  space,
} from "../../src/theme";

const EMPTY_ERRORS = {
  identifier: "",
  password: "",
  form: "",
};

function loginErrorMessage(error) {
  if (error?.code === "API_URL_NOT_CONFIGURED") return error.message;
  if (error?.code === "NETWORK_ERROR" || error?.code === "REQUEST_TIMEOUT") {
    return error.message;
  }
  if (error?.status === 401) {
    return "The email, phone, username, or password is incorrect.";
  }
  return "Sign in failed. Please try again.";
}

export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef(null);
  const { clearError, isAuthenticated, homeRoute, login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState(EMPTY_ERRORS);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (isAuthenticated) router.replace(homeRoute);
  }, [homeRoute, isAuthenticated, router]);

  function updateIdentifier(value) {
    setIdentifier(value);
    if (errors.identifier || errors.form) {
      setErrors((current) => ({
        ...current,
        identifier: "",
        form: "",
      }));
    }
  }

  function updatePassword(value) {
    setPassword(value);
    if (errors.password || errors.form) {
      setErrors((current) => ({
        ...current,
        password: "",
        form: "",
      }));
    }
  }

  async function handleSubmit() {
    if (pending) return;

    const nextErrors = {
      identifier: identifier.trim() ? "" : "Email, phone, or username is required.",
      password: password.trim() ? "" : "Password is required.",
      form: "",
    };

    if (nextErrors.identifier || nextErrors.password) {
      setErrors(nextErrors);
      return;
    }

    Keyboard.dismiss();
    setPending(true);
    setErrors(EMPTY_ERRORS);

    try {
      const result = await login({ identifier, password });
      router.replace(result.route);
    } catch (error) {
      const safeError =
        error instanceof ApiError
          ? error
          : new ApiError("Sign in failed.", { data: error });
      setErrors((current) => ({
        ...current,
        form: loginErrorMessage(safeError),
      }));
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboardView}
    >
      <View style={styles.background}>
        <View style={styles.greenGlow} />
        <View style={styles.goldGlow} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandPanel}>
          <View style={styles.brandHalo} />
          <View style={styles.brandHeader}>
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={require("../../assets/logo.webp")}
              style={styles.logo}
            />
            <View style={styles.brandTag}>
              <Text style={styles.brandTagText}>ASH-SHAJRAH LEARNING HUB</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>
            Welcome back to your academic portal
          </Text>
          <Text style={styles.heroBody}>
            Continue learning with a streamlined experience for lessons,
            attendance, fees, and student progress.
          </Text>

          <View style={styles.featureRow}>
            <View style={styles.featurePill}>
              <Ionicons color={colors.textGold} name="flash-outline" size={17} />
              <Text style={styles.featureText}>Live updates</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons
                color={colors.textGold}
                name="shield-checkmark-outline"
                size={17}
              />
              <Text style={styles.featureText}>Secure access</Text>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.accentBar}>
            <View style={styles.accentGold} />
            <View style={styles.accentGreen} />
          </View>

          <Text style={styles.eyebrow}>SECURE SIGN IN</Text>
          <Text style={styles.formTitle}>Sign in to your account</Text>
          <Text style={styles.formDescription}>
            Access your dashboard, lessons, and updates in one place.
          </Text>

          {errors.form ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.formError}
            >
              <Ionicons
                color={colors.roseText}
                name="alert-circle-outline"
                size={19}
              />
              <Text style={styles.formErrorText}>{errors.form}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL, PHONE, OR USERNAME</Text>
            <View
              style={[
                styles.inputShell,
                errors.identifier ? styles.inputShellError : null,
              ]}
            >
              <Ionicons
                color={colors.textSecondary}
                name="person-outline"
                size={20}
              />
              <TextInput
                accessibilityLabel="Email, phone, or username"
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                editable={!pending}
                enterKeyHint="next"
                keyboardType="email-address"
                onChangeText={updateIdentifier}
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholder="name@example.com or +92..."
                placeholderTextColor="rgba(36,92,79,0.55)"
                returnKeyType="next"
                style={styles.input}
                value={identifier}
              />
            </View>
            {errors.identifier ? (
              <Text style={styles.fieldError}>{errors.identifier}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <View
              style={[
                styles.inputShell,
                errors.password ? styles.inputShellError : null,
              ]}
            >
              <Ionicons
                color={colors.textSecondary}
                name="lock-closed-outline"
                size={20}
              />
              <TextInput
                ref={passwordRef}
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!pending}
                enterKeyHint="go"
                onChangeText={updatePassword}
                onSubmitEditing={handleSubmit}
                placeholder="Enter your password"
                placeholderTextColor="rgba(36,92,79,0.55)"
                returnKeyType="go"
                secureTextEntry={!showPassword}
                style={styles.input}
                value={password}
              />
              <Pressable
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setShowPassword((current) => !current)}
                style={styles.eyeButton}
              >
                <Ionicons
                  color={colors.textSecondary}
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                />
              </Pressable>
            </View>
            {errors.password ? (
              <Text style={styles.fieldError}>{errors.password}</Text>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.signInButton,
              pressed && !pending ? styles.signInButtonPressed : null,
              pending ? styles.signInButtonDisabled : null,
            ]}
          >
            {pending ? (
              <>
                <ActivityIndicator color={colors.textOnDark} size="small" />
                <Text style={styles.signInText}>Signing in...</Text>
              </>
            ) : (
              <>
                <Text style={styles.signInText}>Sign in</Text>
                <Ionicons
                  color={colors.textOnDark}
                  name="arrow-forward"
                  size={19}
                />
              </>
            )}
          </Pressable>

          <View style={styles.securityNote}>
            <Ionicons
              color={colors.emeraldLight}
              name="lock-closed"
              size={14}
            />
            <Text style={styles.securityNoteText}>
              Your credentials are sent securely to Ash-Shajrah.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  greenGlow: {
    position: "absolute",
    left: -90,
    top: 50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(45,138,106,0.10)",
  },
  goldGlow: {
    position: "absolute",
    right: -110,
    bottom: 20,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(201,162,39,0.09)",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: space.base,
    paddingVertical: space.xl,
  },
  brandPanel: {
    position: "relative",
    overflow: "hidden",
    minHeight: 330,
    padding: space.xl,
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    backgroundColor: colors.emeraldDark,
  },
  brandHalo: {
    position: "absolute",
    right: -75,
    top: -85,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(201,162,39,0.16)",
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
  },
  brandTag: {
    flexShrink: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: space.md,
    paddingVertical: 7,
  },
  brandTagText: {
    color: colors.textGold,
    fontSize: fontSize["2xs"],
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.wide,
  },
  heroTitle: {
    maxWidth: 430,
    marginTop: space.xl,
    color: colors.textOnDark,
    fontFamily: fonts.display,
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
    lineHeight: 36,
  },
  heroBody: {
    maxWidth: 440,
    marginTop: space.md,
    color: "rgba(243,238,219,0.82)",
    fontSize: fontSize.sm,
    lineHeight: 21,
  },
  featureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.xl,
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: space.md,
    paddingVertical: 9,
  },
  featureText: {
    color: colors.textGoldDim,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  formCard: {
    position: "relative",
    overflow: "hidden",
    padding: space.xl,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.borderDark,
    borderBottomLeftRadius: radius["3xl"],
    borderBottomRightRadius: radius["3xl"],
    backgroundColor: colors.parchmentLight,
    ...shadows.card,
  },
  accentBar: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    height: 4,
    flexDirection: "row",
  },
  accentGold: {
    flex: 1,
    backgroundColor: colors.gold,
  },
  accentGreen: {
    flex: 1,
    backgroundColor: colors.emeraldLight,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.brand,
  },
  formTitle: {
    marginTop: space.md,
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    lineHeight: 30,
  },
  formDescription: {
    marginTop: space.sm,
    marginBottom: space.lg,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 21,
  },
  formError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    marginBottom: space.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.roseBorder,
    borderRadius: radius.md,
    backgroundColor: colors.roseBg,
  },
  formErrorText: {
    flex: 1,
    color: colors.roseText,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  field: {
    marginBottom: space.lg,
  },
  label: {
    marginBottom: space.sm,
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.wider,
  },
  inputShell: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  inputShellError: {
    borderColor: colors.roseBorder,
    backgroundColor: colors.roseBg,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 0,
    color: colors.textPrimary,
    fontSize: fontSize.base,
  },
  eyeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -10,
  },
  fieldError: {
    marginTop: 6,
    color: colors.roseText,
    fontSize: fontSize.sm,
  },
  signInButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.full,
    backgroundColor: colors.emerald,
    ...shadows.button,
  },
  signInButtonPressed: {
    backgroundColor: colors.emeraldDark,
    transform: [{ scale: 0.99 }],
  },
  signInButtonDisabled: {
    opacity: 0.68,
  },
  signInText: {
    color: colors.textOnDark,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: space.lg,
  },
  securityNoteText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
});
