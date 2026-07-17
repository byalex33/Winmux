export const themeIds = [
  "designbyte",
  "autoblog",
  "2077",
  "shopify-red",
  "sky",
  "openclaw",
  "black-and-pink",
] as const;

export type ThemeId = (typeof themeIds)[number];

export interface ThemeTokens {
  applicationBackground: string;
  sidebarBackground: string;
  toolbarBackground: string;
  terminalSurface: string;
  popoverBackground: string;
  dialogBackground: string;
  inputBackground: string;
  activeItemBackground: string;
  hoverBackground: string;
  border: string;
  mutedText: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  warning: string;
  error: string;
  focusRing: string;
  selectionBackground: string;
  scrollbarTrack: string;
  scrollbarThumb: string;
  radius: string;
  shadow: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  source: `https://tweakcn.com/themes/${string}`;
  tokens: ThemeTokens;
}
