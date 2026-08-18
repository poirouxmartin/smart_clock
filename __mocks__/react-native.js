const React = require('react');

const mockComponent = (name) => {
  const Component = (props) => React.createElement('div', { ...props, 'data-testid': name });
  Component.displayName = name;
  return Component;
};

module.exports = {
  ...jest.requireActual('react-native'),
  Platform: {
    OS: 'android',
    Version: 30,
    select: (obj) => obj.android || obj.default,
  },
  View: mockComponent('View'),
  Text: mockComponent('Text'),
  TouchableOpacity: mockComponent('TouchableOpacity'),
  TouchableWithoutFeedback: mockComponent('TouchableWithoutFeedback'),
  ScrollView: mockComponent('ScrollView'),
  FlatList: mockComponent('FlatList'),
  SectionList: mockComponent('SectionList'),
  Image: mockComponent('Image'),
  TextInput: mockComponent('TextInput'),
  SafeAreaView: mockComponent('SafeAreaView'),
  KeyboardAvoidingView: mockComponent('KeyboardAvoidingView'),
  ActivityIndicator: mockComponent('ActivityIndicator'),
  RefreshControl: mockComponent('RefreshControl'),
  StatusBar: mockComponent('StatusBar'),
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => style,
    hairlineWidth: 1,
    absoluteFill: {},
    absoluteFillObject: {},
  },
  Dimensions: {
    get: (dim) => ({ width: 375, height: 667, scale: 2, fontScale: 1 })[dim],
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  PixelRatio: {
    get: () => 2,
    getFontScale: () => 1,
    getPixelSizeForLayoutSize: (size) => size * 2,
    roundToNearestPixel: (size) => Math.round(size * 2) / 2,
  },
  NativeModules: {
    PlatformConstants: {
      forceTouchAvailable: false,
    },
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
      USE_EXACT_ALARM: 'android.permission.USE_EXACT_ALARM',
      SCHEDULE_EXACT_ALARM: 'android.permission.SCHEDULE_EXACT_ALARM',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    request: jest.fn().mockResolvedValue('granted'),
    check: jest.fn().mockResolvedValue(true),
  },
  AppRegistry: {
    registerComponent: jest.fn(),
    runApplication: jest.fn(),
    unmountApplicationComponentAtRootTag: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openURL: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  AccessibilityInfo: {
    announceForAccessibility: jest.fn(),
    setAccessibilityFocus: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Animated: {
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
  },
  Easing: {
    linear: (t) => t,
    ease: (t) => t,
    quad: (t) => t * t,
    cubic: (t) => t * t * t,
    in: (easing) => easing,
    out: (easing) => (t) => 1 - easing(1 - t),
    inOut: (easing) => (t) => t < 0.5 ? easing(2 * t) / 2 : (2 - easing(2 * (1 - t))) / 2,
  },
  UIManager: {
    measure: jest.fn(),
    measureInWindow: jest.fn(),
    measureLayout: jest.fn(),
  },
  findNodeHandle: jest.fn(),
  requireNativeComponent: (name) => name,
  BackHandler: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  DeviceEventEmitter: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    emit: jest.fn(),
  },
  NativeEventEmitter: class {
    constructor() {}
    addListener = jest.fn().mockReturnValue({ remove: jest.fn() });
    removeListener = jest.fn();
    removeAllListeners = jest.fn();
    emit = jest.fn();
  },
};