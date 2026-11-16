# Aube - réveil intelligent (Android)

Réveil qui sonne au moment le plus « léger » d'une fenêtre avant l'heure cible, d'après
les mouvements enregistrés par le téléphone posé sur le matelas. Au plus tard, il sonne
toujours à l'heure cible.

Depuis la 1.3.0 : détection automatique de l'endormissement (sans bouton), aube lumineuse
avant le réveil et sons de nature.

Anciennement « Smart Clock ». L'identifiant Android `com.poirouxmartin.smartclock` est conservé : les nouvelles versions s'installent par-dessus les anciennes sans perdre les nuits enregistrées.

## Installation

Télécharger le fichier `aube-vX.Y.Z.apk` de la dernière version sur la page des
[releases](https://github.com/poirouxmartin/smart_clock/releases/latest), puis l'ouvrir
sur le téléphone (Android 7 ou plus ; autoriser l'installation d'applis inconnues si
Android le demande). Les nouvelles versions s'installent par-dessus les anciennes, et
l'appli propose elle-même les mises à jour depuis la 1.4.1.

## Avertissement

Projet personnel, fourni tel quel, sans garantie d'aucune sorte. Ce n'est pas un
dispositif médical : les phases de sommeil affichées sont des estimations à partir des
mouvements du téléphone. Ne pas s'en servir comme seul réveil pour un rendez-vous
important tant qu'il n'a pas été vérifié sur son propre téléphone.

## Utilisation

1. Accueil : régler l'heure cible, les jours et la fenêtre (10/20/30/45 min, 30 par défaut).
   « Détection automatique » est active par défaut ; elle peut être désactivée.
2. Corriger les autorisations signalées (alarmes exactes, notifications plein écran,
   notifications ; optimisation batterie recommandée ; activité physique optionnelle pour
   la détection automatique).
3. Mode automatique : rien à faire le soir, l'app détecte l'endormissement (voir ci-dessous).
   Mode manuel : « Commencer la nuit maintenant », puis poser le téléphone sur le matelas,
   branché. L'écran peut être éteint.
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
  - `WakeDecider` : décision de réveil dans la fenêtre (voir « Fenêtre de réveil »).
  - `RingService` + `AlarmActivity` : sonnerie en usage « alarme », montée progressive du
    volume, vibration, écran plein par-dessus le verrouillage.
  - `AutoManager`, `ProbeReceiver`, `SleepApiReceiver`, `SleepOnsetDetector` : détection
    automatique de l'endormissement (voir « Détection automatique »).
  - `AutoSchedule`, `UsualBedtime` : planning quotidien et heure de coucher habituelle.
  - `DawnActivity`, `DawnCurve` : aube lumineuse (voir « Aube lumineuse »).
  - `VolumeRamp`, `NatureSound` : sons de nature et montée de volume (voir « Sons de nature »).
- `src/modules/night` : analyse de la nuit (JS) et résumés stockés en SQLite.
- Science et limites : [docs/SCIENCE.md](docs/SCIENCE.md), justification du réveil :
  [docs/science-reveil.md](docs/science-reveil.md). État du projet :
  [docs/STATE.md](docs/STATE.md).

### Détection automatique

Une alarme quotidienne est armée pour l'heure et les jours choisis. Elle sonne même si
aucun endormissement n'a été détecté.

- Heure de coucher habituelle : médiane circulaire des 14 derniers endormissements
  détectés, 23 h par défaut.
- De ~3 h avant l'heure de coucher habituelle jusqu'à 1 h avant l'alarme, une alarme
  exacte « sonde » le téléphone toutes les 15 min pendant 5 s : état de l'écran, charge,
  immobilité de l'accéléromètre, luminosité ambiante, et dernière confiance « sommeil »
  de l'API Sleep de Google Play Services (permission `ACTIVITY_RECOGNITION`, facultative).
- Score pondéré : Sleep API 0,45 · immobilité 0,25 · obscurité 0,15 · heure habituelle
  0,10 · charge 0,05. Écran allumé = veto.
- 2 sondes consécutives à 0,6 ou plus : endormissement = première sonde de la série.
  Le suivi de nuit par accéléromètre démarre alors (service de premier plan, autorisé car
  lancé par une alarme exacte).
- Faux départ (réveil dans les 45 min suivant l'endormissement) : la nuit est annulée et
  la détection reprend.
- Réveil naturel dans les 90 min avant la fenêtre : notification « Déjà réveillé·e ? »
  avec le bouton « Annuler le réveil ».
- Le bouton « Commencer la nuit maintenant » reste disponible.
- Batterie : aucun capteur continu le jour ; environ 12 sondes courtes par soirée. L'API
  Sleep est calculée par Play Services. Les optimisations batterie du système ou du
  constructeur peuvent retarder les sondes.

### Aube lumineuse

- `DawnActivity` s'affiche par-dessus l'écran verrouillé à partir de 30 min avant l'alarme
  (15, 30 ou 45 min au choix).
- Luminosité de l'écran de 1 % à 100 % (courbe quadratique), couleur de rouge sombre à
  orange puis blanc chaud.
- Lampe torche optionnelle, dans les 20 % finaux de l'aube (niveaux d'intensité sur
  Android 13 et plus, API 33). Désactivée par défaut.
- Un appui sur l'écran l'éteint. L'aube se termine avec la sonnerie.

### Sons de nature

- Oiseaux, vagues, forêt, pluie, ruisseau, orage : boucles sans couture de 60 s,
  synthétisées par `scripts/generate_nature_sounds.py` (CC0, voir
  [docs/sounds-license.md](docs/sounds-license.md)). Aucune sonnerie système.
- Montée de volume perceptuelle (exponentielle) depuis 2 % sur 60 s par défaut (30, 60 ou
  120 s).
- Pour les sons de nature, la vibration ne démarre qu'après la montée.
- Bouton d'aperçu dans les réglages des sons.

### Fenêtre de réveil

`WakeDecider.decide` : fenêtre de 30 min par défaut. Dans la fenêtre, l'alarme sonne dès :

- (a) un mouvement au-dessus du seuil personnel (90e centile des mouvements de la nuit
  précédant la fenêtre, minimum 1,0) ;
- (b) un mouvement soutenu : 2 époques sur les 3 dernières à 0,6 × seuil ou plus ;
- (c) une confiance Sleep API à 30 ou moins, avec un peu de mouvement.

Le seuil est multiplié par 0,85 près d'une limite de cycle de 90 min (±15 min), après
l'endormissement estimé (nuit manuelle : endormissement = début + 15 min). Sans signal,
l'alarme sonne à l'heure cible.

Justification : [docs/science-reveil.md](docs/science-reveil.md).

## Développement

```bash
npm install
npm test                      # jest : 139 tests, 11 suites
npx tsc --noEmit              # le flux principal est typé ; du code legacy reste en erreur
cd android && ./gradlew :smart-alarm:testDebugUnitTest assembleRelease   # 64 tests Kotlin
```

Tests Kotlin : `WakeDecider`, `SleepOnsetDetector`, `AutoSchedule`, `UsualBedtime`,
`DawnCurve`, `VolumeRamp`, `NatureSound`.

Icônes : `python scripts/generate_icons.py` régénère `assets/` et les mipmaps Android à partir d'un dessin vectoriel (soleil levant sur l'horizon).

`android/` est versionné (config de signature release) : ne pas lancer
`expo prebuild --clean`, qui l'écraserait. Release : pousser un tag `v*` et la CI
(`.github/workflows/release-apk.yml`) publie l'APK signé avec la clé release. En local,
sans `keystore.properties`, l'APK est signé avec la clé de debug.

## Licence

MIT, voir [LICENSE](LICENSE). Sons de nature : CC0, voir
[docs/sounds-license.md](docs/sounds-license.md).
