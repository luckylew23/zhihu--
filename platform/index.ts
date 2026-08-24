// platform/index.ts
// 运行时判断当前是否处于 HarmonyOS (OHOS) 构建。
// 业务代码可选择性地根据 isOHOS 做差异化处理，但绝大多数逻辑应无需分支。
import { Platform } from 'react-native';

export const isOHOS = Platform.OS === 'ohos';
export const isHarmonyOS = isOHOS;

export type PlatformName = 'ios' | 'android' | 'web' | 'ohos' | 'windows' | 'macos';

export function platformName(): PlatformName {
  return (Platform.OS as PlatformName) ?? 'ohos';
}

export { isOHOS as default };
