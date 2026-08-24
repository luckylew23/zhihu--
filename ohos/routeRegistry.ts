// ohos/routeRegistry.ts
// ----------------------------------------------------------------------------
// 把 expo-router 的「文件路径路由」映射到 React Navigation 的 (screenName, component)。
// name 使用 URL 路径形态（去掉 /index），例如 app/question/[id]/index.tsx -> 'question/[id]'。
// 新增页面时，仿照下面追加一行即可；ROUTE_TABLE 用于 useRouter().push('/question/123') 解析。
// ----------------------------------------------------------------------------
import * as React from 'react';

import HomeTab from '../app/(tabs)/index';
import PublishTab from '../app/(tabs)/publish';
import ProfileTab from '../app/(tabs)/profile';

import Login from '../app/login/index';
import Article from '../app/article/[id]';
import Question from '../app/question/[id]/index';
import Answer from '../app/answer/[id]';
import GuestDetail from '../app/guest/detail';
import Feedback from '../app/feedback/index';
import Search from '../app/search';
import Notifications from '../app/notifications/index';
import Inbox from '../app/inbox';
import History from '../app/history';
import Collections from '../app/collections/index';
import CollectionDetail from '../app/collections/[id]';
import Comments from '../app/comments/[id]';
import Topic from '../app/topic/[id]';
import People from '../app/people/[id]';
import ShortPost from '../app/p/[id]';
import Column from '../app/column/[id]';
import Pin from '../app/pin/[id]';
import Questions from '../app/questions/[id]';
import UserIndex from '../app/user/[id]/index';
import UserFollowing from '../app/user/[id]/following';
import UserFollowers from '../app/user/[id]/followers';
import UserMutual from '../app/user/[id]/mutual';
import UserStream from '../app/user/[id]/stream';
import UserLikes from '../app/user/likes';
import Chat from '../app/chat/[id]';
import PublishAnswer from '../app/publish/answer';
import PublishArticle from '../app/publish/article';
import PublishPin from '../app/publish/pin';
import PublishQuestion from '../app/publish/question';
import SettingsAppearance from '../app/settings/appearance';
import SettingsFilter from '../app/settings/filter';

export type RouteComponent = React.ComponentType<any>;

interface RouteDef {
  name: string;
  component: RouteComponent;
}

// 主路由（不含底部 Tab 容器，Tab 在 App.tsx 中单独构建为 MainTabs）。
export const ROUTES: [string, RouteComponent][] = [
  ['login', Login],
  ['article/[id]', Article],
  ['question/[id]', Question],
  ['answer/[id]', Answer],
  ['guest/detail', GuestDetail],
  ['feedback', Feedback],
  ['search', Search],
  ['notifications', Notifications],
  ['inbox', Inbox],
  ['history', History],
  ['collections', Collections],
  ['collections/[id]', CollectionDetail],
  ['comments/[id]', Comments],
  ['topic/[id]', Topic],
  ['people/[id]', People],
  ['p/[id]', ShortPost],
  ['column/[id]', Column],
  ['pin/[id]', Pin],
  ['questions/[id]', Questions],
  ['user/[id]', UserIndex],
  ['user/[id]/following', UserFollowing],
  ['user/[id]/followers', UserFollowers],
  ['user/[id]/mutual', UserMutual],
  ['user/[id]/stream', UserStream],
  ['user/likes', UserLikes],
  ['chat/[id]', Chat],
  ['publish/answer', PublishAnswer],
  ['publish/article', PublishArticle],
  ['publish/pin', PublishPin],
  ['publish/question', PublishQuestion],
  ['settings/appearance', SettingsAppearance],
  ['settings/filter', SettingsFilter],
];

// 底部 Tab（对应原 app/(tabs)/_layout 的 Slot 结构）。
export const TAB_ROUTES: [string, RouteComponent][] = [
  ['(tabs)/index', HomeTab],
  ['(tabs)/publish', PublishTab],
  ['(tabs)/profile', ProfileTab],
];

function toPattern(name: string): { pattern: RegExp; name: string; keys: string[] } {
  const keys: string[] = [];
  const segs = name.split('/').map((seg) => {
    const m = seg.match(/^\[(.+)\]$/);
    if (m) {
      keys.push(m[1]);
      return '([^/]+)';
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return { pattern: new RegExp('^' + segs.join('/') + '$'), name, keys };
}

// 含 Tab 内路由（如 '(tabs)/index' 对应 URL '/'，按需扩展）。
const ALL: RouteDef[] = [
  ...ROUTES.map(([name, component]) => ({ name, component })),
  ...TAB_ROUTES.map(([name, component]) => ({ name, component })),
];

export const ROUTE_TABLE = ALL.map((r) => toPattern(r.name));

// 供 App.tsx 渲染 Tab 导航器使用
export { HomeTab, PublishTab, ProfileTab };
