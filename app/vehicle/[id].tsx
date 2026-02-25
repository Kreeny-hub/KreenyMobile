import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { ensureAuth } from "../../src/presentation/utils/ensureAuth";
import { useTheme, radius, shadows } from "../../src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_WIDTH * 0.75;

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════
function KeyValue({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <Text style={{ fontWeight: "600", color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ fontWeight: "800", color: colors.text, fontSize: 14 }}>{value}</Text>
    </View>
  );
}

function InfoRow({ icon, title, value, subtitle, colors }: any) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={{
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: colors.primaryLight,
        alignItems: "center", justifyContent: "center", marginTop: 2,
      }}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "600", color: colors.textSecondary, fontSize: 12 }}>{title}</Text>
        <Text style={{ fontWeight: "700", color: colors.text, fontSize: 14, marginTop: 3 }}>{value}</Text>
        {subtitle && (
          <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{subtitle}</Text>
        )}
      </View>
    </View>
  );
}

function MiniListItem({ icon, text, colors }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={{ fontWeight: "600", color: colors.text, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Card wrapper
// ═══════════════════════════════════════════════════════
function Card({ children, colors, isDark, style }: any) {
  return (
    <View style={[{
      marginTop: 14,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: isDark ? 1 : 1,
      borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
    }, style]}>
      {children}
    </View>
  );
}

function CardTitle({ children, colors }: any) {
  return (
    <Text style={{ fontWeight: "800", color: colors.text, fontSize: 15, marginBottom: 12 }}>
      {children}
    </Text>
  );
}

// ═══════════════════════════════════════════════════════
// Image Carousel with overlay buttons
// ═══════════════════════════════════════════════════════
function ImageCarousel({ images, colors, isDark }: { images: string[]; colors: any; isDark: boolean }) {
  const [currentPage, setCurrentPage] = useState(0);

  return (
    <View style={{ position: "relative" }}>
      {images.length > 0 ? (
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, idx) => `${item}-${idx}`}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT, backgroundColor: colors.bgTertiary }}
              resizeMode="cover"
            />
          )}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCurrentPage(idx);
          }}
        />
      ) : (
        <View style={{
          width: SCREEN_WIDTH, height: IMAGE_HEIGHT * 0.7,
          alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          {/* Soft gradient background via layered views */}
          <View style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
          }} />
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: isDark ? colors.bgSecondary : "rgba(255,255,255,0.8)",
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="camera-outline" size={30} color={isDark ? colors.textTertiary : "#94A3B8"} />
          </View>
          <Text style={{ fontWeight: "600", color: isDark ? colors.textTertiary : "#94A3B8", fontSize: 14 }}>
            Photos bientôt disponibles
          </Text>
        </View>
      )}

      {/* Overlay top - placeholder for future heart/share */}
      {images.length > 0 && (
        <View style={{
          position: "absolute",
          top: 8,
          right: 14,
          zIndex: 10,
        }}>
          {/* Future: heart / share buttons */}
        </View>
      )}

      {/* Photo counter */}
      {images.length > 1 && (
        <View style={{
          position: "absolute", bottom: 12, right: 16,
          backgroundColor: "rgba(0,0,0,0.55)",
          borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
          flexDirection: "row", alignItems: "center", gap: 5,
        }}>
          <Ionicons name="images-outline" size={13} color="#FFF" />
          <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>
            {currentPage + 1}/{images.length}
          </Text>
        </View>
      )}

      {/* Dots */}
      {images.length > 1 && images.length <= 8 && (
        <View style={{
          position: "absolute", bottom: 12, left: 0, right: 0,
          flexDirection: "row", justifyContent: "center", gap: 6,
        }}>
          {images.map((_, i) => (
            <View key={i} style={{
              width: 6, height: 6, borderRadius: 3,
              backgroundColor: i === currentPage ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)",
            }} />
          ))}
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Owner Card
// ═══════════════════════════════════════════════════════
function OwnerCard({ ownerUserId, colors, isDark }: any) {
  const profile = useQuery(
    api.userProfiles.getProfileByUserId,
    ownerUserId ? { userId: ownerUserId } : "skip"
  );
  const avatarUrl = useQuery(
    api.files.getUrl,
    profile?.avatarStorageId ? { storageId: profile.avatarStorageId } : "skip"
  );

  if (!ownerUserId || profile === undefined) return null;

  const name = profile?.displayName || "Propriétaire";
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  return (
    <Pressable style={{
      flexDirection: "row", alignItems: "center", gap: 12,
    }}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{
          width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bgTertiary,
        }} />
      ) : (
        <View style={{
          width: 48, height: 48, borderRadius: 24,
          backgroundColor: colors.primaryLight,
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="person" size={20} color={colors.primary} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{name}</Text>
        {memberSince && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            Membre depuis {memberSince}
          </Text>
        )}
      </View>

      {/* Contact button */}
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.bgTertiary,
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
      </View>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════════
function DetailSkeleton() {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const Box = ({ w, h, r = 8, style }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Box w={SCREEN_WIDTH} h={IMAGE_HEIGHT} r={0} />
      <View style={{ padding: 18, gap: 14 }}>
        <Box w="75%" h={28} />
        <Box w="50%" h={18} />
        <Box w="35%" h={24} />
        <Box w="100%" h={80} r={18} style={{ marginTop: 8 }} />
        <Box w="100%" h={100} r={18} />
        <Box w="100%" h={80} r={18} />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function VehicleDetails() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated } = useAuthStatus();

  const vehicle = useQuery(
    api.vehicles.getVehicleWithImages,
    id ? { id: id as any } : "skip"
  );

  if (!id) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 18 }}>
        <Text style={{ color: colors.text }}>Véhicule introuvable</Text>
      </SafeAreaView>
    );
  }

  if (vehicle === undefined) return <DetailSkeleton />;

  if (vehicle === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Annonce introuvable</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontWeight: "700" }}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const images = vehicle.resolvedImageUrls;
  const price = vehicle.pricePerDay;
  const deposit = vehicle.depositSelected || 0;
  const hasDeposit = deposit > 0;

  const onReserve = () => {
    if (!ensureAuth(isAuthenticated)) return;
    router.push(`/reservation/${id}`);
  };

  const bottomPad = Math.max(insets.bottom, 12) + 96;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
        {/* ── Images with overlay back button ── */}
        <ImageCarousel images={images} colors={colors} isDark={isDark} />

        <View style={{ padding: 18 }}>
          {/* ── Title ── */}
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text, lineHeight: 30, letterSpacing: -0.3 }}>
            {vehicle.title}
          </Text>

          {/* ── Price row ── */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>
              {price} MAD
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary, marginBottom: 2 }}> / jour</Text>
          </View>

          {/* ── Sub row: city ── */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={{ fontWeight: "600", fontSize: 13, color: colors.textSecondary }}>
              {vehicle.city || "Ville non renseignée"}
            </Text>
          </View>

          {/* ══════════════════════════════════ */}
          {/* Card: Propriétaire                */}
          {/* ══════════════════════════════════ */}
          <Card colors={colors} isDark={isDark}>
            <CardTitle colors={colors}>Propriétaire</CardTitle>
            <OwnerCard ownerUserId={vehicle.ownerUserId} colors={colors} isDark={isDark} />
          </Card>

          {/* ══════════════════════════════════ */}
          {/* Card: Tarif                       */}
          {/* ══════════════════════════════════ */}
          <Card colors={colors} isDark={isDark}>
            <CardTitle colors={colors}>Tarif</CardTitle>

            <KeyValue label="Prix / jour" value={`${price} MAD`} colors={colors} />
            <KeyValue label="Caution" value={hasDeposit ? `${deposit} MAD` : "Non définie"} colors={colors} />

            {vehicle.depositMin && vehicle.depositMax && vehicle.depositMin !== vehicle.depositMax && (
              <KeyValue
                label="Fourchette caution"
                value={`${vehicle.depositMin} à ${vehicle.depositMax} MAD`}
                colors={colors}
              />
            )}

            <View style={{ height: 1, backgroundColor: isDark ? colors.border : "#EFEFEF", marginTop: 4, marginBottom: 10 }} />
            <Text style={{ color: colors.textTertiary, lineHeight: 18, fontSize: 13 }}>
              La caution est une empreinte bancaire non débitée, libérée après restitution du véhicule.
            </Text>
          </Card>

          {/* ══════════════════════════════════ */}
          {/* Card: Règles & conditions         */}
          {/* ══════════════════════════════════ */}
          <Card colors={colors} isDark={isDark}>
            <CardTitle colors={colors}>Règles & conditions</CardTitle>
            <Text style={{ color: colors.textTertiary, lineHeight: 18, fontSize: 13, marginBottom: 8 }}>
              Quelques règles simples pour une expérience fluide.
            </Text>

            <View style={{
              backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8",
              borderRadius: 16, padding: 12,
            }}>
              <MiniListItem icon="sparkles" text="Rendre le véhicule propre" colors={colors} />
              <MiniListItem icon="water" text="Même niveau de carburant au retour" colors={colors} />
              <MiniListItem icon="time" text="Prévenir en cas de retard" colors={colors} />
              <MiniListItem icon="ban-outline" text="Pas de sous-location" colors={colors} />
            </View>
          </Card>

          {/* ══════════════════════════════════ */}
          {/* Card: Assurance & protection      */}
          {/* ══════════════════════════════════ */}
          <Card colors={colors} isDark={isDark}>
            <CardTitle colors={colors}>Assurance & protection</CardTitle>
            <Text style={{ color: colors.textTertiary, lineHeight: 18, fontSize: 13, marginBottom: 8 }}>
              Bonnes pratiques pour une location sereine.
            </Text>

            <View style={{
              backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8",
              borderRadius: 16, padding: 12,
            }}>
              <MiniListItem icon="shield-checkmark" text="Constat photo avant départ (9 angles)" colors={colors} />
              <MiniListItem icon="camera" text="Constat photo au retour recommandé" colors={colors} />
              <MiniListItem icon="card-outline" text="Paiement sécurisé via la plateforme" colors={colors} />
              <MiniListItem icon="chatbubble-outline" text="Échangez via la messagerie intégrée" colors={colors} />
            </View>
          </Card>

          {/* ══════════════════════════════════ */}
          {/* Card: Comment ça marche           */}
          {/* ══════════════════════════════════ */}
          <Card colors={colors} isDark={isDark}>
            <CardTitle colors={colors}>Comment ça marche</CardTitle>

            <View style={{ gap: 16 }}>
              {[
                { step: "1", icon: "calendar-outline", title: "Réservez", desc: "Choisissez vos dates et envoyez une demande au propriétaire" },
                { step: "2", icon: "card-outline", title: "Payez en ligne", desc: "Paiement sécurisé, la caution est une empreinte non débitée" },
                { step: "3", icon: "camera-outline", title: "Constat départ", desc: "Prenez 9 photos du véhicule au retrait, validées par les 2 parties" },
                { step: "4", icon: "car-outline", title: "Profitez !", desc: "Le véhicule est à vous pour la durée de la location" },
              ].map((item) => (
                <View key={item.step} style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: colors.primaryLight,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>{item.step}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{item.title}</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 }}>
                      {item.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>

          {/* ══════════════════════════════════ */}
          {/* Hint box                          */}
          {/* ══════════════════════════════════ */}
          <View style={{
            marginTop: 14,
            backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8",
            borderRadius: 14, padding: 12,
            flexDirection: "row", gap: 10, alignItems: "center",
          }}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={{ flex: 1, fontWeight: "600", color: colors.textSecondary, lineHeight: 18, fontSize: 13 }}>
              Respecte les règles du loueur et rends le véhicule propre et avec le plein si demandé.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ══════════════════════════════════ */}
      {/* Sticky booking bar               */}
      {/* ══════════════════════════════════ */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
        paddingHorizontal: 18, paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 12),
        flexDirection: "row", alignItems: "center", gap: 16,
        ...(!isDark ? { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12 } : {}),
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600", color: colors.textSecondary, fontSize: 12 }}>À partir de</Text>
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 17, marginTop: 3 }}>
            {price} MAD <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textSecondary }}>/ jour</Text>
          </Text>
        </View>

        <Pressable
          onPress={onReserve}
          style={({ pressed }) => ({
            height: 48,
            paddingHorizontal: 24,
            borderRadius: 16,
            backgroundColor: colors.primary,
            alignItems: "center", justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Réserver</Text>
        </Pressable>
      </View>
    </View>
  );
}
