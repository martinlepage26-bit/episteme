# Épistémè

Outil de codage qualitatif auditable. Voir `SPEC.md` (spécification complète) et `PRODUCT.md`
(portée de cette itération, choix de stack, déploiement).

**Live :** https://episteme.pharos-ai.ca (interim, CT920, sans authentification — voir `PRODUCT.md`).

## Démarrer en local

Prérequis : Docker, Node.js 22+.

```bash
npm install                    # installe concurrently à la racine
npm --prefix server install
npm --prefix frontend install

npm run dev                    # lance MongoDB (docker), l'API (:4000) et le frontend (:5173)
```

Ou séparément, dans trois terminaux :

```bash
npm run db:up                          # MongoDB sur localhost:27018
npm --prefix server run dev            # API sur http://localhost:4000
npm --prefix frontend run dev          # Frontend sur http://localhost:5173
```

L'API écoute sur `http://localhost:4000/api`. Le frontend proxie `/api` vers ce port en
développement (voir `frontend/vite.config.ts`).

## Structure

```
episteme/
├── server/      API Node.js + TypeScript + Express + MongoDB
├── frontend/    App React + TypeScript + Vite + Tailwind
└── docker-compose.yml   MongoDB local (port 27018)
```
