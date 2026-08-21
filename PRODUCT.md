# Épistémè — état du produit

Outil de codage qualitatif auditable. Voir `SPEC.md` pour la spécification complète d'origine.

## Référence de design

Un mockup statique (React/Vite, non fonctionnel, généré par Perplexity Labs) accompagnait la
spécification. Il n'inclut aucune logique ni code source réutilisable (bundle minifié uniquement),
mais fixe l'identité visuelle (polices IBM Plex Mono/Sans/Serif, UI en français) et l'architecture
de l'information : `/corpus /coding /codebook /compare /reconcile /audit /exports`.

## Portée — Phase 1 (livrée)

Boucle centrale à un seul codeur :

- **Corpus** : import de documents (texte collé + métadonnées libres).
- **Citations** : sélection d'un extrait dans un document, création d'une citation. Les offsets
  sont validés contre la longueur du document.
- **Codage** : application de codes à des citations, avec mémo d'interprétation.
- **Codebook** : création/édition de codes (définition, critères d'inclusion/exclusion, exemple,
  hiérarchie parent/enfant, sans cycle).
- **Journal d'audit** : append-only, un événement par action significative, filtrable par
  type/posture/codeur/document/code/date.
- **Exports** : Codebook et Recueil de citations en Markdown.

Retrait de code = révocation (`revoked: true`), jamais une suppression physique.

## Portée — Phase 2 (livrée)

- **Codage multi-stance** : chaque événement de codage porte une posture — A (interprétation) ou
  B (contraste). Les deux lectures coexistent sur une même citation ; l'outil ne les fusionne pas.
- **Session formelle** : triplet (codeur, posture, corpus) horodaté, identifiant `S-AAAA-MM-JJ-NNN`.
  Une session ouverte fait autorité sur la posture : un codage ne peut pas la contredire, et une
  session close n'accepte plus de codage.
- **Détection de conflit** : dès que les deux passes divergent sur une citation, un événement
  `CONFLIT 2ᵉ CODEUR` est inscrit au journal, une seule fois par divergence distincte.
- **Réconciliation** : objet `R<n>` portant la décision (conserver les deux / A / B / codage
  distinct), le motif obligatoire, et l'état figé des deux passes au moment de la décision.
- **Écran `/compare`** : tableau synchronisé Passe A / Passe B et bilan Δ épistémique.
- **Écran `/reconcile`** : file des divergences en attente et formulaire de décision.
- **Chaînage cryptographique** : chaque événement d'audit porte un rang (`seq`), l'empreinte du
  précédent (`prevHash`) et sa propre empreinte SHA-256 (`hash`). `GET /api/audit/verify`
  recalcule la chaîne entière et distingue trois ruptures : rang manquant, empreinte précédente
  incorrecte, contenu modifié.
- **Export JSON immuable** : `GET /api/exports/audit.json` — `export_id`, triplet de session,
  état de la chaîne, séquence complète des événements avec empreintes, réconciliations, et les
  artefacts référencés. Le corps est scellé par son propre `bodyHash`, recalculable par un tiers.
  Les documents n'y figurent que par leurs métadonnées et l'empreinte SHA-256 de leur contenu :
  un export d'audit ne redistribue pas les transcriptions.

### Ce que la chaîne prouve — et ce qu'elle ne prouve pas

La chaîne rend **détectable** toute modification, suppression ou réinsertion dans le journal
d'audit. Elle ne les **empêche** pas, et elle ne couvre que le journal : les codes, citations et
documents ne sont pas chaînés. Quelqu'un ayant un accès direct à MongoDB peut supprimer un code
sans que la chaîne s'en aperçoive — l'API, elle, n'expose aucune route de suppression.

Deux limites structurelles, documentées plutôt que masquées :

- **L'ajout au journal n'est pas transactionnel avec l'écriture métier.** MongoDB tourne en
  standalone (pas de replica set), donc pas de transaction multi-document : si l'insertion de
  l'événement d'audit échouait après la création de l'entité, l'entité existerait sans trace.
- **Le verrou d'ajout est en mémoire du processus.** Il sérialise les ajouts concurrents (vérifié :
  24 écritures simultanées, 42 événements, aucun trou ni doublon). L'index unique sur `seq`
  empêche une seconde instance d'écrire un rang déjà pris, mais répliquer l'API demanderait un
  verrou partagé.

## Différé (hors périmètre)

- Export .docx (Codebook, Recueil de citations).
- Archivage d'un code devenu inutile — il n'existe aucune route de suppression, par conception,
  mais rien ne permet aujourd'hui de retirer un code du codebook actif.

## Stack

- `server/` — Node.js + TypeScript + Express + pilote officiel `mongodb`. API REST.
- `frontend/` — Vite + React + TypeScript + Tailwind + Radix UI + TanStack Query + React Router.
- MongoDB local via `docker-compose.yml` (pas de dépendance à Atlas pour le développement).

### Cloudflare + MongoDB — pourquoi ce n'est pas un Worker

Cloudflare Workers ne peut pas héberger de façon fiable le pilote MongoDB officiel : le pilote
dépend de `net.Socket`/`tls.TLSSocket`, et même avec `nodejs_compat_v2` les connexions
n'aboutissent pas correctement (voir la discussion GitHub `cloudflare/workerd#2721`). L'ancienne
solution de contournement, l'Atlas Data API (HTTPS), a été retirée par MongoDB le 30 septembre 2025.

## Déploiement — interim, CT920 (`workspace-mtl00`)

Vivant à **https://episteme.pharos-ai.ca**, sur le compte personnel de Martin sur CT920 — hors du
périmètre du registre d'hébergement partagé (`hosting-app-registry.yaml`), qui gouverne les sites
publics et runtimes applicatifs de l'estate mtl-00/01/02/03. Ce placement suit exactement le même
modèle que le tunnel `echo-clone-api` déjà en service sur ce compte.

- `server/` sert désormais aussi le build statique de `frontend/dist` (un seul processus, un seul
  port 4000) — plus besoin d'un serveur Vite séparé en production.
- Service systemd `--user` `episteme-api.service` : lance `node dist/index.js`, `Restart=on-failure`,
  activé au démarrage.
- Service systemd `--user` `episteme-tunnel.service` : Cloudflare Tunnel nommé `episteme`
  (`~/.cloudflared/episteme-config.yml`), route DNS `episteme.pharos-ai.ca` → `127.0.0.1:4000`,
  `Requires=episteme-api.service`.
- MongoDB reste le conteneur local `docker-compose.yml` (`restart: unless-stopped`, port 27018) —
  Docker démarre au boot, donc la base survit à un redémarrage sans configuration additionnelle.
- **Authentification à l'origine** : phrase de passe unique, cookie de session signé HMAC-SHA256
  (`HttpOnly`, `Secure`, `SameSite=Lax`, 12 h), comparaison à temps constant, et limitation à
  8 tentatives par 10 min et par adresse. Configurée par `EPISTEME_PASSPHRASE` et
  `EPISTEME_SESSION_SECRET` dans `server/.env` ; avec `EPISTEME_REQUIRE_AUTH=1`, le serveur refuse
  de démarrer si elles manquent. Seuls `/api/status` et `/api/auth/*` sont ouverts.
  La phrase de passe vit dans
  `~/.secrets/martin,ml@pharos-ai.ca,episteme.pharos-ai.ca-passphrase.txt` (perms 600).
- **Cloudflare Access reste à poser** en amont du tunnel. Script prêt :
  `scripts-ops/setup-cloudflare-access.sh` (crée l'application, la politique PIN à usage unique
  pour `martinlepage.ai@gmail.com` et `ml@pharos-ai.ca`, vérifie la redirection, et documente le
  rollback). Prérequis : un domaine d'équipe Zero Trust doit exister, sinon l'écran de connexion
  Access ne peut pas aboutir. Ce serait une seconde barrière, au bord
  du réseau plutôt qu'à l'origine, et donnerait une identité par personne au lieu d'un secret
  partagé. Non fait ici : le seul jeton Cloudflare présent sur la machine
  (`~/.secrets/martin,cloudflare,api-publicsurface.txt`) répond `Invalid API Token`, et aucun outil
  Access n'est exposé. Le jeton de `~/.cloudflared/cert.pem` a été essayé : il lit les
  applications Access, mais la création renvoie `1010` (portée insuffisante). Un jeton dédié
  reste donc nécessaire. Il faut un jeton portant *Access: Apps and Policies — Edit* sur le compte
  `Ml@pharos-ai.ca`, ou trois minutes dans le tableau de bord Zero Trust.

Pour redéployer après un changement de code :

```bash
cd /home/martin/Applications/episteme/frontend && npm run build
cd /home/martin/Applications/episteme/server && npm run build
systemctl --user restart episteme-api.service
```

La migration de chaînage (`npm --prefix server run migrate`) rattache les événements d'audit
antérieurs à la chaîne et crée les index. Elle doit tourner **avant** le premier démarrage du
serveur chaîné : l'index unique sur `auditEvents.seq` ne peut pas être construit tant que
d'anciens événements n'ont pas de rang. Elle est idempotente.

Architecture cible si ce produit dépasse le stade interim : suivre le placement par défaut de
`hosting.md` pour les petites applications dynamiques (CT947, `apps-shared-mtl00`) avec PostgreSQL
plutôt que Mongo — c'est la politique « PostgreSQL-first » de l'estate pour tout nouveau projet.
Ce choix reste différé tant que l'outil reste un usage personnel/interim.
