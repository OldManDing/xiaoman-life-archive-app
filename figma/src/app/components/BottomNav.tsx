import React from 'react';
import { Home, Clock, Plus, Users, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 w-full max-w-md bg-white/95 backdrop-blur-xl border-t border-stone-100 z-50 pt-2 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-around px-2">
        <button 
          onClick={() => navigate('/')}
          className={`flex flex-col items-center gap-1.5 w-[20%] transition-colors ${isActive('/') ? 'text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}
        >
           <Home size={22} strokeWidth={isActive('/') ? 2.5 : 2} />
           <span className="text-[10px] font-medium">首页</span>
        </button>
        <button 
          onClick={() => navigate('/timeline')}
          className={`flex flex-col items-center gap-1.5 w-[20%] transition-colors ${isActive('/timeline') ? 'text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}
        >
           <Clock size={22} strokeWidth={isActive('/timeline') ? 2.5 : 2} />
           <span className="text-[10px] font-medium">时间轴</span>
        </button>
        
        {/* 中间记录按钮：视觉平衡调整 */}
        <div className="relative w-[20%] flex justify-center">
           <button 
             onClick={() => navigate('/record')}
             className="absolute -top-[18px] w-[46px] h-[46px] bg-stone-800 text-white rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(41,37,36,0.2)] active:bg-stone-700 transition-transform active:scale-95"
           >
             <Plus size={24} strokeWidth={2.5} />
           </button>
           <span className="text-[10px] font-medium text-stone-800 mt-[32px]">记录</span>
        </div>
        
        <button 
          onClick={() => navigate('/family')}
          className={`flex flex-col items-center gap-1.5 w-[20%] transition-colors ${isActive('/family') ? 'text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}
        >
           <Users size={22} strokeWidth={isActive('/family') ? 2.5 : 2} />
           <span className="text-[10px] font-medium">家庭</span>
        </button>
        <button 
          onClick={() => navigate('/my')}
          className={`flex flex-col items-center gap-1.5 w-[20%] transition-colors ${isActive('/my') ? 'text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}
        >
           <User size={22} strokeWidth={isActive('/my') ? 2.5 : 2} />
           <span className="text-[10px] font-medium">我的</span>
        </button>
      </div>
    </nav>
  );
}