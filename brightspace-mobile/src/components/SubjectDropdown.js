/**
 * Shared subject selector used anywhere the app needs a single subject choice.
 * It replaces horizontal subject chip rails with a consistent dropdown modal.
 */
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors, fonts, fontSize, radius, shadows, space } from "../theme";
import { AppText, SurfaceCard } from "./ui";

function subjectKey(item, index) {
  return String(item?.id ?? item?.key ?? item?.value ?? item?.name ?? item?.label ?? index);
}

function subjectLabel(item) {
  return String(item?.name ?? item?.label ?? item?.title ?? item?.subject_name ?? "Subject");
}

export default function SubjectDropdown({
  allLabel = "All Subjects",
  allowAll = true,
  disabled = false,
  emptyText = "No subjects are available.",
  label = "SUBJECT",
  onChange,
  options = [],
  placeholder = "Choose a subject",
  selectedId = "",
}) {
  const [open, setOpen] = useState(false);
  const normalizedOptions = useMemo(
    () =>
      (Array.isArray(options) ? options : []).map((item, index) => ({
        id: subjectKey(item, index),
        label: subjectLabel(item),
        raw: item,
      })),
    [options]
  );
  const selected = normalizedOptions.find((item) => item.id === selectedId);
  const selectedText = selected ? selected.label : allowAll && !selectedId ? allLabel : placeholder;

  function choose(value) {
    onChange?.(value);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.dropdown, disabled && styles.dropdownDisabled]}
      >
        <View style={styles.copy}>
          <AppText style={styles.label}>{label}</AppText>
          <AppText
            numberOfLines={1}
            style={[styles.value, !selected && selectedId && styles.placeholder]}
          >
            {selectedText}
          </AppText>
        </View>
        <Ionicons color={colors.outline} name="chevron-down-outline" size={22} />
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <View style={styles.overlay}>
          <Pressable onPress={() => setOpen(false)} style={styles.backdrop} />
          <SurfaceCard style={styles.sheet}>
            <View style={styles.header}>
              <View>
                <AppText style={styles.eyebrow}>FILTER</AppText>
                <AppText variant="heading">Select Subject</AppText>
              </View>
              <Pressable accessibilityLabel="Close subject selector" onPress={() => setOpen(false)}>
                <Ionicons color={colors.onSurfaceVariant} name="close" size={24} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.list}>
              {allowAll ? (
                <Option active={!selectedId} label={allLabel} onPress={() => choose("")} />
              ) : null}
              {normalizedOptions.length ? (
                normalizedOptions.map((item) => (
                  <Option
                    active={selectedId === item.id}
                    key={item.id}
                    label={item.label}
                    onPress={() => choose(item.id)}
                  />
                ))
              ) : (
                <View style={styles.empty}>
                  <Ionicons color={colors.outline} name="book-outline" size={28} />
                  <AppText style={styles.emptyText}>{emptyText}</AppText>
                </View>
              )}
            </ScrollView>
          </SurfaceCard>
        </View>
      </Modal>
    </>
  );
}

function Option({ active, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.option, active && styles.optionActive]}>
      <AppText numberOfLines={1} style={[styles.optionText, active && styles.optionTextActive]}>
        {label}
      </AppText>
      {active ? <Ionicons color={colors.white} name="checkmark-circle" size={20} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  dropdownDisabled: { opacity: 0.55 },
  copy: { flex: 1 },
  label: { color: colors.outline, fontFamily: fonts.bodyBold, fontSize: 8, textTransform: "uppercase" },
  value: { marginTop: 3, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  placeholder: { color: colors.outline },
  overlay: { flex: 1, justifyContent: "center", padding: space.lg, backgroundColor: "rgba(2,35,28,0.45)" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { maxHeight: "72%", padding: space.lg, ...shadows.modal },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: space.md },
  eyebrow: { color: colors.secondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  list: { gap: space.sm },
  option: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceLow,
  },
  optionActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  optionText: { flex: 1, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  optionTextActive: { color: colors.white },
  empty: { alignItems: "center", paddingVertical: space.xl },
  emptyText: { marginTop: space.sm, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
});
