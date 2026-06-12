import { Platform } from '@crosspost/shared';
/**
 * Centralised platform metadata. `Record<Platform, ...>` ensures TS errors
 * if a new enum value is added without updating the maps here.
 */
export declare const PLATFORM_LABELS: Record<Platform, string>;
export declare const PLATFORM_ICONS: Record<Platform, string>;
export declare function platformLabel(platform: Platform): string;
export declare function platformImage(platform: Platform): string;
/**
 * Sorted list usable directly as items for `<v-select>` / `<v-autocomplete>`.
 * Uses Vuetify defaults (`title` + `value`) — no extra item-title/item-value props needed.
 */
export declare const PLATFORM_OPTIONS: {
    value: Platform;
    title: string;
}[];
