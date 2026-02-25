/**
 * Source de vérité unique pour identifier un utilisateur.
 *
 * Utilise TOUJOURS `user._id` (= l'ID interne Better Auth / Convex).
 * Ne jamais utiliser user.email ou user.userId comme identifiant,
 * car ces valeurs peuvent changer (email update, migration, etc.)
 *
 * ⚠️  Chaque fichier backend DOIT importer cette fonction au lieu de
 *     recalculer l'ID manuellement.
 */
export function userKey(user: { _id: string | { toString(): string } }): string {
  return String(user._id);
}
