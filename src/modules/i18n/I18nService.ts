import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { SupportedLocale, LocaleConfig, DEFAULT_LOCALE, FALLBACK_LOCALE, SUPPORTED_LOCALES, TranslationResources } from './types';
import { fr } from './locales/fr';
import { en } from './locales/en';

const resources: TranslationResources = {
  fr: { common: fr.common, home: fr.home, alarm: fr.alarm, sleep: fr.sleep, settings: fr.settings, notifications: fr.notifications, sounds: fr.sounds, lights: fr.lights, profile: fr.profile, onboarding: fr.onboarding, errors: fr.errors, night: fr.night, update: fr.update, ring: fr.ring },
  en: { common: en.common, home: en.home, alarm: en.alarm, sleep: en.sleep, settings: en.settings, notifications: en.notifications, sounds: en.sounds, lights: en.lights, profile: en.profile, onboarding: en.onboarding, errors: en.errors, night: en.night, update: en.update, ring: en.ring },
};

class I18nService {
  private initialized = false;
  private currentLocale: SupportedLocale = DEFAULT_LOCALE;
  private listeners: Set<(locale: SupportedLocale) => void> = new Set();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const deviceLocale = this.getDeviceLocale();
    const savedLocale = await this.getSavedLocale();
    const initialLocale = savedLocale || deviceLocale || DEFAULT_LOCALE;

    await i18n
      .use(initReactI18next)
      .init({
        resources,
        lng: initialLocale,
        fallbackLng: FALLBACK_LOCALE,
        defaultNS: 'common',
        ns: ['common', 'home', 'alarm', 'sleep', 'settings', 'notifications', 'sounds', 'lights', 'profile', 'onboarding', 'errors', 'night', 'update', 'ring'],
        interpolation: {
          escapeValue: false,
        },
        react: {
          useSuspense: false,
        },
        compatibilityJSON: 'v4',
      });

    this.currentLocale = initialLocale as SupportedLocale;
    this.initialized = true;
    console.log('[I18nService] Initialized with locale:', this.currentLocale);
  }

  private getDeviceLocale(): SupportedLocale | null {
    try {
      const locales = Localization.getLocales();
      if (locales.length > 0) {
        const langCode = locales[0].languageCode?.toLowerCase();
        if (langCode && SUPPORTED_LOCALES[langCode as SupportedLocale]) {
          return langCode as SupportedLocale;
        }
        
        const regionCode = locales[0].regionCode?.toLowerCase();
        if (regionCode) {
          const fullCode = `${langCode}-${regionCode}`.toLowerCase();
          if (SUPPORTED_LOCALES[fullCode as SupportedLocale]) {
            return fullCode as SupportedLocale;
          }
        }
      }
    } catch (e) {
      console.warn('[I18nService] Failed to get device locale:', e);
    }
    return null;
  }

  private async getSavedLocale(): Promise<SupportedLocale | null> {
    try {
      const { getDatabaseService } = await import('@/modules/user-profile');
      const saved = await getDatabaseService().getSetting<string | null>('app_locale', null);
      if (saved && SUPPORTED_LOCALES[saved as SupportedLocale]) {
        return saved as SupportedLocale;
      }
    } catch {}
    return null;
  }

  private async saveLocale(locale: SupportedLocale): Promise<void> {
    try {
      const { getDatabaseService } = await import('@/modules/user-profile');
      await getDatabaseService().setSetting('app_locale', locale);
    } catch (e) {
      console.warn('[I18nService] Failed to save locale:', e);
    }
  }

  getCurrentLocale(): SupportedLocale {
    return this.currentLocale;
  }

  getLocaleConfig(locale?: SupportedLocale): LocaleConfig {
    return SUPPORTED_LOCALES[locale || this.currentLocale];
  }

  isRTL(locale?: SupportedLocale): boolean {
    return this.getLocaleConfig(locale).rtl;
  }

  getSupportedLocales(): SupportedLocale[] {
    return Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];
  }

  async changeLocale(locale: SupportedLocale): Promise<void> {
    if (!SUPPORTED_LOCALES[locale]) {
      console.warn('[I18nService] Unsupported locale:', locale);
      return;
    }

    await i18n.changeLanguage(locale);
    this.currentLocale = locale;
    await this.saveLocale(locale);
    this.notifyListeners(locale);
  }

  t(key: string, options?: Record<string, any>, namespace?: string): string {
    return i18n.t(key, { ...options, ns: namespace || 'common' });
  }

  tCommon(key: string, options?: Record<string, any>): string {
    return this.t(key, options, 'common');
  }

  tHome(key: string, options?: Record<string, any>): string {
    return this.t(key, options, 'home');
  }

  tAlarm(key: string, options?: Record<string, any>): string {
    return this.t(key, options, 'alarm');
  }

  tSleep(key: string, options?: Record<string, any>): string {
    return this.t(key, options, 'sleep');
  }

  tSettings(key: string, options?: Record<string, any>): string {
    return this.t(key, options, 'settings');
  }

  tNotifications(key: string, options?: Record<string, any>): string {
    return this.t(key, options, 'notifications');
  }

  tSounds(key: string, options?: Record<string, any>): string {
    return this.t(key, options, 'sounds');
  }

  tLights(key: string, options?: Record<string, any>): string {
    return this.t(key, options, 'lights');
  }

  tProfile(key: string, options?: Record<string, any>): string {
    return this.t(key, options, 'profile');
  }

  tOnboarding(key: string, options?: Record<string, any>): string {
    return this.t(key, options, 'onboarding');
  }

  tErrors(key: string, options?: Record<string, any>): string {
    return this.t(key, options, 'errors');
  }

  formatDate(date: Date, locale?: SupportedLocale): string {
    const config = this.getLocaleConfig(locale);
    return date.toLocaleDateString(config.code, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  formatTime(date: Date, locale?: SupportedLocale): string {
    const config = this.getLocaleConfig(locale);
    return date.toLocaleTimeString(config.code, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: config.timeFormat.includes('a'),
    });
  }

  formatDateTime(date: Date, locale?: SupportedLocale): string {
    return `${this.formatDate(date, locale)} ${this.formatTime(date, locale)}`;
  }

  formatDuration(ms: number, locale?: SupportedLocale): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  }

  onLocaleChange(callback: (locale: SupportedLocale) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(locale: SupportedLocale): void {
    this.listeners.forEach(cb => cb(locale));
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getI18nInstance() {
    return i18n;
  }
}

let i18nServiceInstance: I18nService | null = null;

export function getI18nService(): I18nService {
  if (!i18nServiceInstance) {
    i18nServiceInstance = new I18nService();
  }
  return i18nServiceInstance;
}

export function createI18nService(): I18nService {
  return new I18nService();
}

export const i18nInstance = i18n;