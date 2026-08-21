import { ObjectId } from "mongodb";

/**
 * Parse une chaîne en ObjectId sans lever d'exception.
 *
 * `new ObjectId(x)` lève un BSONError sur une entrée malformée. Dans un
 * gestionnaire Express asynchrone, cette exception rejette une promesse
 * qu'Express 4 n'intercepte pas : le rejet remonte au processus, et Node 22
 * termine le processus sur un rejet non géré. Une seule requête avec un
 * identifiant invalide suffisait donc à faire tomber l'API.
 */
export function parseObjectId(value: unknown): ObjectId | null {
  if (typeof value !== "string" || !ObjectId.isValid(value)) return null;
  return new ObjectId(value);
}
