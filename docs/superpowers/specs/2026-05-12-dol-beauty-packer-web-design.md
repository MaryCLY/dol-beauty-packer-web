# DoL 美化模组打包器 Web 版 - 设计文档

- 日期: 2026-05-12
- 源参考: `dol美化模组自动生成器.py`
- 形态: 纯前端 HTML + CSS + JS 单页静态站点
- 风格: 极简 engineer style

## 1. 目标

将原 Python 命令行脚本的功能 Web 化，让用户无需本地装 Python 即可生成符合
DoL ModLoader 规范的美化模组 ZIP 包。

输入:
- 一个用户上传的 ZIP 压缩包(包含 `body`、`clothes` 等原 `img/` 下子目录的资源)
- 一个 `path` 字符串,指向该压缩包内"原 `img/` 目录的相对位置"
  - `""` 或 `/` 表示压缩包根目录就是 `img/` 内容
  - `res/img` 表示压缩包内 `res/img/` 子目录是 `img/` 内容
- 模组名称(默认 = 压缩包文件名去扩展名,可改)
- 版本号(默认 = `1.0.0`,可改)

输出:
- 一个新的 ZIP 文件,根目录包含:
  - `img/...` 重新映射后的资源
  - `boot.json` ModLoader 配置

## 2. 功能对照表(与原 Python 脚本)

| Python 脚本行为                           | Web 端等价                              |
| ----------------------------------------- | --------------------------------------- |
| `input('模组名称')`                       | 文本输入框(默认压缩包文件名去扩展名)    |
| `input('版本号')`                         | 文本输入框(默认 `1.0.0`)                |
| `os.makedirs('img')` + 手动放入资源       | 上传 ZIP + 填 `path`                    |
| `list_files_and_subdirectories('img', d)` | 浏览器内 JSZip 遍历 entries             |
| `.png/.gif` → `imgFileList`               | 同逻辑(扩展名小写比较)                  |
| 其他后缀 → `additionFile`                 | 同逻辑                                  |
| 写 `boot.json`                            | 在内存构造同结构 JSON                   |
| `zipfile.ZipFile` 重新打包                | 用 JSZip 重新打包                       |
| `print('模组生成完成')`                   | 状态文本切换 + 出现下载按钮             |

`boot.json` 字段与原脚本严格一致:

```json
{
  "name": "<用户输入>",
  "version": "<用户输入>",
  "styleFileList": [],
  "scriptFileList": [],
  "tweeFileList": [],
  "additionFile": ["img/<相对路径>", "..."],
  "imgFileList": ["img/<相对路径>", "..."],
  "addonPlugin": [{
    "modName": "ModLoader DoL ImageLoaderHook",
    "addonName": "ImageLoaderAddon",
    "modVersion": "^2.3.0",
    "params": []
  }],
  "dependenceInfo": [{
    "modName": "ModLoader DoL ImageLoaderHook",
    "version": "^2.3.0"
  }]
}
```

## 3. 技术栈

- **单个静态 HTML 文件**(`index.html`),CSS 与 JS 全部内联
- 浏览器原生 `File` / `Blob` / `URL.createObjectURL` API
- `JSZip` 本地引入,用于解析与生成 ZIP(单行 `<script src="jszip.min.js">` 标签)

不引入框架、不引入 UI 库、不引入图标库、不使用任何 npm 依赖、无构建工具。

## 4. 文件结构

```
dol-beauty-packer/
├── dol美化模组自动生成器.py     # 既有源脚本,不动
├── index.html                     # 单文件应用 (HTML + 内联 <style> + 内联 <script> + JSZip CDN)
└── docs/superpowers/specs/2026-05-12-dol-beauty-packer-web-design.md
```

`index.html` 内部结构:

```
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>DoL 美化模组打包器</title>
  <style> ... 内联 CSS,≤ 30 行 ... </style>
</head>
<body>
  ... 单页表单与控件 ...
  <script src="jszip.min.js"></script>
  <script> ... 内联 app 逻辑 ... </script>
</body>
</html>
```

## 5. UI 结构

页面顶层是单列垂直布局,组件依次为:

1. 页面标题: `DoL 美化模组打包器`
2. 一段使用说明文本(说明 path 含义)
3. 文件上传输入框 `<input type="file" accept=".zip">`
4. 路径输入框 `<input type="text" value="/">` + 帮助文字
5. 模组名称输入框(随上传自动填默认值)
6. 版本号输入框(默认 `1.0.0`)
7. 「开始打包」按钮
8. 状态文本区 `#status`
9. 下载链接 `<a id="download" hidden>下载</a>`

ASCII mockup:

```
+--------------------------------------------+
| DoL 美化模组打包器                          |
|                                            |
| 上传 ZIP:    [ 选择文件 ] none             |
| img 路径:    [ /          ]                |
|   /  -> 压缩包根目录即 img                  |
|   res/img -> 该子目录为 img                 |
| 模组名称:    [ <压缩包名>      ]           |
| 版本号:      [ 1.0.0            ]          |
|                                            |
| [ 开始打包 ]                                |
|                                            |
| 状态: 请上传 ZIP 文件                       |
| 下载: (打包完成后出现)                      |
+--------------------------------------------+
```

## 6. CSS 极简约束

- 所有样式写在 `<head>` 内联的 `<style>` 块中(不外链)
- `<body>` 最大宽度约 640px,水平居中,默认字体
- 不设置 `font-family`,使用浏览器默认
- 颜色仅黑/白,状态文本支持三态(黑/绿/红)
- 不使用阴影、圆角、动画、hover 装饰、图标
- 内联 `<style>` 总行数 ≤ 30 行(含选择器与括号)

## 7. 数据流

```
用户选择 ZIP
   |
   v
file 对象 -> JSZip.loadAsync(file) -> zip 实例
   |
   v
[file-loaded] 状态: 显示 entries 数量
   |
   v
用户填写 path / 名称 / 版本号,点击「开始打包」
   |
   v
[packing] 状态
   1. 规范化 path
   2. 遍历 zip.files 过滤出 path 前缀内的非目录条目
   3. 按扩展名分类到 imgFileList / additionFile
   4. 异步读出每个 entry 的二进制
   5. 构造 boot.json
   6. 新建 JSZip 实例,逐项写入 img/<rel> + boot.json
   7. generateAsync({type:'blob'}) -> Blob
   |
   v
[done] 状态: URL.createObjectURL(blob) 挂到 <a download> 上,显示下载链接
```

## 8. 状态机

```
idle  --(选文件)-->  reading  -->  file-loaded
                                       |
                                  --(点击打包)-->
                                       |
                                       v
                                    packing
                                     /  \
                              成功 v    v 失败
                                  done   error
```

文案:

| 状态        | 文案                                                          |
| ----------- | ------------------------------------------------------------- |
| idle        | 请上传 ZIP 文件                                               |
| reading     | 读取压缩包...                                                 |
| file-loaded | 已加载 {N} 个条目,请确认 path 与名称后点击「开始打包」        |
| packing     | 正在分析与重新打包...                                         |
| done        | 完成 ✓ 点击下方下载链接                                       |
| error       | 错误: {message}                                               |

## 9. path 规范化规则

- 去掉首尾的 `/`
- 空串与 `/` 都视为根目录
- 非空时尾部补 `/`(用于 `startsWith` 比较)

例:
- `''` -> `''`
- `'/'` -> `''`
- `'res/img'` -> `'res/img/'`
- `'/res/img/'` -> `'res/img/'`

匹配规则:对每个非目录 entry:
- 若 `entry.name.startsWith(normalized)` 通过
- `relPath = entry.name.slice(normalized.length)`
- 输出路径 = `'img/' + relPath`

## 10. 文件分类规则

- 后缀(小写)等于 `.png` 或 `.gif` -> 入 `imgFileList`
- 其他后缀 -> 入 `additionFile`
- 与原 Python 脚本一致,不对内容做校验

## 11. 错误处理

| 触发                                | 提示                                                |
| ----------------------------------- | --------------------------------------------------- |
| 文件后缀不是 `.zip`                 | 请选择 `.zip` 文件                                  |
| JSZip 解析抛错                      | 压缩包损坏或不是有效的 ZIP                          |
| 模组名/版本号为空                   | 请填写模组名称/版本号                               |
| path 下无任何文件匹配               | 未在压缩包内找到路径 `{path}` 下的文件              |
| 路径下无任何 png/gif/其他资源       | 路径下未发现任何资源文件                            |
| JSZip 加载失败                      | 依赖加载失败,请检查 jszip.min.js 是否存在           |

## 12. 下载触发

- 用 `JSZip.generateAsync({type:'blob', compression:'DEFLATE'})` 得到 Blob
- `URL.createObjectURL(blob)` 设为 `<a id="download">.href`
- `a.download = name + '.mod.zip'`
- a 解除 `hidden`,用户点击触发下载

## 13. 浏览器兼容性

- Chromium / Firefox / Safari 主流近三年版本
- 不支持 IE / 旧 Edge

## 14. 测试场景(手工验证)

1. **典型场景 A**:上传 ZIP,根目录直接是 `body/`、`clothes/` 等子目录,path = `/` → 应得到 mod ZIP,内含 `img/body/...`、`img/clothes/...` 与 `boot.json`
2. **典型场景 B**:上传 ZIP,根目录是 `res/img/body/...`,path = `res/img` → 输出 mod 内 `img/body/...`
3. **path 错误**:上传 ZIP,path 写一个不存在的路径 → 显示错误提示
4. **非 ZIP**:上传 `.png` → 显示错误提示
5. **空 ZIP**:上传无内容的 ZIP → 显示错误提示
6. **大文件**:上传 50MB+ 的 ZIP → UI 在 packing 状态不卡死(由于异步 API)
7. **boot.json 字段验证**:解开生成的 mod ZIP,对照 §2 字段表

## 15. 不在本设计范围

- 不实现批量上传/批量打包
- 不实现 path 自动推断
- 不实现历史记录、设置持久化
- 不实现 styleFileList / scriptFileList / tweeFileList 的自动填充(原脚本也未实现)
- 不实现服务端/CI/部署脚本
- 不实现 i18n(界面文本均为中文)

## 16. 关键风险与缓解

| 风险                                                  | 缓解                                            |
| ----------------------------------------------------- | ----------------------------------------------- |
| 浏览器内存占用过大(超大 ZIP)                          | 状态文本提示,异步分批读取,不预先全量读出二进制  |
| JSZip 加载失败                                        | 错误提示;已改为本地文件避免网络依赖             |
| 文件名包含非 ASCII / 反斜杠                           | 使用 entry.name 原始字符串;统一替换 `\` 为 `/`  |
| 用户多次上传或重复点击                                | 每次重置状态机,重新构建 JSZip 输出实例          |

## 17. 实现里程碑

- M1: HTML 表单与 CSS 完成,所有控件可见
- M2: 上传 ZIP 后 JSZip.loadAsync 成功,状态切换到 file-loaded
- M3: path 规范化与文件过滤逻辑完成
- M4: boot.json 构造完成,字段值与原脚本一致
- M5: 重新打包逻辑完成,可下载
- M6: 错误处理覆盖 §11
- M7: 手工执行 §14 测试场景全通过
