# Aube - Smart Connected Alarm Clock

## Vision
An alarm that wakes you at exactly the right moment so you feel good (heart rate analysis, deep sleep, cycles, etc.)

## Main Features

### 1. Sleep Analysis
- **Microphone**: Detection of movements, snoring, breathing
- **Refined personal data**: Continuous learning of the user's sleep patterns
- **User feedback**: Wake-up rating (good/average/bad) to improve the algorithm

### 2. Wake Window (1h30)
- The user chooses a 1h30 range (e.g. 6:30-8:00)
- The app wakes the user at the optimal moment within this window
- **Best moment to be determined**: Research needed on sleep cycles (90 min), light phases, etc.

### 3. Alarm Types
- **Smart** (based on analysis)
- **Simple** (classic alarm if needed)

### 4. Gentle Wake-Up
- Nature sounds (birds, waves, rain, etc.)
- Custom sounds (imported audio files)
- **Light**: Integration with connected bulbs (Philips Hue, Yeelight, etc.) or the phone flashlight

### 5. Bedtime Indicator
- Calculates the ideal time to go to sleep based on:
  - Desired wake-up time
  - Usual cycles (90 min)
  - Heart rate measurements
  - Average time to fall asleep

### 6. Target Platform
- **Android** (priority)
- Multi-platform architecture for a future iOS
- Internationalisation (i18n) from the start

## Technical Architecture

### Suggested Stack
- **Frontend**: React Native / Expo (cross-platform, good for Android)
- **Backend**: Optional at first (local-first), then Firebase/Supabase for sync
- **Audio**: expo-audio / react-native-sound
- **Sensors**: expo-sensors (accelerometer), microphone via expo-av
- **Light**: Bluetooth LE for connected bulbs
- **Notifications**: expo-notifications (background alarm)

### Core Modules
```
src/
├── sleep-analysis/     # Microphone + sensor analysis
├── alarm-engine/       # Optimal wake-up logic
├── sound-manager/      # Nature + custom sounds
├── light-controller/   # Connected bulb integration
├── bedtime-calculator/ # Bedtime indicator
├── user-profile/       # Personal data + learning
├── notifications/      # Background alarm handling
└── i18n/              # Internationalisation
```

## Research Needed
- [ ] Optimal wake-up algorithm within the 1h30 window (90 min cycles, light phase)
- [ ] Accuracy of sleep analysis with the microphone alone (vs accelerometer)
- [ ] Connected bulb protocols (Matter, BLE, WiFi)
- [ ] Android background execution (foreground service, alarm manager)
- [ ] Battery optimisation exclusions

## Next Steps
1. Literature research on light sleep phase detection
2. Microphone analysis POC (night recording, peak detection)
3. Final stack choice + Expo project setup
4. Data architecture (local storage + optional sync)
5. UI/UX wireframes for the main screens

## Open Questions
- Monetisation? (Freemium, one-time purchase, subscription)
- Health data: GDPR, consent, anonymisation
- Partnerships with connected bulb makers?
- User data export (CSV, HealthKit, Google Fit)
