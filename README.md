# Saint-Roch Connect

Prototype fonctionnel de hackathon pour reconnecter citoyens, commerces, organismes et ville dans Saint-Roch.

## Démarrer

```bash
npm install
npm run dev
```

Pour vérifier la compilation : `npm run build`.

## Démonstration (3 à 5 minutes)

1. Depuis l’accueil, ouvrir **Explorer le quartier**, rechercher un lieu et sélectionner une catégorie.
2. Dans **Événements**, filtrer les activités gratuites, ajouter un favori et cliquer sur **Je participe**.
3. Dans **Mon Saint-Roch**, choisir des intérêts et observer les recommandations.
4. Dans **Mode démo → Commerçant**, créer un événement : il est conservé après actualisation.
5. Passer au **mode Ville**, publier une annonce puis l’archiver.
6. Ouvrir **Signaler un problème**, sélectionner un graffiti ou une saleté, ajouter une photo facultative, renseigner le repère et envoyer. La notification apparaît dans le tableau municipal.

## Limites

- Les données sont fictives et ne constituent pas des annonces officielles.
- Le sélecteur de rôle est une simulation locale, pas une authentification.
- `localStorage` n’est pas un stockage sécurisé ni multi-utilisateur.
- OpenStreetMap nécessite une connexion pour charger ses tuiles.
- La validation avancée et les tests automatisés sont prévus pour la prochaine itération.
- Les notifications de propreté sont simulées dans `localStorage` ; un backend réel sera nécessaire pour alerter une brigade en production.

Voir [ARCHITECTURE.md](ARCHITECTURE.md) et [TECHNOLOGIES.md](TECHNOLOGIES.md).