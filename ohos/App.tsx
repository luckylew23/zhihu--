// ohos/App.tsx — HarmonyOS 应用根组件
// ----------------------------------------------------------------------------
// 在 OHOS 构建中，真正的根入口是 harmony/ 工程的 ArkTS 层（RNOHApp -> AppRegistry
// 拉起 ohos/index.tsx -> 本文件）。因此原 app/_layout.tsx 不会作为根被挂载，
// 它里面那部分「跨页面全局逻辑」必须在这里重新承载：
//   - QueryClient（含知乎 40352 人机验证的 retry 策略）
//   - ThemeProvider（暗色/亮色，跟随 useThemeStore）
//   - RootSiblingParent（全局 Toast / Modal 渲染容器）
//   - 全局浮层：剪贴板链接弹窗、人机验证弹窗、收藏弹窗、状态栏、顶部渐变遮罩
//   - 深度链接（Linking）与剪贴板监听 -> router.push 分发
//
// 导航树用 React Navigation 直接构建（替代 expo-router 文件路由）：
//   - '(tabs)' 直接映射到 HomeScreen（_home 内部用 PagerView 自管关注/推荐/发布/我的
//     横向滑动 + 自定义底部栏，因此不要再套一层原生 Tab.Navigator，否则会出现双底栏）。
//   - 其余页面注册到根 Stack 中；原 app/_layout.tsx 里用 <Stack.Screen options> 声明的
//     标题 / 模态 / 动画，统一移植到本文件的 optionsFor() 里（expo-router 兼容垫片里
//     Stack 是 no-op，无法承载这些声明）。
// ----------------------------------------------------------------------------
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { AppState, type AppStateStatus, Linking } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootSiblingParent } from 'react-native-root-siblings';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';

import { navigationRef, registerRouteTable, useRouter } from '../platform/ohos/shims/expoRouter';
import { ROUTES, ROUTE_TABLE, HomeTab } from './routeRegistry';

import { GradientMaskOverlay } from '@/components/GradientMaskOverlay';
import { VerificationModal } from '@/components/VerificationModal';
import { CollectionToastOverlay } from '@/components/CollectionToastOverlay';
import { CollectionSelectorModal } from '@/components/CollectionSelectorModal';
import { ClipboardLinkModal } from '@/components/ClipboardLinkModal';
import { UpdateChecker } from '@/components/UpdateChecker';

import { useThemeStore, useSyncThemeWithNativeWind } from '@/store/useThemeStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { isExpoInternalUrl, parseZhihuUrl } from '@/utils/url';
import { consumeAppClipboardText } from '@/utils/clipboard';
import Colors from '@/constants/Colors';

const Stack = createStackNavigator();

// 与 app/_layout.tsx 保持一致的 retry 策略：遇到知乎人机验证错误（40352）立即停止自动重试。
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: any) => {
        if (error?.response?.data?.error?.code === 40352) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

registerRouteTable(ROUTE_TABLE);

// 把 app/_layout.tsx 中 <Stack.Screen options> 的声明移植到这里。
// 返回 undefined 表示使用默认 header（部分内页会用 navigation.setOptions 在运行时自设标题）。
function useScreenOptions() {
  const isDark = useThemeStore((state) => state.isDark);
  const { primaryColor } = useSettingsStore();
  const currentTint = primaryColor || Colors[isDark ? 'dark' : 'light'].primary;

  const base = {
    headerStyle: { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' },
    headerTitleStyle: { color: isDark ? '#ffffff' : '#1a1a1a', fontWeight: 'bold' as const },
    headerTintColor: currentTint,
    headerShadowVisible: false,
  };

  return (name: string) => {
    switch (name) {
      case '(tabs)':
        return { headerShown: false };
      case 'article/[id]':
        return { ...base, headerTitle: '正文', headerBackTitle: '返回' };
      case 'login/index':
        return { ...base, presentation: 'modal', headerTitle: '登录知乎', headerLeft: () => null };
      case 'feedback/index':
        return { headerShown: false, presentation: 'card' };
      case 'publish/answer':
      case 'publish/article':
      case 'publish/pin':
      case 'publish/question':
        return { headerShown: false, presentation: 'fullScreenModal' };
      case 'question/[id]/index':
        return { headerShown: false, animation: 'fade' as const };
      case 'answer/[id]':
        return { headerShown: false, animation: 'fade' as const };
      case 'guest/detail':
        return { headerShown: false, animation: 'slide_from_right' as const };
      case 'modal':
        return { presentation: 'modal', title: '提示' };
      default:
        return { ...base };
    }
  };
}

export default function App() {
  const router = useRouter();
  const isDark = useThemeStore((state) => state.isDark);
  const theme = isDark ? DarkTheme : DefaultTheme;
  const optionsFor = useScreenOptions();

  // 同步 NativeWind 暗色模式与 zustand 主题 store。
  useSyncThemeWithNativeWind();

  const [clipboardModalVisible, setClipboardModalVisible] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState('');
  const lastCheckedUrlRef = useRef<string | null>(null);
  const pendingExternalPathRef = useRef<string | null>(null);

  // 冷启动时监听外部唤起（深度链接）。
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isExpoInternalUrl(url)) return;
      pendingExternalPathRef.current = parseZhihuUrl(url);
      setClipboardModalVisible(false);
    });
    return () => subscription.remove();
  }, []);

  // App 回到前台时检查剪贴板里的知乎链接，命中则弹窗提示跳转。
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        pendingExternalPathRef.current = null;
        return;
      }
      if (nextAppState === 'active') {
        try {
          const hasText = await Clipboard.hasStringAsync();
          if (!hasText) return;
          const text = await Clipboard.getStringAsync();
          if (!text) return;
          if (consumeAppClipboardText(text)) {
            lastCheckedUrlRef.current = text;
            return;
          }
          if (
            text &&
            text !== lastCheckedUrlRef.current &&
            (text.includes('zhihu.com/') || text.includes('zhuanlan.zhihu.com/'))
          ) {
            lastCheckedUrlRef.current = text;
            const urlMatch = text.match(/https?:\/\/(?:www\.|zhuanlan\.)?zhihu\.com\/[^\s]*/);
            const url = urlMatch ? urlMatch[0] : null;
            if (url) {
              const pendingExternalPath = pendingExternalPathRef.current;
              pendingExternalPathRef.current = null;
              if (parseZhihuUrl(url) === pendingExternalPath) {
                lastCheckedUrlRef.current = text;
                return;
              }
              setClipboardUrl(url);
              setClipboardModalVisible(true);
            }
          }
        } catch (e) {
          console.warn('Failed to read clipboard on app active', e);
        }
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootSiblingParent>
          <ThemeProvider value={theme}>
            <UpdateChecker />
            <ClipboardLinkModal
              visible={clipboardModalVisible}
              url={clipboardUrl}
              onClose={() => setClipboardModalVisible(false)}
              onOpen={() => {
                setClipboardModalVisible(false);
                const path = parseZhihuUrl(clipboardUrl);
                if (path) router.push(path);
              }}
            />

            <NavigationContainer ref={navigationRef}>
              <Stack.Navigator
                initialRouteName="(tabs)"
                screenOptions={{ headerShown: true, animationEnabled: true }}
              >
                <Stack.Screen name="(tabs)" component={HomeTab} options={optionsFor('(tabs)')} />
                {ROUTES.map(([name, Comp]) => (
                  <Stack.Screen key={name} name={name} component={Comp} options={optionsFor(name)} />
                ))}
              </Stack.Navigator>
            </NavigationContainer>

            {/* 全局状态栏和底部安全区渐变模糊遮罩 */}
            <GradientMaskOverlay isDark={isDark} />
            {/* 全局状态栏控制 */}
            <StatusBar style={isDark ? 'light' : 'dark'} />
            {/* 人机验证弹窗 */}
            <VerificationModal />
            {/* 全局收藏提醒和弹窗 */}
            <CollectionToastOverlay />
            <CollectionSelectorModal />
          </ThemeProvider>
        </RootSiblingParent>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
