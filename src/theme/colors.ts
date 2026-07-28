/**
 * ProCount colour palette — see Section 3 of the build brief.
 * Utility-tool-confident: cobalt blue brand, neutral greys, light theme only.
 */
export const colors = {
  blue: '#2E2EBE', // Primary brand / CTAs / active state
  blueDark: '#1E1E8A', // Pressed states, dark accent
  blueTint: '#EEF0FF', // Subtle blue background fills

  grey900: '#1F2024', // Primary text
  grey700: '#4A4D54', // Secondary text
  grey500: '#888B92', // Tertiary text / placeholders
  grey300: '#D1D3D8', // Borders / dividers
  grey100: '#F4F5F7', // Page backgrounds, cards

  white: '#FFFFFF',

  danger: '#E03A3A', // Delete / destructive
  success: '#1FA859', // Confirmation toasts
} as const;

export type ColorName = keyof typeof colors;
