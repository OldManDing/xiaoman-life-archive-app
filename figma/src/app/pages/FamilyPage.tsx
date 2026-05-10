import React from 'react';
import { UserPlus, ChevronRight, PlayCircle, Heart } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { BottomNav } from '../components/BottomNav';

export default function FamilyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-white text-stone-800 font-sans mx-auto max-w-md flex flex-col relative pb-[100px] overflow-x-hidden">
      {/* 顶部导航 */}
      <header className="px-5 pt-12 pb-4 bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <h1 className="text-[18px] font-medium text-stone-800 tracking-wide">家庭</h1>
      </header>

      <main className="flex-1 flex flex-col gap-8 px-5 pt-2">
        
        {/* 家庭概览与邀请 */}
        <section className="bg-gradient-to-br from-stone-50 to-stone-100/50 rounded-[20px] p-5 border border-stone-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.015)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-stone-100/40 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
          
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-[52px] h-[52px] rounded-[16px] overflow-hidden shadow-sm border-[2px] border-white shrink-0 bg-stone-100">
                <ImageWithFallback src="https://images.unsplash.com/photo-1627309038955-03e378b9d15b?auto=format&fit=crop&w=150&q=80" alt="小沐" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-[18px] font-bold text-stone-800">小沐的家庭</h2>
                <span className="text-[13px] text-stone-500 font-medium mt-0.5">已有 5 位家人加入记录</span>
              </div>
            </div>
            <button className="flex items-center justify-center w-8 h-8 rounded-full bg-stone-800 text-white shadow-sm active:bg-stone-700 transition-colors mt-2 shrink-0">
              <UserPlus size={16} strokeWidth={2.5} />
            </button>
          </div>
        </section>

        {/* 家庭成员列表 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-medium text-stone-800">家庭成员</h2>
          </div>
          <div className="bg-white border border-stone-100/80 rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.015)] flex flex-col">
            
            {/* 成员 1：管理员 */}
            <div className="flex items-center justify-between p-4 border-b border-stone-50 cursor-pointer active:bg-stone-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-full overflow-hidden bg-stone-100 border border-stone-100/50 shadow-sm">
                  <ImageWithFallback src="https://images.unsplash.com/photo-1602845731528-9049a0f4898f?auto=format&fit=crop&w=150&q=80" alt="妈妈" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium text-stone-800">妈妈</span>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-md border border-amber-100/50 tracking-wide">管理员</span>
                  </div>
                  <span className="text-[12px] text-stone-400">已记录 128 个瞬间</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>

            {/* 成员 2：编辑者 */}
            <div className="flex items-center justify-between p-4 border-b border-stone-50 cursor-pointer active:bg-stone-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-full overflow-hidden bg-stone-100 border border-stone-100/50 shadow-sm">
                  <ImageWithFallback src="https://images.unsplash.com/photo-1536541667880-3945b221a85d?auto=format&fit=crop&w=150&q=80" alt="爸爸" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium text-stone-800">爸爸</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md border border-blue-100/50 tracking-wide">编辑者</span>
                  </div>
                  <span className="text-[12px] text-stone-400">已记录 56 个瞬间</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>

            {/* 成员 3：浏览者 */}
            <div className="flex items-center justify-between p-4 border-b border-stone-50 cursor-pointer active:bg-stone-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-full overflow-hidden bg-stone-100 border border-stone-100/50 shadow-sm">
                  <ImageWithFallback src="https://images.unsplash.com/photo-1731139882523-8095b243d524?auto=format&fit=crop&w=150&q=80" alt="奶奶" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium text-stone-800">奶奶</span>
                    <span className="px-2 py-0.5 bg-stone-100 text-stone-500 text-[10px] font-bold rounded-md border border-stone-200/50 tracking-wide">浏览者</span>
                  </div>
                  <span className="text-[12px] text-stone-400">1 条评论 · 最近访问: 今天</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>
            
            {/* 成员 4：浏览者 */}
            <div className="flex items-center justify-between p-4 cursor-pointer active:bg-stone-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-full overflow-hidden bg-stone-100 border border-stone-100/50 shadow-sm">
                  <ImageWithFallback src="https://images.unsplash.com/photo-1687585105933-211db7bea7aa?auto=format&fit=crop&w=150&q=80" alt="爷爷" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium text-stone-800">爷爷</span>
                    <span className="px-2 py-0.5 bg-stone-100 text-stone-500 text-[10px] font-bold rounded-md border border-stone-200/50 tracking-wide">浏览者</span>
                  </div>
                  <span className="text-[12px] text-stone-400">0 条记录 · 最近访问: 昨天</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>

          </div>
        </section>

        {/* 最近家庭动态 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-medium text-stone-800">最近家庭动态</h2>
          </div>
          <div className="flex flex-col gap-6">
            <div className="flex gap-3">
               <div className="w-10 h-10 rounded-full bg-stone-100 overflow-hidden shrink-0 shadow-sm border border-stone-100/50 mt-0.5">
                 <ImageWithFallback src="https://images.unsplash.com/photo-1536541667880-3945b221a85d?auto=format&fit=crop&w=150&q=80" alt="爸爸" className="w-full h-full object-cover" />
               </div>
               <div className="flex-1 pb-6 border-b border-stone-100/80">
                 <div className="flex items-center gap-2 mb-0.5">
                   <span className="text-[14px] font-medium text-stone-700">爸爸</span>
                   <span className="text-[13px] text-stone-600">上传了视频记录</span>
                 </div>
                 <span className="text-[11px] text-stone-400 block mb-3 font-medium">2小时前</span>
                 
                 <div className="w-32 h-32 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-100/50 relative cursor-pointer">
                    <ImageWithFallback src="https://images.unsplash.com/photo-1760267982929-b038bf9b82e0?auto=format&fit=crop&w=300&q=80" alt="动态图片" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-stone-900/10 flex items-center justify-center">
                      <PlayCircle size={28} className="text-white/90 shadow-sm rounded-full" strokeWidth={2} />
                    </div>
                 </div>
               </div>
            </div>
            <div className="flex gap-3">
               <div className="w-10 h-10 rounded-full bg-stone-100 overflow-hidden shrink-0 shadow-sm border border-stone-100/50 mt-0.5">
                 <ImageWithFallback src="https://images.unsplash.com/photo-1731139882523-8095b243d524?auto=format&fit=crop&w=150&q=80" alt="奶奶" className="w-full h-full object-cover" />
               </div>
               <div className="flex-1">
                 <div className="flex items-center gap-2 mb-0.5">
                   <span className="text-[14px] font-medium text-stone-700">奶奶</span>
                   <span className="text-[13px] text-stone-600">评论了照片</span>
                 </div>
                 <span className="text-[11px] text-stone-400 block mb-3 font-medium">昨天 15:20</span>
                 
                 <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-100/60 shadow-sm">
                   <p className="text-[13.5px] text-stone-700 leading-relaxed mb-3">
                     哎呀，小沐走得真稳当！看着都觉得开心。
                   </p>
                   <div className="flex items-center gap-2 bg-white p-1.5 pr-3 rounded-lg border border-stone-100/80">
                     <div className="w-8 h-8 rounded-md overflow-hidden shrink-0">
                       <ImageWithFallback src="https://images.unsplash.com/photo-1543636200-64e72565dc16?auto=format&fit=crop&w=100&q=80" alt="被评论内容" className="w-full h-full object-cover" />
                     </div>
                     <span className="text-[11px] text-stone-500 line-clamp-1">第一次独立走路</span>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* 家人寄语 */}
        <section className="mt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-medium text-stone-800">家人寄语</h2>
          </div>
          <div className="bg-[#FAF8F5] border border-[#F2EFE9] rounded-[20px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] relative overflow-hidden">
            <Heart size={100} className="absolute -bottom-4 -right-4 text-[#F2EFE9] opacity-50" strokeWidth={1} />
            <div className="relative z-10">
              <p className="text-[14.5px] text-stone-700 leading-relaxed tracking-wide font-medium">
                "宝贝，愿你慢慢长大，全家人都会陪着你，记录你的每一个第一次。"
              </p>
              <div className="flex items-center justify-end gap-2 mt-4 text-stone-500">
                <span className="text-[12px] font-medium">— 爷爷</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}