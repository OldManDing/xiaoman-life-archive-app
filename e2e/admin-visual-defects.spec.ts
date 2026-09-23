import { expect, test } from '@playwright/test';

import { adminBaseURL, loginAdmin, navigateToAdminRoute } from './helpers';

// 临时缺陷扫描：不靠肉眼，直接从运行中的后台页面里抓"看得见的毛病"。
// 输出按类型汇总 + 每类给若干条带定位的证据，便于逐条判断真伪。
const routes = [
  { path: '/dashboard', heading: '后台总览' },
  { path: '/users', heading: '账号管理' },
  { path: '/families', heading: '家庭管理' },
  { path: '/invites', heading: '邀请码管理' },
  { path: '/children', heading: '孩子档案' },
  { path: '/records', heading: '成长记录' },
  { path: '/media', heading: '媒体库' },
  { path: '/ai-jobs', heading: 'AI 任务列表' },
  { path: '/content-risks', heading: '内容风险' },
  { path: '/support-tickets', heading: '客服反馈' },
  { path: '/archive-export-requests', heading: '档案交付申请' },
  { path: '/ops-readiness', heading: '系统运维' },
  { path: '/system-config', heading: '系统配置' },
  { path: '/audit-logs', heading: '审计日志' },
  { path: '/ai-settings', heading: 'AI 服务设置' },
  { path: '/notifications', heading: '通知管理' },
];

const ALLOWED_LATIN = new Set([
  'ID', 'AI', 'API', 'URL', 'URI', 'JSON', 'HTTP', 'HTTPS', 'Key', 'App', 'Web', 'OK', 'SHA', 'MD5', 'POI', 'CSV', 'PDF',
  'PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'MP4', 'MOV', 'ZIP', 'SQL', 'UUID', 'P0', 'P1', 'P2', 'P3', 'KB', 'MB', 'GB',
  'CPU', 'RAM', 'IOS', 'HMAC', 'TLS', 'SSL', 'CORS', 'CDN', 'APK', 'SDK', 'JWT', 'OSS', 'SMS', 'AMAP', 'MOCK',
]);

type Finding = { kind: string; route: string; detail: string };

const scan = (page: import('@playwright/test').Page, allowedLatin: string[], isMobile: boolean) =>
  page.evaluate(
    ({ allowedLatin: allowed, isMobile: mobile }) => {
      const findings: Array<{ kind: string; detail: string }> = [];
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
      };
      const describe = (element: Element) => {
        const cls = typeof element.className === 'string' ? element.className.split(/\s+/).slice(0, 3).join('.') : '';
        const text = (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        return `<${element.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ''}> "${text}"`;
      };

      const parseColor = (value: string) => {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match) return null;
        const parts = match[1].split(',').map((item) => Number.parseFloat(item.trim()));
        return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
      };
      const luminance = (color: { r: number; g: number; b: number }) => {
        const channel = (value: number) => {
          const scaled = value / 255;
          return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
      };
      const effectiveBackground = (element: Element) => {
        let node: Element | null = element;
        let base = { r: 255, g: 255, b: 255, a: 1 };
        const layers: Array<{ r: number; g: number; b: number; a: number }> = [];
        while (node && node !== document.documentElement) {
          const color = parseColor(window.getComputedStyle(node).backgroundColor);
          if (color && color.a > 0) {
            layers.push(color);
            if (color.a >= 0.999) break;
          }
          node = node.parentElement;
        }
        for (const layer of layers.reverse()) {
          base = {
            r: layer.r * layer.a + base.r * (1 - layer.a),
            g: layer.g * layer.a + base.g * (1 - layer.a),
            b: layer.b * layer.a + base.b * (1 - layer.a),
            a: 1,
          };
        }
        return base;
      };

      const elements = Array.from(document.querySelectorAll('.admin-main *'));
      for (const element of elements) {
        if (!visible(element)) continue;
        const style = window.getComputedStyle(element);

        // 1) 文本截断：内容宽度超过可视宽度，且没有省略号提示
        const isTextLeaf = element.children.length === 0 && (element.textContent || '').trim().length > 0;
        if (isTextLeaf && element.scrollWidth > element.clientWidth + 2 && style.textOverflow !== 'ellipsis' && style.overflow !== 'visible') {
          findings.push({ kind: '文本被截断且无省略号', detail: `${describe(element)} 可视 ${element.clientWidth}px / 内容 ${element.scrollWidth}px` });
        }

        // 2) 对比度不足（要把 opacity 也算进去：元素或祖先半透明时，实际呈现的是与背景的混合色）
        if (isTextLeaf) {
          const color = parseColor(style.color);
          if (color) {
            const background = effectiveBackground(element);
            let alpha = 1;
            let node: Element | null = element;
            while (node && node !== document.documentElement) {
              const value = Number.parseFloat(window.getComputedStyle(node).opacity);
              if (!Number.isNaN(value)) alpha *= value;
              node = node.parentElement;
            }
            const blended = {
              r: color.r * alpha + background.r * (1 - alpha),
              g: color.g * alpha + background.g * (1 - alpha),
              b: color.b * alpha + background.b * (1 - alpha),
            };
            const ratio = (() => {
              const l1 = luminance(blended);
              const l2 = luminance(background);
              const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
              return (light + 0.05) / (dark + 0.05);
            })();
            const size = Number.parseFloat(style.fontSize);
            const weight = Number.parseInt(style.fontWeight, 10) || 400;
            const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
            const threshold = isLarge ? 3 : 4.5;
            if (ratio < threshold) {
              findings.push({
                kind: `对比度不足（${ratio.toFixed(2)} < ${threshold}）`,
                detail: `${describe(element)} color=${style.color} opacity=${alpha.toFixed(2)} bg=rgb(${Math.round(background.r)},${Math.round(background.g)},${Math.round(background.b)}) size=${style.fontSize}/${weight}${(element as HTMLButtonElement).disabled ? ' [disabled]' : ''}`,
              });
            }
          }
        }

        // 3) 英文/枚举泄漏（只在叶子文本上判断；业务编号、括号里的账号名不算）
        if (isTextLeaf) {
          const text = (element.textContent || '').trim();
          const stripped = text.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');
          const latinWords = stripped.match(/[A-Za-z][A-Za-z0-9_.-]{2,}/g) || [];
          const suspicious = latinWords.filter((word) => {
            const upper = word.toUpperCase();
            if (allowed.includes(upper)) return false;
            if (/^[A-Z]{2,}$/.test(word)) return false;
            if (/^#[0-9a-fA-F]+$/.test(word)) return false;
            if (/^(px|rem|em|ms|s|vh|vw)$/i.test(word)) return false;
            // 业务编号：含下划线或连字符且带数字，或纯小写加数字的短串
            if (/[_-]/.test(word) && /\d/.test(word)) return false;
            if (/^[a-z]+[0-9a-z]*$/i.test(word) && word.length <= 12) return false;
            // 点号连接的枚举（system.config）单独在下面判断
            return /[a-z]/.test(word) && /[A-Z]/.test(word) === false && word.length >= 4;
          });
          if (suspicious.length) {
            findings.push({ kind: '疑似英文/枚举泄漏', detail: `${describe(element)} → ${suspicious.join(', ')}` });
          }
          // 库内枚举 key（snake_case / dotted）：业务编号（含数字或过长）与文件路径不算
          if (/^[a-z][a-z]*([._-][a-z]+)+$/.test(stripped) && stripped.length <= 16 && !stripped.includes('/')) {
            findings.push({ kind: '疑似库内枚举 key', detail: describe(element) });
          }
        }

        // 4) 非法值
        if (isTextLeaf) {
          const text = element.textContent || '';
          if (/Invalid Date|NaN|undefined|\[object Object\]|>\s*null\s*</.test(text)) {
            findings.push({ kind: '非法值渲染', detail: describe(element) });
          }
        }

        // 5) 空卡片/空面板：面板类容器里没有任何可见文本
        if (typeof element.className === 'string' && /panel|card/.test(element.className) && element.className.includes('admin-')) {
          const rect = element.getBoundingClientRect();
          const text = (element.textContent || '').trim();
          if (rect.height > 60 && text.length === 0) {
            findings.push({ kind: '空白面板（无任何文字）', detail: `${describe(element)} ${Math.round(rect.width)}×${Math.round(rect.height)}` });
          }
        }

        // 6) 图片加载失败
        if (element.tagName === 'IMG') {
          const image = element as HTMLImageElement;
          if (image.complete && image.naturalWidth === 0) {
            findings.push({ kind: '图片加载失败', detail: `${describe(element)} src=${image.getAttribute('src')}` });
          }
        }

        // 7) 点击目标过小（移动端）。行内文本按钮（WCAG 2.5.8 的 inline 例外）不算。
        if (mobile) {
          const tag = element.tagName.toLowerCase();
          const interactive = tag === 'button' || tag === 'a' || element.getAttribute('role') === 'button' || tag === 'input' || tag === 'select';
          const isInlineText = style.display === 'inline' || (element.children.length === 0 && element.closest('td, p, span') !== null && tag !== 'button' && tag !== 'input' && tag !== 'select');
          if (interactive && !isInlineText) {
            const rect = element.getBoundingClientRect();
            if (rect.width < 36 || rect.height < 36) {
              findings.push({ kind: '点击目标过小', detail: `${describe(element)} ${Math.round(rect.width)}×${Math.round(rect.height)}` });
            }
          }
        }
      }

      // 8) 兄弟元素重叠（明显的视觉错位）
      const containers = Array.from(document.querySelectorAll('.admin-main .admin-panel, .admin-main .admin-table-panel, .admin-main .admin-list-summary, .admin-main .admin-audit-filter-actions'));
      for (const container of containers) {
        const kids = Array.from(container.children).filter((child) => visible(child));
        for (let i = 0; i < kids.length; i += 1) {
          for (let j = i + 1; j < kids.length; j += 1) {
            const a = kids[i].getBoundingClientRect();
            const b = kids[j].getBoundingClientRect();
            const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (overlapX > 4 && overlapY > 4) {
              const area = overlapX * overlapY;
              const smaller = Math.min(a.width * a.height, b.width * b.height);
              if (smaller > 0 && area / smaller > 0.25) {
                findings.push({
                  kind: '兄弟元素明显重叠',
                  detail: `${describe(kids[i])} 与 ${describe(kids[j])} 重叠 ${Math.round(overlapX)}×${Math.round(overlapY)}`,
                });
              }
            }
          }
        }
      }


      // 6) 页面级横向溢出
      const main = document.querySelector('.admin-main');
      if (main && main.scrollWidth > main.clientWidth + 2) {
        findings.push({ kind: '主区域横向溢出', detail: `可视 ${main.clientWidth}px / 内容 ${main.scrollWidth}px` });
      }

      return findings;
    },
    { allowedLatin, isMobile },
  );

test.describe('后台可见缺陷扫描', () => {
  test('desktop and mobile sweep', async ({ page }) => {
    test.setTimeout(600_000);
    await loginAdmin(page);

    const all: Finding[] = [];
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of routes) {
        if (viewport.name === 'mobile') {
          // 移动端侧栏是抽屉式的，aside 里的链接不可见；直接按 URL 打开（会话在 sessionStorage，不会掉登录态）。
          await page.goto(`${adminBaseURL}${route.path}`);
        } else {
          await navigateToAdminRoute(page, route.path);
        }
        await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(600);

        // 数据体量普查：页面上到底有没有东西（空表本身不是缺陷，但要能看到）
        const census = await page.evaluate(() => {
          const rows = document.querySelectorAll('.admin-responsive-table tbody tr').length;
          const empty = document.querySelectorAll('.admin-empty-state').length;
          const main = document.querySelector('.admin-main');
          return { rows, empty, textLength: (main?.textContent || '').replace(/\s+/g, '').length };
        });
        console.log(`[census] ${route.path}@${viewport.name} 行数=${census.rows} 空态=${census.empty} 正文长度=${census.textLength}`);

        for (const item of await scan(page, [...ALLOWED_LATIN], viewport.name === 'mobile')) {
          all.push({ kind: item.kind, route: `${route.path}@${viewport.name}`, detail: item.detail });
        }
      }
    }

    const grouped = new Map<string, Finding[]>();
    for (const finding of all) grouped.set(finding.kind, [...(grouped.get(finding.kind) || []), finding]);

    console.log(`[sweep] 共 ${all.length} 条发现，${grouped.size} 类`);
    for (const [kind, items] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n#### ${kind} —— ${items.length} 条`);
      const byRoute = new Map<string, number>();
      for (const item of items) byRoute.set(item.route, (byRoute.get(item.route) || 0) + 1);
      console.log(`   路由分布：${[...byRoute.entries()].map(([route, count]) => `${route}×${count}`).join('  ')}`);
      items.slice(0, 6).forEach((item) => console.log(`   - [${item.route}] ${item.detail}`));
    }

    // 客观缺陷必须为 0；「疑似英文/枚举泄漏」只做提示（业务编号、报告路径、命令名都是合法内容，
    // 需要人看，不适合做硬门禁）。
    const objective = all.filter((item) => !item.kind.startsWith('疑似'));
    expect(objective, '后台可见缺陷（对比度 / 点击目标 / 溢出 / 重叠 / 图片 / 非法值 / 空面板 / 截断）').toEqual([]);
  });
});
