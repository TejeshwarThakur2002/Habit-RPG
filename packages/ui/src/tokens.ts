// Colour tokens from SCOPE.md section 5.1. Screens use these names, never raw hex values.
export const colors = {
  bg: '#14121F',
  surface: '#1F1C2E',
  surface2: '#2A2640',
  surfaceNav: '#1A1727',
  border: '#2E2A44',
  borderStrong: '#3A3554',
  checkboxIdle: '#5E5878',
  text: '#F2EEE3',
  textSoft: '#C9C4DB',
  muted: '#A8A2BD',
  gold: '#F2B84B',
  goldPressed: '#FFD27A',
  teal: '#4FD1B5',
  red: '#F0626A',
  orange: '#F08A4B',
  purple: '#8B7CF6',
  purpleDark: '#5B4FC4',
  bossGreen: '#6EE7A8',
  bossCardBg: '#1A2A22',
  bossCardBorder: '#2F5A42',
  bossLabel: '#9FD9B8',
  bossTrack: '#0F1F17',
  badHabitBorder: '#5A2E3A',
  heat: ['#2A2640', '#2F5A4C', '#3C8C72', '#4FD1B5', '#A6F2DE'],
} as const;

export type ColorToken = Exclude<keyof typeof colors, 'heat'>;

// Font family names as registered by the app's useFonts call (SCOPE.md section 5.1).
export const fonts = {
  pixelMedium: 'PixelifySans_500Medium',
  pixelBold: 'PixelifySans_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

/** Text styles from SCOPE.md section 5.1. Pixel styles are for headings, numbers and rewards. */
export const type = {
  screenTitle: { fontFamily: fonts.pixelBold, fontSize: 22, color: colors.gold },
  name: { fontFamily: fonts.pixelBold, fontSize: 20, color: colors.text },
  sectionTitle: { fontFamily: fonts.pixelMedium, fontSize: 18, color: colors.text },
  bigNumber: { fontFamily: fonts.pixelMedium, fontSize: 24 },
  reward: { fontFamily: fonts.pixelMedium, fontSize: 13 },
  statValue: { fontFamily: fonts.pixelMedium, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  bodyStrong: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  secondary: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted },
} as const;

export const spacing = {
  screenX: 20,
  section: 16,
  row: 8,
  cardPadding: 16,
} as const;

export const radii = {
  heroCard: 16,
  card: 14,
  row: 12,
  button: 10,
  checkbox: 4,
  bar: 2,
  pill: 999,
} as const;

export const borders = {
  card: 2,
  pill: 1,
} as const;

/** Minimum touch target (SCOPE.md section 1, accessibility). */
export const MIN_TOUCH = 44;

/** Animation timings from SCOPE.md section 5.9, in milliseconds. */
export const motion = {
  bar: 300,
  checkboxPop: 150,
  floatingReward: 600,
} as const;
