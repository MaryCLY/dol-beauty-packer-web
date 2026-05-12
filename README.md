# DoL 美化模组打包器

纯前端单页应用，将含 `body`、`clothes` 等子目录的 ZIP 压缩包打包成 [DoL ModLoader](https://github.com/Lyoko-Jeremie/sugarcube-2-ModLoader) 兼容的美化模组格式。

## 功能

- 上传任意 ZIP 压缩包
- 指定压缩包内 `img/` 资源的相对路径（如根目录填 `/`，子目录填 `img/`）
- 自动填充模组名称（可手动修改）
- 自动生成 `boot.json` 与重新打包为 `.mod.zip`

## 快速使用

1. 启动本地 HTTP 服务器
   ```bash
   python3 -m http.server 8000
   ```
2. 浏览器打开 `http://localhost:8000`
3. 上传 ZIP → 填写路径与模组信息 → 点击「开始打包」→ 下载产物

## 文件结构

```
dol-beauty-packer/
├── index.html                     # 单文件应用（HTML + CSS + JS）
├── jszip.min.js                   # JSZip v3.10.1（本地依赖）
├── dol美化模组自动生成器.py        # 原始 Python CLI 脚本
└── docs/
    └── superpowers/
        ├── specs/                 # 设计文档
        └── plans/                 # 实施计划
```

## 依赖

- [JSZip](https://stuk.github.io/jszip/) — 浏览器端 ZIP 解析与生成
- 现代浏览器（Chromium / Firefox / Safari 近三年版本）

## 参考

打包逻辑与 `boot.json` 结构参考自 **[Dol-BJX-Mods](https://github.com/cphxj123/Dol-BJX-Mods)** 仓库。

## 许可

本项目代码可自由使用。JSZip 遵循 [MIT](https://github.com/Stuk/jszip/blob/main/LICENSE.markdown) 许可。
