import React from 'react';
import { 
  Camera, 
  Video, 
  Edit3, 
  Star, 
  ChevronRight, 
  ChevronDown,
  Search,
  MapPin, 
  Calendar,
  Sparkles,
  PlayCircle,
  Image as ImageIcon
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { BottomNav } from '../components/BottomNav';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-white text-stone-800 font-sans mx-auto max-w-md flex flex-col relative pb-[100px] overflow-x-hidden">
      
      {/* 1. 顶部孩子信息与搜索区 */}
      <header className="flex items-center justify-between px-5 pt-12 pb-2 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm border border-stone-100 shrink-0 bg-stone-100 group-active:opacity-80 transition-opacity">
             <ImageWithFallback 
                src="https://images.unsplash.com/photo-1627309038955-03e378b9d15b?auto=format&fit=crop&w=150&q=80" 
                alt="孩子头像"
                className="w-full h-full object-cover" 
             />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[17px] font-medium text-stone-800 tracking-wide">小沐</h1>
              <ChevronDown size={16} className="text-stone-400" strokeWidth={2.5} />
            </div>
            <span className="text-[13px] text-stone-500 mt-0.5">3岁 2个月 14天</span>
          </div>
        </div>
        
        <button className="w-9 h-9 rounded-full bg-stone-50 border border-stone-100/50 flex items-center justify-center text-stone-500 active:bg-stone-100 transition-colors shadow-sm">
          <Search size={18} strokeWidth={2} />
        </button>
      </header>

      <main className="flex-1 flex flex-col">
        {/* 2. 4 个快捷记录入口 */}
        <div className="px-5 mt-5 grid grid-cols-4 gap-2.5">
          {[
            { icon: Camera, label: '拍照记录' },
            { icon: Video, label: '视频记录' },
            { icon: Edit3, label: '写一句话' },
            { icon: Star, label: '里程碑' }
          ].map((action, idx) => (
            <div 
              key={idx} 
              onClick={() => navigate('/record')}
              className="flex flex-col items-center justify-center gap-2 cursor-pointer bg-stone-50/80 rounded-[18px] py-3.5 border border-stone-100/60 shadow-[0_2px_8px_rgba(0,0,0,0.01)] active:bg-stone-100 transition-colors"
            >
              <action.icon size={22} strokeWidth={1.5} className="text-stone-600" />
              <span className="text-[11px] text-stone-600 font-medium">{action.label}</span>
            </div>
          ))}
        </div>

        {/* 3. 今日值得记录 */}
        <div className="mt-8 mx-5">
          <div className="bg-[#FAF8F5] rounded-[20px] p-5 relative border border-[#F2EFE9] flex flex-col items-start shadow-sm">
            <div className="flex items-center justify-between w-full mb-3">
              <div className="flex items-center gap-1.5">
                <Sparkles size={16} className="text-[#D4AF37]" />
                <span className="text-[14px] font-medium text-stone-800">今日值得记录</span>
              </div>
              <button className="text-[12px] text-stone-400 flex items-center hover:text-stone-500 transition-colors">
                换一条 <ChevronRight size={14} />
              </button>
            </div>
            <p className="text-[15px] text-stone-700 leading-relaxed mb-5">
              小沐最近最喜欢的一件玩具是什么？它有什么特别的故事吗？
            </p>
            <button 
              onClick={() => navigate('/record')}
              className="text-[13px] font-medium text-stone-600 px-5 py-2.5 rounded-full border border-stone-200/80 bg-white hover:bg-stone-50 active:bg-stone-100 transition-colors inline-flex items-center gap-1.5 shadow-[0_2px_6px_rgba(0,0,0,0.02)]"
            >
              <Edit3 size={14} strokeWidth={2} />
              去记录
            </button>
          </div>
        </div>

        {/* 4. 最近更新 */}
        <div className="mt-10 px-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-medium text-stone-800">最近更新</h2>
            <button 
              onClick={() => navigate('/timeline')}
              className="text-[13px] text-stone-400 flex items-center hover:text-stone-600 transition-colors"
            >
              查看更多 <ChevronRight size={16} className="ml-0.5" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {/* 档案卡片 1 */}
            <div className="flex p-4 rounded-[20px] bg-white border border-stone-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] active:bg-stone-50 cursor-pointer transition-colors overflow-hidden">
              <div className="flex gap-4 w-full">
                <div className="flex flex-col items-center pt-1 w-[40px] shrink-0 border-r border-stone-100/60 pr-4">
                  <span className="text-[20px] font-bold text-stone-700 leading-none">15</span>
                  <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-1">APR</span>
                </div>
                <div className="flex flex-col flex-1 justify-center gap-1.5">
                  <h3 className="text-[15px] font-medium text-stone-800 line-clamp-1 pr-2">午后的公园散步</h3>
                  <p className="text-[13px] text-stone-500 line-clamp-1 leading-relaxed">
                    今天阳光很好，带小沐去公园跑了跑，收集了不少落叶。
                  </p>
                  <div className="flex items-center gap-2.5 text-[12px] text-stone-400 font-medium mt-1">
                    <span className="flex items-center gap-1"><ImageIcon size={12} strokeWidth={2.5} /> 3张</span>
                    <span className="w-1 h-1 rounded-full bg-stone-300" />
                    <span>妈妈记录</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 档案卡片 2 */}
            <div className="flex p-4 rounded-[20px] bg-white border border-stone-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] active:bg-stone-50 cursor-pointer transition-colors overflow-hidden">
              <div className="flex gap-4 w-full">
                <div className="flex flex-col items-center pt-1 w-[40px] shrink-0 border-r border-stone-100/60 pr-4">
                  <span className="text-[20px] font-bold text-stone-700 leading-none">14</span>
                  <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-1">APR</span>
                </div>
                <div className="flex flex-col flex-1 justify-center gap-1.5">
                  <h3 className="text-[15px] font-medium text-stone-800 line-clamp-1 pr-2">学会自己用勺子啦</h3>
                  <p className="text-[13px] text-stone-500 line-clamp-1 leading-relaxed">
                    午饭时第一次独立用勺子把饭送进嘴里，虽然弄得到处都是。
                  </p>
                  <div className="flex items-center gap-2.5 text-[12px] text-stone-400 font-medium mt-1">
                    <span className="flex items-center gap-1"><PlayCircle size={12} strokeWidth={2.5} /> 1段</span>
                    <span className="w-1 h-1 rounded-full bg-stone-300" />
                    <span>爸爸记录</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. 一年前的今天 */}
        <div className="mt-10 px-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-medium text-stone-800">一年前的今天</h2>
            <span className="text-[12px] text-stone-400 font-medium">2025年4月15日</span>
          </div>
          <div className="relative h-[220px] rounded-[20px] overflow-hidden shadow-sm group cursor-pointer border border-stone-100/50">
            <ImageWithFallback 
               src="https://images.unsplash.com/photo-1664691018177-176d6f293168?auto=format&fit=crop&w=600&q=80" 
               alt="一年前的今天"
               className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-stone-900/45 flex flex-col justify-end p-5">
               <span className="text-white text-[16px] font-medium mb-1.5 tracking-wide">第一次在沙滩上奔跑</span>
               <span className="text-white/90 text-[12px] flex items-center gap-1.5">
                 <MapPin size={12} strokeWidth={2.5} />
                 三亚湾
               </span>
            </div>
          </div>
        </div>

        {/* 6. 本月档案进度 */}
        <div className="mx-5 mt-10 bg-stone-50 rounded-[20px] p-4 flex items-center justify-between border border-stone-100/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-stone-100/80">
               <Calendar size={18} className="text-stone-500" strokeWidth={2} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-medium text-stone-700">本月档案进度</span>
              <span className="text-[12px] text-stone-400">已记录 12 个瞬间</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
             <div className="text-[13px] font-semibold text-stone-600">60%</div>
             <div className="w-14 h-1.5 bg-stone-200/80 rounded-full overflow-hidden">
                <div className="w-[60%] h-full bg-stone-600 rounded-full"></div>
             </div>
          </div>
        </div>

        {/* 7. 家庭动态 */}
        <div className="mt-10 px-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[16px] font-medium text-stone-800">家庭动态</h2>
          </div>
          
          <div className="flex flex-col gap-6">
            {/* 动态项 1 */}
            <div className="flex gap-3">
               <div className="w-10 h-10 rounded-full bg-stone-100 overflow-hidden shrink-0 shadow-sm border border-stone-100/50 mt-0.5">
                 <ImageWithFallback src="https://images.unsplash.com/photo-1536541667880-3945b221a85d?auto=format&fit=crop&w=150&q=80" alt="爸爸" className="w-full h-full object-cover" />
               </div>
               <div className="flex-1 pb-6 border-b border-stone-100/80">
                 <div className="flex items-center gap-2 mb-0.5">
                   <span className="text-[14px] font-medium text-stone-700">爸爸</span>
                   <span className="text-[13px] text-stone-600">上传了 3 张新照片</span>
                 </div>
                 <span className="text-[11px] text-stone-400 block mb-3 font-medium">2小时前</span>
                 
                 <div className="flex gap-2">
                    <div className="w-[72px] h-[72px] rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-100/50">
                       <ImageWithFallback src="https://images.unsplash.com/photo-1762912913453-66e34acfe5a4?auto=format&fit=crop&w=200&q=80" alt="动态图片" className="w-full h-full object-cover" />
                    </div>
                    <div className="w-[72px] h-[72px] rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-100/50">
                       <ImageWithFallback src="https://images.unsplash.com/photo-1760267982929-b038bf9b82e0?auto=format&fit=crop&w=200&q=80" alt="动态图片" className="w-full h-full object-cover" />
                    </div>
                    <div className="w-[72px] h-[72px] rounded-xl overflow-hidden bg-stone-100 shrink-0 relative border border-stone-100/50">
                       <ImageWithFallback src="https://images.unsplash.com/photo-1626187429639-7a77bfad0523?auto=format&fit=crop&w=200&q=80" alt="动态图片" className="w-full h-full object-cover" />
                       <div className="absolute inset-0 bg-stone-900/30 flex items-center justify-center">
                         <span className="text-white text-[13px] font-medium tracking-wide">+1</span>
                       </div>
                    </div>
                 </div>
               </div>
            </div>
            
            {/* 动态项 2 */}
            <div className="flex gap-3">
               <div className="w-10 h-10 rounded-full bg-stone-100 overflow-hidden shrink-0 shadow-sm border border-stone-100/50 mt-0.5">
                 <ImageWithFallback src="https://images.unsplash.com/photo-1602845731528-9049a0f4898f?auto=format&fit=crop&w=150&q=80" alt="妈妈" className="w-full h-full object-cover" />
               </div>
               <div className="flex-1">
                 <div className="flex items-center gap-2 mb-0.5">
                   <span className="text-[14px] font-medium text-stone-700">妈妈</span>
                   <span className="text-[13px] text-stone-600">记录了一段文字</span>
                 </div>
                 <span className="text-[11px] text-stone-400 block mb-3 font-medium">昨天 18:30</span>
                 
                 <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-100/60 shadow-sm relative">
                   <div className="absolute top-2 left-2 text-stone-300 opacity-60">
                     <span className="font-serif text-3xl leading-none">"</span>
                   </div>
                   <p className="text-[13.5px] text-stone-700 leading-relaxed relative z-10 pt-1 pl-5">
                     小沐今天学会了自己用勺子吃饭，虽然弄得到处都是，但看着他得意的笑容，觉得一切都值得。
                   </p>
                 </div>
               </div>
            </div>
          </div>
        </div>

      </main>

      {/* 底部导航栏 */}
      <BottomNav />

    </div>
  );
}
