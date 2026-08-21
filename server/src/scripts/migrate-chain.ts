import "dotenv/config";
import { collections, connectDb, ensureIndexes } from "../db.js";
import { GENESIS_HASH, hashEvent, verifyChain } from "../lib/audit.js";

/**
 * Rattache les événements antérieurs au chaînage à la chaîne SHA-256.
 *
 * Les événements de la phase 1 n'ont ni rang ni empreinte. On leur en attribue
 * dans leur ordre chronologique d'insertion. Ce scellement est honnête sur ce
 * qu'il prouve : il garantit l'intégrité *à partir de maintenant*, pas
 * l'intégrité rétroactive d'événements qui n'étaient pas chaînés quand ils ont
 * été écrits. Les événements ainsi rattachés sont marqués `backfilled: true`.
 */
async function main() {
  await connectDb();

  const legacy = await collections.auditEvents
    .find({ $or: [{ seq: { $exists: false } }, { hash: { $exists: false } }] })
    .sort({ timestamp: 1, _id: 1 })
    .toArray();

  if (legacy.length === 0) {
    console.log("Aucun événement à rattacher.");
  } else {
    const chained = await collections.auditEvents
      .find({ seq: { $exists: true } })
      .sort({ seq: -1 })
      .limit(1)
      .next();

    let prevHash = chained?.hash ?? GENESIS_HASH;
    let seq = (chained?.seq ?? 0) + 1;

    for (const event of legacy) {
      const record = {
        seq,
        type: event.type,
        timestamp: event.timestamp,
        actor: event.actor,
        stance: event.stance ?? null,
        summary: event.summary,
        refs: event.refs ?? {},
        prevHash,
      };
      const hash = hashEvent(record);
      await collections.auditEvents.updateOne(
        { _id: event._id },
        { $set: { ...record, hash, backfilled: true } },
      );
      console.log(`  rang ${seq} ← ${event.type} ${event.timestamp}`);
      prevHash = hash;
      seq += 1;
    }
    console.log(`${legacy.length} événement(s) rattaché(s).`);
  }

  // Les codages antérieurs n'ont pas de posture : par défaut la passe A
  // (interprétation), qui est ce que faisait l'outil à codeur unique.
  const untyped = await collections.codingEvents.updateMany(
    { stance: { $exists: false } },
    { $set: { stance: "A", sessionId: null } },
  );
  if (untyped.modifiedCount > 0) {
    console.log(`${untyped.modifiedCount} codage(s) rattaché(s) à la passe A.`);
  }

  await ensureIndexes();
  console.log("Index créés.");
  console.log("Vérification :", JSON.stringify(await verifyChain(), null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
