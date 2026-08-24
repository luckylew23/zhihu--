// pages/index.ets —— RN OHOS 渲染宿主页面
// RNOHApp 的 appKey 必须与 ohos/index.tsx 中
// AppRegistry.registerComponent('zhihu--', ...) 的名称一致。
import { RNOHApp } from '@rnoh/react-native-openharmony';

@Entry
@Component
struct Index {
  build() {
    RNOHApp({ appKey: "zhihu--" })
  }
}
