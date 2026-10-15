import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from 'react-native-reanimated';

interface AnimatedButtonProps extends Omit<TouchableOpacityProps, 'onPressIn' | 'onPressOut'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const VARIANT_STYLES = {
  primary: { bg: '#0ea5e9', text: '#fff', border: 'transparent' },
  secondary: { bg: '#7c3aed', text: '#fff', border: 'transparent' },
  outline: { bg: 'transparent', text: '#0ea5e9', border: '#0ea5e9' },
  ghost: { bg: 'transparent', text: '#8b9cb3', border: 'transparent' },
};

const SIZE_STYLES = {
  sm: { px: 16, py: 10, fontSize: 13, borderRadius: 8, gap: 6 },
  md: { px: 24, py: 14, fontSize: 15, borderRadius: 12, gap: 8 },
  lg: { px: 32, py: 18, fontSize: 17, borderRadius: 16, gap: 10 },
};

export function AnimatedButton({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  onPress,
  ...props
}: AnimatedButtonProps) {
  const pressed = useSharedValue(false);
  const { bg, text, border } = VARIANT_STYLES[variant];
  const { px, py, fontSize, borderRadius, gap } = SIZE_STYLES[size];
  
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: pressed.value ? withSpring(bg === 'transparent' ? '#1e293b' : bg, { damping: 15 }) : bg,
    borderColor: border,
    transform: [{ scale: pressed.value ? 0.97 : 1 }],
    opacity: loading ? 0.6 : 1,
  }), [loading]);
  
  const contentStyle = useAnimatedStyle(() => ({
    opacity: loading ? 0 : 1,
  }), [loading]);
  
  return (
    <TouchableOpacity
      {...props}
      onPressIn={() => { pressed.value = true; }}
      onPressOut={() => { pressed.value = false; }}
      onPress={loading ? undefined : onPress}
      activeOpacity={1}
      style={[
        styles.container,
        {
          backgroundColor: bg,
          borderWidth: border !== 'transparent' ? 1 : 0,
          borderColor: border,
          borderRadius,
          paddingHorizontal: px,
          paddingVertical: py,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap,
          width: fullWidth ? '100%' : 'auto',
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
    >
      <Animated.View style={[styles.content, contentStyle]}>
        {icon && iconPosition === 'left' && <View style={styles.icon}><Animated.Text>{icon}</Animated.Text></View>}
        <Animated.Text style={[styles.text, { color: text, fontSize: SIZE_STYLES[size].fontSize, fontWeight: '600' }]}>
          {children}
        </Animated.Text>
        {icon && iconPosition === 'right' && <View style={styles.icon}><Animated.Text>{icon}</Animated.Text></View>}
      </Animated.View>
      {loading && (
        <Animated.View style={styles.spinner}>
          <Animated.Text style={styles.spinnerText}>⟳</Animated.Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontWeight: '600',
  },
  icon: {
    marginHorizontal: 2,
  },
  spinner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerText: {
    fontSize: 20,
    color: '#fff',
  },
});

export default AnimatedButton;