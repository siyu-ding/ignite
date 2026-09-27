# Ignite Expo MVP

心理陪伴产品的前端 MVP：首次开屏动画、氛围首页、真实后端对话，以及由后端 Bridge offer 驱动的三选一状态出口。

## 运行

需要 Node.js 22.13 或更高版本（Expo SDK 57 要求）。

```bash
pnpm install
pnpm start
```

复制 `.env.example` 为 `.env.local`，并设置：

```bash
EXPO_PUBLIC_BACKEND_URL=https://你的后端地址
```

真机 Expo Go 不能使用 `127.0.0.1`，需要填写运行后端电脑的局域网 IP。

随后使用 Expo Go 扫码，或按 `i` / `a` 打开 iOS / Android 模拟器。

## 当前范围

- 首次完整开屏为 7 秒，1 秒后可跳过；完成状态保存在 AsyncStorage。
- 首页主 CTA 和三个快捷表达均进入聊天。
- 聊天通过 `/start`、`/ask` 接入 Backend；会话号和 token 在原生端作为一对存入 iOS Keychain/Android Keystore，token 只通过 `x-session-token` header 发送。
- App 支持 `/session/delete` 删除整串会话；成功或 404 后清除本地凭证并回到首页。
- 任意响应（包括非 2xx）要求接管新会话时，会先原子保存新的会话号与 token，再进入错误/重试判断。
- 三选项由 `/ask` 返回的稳定 `bridge` offer 驱动，并通过 `/growth-options-shown` 和 `/growth-choice` 回传。
- 选择后的干预模块未实现，符合本轮原型范围。

## 后端合同

当前实现遵循 Backend A-8 v1.2 + AMEND v1.3：原始消息做 UTF-8 SHA-256，对账失败不自动重发；`pending_transport_settlement`、`active_ask_slot` 与 `stale_session_generation` 仅按冻结的原请求做有限串行重放。

## 视觉素材

`assets/ember-guardian.png` 是本项目原创的透明 PNG IP 形象。整体视觉使用炭黑、矿物质感和克制的暖橙余烬，不将光的强弱映射为用户状态好坏。
