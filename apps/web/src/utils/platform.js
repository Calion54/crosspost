import { Platform } from '@crosspost/shared';
import leboncoinIcon from '@/assets/leboncoin.png';
import vintedIcon from '@/assets/vinted.png';
/**
 * Centralised platform metadata. `Record<Platform, ...>` ensures TS errors
 * if a new enum value is added without updating the maps here.
 */
export const PLATFORM_LABELS = {
    [Platform.LEBONCOIN]: 'Leboncoin',
    [Platform.VINTED]: 'Vinted',
};
export const PLATFORM_ICONS = {
    [Platform.LEBONCOIN]: leboncoinIcon,
    [Platform.VINTED]: vintedIcon,
};
export function platformLabel(platform) {
    return PLATFORM_LABELS[platform];
}
export function platformImage(platform) {
    return PLATFORM_ICONS[platform];
}
/**
 * Sorted list usable directly as items for `<v-select>` / `<v-autocomplete>`.
 * Uses Vuetify defaults (`title` + `value`) — no extra item-title/item-value props needed.
 */
export const PLATFORM_OPTIONS = Object.values(Platform).map((value) => ({
    value,
    title: PLATFORM_LABELS[value],
}));
//# sourceMappingURL=platform.js.map