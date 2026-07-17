import { autoblog } from "./autoblog";
import { blackAndPink } from "./black-and-pink";
import { designbyte } from "./designbyte";
import { openclaw } from "./openclaw";
import { shopifyRed } from "./shopify-red";
import { sky } from "./sky";
import { theme2077 } from "./theme-2077";
import { themeIds, type ThemeDefinition, type ThemeId } from "./types";

export const defaultThemeId: ThemeId = "designbyte";
export const themes = [
  designbyte,
  autoblog,
  theme2077,
  shopifyRed,
  sky,
  openclaw,
  blackAndPink,
] as const satisfies readonly ThemeDefinition[];

export const themeRegistry: Record<ThemeId, ThemeDefinition> = {
  designbyte,
  autoblog,
  "2077": theme2077,
  "shopify-red": shopifyRed,
  sky,
  openclaw,
  "black-and-pink": blackAndPink,
};

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === "string" && themeIds.includes(value as ThemeId);

export const resolveTheme = (value: unknown): ThemeDefinition =>
  themeRegistry[isThemeId(value) ? value : defaultThemeId];
