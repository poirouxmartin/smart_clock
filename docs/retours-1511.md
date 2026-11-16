# Retours du 15/11/2026 : réveil doux, thèmes, détection

Retours d'un test d'Aube sur une nuit réelle :

1. L'interface fait "cheap" ; demande de thèmes, dont un thème nature.
2. Le réveil a joué une sonnerie d'alarme par défaut, au lieu d'un réveil doux : lumière du téléphone qui monte, sons naturels (oiseaux, mer, forêt, orage…).
3. L'hypnogramme affichait "calme 99 %" toute la nuit, et le réveil a sonné à l'heure limite car aucun moment de sommeil léger n'a été détecté.

Tout est sur la branche `dev/poiroux/reveil-doux`, version 1.4.0 (versionCode 7), publiée le 15/11 en release GitHub `v1.4.0` (APK signé par la CI avec la clé release) : https://github.com/poirouxmartin/smart_clock/releases/download/v1.4.0/aube-v1.4.0.apk

## Hypothèse de version

La version installée sur le téléphone de test est inconnue (elle n'a pas pu être vérifiée).

- La 1.3.0 avait déjà les oiseaux par défaut.
- La 1.2.0 et avant n'avaient que la sonnerie système.

Deux cas :

- a) Le téléphone tournait en 1.2.0 ou avant : la sonnerie est entièrement expliquée.
- b) Il tournait en 1.3.0 : un des chemins ci-dessous a joué le son système.

Les deux cas sont couverts par les corrections. La nouvelle carte "Dernier réveil" de l'écran d'accueil affiche maintenant la version de l'app et le son réellement joué : après la prochaine nuit, on saura.

## Point 1 : sonnerie système (commits 8d0d516, 4466002)

Chemins trouvés en 1.3.0 qui pouvaient encore jouer la sonnerie système :

- un choix "Sonnerie système" dans la liste des sons ;
- `RingService` retombait sur la sonnerie d'alarme système quand l'identifiant du son n'était pas un son nature ;
- un appel `Ringtone` de dernier recours : en cas d'échec, Android substitue sa propre sonnerie ;
- l'aperçu du son retombait sur la sonnerie système ;
- le canal de notification `smart_alarm_ring` a pu être créé par une ancienne version (un canal est immuable sur Android).

Vérifié, pas en cause :

- les sons nature sont bien dans l'APK release 1.3.0 (contrôlé avec aapt2) ;
- `setAlarmClock` ne joue aucun son ;
- les anciens services de notification JS ne sont pas utilisés par l'écran d'accueil.

Corrections :

- plus aucune sonnerie système nulle part ;
- le son choisi est joué ; s'il échoue, les autres sons embarqués sont essayés ;
- un ancien choix "système" enregistré devient "Oiseaux" ;
- les sons sont référencés directement (pas par leur nom) pour que la réduction du build ne puisse pas les supprimer ;
- nouveau canal silencieux `aube_ring_silent`, ancien canal supprimé ;
- si aucun son ne peut être joué : la vibration démarre tout de suite, la lumière monte quand même, et l'échec est journalisé ;
- nouveau son "Orage" (pluie et tonnerre lointain), généré par procédé, CC0, licence dans `docs/sounds-license.md`.

Six sons disponibles : oiseaux, vagues, forêt, pluie, ruisseau, orage.

Volume : fondu depuis 2 % sur 30, 60 ou 120 s (réglage). Vibration seulement après le fondu.

## Point 2 : lumière progressive (commit 52bc984)

Avant : l'écran d'aube existait déjà (15, 30 ou 45 min avant l'heure limite), mais l'écran de sonnerie passait d'un coup en noir à 100 % de luminosité.

Maintenant : l'écran de sonnerie prolonge l'aube déjà affichée (plafonnée à 60 %) et monte jusqu'à la pleine lumière chaude, sur la même durée que le fondu du son.

Vérification sur émulateur (Pixel 8, APK release) : une sonnerie de test a journalisé `{"reason":"test","requested":"birds","played":"birds","player":"mediaplayer","error":""}`. L'écran de sonnerie est devenu crème chaud avec texte sombre, sans plantage.

## Point 3 : "Calme 99 %" (commits 70c0d33, a1984b3)

Trois causes trouvées ; (a) et (b) sont reproduites par un test, (c) est un comportement connu de certains téléphones, non observé ici :

- a) Le mouvement était mesuré sur la norme de l'accélération. Quand le téléphone s'incline parce que le dormeur se retourne, la norme reste à 9,81 m/s² : les retournements étaient presque invisibles. Test qui le reproduit (`EpochAccumulatorTest`) : une inclinaison de 30° en 2 s donnait 0,12 avec l'ancienne mesure (seuil 1,0, donc calme) et 47 avec la nouvelle mesure vectorielle.
- b) Le bilan de nuit jugeait la qualité du signal sur toute la nuit. Les manipulations du téléphone au coucher et à l'alarme le rendaient toujours "ok" : une nuit sans mouvement s'affichait en 99 % calme, sans avertissement. Test qui le reproduit (`nightAnalysis.test.ts`) : nuit de 8 h avec manipulation seulement aux deux bouts, désormais "signal faible".
- c) Certains téléphones arrêtent de livrer l'accéléromètre écran éteint, ce qui ressemblait exactement à un sommeil profond. Chaque minute enregistre maintenant le nombre d'échantillons reçus (environ 1200 attendus). Les minutes quasi vides sont affichées "Pas de données" (gris) avec un message précis. Le capteur est ré-enregistré à l'extinction de l'écran et après une minute sans données.

Laquelle de (a), (b), (c) a dominé la nuit testée ? Impossible à dire sans le fichier de nuit. Un téléphone posé hors du lit ne voit aucun mouvement : le bilan le dit maintenant et conseille de le poser sur le matelas près de l'oreiller.

La logique de réveil est inchangée (fenêtre de 30 min, déclenchement sur salve de mouvement, filet de sécurité à l'heure limite, voir `docs/science-reveil.md`). Sans mouvement détectable, l'alarme sonne à l'heure limite, par conception.

## Point 4 : visuel et thèmes (commit b1946f4)

Trois thèmes :

- Nature (par défaut) : verts de forêt, texte crème, accents ambre ;
- Nuit : l'ancien look, affiné ;
- Aube : lever de soleil chaud.

Carte de choix du thème sur l'accueil, mémorisé localement. Contraste vérifié par test (WCAG ≥ 4,5 pour le texte).

Accueil : salutation selon l'heure, date, cartes plus douces, icônes de section. Appliqué à l'accueil, au mode sommeil et au bilan de nuit. Les écrans anciens (Stats, Réglages…) gardent l'ancien look.

Note : l'écran Réglages montre encore d'anciennes préférences de son qui ne pilotent pas l'alarme (à nettoyer plus tard).

## Tests et build

- Jest : 116/116 (8 suites)
- Tests unitaires Kotlin : 54/54
- `tsc` : aucune nouvelle erreur (92 erreurs préexistantes dans des fichiers anciens, inchangées)
- `assembleDebug` et `assembleRelease` : OK
- Commit `bed1616` = version 1.4.0

## APK (locaux, non publiés)

- `android/app/build/outputs/apk/release/app-release.apk` : autonome, mais signé avec la clé de debug (la clé release n'existe qu'en CI). Il ne s'installe pas par-dessus la 1.3.0 de GitHub sans désinstaller d'abord, ce qui efface l'historique des nuits et les réglages locaux.
- `android/app/build/outputs/apk/debug/app-debug.apk` : nécessite le serveur Metro, inutilisable pour une nuit.

L'APK de la release `v1.4.0` (CI, clé release) s'installe par-dessus la 1.3.0 sans désinstaller : vérifié sur émulateur (versionCode 6 → 7, date de première installation conservée, appli lancée).

Aube 1.4.0 n'a aucun mécanisme de mise à jour : la 1.4.1 (ou suivante) devra être installée une dernière fois à la main.

## Point 5 : mise à jour proposée dans l'appli (commit ea03f4d, version 1.4.1)

- Au démarrage, au plus une fois par jour, Aube lit la dernière release GitHub (API `releases/latest`, premier asset `.apk`).
- Si elle est plus récente que la version installée, l'accueil affiche une bannière « Nouvelle version x.y.z disponible » avec un bouton Installer et un bouton Plus tard.
- Installer télécharge l'APK et vérifie le nom du paquet, que la version correspond et que le versionCode est supérieur. Si Android le demande, la bannière ouvre ensuite le réglage « Installer des applis inconnues » pour Aube, puis lance l'installeur Android (permission `REQUEST_INSTALL_PACKAGES`, FileProvider).
- Le dépôt des releases est une seule constante : `AppUpdater.RELEASES_REPO`, dans `modules/smart-alarm/android/src/main/java/expo/modules/smartalarm/AppUpdater.kt`. Le JS la reçoit du natif.
- Tests : Jest 131/131 (dont 15 sur la mise à jour), Kotlin 60/60 (dont 6 sur les URL acceptées), `tsc` sans nouvelle erreur.

**Test sur émulateur (fausse release locale)** :
- Une 1.4.0 de test pointait vers un serveur local publiant une release `v1.4.1` avec un vrai APK 1.4.1, les deux signés avec la même clé.
- Constaté dans l'ordre : la bannière est apparue, puis le téléchargement et les contrôles ont réussi, puis Android a demandé l'autorisation.
- Après « Update » dans l'installeur Android, l'appli est passée en 1.4.1 (versionCode 8, données conservées). Au relancement, plus de bannière.
- Captures : `docs/captures/maj-banniere.png`, `docs/captures/maj-installeur.png`.
- Ce redirigement vers le serveur local n'est pas commité.

**Dépôt privé, puis public.** Tant que le dépôt était privé, GitHub répondait 404 sans connexion à l'API et aux APK : l'appli n'a pas de jeton et ne doit pas en avoir. Décision : rendre `smart_clock` public (le 16/11, après la 1.4.2). Rien à changer dans le code.

## Point 6 : impossible d'arrêter l'alarme (retour du 16/11)

Constat : l'arrêt reposait sur trois choses, toutes trois fragiles :
- l'écran plein, qui exige l'autorisation « alarme plein écran » (Android 14+) ;
- sans cette autorisation, Android le remplace par une simple notification ;
- et l'appli ouverte n'affichait aucun bouton d'arrêt.

Corrections :
- Écran d'alarme par-dessus l'écran verrouillé : gros bouton Arrêter et bouton « Répéter dans 9 min ».
- Notification en priorité maximale, colorée, avec deux actions : Arrêter et Répéter.
- Dans l'appli ouverte : écran plein avec Arrêter et Répéter tant que l'alarme sonne. Pendant une répétition, un bandeau « Alarme reportée à HH:MM » propose « Arrêter l'alarme ».
- Si l'autorisation plein écran est refusée, l'appli la demande à l'ouverture et mène au bon réglage.
- Tests : `SnoozeTest` (Kotlin) et `ringUi.test.ts` (choix entre écran d'alarme, bandeau de report et rien, et demande d'autorisation).

Vérifié sur émulateur (Android API 37, sonnerie de test) :
- l'écran d'alarme s'ouvre écran verrouillé ;
- la répétition est programmée, puis annulée depuis l'appli ;
- la notification affiche ses actions ;
- l'écran dans l'appli fonctionne, et Arrêter coupe bien la sonnerie.

Captures : `docs/captures/alarme-ecran-verrouille.png`, `alarme-notification.png`, `alarme-dans-appli.png`, `alarme-permission-plein-ecran.png`.

À vérifier : au prochain réveil, l'écran plein apparaît téléphone verrouillé, et Arrêter coupe le son.

## À vérifier sur une vraie nuit

- [ ] Accueil > "Dernier réveil" : version 1.4.0 (7), son joué = celui choisi, lecteur `mediaplayer`, aucune erreur.
- [ ] Au réveil : pas de sonnerie système, son nature qui démarre très bas et monte, écran qui se réchauffe progressivement, vibration seulement après le fondu.
- [ ] Bilan de nuit : hypnogramme pas 100 % calme si tu as bougé. Si "Pas de données" ou le message sur le capteur apparaît, désactiver l'optimisation de batterie pour Aube et signaler la marque et le modèle du téléphone.
- [ ] Placement : téléphone sur le matelas, près de l'oreiller.
- [ ] Si réveil avant l'heure limite : noter si tu te sens reposé.
- [ ] Essayer le thème Nature et dire si le rendu convient.

## Décisions en attente

- Évolution possible, discutée mais non faite : sans signal de mouvement, réveiller sur une limite de cycle de 90 min prédite plutôt qu'à l'heure limite. Cela change l'algorithme convenu et demande un accord explicite.

## Version 1.4.2 (16/11)

Points 5 et 6 publiés en release `v1.4.2` (versionCode 9), fusionnée dans `master` : https://github.com/poirouxmartin/smart_clock/releases/tag/v1.4.2
