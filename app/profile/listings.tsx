import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, FlatList, Modal, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import {
  KText, KVStack, KRow, KPressable, VehicleCardCompact,
  CardAction, CardRibbon, createStyles,
} from "../../src/ui";
import { skeletonPulse, haptic } from "../../src/theme";
import { showErrorToast, showSuccessToast } from "../../src/presentation/components/Toast";

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function ListingSkeleton() {
  const { colors } = useSkelStyles();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => { skeletonPulse(p).start(); }, []);
  const op = p.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const B = ({ w, h, r = 10, style: st }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity: op }, st]} />
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <KRow gap={8}><B w={40} h={40} r={12} /><B w="50%" h={18} /></KRow>
        {[0, 1, 2].map((i) => (
          <KRow key={i} gap={12} style={{ marginTop: 12, backgroundColor: colors.card, borderRadius: 14, padding: 10 }}>
            <B w={76} h={76} r={10} />
            <KVStack style={{ flex: 1, gap: 6 }}><B w="65%" h={13} /><B w="45%" h={11} /><B w="40%" h={11} /></KVStack>
          </KRow>
        ))}
      </View>
    </SafeAreaView>
  );
}
const useSkelStyles = createStyles((c) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// Bottom Sheet Menu
// ═══════════════════════════════════════════════════════
interface MenuOption {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  destructive?: boolean;
  onPress: () => void;
}

function ActionMenu({ visible, title, options, onClose }: {
  visible: boolean; title: string; options: MenuOption[]; onClose: () => void;
}) {
  const { styles: ms, colors, isDark } = useMenuStyles();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ms.backdrop} onPress={onClose}>
        <View onStartShouldSetResponder={() => true} style={ms.sheet}>
          {/* Handle */}
          <View style={ms.handle} />

          {/* Title */}
          <KText variant="label" bold center style={{ fontSize: 16, marginBottom: 16 }}>{title}</KText>

          {/* Options */}
          {options.map((opt, i) => (
            <KPressable
              key={i}
              onPress={() => { onClose(); setTimeout(opt.onPress, 300); }}
              style={[ms.option, i < options.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)" }]}
            >
              <View style={[ms.optionIcon, { backgroundColor: opt.destructive ? (isDark ? "rgba(239,68,68,0.12)" : "#FEF2F2") : (isDark ? colors.bgTertiary : "#F3F4F6") }]}>
                <Ionicons name={opt.icon} size={18} color={opt.color ?? colors.text} />
              </View>
              <KText variant="label" style={{ flex: 1, color: opt.color ?? colors.text }}>{opt.label}</KText>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </KPressable>
          ))}

          {/* Cancel */}
          <KPressable onPress={onClose} style={ms.cancelBtn}>
            <KText variant="label" bold center style={{ color: colors.textSecondary }}>Annuler</KText>
          </KPressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const useMenuStyles = createStyles((colors, isDark) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 8, paddingBottom: 40, paddingHorizontal: 20,
  },
  handle: {
    alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 16,
    backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
  },
  option: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14,
  },
  optionIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  cancelBtn: {
    marginTop: 12, paddingVertical: 14, borderRadius: 14,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
  },
}));

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function MyListings() {
  const { styles: s, colors, isDark } = useStyles();
  const data = useQuery(api.vehicles.listMyListingsWithRequestCount, {});
  const deactivate = useMutation(api.vehicles.deactivateVehicle);
  const reactivate = useMutation(api.vehicles.reactivateVehicle);
  const deleteMut = useMutation(api.vehicles.deleteVehicle);

  const [menuVehicle, setMenuVehicle] = useState<any>(null);

  const countText = useMemo(() => {
    if (!data) return "";
    return `${data.length} annonce${data.length > 1 ? "s" : ""}`;
  }, [data?.length]);

  if (data === undefined) return <ListingSkeleton />;

  const onDeactivate = (vehicleId: any) => {
    Alert.alert("Désactiver l'annonce ?", "Elle ne sera plus visible. Tu pourras la réactiver.", [
      { text: "Annuler", style: "cancel" },
      { text: "Désactiver", style: "destructive", onPress: async () => {
        haptic.medium();
        try { await deactivate({ vehicleId }); showSuccessToast("Annonce désactivée"); }
        catch (e) { showErrorToast(e); }
      }},
    ]);
  };
  const onReactivate = async (vehicleId: any) => {
    haptic.medium();
    try { await reactivate({ vehicleId }); showSuccessToast("Annonce réactivée"); }
    catch (e) { showErrorToast(e); }
  };
  const onDelete = (vehicleId: any) => {
    Alert.alert(
      "Supprimer définitivement ?",
      "L'annonce et toutes ses photos seront supprimées. Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: async () => {
          haptic.medium();
          try { await deleteMut({ vehicleId }); showSuccessToast("Annonce supprimée"); }
          catch (e) { showErrorToast(e); }
        }},
      ],
    );
  };

  const menuOptions: MenuOption[] = menuVehicle ? [
    {
      label: "Modifier l'annonce",
      icon: "create-outline",
      onPress: () => router.push(`/profile/edit-vehicle/${String(menuVehicle._id)}`),
    },
    {
      label: "Gérer le calendrier",
      icon: "calendar-outline",
      onPress: () => router.push(`/profile/availability/${String(menuVehicle._id)}`),
    },
    menuVehicle.isActive !== false
      ? { label: "Désactiver l'annonce", icon: "pause-circle-outline" as keyof typeof Ionicons.glyphMap, onPress: () => onDeactivate(menuVehicle._id) }
      : { label: "Réactiver l'annonce", icon: "play-circle-outline" as keyof typeof Ionicons.glyphMap, color: "#059669", onPress: () => onReactivate(menuVehicle._id) },
    {
      label: "Supprimer l'annonce",
      icon: "trash-outline",
      color: "#EF4444",
      destructive: true,
      onPress: () => onDelete(menuVehicle._id),
    },
  ] : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <KRow gap={8} style={s.header}>
        <KPressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <View style={{ flex: 1 }}>
          <KText variant="label" bold style={{ fontSize: 17 }}>Mes annonces</KText>
          {countText ? <KText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>{countText}</KText> : null}
        </View>
        {data.length > 0 && (
          <KPressable onPress={() => router.push("/(tabs)/publish")} style={s.addBtn}>
            <Ionicons name="add" size={22} color={colors.primary} />
          </KPressable>
        )}
      </KRow>

      {data.length === 0 ? (
        <KVStack align="center" style={{ paddingTop: 64, paddingHorizontal: 32, gap: 16 }}>
          <View style={s.emptyIcon}>
            <Ionicons name="car-sport-outline" size={28} color={colors.primary} />
          </View>
          <KText variant="label" bold center style={{ fontSize: 17 }}>Aucune annonce publiée</KText>
          <KText variant="bodySmall" color="textSecondary" center style={{ lineHeight: 20, maxWidth: 260 }}>
            Publie ton véhicule et commence à gagner dès cette semaine.
          </KText>
          <KPressable onPress={() => router.push("/(tabs)/publish")} style={s.primaryBtn}>
            <KText variant="label" bold style={{ color: "#FFF" }}>Publier un véhicule</KText>
          </KPressable>
        </KVStack>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item: any) => String(item.vehicle._id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: any) => {
            const v = item.vehicle;
            const isActive = v.isActive !== false;
            const reqCount = item.requestCount ?? 0;

            return (
              <VehicleCardCompact
                coverUrl={v.coverUrl}
                title={v.title || "Annonce"}
                photoCount={v.imageUrls?.length ?? 0}
                inactive={!isActive}
                subtitle={v.city || "—"}
                priceLabel={`${v.pricePerDay} MAD/jour`}
                statusLine={isActive ? "Active · en ligne" : "Désactivée"}
                statusLineColor={isActive ? "#059669" : "#DC2626"}
                onPress={() => router.push(`/profile/listings/${String(v._id)}`)}
                ribbons={
                  reqCount > 0 ? (
                    <KRow gap={8}>
                      <CardRibbon label={`${reqCount} demande${reqCount > 1 ? "s" : ""}`} icon="mail-unread" color="#D97706" bg={isDark ? "rgba(245,158,11,0.12)" : "#FEF3C7"} />
                    </KRow>
                  ) : undefined
                }
                actions={
                  <KRow gap={8} style={{ alignItems: "center" }}>
                    <CardAction label="Voir" icon="eye-outline" variant="primary" onPress={() => router.push(`/vehicle/${String(v._id)}`)} />
                    <CardAction icon="ellipsis-horizontal" variant="secondary" onPress={() => { haptic.light(); setMenuVehicle(v); }} />
                  </KRow>
                }
              />
            );
          }}
        />
      )}

      {/* ── Bottom Sheet Menu ── */}
      <ActionMenu
        visible={!!menuVehicle}
        title={menuVehicle?.title || "Annonce"}
        options={menuOptions}
        onClose={() => setMenuVehicle(null)}
      />
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  header: { alignItems: "center", paddingHorizontal: 16, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", alignItems: "center", justifyContent: "center" },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA", alignItems: "center", justifyContent: "center" },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, marginTop: 8 },
}));
