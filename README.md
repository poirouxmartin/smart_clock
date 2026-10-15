# Smart Clock - réveil intelligent (Android)

Réveil qui sonne au moment le plus « léger » d'une fenêtre avant l'heure cible, d'après
les mouvements enregistrés par le téléphone posé sur le matelas. Au plus tard, il sonne
toujours à l'heure cible.

## Utilisation

1. Accueil : régler l'heure cible et la fenêtre (10/20/30/45 min, 30 par défaut).
2. Corriger les autorisations signalées (alarmes exactes, notifications plein écran,
   notifications ; optimisation batterie recommandée).
3. « Commencer la nuit », puis poser le téléphone sur le matelas, branché. L'écran peut
   être éteint.
4. Au réveil, appuyer sur « Arrêter » : le résumé de la nuit s'affiche (durée, phases
   estimées calme/léger/éveil, type de réveil).

« Tester l'alarme » déclenche une sonnerie dans 10 s, ce qui permet de vérifier le son et
l'affichage sur l'écran verrouillé.

## Fonctionnement

- `modules/smart-alarm` : module natif Kotlin (module Expo local).
  - Alarme de secours `AlarmManager.setAlarmClock` à l'heure cible : exacte, fonctionne
    en Doze, avec l'app tuée, et après un redémarrage (re-armée au boot).
  - `SleepTrackingService` : service de premier plan, accéléromètre à 20 Hz, époques
    d'une minute, fichier de nuit JSON local.
  - `WakeDecider` : dans la fenêtre, sonne à la première époque dont le mouvement est
    dans le top 10 % de la nuit (et au-dessus d'un seuil minimal).
  - `RingService` + `AlarmActivity` : sonnerie en usage « alarme », montée progressive du
    volume, vibration, écran plein par-dessus le verrouillage.
- `src/modules/night` : analyse de la nuit (JS) et résumés stockés en SQLite.
- Science et limites : [docs/SCIENCE.md](docs/SCIENCE.md). État du projet :
  [docs/STATE.md](docs/STATE.md).

## Développement

```bash
npm install
npm test                      # jest
npx tsc --noEmit              # le flux principal est typé ; du code legacy reste en erreur
npx expo prebuild --platform android --clean
cd android && ./gradlew :smart-alarm:testDebugUnitTest assembleRelease
```

Dans `android/gradle.properties`, définir `reactNativeArchitectures=arm64-v8a,x86_64`
pour un APK plus léger. La release est signée avec la clé de debug (usage personnel).
