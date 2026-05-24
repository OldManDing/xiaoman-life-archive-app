import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Image as ImageIcon,
  Mic,
  PlayCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Video,
} from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { RecordSummary } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { recordTypeLabel } from '../shared/labels';
import { resolveMediaPreviewUrl, resolveStoredMediaUrl } from '../shared/localMediaPreview';
import { loadLocalSettings } from '../shared/localSettings';
import { EmptyState } from './shared';
import {
  RefAvatar,
  RefChip,
  refCardStyle,
  refContentStyle,
  refMutedTextStyle,
  refPageStyle,
  refPrimaryButtonStyle,
  refSecondaryButtonStyle,
  refSoftCardStyle,
  referenceAssets,
} from './reference-ui';

const padded: CSSProperties = { paddingLeft: 20, paddingRight: 20 };

const iconButtonStyle: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: '999px',
  border: '1px solid rgba(126,145,170,0.24)',
  background: 'rgba(255,255,255,0.9)',
  color: '#334155',
  display: 'grid',
  placeItems: 'center',
  boxShadow: '0 10px 20px rgba(25,35,55,0.08)',
  cursor: 'pointer',
};

const formatDay = (value: string) => new Date(value).getDate();
const formatMonth = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: 'short' });
const formatShortDate = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const formatMonthTitle = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
};

const getCoverUrl = (record: RecordSummary) => resolveMediaPreviewUrl(record.cover_media_no, record.cover_url);
const getMediaKind = (record: RecordSummary) => record.cover_media_type ?? (record.record_type === 'audio' || record.record_type === 'video' ? record.record_type : null);
const getRecordLabel = (record: RecordSummary) => recordTypeLabel(record.record_type, record.is_milestone);

const isGeneratedSvgAvatar = (src?: string | null) => Boolean(src?.trim().startsWith('data:image/svg+xml'));

const referenceAvatarFor = (src: string | null | undefined, fallbackSrc: string) => {
  if (!src || isGeneratedSvgAvatar(src)) return fallbackSrc;
  return resolveStoredMediaUrl(src) ?? fallbackSrc;
};

const childAvatarFor = (src?: string | null) => referenceAvatarFor(src, referenceAssets.childAvatar);
const momAvatarFor = (src?: string | null) => referenceAvatarFor(src, referenceAssets.momAvatar);

const prompts = (childName: string) => [
  `${childName}最近最喜欢的一件玩具是什么？它有什么特别的故事吗？`,
  '今天有没有一个小进步？比如独立完成一件事、学会一个词，或主动表达了感受。',
  '今天家里有没有一段温暖对话？把当时的语气和场景写下来，以后会很珍贵。',
  '如果只能留下今天的一张照片，你会拍下哪个瞬间？可以先写文字，再补充照片。',
];

const ActionTile = ({
  icon,
  label,
  description,
  onClick,
  disabled,
  accent = '#17342f',
}: {
  icon: ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: string;
}) => (
  <button
    type="button"
    className="home-quick-action nl-pressable"
    onClick={onClick}
    disabled={disabled}
    style={{
      minHeight: 78,
      borderRadius: 22,
      border: '1px solid rgba(126,145,170,0.2)',
      background: 'linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(248,252,255,0.86) 100%)',
      color: '#334155',
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '10px 12px',
      textAlign: 'left',
      boxShadow: '0 14px 30px rgba(25,35,55,0.09)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
    }}
  >
    <span style={{ width: 36, height: 36, borderRadius: '15px', background: 'linear-gradient(135deg, #edf7f5 0%, #fff5df 100%)', color: accent, display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)' }}>{icon}</span>
    <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 900, color: '#172033', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 10, lineHeight: 1.35, color: '#687386', fontWeight: 700 }}>{description}</span>
    </span>
  </button>
);

const RecordSummaryCard = ({ record, onClick }: { record: RecordSummary; onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{ ...refSoftCardStyle, width: '100%', minHeight: 108, padding: '15px 16px', display: 'flex', gap: 15, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}>
    <span style={{ width: 52, borderRight: '1px solid rgba(126,145,170,0.16)', display: 'grid', justifyItems: 'center', flexShrink: 0, paddingRight: 12 }}>
      <strong style={{ color: '#172033', fontSize: 26, lineHeight: 1, fontWeight: 950 }}>{formatDay(record.event_time)}</strong>
      <span style={{ marginTop: 6, color: '#687386', fontSize: 11, fontWeight: 850 }}>{formatMonth(record.event_time)}</span>
    </span>
    <span style={{ minWidth: 0, display: 'grid', gap: 6, flex: 1 }}>
      <strong style={{ color: '#172033', fontSize: 15, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.title ?? '未命名记录'}</strong>
      <span style={{ ...refMutedTextStyle, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.summary ?? '这条记录还没有摘要。'}</span>
      <span style={{ color: '#7b8494', fontSize: 11, fontWeight: 750 }}>{record.tags?.length ? `${record.tags.length} 个标签` : record.creator_name}</span>
    </span>
  </button>
);

export const HomePage = () => {
  const navigate = useNavigate();
  const { user, activeChild, children, setActiveChild, refreshChildren } = useAuth();
  const [promptIndex, setPromptIndex] = useState(0);
  const { data: recordData, loading, error } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 5, status: 'published' });
      return result.list;
    },
    [activeChild?.child_no],
  );

  useEffect(() => {
    if (loadLocalSettings().autoRefreshHome) void refreshChildren();
  }, [refreshChildren]);

  useEffect(() => {
    if (!activeChild && children.length > 0) setActiveChild(children[0]);
  }, [activeChild, children, setActiveChild]);

  const records = recordData ?? [];
  const childName = activeChild?.name ?? '小满';
  const prompt = prompts(childName)[promptIndex % prompts(childName).length];
  const switchChild = () => {
    if (children.length > 1 && activeChild) {
      const index = children.findIndex((item) => item.child_no === activeChild.child_no);
      setActiveChild(children[(index + 1) % children.length]);
      return;
    }
    navigate(activeChild ? '/family/child' : '/onboarding/child?mode=add');
  };

  return (
    <div style={refPageStyle}>
      <section style={{ ...padded, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
        <div
          className="home-hero-card nl-card-enter"
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 32,
            padding: 16,
            minHeight: 252,
            border: '1px solid rgba(126,145,170,0.2)',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(238,247,246,0.9) 46%, rgba(255,246,224,0.86) 100%)',
            boxShadow: '0 28px 60px rgba(25,35,55,0.16)',
          }}
        >
          <img
            className="home-hero-photo"
            src={referenceAssets.childPhoto}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: -32,
              top: 48,
              width: 150,
              height: 180,
              objectFit: 'cover',
              borderRadius: 36,
              opacity: 0.22,
              transform: 'rotate(4deg)',
              boxShadow: '0 24px 42px rgba(25,35,55,0.2)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
            <button
              type="button"
              aria-label={children.length > 1 ? '切换孩子档案' : activeChild ? '查看孩子档案' : '添加孩子档案'}
              onClick={switchChild}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <RefAvatar src={childAvatarFor(activeChild?.avatar_url)} label={childName} size={50} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <strong style={{ color: '#172033', fontSize: 23, fontWeight: 950, lineHeight: 1.1 }}>{childName}</strong>
                  <ChevronDown size={15} color="#64748b" />
                </span>
                <span style={{ display: 'block', marginTop: 4, color: '#5f6d7f', fontSize: 12, fontWeight: 800 }}>{activeChild?.current_age_display ?? user?.nickname ?? '家庭档案'}</span>
              </span>
            </button>
            <button type="button" aria-label="搜索记录" onClick={() => navigate('/search')} style={iconButtonStyle}>
              <Search size={18} strokeWidth={2.2} />
            </button>
          </div>
          <div style={{ position: 'relative', zIndex: 1, marginTop: 16, maxWidth: 270, display: 'grid', gap: 8 }}>
            <span style={{ color: '#d97706', fontSize: 12, fontWeight: 950, letterSpacing: '0.12em' }}>TODAY MEMORY</span>
            <h1 style={{ margin: 0, color: '#172033', fontSize: 28, lineHeight: 1.1, fontWeight: 950, letterSpacing: 0 }}>
              把今天的小变化，收进年轮。
            </h1>
            <p style={{ margin: 0, color: '#475569', fontSize: 12, lineHeight: 1.58, fontWeight: 750 }}>
              先留下一个画面、一句话或一段声音，系统会帮你整理成家庭时间轴。
            </p>
          </div>
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              className="nl-pressable"
              onClick={() => navigate(activeChild ? '/record/create?focus=media' : '/onboarding/child?mode=add')}
              style={{
                minHeight: 44,
                border: 'none',
                borderRadius: 18,
                background: 'linear-gradient(135deg, #17342f 0%, #22584f 58%, #d97706 150%)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 13px',
                fontSize: 14,
                fontWeight: 900,
                boxShadow: '0 16px 32px rgba(23,52,47,0.28)',
                cursor: 'pointer',
              }}
            >
              <Camera size={17} strokeWidth={2.4} />
              记录此刻
            </button>
            <button
              type="button"
              className="nl-pressable"
              onClick={() => navigate('/timeline')}
              style={{
                minHeight: 44,
                border: '1px solid rgba(126,145,170,0.22)',
                borderRadius: 18,
                background: 'rgba(255,255,255,0.78)',
                color: '#334155',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '12px 10px',
                fontSize: 13,
                fontWeight: 850,
                cursor: 'pointer',
              }}
            >
              时间轴
              <ChevronRight size={15} strokeWidth={2.4} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 14, position: 'relative', zIndex: 1 }}>
            <div style={{ borderRadius: 18, background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(255,255,255,0.78)', padding: '10px 12px' }}>
              <span style={{ display: 'block', color: '#687386', fontSize: 11, fontWeight: 850 }}>本月记录</span>
              <strong style={{ display: 'block', marginTop: 4, color: '#17342f', fontSize: 24, lineHeight: 1, fontWeight: 950 }}>{records.length}</strong>
            </div>
            <div style={{ borderRadius: 18, background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(255,255,255,0.78)', padding: '10px 12px' }}>
              <span style={{ display: 'block', color: '#687386', fontSize: 11, fontWeight: 850 }}>档案进度</span>
              <strong style={{ display: 'block', marginTop: 4, color: '#d97706', fontSize: 24, lineHeight: 1, fontWeight: 950 }}>{Math.min(100, records.length * 10)}%</strong>
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...padded, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
        <ActionTile icon={<Camera size={18} />} label="拍照记录" description="打开相机，先留住画面" disabled={!activeChild} onClick={() => navigate(activeChild ? '/record/create?type=mixed&focus=media' : '/onboarding/child?mode=add')} />
        <ActionTile icon={<Video size={18} />} label="视频记录" description="记录动作和现场声音" accent="#2f66d8" disabled={!activeChild} onClick={() => navigate(activeChild ? '/record/create?type=video&focus=media' : '/onboarding/child?mode=add')} />
        <ActionTile icon={<Edit3 size={18} />} label="写一句话" description="快速写下今天的细节" accent="#d97706" disabled={!activeChild} onClick={() => navigate(activeChild ? '/record/create?type=text&focus=content' : '/onboarding/child?mode=add')} />
        <ActionTile icon={<Star size={18} />} label="里程碑" description="第一次和重要节点" accent="#a16207" disabled={!activeChild} onClick={() => navigate(activeChild ? '/record/create?type=milestone&focus=content' : '/onboarding/child?mode=add')} />
      </section>

      <main style={{ ...refContentStyle, paddingTop: 16 }}>
        <section style={{ ...refSoftCardStyle, padding: '17px 18px', background: 'linear-gradient(135deg, rgba(255,250,238,0.96) 0%, rgba(255,255,255,0.94) 58%, rgba(239,247,255,0.9) 100%)', borderColor: 'rgba(217,119,6,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 9 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#d97706', fontSize: 14, fontWeight: 950 }}>
              <Sparkles size={15} />
              今日值得记录
            </span>
            <button type="button" onClick={() => setPromptIndex((current) => current + 1)} style={{ border: 'none', background: 'rgba(255,255,255,0.68)', borderRadius: '999px', color: '#687386', fontSize: 12, fontWeight: 850, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 34, padding: '6px 10px' }}>
              换一条 <ChevronRight size={13} />
            </button>
          </div>
          <p style={{ margin: '0 0 12px', color: '#172033', fontSize: 14, lineHeight: 1.72, fontWeight: 800 }}>{prompt}</p>
          <button type="button" onClick={() => navigate(activeChild ? '/record/create' : '/onboarding/child?mode=add')} style={{ ...refSecondaryButtonStyle, minHeight: 42, padding: '9px 14px', fontSize: 13, width: '100%', justifyContent: 'flex-start' }}>
            <Edit3 size={14} /> 去记录
          </button>
        </section>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, color: '#172033', fontSize: 18, fontWeight: 950 }}>最近更新</h2>
            <button type="button" onClick={() => navigate('/timeline')} style={{ border: 'none', background: 'transparent', color: '#687386', fontSize: 12, fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
              查看全部 <ChevronRight size={14} />
            </button>
          </div>
          {loading ? <EmptyState message="正在加载最近记录…" /> : null}
          {error ? <EmptyState message={`加载失败：${error}`} /> : null}
          {!loading && !error && records.length ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {records.slice(0, 2).map((record) => <RecordSummaryCard key={record.record_no} record={record} onClick={() => navigate(`/record/${record.record_no}`)} />)}
            </div>
          ) : null}
          {!loading && !error && !records.length ? <EmptyState message="还没有成长记录，先留下第一条。" /> : null}
        </section>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h2 style={{ margin: 0, color: '#172033', fontSize: 18, fontWeight: 950 }}>一年前的今天</h2>
            <span style={{ color: '#687386', fontSize: 11, fontWeight: 800 }}>2025/5/9</span>
          </div>
          <button type="button" onClick={() => navigate(records[0] ? `/record/${records[0].record_no}` : '/record/create')} style={{ ...refSoftCardStyle, width: '100%', padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ position: 'relative', height: 154, background: '#e7e5e4' }}>
              <img src={referenceAssets.parkPhoto} alt="第一次在草地上奔跑" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 35%, rgba(10,18,28,0.62) 100%)' }} />
              <span style={{ position: 'absolute', left: 15, bottom: 13, color: '#fff', fontSize: 14, fontWeight: 950, textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>第一次在草地上奔跑</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', fontSize: 12, fontWeight: 850 }}>
                <span>本月档案进度</span>
                <span>{Math.min(100, records.length * 10)}%</span>
              </div>
              <div style={{ height: 8, borderRadius: '999px', background: '#e7eef6', overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${Math.min(100, records.length * 10)}%`, height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #17342f 0%, #d97706 100%)' }} />
              </div>
            </div>
          </button>
        </section>
      </main>
    </div>
  );
};

export const SearchPage = () => {
  const { activeChild } = useAuth();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const { data } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 20, status: 'published' });
      return result.list;
    },
    [activeChild?.child_no],
  );
  const records = data ?? [];
  const filtered = keyword.trim()
    ? records.filter((record) => [record.title, record.summary, ...(record.tags ?? [])].filter(Boolean).some((value) => String(value).includes(keyword.trim())))
    : [];

  return (
    <div style={{ ...refPageStyle, background: '#ffffff' }}>
      <header style={{ height: 54, padding: 'calc(6px + env(safe-area-inset-top)) 14px 0', borderBottom: '1px solid #eef0f2', background: '#ffffff', display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) 44px', gap: 8, alignItems: 'center' }}>
        <button type="button" aria-label="返回" onClick={() => navigate(-1)} style={{ border: 'none', background: 'transparent', width: 44, height: 44, display: 'grid', placeItems: 'center', color: '#292524', cursor: 'pointer' }}>
          <ChevronLeft size={19} />
        </button>
        <label style={{ height: 44, borderRadius: '999px', background: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px', color: '#94a3b8' }}>
          <Search size={15} />
          <input aria-label="搜索关键词" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索时间、地点、标签或内容..." style={{ width: '100%', minHeight: 44, border: 'none', outline: 'none', background: 'transparent', color: '#292524', fontSize: 12, fontWeight: 700 }} />
        </label>
        <button type="button" onClick={() => setKeyword(keyword.trim())} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: '#292524', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>搜索</button>
      </header>
      <main style={{ ...refContentStyle, paddingTop: 24 }}>
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, color: '#292524', fontSize: 14, fontWeight: 900 }}>搜索历史</h2>
            <button type="button" onClick={() => setKeyword('')} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: '#a8a29e', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>清空</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {['第一次走路', '生日', '游乐园', '满月'].map((item) => (
              <button key={item} type="button" onClick={() => setKeyword(item)} style={{ minHeight: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                <RefChip>{item}</RefChip>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2 style={{ margin: '0 0 12px', color: '#292524', fontSize: 14, fontWeight: 900 }}>热门标签</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {['#第一次', '#生日快乐', '#户外游', '#情绪瞬间', '#会走路了'].map((item) => (
              <button key={item} type="button" onClick={() => setKeyword(item.replace('#', ''))} style={{ minHeight: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                <span style={{ display: 'inline-flex', minHeight: 44, borderRadius: '999px', padding: '10px 14px', alignItems: 'center', color: '#d97706', background: '#fef3c7', fontSize: 12, fontWeight: 900 }}>{item}</span>
              </button>
            ))}
          </div>
        </section>
        {keyword.trim() ? (
          <section style={{ display: 'grid', gap: 10 }}>
            {filtered.map((record) => <RecordSummaryCard key={record.record_no} record={record} onClick={() => navigate(`/record/${record.record_no}`)} />)}
            {!filtered.length ? <EmptyState message="没有找到匹配的记录。" /> : null}
          </section>
        ) : null}
      </main>
    </div>
  );
};

export const TimelinePage = () => {
  const navigate = useNavigate();
  const { activeChild } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'mixed' | 'video' | 'text' | 'audio' | 'milestone'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const { data, loading, error } = useAsyncData(
    async () => {
      if (!activeChild) return null;
      return webApi.listRecords({
        child_no: activeChild.child_no,
        page: 1,
        page_size: 40,
        status: 'published',
        record_type: recordTypeFilter === 'all' || recordTypeFilter === 'milestone' ? undefined : recordTypeFilter,
        tag: tagFilter ?? undefined,
      });
    },
    [activeChild?.child_no, recordTypeFilter, tagFilter],
  );

  const filters = [
    { label: '全部', value: 'all' as const },
    { label: '照片', value: 'mixed' as const },
    { label: '视频', value: 'video' as const },
    { label: '文字', value: 'text' as const },
    { label: '语音', value: 'audio' as const },
    { label: '里程碑', value: 'milestone' as const },
  ];
  const records = data?.list ?? [];
  const typeFilteredRecords = recordTypeFilter === 'milestone' ? records.filter((record) => record.is_milestone || record.record_type === 'milestone') : records;
  const visibleRecords = searchQuery.trim()
    ? typeFilteredRecords.filter((record) => [record.title, record.summary, record.creator_name, ...(record.tags ?? [])].filter(Boolean).some((value) => String(value).includes(searchQuery.trim())))
    : typeFilteredRecords;
  const tags = Array.from(new Set(records.flatMap((record) => record.tags ?? [])));
  const activeTypeLabel = filters.find((filter) => filter.value === recordTypeFilter)?.label ?? '全部';
  const hasActiveFilter = recordTypeFilter !== 'all' || Boolean(tagFilter);
  const grouped = visibleRecords.reduce<Array<{ month: string; records: RecordSummary[] }>>((groups, record) => {
    const month = formatMonthTitle(record.event_time);
    const existing = groups.find((item) => item.month === month);
    if (existing) existing.records.push(record);
    else groups.push({ month, records: [record] });
    return groups;
  }, []);

  return (
    <div style={refPageStyle}>
      <header style={{ position: 'sticky', top: 0, zIndex: 4, background: 'rgba(248,251,255,0.84)', backdropFilter: 'blur(22px)', padding: 'calc(22px + env(safe-area-inset-top)) 20px 12px', borderBottom: searchOpen || filterOpen ? '1px solid rgba(126,145,170,0.18)' : '1px solid transparent', transition: 'border-color 0.18s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ margin: 0, color: '#172033', fontSize: 29, fontWeight: 950, lineHeight: 1.1 }}>时间轴</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" aria-label="搜索记录" aria-pressed={searchOpen} onClick={() => setSearchOpen((current) => !current)} style={{ ...iconButtonStyle, background: searchOpen ? 'linear-gradient(135deg, #17342f 0%, #22584f 100%)' : 'rgba(255,255,255,0.88)', color: searchOpen ? '#ffffff' : '#334155' }}>
              <Search size={18} />
            </button>
            <button type="button" aria-label="筛选记录" aria-pressed={filterOpen} onClick={() => setFilterOpen((current) => !current)} style={{ ...iconButtonStyle, background: filterOpen || hasActiveFilter ? 'linear-gradient(135deg, #17342f 0%, #22584f 100%)' : 'rgba(255,255,255,0.88)', color: filterOpen || hasActiveFilter ? '#ffffff' : '#334155' }}>
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </div>
        {searchOpen ? (
          <input aria-label="搜索关键词" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索标题、正文、标签或记录人" style={{ width: '100%', minHeight: 46, borderRadius: 17, border: '1px solid rgba(126,145,170,0.24)', background: 'rgba(255,255,255,0.9)', padding: '0 14px', color: '#172033', outline: 'none', marginBottom: 12, boxShadow: '0 8px 18px rgba(25,35,55,0.06)' }} />
        ) : null}
        {hasActiveFilter && !filterOpen ? (
          <button
            type="button"
            aria-label="清除当前筛选"
            onClick={() => {
              setRecordTypeFilter('all');
              setTagFilter(null);
            }}
            style={{
              minHeight: 34,
              border: '1px solid rgba(217,119,6,0.2)',
              borderRadius: '999px',
              background: 'rgba(255,249,235,0.94)',
              color: '#7c4a03',
              padding: '6px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 850,
              cursor: 'pointer',
            }}
          >
            当前筛选：{activeTypeLabel}{tagFilter ? ` / #${tagFilter}` : ''}，点击清除
          </button>
        ) : null}
      </header>

      <main style={{ padding: '28px 20px 28px' }}>
        {filterOpen ? (
          <div
            style={{
              borderRadius: 26,
              border: '1px solid rgba(126,145,170,0.22)',
              background: 'rgba(255,255,255,0.92)',
              padding: 15,
              display: 'grid',
              gap: 14,
              marginBottom: 22,
              boxShadow: '0 18px 36px rgba(25,35,55,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <strong style={{ color: '#172033', fontSize: 14, fontWeight: 950 }}>筛选记录</strong>
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setRecordTypeFilter('all');
                    setTagFilter(null);
                  }}
                  style={{ border: 'none', background: 'transparent', color: '#a16207', padding: 0, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  清除
                </button>
              ) : null}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: '#a8a29e', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em' }}>记录类型</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {filters.map((filter) => {
                  const active = recordTypeFilter === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setRecordTypeFilter(filter.value)}
                      style={{
                        minHeight: 38,
                        border: active ? '1px solid #17342f' : '1px solid rgba(126,145,170,0.22)',
                        borderRadius: '999px',
                        background: active ? 'linear-gradient(135deg, #17342f 0%, #22584f 100%)' : 'rgba(255,255,255,0.86)',
                        color: active ? '#ffffff' : '#334155',
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 850,
                        cursor: 'pointer',
                        boxShadow: active ? '0 10px 20px rgba(23,52,47,0.2)' : '0 6px 14px rgba(25,35,55,0.04)',
                      }}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: '#a8a29e', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em' }}>标签</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tags.length ? tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={tagFilter === tag}
                    onClick={() => setTagFilter((current) => (current === tag ? null : tag))}
                    style={{
                      minHeight: 36,
                      border: tagFilter === tag ? '1px solid #f59e0b' : '1px solid #f7e7bf',
                      borderRadius: '999px',
                      background: tagFilter === tag ? '#f59e0b' : '#fff7e6',
                      color: tagFilter === tag ? '#ffffff' : '#b45309',
                      padding: '7px 11px',
                      fontSize: 12,
                      fontWeight: 850,
                      cursor: 'pointer',
                    }}
                  >
                    #{tag}
                  </button>
                )) : <span style={{ color: '#a8a29e', fontSize: 12, fontWeight: 700 }}>当前记录还没有可用标签。</span>}
              </div>
            </div>
          </div>
        ) : null}
        {!activeChild ? <EmptyState message="请先选择孩子，再查看时间轴。" /> : null}
        {loading ? <EmptyState message="正在加载记录列表…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {!loading && !error && grouped.map((group) => (
          <section key={group.month} style={{ marginBottom: 34 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 18 }}>
              <h2 style={{ margin: 0, color: '#172033', fontSize: 22, fontWeight: 950 }}>{group.month}</h2>
              <span style={{ color: '#687386', fontSize: 14, fontWeight: 750 }}>· {group.records.length}条记录</span>
            </div>
            <div style={{ display: 'grid', gap: 26, position: 'relative' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: 14, top: 18, bottom: 18, width: 1, background: '#edf0f3' }} />
              {group.records.map((record, index) => {
                const coverUrl = getCoverUrl(record);
                const mediaKind = getMediaKind(record);
                const isMilestone = record.is_milestone || record.record_type === 'milestone';
                const imageUrl = coverUrl ?? (index % 3 === 2 ? referenceAssets.parkPhoto : referenceAssets.childPhoto);
                return (
                  <div key={record.record_no} style={{ display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
                    <span style={{ width: isMilestone ? 15 : 11, height: isMilestone ? 15 : 11, borderRadius: '999px', background: isMilestone ? '#f59e0b' : '#d1d5db', boxShadow: '0 0 0 7px #ffffff', marginTop: 20, justifySelf: 'center', zIndex: 1 }} />
                    <article style={{ ...refSoftCardStyle, borderRadius: 28, padding: 18, overflow: 'hidden', background: isMilestone ? 'linear-gradient(140deg, rgba(255,249,235,0.94) 0%, rgba(255,255,255,0.94) 100%)' : 'rgba(255,255,255,0.92)', borderColor: isMilestone ? 'rgba(217,119,6,0.22)' : 'rgba(126,145,170,0.22)' }}>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: isMilestone ? '#d97706' : '#9ca3af', fontSize: 12, fontWeight: 900 }}>
                          {isMilestone ? <Star size={14} fill="currentColor" /> : <ImageIcon size={14} />}
                          {getRecordLabel(record)}
                        </span>
                        <h3 style={{ margin: 0, color: '#172033', fontSize: 19, lineHeight: 1.35, fontWeight: 950 }}>{record.title ?? '未命名记录'}</h3>
                        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.8, fontWeight: 650 }}>{record.summary ?? '这条记录还没有正文。'}</p>
                        {record.ai_summary ? (
                          <div style={{ borderRadius: 18, background: '#f1f5ff', color: '#667085', padding: '13px 15px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <Sparkles size={17} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, fontWeight: 600 }}>{record.ai_summary}</p>
                          </div>
                        ) : null}
                        {mediaKind === 'audio' ? (
                          <div style={{ borderRadius: '999px', background: '#f8f9fa', padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 42, height: 42, borderRadius: '999px', background: 'linear-gradient(135deg, #17342f 0%, #22584f 100%)', color: '#ffffff', display: 'grid', placeItems: 'center' }}><PlayCircle size={20} fill="currentColor" /></span>
                            <span style={{ flex: 1, height: 28, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {[28, 12, 22, 34, 22, 16, 44, 36, 22, 28, 18, 30].map((height, waveIndex) => <span key={waveIndex} style={{ width: 5, height, borderRadius: '999px', background: '#a3a3a3' }} />)}
                            </span>
                            <span style={{ color: '#57534e', fontSize: 13, fontWeight: 800 }}>0:12</span>
                          </div>
                        ) : (
                          <img src={imageUrl} alt={record.title ?? '成长照片'} style={{ width: '100%', height: 170, objectFit: 'cover', borderRadius: 18, display: 'block', background: '#f5f5f4' }} />
                        )}
                        <footer style={{ display: 'grid', gap: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#a1a1aa', fontSize: 13, fontWeight: 700 }}>
                            <span>{formatShortDate(record.event_time)}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <RefAvatar src={momAvatarFor(null)} label={record.creator_name} size={22} />
                              {record.creator_name}记录
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
                              {(record.tags ?? []).slice(0, 3).map((tag) => (
                                <span key={`${record.record_no}-${tag}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: '999px', background: '#fafafa', border: '1px solid #eef0f2', padding: '5px 8px', color: '#9ca3af', fontSize: 11, fontWeight: 800 }}>
                                  <Tag size={10} /> {tag}
                                </span>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                              <button type="button" onClick={() => navigate(`/record/${record.record_no}/edit`)} style={{ minHeight: 44, border: '1px solid rgba(126,145,170,0.2)', borderRadius: '999px', background: 'rgba(255,255,255,0.86)', color: '#334155', padding: '9px 14px', fontSize: 12, fontWeight: 850, cursor: 'pointer', boxShadow: '0 6px 14px rgba(25,35,55,0.05)' }}>编辑</button>
                              <button type="button" onClick={() => navigate(`/record/${record.record_no}`)} style={{ minHeight: 44, border: 'none', background: 'transparent', color: '#687386', padding: '9px 6px', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 850, cursor: 'pointer' }}>查看 <ChevronRight size={14} /></button>
                            </div>
                          </div>
                        </footer>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {activeChild && !loading && !error && !records.length ? (
          <div style={{ ...refCardStyle, padding: 18, display: 'grid', gap: 12 }}>
            <EmptyState message="当前孩子还没有已发布记录。" />
            <button type="button" onClick={() => navigate('/record/create')} style={refPrimaryButtonStyle}>去创建第一条记录</button>
          </div>
        ) : null}
      </main>
    </div>
  );
};
