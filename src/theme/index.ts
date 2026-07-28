/**
 * Theme barrel — shared design tokens. See Section 3 of the build brief.
 * Light theme only in V1.
 */
import { colors } from './colors';
import { fonts, textStyles } from './typography';

/** Corner radii — 12px for cards, 14px for buttons (brief Section 3). */
export const radii = {
  card: 12,
  button: 14,
  pill: 999,
} as const;

/** 4px spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Minimum tap target for primary actions (brief: 56px; main CTA is 64px). */
export const sizes = {
  primaryButtonHeight: 56,
  confirmButtonHeight: 64,
} as const;

/** The single subtle card elevation allowed by the brief (no heavy shadows). */
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
  elevation: 2,
} as const;

export const theme = {
  colors,
  fonts,
  textStyles,
  radii,
  spacing,
  sizes,
  cardShadow,
} as const;

export { colors, fonts, textStyles };
export type Theme = typeof theme;
