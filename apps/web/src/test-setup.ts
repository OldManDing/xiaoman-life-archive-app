// jsdom 测试环境补充：jsdom 未实现 Element.scrollTo / Window.scrollTo，
// 而 AppLayout 在路由切换时会调用 scroller.scrollTo 重置滚动位置。
if (typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.scrollTo !== 'function') {
  HTMLElement.prototype.scrollTo = function scrollTo() {};
}
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollTo !== 'function') {
  (Element.prototype as unknown as { scrollTo?: () => void }).scrollTo = () => {};
}
if (typeof window !== 'undefined' && typeof window.scrollTo !== 'function') {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
}

export {};
