# Bulle

Application à deux : Le Sofa, Instants, À deux (jeux et scores), Envies, Prière.
React + Vite + TypeScript. Les données vivent dans un Google Sheets, les photos dans Google Drive, via un petit Apps Script qui sert d'API. Hébergement : GitHub Pages.

Installation : voir [INSTALL.md](./INSTALL.md).

## Fonctionnement

- **Copie locale + synchro** : l'app affiche tout de suite la dernière copie connue, puis se met à jour depuis le Sheets (au démarrage, au retour sur l'app et toutes les 2 minutes). Chaque modification s'affiche immédiatement et part en arrière-plan ; sans réseau, elle attend et repart toute seule. L'indicateur en haut à droite montre ce qui est en attente.
- **Accès** : un code secret commun, demandé une fois par téléphone, puis « Qui utilise ce téléphone ? ».
- **Partagé entre vous deux** : thème, couleurs, date « ensemble depuis », prénoms.
- **Photos** : rangées dans `Bulle/Photos` sur Drive, en lien non listé.

## Structure

```
apps-script/Code.gs    API Google Apps Script (à coller dans script.google.com)
content/               Banques de questions et de mots des jeux (une ligne = une entrée)
public/                Icônes, manifest et service worker (PWA)
src/
├── App.tsx            Navigation, synchro, création d'instant
├── components/        UI, écran de connexion, indicateur de synchro
├── pages/             Le Sofa, Instants, À deux, Envies, Prière
├── stores/            Zustand
├── services/
│   ├── api.ts         Client générique : copie locale, file d'attente, appels
│   ├── db.ts          Fonctions métier par table
│   └── settings.ts    Réglages partagés et prénoms
└── styles/ui.css      Classes communes basées sur les variables du thème
```

## Modifier le contenu des jeux

Éditer les fichiers de `content/` puis pousser sur GitHub : le site se redéploie tout seul.

- `tupreferes.txt` : une ligne = `option A | option B`.
- `chronomots.txt` : une ligne = un mot ; `# Catégorie` commence une nouvelle catégorie.
- `versets.txt` : une ligne = `référence | texte | mot à retrouver` (Louis Segond 1910). Le mot doit apparaître tel quel dans le texte.

La question du jour et le défi de la semaine sont rangés dans l'onglet `settings` du Sheets (lignes `qdj:…` et `defi:…`).
