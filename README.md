# Smart Clock - Réveil Connecté Intelligent

Application de réveil intelligent qui analyse le sommeil via microphone et accéléromètre pour réveiller au moment optimal dans une fenêtre de 1h30.

## Fonctionnalités

- **Analyse du sommeil** : Microphone + accéléromètre pour détecter les phases de sommeil léger
- **Réveil intelligent** : Fenêtre de 1h30, réveil au moment optimal (phase légère)
- **Réveil doux** : Sons nature + lumière progressive (ampoules connectées)
- **Indicateur coucher** : Calcule l'heure idéale pour dormir selon les cycles
- **Historique & tendances** : Suivi qualité sommeil sur le long terme
- **Local-first** : Données stockées localement, sync optionnelle

## Stack

- **React Native** / **Expo** (SDK 57)
- **TypeScript** strict
- **Expo Router** (navigation)
- **expo-av** (audio recording)
- **expo-sensors** (accelerometer)
- **expo-notifications** (alarms)
- **expo-bluetooth** (smart lights)
- **React Native Reanimated** (animations)

## Structure

```
src/
├── components/          # Composants UI réutilisables
├── screens/             # Écrans principaux
├── navigation/          # Configuration navigation
├── hooks/               # Custom hooks
├── utils/               # Utilitaires
├── constants/           # Constantes app
├── types/               # Types TypeScript
├── dev/                 # Outils développeur (POC)
└── modules/             # Modules métier
    ├── sleep-analysis/     # Analyse microphone/accel
    ├── alarm-engine/       # Logique réveil optimal
    ├── sound-manager/      # Sons nature/custom
    ├── light-controller/   # Ampoules connectées
    ├── bedtime-calculator/ # Indicateur coucher
    ├── user-profile/       # Profil + apprentissage
    ├── notifications/      # Gestion notifications
    └── i18n/               # Internationalisation
```

## Démarrage

```bash
# Installation
npm install

# Développement
npm run start      # Expo Go
npm run android    # Build Android
npm run ios        # Build iOS (macOS requis)
npm run web        # Version web
```

## Développement

### POC Microphone (DevTools)
L'écran "Outils développeur" accessible depuis l'accueil permet :
- Enregistrement audio continu (chunks 30s)
- Affichage RMS temps réel
- Accéléromètre 3 axes
- Export CSV pour analyse

### Prochaines étapes
1. Algorithme détection phase légère (fusion audio + accel)
2. Moteur de réveil avec fenêtre glissante
3. Persistance données (AsyncStorage → SQLite)
4. Notifications exactes Android (foreground service)
5. Intégration ampoules (Matter/BLE)

## Permissions Android

- `RECORD_AUDIO` : Analyse sommeil
- `FOREGROUND_SERVICE` : Enregistrement nuit
- `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM` : Réveil précis
- `BLUETOOTH_CONNECT/SCAN` : Ampoules connectées
- `WAKE_LOCK` : Écran allumé au réveil
- `RECEIVE_BOOT_COMPLETED` : Restauration alarmes au reboot

## License

MIT