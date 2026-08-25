# Endfield-IS

《明日方舟：终末地》帝江号基建排班计算器前端原型。

## 本地开发

```bash
npm install
npm run dev
```

## 验证

```bash
npm run build
npm run test:sites
node --test tests/schedule-model.test.mjs
```

项目使用 Vite + React 构建。Vercel 的发布目录为 `dist/client`。
