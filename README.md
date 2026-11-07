# Fiido Explorer — application Android

Ce dossier fabrique l'application Android de Fiido Explorer. Rien n'est à compiler sur un ordinateur : GitHub s'en charge.

- **L'interface** est chargée depuis la page GitHub Pages du dossier `fiido`. Une mise à jour de `index.html` y suffit, sans réinstaller l'application.
- **Cette application** ajoute ce qu'une page web ne peut pas faire : continuer à enregistrer un trajet écran éteint ou pendant qu'une autre application est utilisée (Bluetooth et GPS natifs, notification « Trajet en cours »).

## Compiler

À chaque modification de ce dossier, GitHub compile l'APK (onglet **Actions**, environ 5 minutes) et le publie dans **Releases**. On peut aussi relancer une compilation à la main : Actions › Construire l'APK › Run workflow.

La clé de signature est stockée dans les secrets du dossier (`KEYSTORE_B64` et `KEYSTORE_PASSWORD`). Sans elle, ou avec une autre clé, le téléphone refuserait d'installer les nouvelles versions par-dessus l'ancienne.

## Contenu

| Fichier | Rôle |
|---|---|
| `package.json` | Capacitor et les modules Bluetooth, GPS en arrière-plan et notifications |
| `capacitor.config.json` | Nom de l'app, adresse de l'interface, textes de recherche du vélo |
| `www/offline.html` | Page affichée si l'app démarre sans internet |
| `scripts/prepare.js` | Adapte le projet Android : version, signature, icônes, écran de démarrage, notification |
| `resources/android/` | Icônes de l'app et de la notification |
| `.github/workflows/build.yml` | La compilation automatique |
