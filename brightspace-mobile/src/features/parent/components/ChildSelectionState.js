/**
 * Shared empty-state card for multi-child parent screens that now require an
 * explicit child selection before child-specific records are shown.
 */
import { Ionicons } from "@expo/vector-icons";
import { AppText, SurfaceCard } from "../../../components/ui";
import { colors, fonts, fontSize, space } from "../../../theme";

export default function ChildSelectionState({ message }) {
  return (
    <SurfaceCard style={styles.state}>
      <Ionicons color={colors.secondary} name="chevron-down-circle-outline" size={30} />
      <AppText style={styles.stateTitle}>Select a child</AppText>
      <AppText style={styles.stateText}>{message}</AppText>
    </SurfaceCard>
  );
}

const styles = {
  state: { alignItems: "center", paddingVertical: space.xl, marginTop: space.lg },
  stateTitle: { marginTop: space.sm, color: colors.primary, fontFamily: fonts.bodyBold },
  stateText: { marginTop: 3, color: colors.outline, fontSize: fontSize.xs, textAlign: "center" },
};
