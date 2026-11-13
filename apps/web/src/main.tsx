import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './global.css';
// 全站视觉系统 v3（暖光玻璃）：令牌 + 全局底 + 玻璃三级；删除此 import 即可回滚
import './styles/design-system-v3.css';
// 01–07 视觉对齐：把「素纸·绿」换成设计稿的暖琥珀玻璃；删除此 import 即回滚
import './styles/home-glass-v3.css';
// 05–09 页级结构层：家庭 / 我的 / 搜索 / 孩子建档 的设计稿版式；删除此 import 即回滚
import './styles/glass-pages-v3.css';
// 全站按钮水泡点击反馈（pointerdown 冒泡 + 圆角裁切）
import './styles/bubble.css';
import { installBubbleEffect } from './shared/bubble';

installBubbleEffect();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
