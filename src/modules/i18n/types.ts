export type SupportedLocale = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl' | 'pl' | 'ru' | 'ja' | 'ko' | 'zh';

export interface LocaleConfig {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  rtl: boolean;
  dateFormat: string;
  timeFormat: string;
  firstDayOfWeek: 0 | 1;
}

export const SUPPORTED_LOCALES: Record<SupportedLocale, LocaleConfig> = {
  fr: { code: 'fr', name: 'French', nativeName: 'Français', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'HH:mm', firstDayOfWeek: 1 },
  en: { code: 'en', name: 'English', nativeName: 'English', rtl: false, dateFormat: 'MM/dd/yyyy', timeFormat: 'h:mm a', firstDayOfWeek: 0 },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'HH:mm', firstDayOfWeek: 1 },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false, dateFormat: 'dd.MM.yyyy', timeFormat: 'HH:mm', firstDayOfWeek: 1 },
  it: { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'HH:mm', firstDayOfWeek: 1 },
  pt: { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'HH:mm', firstDayOfWeek: 0 },
  nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', rtl: false, dateFormat: 'dd-MM-yyyy', timeFormat: 'HH:mm', firstDayOfWeek: 1 },
  pl: { code: 'pl', name: 'Polish', nativeName: 'Polski', rtl: false, dateFormat: 'dd.MM.yyyy', timeFormat: 'HH:mm', firstDayOfWeek: 1 },
  ru: { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false, dateFormat: 'dd.MM.yyyy', timeFormat: 'HH:mm', firstDayOfWeek: 1 },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false, dateFormat: 'yyyy/MM/dd', timeFormat: 'HH:mm', firstDayOfWeek: 0 },
  ko: { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false, dateFormat: 'yyyy.MM.dd', timeFormat: 'HH:mm', firstDayOfWeek: 0 },
  zh: { code: 'zh', name: 'Chinese', nativeName: '中文', rtl: false, dateFormat: 'yyyy/MM/dd', timeFormat: 'HH:mm', firstDayOfWeek: 1 },
};

export const DEFAULT_LOCALE: SupportedLocale = 'fr';
export const FALLBACK_LOCALE: SupportedLocale = 'en';

export type TranslationNamespace = 
  | 'common' 
  | 'home' 
  | 'alarm' 
  | 'sleep' 
  | 'settings' 
  | 'notifications' 
  | 'sounds' 
  | 'lights' 
  | 'profile' 
  | 'onboarding' 
  | 'errors';

export interface TranslationResources {
  [locale: string]: {
    [namespace: string]: Record<string, string>;
  };
}