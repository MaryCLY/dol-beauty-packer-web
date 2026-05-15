// src/main.js
// 入口。M3 阶段:直接挂载 packer 工具,无路由。M4 会替换为 hash 路由 + tab 切换。

import * as packer from './packer.js';

window.addEventListener('DOMContentLoaded', () => {
  if (typeof window.JSZip === 'undefined') {
    const c = document.getElementById('tool-container');
    if (c) {
      c.innerHTML = '<div class="err">错误: 依赖 JSZip 加载失败, 请检查 vendor/jszip.min.js</div>';
    }
    return;
  }
  const container = document.getElementById('tool-container');
  if (!container) return;
  packer.mount(container);
});
