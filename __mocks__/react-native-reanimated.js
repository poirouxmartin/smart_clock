const React = require('react');

module.exports = {
  default: {
    Value: class {
      constructor(value) { this._value = value; }
      setValue = (v) => { this._value = v; };
      interpolate = () => this;
      addListener = () => ({ remove: jest.fn() });
      removeListener = () => {};
    },
    timing: jest.fn().mockReturnValue({ start: jest.fn() }),
    spring: jest.fn().mockReturnValue({ start: jest.fn() }),
    decay: jest.fn().mockReturnValue({ start: jest.fn() }),
    sequence: jest.fn().mockReturnValue({ start: jest.fn() }),
    parallel: jest.fn().mockReturnValue({ start: jest.fn() }),
    delay: jest.fn().mockReturnValue({ start: jest.fn() }),
    loop: jest.fn().mockReturnValue({ start: jest.fn() }),
    event: jest.fn(),
    createAnimatedComponent: (comp) => comp,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (factory) => factory(),
    useAnimatedProps: (factory) => factory(),
    withTiming: (to, config) => to,
    withSpring: (to, config) => to,
    withDelay: (delay, animation) => animation,
    withSequence: (...animations) => animations[0],
    withRepeat: (animation, times) => animation,
    runOnUI: (fn) => fn(),
    runOnJS: (fn) => fn(),
    useWorkletCallback: (fn) => fn,
    Easing: {
      linear: (t) => t,
      ease: (t) => t,
      quad: (t) => t * t,
      cubic: (t) => t * t * t,
      in: (easing) => easing,
      out: (easing) => (t) => 1 - easing(1 - t),
      inOut: (easing) => (t) => t < 0.5 ? easing(2 * t) / 2 : (2 - easing(2 * (1 - t))) / 2,
    },
  },
  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedStyle: (factory) => factory(),
  useAnimatedProps: (factory) => factory(),
  withTiming: (to, config) => to,
  withSpring: (to, config) => to,
  withDelay: (delay, animation) => animation,
  withSequence: (...animations) => animations[0],
  withRepeat: (animation, times) => animation,
  runOnUI: (fn) => fn(),
  runOnJS: (fn) => fn(),
  useWorkletCallback: (fn) => fn,
  Easing: {
    linear: (t) => t,
    ease: (t) => t,
    quad: (t) => t * t,
    cubic: (t) => t * t * t,
    in: (easing) => easing,
    out: (easing) => (t) => 1 - easing(1 - t),
    inOut: (easing) => (t) => t < 0.5 ? easing(2 * t) / 2 : (2 - easing(2 * (1 - t))) / 2,
  },
};