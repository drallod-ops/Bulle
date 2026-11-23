# Installer Bulle

Compter une quinzaine de minutes. Le dossier Drive `STRIPH/Bulle`, le sous-dossier `Photos` et le Google Sheets `Bulle - Données` existent déjà.

## 1. L'Apps Script (l'API)

1. Ouvrir le Google Sheets **Bulle - Données**, puis **Extensions → Apps Script**.
2. Effacer le contenu de `Code.gs` et coller celui de `apps-script/Code.gs`.
3. Ligne `INITIAL_SECRET`, remplacer `CHANGE-MOI` par votre code secret (une phrase que vous retiendrez tous les deux).
4. Enregistrer, choisir la fonction **setup** dans la liste en haut, cliquer **Exécuter**. Google demande des autorisations (Sheets, Drive, déclencheurs) : les accepter. Le journal doit afficher « Bulle prêt ».
5. Remettre `INITIAL_SECRET = 'CHANGE-MOI'` et enregistrer : le code est maintenant stocké dans les propriétés du script, pas dans le code.
6. **Déployer → Nouveau déploiement** → type **Application Web** :
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
7. Copier l'URL qui se termine par `/exec`.

« Tout le monde » est nécessaire pour que l'app puisse appeler le script ; sans le code secret, le script refuse toute lecture ou écriture.

Après une modification de `Code.gs` : **Déployer → Gérer les déploiements → crayon → Version : nouvelle version**. L'URL ne change pas.

Pour changer le code secret plus tard : **Paramètres du projet → Propriétés du script → SECRET**. Il faudra le saisir à nouveau sur chaque téléphone.

## 2. Le dépôt GitHub

1. Créer un nouveau dépôt (par exemple `bulle`) et y pousser le contenu de ce dossier.
2. **Settings → Pages → Source : GitHub Actions**.
3. **Settings → Secrets and variables → Actions → onglet Variables → New repository variable** :
   - Nom : `VITE_API_URL`
   - Valeur : l'URL `/exec` de l'étape 1.
4. Onglet **Actions** : le déploiement se lance à chaque push sur `main` (ou à la main avec « Run workflow »).

L'app sera sur `https://<votre-pseudo>.github.io/bulle/`.

Sans la variable `VITE_API_URL`, l'app fonctionne quand même : elle demande l'URL au premier lancement.

## 3. Sur chaque téléphone

1. Ouvrir l'adresse, saisir le code secret.
2. La première fois seulement : vos deux prénoms.
3. Choisir qui utilise ce téléphone.
4. Safari → Partager → **Sur l'écran d'accueil** (ou menu Chrome → Installer l'application).

## En local

```bash
npm install
cp .env.example .env.local   # puis y mettre l'URL /exec
npm run dev
```

## À savoir

- Chaque appel au Sheets prend environ une seconde : c'est pour ça que l'app travaille sur une copie locale et synchronise en arrière-plan.
- Si vous modifiez une même chose au même moment sur les deux téléphones, la dernière modification enregistrée l'emporte.
- L'envoi d'une photo demande du réseau ; le reste fonctionne hors ligne.
- Ne pas renommer les onglets ni la première ligne du Sheets : l'API s'appuie dessus. Ajouter des lignes ou corriger un texte à la main ne pose pas de problème.
