/**
 * Typography — see Section 3 of the build brief.
 * Display / numbers: Oswald (condensed industrial sans), weights 500/600.
 * UI / body: Inter, weights 400/500/600/700.
 *
 * The string values here MUST match the keys registered with expo-font in the
 * root layout (see app/_layout.tsx). Keep the two in sync.
 */
export const fonts = {
  // Oswald — used for the live count number, big counters, section headings.
  oswaldMedium: 'Oswald_500Medium',
  oswaldSemiBold: 'Oswald_600SemiBold',

  // Inter — all body text, buttons, labels.
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
} as const;

/**
 * Reusable text style presets. Components can spread these into StyleSheet
 * entries, e.g. `...textStyles.heading`.
 */
export const textStyles = {
  // The dominant live-count number on the scanner screen. Oswald is tall, so
  // give it a generous line height (~1.25x) or the top of the glyphs clips.
  countDisplay: {
    fontFamily: fonts.oswaldSemiBold,
    fontSize: 72,
    lineHeight: 90,
  },
  heading: {
    fontFamily: fonts.oswaldSemiBold,
    fontSize: 24,
    lineHeight: 30,
  },
  sectionLabel: {
    fontFamily: fonts.oswaldMedium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.5,
  },
  body: {
    fontFamily: fonts.interRegular,
    fontSize: 16,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 22,
  },
  button: {
    fontFamily: fonts.interSemiBold,
    fontSize: 17,
    lineHeight: 22,
  },
  label: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  caption: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    lineHeight: 16,
  },
} as const;
