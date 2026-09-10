import { defineConfig, loadEnv } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

const API_BASE_KEY = "VITE_API_BASE_URL";

/**
 * 构建期环境守卫：只在生产模式（mode === 'production'）时生效。
 *
 * 注意：不能用 command === 'build' 判断 —— uni 的 dev 命令（uni -p mp-weixin）
 * 内部同样走 Vite 的 build 流程（堆栈：CAC.runDev → build.js），
 * 用它判断会把开发编译也拦掉。真正的区分依据是 mode：
 *   uni -p mp-weixin    → mode = development
 *   uni build -p xxx    → mode = production
 *
 * 目的：让「忘了改接口地址」这件事在构建阶段就失败，而不是等传成体验版才发现。
 * 校验项（任一条不满足 → 直接抛错终止构建）：
 *   1. 必须配置（不能为空）；
 *   2. 必须是 https（小程序真机强制 https）；
 *   3. 不得指向本机（localhost / 127.0.0.1 / 0.0.0.0 / 192.168.x.x）。
 */
function assertProductionEnv(mode: string, env: Record<string, string>): void {
  const apiBaseUrl = (env[API_BASE_KEY] ?? "").trim();
  const problems: string[] = [];

  if (!apiBaseUrl) {
    problems.push(`${API_BASE_KEY} 为空 —— 生产包将没有任何可用的后端地址`);
  } else {
    if (!/^https:\/\//i.test(apiBaseUrl)) {
      problems.push(`${API_BASE_KEY} 必须是 https，当前为：${apiBaseUrl}`);
    }
    if (/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+)/i.test(apiBaseUrl)) {
      problems.push(`${API_BASE_KEY} 指向了本机/内网地址，绝不能被装进生产包：${apiBaseUrl}`);
    }
  }

  if (problems.length) {
    throw new Error(
      [
        "",
        "✖ [env 守卫] 生产构建被拦截，原因：",
        ...problems.map((p) => `   - ${p}`),
        "",
        `   当前 mode = ${mode}，读取到的配置见 .env / .env.${mode}`,
        "   正确写法：.env.production → " + `${API_BASE_KEY}=https://wellwin.top/guanzhi`,
        "",
      ].join("\n"),
    );
  }

  console.log(`✔ [env 守卫] 生产构建：${API_BASE_KEY}=${apiBaseUrl}`);
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // prefix 传空字符串 => 连非 VITE_ 前缀的变量一起加载
  const env = loadEnv(mode, process.cwd(), "") as Record<string, string>;

  if (mode === "production") assertProductionEnv(mode, env);

  return {
    plugins: [uni()],
  };
});
