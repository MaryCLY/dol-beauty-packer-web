# DoL 美化模组工具集

纯前端工具集，目前包含两个工具：

1. **打包模组**：把含 `body`、`clothes` 等子目录的 ZIP 压缩包打包成 [DoL ModLoader](https://github.com/Lyoko-Jeremie/sugarcube-2-ModLoader) 兼容的美化模组格式。
2. **覆盖原版图包**：把美化图片包直接覆盖到 ModLoader 版本的原版游戏图包（部分 DoL 版本下，原版图包通过 ModLoader 加载）。

## 快速使用

> ⚠ **必须通过 HTTP 服务器访问**，不能 `file://` 双击打开 `index.html`（ES Modules 在 file:// 下被浏览器拦截）。

1. 启动本地 HTTP 服务器
   ```bash
   cd dol-beauty-packer
   python3 -m http.server 8000
   ```
2. 浏览器打开 `http://localhost:8000`
3. 默认进入「打包模组」tab（URL: `#/packer`），可在顶部 tab 切到「覆盖原版图包」（URL: `#/overwrite`）

## 文件结构

```
dol-beauty-packer/
├── index.html                  # 单页壳：tab nav + 工具容器 + 样式
├── vendor/
│   └── jszip.min.js            # JSZip v3.10.1（本地依赖）
├── src/
│   ├── main.js                 # 入口：JSZip 自检 + hash 路由 + 工具挂载切换
│   ├── common.js               # 共享纯函数 + UI helpers + window.runTests
│   ├── packer.js               # 工具 1：打包模组（mount/unmount）
│   └── overwrite.js            # 工具 2：覆盖原版图包（占位）
├── docs/
│   └── superpowers/
│       └── specs/              # 设计文档（plans/ 是一次性工件，不入库）
├── test/                       # ZIP 测试 fixture
├── README.md
└── LICENSE
```

## 测试

打开页面后，F12 控制台运行 `runTests()`，查看 PASS/FAIL 计数。

## 依赖

- [JSZip](https://stuk.github.io/jszip/) — 浏览器端 ZIP 解析与生成
- 现代浏览器（Chromium / Firefox / Safari 近三年版本），需支持 ES Modules

## 参考

打包逻辑与 `boot.json` 结构参考自 **[Dol-BJX-Mods](https://github.com/cphxj123/Dol-BJX-Mods)** 仓库。

## 许可

本项目代码可自由使用。JSZip 遵循 [MIT](https://github.com/Stuk/jszip/blob/main/LICENSE.markdown) 许可。
