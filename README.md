# Ignite Expo MVP

心理陪伴产品的前端 MVP：首次开屏动画、氛围首页、三轮本地模拟对话，以及对话后的三选一状态出口。

## 运行

需要 Node.js 22.13 或更高版本（Expo SDK 57 要求）。

```bash
pnpm install
pnpm start
```

随后使用 Expo Go 扫码，或按 `i` / `a` 打开 iOS / Android 模拟器。

## 当前范围

- 首次完整开屏为 7 秒，1 秒后可跳过；完成状态保存在 AsyncStorage。
- 首页主 CTA 和三个快捷表达均进入聊天。
- `replies` 数组暂时代替 AI 接口，保留 900ms 的自然等待节奏。
- 三轮后显示：停在这里 / 再走一小步 / 先在这里待一会儿。
- 选择后的干预模块未实现，符合本轮原型范围。

## 接入真实 AI

将 `App.tsx` 中 `Chat.send()` 内的 `setTimeout` mock 替换为异步请求即可。建议保持 `Message` 类型和 `messages` 状态不变，让后端只返回下一条文本与是否展示三选项。

## 视觉素材

`assets/ember-guardian.png` 是本项目原创的透明 PNG IP 形象。整体视觉使用炭黑、矿物质感和克制的暖橙余烬，不将光的强弱映射为用户状态好坏。
