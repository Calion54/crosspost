/**
 * Contrat générique d'un step dans une chaîne de publication d'annonce.
 *
 * Un step :
 *  - a un nom (pour les logs / debug)
 *  - reçoit un contexte typé par plateforme
 *  - lit ce dont il a besoin, mute ce qu'il produit, ne throw qu'en cas d'erreur
 *
 * Les services platform-specific (LeboncoinPublishService, VintedPublishService…)
 * composent leur chaîne en injectant leurs steps dans l'ordre, puis itèrent en
 * appelant `step.execute(ctx)` sur chacun.
 */
export interface PublishStep<Ctx> {
  /** Nom court pour les logs (ex: "create-draft", "upload-images"). */
  readonly name: string;

  /**
   * Exécute le step. Lit les données du `ctx` produites par les steps précédents,
   * mute le `ctx` pour fournir ses propres outputs aux steps suivants.
   * Doit throw si une condition critique manque ou si l'API distante renvoie une erreur.
   */
  execute(ctx: Ctx): Promise<void>;
}
