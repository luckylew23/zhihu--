// ohos/App.tsx — HarmonyOS 应用根组件
// 用 React Navigation 直接构建导航树（替代 expo-router 的文件路由）：
//   - '(tabs)' 渲染为底部 Tab 导航器（对应原 app/(tabs)/_layout 的 Slot 结构）
//   - 其余页面注册到根 Stack 中
// navigationRef 注入给 expo-router 兼容垫片，使 useRouter().push('/question/123') 等可解析。
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { navigationRef, registerRouteTable } from '../platform/ohos/shims/expoRouter';
import { ROUTES, ROUTE_TABLE, HomeTab, PublishTab, ProfileTab } from './routeRegistry';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const queryClient = new QueryClient();

registerRouteTable(ROUTE_TABLE);

// 底部 Tab 容器：对应原 expo-router 的 (tabs) 分组
function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="(tabs)/index" component={HomeTab} />
      <Tab.Screen name="(tabs)/publish" component={PublishTab} />
      <Tab.Screen name="(tabs)/profile" component={ProfileTab} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName="(tabs)"
            screenOptions={{ headerShown: false, animationEnabled: true }}
          >
            <Stack.Screen name="(tabs)" component={MainTabs} />
            {ROUTES.map(([name, Comp]) => (
              <Stack.Screen key={name} name={name} component={Comp} />
            ))}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
