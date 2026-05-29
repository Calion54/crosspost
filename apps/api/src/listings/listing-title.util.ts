/**
 * Normalisation de titre partagée par tous les syncs (LBC, Vinted, …) pour la
 * dédup cross-plateforme : on évite de recréer un Listing déjà importé par une
 * autre plateforme quand le titre correspond. Minuscules + espaces collapsés.
 *
 * Limite connue : si le même objet a un libellé différent selon la plateforme,
 * il ne sera pas reconnu comme identique (pas d'identifiant commun fiable).
 */
export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}
