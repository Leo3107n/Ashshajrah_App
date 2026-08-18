/**
 * Parent child selector. Multi-child parent screens reuse this dropdown so the
 * user can explicitly choose one child before child-specific schedules,
 * records, or messages are rendered.
 */
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "../../../components/ui";
import { colors, fonts, fontSize, radius, space } from "../../../theme";

export default function ChildDropdown({
  children = [],
  label = "Select Child",
  onChange,
  placeholder = "Select a child",
  selectedId = "",
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    const match = children.find((child) => child.id === selectedId);
    return match?.full_name || match?.name || "";
  }, [children, selectedId]);

  if (!children.length) return null;

  return (
    <>
      <AppText style={styles.label}>{label}</AppText>
      <Pressable onPress={() => setOpen(true)} style={styles.trigger}>
        <AppText numberOfLines={1} style={[styles.triggerText, !selectedLabel && styles.placeholder]}>
          {selectedLabel || placeholder}
        </AppText>
        <Ionicons color={colors.outline} name="chevron-down" size={18} />
      </Pressable>

      <Modal animationType="slide" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <AppText variant="heading">{label}</AppText>
              <Pressable accessibilityLabel="Close child selector" onPress={() => setOpen(false)}>
                <Ionicons color={colors.onSurfaceVariant} name="close" size={24} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.options} showsVerticalScrollIndicator={false}>
              {children.map((child) => {
                const active = child.id === selectedId;
                return (
                  <Pressable
                    key={child.id}
                    onPress={() => {
                      onChange?.(child.id);
                      setOpen(false);
                    }}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <View style={styles.optionCopy}>
                      <AppText style={[styles.optionTitle, active && styles.optionTitleActive]}>
                        {child.full_name || child.name}
                      </AppText>
                      {child.course_title || child.class_level ? (
                        <AppText style={[styles.optionMeta, active && styles.optionMetaActive]}>
                          {child.course_title || child.class_level}
                        </AppText>
                      ) : null}
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
    </>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: space.md, marginBottom: space.xs, color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1 },
  trigger: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, backgroundColor: colors.surface },
  triggerText: { flex: 1, marginRight: space.sm, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  placeholder: { color: colors.outline },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,35,28,0.48)" },
  sheet: { maxHeight: "72%", paddingTop: space.sm, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], backgroundColor: colors.background },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.outlineVariant },
  header: { flexDirection: "row", alignItems: "center", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.borderGreen },
  options: { padding: space.lg, gap: space.sm, paddingBottom: space["3xl"] },
  option: { flexDirection: "row", alignItems: "center", padding: space.md, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.xl, backgroundColor: colors.surface },
  optionActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  optionCopy: { flex: 1, marginRight: space.sm },
  optionTitle: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
  optionTitleActive: { color: colors.white },
  optionMeta: { marginTop: 2, color: colors.outline, fontSize: 10 },
  optionMetaActive: { color: "#D6E9E2" },
});
