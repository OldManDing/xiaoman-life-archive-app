import React from 'react';
import { 
  ChevronRight, 
  ImagePlus, 
  Mic,
  Eye, 
  MapPin, 
  Tag, 
  Star, 
  BookOpen,
  Clock,
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router';

export default function RecordPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-white text-stone-800 font-sans mx-auto max-w-md flex flex-col relative pb-20 overflow-x-hidden">
      
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-5 pt-12 pb-4 bg-white/95 backdrop-blur-md sticky top-0 z-10">
        <button 
          onClick={() => navigate('/')}
          className="text-stone-500 text-[15px] font-medium active:text-stone-700 transition-colors"
        >
          取消
        </button>
        <h1 className="text-[17px] font-medium text-stone-800 tracking-wide">
          记录时光
        </h1>
        <button className="bg-stone-800 text-white text-[14px] font-medium px-5 py-1.5 rounded-full shadow-sm active:bg-stone-700 transition-colors">
          发布
        </button>
      </header>

      <main className="flex-1 flex flex-col px-5 pt-2 pb-12">
        {/* 归属卡片 */}
        <div className="bg-stone-50 rounded-2xl p-3.5 flex items-center justify-between mb-5 active:bg-stone-100 transition-colors cursor-pointer border border-stone-100/60 shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white border border-stone-100 flex items-center justify-center text-stone-600 font-medium text-sm overflow-hidden shrink-0 shadow-sm">
              <span className="text-stone-600">沐</span>
            </div>
            <span className="text-[15px] text-stone-700 font-medium">记录给：小沐</span>
          </div>
          <div className="flex items-center gap-1 text-stone-400">
            <span className="text-[13px]">切换孩子</span>
            <ChevronRight size={16} strokeWidth={2} />
          </div>
        </div>

        {/* 统一媒体上传区 */}
        <div className="mb-6 h-[120px] bg-stone-50 rounded-2xl border-[1.5px] border-dashed border-stone-300 flex items-center justify-center gap-12 relative hover:bg-stone-100/60 active:bg-stone-100 transition-colors cursor-pointer group">
          <div className="absolute top-2.5 left-3 text-[11px] font-medium text-stone-400 tracking-widest uppercase">
             MEDIA
          </div>
          <div className="flex flex-col items-center gap-2.5 group-active:scale-[0.98] transition-transform">
            <div className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-stone-500 border border-stone-100/80">
              <ImagePlus size={20} strokeWidth={2} />
            </div>
            <span className="text-[13px] font-medium text-stone-500">添加照片/视频</span>
          </div>
          
          <div className="w-[1.5px] h-12 bg-stone-200/80 rounded-full"></div>
          
          <div className="flex flex-col items-center gap-2.5 group-active:scale-[0.98] transition-transform">
            <div className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-stone-500 border border-stone-100/80">
              <Mic size={20} strokeWidth={2} />
            </div>
            <span className="text-[13px] font-medium text-stone-500">录制语音</span>
          </div>
        </div>

        {/* 无边界内容编辑器 */}
        <div className="flex flex-col gap-5 mb-14">
          <input 
            type="text" 
            placeholder="给这一刻起个名字" 
            className="w-full text-[20px] font-medium text-stone-800 placeholder:text-stone-500 border-b border-stone-100 pb-3 outline-none bg-transparent"
          />
          <textarea 
            placeholder="在想什么呢？记录一下这一刻发生的故事..." 
            className="w-full min-h-[160px] text-[16px] leading-relaxed text-stone-800 placeholder:text-stone-500/80 border-none outline-none resize-none bg-transparent"
          />
        </div>

        {/* 元数据配置区 */}
        <div className="flex flex-col gap-5">
          {/* 可见范围行 */}
          <div className="flex items-center justify-between group cursor-pointer bg-stone-50/50 py-3 px-4 rounded-xl border border-stone-100/50">
            <div className="flex items-center gap-2.5 text-stone-600">
              <Eye size={18} strokeWidth={2} />
              <span className="text-[15px]">可见范围</span>
            </div>
            <div className="flex items-center gap-1.5 text-stone-500">
              <span className="text-[14px]">家庭成员可见</span>
              <ChevronRight size={16} strokeWidth={2} />
            </div>
          </div>

          {/* 属性胶囊组 */}
          <div className="flex gap-3 flex-wrap">
            <button className="flex items-center gap-1.5 bg-stone-50 border border-stone-100/80 text-stone-600 px-4 py-2 rounded-full text-[13.5px] font-medium active:bg-stone-100 transition-colors shadow-sm">
              <Clock size={14} strokeWidth={2} className="text-stone-400" />
              <span>今天 14:30</span>
            </button>
            <button className="flex items-center gap-1.5 bg-stone-50 border border-stone-100/80 text-stone-600 px-4 py-2 rounded-full text-[13.5px] font-medium active:bg-stone-100 transition-colors shadow-sm">
              <MapPin size={14} strokeWidth={2} className="text-stone-400" />
              <span>添加地点</span>
            </button>
            <button className="flex items-center gap-1.5 bg-stone-50 border border-stone-100/80 text-stone-600 px-4 py-2 rounded-full text-[13.5px] font-medium active:bg-stone-100 transition-colors shadow-sm">
              <Tag size={14} strokeWidth={2} className="text-stone-400" />
              <span>添加标签</span>
            </button>
          </div>
        </div>

        {/* 情绪高亮区（里程碑） */}
        <div className="mt-8 border-t border-stone-100 pt-5 flex items-start justify-between">
          <div className="flex gap-3.5 pr-4">
            <div className="w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100/50 shadow-sm mt-0.5">
              <Star size={20} strokeWidth={2.5} className="text-amber-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[16px] font-medium text-stone-800">标记为里程碑</span>
              <span className="text-[13.5px] text-stone-600 leading-relaxed">
                点亮这颗星星，记录并高亮孩子成长过程中的重要里程碑时刻。
              </span>
            </div>
          </div>
          
          {/* Switch 组件（默认关闭态） */}
          <div className="w-[48px] h-[26px] bg-stone-200 rounded-full p-[2px] cursor-pointer transition-colors duration-200 ease-in-out shadow-inner mt-1 shrink-0">
            <div className="w-[22px] h-[22px] bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-transform duration-200 ease-in-out translate-x-0" />
          </div>
        </div>

        {/* 底部收尾区 */}
        <div className="mt-12 flex flex-col items-center">
          <button className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-full border border-stone-200/80 bg-white shadow-sm text-stone-500 hover:text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors">
            <BookOpen size={16} strokeWidth={2} className="text-stone-400" />
            <span className="text-[14px] font-medium">存为草稿</span>
          </button>
        </div>
      </main>
    </div>
  );
}