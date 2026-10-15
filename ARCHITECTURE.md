# Architecture — Saint-Roch Connect

Le prototype est une SPA React + TypeScript. Les données de démonstration sont dans `src/data.ts`, séparées de l’interface. Les modifications utilisateur sont persistées dans `localStorage` via des clés dédiées (`demo-events`, `demo-updates`, `favorites`, `going`, `interests`). Cette couche pourra être remplacée par un adaptateur Supabase ou une API Node.js sans changer les pages.

- **UI** : composants fonctionnels, CSS responsive mobile-first, icônes Lucide.
- **Navigation** : React Router avec routes publiques et tableaux de bord de démonstration.
- **Carte** : React Leaflet + OpenStreetMap, sans clé API.
- **Rôles** : simulateur local clairement identifié, sans prétention d’authentification.
- **Confidentialité** : aucune donnée personnelle réelle, aucune géolocalisation automatique, données fictives identifiées dans l’interface.
- **Signalements** : le formulaire citoyen accepte une catégorie, une description, une photo facultative et une position obtenue uniquement après action explicite. Le signalement est conservé localement et affiché comme notification dans le tableau municipal de démonstration.
