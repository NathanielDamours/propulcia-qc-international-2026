# Notre Saint-Roch

Prototype d’application mobile pour la revitalisation du quartier **Saint-Roch** (Québec), réalisé pour le Hackathon 2026 en lien avec le *Plan d’action Saint-Roch 2026-2029 — Un centre-ville vivant*.

> Les lieux, stationnements, événements, entreprises, installations, éclairage, arrêts d’autobus et postes de police viennent **uniquement des fichiers de `public/donnees/`** (aucun lieu écrit dans le code). Remplacez ces fichiers par les vraies données de la Ville, avec le même nom et le même format. Les signalements, groupes et collaborations d’exemple sont encore écrits dans le code (`src/data/community.ts`).

## Lancer l’application

```bash
npm install
npm run dev        # http://localhost:5173 (accessible sur le réseau local avec --host)
npm run build      # version de production dans dist/
npm run preview
```

Sur ordinateur, l’application s’affiche dans un cadre de téléphone. Sur mobile, elle occupe tout l’écran et peut être ajoutée à l’écran d’accueil (PWA).

## Fonctionnement

1. **Choix du profil** : Citoyen, Entreprise / commerçant, Ville / Administration.
2. **Carte interactive** plein écran : MapLibre GL avec bâtiments 3D, thème jour / nuit, marqueurs animés, panneaux coulissants.
3. **Barre de navigation adaptée au profil** :

| Profil | Onglets |
| --- | --- |
| Citoyen | Carte · Événements · Groupes · Signaler |
| Entreprise | Carte · Annuaire · Collabs · Événements · Signaler |
| Ville | Carte · Gestion · Signaler · Événements |

Le menu (avatar en haut à droite) permet de changer de profil, de choisir l’apparence de la carte (auto, jour, nuit) et de réinitialiser la démo. Les profils Entreprise et Ville publient des événements avec le bouton « Publier » en bas à droite de la page Événements. Les profils Entreprise et Ville ne participent pas aux événements (pas de billets). Les itinéraires se lancent avec le bouton « Itinéraire » d’un lieu, d’un événement, d’un stationnement ou d’un arrêt.

Les couches de la carte (stationnements, événements, lieux, bus, signalements, éclairage) se désactivent avec les puces sous la barre de recherche. Une couche désactivée reste masquée partout, y compris pendant un itinéraire. Seul l’élément choisi dans la recherche (ou sélectionné) affiche toujours son repère.

## Fonctionnalités (par priorité)

1. **Déplacements sécuritaires** (inspiré de Streetwise) : départ et destination (recherche, « Ma position » ou toucher la carte), deux itinéraires à pied, *le plus sûr* (proposé en premier, badge « Recommandé ») et *le plus rapide*, en couleurs différentes. Chaque carte indique le score de sécurité, la durée et la distance. La fiche du trajet affiche le score, les alertes sur le chemin (catégorie, ancienneté, appuis, description), la sécurité le long du trajet, les étapes et la navigation simulée. Outils : partager son trajet, suivi par un proche, et un bouton SOS qui ouvre un clavier téléphonique avec le 911 déjà composé (bouton vert pour appeler). **Aucun trajet n’est présenté comme garanti sécuritaire.**
2. **Stationnement** : stationnements municipaux hors rue (fichier de la Ville) sur la carte, avec nom, adresse, nombre de cases et type (intérieur ou extérieur). Recherche, filtre intérieur/extérieur, fiche détaillée et itinéraire en voiture ou à pied. Aucun tarif ni disponibilité n’est inventé.
3. **Événements** : cartes visuelles, recherche, filtres (catégorie, date, favoris), fiche détaillée, favoris, « Je participe » (le bouton ticket en haut de la page liste mes événements réservés), **ajout à son calendrier** (fichier .ics pour iPhone, Android ou Outlook, avec rappel 1 h avant, ou Google Agenda prérempli), voir sur la carte, itinéraire, stationnements à proximité. Les profils Entreprise et Ville peuvent **publier** des événements.
4. **Groupes** : découverte par catégorie, rejoindre ou quitter, description, membres, activités et discussion. Bouton « Créer » pour fonder son propre groupe (nom, catégorie, description, mots-clés). Le créateur en devient l’administrateur et le groupe est enregistré sur l’appareil.
5. **Entreprises et collaborations** : annuaire avec fiches et localisation. Collaborations en trois rubriques : *Explorer*, *Mes annonces* (propositions reçues, accepter ou refuser) et *Mes propositions*, avec une conversation par proposition (réponses automatiques simulées).
6. **Signalements** : deux familles. **Sécurité** : individu agressif, comportement dangereux, sentiment d’insécurité, manifestation, passage dangereux, rue mal éclairée. Elles sont prises en compte par les itinéraires, et les situations temporaires expirent (3 h pour un individu agressif, 6 h pour une manifestation…). **Infrastructure** : voir ci-dessous. Les signalements sont aussi accessibles pendant un trajet (bouton « Signaler » qui met le guidage en pause et place le signalement à la position actuelle). Catégories : lampadaire défectueux, graffiti, trottoir endommagé, nid-de-poule, mobilier urbain brisé. Emplacement choisi avec une mire sur la carte, description, photo (compressée localement). Les signalements sont visibles sur la carte et dans l’espace administration, et **clairement indiqués comme non transmis à la Ville** (renvoi au 311).

7. **Export des données (profil Ville)** : dans *Gestion › Tableau de bord*, une petite flèche ⬇ en haut à droite de chaque carte de données télécharge un instantané de ce jeu de données : signalements (CSV et GeoJSON), événements (CSV, avec participations), stationnements (GeoJSON au même format que `StationnementsMunicipauxHorsRues`), registre des entreprises et installations (CSV), arrêts d’autobus (CSV), éclairage (CSV) et groupes (CSV). Les CSV utilisent « ; » et l’UTF-8 avec BOM pour s’ouvrir directement dans Excel (`src/lib/exportData.ts`).

## Algorithme des itinéraires et score de sécurité (`src/lib/routing.ts`, `src/lib/safety.ts`, `src/lib/sun.ts`)

Deux propositions à pied : **le plus sûr** (notre score, affiché en premier et recommandé) et **le plus rapide** (le plus court, comme un GPS). Le **score de sécurité** (0 à 100 %) est mis en avant sur chaque trajet. Il est **indicatif** : aucun trajet n’est présenté comme garanti sécuritaire.

**Score d’un point** (le trajet est découpé tous les 10 m) : `s = 0,65·L + 0,25·N + 0,10·A + V + B` (ramené entre 0 et 1).

| Terme | Calcul |
|---|---|
| **L** lumière | `L = J + (1 − J)·E`. **J** = lumière du jour selon la position du soleil à Québec à la date et à l’heure du trajet (1 au-dessus de +6°, 0 sous −6°, transition au crépuscule) : suit les saisons. **E** = lampadaires actifs du fichier d’éclairage (somme gaussienne selon la distance et la puissance). Un lampadaire inactif ou signalé défectueux ne compte pas ; « Rue mal éclairée » baisse E autour du point. |
| **N** animation | Rue (selon l’heure), commerces du registre ouverts à cette heure (horaires types par catégorie : bars et restos le soir, cafés et boutiques le jour, bureaux de 8 h à 17 h…), événements en cours à moins de 150 m. |
| **A** aide | `max(e^(−d_police/600 m), 0,7·e^(−d_refuge/150 m))` : poste de police (24/7) ou lieu refuge ouvert (dépanneur, pharmacie, bar, restaurant, hôtel, gare). |
| **V** type de voie | Ruelle −0,10 ; rue principale (boulevard, rue commerçante) +0,05. |
| **B** arrêt d’autobus | +0,05 à moins de 30 m d’un arrêt du RTC (jusqu’à 60 m en diminuant). |

**Score du trajet** = `100 × (0,7·moyenne + 0,3·moyenne des 10 % pires points) − pénalités d’alertes` (pénalités plafonnées à 45). Le « maillon faible » empêche qu’un passage sombre disparaisse dans la moyenne.

**Alertes de sécurité** : une alerte baisse le score sans jamais bloquer une rue. Pénalité = `gravité × proximité × fraîcheur × confiance`, comptée une fois au point le plus proche du trajet.

| Catégorie | Gravité | Demi-vie |
|---|---|---|
| Individu agressif | 25 | 1 h |
| Comportement dangereux | 20 | 1 h |
| Manifestation | 12 | 2 h |
| Passage dangereux | 10 | 14 j |
| Sentiment d’insécurité | 8 | 7 j |
| Rue mal éclairée | 0 (agit sur l’éclairage) | — |

Proximité : 1 dans la moitié du rayon, puis 0 au bord. Fraîcheur : `0,5^(âge / demi-vie)`. Confiance : `1 + 0,15·log₂(1 + appuis)` (max 1,5). Les signalements d’infrastructure (graffiti, trottoir, nid-de-poule, mobilier) et les chantiers ne comptent pas, sauf le lampadaire défectueux (via l’éclairage).

**Calcul des trajets** : le plus rapide = plus court chemin (OSRM / OpenStreetMap si joignable, sinon Dijkstra sur la distance). Le plus sûr = Dijkstra avec `coût d’un tronçon = longueur × (1 + 3·(1 − s)) + pénalités d’alertes`, puis géométrie réelle OSRM via les points du corridor. Les deux tracés reçoivent le même score ; s’ils sont identiques, ils sont fusionnés.

**Heure du calcul** : le bouton Jour / Nuit de la fiche Trajets règle l’heure d’évaluation. Auto = maintenant ; Nuit = ce soir 22 h s’il fait encore jour (simulation) ; Jour = 13 h. Les heures sont celles de Québec, quel que soit le fuseau de l’appareil.

## Carte

- **Vraie carte** : fond vectoriel **OpenFreeMap** (OpenStreetMap / OpenMapTiles), restylé par programme (jour / nuit) et enrichi de bâtiments 3D. Si ce service ne répond pas, l’application bascule sur les tuiles **CARTO** (OpenStreetMap elles aussi).
- Sans aucune connexion, une **carte stylisée hors-ligne** du quartier est dessinée (rues, îlots 3D, rivière Saint-Charles, falaise).
- **Réseau de rues calé sur les données réelles** : la trame de Saint-Roch (`src/data/streets.ts`) est ajustée sur les coordonnées des arrêts du RTC (`stops.txt`). Les 32 arrêts du cœur du quartier sont à 4 m en médiane de la rue modélisée, tous à moins de 10 m. Ce réseau sert à l’éclairage de secours, au placement des commerces et des installations, et aux itinéraires hors-ligne. En ligne, les itinéraires suivent les vraies rues d’OpenStreetMap (OSRM).
- Couches : stationnements, événements, lieux, signalements, éclairage (carte de chaleur des lampadaires).

## Remplacer les données fictives par les vraies

Les données de la Ville sont lues au démarrage depuis **`public/donnees/`**, dans leur format d’origine :

| Fichier | Jeu de données de la Ville | Colonnes clés |
| --- | --- | --- |
| `eclairage.xlsx` | Éclairage public (« GI - LU quartier St-Roch ») | `COORDONNEE_X`, `COORDONNEE_Y` (MTM zone 7), `STATUT_ACTIF`, `WATT_LAMPE_CODE`, `SOURCE_LUMINAIRE_CODE`, `ANNEE_INSTALLATION`, `NOM_TOPONYMIE` |
| `stationnements.geojson` | Stationnements municipaux hors rue (GeoJSON « StationnementsMunicipauxHorsRues ») | `NOM`, `ADRESSE_À_PROXIMITÉ`, `NOMBRE_DE_CASES`, `TYPE_INT_EXT`, `QUARTIER`, `ARRONDISSEMENT` + géométrie Point |
| `installations.xlsx` | Liste des installations (équipements municipaux) | `Arrondissement_0`, `Nom_Type_No_Installation_calculé`, `Adresse`, `Type d'équipement texte` |
| `stops.txt` | Arrêts d’autobus du RTC — fichier `stops.txt` du GTFS (données ouvertes du RTC), copié tel quel | `stop_id`, `stop_code`, `stop_name`, `stop_lat`, `stop_lon`, `location_type`, `wheelchair_boarding` |
| `postes-police.geojson` | Postes de police (GeoJSON, WGS84) — utilisés par le score de sécurité | `NOM`, `ADRESSE`, `TELEPHONE`, `HORAIRE` (« 24/7 »), `POSITION` (« approximative » si à vérifier) |
| `commerces.xlsx` | Registre des entreprises (« DEGP - Entreprises St-Roch ») | `Type rue`, `Nom rue`, `Marque de Commerce` |
| `evenements.xlsx` | Événements à venir | `Titre PROJET`, `Site(s) de l'activité`, `Quartier`, `Date et heure de début`, `Date et heure de fin`, `Type d'activité`, `Catégorie Web`, `Coût`, `Diffusion COM` |

Les fichiers fournis sont **fictifs** (sauf les quelques lignes d’exemple fournies) mais ont exactement les mêmes colonnes. Pour passer aux vraies données, **remplacez les deux fichiers** (même nom ; `.xlsx` ou `.csv`). Aucune modification de code n’est nécessaire. Régénérer les fichiers fictifs (dates recalculées à partir d’aujourd’hui) : `npm run donnees:fictives`.

**Éclairage.** Les coordonnées MTM zone 7 (EPSG:32187) sont converties en GPS. Chaque luminaire actif reçoit une intensité ≈ lumens / 20 000 (puissance × efficacité selon la source : DEL, sodium HPS, halogénures…). L’éclairage en un point est la somme gaussienne des luminaires voisins (σ ≈ 28 m). Cet indice alimente le graphe des rues, l’évaluation des itinéraires, la carte de chaleur et les statistiques de l’espace Ville.

**Événements.** Les listes au format SharePoint (`56;#Animation;#59;#Événement`) sont décodées. Le fichier n’ayant pas de coordonnées, le champ `Site(s) de l'activité` est géolocalisé par nom grâce au répertoire `SITES` de `src/lib/eventsParse.ts` (à compléter au besoin). Seuls les événements à Saint-Roch sont conservés (site reconnu ou `Quartier` = Saint-Roch). Les lignes « Ne pas diffuser » sont ignorées. Une heure `00:00` indique un événement d’une journée entière, et un site non reconnu place l’événement au centre du quartier (« lieu approximatif »).

**Entreprises.** Le registre ne contient ni numéro civique ni coordonnées. Chaque entreprise est donc placée à une position approximative, mais stable d’un chargement à l’autre, le long de sa rue (« Type rue » + « Nom rue », reconnue même avec ou sans article : « Couronne », « de la Couronne »). La catégorie (restaurant, café, services, techno, hébergement, organisme…) est déduite du nom. Les entreprises d’une rue absente du réseau simplifié restent dans l’annuaire, et l’espace Ville liste ces rues. Elles apparaissent dans l’annuaire, la recherche et sur la carte (points colorés à partir du zoom 15).

**Installations municipales.** « Nom - Type - Arrondissement - Code » est découpé, et l’adresse (« 350 Rue Saint-Joseph E, Québec, QC G1K 2T6 ») est analysée : numéro civique, rue, code postal. Le jeu couvrant toute la ville, seules les installations de Saint-Roch sont gardées (code postal G1K ou rue du quartier). Position : celle du lieu connu du même nom, sinon estimée à partir du numéro civique sur la rue. Les installations apparaissent dans l’annuaire (filtre « Installations municipales ») et sur la carte.

**Postes de police.** `public/donnees/postes-police.geojson` contient le poste fourni : Sûreté du Québec, Autoroutier de Québec (5005 boul. Pierre-Bertrand, 418 623-6249). Sa position est **approximative** (à vérifier) : le géocodage n’a pas pu être fait hors-ligne. Ce poste est à environ 6 km de Saint-Roch, donc son effet sur le score est faible : ce sont surtout les lieux refuges ouverts qui comptent. Ajoutez d’autres postes (par exemple ceux du SPVQ) dans le même fichier.

**Arrêts d’autobus (données réelles).** `public/donnees/stops.txt` est le vrai fichier du RTC (4 308 arrêts, dont 119 à Saint-Roch et aux abords). Le nom affiché vient de `stop_desc` (« Charest Est / de la Couronne »), et le bouton « Horaires » ouvre la page de l’arrêt sur le site du RTC (`stop_url`). Pour le mettre à jour, téléchargez le GTFS du RTC (données ouvertes), extrayez `stops.txt` du ZIP et copiez-le dans `public/donnees/`. Seuls les arrêts de Saint-Roch et des abords sont affichés, et les stations parentes (`location_type` ≠ 0) sont ignorées. Les arrêts apparaissent sur la carte (couche « Bus »), dans la recherche et dans une fiche (numéro d’arrêt, accessibilité, lieux à proximité, itinéraire à pied). En mode Trajets, toucher un arrêt le choisit comme destination.

**Stationnements.** Seuls les stationnements municipaux du GeoJSON sont affichés (coordonnées longitude/latitude ; MTM zone 7 aussi acceptée), avec uniquement les champs du jeu : nom, adresse, nombre de cases, intérieur/extérieur, quartier, arrondissement.

**Import ponctuel.** Le profil Ville peut aussi importer un fichier depuis Gestion → Tableau de bord. Le fichier est lu sur l’appareil, n’est envoyé nulle part et a priorité jusqu’à la réinitialisation.

> Si un jeu est soumis à l’entente de confidentialité du hackathon, ajoutez `public/donnees/` au `.gitignore` avant de committer les vrais fichiers.

## Données et persistance

- Données fictives dans `src/data/` (inspirées des jeux de données du hackathon : éclairage public, stationnements hors rue, registre des entreprises, événements, organismes).
- `localStorage` (Zustand persist) : profil, thème, favoris, participations, groupes rejoints, messages, signalements, annonces, propositions, évaluations, session de stationnement. Le menu permet de réinitialiser la démo.

## Structure

```
src/
  App.tsx              coquille : carte, barre d’onglets, panneaux, superpositions
  map/                 MapView (MapLibre), styles de carte, marqueurs et tracés
  lib/                 géo, moteur d’itinéraires, stores, actions transversales
  data/                données fictives
  screens/             profil, explorer, trajets, parking, événements, groupes,
                       entreprises/collaborations, signalements/administration
  components/          bottom sheet, icônes, composants d’interface
```

Technologies : React 18, TypeScript, Vite, MapLibre GL, Framer Motion, Zustand, Lucide.
