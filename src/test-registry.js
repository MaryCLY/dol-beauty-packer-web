// src/test-registry.js
// 测试注册表，无任何外部依赖，避免循环引用导致的 TDZ。

const _tests = [];

export function registerTests(name, fn) {
  _tests.push({ name, fn });
}

export function getTests() {
  return _tests;
}
