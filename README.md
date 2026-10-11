# Épistémè

Outil de codage qualitatif auditable. Voir `SPEC.md` (spécification complète) et `PRODUCT.md`
(portée de cette itération, choix de stack, déploiement).

**Live :** https://episteme.pharos-ai.ca (interim, CT920). Accès par phrase de passe — voir
`PRODUCT.md`.

## Démarrer en local

Prérequis : Docker, Node.js 22+.

```bash
npm install                    # installe concurrently à la racine
npm --prefix server install
npm --prefix frontend install

npm --prefix server run migrate  # chaîne les événements d'audit existants et crée les index
npm run dev                      # lance MongoDB (docker), l'API (:4000) et le frontend (:5173)
```

En local, l'authentification est inactive tant que `EPISTEME_PASSPHRASE` et
`EPISTEME_SESSION_SECRET` sont absents de `server/.env` (voir `server/.env.example`).

Ou séparément, dans trois terminaux :

```bash
npm run db:up                          # MongoDB sur localhost:27018
npm --prefix server run dev            # API sur http://localhost:4000
npm --prefix frontend run dev          # Frontend sur http://localhost:5173
```

L'API écoute sur `http://localhost:4000/api`. Le frontend proxie `/api` vers ce port en
développement (voir `frontend/vite.config.ts`).

## Sonde `/api/status`

`GET /api/status` est public. Il envoie un `ping` administrateur à MongoDB et
attend au plus 2 secondes (`MONGO_PING_TIMEOUT_MS`).

- **200** — MongoDB a répondu. `status` vaut `"ok"`.
- **503** — MongoDB est injoignable, renvoie une erreur, ou ne répond pas à temps.
  `status` vaut `"error"` et `dependencies.mongodb.error` nomme la cause
  (`"mongodb unavailable"` ou `"mongodb timed out"`).

Les deux réponses gardent `product`, `phase`, `authEnabled` et `accessEnabled`.
Le détail du pilote (URI, pile) est journalisé côté serveur et n'est pas renvoyé.

```bash
npm test --prefix server
```

## Structure

```
episteme/
├── server/      API Node.js + TypeScript + Express + MongoDB
│   └── src/lib/audit.ts    journal append-only chaîné en SHA-256
├── frontend/    App React + TypeScript + Vite + Tailwind
└── docker-compose.yml   MongoDB local (port 27018)
```

Écrans : `/corpus` `/coding/:id` `/codebook` `/compare` `/reconcile` `/audit` `/exports`.
