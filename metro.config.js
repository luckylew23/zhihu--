const path = require('path');

// HarmonyOS (HMOS) 构建走独立的 Metro 配置：
//   - 不依赖 expo/metro-config（OHOS 依赖清单未安装 expo）
//   - 使用 Metro 公开稳定的默认结构构造配置，再叠加 OHOS 别名层
// 非 HMOS 构建（Android/iOS/Web 上游）仍用 expo 配置，保证与上游 rebase 零冲突。
let config;
if (process.env.HMOS_BUILD === '1') {
  // RN 0.83+ 的 Metro 默认配置 API 已重构（getDefaultConfig 返回空），
  // 这里使用 Metro 公开的稳定默认结构构造配置。
  // 真实 RN 工程由 RNOH 的 hvigor 插件在构建时调用 Metro，本配置供
  // `HMOS_BUILD=1 metro get-dependencies / bundle` 等命令离线验证使用。
  const { mergeConfig } = require('metro-config');
  config = {
    resolver: {
      sourceExts: ['js', 'jsx', 'json', 'ts', 'tsx', 'json5'],
      assetExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'ttf', 'otf', 'woff', 'woff2'],
      platforms: ['ios', 'android', 'native', 'windows', 'web', 'harmony'],
      resolverMainFields: ['react-native', 'browser', 'main'],
    },
    transformer: {
      babelTransformerPath: require.resolve('metro-babel-transformer'),
      assetPlugins: [],
      getTransformOptions: async () => ({
        transform: { experimentalImportSupport: false, inlineRequires: false },
      }),
    },
    serializer: {
      getModulesRunBeforeMainModule: () => [],
      getPolyfills: () => [],
    },
    server: { port: 8081 },
    watchFolders: [],
    projectRoot: __dirname,
  };
  // 保留 mergeConfig 以备将来扩展
  void mergeConfig;
} else {
  const { getDefaultConfig } = require('expo/metro-config');
  const { withNativeWind } = require('nativewind/metro');
  config = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' });
}

// ============================================================================
// HarmonyOS (HMOS) 构建别名层
// ----------------------------------------------------------------------------
// 关键设计：在 HMOS_BUILD=1 时，把上游业务代码里对 Expo / 部分 RN 模块的
// import 重定向到 platform/ohos/shims/* 下的鸿蒙兼容实现。
// 这样 app/ components/ store/ api/ utils/ 等源码【完全不需要改动】，
// 与上游 rebase 时冲突面极小（仅本文件、package.json、app.json 等受控文件）。
//
// 实现方式：resolver.resolveRequest（而非 resolver.extraNodeModules）
//   - extraNodeModules 只能按「包名」整体替换，无法处理带子路径的模块名
//     （如 'expo-file-system/legacy'、'expo-router/entry'）
//   - resolveRequest 接收完整的模块请求名，可精确匹配子路径与自定义前缀
// ----------------------------------------------------------------------------
if (process.env.HMOS_BUILD === '1') {
  const shim = (name) => path.join(__dirname, 'platform', 'ohos', 'shims', name);

  // 注意：React Native 运行时**不要**重定向到 @react-native-ohos/react-native——
  // 该包在 npm/ohpm 上不存在（RNOH 适配发生在原生层，JS 层仍用标准 react-native）。
  const ALIASES = {
    // —— Expo 叶子模块 → 鸿蒙兼容实现 ——
    'expo-secure-store': shim('expoSecureStore.ts'),
    'expo-crypto': shim('expoCrypto.ts'),
    'expo-clipboard': shim('expoClipboard.ts'),
    'expo-file-system': shim('expoFileSystem.ts'),
    // ⚠️ 子路径别名必须在此显式列出：useAuthStore / saveImage / UpdateChecker 都在用
    'expo-file-system/legacy': shim('expoFileSystemLegacy.ts'),
    'expo-linking': shim('expoLinking.ts'),
    'expo-web-browser': shim('expoWebBrowser.ts'),
    'expo-sharing': shim('expoSharing.ts'),
    'expo-intent-launcher': shim('expoIntentLauncher.ts'),
    'expo-haptics': shim('expoHaptics.ts'),
    'expo-blur': shim('expoBlur.tsx'),
    'expo-linear-gradient': shim('expoLinearGradient.tsx'),
    'expo-status-bar': shim('expoStatusBar.tsx'),
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
    'expo-router/html': shim('expoRouterHtml.tsx'),
    'expo-router/entry': shim('expoRouterEntry.tsx'),
  };

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // 1) tsconfig 的 paths: { "@/*": ["./*"] } —— 上游代码大量使用 '@/store/xxx' 等
    if (moduleName.startsWith('@/')) {
      return context.resolveRequest(
        context,
        path.join(__dirname, moduleName.slice(2)),
        platform,
      );
    }
    // 2) Expo / 第三方模块 → 鸿蒙垫片（含子路径）
    const target = Object.prototype.hasOwnProperty.call(ALIASES, moduleName)
      ? ALIASES[moduleName]
      : null;
    if (target) {
      return context.resolveRequest(context, target, platform);
    }
    // 3) 其余按默认规则解析
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
