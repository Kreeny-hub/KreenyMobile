import { Modal, Pressable, View, type ViewStyle } from "react-native";
import { KText } from "../primitives/KText";
import { useTheme, spacing } from "../../theme";

interface KBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Optional title */
  title?: string;
  children: React.ReactNode;
  /** Extra content style */
  style?: ViewStyle;
}

export function KBottomSheet({
  visible,
  onClose,
  title,
  children,
  style,
}: KBottomSheetProps) {
  const { colors, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <View
          onStartShouldSetResponder={() => true}
          style={[
            {
              backgroundColor: colors.bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: spacing.sm,
              paddingBottom: 40,
              paddingHorizontal: spacing.xl,
            },
            style,
          ]}
        >
          {/* Drag handle */}
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
              marginBottom: spacing.xl,
            }}
          />

          {title && (
            <KText variant="h2" bold style={{ marginBottom: spacing.xl }}>
              {title}
            </KText>
          )}

          {children}
        </View>
      </Pressable>
    </Modal>
  );
}
