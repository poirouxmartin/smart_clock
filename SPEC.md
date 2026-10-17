# Aube - Réveil Connecté Intelligent

## Vision
Réveil qui te réveille pile au bon moment pour te sentir bien (analyse pouls, sommeil profond, cycles, etc.)

## Fonctionnalités Principales

### 1. Analyse du Sommeil
- **Microphone** : Détection des mouvements, ronflements, respiration
- **Données perso affinées** : Apprentissage continu des patterns de sommeil de l'utilisateur
- **Feedback utilisateur** : Notation du réveil (bien/moyen/mal) pour améliorer l'algo

### 2. Fenêtre de Réveil (1h30)
- L'utilisateur choisit une plage de 1h30 (ex: 6h30-8h00)
- L'app réveille au moment optimal dans cette fenêtre
- **Meilleur moment à déterminer** : Recherche nécessaire sur les cycles de sommeil (90min), phases légères, etc.

### 3. Types de Réveil
- **Intelligent** (basé sur analyse)
- **Simple** (réveil classique si besoin)

### 4. Réveil Doux
- Sons nature (oiseaux, vagues, pluie, etc.)
- Sons personnalisables (import fichiers audio)
- **Lumière** : Intégration avec ampoules connectées (Philips Hue, Yeelight, etc.) ou flashlight téléphone

### 5. Indicateur Coucher
- Calcule l'heure idéale pour dormir selon :
  - Heure de réveil souhaitée
  - Cycles habituels (90min)
  - Mesures pouls/fréquence cardiaque
  - Temps d'endormissement moyen

### 6. Platform Cible
- **Android** (priorité)
- Architecture multi-plateforme pour futur iOS
- Internationalisation (i18n) dès le début

## Architecture Technique

### Stack Suggérée
- **Frontend** : React Native / Expo (cross-platform, bon pour Android)
- **Backend** : Optionnel au début (local-first), puis Firebase/Supabase pour sync
- **Audio** : expo-audio / react-native-sound
- **Sensors** : expo-sensors (accéléromètre), microphone via expo-av
- **Light** : Bluetooth LE pour ampoules connectées
- **Notifications** : expo-notifications (réveil en background)

### Modules Core
```
src/
├── sleep-analysis/     # Analyse microphone + capteurs
├── alarm-engine/       # Logique de réveil optimal
├── sound-manager/      # Sons nature + custom
├── light-controller/   # Intégration ampoules connectées
├── bedtime-calculator/ # Indicateur coucher
├── user-profile/       # Données perso + apprentissage
├── notifications/      # Gestion réveil background
└── i18n/              # Internationalisation
```

## Recherche Nécessaire
- [ ] Algorithme optimal réveil dans fenêtre 1h30 (cycles 90min, phase légère)
- [ ] Précision analyse sommeil via microphone seul (vs accéléromètre)
- [ ] Protocoles ampoules connectées (Matter, BLE, WiFi)
- [ ] Background execution Android (foreground service, alarm manager)
- [ ] Battery optimization exclusions

## Prochaines Étapes
1. Recherche literature sur détection phase sommeil léger
2. POC analyse microphone (enregistrement nuit, détection pics)
3. Choix stack définitive + setup projet Expo
4. Architecture données (local storage + sync optionnel)
5. UI/UX wireframes principaux écrans

## Questions Ouvertes
- Monétisation ? (Freemium, achat unique, abonnement)
- Données santé : RGPD, consentement, anonymisation
- Partenariats ampoules connectées ?
- Export données utilisateur (CSV, HealthKit, Google Fit)