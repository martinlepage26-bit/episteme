# Épistémè — état du produit

Outil de codage qualitatif auditable. Voir `SPEC.md` pour la spécification complète d'origine.

## Référence de design

Un mockup statique (React/Vite, non fonctionnel, généré par Perplexity Labs) accompagnait la
spécification. Il n'inclut aucune logique ni code source réutilisable (bundle minifié uniquement),
mais fixe l'identité visuelle (polices IBM Plex Mono/Sans/Serif, UI en français) et l'architecture
de l'information : `/corpus /coding /codebook /compare /reconcile /audit /exports`.

## Portée — Phase 1 (cette itération)

Boucle centrale à un seul codeur, sans posture multi-stance :

- **Corpus** : import de documents (texte collé + métadonnées libres).
- **Citations** : sélection d'un extrait dans un document, création d'une citation.
- **Codage** : application de codes à des citations, avec mémo d'interprétation.
- **Codebook** : création/édition de codes (définition, critères d'inclusion/exclusion, exemple,
  hiérarchie parent/enfant).
- **Journal d'audit** : append-only, un événement par action significative (document créé, citation
  créée, code créé/modifié, code appliqué/révoqué, mémo créé), filtrable par type/document/code/date.
  Aucune route de mise à jour ou de suppression n'existe sur cette collection.
- **Exports** : Codebook et Recueil de citations en Markdown.

Retrait de code = révocation (`revoked: true`), jamais une suppression physique — l'événement de
codage original reste dans l'historique.

## Différé — Phase 2 (hors périmètre de cette itération)

- Codage multi-stance (Pass A / Pass B), objets de réconciliation, écran `/compare` et delta
  épistémique.
- Chaînage cryptographique du journal d'audit (SHA-256, empreinte par séquence, vérification de
  chaîne rompue/vérifiée).
- Export JSON immuable avec `export_id` et en-tête de triplet de session.
- Export .docx (Codebook, Recueil de citations).
- Notion de Session formelle (coder, stance, corpus, horodatage de début).

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
- **Aucune authentification** : l'URL publique n'est protégée par rien d'autre que le fait de ne
  pas être devinable au hasard, comme les autres tunnels `-api.pharos-ai.ca` existants sur ce
  compte. À ajouter (Cloudflare Access) si l'outil doit rester privé au-delà d'un usage interim.

Pour redéployer après un changement de code :

```bash
cd /home/martin/Applications/episteme/frontend && npm run build
cd /home/martin/Applications/episteme/server && npm run build
systemctl --user restart episteme-api.service
```

Architecture cible si ce produit dépasse le stade interim : suivre le placement par défaut de
`hosting.md` pour les petites applications dynamiques (CT947, `apps-shared-mtl00`) avec PostgreSQL
plutôt que Mongo — c'est la politique « PostgreSQL-first » de l'estate pour tout nouveau projet.
Ce choix reste différé tant que l'outil reste un usage personnel/interim.
