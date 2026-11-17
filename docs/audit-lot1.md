# Audit lot 1 : bugs d'alarme B1 à B5 et code mort (2026-11-17)

Branche `dev/poiroux/audit-lot1` depuis `master` (`570ecc9`, v1.4.3). Non poussée, non publiée.
Source des bugs : rapport d'audit du 16/11 (B1 à B5).

## Correctifs

Règles de transition pures dans `modules/smart-alarm/android/src/main/java/expo/modules/smartalarm/AlarmPolicy.kt`.
Tests dans `.../src/test/java/expo/modules/smartalarm/AlarmPolicyTest.kt`.

| Bug | Correctif | Test |
|---|---|---|
| B1 état `ringing` bloqué si le process meurt | `AutoManager.recoverStaleRinging` (30 min sans sonnerie vivante ni snooze en attente, immédiat après un boot) appelé dans `rearm`, `AlarmReceiver.onFire`, `BootReceiver`, et par une sonde chien de garde armée au début de la sonnerie (`RingService`). Snooze en attente réarmé au boot. | `b1_deadRingIsStaleAfterGrace`, `b1_liveRingOrPendingSnoozeIsKept`, `b1_afterBootNoGraceButSnoozeKept` |
| B2 réveil smart avant la cible puis re-sonnerie à la cible | `AlarmPolicy.planRearm` : une cible servie par une sonnerie de moins de 3 h avant elle est consommée, la recherche repart après elle. | `b2_smartWakeBeforeTargetDoesNotRearmSameTarget`, `b2_oldRingDoesNotSkipTodaysTarget` |
| B3 rien après un redémarrage non déverrouillé | `Prefs.kt` (stockage protégé par l'appareil, migration au premier déverrouillage) pour AlarmStore, AutoStore, NightSession, WakeOptions ; `LOCKED_BOOT_COMPLETED` ; 6 composants d'alarme `directBootAware` ; React Native chargé après déverrouillage (`MainApplication.kt`, `MainActivity.kt`). | `b3_alarmComponentsAreDirectBootAware` (manifeste) |
| B4 zéro jour coché | Déjà désarmé sur master ; le désarmement coupe aussi Sleep API, aube et sondes. | `b4_noDayDisarms` |
| B5 ouvrir l'appli vide les sondes de la soirée | Sondes vidées seulement si la cible change. | `b5_sameTargetKeepsProbes`, `b5_newTargetClearsProbes` |

## Code mort retiré

Graphe d'import depuis `index.ts` / `App.tsx` : 0 fichier injoignable après suppression.
Supprimés : écrans Login, Signup, Onboarding, EnrichedOnboarding, AlarmSetup, SleepAnalysis,
DevTools ; modules `alarm-engine`, `auth`, `notifications`, `bedtime-calculator` (tests inclus) ;
`AnimatedButton`, `AnimatedCard`, `useAnimatedStyles`, `constants/index.ts`, `navigation/types.ts`.
`AppNavigator.tsx` et `RootStackParamList` réduits aux 7 écrans réels.

Gardés pour un lot suivant : `light-controller`, `sound-manager` (encore atteints par Réglages et
Lumières) et les dépendances non importées (`expo-sensors`, `expo-bluetooth`,
`react-native-chart-kit`, `@shopify/flash-list`, `expo-device`, `expo-intent-launcher`...).

## Preuves

- Kotlin : `gradlew :smart-alarm:testDebugUnitTest :app:assembleDebug` : BUILD SUCCESSFUL,
  81 tests, 0 échec (72 avant + 9 `AlarmPolicyTest`).
- Jest : 131 pass / 131. Base master : 157 ; l'écart = 26 tests des modules morts supprimés
  (`AlarmEngine.test.ts` 17, `BedtimeCalculator.test.ts` 9). Aucun autre test touché.
- `tsc` : 18 erreurs, toutes dans le code legacy conservé (`light-controller`, `sound-manager`,
  `LightsScreen`), aucune dans un fichier modifié.

## Non vérifié

- B3 sur appareil : redémarrage avec code PIN sans déverrouiller, puis alarme. Risque principal :
  init Expo / React Native en direct boot, évitée par la garde de `MainApplication`.
- Aucune nuit réelle avec ces correctifs.
