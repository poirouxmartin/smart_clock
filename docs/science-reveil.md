# Base scientifique du réveil intelligent d'Aube

Revue courte de la littérature qui justifie les choix de conception d'Aube : réveil dans une fenêtre avant une échéance, déclenché au sommeil le plus léger détectable, avec sons de nature à volume progressif et simulation d'aube par l'écran.

Convention : [n] renvoie à la liste des sources en fin de document. Seules les sources dont l'existence a été vérifiée (titre, auteurs, revue, année) sont citées. Les chiffres tirés d'un résumé ou d'une couverture secondaire, sans lecture du texte complet, sont signalés "(résumé)". Les points de connaissance générale non sourcés individuellement sont marqués "(consensus)".

---

## 1. L'inertie du sommeil

### Définition et durée

L'inertie du sommeil est la période de vigilance réduite, de grogginess et de performance dégradée qui suit immédiatement le réveil [1][2][3]. Elle touche la cognition (temps de réaction, attention, mémoire de travail), l'humeur et la somnolence subjective.

- La durée va de quelques minutes à plusieurs heures selon les conditions [2][3]. Une durée typique de 15 à 30 minutes est la plus citée (consensus) ; les cas sévères (sommeil écourté, réveil nocturne, forte dette) durent plus longtemps.
- L'imagerie suggère que la normalisation du débit sanguin cortical demande environ 5 à 30 minutes après le réveil, celle des régions sous-corticales environ 5 minutes [2].

### Facteurs aggravants

| Facteur | Effet | Source |
|---|---|---|
| Stade au réveil | Réveil depuis le sommeil lent profond (N3/SWS) : inertie plus forte que depuis N1/N2, REM en position intermédiaire | [1] (résumé), [2] |
| Dette de sommeil / sommeil de récupération | Amplifie l'inertie (davantage de N3) | [1][2] |
| Moment circadien | Plus intense si l'on se réveille pendant la nuit biologique | [2][3] |
| Durée du sommeil précédent | Effet présent même après 8 h ; pas limité aux siestes | [1] (résumé) |

Nuance rapportée par [2] : les données sur l'effet du stade sont hétérogènes. Une étude trouve de meilleures performances après un réveil en REM qu'après N1/N2. La règle "réveiller en sommeil léger" est donc bien étayée pour l'opposition N3 contre le reste, beaucoup moins pour la distinction fine N1/N2/REM.

### Temps écoulé depuis l'endormissement

Les revues [2][3] ne formulent pas l'effet comme une fonction simple du temps depuis l'endormissement. Le lien passe par deux médiateurs : la quantité de N3 (concentrée tôt dans la nuit, section 2) et la phase circadienne. Pour un réveil du matin après une nuit complète, la probabilité de N3 est faible dans les derniers cycles. Les inerties fortes se rencontrent surtout après un réveil en début de nuit, après une sieste de plus de 30 minutes ou après une privation de sommeil [2].

---

## 2. Structure des cycles de sommeil

- Le sommeil alterne cycliquement NREM (N1, N2, N3) et REM. Chez l'adulte sain à horaires réguliers, le premier épisode de REM apparaît environ 80 à 100 minutes après l'endormissement [4].
- Durée de cycle : environ 90 minutes en moyenne, plage usuelle 70 à 120 minutes ; le premier cycle est souvent plus court, les suivants plus longs (consensus). La variabilité inter et intra-individuelle est importante : un "multiple de 90 minutes" n'est qu'une approximation.
- N3 est concentré dans le premier tiers de la nuit ; N2 et REM dominent les cycles de fin de nuit, avec des épisodes REM qui s'allongent (consensus, manuels de médecine du sommeil ; [4] confirme l'organisation cyclique mais le détail "premier tiers" n'a pas été vérifié dans le texte).
- Le pourcentage de N3 diminue avec l'âge (méta-analyse normative [5]), ce qui réduit encore sa présence en fin de nuit chez l'adulte plus âgé.

### Implications pour une fenêtre de réveil matinale

1. Le matin, la probabilité de tomber sur du N3 est faible : le gain théorique d'un réveil "en sommeil léger" est borné pour une nuit complète. Il est plus grand après un sommeil écourté ou fragmenté, ou après une dette de sommeil (qui rebooste le N3 [1][2]).
2. Dans les derniers cycles, l'alternance se fait essentiellement entre N2, REM et micro-éveils. Le réveil depuis ces états est le moins coûteux, avec des preuves moins nettes pour distinguer REM et N2 [2].
3. Une fenêtre de 20 à 40 minutes couvre en général une fraction de cycle : on a de bonnes chances d'y trouver au moins un moment de sommeil léger ou d'éveil bref, sans garantie.

---

## 3. Réveils intelligents (smart alarms)

### Principe

Un réveil intelligent surveille le mouvement (actigraphie, accéléromètre du téléphone), parfois le son ou la fréquence cardiaque, et déclenche l'alarme à un moment estimé de sommeil léger dans une fenêtre précédant l'heure limite.

### Ce que disent les données

- **Fino & Mazzetti (2019)**, revue de 11 études de validation (2012 à 2018) : en population saine, la plupart des applications distinguent sommeil et éveil à un niveau comparable à l'actigraphie de poignet, mais la précision chute chez les sujets à faible efficacité de sommeil et en population clinique. L'accord avec la PSG pour les stades est faible pour les applications à accéléromètre [6] (résumé).
- **Bhat et al. (2015)**, 20 volontaires, application iPhone comparée à la PSG : sensibilité élevée pour détecter le sommeil, mais paramètres absolus et stades faiblement corrélés à la PSG [7] (résumé, via communiqué de l'AASM).
- **Fino et al. (2020)**, 21 adultes sains, 4 applications iPhone (dont Sleep Cycle en modes accéléromètre et micro) contre PSG à domicile : Sleep Cycle et Sense insuffisamment fiables pour sleep/wake ; l'application "Smart Alarm" était la plus précise (analyse époque par époque) mais limitée pour l'éveil et le sommeil profond ; aucune ne détecte le REM [8] (résumé).
- **Campanella et al. (2024)**, 29 participants en laboratoire, alarme multimodale "intelligente" (lumière en rampe 0 à 300 lux déclenchée par un capteur de matelas détectant 5 minutes de sommeil léger N1/N2, sons de nature, température) contre alarme standard : peu d'effet global sur la vigilance (PVT), la somnolence ou l'humeur ; des effets n'apparaissent que dans des sous-groupes selon le chronotype et la durée de la rampe (rampes de plus de 15 minutes plus favorables). Légère baisse d'efficacité du sommeil les nuits d'intervention (environ 84 % contre 87 %). Petit échantillon, financement par un fabricant [9].

### Bilan honnête

Aucun essai randomisé de grande taille démontrant qu'un réveil déclenché en sommeil léger par smartphone réduit l'inertie de façon cliniquement significative n'a été trouvé lors de cette revue. Le raisonnement physiologique (section 1) est solide ; la validation d'une implémentation grand public est faible. L'étude la plus proche d'Aube [9] est nuancée.

---

## 4. Fiabilité réelle de l'actigraphie

### Actigraphie de poignet

Marino et al. (2013), actigraphie de poignet contre PSG en époques de 30 s : sensibilité 0,965 (sommeil), exactitude 0,863, mais spécificité 0,329 (éveil). L'actigraphie classe donc souvent des éveils immobiles comme du sommeil [10] (résumé). Elle ne distingue pas les stades [6][10][11].

### Téléphone sur le matelas

Les études sur applications [6][7][8] indiquent des performances au mieux comparables à l'actigraphie de poignet en bonne santé, et dégradées quand le sommeil est fragmenté. Le téléphone ne perçoit que les mouvements transmis par le matelas (dépend de la literie, d'un partenaire éventuel, de la distance au corps). Il est raisonnable de le considérer comme moins fiable que le poignet (inférence à partir de [6][8], pas de comparaison directe vérifiée).

Les wearables grand public multicapteurs (fréquence cardiaque, etc.) dépassent l'actigraphie traditionnelle pour le sommeil mais gardent un défaut de détection de l'éveil [11].

### Android Sleep API (Google Play services)

L'API de détection du sommeil, à faible consommation, fournit [12][13] :

- `SleepClassifyEvent` : à intervalles réguliers, un horodatage, une confiance de sommeil (`getConfidence()`, 0 à 100), le mouvement de l'appareil (`getMotion()`, accéléromètre) et la luminosité ambiante (`getLight()`). Le guide de Google indique qu'une hausse de confiance accompagnée d'une baisse de luminosité entre deux événements suggère un endormissement récent [12].
- `SleepSegmentEvent` : résumé quotidien de la période de sommeil estimée (endormissement / réveil probables). Pour une segmentation personnalisée, Google recommande `SleepClassifyEvent` [13].
- Permission requise : `ACTIVITY_RECOGNITION` accordée à l'exécution [12].

Points non confirmés par la documentation lue : les échelles exactes de `motion` et `light` (valeurs discrètes, 1 à 6 selon l'énoncé du projet, à contrôler dans le code de l'API) et la fréquence réelle de livraison des événements (de l'ordre de la minute à la dizaine de minutes, donc trop grossière pour un déclenchement fin dans une fenêtre de 30 minutes). Conséquence pour Aube : la Sleep API sert de prior grossier et d'inférence endormissement / réveil, pas de détecteur de micro-éveils.

---

## 5. Simulateurs d'aube

### Résultats

- **van de Werken et al. (2010)**, J Sleep Res, 16 sujets ayant du mal à se réveiller : aube artificielle de 30 minutes montant à 300 lux (niveau des yeux) ; somnolence subjective réduite et activation augmentée après le réveil par rapport au contrôle ; les performances objectives (addition, temps de réaction simple) ne s'améliorent pas [14][15].
- **Giménez et al. (2010)**, Chronobiol Int : l'aube artificielle réduit les plaintes subjectives d'inertie du sommeil, mécanisme incertain [16] (résumé, via revue citante).
- **Thompson et al. (2014)**, Eur J Appl Physiol : aube simulée sur les 30 dernières minutes du sommeil ; somnolence subjective plus basse, activation plus haute, décroissance plus rapide de la température cutanée ; pas d'effet sur les performances, la température centrale ou le cortisol [17] (résumé, via revue citante).
- **Campanella et al. (2024)** : effet global faible pour une rampe 0 à 300 lux, dépendant du chronotype et de la durée ; les auteurs notent que toutes les études antérieures citées utilisaient une rampe de 30 minutes [9].

### Protocole typique

Rampe d'environ 30 minutes avant l'heure de réveil jusqu'à environ 250 à 300 lux au niveau des yeux (couleur autour de 4000 K dans [9]) [9][14][15]. Les paupières laissent passer une partie de la lumière, donc la rampe est perçue pendant le sommeil.

### Limite majeure pour un écran de téléphone

Un écran de téléphone, même à pleine luminosité, délivre à 30 à 50 cm du visage typiquement quelques lux à quelques dizaines de lux (ordre de grandeur de connaissance générale, non mesuré ici), soit un à deux ordres de grandeur sous les 250 à 300 lux des protocoles. L'effet attendu est donc plus faible que dans la littérature, qui montre déjà surtout des effets subjectifs. Recommandation : écran orienté vers le visage, luminosité maximale pendant la rampe.

### Lumière bleue

Les courtes longueurs d'onde sont les plus efficaces pour supprimer la mélatonine et augmenter la vigilance (consensus). Une teinte chaude (ambre) en début de rampe puis un blanc plus froid en fin de rampe imite l'aube naturelle. Il n'est pas prouvé que le spectre modifie l'effet sur l'inertie : l'étude de la lumière rouge [15] ne tranche pas. L'écran bleu le soir retarde l'endormissement : la lumière reste limitée à la rampe du matin.

---

## 6. Sons progressifs et mélodiques

- **McFarlane et al. (2020)**, PLoS One, enquête en ligne (50 participants, auto-évaluation) : les sons d'alarme perçus comme mélodiques sont associés à une inertie auto-déclarée plus faible que les sons non mélodiques [18]. Étude préliminaire, auto-déclarée, petite taille, connue ici via sa couverture et non via le texte intégral.
- Volume progressif : peu d'essais contrôlés spécifiques. La logique (éviter le sursaut, transition douce) est plausible et compatible avec [18], mais reste un choix de conception plutôt qu'un résultat établi. L'alarme multimodale de [9] faisait monter sons de nature et musique jusqu'à 50 % du volume maximal à partir de 2 minutes avant le réveil.
- Contrainte de sécurité : l'alarme doit rester assez forte pour réveiller de façon fiable à l'échéance, donc la rampe atteint le volume réglé avant ou à l'heure limite.

---

## 7. Détection automatique de l'endormissement et du réveil

Objectif : savoir quand l'utilisateur dort (temps depuis l'endormissement, activation du suivi) et quand il est réveillé (arrêt de l'alarme, clôture de la nuit).

| Signal | Usage | Fiabilité |
|---|---|---|
| Sleep API (`SleepClassifyEvent` confiance / motion / light) | Prior d'endormissement et de réveil | Correcte pour l'endormissement approximatif ; résolution temporelle grossière ; dépend de l'appareil et de la permission [12][13] |
| Écran éteint + téléphone posé et immobile | Endormissement probable | Faux positifs (lecture, téléphone laissé sur une table) |
| Branché sur le chargeur | Renforce l'hypothèse de nuit | Signal contextuel faible seul |
| Heure de coucher habituelle | Prior | Utile pour désambiguïser, biais si horaires irréguliers |
| Interaction avec l'écran / déverrouillage | Réveil certain | Très fiable (éveil actif) |

Limites : l'actigraphie surestime le sommeil (faible spécificité de l'éveil, section 4 [10]) ; un éveil calme ou une lecture au lit peut être pris pour du sommeil. L'heure d'endormissement estimée est donc entachée d'erreur : permettre la correction manuelle et ne pas fonder le déclenchement sur un temps depuis l'endormissement précis (section 8).

---

## 8. Conclusions appliquées à Aube

### Paramètres retenus

| Paramètre | Valeur par défaut | Plage | Justification |
|---|---|---|---|
| Fenêtre de réveil | 30 min avant l'échéance | 10 à 45 min | Couvre une fraction de cycle ; plus long augmente la chance de sommeil léger mais coûte du sommeil ; sous 10 min le gain est négligeable (sections 2, 3) |
| Signal principal | Intensité / variance du mouvement (accéléromètre) sur fenêtre glissante de 1 à 2 min | n/a | Seul signal à haute résolution sur téléphone ; équivalent à l'actigraphie [6][10] |
| Signal secondaire | Sleep API : confiance en baisse, motion en hausse | n/a | Proxy grossier de sommeil plus léger ou d'éveil proche ; faible résolution [12] |
| Tendance de fin de nuit | Mouvement croissant sur les 20 à 30 dernières minutes | n/a | Fin de nuit : davantage de N2/REM et de micro-éveils (section 2) |
| Prior temporel | Léger bonus de score quand le temps depuis l'endormissement est proche d'un multiple de 90 min (tolérance +/- 15 min) | Poids faible | Cycles de 70 à 120 min, endormissement incertain : prior faible seulement (sections 2, 7) |
| Règle de déclenchement | Dans la fenêtre : déclencher dès qu'une salve de mouvement dépasse un seuil (micro-éveil / sommeil léger) et qu'un délai minimal depuis le début de fenêtre est écoulé ; sinon à l'échéance | n/a | Cible les micro-éveils, signal le plus fiable en actigraphie ; garantit le réveil à l'heure limite |
| Rampe de lumière | 30 min avant l'échéance (ou début de fenêtre si plus courte) ; si déclenchement anticipé, rampe raccourcie sans descendre sous 15 min si possible | 10 à 30 min | Protocoles de 30 min jusqu'à 300 lux [9][14] ; rampes de plus de 15 min plus favorables [9] |
| Rampe de volume | Environ 60 s, depuis un volume très bas jusqu'au volume réglé, sons de nature / mélodiques | 30 à 120 s | Transition douce, mélodique [18] ; doit être audible à l'échéance |
| Filet de sécurité | Alarme pleine à l'échéance dans tous les cas (capteurs ou Sleep API indisponibles inclus) | n/a | La fiabilité du réveil prime sur le confort |

### Logique de déclenchement (résumé)

1. Début de rampe lumineuse (30 min avant l'échéance, ou début de fenêtre si plus court).
2. Calcul continu d'un score de légèreté : salve de mouvement récente + tendance de mouvement + signal Sleep API (faible) + léger prior de cycle.
3. Score au-dessus du seuil et délai minimal respecté : lancer la rampe sonore de 60 s.
4. Sinon : rampe sonore calée pour être complète à l'échéance.

### Limitations à assumer

- Le téléphone n'identifie pas les stades du sommeil ; il détecte des mouvements. Un mouvement signale un sommeil léger ou un éveil ; l'absence de mouvement ne prouve pas du N3 [6][8][10].
- Le bénéfice attendu est modeste : N3 rare en fin de nuit, effets de la lumière d'aube surtout subjectifs, écran bien moins lumineux que les dispositifs étudiés [9][14][17].
- Les preuves directes d'un réveil intelligent grand public sont faibles et l'étude la plus proche est nuancée [9]. À présenter comme un confort probable, pas comme une garantie ni un avantage médical.
- Pour les activités critiques (conduite, travail à risque), prévoir 15 à 30 minutes après le réveil ([2][3]).

---

## Sources

1. Tassi P., Muzet A. (2000). Sleep inertia. *Sleep Medicine Reviews* 4(4):341-353. doi:10.1053/smrv.2000.0098. https://pubmed.ncbi.nlm.nih.gov/12531174/
2. Trotti L.M. (2017, en ligne 2016). Waking up is the hardest thing I do all day: sleep inertia and sleep drunkenness. *Sleep Medicine Reviews* 35:76-84. doi:10.1016/j.smrv.2016.08.005. https://pmc.ncbi.nlm.nih.gov/articles/PMC5337178
3. Hilditch C.J., McHill A.W. (2019). Sleep inertia: current insights. *Nature and Science of Sleep* 11:155-165. https://pmc.ncbi.nlm.nih.gov/articles/PMC6710480
4. Carskadon M.A., Dement W.C. Normal human sleep: an overview. Chapitre de *Principles and Practice of Sleep Medicine*. Copie non officielle : https://pdf4pro.com/view/chapter-2-normal-human-sleep-an-overview-613012.html (seule la latence REM d'environ 80 à 100 min a été confirmée)
5. Ohayon M.M., Carskadon M.A., Guilleminault C., Vitiello M.V. (2004). Meta-analysis of quantitative sleep parameters from childhood to old age in healthy individuals: developing normative sleep values across the human lifespan. *Sleep* 27(7):1255-1273. doi:10.1093/sleep/27.7.1255. https://pubmed.ncbi.nlm.nih.gov/15586779/
6. Fino E., Mazzetti M. (2019). Monitoring healthy and disturbed sleep through smartphone applications: a review of experimental evidence. *Sleep and Breathing* 23(1):13-24. doi:10.1007/s11325-018-1661-3. https://cris.unibo.it/handle/11585/670927
7. Bhat S. et al. (2015). Is there a clinical role for smartphone sleep apps? Comparison of sleep cycle detection by a smartphone application to polysomnography. *Journal of Clinical Sleep Medicine* 11(7):709-715. PMID 25766719. https://pmc.ncbi.nlm.nih.gov/articles/PMC4481053 ; résumé AASM : https://aasm.org/study-compares-sleep-time-app-with-polysomnography/
8. Fino E., Plazzi G., Filardi M., Marzocchi M., Pizza F., Vandi S., Mazzetti M. (2020). (Not so) Smart sleep tracking through the phone: findings from a polysomnography study testing the reliability of four sleep applications. *Journal of Sleep Research* 29(1):e12935. doi:10.1111/jsr.12935. https://cris.unibo.it/handle/11585/752893
9. Campanella C. et al. (2024). The efficacy of a multimodal bedroom-based "smart" alarm system on mitigating the effects of sleep inertia. *Clocks & Sleep* 6(1):183-199. doi:10.3390/clockssleep6010013. https://pmc.ncbi.nlm.nih.gov/articles/PMC10969141
10. Marino M. et al. (2013). Measuring sleep: accuracy, sensitivity, and specificity of wrist actigraphy compared to polysomnography. *Sleep* 36(11):1747-1755. https://stacks.cdc.gov/view/cdc/200400
11. de Zambotti M. et al. (2019). Wearable sleep technology in clinical and research settings. *Medicine & Science in Sports & Exercise* 51(7):1538-1557. https://research.unipd.it/bitstream/11577/3307782/1/de%20Zambotti%20et%20al.%2c%20%28in%20press%29%20-%20Wearable%20Sleep%20Technology%20in%20Clinical%20and%20Research%20Settings.pdf
12. Google. Help users understand their sleep habits (Sleep API). https://developers.google.com/location-context/sleep
13. Google. Google Play services reference : `SleepClassifyEvent` https://developers.google.com/android/reference/com/google/android/gms/location/SleepClassifyEvent ; `SleepSegmentEvent` https://developers.google.com/android/reference/com/google/android/gms/location/SleepSegmentEvent ; billet Android Developers Blog (2021) https://android-developers.googleblog.com/2021/02/low-power-sleep-tracking-on-android.html
14. van de Werken M. et al. (2010). Effects of artificial dawn on sleep inertia, skin temperature, and the awakening cortisol response. *Journal of Sleep Research* 19(3):425-435. https://pure.rug.nl/ws/portalfiles/portal/6750196/2010JSleepResvdWerken.pdf
15. Figueiro M.G., Sahin L., Roohan C., Kalsher M., Plitnick B., Rea M.S. (2019). Effects of red light on sleep inertia. *Nature and Science of Sleep* 11:45-57. doi:10.2147/NSS.S195563. https://pmc.ncbi.nlm.nih.gov/articles/PMC6506010
16. Giménez M., Hessels M., van de Werken M., de Vries B., Beersma D.G.M., Gordijn M.C.M. (2010). Effects of artificial dawn on subjective ratings of sleep inertia and dim light melatonin onset. *Chronobiology International* 27(6):1219-1241. https://www.innerscene.com/papers/effects-of-artificial-dawn-on-subjective-ratings-of-sleep-inertia-and-dim-light-melatonin-onset
17. Thompson A., Jones H., Gregson W., Atkinson G. (2014). Effects of dawn simulation on markers of sleep inertia and post-waking performance in humans. *European Journal of Applied Physiology* 114(5):1049-1056. doi:10.1007/s00421-014-2831-z. https://www.altmetric.com/details/2242647
18. McFarlane S.J., Garcia J.E., Verhagen D.S., Dyer A.G. (2020). Alarm tones, music and their elements: analysis of reported waking sounds to counteract sleep inertia. *PLoS ONE* 15(1):e0215788. doi:10.1371/journal.pone.0215788. Couverture : https://www.rmit.edu.au/news/all-news/2020/feb/melodic-alarms
