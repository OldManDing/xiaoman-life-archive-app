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
  width: 44,
  height: 44,
  borderRadius: '999px',
  border: '1px solid #eef0f2',
  background: '#ffffff',
  color: '#667085',
  display: 'grid',
  placeItems: 'center',
  boxShadow: '0 2px 8px rgba(15,23,42,0.035)',
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

const ActionTile = ({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      minHeight: 66,
      borderRadius: 18,
      border: '1px solid #ece9e3',
      background: 'rgba(255,255,255,0.96)',
      color: '#57534e',
      display: 'grid',
      justifyItems: 'center',
      alignContent: 'center',
      gap: 6,
      boxShadow: '0 8px 22px rgba(15,23,42,0.045)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
    }}
  >
    <span style={{ width: 30, height: 30, borderRadius: '999px', background: '#faf7f2', display: 'grid', placeItems: 'center' }}>{icon}</span>
    <span style={{ fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{label}</span>
  </button>
);

const RecordSummaryCard = ({ record, onClick }: { record: RecordSummary; onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{ ...refSoftCardStyle, width: '100%', minHeight: 104, padding: '15px 16px', display: 'flex', gap: 15, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}>
    <span style={{ width: 48, borderRight: '1px solid #f3f0ea', display: 'grid', justifyItems: 'center', flexShrink: 0, paddingRight: 12 }}>
      <strong style={{ color: '#44403c', fontSize: 25, lineHeight: 1 }}>{formatDay(record.event_time)}</strong>
      <span style={{ marginTop: 6, color: '#a8a29e', fontSize: 11, fontWeight: 800 }}>{formatMonth(record.event_time)}</span>
    </span>
    <span style={{ minWidth: 0, display: 'grid', gap: 6, flex: 1 }}>
      <strong style={{ color: '#292524', fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.title ?? '未命名记录'}</strong>
      <span style={{ ...refMutedTextStyle, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.summary ?? '这条记录还没有摘要。'}</span>
      <span style={{ color: '#a8a29e', fontSize: 11, fontWeight: 700 }}>{record.tags?.length ? `${record.tags.length} 个标签` : record.creator_name}</span>
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
      <section style={{ ...padded, paddingTop: 'calc(22px + env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" aria-label={children.length > 1 ? '切换孩子档案' : activeChild ? '查看孩子档案' : '添加孩子档案'} onClick={switchChild} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer' }}>
            <RefAvatar src={childAvatarFor(activeChild?.avatar_url)} label={childName} size={44} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <strong style={{ color: '#292524', fontSize: 20, fontWeight: 900, lineHeight: 1.12 }}>{childName}</strong>
                <ChevronDown size={14} color="#9ca3af" />
              </span>
              <span style={{ display: 'block', marginTop: 3, color: '#78716c', fontSize: 12, fontWeight: 700 }}>{activeChild?.current_age_display ?? user?.nickname ?? '家庭档案'}</span>
            </span>
          </button>
          <button type="button" aria-label="搜索记录" onClick={() => navigate('/search')} style={iconButtonStyle}>
            <Search size={18} strokeWidth={2.2} />
          </button>
        </div>
      </section>

      <section style={{ ...padded, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
        <ActionTile icon={<Camera size={17} />} label="拍照记录" disabled={!activeChild} onClick={() => navigate(activeChild ? '/record/create?type=mixed&focus=media' : '/onboarding/child?mode=add')} />
        <ActionTile icon={<Video size={17} />} label="视频记录" disabled={!activeChild} onClick={() => navigate(activeChild ? '/record/create?type=video&focus=media' : '/onboarding/child?mode=add')} />
        <ActionTile icon={<Edit3 size={17} />} label="写一句话" disabled={!activeChild} onClick={() => navigate(activeChild ? '/record/create?type=text&focus=content' : '/onboarding/child?mode=add')} />
        <ActionTile icon={<Star size={17} />} label="里程碑" disabled={!activeChild} onClick={() => navigate(activeChild ? '/record/create?type=milestone&focus=content' : '/onboarding/child?mode=add')} />
      </section>

      <main style={{ ...refContentStyle, paddingTop: 16 }}>
        <section style={{ ...refSoftCardStyle, padding: '15px 16px', background: '#fffdf7', borderColor: '#f5f1e6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 9 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#d97706', fontSize: 14, fontWeight: 900 }}>
              <Sparkles size={15} />
              今日值得记录
            </span>
            <button type="button" onClick={() => setPromptIndex((current) => current + 1)} style={{ border: 'none', background: 'transparent', color: '#a8a29e', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              换一条 <ChevronRight size={13} />
            </button>
          </div>
          <p style={{ margin: '0 0 12px', color: '#292524', fontSize: 13, lineHeight: 1.65, fontWeight: 700 }}>{prompt}</p>
          <button type="button" onClick={() => navigate(activeChild ? '/record/create' : '/onboarding/child?mode=add')} style={{ ...refSecondaryButtonStyle, minHeight: 38, padding: '8px 13px', fontSize: 12, width: '100%', justifyContent: 'flex-start' }}>
            <Edit3 size={14} /> 去记录
          </button>
        </section>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, color: '#292524', fontSize: 17, fontWeight: 900 }}>最近更新</h2>
            <button type="button" onClick={() => navigate('/timeline')} style={{ border: 'none', background: 'transparent', color: '#a8a29e', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
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
            <h2 style={{ margin: 0, color: '#292524', fontSize: 17, fontWeight: 900 }}>一年前的今天</h2>
            <span style={{ color: '#a8a29e', fontSize: 11, fontWeight: 700 }}>2025/5/9</span>
          </div>
          <button type="button" onClick={() => navigate(records[0] ? `/record/${records[0].record_no}` : '/record/create')} style={{ ...refSoftCardStyle, width: '100%', padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ position: 'relative', height: 146, background: '#e7e5e4' }}>
              <img src={referenceAssets.parkPhoto} alt="第一次在草地上奔跑" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span style={{ position: 'absolute', left: 14, bottom: 12, color: '#fff', fontSize: 13, fontWeight: 900, textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>第一次在草地上奔跑</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#57534e', fontSize: 12, fontWeight: 800 }}>
                <span>本月档案进度</span>
                <span>{Math.min(100, records.length * 10)}%</span>
              </div>
              <div style={{ height: 8, borderRadius: '999px', background: '#eef0f2', overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${Math.min(100, records.length * 10)}%`, height: '100%', borderRadius: '999px', background: '#292524' }} />
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
    <div style={{ ...refPageStyle, background: '#ffffff' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 4, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', padding: 'calc(22px + env(safe-area-inset-top)) 20px 12px', borderBottom: searchOpen || filterOpen ? '1px solid #f1ece4' : '1px solid transparent', transition: 'border-color 0.18s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ margin: 0, color: '#292524', fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}>时间轴</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" aria-label="搜索记录" aria-pressed={searchOpen} onClick={() => setSearchOpen((current) => !current)} style={{ ...iconButtonStyle, background: searchOpen ? '#292524' : '#f8f9fa', color: searchOpen ? '#ffffff' : '#667085', borderColor: 'transparent', boxShadow: 'none' }}>
              <Search size={18} />
            </button>
            <button type="button" aria-label="筛选记录" aria-pressed={filterOpen} onClick={() => setFilterOpen((current) => !current)} style={{ ...iconButtonStyle, background: filterOpen || hasActiveFilter ? '#292524' : '#f8f9fa', color: filterOpen || hasActiveFilter ? '#ffffff' : '#667085', borderColor: 'transparent', boxShadow: 'none' }}>
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </div>
        {searchOpen ? (
          <input aria-label="搜索关键词" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索标题、正文、标签或记录人" style={{ width: '100%', minHeight: 42, borderRadius: 12, border: '1px solid #e7e5e4', background: '#fafaf9', padding: '0 12px', color: '#292524', outline: 'none', marginBottom: 12 }} />
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
              border: '1px solid #eee9df',
              borderRadius: '999px',
              background: '#fffaf2',
              color: '#7c4a03',
              padding: '6px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 800,
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
              borderRadius: 24,
              border: '1px solid #eee9df',
              background: '#fffdf9',
              padding: 14,
              display: 'grid',
              gap: 14,
              marginBottom: 22,
              boxShadow: '0 10px 24px rgba(41,37,36,0.055)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <strong style={{ color: '#292524', fontSize: 14, fontWeight: 900 }}>筛选记录</strong>
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
                        border: active ? '1px solid #292524' : '1px solid #eee9df',
                        borderRadius: '999px',
                        background: active ? '#292524' : '#ffffff',
                        color: active ? '#ffffff' : '#57534e',
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 850,
                        cursor: 'pointer',
                        boxShadow: active ? '0 6px 14px rgba(41,37,36,0.14)' : '0 2px 8px rgba(41,37,36,0.025)',
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
              <h2 style={{ margin: 0, color: '#111827', fontSize: 22, fontWeight: 900 }}>{group.month}</h2>
              <span style={{ color: '#9ca3af', fontSize: 14, fontWeight: 700 }}>· {group.records.length}条记录</span>
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
                    <article style={{ ...refSoftCardStyle, borderRadius: 28, padding: 18, overflow: 'hidden', background: isMilestone ? '#fffdf8' : '#ffffff', borderColor: isMilestone ? '#f5e7c0' : '#eef0f2' }}>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: isMilestone ? '#d97706' : '#9ca3af', fontSize: 12, fontWeight: 900 }}>
                          {isMilestone ? <Star size={14} fill="currentColor" /> : <ImageIcon size={14} />}
                          {getRecordLabel(record)}
                        </span>
                        <h3 style={{ margin: 0, color: '#111827', fontSize: 19, lineHeight: 1.35, fontWeight: 900 }}>{record.title ?? '未命名记录'}</h3>
                        <p style={{ margin: 0, color: '#4b5563', fontSize: 15, lineHeight: 1.8, fontWeight: 600 }}>{record.summary ?? '这条记录还没有正文。'}</p>
                        {record.ai_summary ? (
                          <div style={{ borderRadius: 18, background: '#f1f5ff', color: '#667085', padding: '13px 15px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <Sparkles size={17} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, fontWeight: 600 }}>{record.ai_summary}</p>
                          </div>
                        ) : null}
                        {mediaKind === 'audio' ? (
                          <div style={{ borderRadius: '999px', background: '#f8f9fa', padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 42, height: 42, borderRadius: '999px', background: '#292524', color: '#ffffff', display: 'grid', placeItems: 'center' }}><PlayCircle size={20} fill="currentColor" /></span>
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
                              <button type="button" onClick={() => navigate(`/record/${record.record_no}/edit`)} style={{ minHeight: 44, border: 'none', borderRadius: '999px', background: '#fafaf9', color: '#78716c', padding: '9px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>编辑</button>
                              <button type="button" onClick={() => navigate(`/record/${record.record_no}`)} style={{ minHeight: 44, border: 'none', background: 'transparent', color: '#9ca3af', padding: '9px 6px', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>查看 <ChevronRight size={14} /></button>
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
