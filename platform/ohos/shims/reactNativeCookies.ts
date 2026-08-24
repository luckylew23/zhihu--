// @react-native-cookies/cookies → OHOS 兼容垫片
// 在 OHOS 上以 KV 维护一个 JS Cookie Jar，供 api/client.ts 注入到请求头。
// 登录流程将 WebView 拦截到的 Cookie 写入此处即可复用现有签名逻辑。
import { kvGet, kvSet, kvDel } from './_kv';

const COOKIE_KEY = 'cookies:jar';
type CookieMap = Record<string, { value: string; [k: string]: any }>;

async function readJar(): Promise<CookieMap> {
  const raw = await kvGet(COOKIE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function writeJar(jar: CookieMap) {
  await kvSet(COOKIE_KEY, JSON.stringify(jar));
}

export const CookieManager = {
  async get(url?: string, useJSON = true): Promise<any> {
    const jar = await readJar();
    if (useJSON) return jar;
    return Object.entries(jar)
      .map(([n, c]) => `${n}=${c.value}`)
      .join('; ');
  },
  async set(url: string, cookie: any, useJSON = true): Promise<void> {
    const jar = await readJar();
    if (useJSON && typeof cookie === 'object') {
      Object.assign(jar, cookie);
    } else if (typeof cookie === 'string') {
      cookie.split(';').forEach((pair) => {
        const idx = pair.indexOf('=');
        const n = pair.slice(0, idx).trim();
        const v = pair.slice(idx + 1).trim();
        if (n) jar[n] = { value: v };
      });
    }
    await writeJar(jar);
  },
  async delete(url: string, name: string): Promise<void> {
    const jar = await readJar();
    delete jar[name];
    await writeJar(jar);
  },
  async clearAll(): Promise<void> {
    await kvDel(COOKIE_KEY);
  },
  async flush(): Promise<void> {},
};

export default CookieManager;
