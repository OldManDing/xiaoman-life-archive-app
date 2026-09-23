// 删除层叠上完全冗余的 CSS 规则：同一媒体查询上下文内，「选择器 + 声明」完全相同的前置规则
// 必然被后一条覆盖（同选择器 ⇒ 同优先级 ⇒ 后一条胜出），所以删前者不会改变任何计算结果。
//
//   node .tmp/css-dedupe.cjs            # 干跑：只报告
//   node .tmp/css-dedupe.cjs --apply    # 执行
const fs = require('node:fs');

const file = 'apps/admin/src/index.css';
const apply = process.argv.includes('--apply');
const lines = fs.readFileSync(file, 'utf8').split('\n');

const rules = [];
const stack = [];

lines.forEach((raw, index) => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('/*')) return;

  const opens = (raw.match(/\{/g) || []).length;
  const closes = (raw.match(/\}/g) || []).length;

  if (opens > 0) {
    const isAtRule = trimmed.startsWith('@');
    const selectorPart = trimmed.slice(0, trimmed.indexOf('{')).trim();
    if (isAtRule) {
      stack.push({ kind: 'at', text: selectorPart });
      // 单行 at-rule（如 @media (...) { .a { } }）罕见，这里不处理，交给多行路径
      for (let i = 1; i < opens; i += 1) stack.push({ kind: 'at-inline', text: selectorPart });
    } else {
      // 可能是单行规则 a { b: c }
      const inline = trimmed.match(/^([^@{}][^{}]*)\{\s*(.+?)\s*\}\s*$/);
      if (inline) {
        rules.push({
          selector: inline[1].trim(),
          body: inline[2].replace(/\s+/g, ' ').trim(),
          media: stack.filter((item) => item.kind === 'at').map((item) => item.text).join(' | '),
          start: index,
          end: index,
        });
      } else {
        stack.push({ kind: 'rule', text: selectorPart, start: index, body: [] });
      }
    }
    return;
  }

  if (trimmed === '}' || closes > 0) {
    // 关闭最内层块
    for (let i = 0; i < Math.max(closes, 1); i += 1) {
      const top = stack.pop();
      if (!top) break;
      if (top.kind === 'rule') {
        rules.push({
          selector: top.text,
          body: top.body.join(' ').replace(/\s+/g, ' ').trim(),
          media: stack.filter((item) => item.kind === 'at').map((item) => item.text).join(' | '),
          start: top.start,
          end: index,
        });
      }
    }
    return;
  }

  const top = stack[stack.length - 1];
  if (top && top.kind === 'rule') top.body.push(trimmed);
});

const groups = new Map();
for (const rule of rules) {
  if (!rule.body) continue;
  const key = `${rule.media}||${rule.selector}||${rule.body}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(rule);
}

const removeLines = new Set();
const removed = [];
for (const entries of groups.values()) {
  if (entries.length < 2) continue;
  const sorted = [...entries].sort((a, b) => a.start - b.start);
  for (const rule of sorted.slice(0, -1)) {
    removed.push(rule);
    for (let i = rule.start; i <= rule.end; i += 1) removeLines.add(i);
    // 顺带吃掉紧随其后的空行
    if ((lines[rule.end + 1] || '').trim() === '') removeLines.add(rule.end + 1);
  }
}

console.log(`解析到 ${rules.length} 条规则，其中 ${removed.length} 条是「同选择器 + 同声明」的前置冗余。`);
const bySection = new Map();
for (const rule of removed) {
  const prefix = rule.selector.split(/[\s>]/)[0];
  bySection.set(prefix, (bySection.get(prefix) || 0) + 1);
}
[...bySection.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([prefix, count]) => console.log(`  ${String(count).padStart(3)}×  ${prefix}`));
console.log(`将删除 ${removeLines.size} 行，文件从 ${lines.length} 行降到约 ${lines.length - removeLines.size} 行。`);

if (apply) {
  const kept = lines.filter((_, index) => !removeLines.has(index));
  fs.writeFileSync(file, kept.join('\n'), 'utf8');
  console.log('已写入。');
}
