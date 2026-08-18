import React from 'react';
import { View, StyleSheet, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from 'react-native-reanimated';

interface AnimatedCardProps extends Omit<TouchableOpacityProps, 'style'> {
  children: React.ReactNode;
  style?: any;
  elevation?: number;
  pressScale?: number;
  onPress?: () => void;
}

export function AnimatedCard({ 
  children, 
  style, 
  elevation = 2, 
  pressScale = 0.99,
  onPress,
  ...props 
}: AnimatedCardProps) {
  const pressed = React.useRef(new Animated.SharedValue(false)).current;
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressed.value ? pressScale : 1 }],
    shadowOpacity: pressed.value ? 0.05 : 0.1,
    elevation: pressed.value ? 1 : elevation,
  }), []);
  
  return (
    <TouchableOpacity
      {...props}
      onPressIn={() => { pressed.value = true; }}
      onPressOut={() => { pressed.value = false; }}
      onPress={onPress}
      activeOpacity={1}
      style={[
        styles.container,
        {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation,
        },
        style,
      ]}
    >
      <Animated.View style={[styles.content, animatedStyle]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

export function AnimatedCardSection({ 
  children, 
  style,
  onPress,
  ...props 
}: AnimatedCardProps & { 
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <AnimatedCard {...props} style={style} onPress={onPress}>
      <View style={styles.sectionContent}>
        {(props.title || props.subtitle) && (
          <View style={styles.header}>
            {props.title && <Text style={styles.title}>{props.title}</Text>}
            {props.subtitle && <Text style={styles.subtitle}>{props.subtitle}</Text>}
          </View>
        )}
        <View style={styles.body}>
          {children}
        </View>
        {props.action && (
          <View style={styles.footer}>
            {props.action}
          </View>
        )}
      </View>
    </AnimatedCard>
  );
}

import { Text, View, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#131a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  content: {
    padding: 20,
  },
  sectionContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    color: '#8b9cb3',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  body: {
    
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
});

export default AnimatedCard;