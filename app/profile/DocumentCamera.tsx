import { useCallback, useRef, useState } from "react";
import {
  View, Pressable, Image, Dimensions, StatusBar,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { KText, KRow, KVStack, KPressable, createStyles } from "../../src/ui";
import { haptic } from "../../src/theme/haptics";

const { width: SW, height: SH } = Dimensions.get("window");

// Card ratio ≈ ISO/IEC 7810 ID-1 (3.375 × 2.125 in = ~1.586)
const CARD_RATIO = 1.586;
const CARD_W = SW * 0.82;
const CARD_H = CARD_W / CARD_RATIO;
const CARD_X = (SW - CARD_W) / 2;
const CARD_Y = (SH - CARD_H) / 2 - 40; // slightly above center

const CORNER_SIZE = 24;
const CORNER_THICK = 3;
const CORNER_COLOR = "#FFF";

// ══════════════════════════════════════════════════════════
// Corner brackets (4 corners of the card guide)
// ══════════════════════════════════════════════════════════
function CornerBrackets() {
  const c = (top: number, left: number, bTop?: boolean, bBottom?: boolean, bLeft?: boolean, bRight?: boolean) => (
    <View
      style={{
        position: "absolute", top, left,
        width: CORNER_SIZE, height: CORNER_SIZE,
        borderColor: CORNER_COLOR,
        borderTopWidth: bTop ? CORNER_THICK : 0,
        borderBottomWidth: bBottom ? CORNER_THICK : 0,
        borderLeftWidth: bLeft ? CORNER_THICK : 0,
        borderRightWidth: bRight ? CORNER_THICK : 0,
        borderTopLeftRadius: bTop && bLeft ? 8 : 0,
        borderTopRightRadius: bTop && bRight ? 8 : 0,
        borderBottomLeftRadius: bBottom && bLeft ? 8 : 0,
        borderBottomRightRadius: bBottom && bRight ? 8 : 0,
      }}
    />
  );
  return (
    <>
      {c(CARD_Y, CARD_X, true, false, true, false)}
      {c(CARD_Y, CARD_X + CARD_W - CORNER_SIZE, true, false, false, true)}
      {c(CARD_Y + CARD_H - CORNER_SIZE, CARD_X, false, true, true, false)}
      {c(CARD_Y + CARD_H - CORNER_SIZE, CARD_X + CARD_W - CORNER_SIZE, false, true, false, true)}
    </>
  );
}

// ══════════════════════════════════════════════════════════
// Dark overlay with transparent card cutout
// ══════════════════════════════════════════════════════════
function Overlay({ title, subtitle }: { title: string; subtitle: string }) {
  const BG = "rgba(0,0,0,0.55)";
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top */}
      <View style={{ width: SW, height: CARD_Y, backgroundColor: BG }} />
      {/* Middle row: left + transparent center + right */}
      <View style={{ flexDirection: "row", height: CARD_H }}>
        <View style={{ width: CARD_X, backgroundColor: BG }} />
        {/* The transparent cutout */}
        <View style={{ width: CARD_W, height: CARD_H, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)" }} />
        <View style={{ width: CARD_X, backgroundColor: BG }} />
      </View>
      {/* Bottom */}
      <View style={{ flex: 1, backgroundColor: BG }} />

      {/* Corner brackets */}
      <CornerBrackets />

      {/* Guide text above card */}
      <View style={{ position: "absolute", top: CARD_Y - 70, left: 0, right: 0, alignItems: "center" }}>
        <KText style={{ color: "#FFF", fontSize: 18, fontWeight: "700", textAlign: "center" }}>{title}</KText>
        <KText style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4, textAlign: "center" }}>
          {subtitle}
        </KText>
      </View>

      {/* Hint inside card */}
      <View style={{ position: "absolute", top: CARD_Y + CARD_H / 2 - 10, left: 0, right: 0, alignItems: "center" }}>
        <KText style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
          Place ton document ici
        </KText>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════
// Preview screen (after capture)
// ══════════════════════════════════════════════════════════
function PreviewScreen({
  uri, onConfirm, onRetake,
}: {
  uri: string; onConfirm: () => void; onRetake: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Image source={{ uri }} style={{ flex: 1 }} resizeMode="contain" />
      <View style={previewStyles.bar}>
        <Pressable onPress={onRetake} style={previewStyles.retakeBtn}>
          <Ionicons name="refresh" size={22} color="#FFF" />
          <KText style={{ color: "#FFF", fontSize: 15, fontWeight: "600" }}>Reprendre</KText>
        </Pressable>
        <Pressable onPress={onConfirm} style={previewStyles.confirmBtn}>
          <Ionicons name="checkmark" size={22} color="#FFF" />
          <KText style={{ color: "#FFF", fontSize: 15, fontWeight: "700" }}>Valider</KText>
        </Pressable>
      </View>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  bar: {
    flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  retakeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 16, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  confirmBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 16, borderRadius: 14,
    backgroundColor: "#10B981",
  },
});

// ══════════════════════════════════════════════════════════
// Permission denied screen
// ══════════════════════════════════════════════════════════
function PermissionScreen({ onRequest, onClose }: { onRequest: () => void; onClose: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 30 }}>
      <Ionicons name="camera-outline" size={60} color="rgba(255,255,255,0.4)" />
      <KText style={{ color: "#FFF", fontSize: 18, fontWeight: "700", marginTop: 16, textAlign: "center" }}>
        Accès caméra requis
      </KText>
      <KText style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
        Pour vérifier ton identité, autorise l'accès à la caméra.
      </KText>
      <Pressable onPress={onRequest} style={{ marginTop: 24, backgroundColor: "#3B82F6", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}>
        <KText style={{ color: "#FFF", fontSize: 15, fontWeight: "700" }}>Autoriser la caméra</KText>
      </Pressable>
      <Pressable onPress={onClose} style={{ marginTop: 16 }}>
        <KText style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Annuler</KText>
      </Pressable>
    </View>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN EXPORT: DocumentCamera
// ══════════════════════════════════════════════════════════
export function DocumentCamera({
  title, subtitle, onCapture, onClose,
}: {
  title: string;
  subtitle: string;
  onCapture: (uri: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    haptic.medium();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
      }
    } catch {
      // Silently fail
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  const handleConfirm = useCallback(() => {
    if (capturedUri) {
      haptic.success();
      onCapture(capturedUri);
    }
  }, [capturedUri, onCapture]);

  const handleRetake = useCallback(() => {
    setCapturedUri(null);
  }, []);

  // ── Preview mode ──
  if (capturedUri) {
    return <PreviewScreen uri={capturedUri} onConfirm={handleConfirm} onRetake={handleRetake} />;
  }

  // ── Permission not granted ──
  if (!permission?.granted) {
    return <PermissionScreen onRequest={requestPermission} onClose={onClose} />;
  }

  // ── Camera mode ──
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />

      {/* Overlay with card cutout */}
      <Overlay title={title} subtitle={subtitle} />

      {/* Close button */}
      <Pressable
        onPress={onClose}
        style={{
          position: "absolute", top: 56, left: 20, width: 40, height: 40,
          borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Ionicons name="close" size={22} color="#FFF" />
      </Pressable>

      {/* Capture button */}
      <View style={{ position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" }}>
        <Pressable
          onPress={handleCapture}
          disabled={capturing}
          style={({ pressed }) => ({
            width: 72, height: 72, borderRadius: 36,
            borderWidth: 4, borderColor: "#FFF",
            backgroundColor: pressed ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
            alignItems: "center", justifyContent: "center",
          })}
        >
          {capturing ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFF" }} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
