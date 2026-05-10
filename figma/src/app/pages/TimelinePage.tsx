import React, { useState } from 'react';
import { Star, Play, Search, SlidersHorizontal, Tag, User } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { BottomNav } from '../components/BottomNav';

export default function TimelinePage() {
  const [activeFilter, setActiveFilter] = useState('全部');
  const filters = ['全部', '照片', '视频', '文字', '语音', '里程碑'];

  return (
    <div className="min-h-[100dvh] bg-white text-stone-800 font-sans mx-auto max-w-md flex flex-col relative pb-[100px] overflow-x-hidden">
      {/* 顶部标题与功能区 */}
      <header className="px-5 pt-12 pb-2 bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[18px] font-medium text-stone-800 tracking-wide">时间轴</h1>
          <div className="flex items-center gap-3 text-stone-500">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-50 border border-stone-100/80 active:bg-stone-100 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <Search size={16} strokeWidth={2.5} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-50 border border-stone-100/80 active:bg-stone-100 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <SlidersHorizontal size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {filters.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors shrink-0 ${
                activeFilter === filter 
                  ? 'bg-stone-800 text-white shadow-sm' 
                  : 'bg-stone-50 border border-stone-100/80 text-stone-600 hover:bg-stone-100/80'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-5 pt-4 flex flex-col gap-8">
        
        {/* 月份分组：2026年 4月 */}
        <section className="relative">
          {/* 月份标题吸顶 */}
          <div className="sticky top-[120px] z-30 bg-white/95 py-2 mb-2 w-max rounded-full pr-4 flex items-baseline gap-2">
            <h2 className="text-[18px] font-bold text-stone-800 tracking-wide">2026年 4月</h2>
            <span className="text-[13px] font-medium text-stone-400">· 3条记录</span>
          </div>
          
          <div className="flex flex-col pb-4">
            
            {/* 里程碑卡 */}
            <div className="flex w-full relative mb-5">
              <div className="w-[32px] shrink-0 flex flex-col items-center relative">
                <div className="w-[1.5px] bg-stone-100 absolute top-[28px] bottom-[-20px] z-0" />
                <div className="w-3.5 h-3.5 rounded-full bg-amber-500 ring-[3.5px] ring-white z-10 mt-[18px]" />
              </div>
              <div className="flex-1">
                <div className="bg-gradient-to-b from-[#FAF8F5] to-white border border-[#F2EFE9] rounded-[20px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-100/50 to-transparent rounded-bl-3xl pointer-events-none" />
                  
                  {/* 类型/徽标 */}
                  <div className="flex items-center gap-1.5 mb-2.5 text-amber-600 relative z-10">
                     <Star size={14} fill="currentColor" />
                     <span className="text-[12px] font-medium tracking-wide">里程碑档案</span>
                  </div>
                  
                  {/* 标题 */}
                  <h3 className="text-[16px] font-bold text-stone-800 mb-1 relative z-10">第一次独立走路</h3>
                  
                  {/* 摘要/正文 */}
                  <p className="text-[14.5px] text-stone-700 leading-relaxed mb-3 relative z-10">
                    小沐今天在客厅突然挣脱了学步车，摇摇晃晃地向前走了三四步，全家都欢呼了起来。
                  </p>
                  
                  {/* 媒体区 */}
                  <div className="relative mb-3 rounded-xl overflow-hidden border border-stone-100/50 z-10">
                    <ImageWithFallback 
                      src="https://images.unsplash.com/photo-1543636200-64e72565dc16?auto=format&fit=crop&w=600&q=80" 
                      alt="第一次走路"
                      className="w-full h-44 object-cover" 
                    />
                  </div>
                  
                  {/* 元信息：时间 → 记录者 → 标签 */}
                  <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-[#F2EFE9]/50">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-stone-400 font-medium">4月12日 14:30</span>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                        <User size={12} strokeWidth={2} />
                        <span>妈妈记录</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="flex items-center gap-1 bg-white border border-stone-100/50 px-2 py-0.5 rounded-md text-[10px] text-stone-500 shadow-sm">
                        <Tag size={10} strokeWidth={2.5} />
                        大动作发展
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 普通图文卡 */}
            <div className="flex w-full relative mb-5">
              <div className="w-[32px] shrink-0 flex flex-col items-center relative">
                <div className="w-[1.5px] bg-stone-100 absolute top-[28px] bottom-[-20px] z-0" />
                <div className="w-2.5 h-2.5 rounded-full bg-stone-300 ring-[3.5px] ring-white z-10 mt-[20px]" />
              </div>
              <div className="flex-1">
                <div className="bg-white border border-stone-100/80 rounded-[20px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                  
                  {/* 类型/徽标 */}
                  <div className="flex items-center gap-1.5 mb-2.5 text-stone-500">
                     <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                     <span className="text-[12px] font-medium tracking-wide">图文档案</span>
                  </div>
                  
                  {/* 标题 */}
                  <h3 className="text-[16px] font-bold text-stone-800 mb-1">发现秋天的颜色</h3>
                  
                  {/* 摘要/正文 */}
                  <p className="text-[14.5px] text-stone-700 leading-relaxed mb-3">
                    今天带小沐去公园散步，他对飘落的树叶充满好奇，追着一片叶子跑了很久。
                  </p>
                  
                  {/* 媒体区 */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-xl overflow-hidden border border-stone-100/50 h-28">
                      <ImageWithFallback src="https://images.unsplash.com/photo-1762912913453-66e34acfe5a4?auto=format&fit=crop&w=300&q=80" alt="公园散步" className="w-full h-full object-cover" />
                    </div>
                    <div className="rounded-xl overflow-hidden border border-stone-100/50 h-28">
                      <ImageWithFallback src="https://images.unsplash.com/photo-1626187429639-7a77bfad0523?auto=format&fit=crop&w=300&q=80" alt="追树叶" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  
                  {/* 元信息：时间 → 记录者 → 标签 */}
                  <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-stone-50">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-stone-400 font-medium">4月10日 16:20</span>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                        <User size={12} strokeWidth={2} />
                        <span>爸爸记录</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="flex items-center gap-1 bg-stone-50 border border-stone-100/50 px-2 py-0.5 rounded-md text-[10px] text-stone-500">
                        <Tag size={10} strokeWidth={2.5} />
                        户外日常
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 语音卡 */}
            <div className="flex w-full relative">
              <div className="w-[32px] shrink-0 flex flex-col items-center relative">
                <div className="w-2.5 h-2.5 rounded-full bg-stone-300 ring-[3.5px] ring-white z-10 mt-[20px]" />
              </div>
              <div className="flex-1">
                <div className="bg-white border border-stone-100/80 rounded-[20px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                  
                  {/* 类型/徽标 */}
                  <div className="flex items-center gap-1.5 mb-2.5 text-stone-500">
                     <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                     <span className="text-[12px] font-medium tracking-wide">语音档案</span>
                  </div>
                  
                  {/* 标题 */}
                  <h3 className="text-[16px] font-bold text-stone-800 mb-1">第一次清晰叫妈妈</h3>
                  
                  {/* 摘要/正文 */}
                  <p className="text-[14.5px] text-stone-700 leading-relaxed mb-3">
                    早晨醒来，小沐看着我清晰地喊了一声“妈妈”，赶紧用手机录下了这珍贵的时刻。
                  </p>
                  
                  {/* 媒体区：语音播放器 */}
                  <div className="bg-stone-50 rounded-full p-1.5 pr-4 flex items-center gap-3 border border-stone-100/80 shadow-[0_1px_4px_rgba(0,0,0,0.01)] cursor-pointer active:bg-stone-100 transition-colors mb-3">
                     <div className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center shrink-0 shadow-md shadow-stone-800/20">
                       <Play size={14} className="text-white ml-0.5" fill="currentColor" />
                     </div>
                     <div className="flex-1 flex items-center gap-[3px] h-5 opacity-70">
                       {[40, 20, 60, 100, 80, 40, 50, 90, 70, 30, 20, 50, 40, 20].map((h, i) => (
                         <div key={i} className="w-1 bg-stone-400 rounded-full" style={{ height: `${h}%` }} />
                       ))}
                     </div>
                     <span className="text-[13px] font-medium text-stone-500">0:12</span>
                  </div>
                  
                  {/* 元信息：时间 → 记录者 → 标签 */}
                  <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-stone-50">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-stone-400 font-medium">4月5日 09:15</span>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                        <User size={12} strokeWidth={2} />
                        <span>妈妈记录</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="flex items-center gap-1 bg-stone-50 border border-stone-100/50 px-2 py-0.5 rounded-md text-[10px] text-stone-500">
                        <Tag size={10} strokeWidth={2.5} />
                        语言发育
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 月份分组：2026年 3月 */}
        <section className="relative">
          <div className="sticky top-[120px] z-30 bg-white/95 py-2 mb-2 w-max rounded-full pr-4 flex items-baseline gap-2">
            <h2 className="text-[18px] font-bold text-stone-800 tracking-wide">2026年 3月</h2>
            <span className="text-[13px] font-medium text-stone-400">· 2条记录</span>
          </div>
          
          <div className="flex flex-col pb-4">
            
            {/* 普通文本卡 */}
            <div className="flex w-full relative mb-5">
              <div className="w-[32px] shrink-0 flex flex-col items-center relative">
                <div className="w-[1.5px] bg-stone-100 absolute top-[28px] bottom-[-20px] z-0" />
                <div className="w-2.5 h-2.5 rounded-full bg-stone-300 ring-[3.5px] ring-white z-10 mt-[20px]" />
              </div>
              <div className="flex-1">
                <div className="bg-white border border-stone-100/80 rounded-[20px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                  
                  {/* 类型/徽标 */}
                  <div className="flex items-center gap-1.5 mb-2.5 text-stone-500">
                     <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                     <span className="text-[12px] font-medium tracking-wide">文字档案</span>
                  </div>
                  
                  {/* 标题 */}
                  <h3 className="text-[16px] font-bold text-stone-800 mb-1">睡前的小确幸</h3>
                  
                  {/* 摘要/正文 */}
                  <p className="text-[14.5px] text-stone-700 leading-relaxed mb-3">
                    今天晚上的睡前故事讲了三遍《猜猜我有多爱你》，小家伙听得津津有味，最后抓着我的手指睡着了，很安稳。
                  </p>
                  
                  {/* 媒体区（空） */}
                  
                  {/* 元信息：时间 → 记录者 → 标签 */}
                  <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-stone-50">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-stone-400 font-medium">3月28日 21:40</span>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                        <User size={12} strokeWidth={2} />
                        <span>奶奶记录</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="flex items-center gap-1 bg-stone-50 border border-stone-100/50 px-2 py-0.5 rounded-md text-[10px] text-stone-500">
                        <Tag size={10} strokeWidth={2.5} />
                        睡前时光
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 里程碑卡 */}
            <div className="flex w-full relative">
              <div className="w-[32px] shrink-0 flex flex-col items-center relative">
                <div className="w-3.5 h-3.5 rounded-full bg-amber-500 ring-[3.5px] ring-white z-10 mt-[18px]" />
              </div>
              <div className="flex-1">
                <div className="bg-gradient-to-b from-[#FAF8F5] to-white border border-[#F2EFE9] rounded-[20px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-100/50 to-transparent rounded-bl-3xl pointer-events-none" />
                  
                  {/* 类型/徽标 */}
                  <div className="flex items-center gap-1.5 mb-2.5 text-amber-600 relative z-10">
                     <Star size={14} fill="currentColor" />
                     <span className="text-[12px] font-medium tracking-wide">里程碑档案</span>
                  </div>
                  
                  {/* 标题 */}
                  <h3 className="text-[16px] font-bold text-stone-800 mb-1 relative z-10">三岁生日快乐</h3>
                  
                  {/* 摘要/正文 */}
                  <p className="text-[14.5px] text-stone-700 leading-relaxed mb-3 relative z-10">
                    时间过得真快，转眼小沐已经三岁了。愿你健康快乐地长大，全家人永远爱你。
                  </p>
                  
                  {/* 媒体区 */}
                  <div className="relative mb-3 rounded-xl overflow-hidden border border-stone-100/50 z-10">
                    <ImageWithFallback 
                      src="https://images.unsplash.com/photo-1530103043960-ef38714abb15?auto=format&fit=crop&w=600&q=80" 
                      alt="三岁生日"
                      className="w-full h-44 object-cover" 
                    />
                  </div>
                  
                  {/* 元信息：时间 → 记录者 → 标签 */}
                  <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-[#F2EFE9]/50">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-stone-400 font-medium">3月1日 19:00</span>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                        <User size={12} strokeWidth={2} />
                        <span>全家共同记录</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="flex items-center gap-1 bg-white border border-stone-100/50 px-2 py-0.5 rounded-md text-[10px] text-stone-500 shadow-sm">
                        <Tag size={10} strokeWidth={2.5} />
                        生日纪念
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* 底部导航栏 */}
      <BottomNav />
    </div>
  );
}