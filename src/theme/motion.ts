import { Animated, Easing } from "react-native";

/**
 * Kreeny Motion Language
 *
 * Every animation in the app should use these constants.
 * This ensures a consistent, premium feel across all screens.
 *
 * Usage:
 *   import { motion } from "../theme/motion";
 *   Animated.timing(anim, { ...motion.fadeIn });
 */

// ═══════════════════════════════════════════════════════
// Durations (ms)
// ═══════════════════════════════════════════════════════
export const duration = {
  /** Micro interactions (press, toggle) */
  instant: 100,
  /** Quick transitions (fade, slide) */
  fast: 200,
  /** Standard transitions (page content appear) */
  normal: 280,
  /** Slow reveals (modals, sheets, hero) */
  slow: 400,
  /** Skeleton pulse half-cycle */
  pulse: 700,
  /** Stagger delay between list items */
  stagger: 80,
} as const;

// ═══════════════════════════════════════════════════════
// Easings
// ═══════════════════════════════════════════════════════
export const easing = {
  /** Default ease — smooth deceleration (iOS-like) */
  standard: Easing.bezier(0.25, 0.1, 0.25, 1),
  /** Enter screen — starts fast, slows down */
  enter: Easing.out(Easing.cubic),
  /** Exit screen — starts slow, speeds up */
  exit: Easing.in(Easing.cubic),
  /** Bounce-like spring feel */
  spring: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

// ═══════════════════════════════════════════════════════
// Presets (spread into Animated.timing config)
// ═══════════════════════════════════════════════════════
export const motion = {
  /** Fade in content (standard) */
  fadeIn: {
    toValue: 1,
    duration: duration.normal,
    easing: easing.enter,
    useNativeDriver: true,
  },
  /** Fade out content */
  fadeOut: {
    toValue: 0,
    duration: duration.fast,
    easing: easing.exit,
    useNativeDriver: true,
  },
  /** Slide up and fade in (list items, cards) */
  slideUp: {
    toValue: 1,
    duration: duration.normal,
    easing: easing.enter,
    useNativeDriver: true,
  },
  /** Quick toggle (switches, chips) */
  quick: {
    toValue: 1,
    duration: duration.fast,
    easing: easing.standard,
    useNativeDriver: true,
  },
  /** Skeleton pulse (up) */
  pulseUp: {
    toValue: 1,
    duration: duration.pulse,
    useNativeDriver: true,
  },
  /** Skeleton pulse (down) */
  pulseDown: {
    toValue: 0,
    duration: duration.pulse,
    useNativeDriver: true,
  },
} as const;

// ═══════════════════════════════════════════════════════
// Helper: create a standard staggered entrance
// ═══════════════════════════════════════════════════════
export function staggeredEntrance(anims: Animated.Value[], delayMs = duration.stagger) {
  return Animated.stagger(
    delayMs,
    anims.map((a) => Animated.timing(a, motion.slideUp))
  );
}

// ═══════════════════════════════════════════════════════
// Helper: create skeleton pulse loop
// ═══════════════════════════════════════════════════════
export function skeletonPulse(value: Animated.Value) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, motion.pulseUp),
      Animated.timing(value, motion.pulseDown),
    ])
  );
}

// ═══════════════════════════════════════════════════════
// Helper: standard opacity interpolation for pulse
// ═══════════════════════════════════════════════════════
export function pulseOpacity(value: Animated.Value) {
  return value.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });
}

// ═══════════════════════════════════════════════════════
// Helper: fade-up transform (for list items)
// ═══════════════════════════════════════════════════════
export function fadeUpStyle(anim: Animated.Value, distance = 10) {
  return {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  };
}
