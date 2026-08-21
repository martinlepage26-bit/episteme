# Spécifications : outil de codage qualitatif auditable

## 1. Exportations (codebook, recueil de citations, audit immuable)
L'application doit produire plusieurs artefacts de recherche formels pour garantir traçabilité et pérennité des données. Par exemple, ATLAS.ti permet d'**exporter le codebook** (liste des codes avec leurs définitions) au format tableur (XLSX), et supporte le standard QDPX (XML) pour l'échange universel de projets qualitatifs. De même, l'application devra générer :
- **Codebook (code-livre)** en Markdown et .docx, incluant pour chaque code : ID, nom, définition (critères d'inclusion/exclusion), exemples, hiérarchie parent/enfant, historique de création/modification et posture analytique associée.
- **Recueil de citations (Quotation Book)** en Markdown et .docx, listant chaque extrait codé : référence du document, position (page/ligne), texte exact, code(s) appliqué(s), nom du codeur, posture (stance), mémo d'interprétation, timestamp, et référence de provenance.
- **Audit immuable en JSON** : un log append-only contenant la **séquence chronologique** de tous les événements d'analyse. Chaque export inclura un identifiant d'export (`export_id`) et le triplet de session (« pass A/pass B ») en tête pour ancrer le contexte. Le JSON contiendra toutes les actions : création/modification de codes, codage, décisions de posture, interventions IA/humaines, réconciliations, etc., avec horodatage et références croisées (hashs ou liens vers les artefacts associés). Ce format machine-lisible garantit que l'export n'est **pas une simple copie de la base**, mais la preuve formelle du cheminement de l'analyse.

## 2. Codage multi-stance (deuxième codeur en posture contrastante)
Le système doit considérer la présence de plusieurs codeurs comme un mode analytique explicite, pas seulement un indicateur de fiabilité inter-juge. Par exemple :
- **Posture A (interprétative)** : « coder selon le sens exprimé par le participant ».
- **Posture B (contrastante)** : « chercher activement des interprétations qui contredisent ou complexifient la lecture de A ».

L'outil ne doit **pas fusionner automatiquement les désaccords** en une seule interprétation. Au contraire, chaque divergence reste documentée. Par exemple :

```text
Citation Q184
Pass A – Codeur A (Stance : interprétation) : Code = « Méfiance institutionnelle » – Interprétation : « Le participant décrit des échecs répétés des institutions. »
Pass B – Codeur B (Stance : contraste) : Code = « Présentation stratégique de soi » – Interprétation : « L'énoncé pourrait être une redéfinition rétrospective plutôt qu'une méfiance réelle. »
STATUT : non réconcilié
```

On maintient ainsi la **divergence épistémique comme donnée**. Après réconciliation manuelle, on peut formaliser un objet de réconciliation :

```text
RÉCONCILIATION R184
Interprétations d'origine : A → Méfiance institutionnelle  ;  B → Présentation stratégique de soi
Décision : conserver les deux codes
Codage final : « Méfiance institutionnelle », « Présentation stratégique de soi »
Motif : les deux interprétations sont valables à des niveaux analytiques distincts.
```

Aucun autre logiciel QDA connu ne formalise ainsi explicitement le conflit interprétatif ; Atl.ti ou LiGRE gèrent la collaboration multi-utilisateur, mais sans conserver séparément chaque posture comme ici.

## 3. Vue comparée Pass A vs Pass B (tableau synchronisé et delta épistémique)
L'interface doit proposer un écran de comparaison synchrone des deux passes de codage, par exemple :

| Élément            | Pass A (Stance interprétation)      | Pass B (Stance contraste)             |
|--------------------|--------------------------------------|-----------------------------------------|
| **Codes ajoutés**  | Méfiance institutionnelle           | Présentation stratégique de soi         |
| **Codes retirés**  | —                                    | Méfiance institutionnelle               |
| **Citations**      | 47                                   | 31                                       |
| **Thèmes émergents** | Défaillance institutionnelle      | Gestion de légitimité                    |
| **Contradictions identifiées** | 3                          | 11                                       |
| **Interprétation globale** | …                              | …                                       |

Au-dessous, on affichera un **bilan Epistemic Delta** synthétique :

```text
PASS A → PASS B (Posture contraste)
Thème A : Méfiance institutionnelle – 47 citations
Thème B : Présentation de soi – 31 citations

Δ ÉPISTÉMIQUE :
- 12 citations ont vu leur interprétation modifiée
- 8 citations ont reçu un second code (nuance ajoutée)
- 4 citations ont perdu leur code original
- 3 nouveaux thèmes sont apparus
- 1 contradiction jusque-là masquée a été identifiée
```

Ces métriques sont calculées automatiquement à partir des événements de codage appariés (même citation ou extraits recoupant un même texte). L'outil signale ce « changement d'interprétation » de manière factuelle, sans en tirer d'hypothèse sur le sens, laissant au chercheur le soin d'expliciter ces évolutions dans un commentaire qualitatif.

## 4. Journal d'audit (Audit Trail)
La piste d'audit doit être visible par l'utilisateur comme un **objet de recherche**, pas seulement un log technique. Par exemple :

```
SESSION S-2026-08-16-004  (Projet : Entretiens Immigration, Corpus 42 docs, Coder : ML, Stance : Contrast, Démarré : 2026-08-16 14:03:21)
─────────────────────────────────────────────────────────────
14:04:12   CITATION CRÉÉE – Document INT_17, page 8, ID Q184
14:05:03   CODE APPLIQUÉ – Q184 → « Présentation stratégique de soi »
14:06:17   CODE CRÉÉ – C-037 « Présentation stratégique de soi »
14:08:44   MÉMO CRÉÉ – M-018 (note sur Q184)
14:12:09   CONTRADICTION SIGNALÉE – Q184 ↔ Q091
14:16:32   CONFLIT 2ᴱ CODEUR – Q184 : A→«Méfiance institutionnelle» / B→«Présentation stratégique de soi»
14:21:51   RÉCONCILIATION – Codes conservés (voir R184)
14:22:03   HASH D'AUDIT – 9f31…a82c (empreinte de cette séquence)
```

Chaque événement est **horodaté, immuable et lié** à l'objet concerné. L'interface doit permettre de filtrer cette liste (par coder, posture, document, code, date, IA/humain, statu réconciliation, etc.), afin que le chercheur puisse suivre en détail la genèse de chaque décision analytique. Les log actuels d'Atl.ti ou LiGRE ne mettent pas en avant ce genre d'historique granularisé.

## 5. Modèle de données (architecture cible)
Ces exigences imposent un schéma riche, pas un simple Document→Code. La structure conceptuelle visée est par exemple :

```
SOURCE
├─ DOCUMENT
│   ├─ CITATION (fragment textuel)
│   │   └─ ÉVÉNEMENT_CODAGE (codeur, code, mémo, posture, session)
│   └─ PROVENANCE (métadonnées du document, etc.)

ÉVÉNEMENTS (tous)
├─ PASS A
├─ PASS B
└─ RÉCONCILIATION
    └─ INTERPRÉTATION FINALE

AJOUT : JOURNAL D'AUDIT append-only (séquence chronologique de tous les événements ci-dessus).
```

En pratique, un segment codé peut rester stocké dans la DB classique (pour compatibilité), mais chaque codage doit aussi créer un enregistrement **Événement_Codage** immuable lié à son citation. De même, les objets « code », « citation » et « interprétation finale » sont distingués pour ne pas confondre observation et analyse. Par exemple, une même citation peut donner lieu à plusieurs événements contradictoires avant réconciliation. Ce modèle assure qu'un « codebook » ou « code » n'est plus une simple étiquette, mais un résultat interprétatif traçable à sa source de données (c'est l'inverse du modèle document->code simpliste).

## 6. Vision produit et différenciation
Contrairement aux CAQDAS classiques, notre outil valorise **la traçabilité épistémique**. ATLAS.ti et LiGRE visent avant tout la facilité d'usage et l'efficacité du codage. Notre proposition va au-delà : **chaque choix d'interprétation reste inspectable**, chaque différence de lecture reste documentée. Les nouveaux artefacts (log audit, export immuable, données de réconciliation) positionnent le produit comme un « environnement de recherche qualitative où toute interprétation est traçable jusqu'à son évidence et sa posture analytique ».
