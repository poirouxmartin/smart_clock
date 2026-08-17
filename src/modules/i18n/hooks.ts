import { useState, useEffect, useCallback } from 'react';
import { I18nService, getI18nService } from './I18nService';
import { SupportedLocale, SUPPORTED_LOCALES, LocaleConfig } from './types';

export function useI18n() {
  const [service] = useState(() => getI18nService());
  const [initialized, setInitialized] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(service.getCurrentLocale());
  const [locales] = useState<SupportedLocale[]>(service.getSupportedLocales());

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await service.initialize();
      if (mounted) {
        setInitialized(true);
        setCurrentLocale(service.getCurrentLocale());
      }
    };

    init();

    const unsubscribe = service.onLocaleChange((locale) => {
      if (mounted) {
        setCurrentLocale(locale);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [service]);

  const changeLocale = useCallback(async (locale: SupportedLocale) => {
    await service.changeLocale(locale);
    setCurrentLocale(locale);
  }, [service]);

  const t = useCallback((key: string, options?: Record<string, any>, namespace?: string) => {
    return service.t(key, options, namespace);
  }, [service]);

  const tCommon = useCallback((key: string, options?: Record<string, any>) => {
    return service.tCommon(key, options);
  }, [service]);

  const tHome = useCallback((key: string, options?: Record<string, any>) => {
    return service.tHome(key, options);
  }, [service]);

  const tAlarm = useCallback((key: string, options?: Record<string, any>) => {
    return service.tAlarm(key, options);
  }, [service]);

  const tSleep = useCallback((key: string, options?: Record<string, any>) => {
    return service.tSleep(key, options);
  }, [service]);

  const tSettings = useCallback((key: string, options?: Record<string, any>) => {
    return service.tSettings(key, options);
  }, [service]);

  const tNotifications = useCallback((key: string, options?: Record<string, any>) => {
    return service.tNotifications(key, options);
  }, [service]);

  const tSounds = useCallback((key: string, options?: Record<string, any>) => {
    return service.tSounds(key, options);
  }, [service]);

  const tLights = useCallback((key: string, options?: Record<string, any>) => {
    return service.tLights(key, options);
  }, [service]);

  const tProfile = useCallback((key: string, options?: Record<string, any>) => {
    return service.tProfile(key, options);
  }, [service]);

  const tOnboarding = useCallback((key: string, options?: Record<string, any>) => {
    return service.tOnboarding(key, options);
  }, [service]);

  const tErrors = useCallback((key: string, options?: Record<string, any>) => {
    return service.tErrors(key, options);
  }, [service]);

  const formatDate = useCallback((date: Date) => {
    return service.formatDate(date);
  }, [service]);

  const formatTime = useCallback((date: Date) => {
    return service.formatTime(date);
  }, [service]);

  const formatDateTime = useCallback((date: Date) => {
    return service.formatDateTime(date);
  }, [service]);

  const formatDuration = useCallback((ms: number) => {
    return service.formatDuration(ms);
  }, [service]);

  const isRTL = useCallback(() => {
    return service.isRTL();
  }, [service]);

  const getLocaleConfig = useCallback((locale?: SupportedLocale): LocaleConfig => {
    return service.getLocaleConfig(locale);
  }, [service]);

  return {
    service,
    initialized,
    currentLocale,
    locales,
    changeLocale,
    t,
    tCommon,
    tHome,
    tAlarm,
    tSleep,
    tSettings,
    tNotifications,
    tSounds,
    tLights,
    tProfile,
    tOnboarding,
    tErrors,
    formatDate,
    formatTime,
    formatDateTime,
    formatDuration,
    isRTL,
    getLocaleConfig,
  };
}

export function useLocale() {
  const { currentLocale, changeLocale, locales, getLocaleConfig } = useI18n();
  const localeConfig = getLocaleConfig(currentLocale);

  return {
    locale: currentLocale,
    localeConfig,
    locales,
    changeLocale,
    isRTL: localeConfig.rtl,
  };
}