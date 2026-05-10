import React from 'react';
import { 
  ChevronRight, 
  Settings, 
  FileBox, 
  DownloadCloud, 
  HelpCircle,
  LogOut,
  ShieldCheck,
  CreditCard,
  BookHeart,
  Users,
  Info,
  Lock
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { BottomNav } from '../components/BottomNav';

export default function MyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5] text-stone-800 font-sans mx-auto max-w-md flex flex-col relative pb-[100px] overflow-x-hidden">
      
      <main className="flex-1 flex flex-col">
        {/* 顶部个人资料区 */}
        <section className="bg-white px-5 pt-16 pb-8 border-b border-stone-100 shadow-[0_2px_12px_rgba(0,0,0,0.01)] relative">
          <div className="flex items-center gap-4">
            <div className="w-[68px] h-[68px] rounded-[24px] overflow-hidden shadow-sm border border-stone-100 shrink-0 bg-stone-100 relative">
               <ImageWithFallback 
                  src="https://images.unsplash.com/photo-1627309038955-03e378b9d15b?auto=format&fit=crop&w=150&q=80" 
                  alt="我的头像"
                  className="w-full h-full object-cover" 
               />
               <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-[24px]"></div>
            </div>
            <div className="flex flex-col justify-center flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-[20px] font-bold text-stone-800 tracking-wide">妈妈</h1>
                <span className="px-2 py-0.5 bg-gradient-to-r from-[#F2EFE9] to-[#FAF8F5] border border-[#E8E2D2] text-[#B09040] text-[10px] font-bold rounded-md shadow-sm tracking-widest uppercase">
                  高级会员
                </span>
              </div>
              <span className="text-[13px] text-stone-500 font-medium">ID: 88392104</span>
            </div>
            <button className="text-[12px] text-stone-600 bg-stone-50 px-3 py-1.5 rounded-full border border-stone-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] active:bg-stone-100 transition-colors">
              编辑主页
            </button>
          </div>
        </section>

        {/* 草稿箱快速入口 */}
        <section className="px-5 mt-6">
          <div className="bg-white rounded-[16px] p-4 border border-stone-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] flex items-center justify-between cursor-pointer active:bg-stone-50 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-500 border border-stone-100/80 group-active:bg-white transition-colors">
                <FileBox size={16} strokeWidth={2} />
              </div>
              <span className="text-[14px] font-medium text-stone-700">草稿箱</span>
            </div>
            <div className="flex items-center gap-2 text-stone-400">
              <span className="text-[12px] font-medium">2 条待完善记录</span>
              <ChevronRight size={16} strokeWidth={2} />
            </div>
          </div>
        </section>

        {/* 我的孩子 */}
        <section className="px-5 mt-6">
          <h2 className="text-[13px] font-bold text-stone-400 mb-3 px-1 tracking-widest uppercase">我的孩子</h2>
          <div className="bg-white rounded-[20px] p-4 border border-stone-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] flex flex-col gap-4">
            <div className="flex items-center justify-between cursor-pointer active:opacity-80 transition-opacity">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-[14px] overflow-hidden bg-stone-100 shrink-0 shadow-sm border border-stone-100">
                  <ImageWithFallback src="https://images.unsplash.com/photo-1627309038955-03e378b9d15b?auto=format&fit=crop&w=150&q=80" alt="小沐" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold text-stone-800">小沐</span>
                  <span className="text-[12px] text-stone-500 font-medium">3岁 2个月 14天</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-stone-400" />
            </div>
            
            <button className="w-full py-3 rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 text-[13px] font-bold text-stone-500 active:bg-stone-50 transition-colors">
              + 添加宝宝
            </button>
          </div>
        </section>

        {/* 管理中心区 */}
        <section className="px-5 mt-8">
          <h2 className="text-[13px] font-bold text-stone-400 mb-3 px-1 tracking-widest uppercase">管理中心</h2>
          <div className="bg-white rounded-[20px] border border-stone-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] overflow-hidden">
            
            <div className="flex items-center justify-between p-4 border-b border-stone-50 cursor-pointer active:bg-stone-50 transition-colors group">
              <div className="flex items-center gap-3 text-stone-700">
                <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-500 border border-stone-100/80 group-active:bg-white transition-colors">
                  <BookHeart size={16} strokeWidth={2} />
                </div>
                <span className="text-[15px] font-medium">月报与纪念册</span>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>

            <div className="flex items-center justify-between p-4 border-b border-stone-50 cursor-pointer active:bg-stone-50 transition-colors group">
              <div className="flex items-center gap-3 text-stone-700">
                <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-500 border border-stone-100/80 group-active:bg-white transition-colors">
                  <DownloadCloud size={16} strokeWidth={2} />
                </div>
                <span className="text-[15px] font-medium">导出与备份</span>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>

            <div className="flex items-center justify-between p-4 border-b border-stone-50 cursor-pointer active:bg-stone-50 transition-colors group">
              <div className="flex items-center gap-3 text-stone-700">
                <div className="w-8 h-8 rounded-full bg-[#FAF8F5] border border-[#F2EFE9] flex items-center justify-center text-[#D4AF37] group-active:bg-white transition-colors">
                  <CreditCard size={16} strokeWidth={2.5} />
                </div>
                <span className="text-[15px] font-medium">会员中心</span>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>
            
            <div className="flex items-center justify-between p-4 border-b border-stone-50 cursor-pointer active:bg-stone-50 transition-colors group">
              <div className="flex items-center gap-3 text-stone-700">
                <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-500 border border-stone-100/80 group-active:bg-white transition-colors">
                  <ShieldCheck size={16} strokeWidth={2} />
                </div>
                <span className="text-[15px] font-medium">隐私设置</span>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>

            <div className="flex items-center justify-between p-4 border-b border-stone-50 cursor-pointer active:bg-stone-50 transition-colors group">
              <div className="flex items-center gap-3 text-stone-700">
                <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-500 border border-stone-100/80 group-active:bg-white transition-colors">
                  <Users size={16} strokeWidth={2} />
                </div>
                <span className="text-[15px] font-medium">家庭管理</span>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>

            <div className="flex items-center justify-between p-4 cursor-pointer active:bg-stone-50 transition-colors group">
              <div className="flex items-center gap-3 text-stone-700">
                <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-500 border border-stone-100/80 group-active:bg-white transition-colors">
                  <HelpCircle size={16} strokeWidth={2} />
                </div>
                <span className="text-[15px] font-medium">帮助与反馈</span>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>

          </div>
        </section>

        {/* 设置区 */}
        <section className="px-5 mt-8 mb-8">
          <h2 className="text-[13px] font-bold text-stone-400 mb-3 px-1 tracking-widest uppercase">设置区</h2>
          <div className="bg-white rounded-[20px] border border-stone-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] overflow-hidden">
            
            <div className="flex items-center justify-between p-4 border-b border-stone-50 cursor-pointer active:bg-stone-50 transition-colors group">
              <div className="flex items-center gap-3 text-stone-700">
                <Lock size={18} strokeWidth={2} className="text-stone-500 px-1 group-active:scale-95 transition-transform" />
                <span className="text-[15px] font-medium">账号与安全</span>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>

            <div className="flex items-center justify-between p-4 cursor-pointer active:bg-stone-50 transition-colors group">
              <div className="flex items-center gap-3 text-stone-700">
                <Info size={18} strokeWidth={2} className="text-stone-500 px-1 group-active:scale-95 transition-transform" />
                <span className="text-[15px] font-medium">关于我们</span>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </div>

          </div>

          <button className="w-full mt-8 py-4 bg-white border border-stone-100/80 rounded-[20px] text-[15px] font-medium text-red-500/90 flex items-center justify-center gap-2 active:bg-stone-50 transition-colors shadow-sm">
            <LogOut size={16} strokeWidth={2.5} />
            退出登录
          </button>
        </section>

      </main>

      <BottomNav />
    </div>
  );
}