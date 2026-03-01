import * as Haptics from "expo-haptics";

/**
 * Kreeny Haptics — feel every interaction.
 *
 * Usage:
 *   import { haptic } from "../theme/haptics";
 *   haptic.light();   // tab switch, toggle
 *   haptic.medium();  // button press, card tap
 *   haptic.success(); // booking confirmed, action done
 *   haptic.error();   // error, shake
 */

export const haptic = {
  /** Light tap: chip press, toggle, tab change */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  /** Medium tap: button press, card navigation */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  /** Heavy tap: important action (book, confirm) */
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),

  /** Success: action completed (booking confirmed, photo saved) */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

  /** Error: validation failed, action blocked */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),

  /** Selection: picker scroll, drag item */
  selection: () => Haptics.selectionAsync(),
} as const;
