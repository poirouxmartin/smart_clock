import { useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay, Easing } from 'react-native-reanimated';

export function useFadeIn(delay: number = 0, duration: number = 500) {
  const opacity = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withDelay(delay, withTiming(opacity.value, { duration, easing: Easing.out(Easing.cubic) })),
    };
  }, []);
  
  const trigger = () => {
    opacity.value = 1;
  };
  
  return { animatedStyle, trigger };
}

export function useSlideUp(delay: number = 0, duration: number = 500, distance: number = 30) {
  const translateY = useSharedValue(distance);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: withDelay(delay, withSpring(translateY.value, { damping: 20, stiffness: 150 })) }],
      opacity: withDelay(delay, withTiming(1, { duration })),
    };
  }, []);
  
  const trigger = () => {
    translateY.value = 0;
  };
  
  return { animatedStyle, trigger };
}

export function useScaleIn(delay: number = 0, duration: number = 400) {
  const scale = useSharedValue(0.9);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withDelay(delay, withSpring(scale.value, { damping: 15, stiffness: 120 })) }],
      opacity: withDelay(delay, withTiming(1, { duration })),
    };
  }, []);
  
  const trigger = () => {
    scale.value = 1;
  };
  
  return { animatedStyle, trigger };
}

export function usePulse(scale: number = 1.05, duration: number = 1000) {
  const animatedScale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: animatedScale.value }],
    };
  }, []);
  
  const trigger = () => {
    animatedScale.value = withTiming(scale, { duration: duration / 2 }, () => {
      animatedScale.value = withTiming(1, { duration: duration / 2 });
    });
  };
  
  return { animatedStyle, trigger };
}

export function useShimmer() {
  const progress = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: `rgba(255,255,255,${progress.value * 0.1})`,
    };
  }, []);
  
  const trigger = () => {
    progress.value = withTiming(1, { duration: 1000 }, () => {
      progress.value = withTiming(0, { duration: 1000 });
    });
  };
  
  return { animatedStyle, trigger };
}

export function useStaggeredEntrance(itemCount: number, baseDelay: number = 100, staggerDelay: number = 80) {
  const delays = Array.from({ length: itemCount }, (_, i) => baseDelay + i * staggerDelay);
  
  return delays.map(delay => useSlideUp(delay));
}

export function useCardPress(scale: number = 0.98) {
  const pressed = useSharedValue(false);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pressed.value ? scale : 1 }],
    };
  }, []);
  
  const onPressIn = () => { pressed.value = true; };
  const onPressOut = () => { pressed.value = false; };
  
  return { animatedStyle, onPressIn, onPressOut };
}