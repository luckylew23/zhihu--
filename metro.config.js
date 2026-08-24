const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ============================================================================
// HarmonyOS (HMOS) 构建别名层
// ----------------------------------------------------------------------------
// 关键设计：在 HMOS_BUILD=1 时，把上游业务代码里对 Expo / 部分 RN 模块的
// import 重定向到 platform/ohos/shims/* 下的鸿蒙兼容实现。
// 这样 app/ components/ store/ api/ utils/ 等源码【完全不需要改动】，
// 与上游 rebase 时冲突面极小（仅本文件、package.json、app.json 等受控文件）。
// ============================================================================
if (process.env.HMOS_BUILD === '1') {
  const shim = (name) => path.join(__dirname, 'platform', 'ohos', 'shims', name);

  config.resolver.alias = {
    ...(config.resolver.alias || {}),

    // 整个 React Native 运行时替换为 OpenHarmony 端口
    'react-native': '@react-native-ohos/react-native',

    // —— Expo 叶子模块 → 鸿蒙兼容实现 ——
    'expo-secure-store': shim('expoSecureStore.ts'),
    'expo-crypto': shim('expoCrypto.ts'),
    'expo-clipboard': shim('expoClipboard.ts'),
    'expo-file-system': shim('expoFileSystem.ts'),
    'expo-file-system/legacy': shim('expoFileSystemLegacy.ts'),
    'expo-linking': shim('expoLinking.ts'),
    'expo-web-browser': shim('expoWebBrowser.ts'),
    'expo-sharing': shim('expoSharing.ts'),
    'expo-intent-launcher': shim('expoIntentLauncher.ts'),
    'expo-haptics': shim('expoHaptics.ts'),
    'expo-blur': shim('expoBlur.ts'),
    'expo-linear-gradient': shim('expoLinearGradient.ts'),
    'expo-status-bar': shim('expoStatusBar.ts'),
    'expo-screen-orientation': shim('expoScreenOrientation.ts'),
    'expo-splash-screen': shim('expoSplashScreen.ts'),
    'expo-constants': shim('expoConstants.ts'),
    'expo-sqlite': shim('expoSqlite.ts'),
    'expo-media-library': shim('expoMediaLibrary.ts'),

    // —— 第三方 RN 库（OHOS 没有原生实现，用兼容垫片）——
    '@react-native-cookies/cookies': shim('reactNativeCookies.ts'),
    'react-native-root-siblings': shim('reactNativeRootSiblings.tsx'),

    // —— Expo Router → 基于 React Navigation 的兼容层 ——
    'expo-router': shim('expoRouter.tsx'),
    'expo-router/entry': path.join(__dirname, 'ohos', 'index.tsx'),
    'expo-router/html': shim('expoRouterHtml.tsx'),
  };

  // OHOS 上不需要 expo 专属的 haste/module 处理，关闭部分 expo 预设以提速
  config.transformer = {
    ...config.transformer,
    // 避免 expo 资产插件在 OHOS 下报错
    assetPlugins: [],
  };
}

module.exports = withNativeWind(config, { input: './global.css' });
