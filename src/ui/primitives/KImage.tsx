import { Image, ImageProps } from "expo-image";
import { StyleSheet, ViewStyle, ImageStyle } from "react-native";

/**
 * KImage — drop-in replacement for React Native's <Image>.
 *
 * Benefits over <Image>:
 * - Built-in blur placeholder (smooth load effect)
 * - Aggressive disk + memory caching
 * - Cross-fade transition on load
 * - Better performance for lists
 *
 * Usage:
 *   <KImage source={{ uri: url }} style={{ width: 200, height: 150 }} />
 *   <KImage source={{ uri: url }} style={{ width: 200, height: 150 }} blurhash="LGF5]+Yk^6#M@-5c,1J5@[or[Q6." />
 */

/** A neutral blurhash used as default placeholder (soft gray gradient) */
const DEFAULT_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

interface KImageProps extends Omit<ImageProps, "placeholder" | "transition"> {
  /** Custom blurhash string for this image */
  blurhash?: string;
  /** Disable blur placeholder */
  noPlaceholder?: boolean;
  /** Transition duration in ms (default: 200) */
  transitionMs?: number;
}

export function KImage({
  blurhash,
  noPlaceholder = false,
  transitionMs = 200,
  contentFit,
  style,
  ...rest
}: KImageProps) {
  return (
    <Image
      {...rest}
      style={style as any}
      contentFit={contentFit ?? "cover"}
      placeholder={noPlaceholder ? undefined : { blurhash: blurhash || DEFAULT_BLURHASH }}
      transition={transitionMs}
      cachePolicy="memory-disk"
      recyclingKey={typeof rest.source === "object" && "uri" in rest.source ? rest.source.uri : undefined}
    />
  );
}
