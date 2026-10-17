// Executes real app components/helpers with in-memory native/service boundaries.
// Effects are deliberately not run: these checks cover render paths, not device integrations.
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
module.exports = function appHarness(platform = 'ios', overrides = {}) {
  const cache = new Map();
  const noop = () => {};
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.length === 1 ? children[0] : children } }),
    useState: (v) => [typeof v === 'function' ? v() : v, noop],
    useEffect: noop, useLayoutEffect: noop,
    useMemo: (fn) => fn(), useCallback: (fn) => fn,
    useRef: (current) => ({ current }), createRef: () => ({ current: null }),
    createContext: (value) => ({ value }), useContext: (context) => context.value,
    memo: (component) => component, Fragment: 'Fragment',
  };
  const native = Object.fromEntries(['View','Text','TextInput','TouchableOpacity','ScrollView','Modal','Image','ActivityIndicator','KeyboardAvoidingView','RefreshControl','Switch','Pressable','FlatList','SafeAreaView'].map((v) => [v,v]));
  Object.assign(native, {
    Platform: { OS: platform, select: (v) => v[platform] ?? v.default },
    StyleSheet: { create: (v) => v, absoluteFillObject: {} },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Animated: { Value: class { constructor(v) { this.value = v; } }, View: 'Animated.View' },
    PanResponder: { create: () => ({ panHandlers: {} }) },
    Alert: { alert: noop }, Keyboard: { dismiss: noop }, Linking: {},
  });
  const mocks = {
    react, 'react-native': native,
    'react-native-svg': { __esModule: true, default: 'Svg', ...Object.fromEntries(['Circle','Path','G','Rect','Line','Polyline','Text','Defs','LinearGradient','Stop','Ellipse','Polygon'].map((v) => [v,v])) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'firebase/app': {}, 'firebase/functions': {}, 'firebase/auth': {}, 'firebase/firestore': {}, 'firebase/storage': {},
    'expo-image-picker': {}, 'expo-file-system': {}, 'expo-notifications': { setNotificationHandler: noop },
    'expo-web-browser': { maybeCompleteAuthSession: noop },
    'expo-auth-session/providers/google': { useAuthRequest: () => [null, null, noop], useIdTokenAuthRequest: () => [null, null, noop] },
    'expo-constants': {}, '@react-native-async-storage/async-storage': {}, ...overrides,
  };
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    if (file === path.resolve('src/firebase.js')) return overrides.firebase || { auth: {}, db: {}, storage: {} };
    const exports = {}; cache.set(file, exports);
    const code = babel.transformSync(fs.readFileSync(file, 'utf8'), {
      filename: file, configFile: false, babelrc: false,
      plugins: [({ types: t }) => ({ visitor: { CallExpression(p) { if (p.node.callee.type === 'Import') p.replaceWith(t.callExpression(t.memberExpression(t.identifier('Promise'), t.identifier('resolve')), [t.callExpression(t.identifier('require'), p.node.arguments)])); } } }), '@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
    }).code;
    new Function('require', 'exports', '__DEV__', code)((name) => {
      if (name in mocks) return mocks[name];
      if (/\.(png|jpg)$/.test(name)) return name;
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name.endsWith('.js') ? name : `${name}.js`));
      throw new Error(`Unmocked external import: ${name}`);
    }, exports, false);
    return exports;
  }
  function render(node) {
    if (node == null || typeof node === 'boolean') return [];
    if (Array.isArray(node)) return node.flatMap(render);
    if (typeof node !== 'object') return [node];
    if (!node.type) throw new Error('Undefined component');
    if (typeof node.type === 'function') return render(node.type(node.props));
    if (node.type === 'Modal' && node.props.visible === false) return [];
    return [node, ...render(node.props.children)];
  }
  return { load, render, react };
};
