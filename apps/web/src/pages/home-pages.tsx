import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  Image as ImageIcon,
  PlayCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  User,
  Video,
} from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { RecordSummary } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { helperTextStyle } from '../shared/ui';
import { EmptyState } from './shared';

const appPageStyle: CSSProperties = {
  minHeight: '100dvh',
  background: '#ffffff',
  color: '#292524',
  overflowX: 'hidden',
};

const paddedSectionStyle: CSSProperties = {
  paddingLeft: '20px',
  paddingRight: '20px',
};

const softCardStyle: CSSProperties = {
  borderRadius: '20px',
  background: '#ffffff',
  border: '1px solid #f2efe9',
  boxShadow: '0 2px 12px rgba(15,23,42,0.025)',
};

const iconButtonStyle: CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: '999px',
  border: '1px solid #eee9df',
  background: '#fafaf9',
  color: '#78716c',
  display: 'grid',
  placeItems: 'center',
  boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
  cursor: 'pointer',
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
};

const smallMutedButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#a8a29e',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  borderRadius: '999px',
  border: '1px solid #e7e5e4',
  background: '#fafaf9',
  color: '#57534e',
  padding: '7px 13px',
  fontSize: '13px',
  fontWeight: 600,
};

const formatDay = (value: string) => new Date(value).getDate();

const formatMonth = (value: string) => new Date(value).toLocaleString('en-US', { month: 'short' }).toUpperCase();

const formatShortDate = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const getRecordTypeLabel = (record: RecordSummary) => {
  if (record.record_type === 'milestone' || record.is_milestone) return '里程碑档案';
  if (record.record_type === 'text') return '文字档案';
  return record.cover_url ? '图文档案' : '成长记录';
};

const InitialAvatar = ({ label, size = 48, radius = '999px' }: { label: string; size?: number; radius?: string }) => (
  <div
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: radius,
      background: '#f5f5f4',
      border: '1px solid #eee9df',
      display: 'grid',
      placeItems: 'center',
      color: '#57534e',
      fontWeight: 700,
      flexShrink: 0,
      boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
    }}
  >
    {label.slice(0, 1) || '宝'}
  </div>
);

export const HomePage = () => {
  const navigate = useNavigate();
  const { user, activeChild, children, setActiveChild, refreshChildren } = useAuth();
  const { data: records, loading, error } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 5 });
      return result.list;
    },
    [activeChild?.child_no],
  );

  useEffect(() => {
    if (!activeChild && children.length > 0) {
      setActiveChild(children[0]);
    }
  }, [activeChild, children, setActiveChild]);

  const featuredMediaRecord = records?.find((record) => record.cover_url) ?? null;
  const recentRecords = records?.slice(0, 2) ?? [];
  const monthlyProgress = Math.min(100, (records?.length ?? 0) * 20);

  return (
    <div style={appPageStyle}>
      <header style={{ ...paddedSectionStyle, paddingTop: 'calc(44px + env(safe-area-inset-top))', paddingBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          {activeChild?.avatar_url ? (
            <img
              src={activeChild.avatar_url}
              alt={activeChild.name}
              style={{ width: '52px', height: '52px', borderRadius: '999px', objectFit: 'cover', border: '1px solid #eee9df', boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}
            />
          ) : (
            <InitialAvatar label={activeChild?.name ?? user?.nickname ?? '宝'} size={52} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong style={{ fontSize: '17px', fontWeight: 600, color: '#292524', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeChild?.name ?? user?.nickname ?? '未登录用户'}</strong>
              <ChevronDown size={16} color="#a8a29e" strokeWidth={2.4} />
            </div>
            <p style={{ margin: '3px 0 0', color: '#78716c', fontSize: '13px', fontWeight: 500 }}>{activeChild ? activeChild.current_age_display : `会员状态：${user?.membership_type ?? 'free'}`}</p>
          </div>
        </div>
        <button type="button" aria-label="刷新孩子信息" style={iconButtonStyle} onClick={() => void refreshChildren()}>
          <Search size={18} strokeWidth={2.2} />
        </button>
      </header>

      <section style={{ ...paddedSectionStyle, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px', marginTop: '24px' }}>
        {[
          { label: '拍照记录', icon: Camera },
          { label: '视频记录', icon: Video },
          { label: '写一句话', icon: Edit3 },
          { label: '里程碑', icon: Star },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate('/record/create')}
              disabled={!activeChild}
              style={{
                minHeight: '82px',
                borderRadius: '18px',
                border: '1px solid #eee9df',
                background: '#fafaf9',
                color: '#57534e',
                display: 'grid',
                justifyItems: 'center',
                alignContent: 'center',
                gap: '8px',
                cursor: activeChild ? 'pointer' : 'not-allowed',
                opacity: activeChild ? 1 : 0.55,
                boxShadow: '0 2px 8px rgba(15,23,42,0.015)',
              }}
            >
              <Icon size={22} strokeWidth={1.7} />
              <span style={{ fontSize: '11px', fontWeight: 600 }}>{item.label}</span>
            </button>
          );
        })}
      </section>

      <section style={{ ...paddedSectionStyle, marginTop: '24px' }}>
        <div style={{ ...softCardStyle, background: '#faf8f5', borderColor: '#f2efe9', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Sparkles size={16} color="#d4af37" strokeWidth={2.2} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#292524' }}>今日值得记录</span>
            </div>
            <button type="button" style={smallMutedButtonStyle}>
              换一条 <ChevronRight size={14} />
            </button>
          </div>
          <p style={{ margin: '0 0 20px', color: '#44403c', fontSize: '15px', lineHeight: 1.8 }}>今天孩子最开心的一刻是什么？有没有一句话、一个动作或者一个表情值得记录下来？</p>
          <button
            type="button"
            onClick={() => navigate('/record/create')}
            style={{
              borderRadius: '999px',
              border: '1px solid #d6d3d1',
              background: '#ffffff',
              color: '#57534e',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(15,23,42,0.025)',
            }}
          >
            <Edit3 size={14} strokeWidth={2} />
            去记录
          </button>
        </div>
      </section>

      <section style={{ ...paddedSectionStyle, marginTop: '36px' }}>
        <div style={sectionHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#292524' }}>最近更新</h2>
          <button type="button" onClick={() => navigate('/timeline')} style={smallMutedButtonStyle}>
            查看更多 <ChevronRight size={16} />
          </button>
        </div>
        {loading ? <EmptyState message="正在加载最近记录…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {!loading && !error && recentRecords.length ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {recentRecords.map((record) => (
              <button key={record.record_no} type="button" onClick={() => navigate(`/record/${record.record_no}`)} style={{ ...softCardStyle, padding: '16px', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ width: '42px', flexShrink: 0, borderRight: '1px solid #f3f0ea', display: 'grid', justifyItems: 'center', paddingRight: '12px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 700, color: '#44403c', lineHeight: 1 }}>{formatDay(record.event_time)}</span>
                  <span style={{ marginTop: '4px', fontSize: '10px', color: '#a8a29e', fontWeight: 700 }}>{formatMonth(record.event_time)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '6px' }}>
                  <strong style={{ fontSize: '15px', fontWeight: 600, color: '#292524', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.title ?? '未命名记录'}</strong>
                  <p style={{ ...helperTextStyle, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.55 }}>{record.summary ?? '这条记录暂无正文'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a8a29e', fontSize: '12px', fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {record.cover_url ? <ImageIcon size={12} /> : <PlayCircle size={12} />}
                      {record.cover_url ? '有影像' : `${record.tags.length || 0}个标签`}
                    </span>
                    <span style={{ width: '4px', height: '4px', borderRadius: '999px', background: '#d6d3d1' }} />
                    <span>{record.creator_name}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : null}
        {!loading && !error && !recentRecords.length ? <EmptyState message="还没有成长记录，点击上方按钮创建第一条。" /> : null}
      </section>

      <section style={{ ...paddedSectionStyle, marginTop: '36px' }}>
        <div style={sectionHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#292524' }}>一年前的今天</h2>
          <span style={{ color: '#a8a29e', fontSize: '12px', fontWeight: 600 }}>{featuredMediaRecord ? new Date(featuredMediaRecord.event_time).toLocaleDateString() : '待接入影像'}</span>
        </div>
        {featuredMediaRecord?.cover_url ? (
          <button
            type="button"
            onClick={() => navigate(`/record/${featuredMediaRecord.record_no}`)}
            style={{ width: '100%', border: 'none', padding: 0, minHeight: '220px', borderRadius: '20px', overflow: 'hidden', position: 'relative', cursor: 'pointer', background: '#fafaf9', textAlign: 'left' }}
          >
            <img src={featuredMediaRecord.cover_url} alt={featuredMediaRecord.title ?? '影像回看'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(41,37,36,0.04) 0%, rgba(41,37,36,0.58) 100%)' }} />
            <div style={{ position: 'absolute', left: '20px', right: '20px', bottom: '20px', color: '#fff', display: 'grid', gap: '6px' }}>
              <strong style={{ fontSize: '17px', fontWeight: 600 }}>{featuredMediaRecord.title ?? '未命名影像记录'}</strong>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)' }}>{featuredMediaRecord.creator_name}记录</span>
            </div>
          </button>
        ) : (
          <div style={{ ...softCardStyle, padding: '20px', background: '#fafaf9' }}>
            <EmptyState message="还没有可用于回看的真实影像记录。上传照片并发布记录后，这里会展示最新影像。" />
          </div>
        )}
      </section>

      <section style={{ ...paddedSectionStyle, marginTop: '36px' }}>
        <div style={{ ...softCardStyle, background: '#fafaf9', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '999px', background: '#fff', border: '1px solid #eee9df', display: 'grid', placeItems: 'center', color: '#78716c', boxShadow: '0 2px 8px rgba(15,23,42,0.035)' }}>
              <Calendar size={18} />
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '14px', color: '#44403c' }}>本月档案进度</strong>
              <span style={{ display: 'block', marginTop: '3px', fontSize: '12px', color: '#a8a29e' }}>已记录 {records?.length ?? 0} 个瞬间</span>
            </div>
          </div>
          <div style={{ display: 'grid', justifyItems: 'end', gap: '5px' }}>
            <span style={{ color: '#57534e', fontSize: '13px', fontWeight: 700 }}>{monthlyProgress}%</span>
            <div style={{ width: '58px', height: '6px', borderRadius: '999px', overflow: 'hidden', background: '#e7e5e4' }}>
              <div style={{ width: `${monthlyProgress}%`, height: '100%', borderRadius: '999px', background: '#57534e' }} />
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...paddedSectionStyle, marginTop: '36px', paddingBottom: '16px' }}>
        <h2 style={{ margin: '0 0 18px', fontSize: '17px', fontWeight: 600, color: '#292524' }}>家庭动态</h2>
        {recentRecords.length ? (
          <div style={{ display: 'grid', gap: '22px' }}>
            {recentRecords.map((record) => (
              <button key={record.record_no} type="button" onClick={() => navigate(`/record/${record.record_no}`)} style={{ border: 'none', background: 'transparent', padding: 0, display: 'flex', gap: '12px', textAlign: 'left', cursor: 'pointer' }}>
                <InitialAvatar label={record.creator_name} size={40} />
                <div style={{ flex: 1, borderBottom: '1px solid #f3f0ea', paddingBottom: '18px', minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline' }}>
                    <span style={{ color: '#44403c', fontSize: '14px', fontWeight: 600 }}>{record.creator_name}</span>
                    <span style={{ color: '#57534e', fontSize: '13px' }}>新增了成长记录</span>
                  </div>
                  <span style={{ display: 'block', marginTop: '3px', color: '#a8a29e', fontSize: '11px', fontWeight: 600 }}>{formatShortDate(record.event_time)}</span>
                  {record.cover_url ? (
                    <div style={{ marginTop: '12px', width: '76px', height: '76px', borderRadius: '14px', overflow: 'hidden', border: '1px solid #eee9df', background: '#fafaf9' }}>
                      <img src={record.cover_url} alt={record.title ?? '动态图片'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ ...softCardStyle, marginTop: '12px', padding: '14px', background: '#fafaf9' }}>
                      <p style={{ margin: 0, color: '#57534e', fontSize: '13.5px', lineHeight: 1.7 }}>{record.title ?? record.summary ?? '未命名记录'}</p>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState message="还没有真实家庭动态。创建记录或邀请家人后，这里会展示最新协作进展。" />
        )}
      </section>
    </div>
  );
};

export const TimelinePage = () => {
  const navigate = useNavigate();
  const { activeChild } = useAuth();
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'mixed' | 'text' | 'milestone'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsyncData(
    async () => {
      if (!activeChild) return null;
      return webApi.listRecords({
        child_no: activeChild.child_no,
        page,
        page_size: 20,
        record_type: recordTypeFilter === 'all' ? undefined : recordTypeFilter,
        tag: tagFilter ?? undefined,
      });
    },
    [activeChild?.child_no, recordTypeFilter, tagFilter, page],
  );

  const filters = [
    { label: '全部', value: 'all' as const },
    { label: '图文', value: 'mixed' as const },
    { label: '文字', value: 'text' as const },
    { label: '里程碑', value: 'milestone' as const },
  ];

  const availableTags = Array.from(new Set(data?.list.flatMap((record) => record.tags) ?? []));
  const recordList = data?.list ?? [];
  const groupedRecords = recordList.reduce<Array<{ month: string; records: typeof recordList }>>((groups, record) => {
    const date = new Date(record.event_time);
    const month = `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
    const existing = groups.find((group) => group.month === month);
    if (existing) {
      existing.records.push(record);
      return groups;
    }

    groups.push({ month, records: [record] });
    return groups;
  }, []);

  return (
    <div style={appPageStyle}>
      <header style={{ ...paddedSectionStyle, paddingTop: 'calc(44px + env(safe-area-inset-top))', paddingBottom: '10px', position: 'sticky', top: 0, zIndex: 3, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#292524' }}>时间轴</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" aria-label="搜索记录" style={iconButtonStyle}>
              <Search size={16} strokeWidth={2.4} />
            </button>
            <button type="button" aria-label="筛选记录" style={iconButtonStyle}>
              <SlidersHorizontal size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              style={{
                ...chipStyle,
                flexShrink: 0,
                cursor: 'pointer',
                background: recordTypeFilter === filter.value ? '#292524' : '#fafaf9',
                borderColor: recordTypeFilter === filter.value ? '#292524' : '#e7e5e4',
                color: recordTypeFilter === filter.value ? '#ffffff' : '#57534e',
              }}
              onClick={() => {
                setRecordTypeFilter(filter.value);
                setPage(1);
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ ...paddedSectionStyle, paddingTop: '18px', display: 'grid', gap: '28px' }}>
        {availableTags.length ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                style={{ ...chipStyle, padding: '6px 11px', fontSize: '12px', background: tagFilter === tag ? '#e7e5e4' : '#fafaf9', cursor: 'pointer' }}
                onClick={() => {
                  setTagFilter((current) => (current === tag ? null : tag));
                  setPage(1);
                }}
              >
                #{tag}
              </button>
            ))}
            {recordTypeFilter !== 'all' || tagFilter ? (
              <button
                type="button"
                style={{ ...chipStyle, padding: '6px 11px', fontSize: '12px', cursor: 'pointer' }}
                onClick={() => {
                  setRecordTypeFilter('all');
                  setTagFilter(null);
                  setPage(1);
                }}
              >
                清除筛选
              </button>
            ) : null}
          </div>
        ) : null}

        {!activeChild ? <EmptyState message="请先选择孩子，再查看时间轴。" /> : null}
        {loading ? <EmptyState message="正在加载记录列表…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}

        {groupedRecords.map((group) => (
          <section key={group.month}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: '#292524' }}>{group.month}</h2>
              <span style={{ color: '#a8a29e', fontSize: '13px', fontWeight: 600 }}>· {group.records.length}条记录</span>
            </div>
            <div style={{ display: 'grid', gap: '18px' }}>
              {group.records.map((record, index) => {
                const isMilestone = record.record_type === 'milestone' || record.is_milestone;
                return (
                  <div key={record.record_no} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                    <div style={{ width: '30px', flexShrink: 0, display: 'flex', justifyContent: 'center', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '28px', bottom: index === group.records.length - 1 ? '18px' : '-18px', width: '1.5px', background: '#eee9df' }} />
                      <div
                        style={{
                          width: isMilestone ? '14px' : '10px',
                          height: isMilestone ? '14px' : '10px',
                          borderRadius: '999px',
                          background: isMilestone ? '#f59e0b' : '#d6d3d1',
                          boxShadow: '0 0 0 4px #ffffff',
                          marginTop: isMilestone ? '18px' : '20px',
                          zIndex: 1,
                        }}
                      />
                    </div>
                    <article style={{ ...softCardStyle, flex: 1, padding: '16px', borderColor: isMilestone ? '#f3e8d2' : '#eee9df', background: isMilestone ? 'linear-gradient(180deg, #faf8f5 0%, #ffffff 100%)' : '#ffffff', position: 'relative', overflow: 'hidden' }}>
                      {isMilestone ? <div style={{ position: 'absolute', top: 0, right: 0, width: '92px', height: '92px', background: 'linear-gradient(225deg, rgba(251,191,36,0.2), transparent)', borderBottomLeftRadius: '30px' }} /> : null}
                      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: isMilestone ? '#d97706' : '#78716c' }}>
                          {isMilestone ? <Star size={14} fill="currentColor" /> : <span style={{ width: '7px', height: '7px', borderRadius: '999px', background: '#d6d3d1' }} />}
                          <span style={{ fontSize: '12px', fontWeight: 700 }}>{getRecordTypeLabel(record)}</span>
                        </div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#292524' }}>{record.title ?? '未命名记录'}</h3>
                        <p style={{ ...helperTextStyle, fontSize: '14px', lineHeight: 1.75 }}>{record.summary ?? '暂无正文'}</p>
                        {record.cover_url ? (
                          <img src={record.cover_url} alt={record.title ?? '记录封面'} style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: '14px', objectFit: 'cover', border: '1px solid #eee9df', background: '#fafaf9' }} />
                        ) : null}
                        {record.tags.length ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {record.tags.map((tag) => (
                              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#78716c', fontSize: '11px', padding: '4px 8px', borderRadius: '8px', border: '1px solid #e7e5e4', background: isMilestone ? '#ffffff' : '#fafaf9' }}>
                                <Tag size={10} />
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '10px', borderTop: isMilestone ? '1px solid #f3e8d2' : '1px solid #f5f5f4' }}>
                          <div style={{ display: 'grid', gap: '4px' }}>
                            <span style={{ color: '#a8a29e', fontSize: '12px', fontWeight: 600 }}>{formatShortDate(record.event_time)}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#78716c', fontSize: '11px' }}>
                              <User size={12} />
                              {record.creator_name}
                            </span>
                          </div>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            <button type="button" style={{ ...chipStyle, padding: '7px 14px', background: '#ffffff', cursor: 'pointer' }} onClick={() => navigate(`/record/${record.record_no}`)}>
                              详情
                            </button>
                            <button type="button" style={{ ...chipStyle, padding: '7px 14px', background: '#ffffff', cursor: 'pointer' }} onClick={() => navigate(`/record/${record.record_no}/edit`)}>
                              编辑
                            </button>
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

        {activeChild && !loading && !error && !data?.list?.length ? <EmptyState message="当前孩子还没有记录。" /> : null}
        {data ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', paddingBottom: '20px' }}>
            <span style={helperTextStyle}>第 {data.page} 页，共 {data.total} 条</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" style={{ ...chipStyle, background: '#ffffff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.55 : 1 }} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1}>
                上一页
              </button>
              <button type="button" style={{ ...chipStyle, background: '#ffffff', cursor: data.has_more ? 'pointer' : 'not-allowed', opacity: data.has_more ? 1 : 0.55 }} onClick={() => setPage((current) => current + 1)} disabled={loading || !data.has_more}>
                下一页
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};
