# DoL 美化模组打包器 - 多 ZIP 合并打包设计文档

- 日期: 2026-05-13
- 源参考: `index.html` (单 ZIP 模式 Web 版)
- 形态: 纯前端 HTML + CSS + JS 单页静态站点
- 风格: 极简 engineer style,CSS 增量 ≤ 20 行

## 1. 目标

将现有的「单 ZIP 打包」升级为「多 ZIP 合并打包」,允许用户:
- 添加多个 ZIP 压缩包作为资源来源
- 为每个 ZIP 单独指定 `img` 路径前缀
- 调整 ZIP 的合并顺序(靠下的赢,后写覆盖前写)
- 预览每个 ZIP 按当前路径匹配到的文件数
- 打包后展开查看冲突(覆盖)详情

输出仍是一个 `.mod.zip`,内含 `img/...` 与 `boot.json`。

## 2. 与原单 ZIP 模式的关系

| 原单 ZIP 行为 | 新多 ZIP 模式等价 |
|--------------|------------------|
| 上传一个 ZIP | 点「+ 添加 ZIP」逐个添加,列表中一行一个 |
| 一个 `img` 路径输入框 | 每行 ZIP 各自一个 `img` 路径输入框(默认 `/`) |
| 一个模组名称/版本号 | 保留页面顶部的产物级名称/版本号 |
| 自动填充模组名称(取文件名) | 产物名称默认为第一个 ZIP 的文件名去扩展名;版本号默认 `1.0.0` |
| `collectEntries` 提取单 ZIP 文件 | 按列表顺序遍历,逐个提取后用 Map 累积 |
| 输出一个 `.mod.zip` | 同,仍输出一个产物,但来源是多 ZIP 的合并 |

多 ZIP 模式**替换**单 ZIP 模式,不再提供单 ZIP 专用入口。列表只有一行时,行为与原来的单 ZIP 完全一致。

## 3. 数据模型

页面顶部保留产物级字段:
- `modName`: 字符串,产物 boot.json 的 `name`
- `modVersion`: 字符串,产物 boot.json 的 `version`,默认 `"1.0.0"`

核心状态数组 `sources`:

```js
[
  {
    fileName: 'base-pack.zip',    // 原始文件名,只读显示
    zip: JSZip实例,                // JSZip.loadAsync 解析后的对象
    path: '',                     // 用户输入的 img 路径,默认 '/'
    matchCount: 14,               // 按当前 path 匹配到的非目录文件数
  },
  // ...
]
```

**覆盖语义:** 按 `sources` 数组顺序遍历,后面的 ZIP 后写入累积 Map,同路径文件被后面的覆盖。列表从上到下 = 先合并,越靠下越优先。

**复用现有纯函数:** `normalizePath`、`isImageFile`、`basenameNoExt`、`buildBootJson`、`collectEntries` 沿用现有 `index.html` 的实现,不重新发明。本设计只新增 `mergeAndPack` 与列表渲染相关的业务/UI 函数。

## 4. UI 结构

页面保持单列布局(max-width 640px,水平居中),元素从上到下:

```
+--------------------------------------------------+
| DoL 美化模组打包器                                 |
|                                                    |
| 模组名称: [ base-pack                 ]           |
| 版本号:   [ 1.0.0                     ]           |
|                                                    |
| 来源列表:                                          |
| +------------------------------------------------+ |
| | base-pack.zip   img路径:[ / ] 匹配 14 个文件   | |
| |                 [上移] [下移] [删除]            | |
| +------------------------------------------------+ |
| | goose-patch.zip img路径:[ img/ ] 匹配 8 个文件  | |
| |                 [上移] [删除]                   | |
| +------------------------------------------------+ |
|                                                    |
| [ + 添加 ZIP ]                                     |
|                                                    |
| [ 开始打包 ]                                       |
|                                                    |
| 状态: 已添加 2 个 ZIP,共 22 个文件                |
| 下载: (打包完成后出现)                             |
+--------------------------------------------------+
```

**列表行细节:**
- 每行用 `<div class="row">` 包裹,内部用 flex 或简单 inline-block 排布
- 文件名:只读文本,过长时截断(`text-overflow: ellipsis`)
- img 路径输入框: `<input type="text" value="/">`,宽度约 8em
- 匹配数:动态文本,如 `匹配 14 个文件`
- 按钮: `[上移]` `[下移]` `[删除]`,原生 `<button>`,无图标
- 第 1 行隐藏「上移」按钮,最后一行隐藏「下移」按钮
- 「+ 添加 ZIP」按钮始终可用;「开始打包」按钮在 sources 为空时 `disabled`

**CSS 增量约束:**
- 新增选择器不超过 15-20 行
- 列表行用 `border-bottom` 或 `margin` 做轻微分隔,无阴影、无圆角、无动画
- 冲突详情 `<details>` 用浏览器默认样式,不额外装饰

## 5. 合并算法与覆盖策略

```js
async function mergeAndPack(sources, modName, modVersion) {
  const finalMap = new Map(); // key: relPath, value: { data: Uint8Array, source: string }
  const conflicts = [];       // [{ relPath, overwrittenBy, originalSource }]

  for (const source of sources) {
    const normalized = normalizePath(source.path);
    const entries = collectEntries(source.zip, normalized);
    if (entries.length === 0) {
      throw new Error(`"${source.fileName}" 路径 "${source.path}" 下无任何文件匹配`);
    }
    for (const item of entries) {
      const rel = item.rel;
      if (finalMap.has(rel)) {
        const old = finalMap.get(rel);
        conflicts.push({
          relPath: rel,
          overwrittenBy: source.fileName,
          originalSource: old.source
        });
      }
      const data = await item.entry.async('uint8array');
      finalMap.set(rel, { data, source: source.fileName });
    }
  }

  // 构造输出 ZIP
  const out = new JSZip();
  const imgList = [];
  const additionList = [];
  for (const [rel, { data }] of finalMap) {
    const outPath = 'img/' + rel;
    out.file(outPath, data);
    if (isImageFile(rel)) {
      imgList.push(outPath);
    } else {
      additionList.push(outPath);
    }
  }
  const bootObj = buildBootJson(modName, modVersion, imgList, additionList);
  out.file('boot.json', JSON.stringify(bootObj, null, 2));
  const blob = await out.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, totalFiles: finalMap.size, conflicts };
}
```

**覆盖语义:** 靠下的赢。`sources` 数组后面的 ZIP 在循环中后写入 `finalMap`,覆盖前面的同路径文件。

**冲突日志:**
- 只记录「被覆盖」的文件,不记录全新文件
- 最终状态文本: `完成 ✓ 合并 {N} 个文件,冲突(覆盖) {K} 个`
- 冲突详情用 `<details><summary>冲突列表 ({K})</summary><ul><li>...</li></ul></details>` 折叠,默认收起
- 每行格式: `img/body/torso.png: base-pack.zip → goose-patch.zip`

## 6. 数据流与状态机

```
用户点「+ 添加 ZIP」
   |
   v
文件选择框(accept=".zip", multiple) → 逐个 JSZip.loadAsync 解析
   |
   v
解析成功 → push 到 sources 数组,path 默认 '/',计算 matchCount
解析失败 → setStatus('error', msg),该文件不加入列表,其他已解析的不受影响
   |
   v
UI 重新渲染列表
   |
   v
用户操作:
   - 修改 path → collectEntries → 更新 matchCount → 重渲染该行
   - 点击上移/下移 → swap 数组元素 → 重渲染整个列表
   - 点击删除 → splice 数组 → 重渲染
   |
   v
点击「开始打包」
   |
   v
遍历 sources:
   1. 检查每行 matchCount > 0(打包时 double check)
   2. 用 Map 合并,记录覆盖日志
   |
   v
生成 boot.json + JSZip.generateAsync → Blob → 下载链接
```

**状态机:**

| 状态 | 触发条件 | 文案 |
|------|---------|------|
| idle | 列表为空 | 请添加至少一个 ZIP 文件 |
| reading | 用户选择文件后解析中 | 正在解析压缩包... |
| loaded | 至少有一个 ZIP 在列表中 | 已添加 {N} 个 ZIP,共 {M} 个文件 |
| packing | 点击「开始打包」 | 正在合并与打包... |
| done | 打包成功 | 完成 ✓ 合并 {N} 个文件,冲突(覆盖) {K} 个 |
| error | 任何错误 | 错误: {message} |

## 7. 错误处理

| 触发 | 操作 | 状态文本 |
|------|------|---------|
| 添加文件后缀不是 `.zip` | 点「+ 添加 ZIP」选了非 zip | 错误: 请选择 .zip 文件(该文件不加入列表) |
| 添加时 JSZip 解析抛错 | 选了损坏的 zip | 错误: 压缩包 xxx.zip 损坏或不是有效的 ZIP(不加入列表) |
| 打包时 sources 为空 | 点「开始打包」但列表无数据 | 错误: 请至少添加一个 ZIP 文件 |
| 某 zip 的 path 下无任何文件匹配 | 打包遍历到该行时 | 错误: "xxx.zip" 路径 "yyy" 下无任何文件匹配 |
| JSZip 全局加载失败 | 页面刷新发现 jszip.min.js 缺失 | 错误: 依赖 JSZip 加载失败,请检查网络(沿用现有) |

**注意:**
- 「添加」阶段的错误只影响当前文件,列表中已有的合法 zip 不受影响
- 产物名称/版本号走默认值:名称空时取第一个 zip 的文件名去扩展名;版本空时用 `"1.0.0"`
- 打包时的错误中断整个流程,不输出部分产物

## 8. 测试场景(手工验证)

| # | 场景 | 操作 | 预期结果 |
|---|------|------|----------|
| 1 | 单 ZIP 合并 = 原有功能 | 添加一个 zip(path=/),打包 | 输出结构与现有单 ZIP 完全一致 |
| 2 | 两个 ZIP 无冲突合并 | zip-A 有 body/, zip-B 有 clothes/ | 最终 imgFileList 包含两者,冲突 0 |
| 3 | 两个 ZIP 有冲突(靠下赢) | zip-A 有 body/torso.png, zip-B 也有 body/torso.png | 最终产物用 zip-B 的文件,冲突 1 |
| 4 | 上移/下移按钮 | 3 个 zip,把第 3 行移到第 1 行 | 点击上移两次,列表顺序正确变化,打包时顺序也正确 |
| 5 | 删除行 | 删除中间某行 | 列表重新渲染,打包不含已删行 |
| 6 | 空路径报错 | zip-A path 改为不存在的路径,打包 | 红色报错,不生成产物 |
| 7 | 产物名默认 | 清空名称输入框,打包 | boot.json 的 name = 第一个 zip 的文件名去扩展名 |
| 8 | 版本号默认 | 清空版本输入框,打包 | boot.json 的 version = "1.0.0" |
| 9 | 重复打包 | 一次打包完成后不刷新页面,再次点击打包 | 旧的 blob URL 被 revoke,新下载链接出现,状态文本更新 |
| 10 | 冲突详情展开 | 有冲突时,点击 `<details>` 的 summary | 展开显示每个被覆盖文件的来源 → 目标映射 |
| 11 | 添加时部分文件损坏 | 多选 3 个 zip,其中 1 个损坏 | 2 个合法 zip 加入列表,1 个报错提示,列表状态正常 |
| 12 | 匹配数实时更新 | 修改某行 path 从 `/` 改为 `img/` | 该行匹配数即时变化(若 zip 根目录无 img/ 子目录则变为 0) |

## 9. 不在本设计范围

- 不保留单 ZIP 模式的专用入口(列表只有一行时等价)
- 不实现 path 自动推断
- 不实现批量下载(输出仍是一个 `.mod.zip`)
- 不实现 ZIP 内部文件预览/缩略图
- 不实现冲突的「选择性解决」(只能全量靠下赢)
- 不实现历史记录、配置持久化
- 不实现服务端/CI/部署脚本
- 不实现 i18n

## 10. 关键风险与缓解

| 风险 | 缓解 |
|------|------|
| 浏览器内存占用过大(超大 ZIP × 多个) | 状态文本提示;异步读取;不预先全量缓存二进制(只在打包时按需 async 读取) |
| 多个大 ZIP 同时解析导致 UI 卡顿 | 解析时显示 `reading` 状态;使用 `requestIdleCallback` 或分帧解析(如需要) |
| 用户不知道覆盖优先级方向 | UI 列表从上到下,配合文案「靠下的优先覆盖」在页面说明中注明 |
| 文件名包含非 ASCII / 反斜杠 | 统一替换 `\` 为 `/`;Map key 使用处理后的路径 |
| 重复点击「开始打包」 | 每次打包新建 JSZip 输出实例;旧的 blob URL 被 revoke |

## 11. 实现里程碑

- M1: 页面骨架改造 - 单 ZIP UI 替换为多 ZIP 列表结构,name/version 保留在顶部
- M2: 添加 ZIP 功能 - 「+ 添加 ZIP」按钮,多选解析,push 到 sources 数组,列表渲染
- M3: 列表行交互 - 每行的 path 输入、匹配数实时计算、上移/下移/删除按钮
- M4: 合并打包 - `mergeAndPack` 函数,Map 累积,冲突日志收集
- M5: 冲突展示 - `<details>` 折叠显示冲突列表,状态文本更新
- M6: 默认值策略 - 名称空时用第一个 zip 文件名,版本空时用 "1.0.0"
- M7: 错误处理完整覆盖 §7
- M8: 手工执行 §8 测试场景全通过
