// src/overwrite.js
// 占位模块。具体功能"把美化图片包覆盖到 modloader 版本的原版游戏图包"的设计待后续 spec。

export function mount(container) {
  container.innerHTML = `
    <h2 style="font-size:1.1em;">覆盖到原版游戏图包</h2>
    <p style="color:#666;">
      把美化图片包直接覆盖到 ModLoader 版本的原版游戏图包(部分 DoL 版本下,
      原版图包通过 ModLoader 加载)。
    </p>
    <p style="color:#aaa;">此工具尚在设计中,占位实现。</p>
  `;
}

export function unmount(container) {
  container.innerHTML = '';
}
