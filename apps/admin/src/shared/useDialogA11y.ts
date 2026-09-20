import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 打开了自定义下拉 / 操作菜单时，Esc 的语义是「先收起浮层」，不应该直接关掉承载它的弹窗。
const CHILD_HANDLES_ESCAPE = '.admin-select-shell-open, .admin-action-menu-popover';

/**
 * 当前打开的弹窗栈。所有弹窗/抽屉都把自己的 id 压栈，只有栈顶才能响应 Esc。
 *
 * 背景：每个弹窗都在 document 的捕获阶段注册 keydown，而同一节点上的多个监听器
 * 按注册顺序全部执行，`stopPropagation()` 挡不住兄弟监听器。因此「抽屉里打开弹窗后
 * 按一次 Esc 会把抽屉和弹窗一起关掉」只能靠显式的层级判断来解决。
 */
const openDialogStack: symbol[] = [];

export const useDialogA11y = (open: boolean, onClose: () => void) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dialogIdRef = useRef<symbol>(Symbol('admin-dialog'));
  const onCloseRef = useRef(onClose);

  // onClose 通常是内联箭头函数，先把最新引用存下来，避免 effect 每次渲染都重跑
  // （重跑会把外层弹窗重新压到栈顶，破坏层级顺序）。
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const dialogId = dialogIdRef.current;
    if (!openDialogStack.includes(dialogId)) {
      openDialogStack.push(dialogId);
    }

    const previousActive = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) {
      const initialFocus = container.querySelector<HTMLElement>('[data-autofocus]') ?? container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      initialFocus?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (openDialogStack[openDialogStack.length - 1] !== dialogId) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest?.(CHILD_HANDLES_ESCAPE)) return;
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) return;

      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey) {
        if (current === first || !containerRef.current.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last || !containerRef.current.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const index = openDialogStack.indexOf(dialogId);
      if (index >= 0) openDialogStack.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus?.();
    };
  }, [open]);

  return containerRef;
};
