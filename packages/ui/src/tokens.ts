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
