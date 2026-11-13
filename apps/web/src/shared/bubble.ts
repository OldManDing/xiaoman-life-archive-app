const BUBBLE_CLASS = 'nl-bubble';

let installed = false;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const interactiveTarget = (event: PointerEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target) return null;
  const host = target.closest<HTMLElement>('button, a, [role="button"], [role="tab"]');
  if (!host) return null;
  if (host.hasAttribute('disabled') || host.getAttribute('aria-disabled') === 'true') return null;
  return host;
};

const spawnBubble = (host: HTMLElement, event: PointerEvent) => {
  const rect = host.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const size = Math.max(rect.width, rect.height) * 2.2;
  const centerX = event.clientX - rect.left;
  const centerY = event.clientY - rect.top;
  const fallbackX = rect.width / 2;
  const fallbackY = rect.height / 2;
  const x = Number.isFinite(centerX) && centerX > 0 ? centerX : fallbackX;
  const y = Number.isFinite(centerY) && centerY > 0 ? centerY : fallbackY;

  const bubble = document.createElement('span');
  bubble.className = BUBBLE_CLASS;
  bubble.setAttribute('aria-hidden', 'true');
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${x - size / 2}px`;
  bubble.style.top = `${y - size / 2}px`;

  host.appendChild(bubble);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => bubble.classList.add('is-on'));
  });

  const cleanup = () => {
    bubble.remove();
  };
  bubble.addEventListener('transitionend', cleanup, { once: true });
  window.setTimeout(cleanup, 800);
};

export const installBubbleEffect = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      if (prefersReducedMotion()) return;
      const host = interactiveTarget(event);
      if (!host) return;
      host.classList.add('nl-bubble-host');
      spawnBubble(host, event);
    },
    { passive: true, capture: true },
  );
};
