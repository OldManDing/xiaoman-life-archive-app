import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  BookHeart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Image as ImageIcon,
  MapPin,
  PlayCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
} from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { RecordSummary } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { recordTypeLabel } from '../shared/labels';
import { resolveMediaPreviewUrl } from '../shared/localMediaPreview';
import { loadLocalSettings } from '../shared/localSettings';
import { EmptyState } from './shared';
import {
  RefAvatar,
  RefChip,
  isReferencePlaceholderAvatar,
  refCardStyle,
  refContentStyle,
  refMutedTextStyle,
  refPageStyle,
  refPrimaryButtonStyle,
  refSecondaryButtonStyle,
  refSoftCardStyle,
  referenceAssets,
} from './reference-ui';

const iconButtonStyle: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: '999px',
  border: '1px solid var(--nl-border)',
  background: 'rgba(var(--nl-surface-rgb),0.78)',
  color: 'var(--nl-ink)',
  display: 'grid',
  placeItems: 'center',
  boxShadow: '0 14px 30px rgba(var(--nl-shadow-rgb),0.26)',
  backdropFilter: 'blur(16px)',
  cursor: 'pointer',
};

const formatDay = (value: string) => new Date(value).getDate();
const formatMonth = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: 'short' });
const formatShortDate = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const formatAnniversaryDate = (value: string) => new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
const formatMonthTitle = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
};

const getOneYearAgoWindow = () => {
  const target = new Date();
  target.setFullYear(target.getFullYear() - 1);
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

const getCoverUrl = (record: RecordSummary) => resolveMediaPreviewUrl(record.cover_media_no, record.cover_url);
const getMediaKind = (record: RecordSummary) => record.cover_media_type ?? (record.record_type === 'audio' || record.record_type === 'video' ? record.record_type : null);
const getRecordLabel = (record: RecordSummary) => recordTypeLabel(record.record_type, record.is_milestone);

const referenceAvatarFor = (src: string | null | undefined, fallbackSrc: string) => {
  if (!src || isReferencePlaceholderAvatar(src)) return fallbackSrc;
  return src;
};

const childAvatarFor = (src?: string | null) => referenceAvatarFor(src, referenceAssets.childAvatar);
const momAvatarFor = (src?: string | null) => referenceAvatarFor(src, referenceAssets.momAvatar);

const prompts = (childName: string) => [
  `今天想和我聊聊${childName}的什么趣事呢?`,
  `${childName}今天有没有一个小小的新发现?`,
  `想不想把${childName}今天的可爱瞬间写成小故事?`,
  `今天有什么话想整理进${childName}的成长月报?`,
];

const HomeQuickEntry = ({
  icon,
  label,
  onClick,
  disabled,
  accent = 'var(--nl-accent)',
  background = 'rgba(var(--nl-accent-rgb),0.14)',
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: string;
  background?: string;
}) => (
  <button
    type="button"
    className="home-quick-action nl-pressable"
    onClick={onClick}
    disabled={disabled}
    style={{
      minHeight: 56,
      borderRadius: 18,
      border: '1px solid var(--nl-border)',
      background: 'rgba(var(--nl-surface-rgb),0.68)',
      color: 'var(--nl-ink)',
      display: 'grid',
      justifyItems: 'center',
      alignContent: 'center',
      gap: 4,
      padding: '6px 4px',
      textAlign: 'center',
      boxShadow: '0 14px 32px rgba(var(--nl-shadow-rgb),0.28), inset 0 1px 0 rgba(255,255,255,0.08)',
      backdropFilter: 'blur(18px)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
    }}
  >
    <span style={{ width: 34, height: 34, borderRadius: '14px', background, color: accent, display: 'grid', placeItems: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 0 26px rgba(var(--nl-primary-rgb),0.16)' }}>{icon}</span>
    <span style={{ width: '100%', color: 'var(--nl-ink)', fontSize: label.length > 3 ? 12 : 13, lineHeight: 1.15, fontWeight: 950, whiteSpace: 'nowrap', overflow: 'visible' }}>{label}</span>
  </button>
);

const RecordSummaryCard = ({ record, onClick }: { record: RecordSummary; onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{ ...refSoftCardStyle, width: '100%', minHeight: 108, padding: '15px 16px', display: 'flex', gap: 15, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}>
    <span style={{ width: 52, borderRight: '1px solid var(--nl-border)', display: 'grid', justifyItems: 'center', flexShrink: 0, paddingRight: 12 }}>
      <strong style={{ color: 'var(--nl-ink)', fontSize: 26, lineHeight: 1, fontWeight: 950 }}>{formatDay(record.event_time)}</strong>
      <span style={{ marginTop: 6, color: 'var(--nl-muted)', fontSize: 11, fontWeight: 850 }}>{formatMonth(record.event_time)}</span>
    </span>
    <span style={{ minWidth: 0, display: 'grid', gap: 6, flex: 1 }}>
      <strong style={{ color: 'var(--nl-ink)', fontSize: 15, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.title ?? '未命名记录'}</strong>
      <span style={{ ...refMutedTextStyle, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.summary ?? '这条记录还没有摘要。'}</span>
      <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 750 }}>{record.tags?.length ? `${record.tags.length} 个标签` : record.creator_name}</span>
    </span>
  </button>
);

const HomeTimelineCard = ({ record, onClick, index }: { record: RecordSummary; onClick: () => void; index: number }) => {
  const coverUrl = getCoverUrl(record);
  const mediaKind = getMediaKind(record);
  const isMilestone = record.is_milestone || record.record_type === 'milestone';
  const fallbackImage = index % 2 === 0 ? referenceAssets.childPhoto : referenceAssets.parkPhoto;

  return (
    <button type="button" onClick={onClick} className="nl-pressable" style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
      <span style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', gap: 12, alignItems: 'stretch' }}>
        <span style={{ position: 'relative', display: 'grid', justifyItems: 'center', paddingTop: 4 }}>
          <span style={{ color: 'var(--nl-muted-strong)', fontSize: 11, fontWeight: 800 }}>{formatDay(record.event_time)}</span>
          <span style={{ marginTop: 2, color: 'var(--nl-muted)', fontSize: 10, fontWeight: 750 }}>{formatMonth(record.event_time)}</span>
          <span aria-hidden="true" style={{ position: 'absolute', top: 38, bottom: -18, width: 1, background: 'linear-gradient(180deg, rgba(var(--nl-accent-rgb),0.56), rgba(var(--nl-accent-rgb),0.08))' }} />
          <span aria-hidden="true" style={{ position: 'absolute', top: 44, width: 10, height: 10, borderRadius: '999px', background: isMilestone ? 'var(--nl-primary-2)' : 'var(--nl-accent)', boxShadow: '0 0 0 5px rgba(var(--nl-primary-rgb),0.18)' }} />
        </span>
        <span style={{ ...refCardStyle, minHeight: 92, borderRadius: 22, padding: 10, display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', gap: 12, alignItems: 'center' }}>
          <span style={{ position: 'relative', width: 84, height: 68, borderRadius: 16, overflow: 'hidden', background: 'var(--nl-surface-soft)', display: 'block', flexShrink: 0, border: '1px solid var(--nl-border)' }}>
            {mediaKind === 'audio' ? (
              <span style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'rgba(var(--nl-accent-rgb),0.14)', color: 'var(--nl-accent)' }}>
                <PlayCircle size={24} strokeWidth={2.2} />
              </span>
            ) : (
              <img src={coverUrl ?? fallbackImage} alt={record.title ?? '成长记录'} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
            {isMilestone ? <span style={{ position: 'absolute', right: 6, top: 6, width: 22, height: 22, borderRadius: '999px', background: 'rgba(var(--nl-primary-rgb),0.22)', color: 'var(--nl-primary-2)', display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(var(--nl-shadow-rgb),0.32)' }}><Star size={12} fill="currentColor" /></span> : null}
          </span>
          <span style={{ minWidth: 0, display: 'grid', gap: 5 }}>
            <strong style={{ color: 'var(--nl-ink)', fontSize: 13, lineHeight: 1.35, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.title ?? '未命名记录'}</strong>
            <span style={{ color: 'var(--nl-muted)', fontSize: 11, lineHeight: 1.45, fontWeight: 650, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.summary ?? `${record.creator_name} 留下的一条成长记录。`}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: isMilestone ? 'var(--nl-primary-2)' : 'var(--nl-accent)', fontSize: 10, fontWeight: 850 }}>
              {isMilestone ? <Star size={11} fill="currentColor" /> : <ImageIcon size={11} />}
              {getRecordLabel(record)}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
};

const getRecordYear = (value: string) => String(new Date(value).getFullYear());

const formatAgeAtEvent = (birthday?: string | null, eventTime?: string) => {
  if (!birthday || !eventTime) return '';
  const birth = new Date(birthday);
  const event = new Date(eventTime);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(event.getTime()) || event < birth) return '';

  let months = (event.getFullYear() - birth.getFullYear()) * 12 + event.getMonth() - birth.getMonth();
  if (event.getDate() < birth.getDate()) months -= 1;
  if (months <= 0) {
    const days = Math.max(0, Math.floor((event.getTime() - birth.getTime()) / 86_400_000));
    return `${days}天`;
  }

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  if (years > 0) return `${years}岁${restMonths > 0 ? `${restMonths}个月` : ''}`;
  return `${months}个月`;
};

const getCurrentAgeYear = (birthday?: string | null) => {
  if (!birthday) return 2;
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return 2;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return Math.min(4, Math.max(1, years + 1));
};

const TimelineRecordRow = ({
  record,
  index,
  ageLabel,
  onClick,
}: {
  record: RecordSummary;
  index: number;
  ageLabel: string;
  onClick: () => void;
}) => {
  const coverUrl = getCoverUrl(record);
  const mediaKind = getMediaKind(record);
  const isMilestone = record.is_milestone || record.record_type === 'milestone';
  const imageUrl = coverUrl ?? (index % 3 === 1 ? referenceAssets.parkPhoto : index % 3 === 2 ? referenceAssets.roomPhoto : referenceAssets.childPhoto);
  const icon = isMilestone ? <Star size={18} fill="currentColor" /> : mediaKind === 'audio' ? <PlayCircle size={18} /> : record.record_type === 'text' ? <Edit3 size={18} /> : <ImageIcon size={18} />;

  return (
    <button type="button" onClick={onClick} className="nl-pressable" style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr)', gap: 8, alignItems: 'stretch', textAlign: 'left', cursor: 'pointer' }}>
      <span style={{ position: 'relative', minHeight: 112, display: 'grid', justifyItems: 'center' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 22, top: -24, bottom: -24, width: 1, background: 'linear-gradient(180deg, rgba(var(--nl-accent-rgb),0.08), rgba(var(--nl-accent-rgb),0.58), rgba(var(--nl-accent-rgb),0.08))' }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: 14, top: 45, width: 16, height: 16, borderRadius: '999px', background: 'var(--nl-primary-2)', boxShadow: '0 0 0 5px rgba(var(--nl-primary-rgb),0.16)' }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: 29, top: 53, width: 18, height: 1, background: 'rgba(var(--nl-accent-rgb),0.34)' }} />
        <span style={{ position: 'relative', zIndex: 1, marginTop: 33, marginLeft: 28, width: 46, height: 46, borderRadius: '999px', color: isMilestone ? 'var(--nl-primary-2)' : 'var(--nl-accent)', background: 'linear-gradient(135deg, rgba(var(--nl-surface-strong-rgb),0.98), rgba(var(--nl-primary-rgb),0.28))', border: '1px solid var(--nl-border)', display: 'grid', placeItems: 'center', boxShadow: '0 10px 26px rgba(var(--nl-shadow-rgb),0.34), inset 0 1px 0 rgba(255,255,255,0.14)' }}>{icon}</span>
      </span>
      <span style={{ ...refSoftCardStyle, minHeight: 110, borderRadius: 22, padding: '11px 10px 11px 14px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 82px 20px', gap: 8, alignItems: 'center' }}>
        <span style={{ minWidth: 0, display: 'grid', gap: 5 }}>
          <span style={{ color: 'var(--nl-primary)', fontSize: 13, lineHeight: 1.15, fontWeight: 950 }}>{ageLabel || formatShortDate(record.event_time)}</span>
          <strong style={{ color: 'var(--nl-ink)', fontSize: 14, lineHeight: 1.25, fontWeight: 950, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.title ?? '未命名记录'}</strong>
          {mediaKind === 'audio' ? (
            <span style={{ width: '100%', maxWidth: 144, minHeight: 34, borderRadius: '999px', background: 'rgba(var(--nl-accent-rgb),0.14)', color: 'var(--nl-accent)', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800 }}>
              <PlayCircle size={14} fill="currentColor" />
              <span style={{ flex: 1, height: 16, display: 'flex', alignItems: 'center', gap: 3 }}>
                {[10, 16, 8, 20, 12, 18, 9].map((height, waveIndex) => <span key={waveIndex} style={{ width: 3, height, borderRadius: '999px', background: 'rgba(var(--nl-accent-rgb),0.42)' }} />)}
              </span>
              00:06
            </span>
          ) : (
            <span style={{ color: 'var(--nl-muted)', fontSize: 11, lineHeight: 1.5, fontWeight: 650, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.summary ?? '这条记录还没有正文。'}</span>
          )}
        </span>
        <img src={imageUrl} alt={record.title ?? '成长照片'} loading="lazy" decoding="async" style={{ width: 82, height: 72, objectFit: 'cover', borderRadius: 15, display: 'block', background: 'var(--nl-surface-soft)' }} />
        <span aria-hidden="true" style={{ width: 28, height: 28, marginLeft: -5, borderRadius: '999px', background: 'rgba(var(--nl-surface-rgb),0.72)', color: 'var(--nl-muted)', display: 'grid', placeItems: 'center', border: '1px solid var(--nl-border)' }}>
          <ChevronRight size={16} />
        </span>
      </span>
    </button>
  );
};

export const HomePage = () => {
  const navigate = useNavigate();
  const { user, activeChild, children, setActiveChild, refreshChildren } = useAuth();
  const [promptIndex, setPromptIndex] = useState(0);
  const anniversaryWindow = useMemo(() => getOneYearAgoWindow(), []);
  const { data: recordData, loading, error } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 5, status: 'published' });
      return result.list;
    },
    [activeChild?.child_no],
  );
  const { data: anniversaryData } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({
        child_no: activeChild.child_no,
        page: 1,
        page_size: 1,
        status: 'published',
        start_time: anniversaryWindow.startIso,
        end_time: anniversaryWindow.endIso,
      });
      return result.list;
    },
    [activeChild?.child_no, anniversaryWindow.startIso, anniversaryWindow.endIso],
  );

  useEffect(() => {
    if (loadLocalSettings().autoRefreshHome) void refreshChildren();
  }, [refreshChildren]);

  useEffect(() => {
    if (!activeChild && children.length > 0) setActiveChild(children[0]);
  }, [activeChild, children, setActiveChild]);

  const records = recordData ?? [];
  const anniversaryRecord = anniversaryData?.[0] ?? null;
  const childName = activeChild?.name?.trim() || '孩子';
  const prompt = prompts(childName)[promptIndex % prompts(childName).length];
  const timelinePreviewRecords = records.slice(0, 3);
  const timelineMonthTitle = timelinePreviewRecords[0] ? formatMonthTitle(timelinePreviewRecords[0].event_time) : formatMonthTitle(new Date().toISOString());
  const switchChild = () => {
    if (children.length > 1 && activeChild) {
      const index = children.findIndex((item) => item.child_no === activeChild.child_no);
      setActiveChild(children[(index + 1) % children.length]);
      return;
    }
    navigate(activeChild ? '/family/child' : '/onboarding/child?mode=add');
  };
  const childRequiredTarget = (path: string) => activeChild ? path : '/onboarding/child?mode=add';
  const activeAgeYear = getCurrentAgeYear(activeChild?.birthday);
  const latestCoverUrl = records[0] ? getCoverUrl(records[0]) : null;
  const anniversaryCoverUrl = anniversaryRecord ? getCoverUrl(anniversaryRecord) : null;
  const planetPhoto = latestCoverUrl ?? referenceAssets.childPhoto;
  const sideMemoryPhoto = anniversaryCoverUrl ?? referenceAssets.parkPhoto;
  const planetSubtitle = loading ? '正在同步成长瞬间' : error ? '记录暂时没有同步' : `已记录 ${records.length} 个珍贵瞬间`;
  const quickActions = [
    { label: '相册', icon: <ImageIcon size={20} />, background: 'rgba(var(--nl-accent-rgb),0.14)', accent: 'var(--nl-accent)', onClick: () => navigate(childRequiredTarget('/record/create?type=mixed&focus=media')) },
    { label: '记录', icon: <Edit3 size={20} />, background: 'rgba(var(--nl-blue-rgb),0.14)', accent: 'var(--nl-blue)', onClick: () => navigate(childRequiredTarget('/record/create')) },
    { label: 'AI故事', icon: <Sparkles size={20} />, background: 'rgba(var(--nl-primary-rgb),0.22)', accent: 'var(--nl-primary-2)', onClick: () => navigate(childRequiredTarget('/record/create?type=text&focus=content')) },
    { label: '月报', icon: <BookHeart size={20} />, background: 'rgba(var(--nl-primary-rgb),0.18)', accent: 'var(--nl-primary-2)', onClick: () => navigate(childRequiredTarget('/profile/reports')) },
  ];

  return (
    <div style={refPageStyle}>
      <section style={{ padding: 'calc(22px + env(safe-area-inset-top)) 20px 0', display: 'grid', gap: 9 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 60px', gap: 10, alignItems: 'start' }}>
          <button type="button" onClick={switchChild} style={{ minWidth: 0, border: 'none', background: 'transparent', padding: 0, display: 'grid', gap: 5, textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <h1 style={{ margin: 0, color: 'var(--nl-ink)', fontSize: 30, lineHeight: 1.02, fontWeight: 950, letterSpacing: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{childName}</h1>
              <ChevronDown size={20} color="var(--nl-muted)" />
            </span>
            <strong style={{ color: 'var(--nl-muted-strong)', fontSize: 18, lineHeight: 1.02, fontWeight: 950 }}>{activeChild?.current_age_display ?? user?.nickname ?? '家庭档案'}</strong>
          </button>
          <button type="button" aria-label="切换孩子" onClick={switchChild} style={{ border: 'none', background: 'transparent', padding: 0, justifySelf: 'end', cursor: 'pointer' }}>
            <RefAvatar src={referenceAssets.childAvatar} label={childName} size={58} fallbackSrc={referenceAssets.childAvatar} />
          </button>
        </div>

        <section style={{ position: 'relative', minHeight: 104 }}>
          <span aria-hidden="true" style={{ position: 'absolute', left: '51%', top: 6, width: 8, height: 8, borderRadius: '999px', background: 'rgba(216,220,255,0.74)' }} />
          <div style={{ position: 'absolute', left: 0, top: 10, width: 'min(100%, 206px)', minHeight: 76, borderRadius: 20, border: '1px solid rgba(139,149,232,0.52)', background: 'rgba(12,18,50,0.82)', boxShadow: '0 18px 42px rgba(var(--nl-shadow-rgb),0.34)', padding: '12px 15px 11px', display: 'grid', gap: 5 }}>
            <strong style={{ color: 'var(--nl-ink)', fontSize: 19, lineHeight: 1.08, fontWeight: 950 }}>Hi，我是星语</strong>
            <span style={{ color: 'var(--nl-muted-strong)', fontSize: 12, lineHeight: 1.42, fontWeight: 900 }}>{prompt}</span>
            <span aria-hidden="true" style={{ position: 'absolute', right: -29, top: 38, width: 30, height: 30, background: 'rgba(12,18,50,0.82)', borderTop: '1px solid rgba(139,149,232,0.52)', borderRight: '1px solid rgba(139,149,232,0.52)', transform: 'rotate(45deg)' }} />
          </div>
          <button type="button" aria-label="换一句星语提示" onClick={() => setPromptIndex((current) => current + 1)} style={{ position: 'absolute', right: 2, top: 32, width: 62, height: 62, borderRadius: '999px', border: '3px solid rgba(190,178,255,0.76)', background: 'radial-gradient(circle at 28% 28%, rgba(216,220,255,0.56), transparent 17%), linear-gradient(145deg, var(--nl-primary-2), var(--nl-primary))', color: 'var(--nl-ink)', display: 'grid', placeItems: 'center', boxShadow: '0 18px 42px rgba(var(--nl-primary-rgb),0.36)', cursor: 'pointer' }}>
            <Sparkles size={26} strokeWidth={2.8} />
          </button>
        </section>

        <section className="home-hero-card" style={{ position: 'relative', minHeight: 136, display: 'grid', justifyItems: 'center', alignItems: 'center' }}>
          <span aria-hidden="true" style={{ position: 'absolute', top: -8, width: 150, height: 150, borderRadius: '999px', background: 'radial-gradient(circle, rgba(var(--nl-primary-rgb),0.28), rgba(var(--nl-primary-rgb),0.08) 54%, transparent 70%)', boxShadow: '0 0 64px rgba(var(--nl-primary-rgb),0.32)' }} />
          <span aria-hidden="true" style={{ position: 'absolute', left: 58, right: 56, top: 101, height: 25, border: '3px solid rgba(var(--nl-accent-rgb),0.34)', borderTop: 'none', borderRadius: '0 0 999px 999px', transform: 'rotate(-8deg)' }} />
          <img src={referenceAssets.roomPhoto} alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ position: 'absolute', left: 34, top: 29, width: 60, height: 42, borderRadius: 15, objectFit: 'cover', border: '1px solid var(--nl-border)', boxShadow: '0 12px 26px rgba(var(--nl-shadow-rgb),0.32), 0 0 0 4px rgba(var(--nl-primary-rgb),0.12)' }} />
          <img src={sideMemoryPhoto} alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ position: 'absolute', right: 10, top: 75, width: 72, height: 46, borderRadius: 15, objectFit: 'cover', border: '1px solid var(--nl-border)', boxShadow: '0 12px 26px rgba(var(--nl-shadow-rgb),0.32), 0 0 0 4px rgba(var(--nl-primary-rgb),0.12)' }} />
          <img src={planetPhoto} alt={`${childName}的成长星球`} loading="lazy" decoding="async" style={{ position: 'absolute', top: 15, width: 104, height: 104, borderRadius: '999px', objectFit: 'cover', border: '3px solid rgba(197,190,255,0.74)', boxShadow: '0 18px 50px rgba(var(--nl-shadow-rgb),0.42), 0 0 0 8px rgba(var(--nl-primary-rgb),0.18)' }} />
          <button type="button" onClick={() => navigate('/timeline')} style={{ position: 'absolute', left: 82, right: 82, bottom: 0, minHeight: 48, borderRadius: 20, border: '1px solid rgba(127,139,220,0.34)', background: 'rgba(10,14,36,0.92)', color: 'var(--nl-ink)', boxShadow: '0 14px 34px rgba(var(--nl-shadow-rgb),0.42)', display: 'grid', placeItems: 'center', gap: 1, cursor: 'pointer' }}>
            <strong style={{ fontSize: 16, lineHeight: 1.05, fontWeight: 950 }}>成长星球</strong>
            <span style={{ color: 'var(--nl-muted-strong)', fontSize: 11, fontWeight: 850 }}>{planetSubtitle}</span>
          </button>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {quickActions.map((item) => (
            <HomeQuickEntry
              key={item.label}
              icon={item.icon}
              label={item.label}
              background={item.background}
              accent={item.accent}
              onClick={item.onClick}
              disabled={!activeChild}
            />
          ))}
        </div>

        <section style={{ ...refSoftCardStyle, padding: '6px 20px 8px', borderRadius: 22, display: 'grid', gap: 3 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center', color: 'var(--nl-muted-strong)', fontSize: 13, fontWeight: 950 }}>
            {[1, 2, 3, 4].map((year) => <span key={year} style={{ color: activeAgeYear === year ? 'var(--nl-ink)' : 'var(--nl-muted)' }}>{year}岁</span>)}
          </div>
          <div style={{ position: 'relative', height: 19 }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 9, right: 9, top: 10, height: 2, background: 'linear-gradient(90deg, rgba(var(--nl-accent-rgb),0.34), rgba(var(--nl-primary-rgb),0.78), rgba(var(--nl-accent-rgb),0.34))' }} />
            {[1, 2, 3, 4].map((year, index) => {
              const active = activeAgeYear === year;
              return (
                <span key={year} aria-hidden="true" style={{ position: 'absolute', left: `${(index / 3) * 100}%`, top: active ? -2 : 7, width: active ? 34 : 18, height: active ? 34 : 18, borderRadius: '999px', background: active ? 'linear-gradient(145deg, var(--nl-primary-2), var(--nl-primary))' : 'rgba(170,178,220,0.62)', transform: 'translateX(-50%)', boxShadow: active ? '0 0 0 12px rgba(var(--nl-primary-rgb),0.2), 0 16px 34px rgba(var(--nl-primary-rgb),0.34)' : 'none', border: active ? '8px solid rgba(197,190,255,0.72)' : 'none' }} />
              );
            })}
          </div>
        </section>
      </section>

      <main style={{ ...refContentStyle, paddingTop: 12, paddingBottom: 'calc(122px + env(safe-area-inset-bottom))' }}>
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div>
              <h2 style={{ margin: 0, color: 'var(--nl-ink)', fontSize: 21, fontWeight: 950 }}>{timelineMonthTitle}</h2>
              <span style={{ display: 'block', marginTop: 5, color: 'var(--nl-muted)', fontSize: 12, fontWeight: 850 }}>成长时间线</span>
            </div>
            <button type="button" onClick={() => navigate('/timeline')} style={{ minHeight: 34, border: 'none', background: 'transparent', color: 'var(--nl-muted)', fontSize: 12, fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
              查看全部 <ChevronRight size={14} />
            </button>
          </div>
          {loading ? <EmptyState message="正在加载最近记录…" /> : null}
          {error ? <EmptyState message={`加载失败：${error}`} /> : null}
          {!loading && !error && timelinePreviewRecords.length ? (
            <div style={{ display: 'grid', gap: 14 }}>
              {timelinePreviewRecords.slice(0, 2).map((record, index) => <HomeTimelineCard key={record.record_no} record={record} index={index} onClick={() => navigate(`/record/${record.record_no}`)} />)}
            </div>
          ) : null}
          {!loading && !error && !timelinePreviewRecords.length ? (
            <div style={{ ...refCardStyle, borderRadius: 20, padding: 16 }}>
              <EmptyState message="还没有成长记录，先留下第一条。" />
              <button type="button" onClick={() => navigate(activeChild ? '/record/create?focus=media' : '/onboarding/child?mode=add')} style={{ ...refPrimaryButtonStyle, marginTop: 12, width: '100%', minHeight: 42 }}>
                <Camera size={15} /> 记录此刻
              </button>
            </div>
          ) : null}
        </section>

        <section style={{ ...refSoftCardStyle, padding: '17px 18px', background: 'linear-gradient(135deg, rgba(var(--nl-surface-strong-rgb),0.96), rgba(var(--nl-accent-rgb),0.12))', borderColor: 'var(--nl-border)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--nl-primary)', fontSize: 14, fontWeight: 950 }}>
              <Sparkles size={15} />
              今日值得记录
            </span>
            <button type="button" onClick={() => setPromptIndex((current) => current + 1)} style={{ border: '1px solid var(--nl-border)', background: 'rgba(var(--nl-surface-rgb),0.72)', borderRadius: '999px', color: 'var(--nl-muted-strong)', fontSize: 12, fontWeight: 850, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 34, padding: '6px 10px' }}>
              换一条 <ChevronRight size={13} />
            </button>
          </div>
          <p style={{ margin: '0 0 12px', color: 'var(--nl-ink)', fontSize: 14, lineHeight: 1.72, fontWeight: 800 }}>{prompt}</p>
          <button type="button" onClick={() => navigate(activeChild ? '/record/create' : '/onboarding/child?mode=add')} style={{ ...refSecondaryButtonStyle, minHeight: 42, padding: '9px 14px', fontSize: 13, width: '100%', justifyContent: 'flex-start' }}>
            <Edit3 size={14} /> 去记录
          </button>
        </section>

        {anniversaryRecord ? (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h2 style={{ margin: 0, color: 'var(--nl-ink)', fontSize: 18, fontWeight: 950 }}>一年前的今天</h2>
              <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 800 }}>{formatAnniversaryDate(anniversaryRecord.event_time)}</span>
            </div>
            <button type="button" onClick={() => navigate(`/record/${anniversaryRecord.record_no}`)} style={{ ...refSoftCardStyle, width: '100%', padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ position: 'relative', height: 154, background: 'var(--nl-surface-soft)' }}>
                <img src={getCoverUrl(anniversaryRecord) ?? referenceAssets.parkPhoto} alt={anniversaryRecord.title ?? '一年前的成长记录'} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,9,24,0.02), rgba(5,9,24,0.68))' }} />
                <span style={{ position: 'absolute', left: 15, bottom: 13, color: 'var(--nl-ink)', fontSize: 14, fontWeight: 950, textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>{anniversaryRecord.title ?? '一年前的成长记录'}</span>
              </div>
              <div style={{ padding: '14px 16px', display: 'grid', gap: 8 }}>
                <span style={{ color: 'var(--nl-ink)', fontSize: 13, lineHeight: 1.65, fontWeight: 750 }}>{anniversaryRecord.summary ?? '这条真实记录来自一年前的今天。'}</span>
                <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 800 }}>{anniversaryRecord.creator_name} 记录</span>
              </div>
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
};

const searchHistoryKey = 'nianlun.search.history.v1';
const readSearchHistory = () => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(searchHistoryKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 8) : [];
  } catch {
    return [];
  }
};

const writeSearchHistory = (history: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(searchHistoryKey, JSON.stringify(history.slice(0, 8)));
  } catch {
    // Some embedded WebViews can block localStorage writes; search should still work.
  }
};

const uniqueSearchValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));

export const SearchPage = () => {
  const { activeChild } = useAuth();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [history, setHistory] = useState<string[]>(() => readSearchHistory());
  const normalizedKeyword = keyword.trim();
  const { data, loading, error } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({
        child_no: activeChild.child_no,
        page: 1,
        page_size: 50,
        status: 'published',
        keyword: normalizedKeyword || undefined,
      });
      return result.list;
    },
    [activeChild?.child_no, normalizedKeyword],
  );
  const records = data ?? [];
  const hotTags = Array.from(new Set(records.flatMap((record) => record.tags ?? []))).slice(0, 8);
  const resultTags = uniqueSearchValues(records.flatMap((record) => record.tags ?? [])).slice(0, 8);
  const resultLocations = uniqueSearchValues(records.map((record) => record.location_text)).slice(0, 8);
  const commitSearch = (value: string) => {
    const next = value.trim();
    if (!next) return;
    setKeyword(next);
    setHistory((current) => {
      const updated = [next, ...current.filter((item) => item !== next)].slice(0, 8);
      writeSearchHistory(updated);
      return updated;
    });
  };
  const clearSearchHistory = () => {
    setHistory([]);
    writeSearchHistory([]);
  };

  return (
    <div style={refPageStyle}>
      <header style={{ height: 58, padding: 'calc(30px + env(safe-area-inset-top)) 14px 0', borderBottom: '1px solid var(--nl-border)', background: 'rgba(5,9,24,0.9)', backdropFilter: 'blur(18px)', display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) 44px', gap: 8, alignItems: 'center' }}>
        <button type="button" aria-label="返回" onClick={() => navigate(-1)} style={{ border: 'none', background: 'transparent', width: 44, height: 44, display: 'grid', placeItems: 'center', color: 'var(--nl-ink)', cursor: 'pointer' }}>
          <ChevronLeft size={19} />
        </button>
        <label style={{ height: 44, borderRadius: '999px', background: 'rgba(var(--nl-surface-rgb),0.78)', border: '1px solid var(--nl-border)', display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px', color: 'var(--nl-muted)' }}>
          <Search size={15} />
          <input
            aria-label="搜索关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitSearch(keyword);
            }}
            placeholder="搜索时间、地点、标签或内容..."
            style={{ width: '100%', minHeight: 44, border: 'none', outline: 'none', background: 'transparent', color: 'var(--nl-ink)', fontSize: 12, fontWeight: 700 }}
          />
        </label>
        <button type="button" onClick={() => commitSearch(keyword)} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: 'var(--nl-accent)', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>搜索</button>
      </header>
      <main style={{ ...refContentStyle, paddingTop: 18 }}>
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, color: 'var(--nl-ink)', fontSize: 14, fontWeight: 900 }}>搜索历史</h2>
            <button type="button" onClick={clearSearchHistory} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: 'var(--nl-muted)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>清空</button>
          </div>
          {history.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {history.map((item) => (
                <button key={item} type="button" onClick={() => commitSearch(item)} style={{ minHeight: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                  <RefChip>{item}</RefChip>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ ...refMutedTextStyle, margin: 0 }}>最近搜索会保存在本机，方便下次回看同一批成长记录。</p>
          )}
        </section>
        <section>
          <h2 style={{ margin: '0 0 12px', color: 'var(--nl-ink)', fontSize: 14, fontWeight: 900 }}>热门标签</h2>
          {hotTags.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {hotTags.map((item) => (
                <button key={item} type="button" onClick={() => commitSearch(item)} style={{ minHeight: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                  <span style={{ display: 'inline-flex', minHeight: 44, borderRadius: '999px', padding: '10px 14px', alignItems: 'center', color: 'var(--nl-primary-2)', background: 'rgba(var(--nl-primary-rgb),0.16)', border: '1px solid rgba(var(--nl-primary-rgb),0.28)', fontSize: 12, fontWeight: 900 }}>#{item}</span>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ ...refMutedTextStyle, margin: 0 }}>{loading ? '正在整理常用标签…' : '有记录标签后会自动出现在这里。'}</p>
          )}
        </section>
        {normalizedKeyword ? (
          <section style={{ display: 'grid', gap: 10 }}>
            <h2 style={{ margin: '0 0 2px', color: 'var(--nl-ink)', fontSize: 14, fontWeight: 900 }}>搜索结果</h2>
            {loading ? <EmptyState message="正在查找匹配的成长记录…" /> : null}
            {error ? <EmptyState message={`搜索失败：${error}`} /> : null}
            {!loading && !error && records.length ? (
              <>
                <div style={{ display: 'grid', gap: 8 }}>
                  <h3 style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: 12, fontWeight: 900 }}>标签结果</h3>
                  {resultTags.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {resultTags.map((item) => (
                        <button key={item} type="button" onClick={() => commitSearch(item)} style={{ minHeight: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                          <span style={{ display: 'inline-flex', minHeight: 44, borderRadius: '999px', padding: '10px 14px', alignItems: 'center', color: 'var(--nl-primary-2)', background: 'rgba(var(--nl-primary-rgb),0.16)', border: '1px solid rgba(var(--nl-primary-rgb),0.28)', fontSize: 12, fontWeight: 900 }}>#{item}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p style={{ ...refMutedTextStyle, margin: 0 }}>这批记录还没有可继续回看的标签。</p>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <h3 style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: 12, fontWeight: 900 }}>地点结果</h3>
                  {resultLocations.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {resultLocations.map((item) => (
                        <button key={item} type="button" onClick={() => commitSearch(item)} style={{ minHeight: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                          <span style={{ display: 'inline-flex', minHeight: 44, borderRadius: '999px', padding: '10px 14px', alignItems: 'center', gap: 6, color: 'var(--nl-accent)', background: 'rgba(var(--nl-accent-rgb),0.14)', border: '1px solid rgba(var(--nl-accent-rgb),0.24)', fontSize: 12, fontWeight: 900 }}>
                            <MapPin size={13} />
                            {item}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p style={{ ...refMutedTextStyle, margin: 0 }}>这批记录还没有地点信息。</p>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <h3 style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: 12, fontWeight: 900 }}>匹配记录</h3>
                  {records.map((record) => <RecordSummaryCard key={record.record_no} record={record} onClick={() => navigate(`/record/${record.record_no}`)} />)}
                </div>
              </>
            ) : null}
            {!loading && !error && !records.length ? <EmptyState message="没有找到匹配的记录，可以换一个标题、地点或标签继续搜索。" /> : null}
          </section>
        ) : null}
      </main>
    </div>
  );
};

export const TimelinePage = () => {
  const navigate = useNavigate();
  const { activeChild } = useAuth();
  const [filterOpen, setFilterOpen] = useState(false);
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'mixed' | 'video' | 'text' | 'audio' | 'milestone'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
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
  const visibleRecords = typeFilteredRecords;
  const tags = Array.from(new Set(records.flatMap((record) => record.tags ?? [])));
  const activeTypeLabel = filters.find((filter) => filter.value === recordTypeFilter)?.label ?? '全部';
  const hasActiveFilter = recordTypeFilter !== 'all' || Boolean(tagFilter);
  const activeFilterText = `${activeTypeLabel}${tagFilter ? ` / #${tagFilter}` : ''}`;
  const clearFilters = () => {
    setRecordTypeFilter('all');
    setTagFilter(null);
  };
  const visibleYearOptions = Array.from(new Set(visibleRecords.map((record) => getRecordYear(record.event_time)))).sort((a, b) => Number(b) - Number(a));
  const fallbackYear = new Date().getFullYear();
  const yearOptions = Array.from(new Set([...visibleYearOptions, ...Array.from({ length: 4 }, (_, index) => String(fallbackYear - index))])).sort((a, b) => Number(b) - Number(a)).slice(0, 4);
  useEffect(() => {
    const firstYear = visibleYearOptions[0];
    if (firstYear && !visibleYearOptions.includes(selectedYear)) {
      setSelectedYear(firstYear);
    }
  }, [selectedYear, visibleYearOptions]);
  const timelineRecords = visibleRecords.filter((record) => getRecordYear(record.event_time) === selectedYear);
  const showFilterEmptyState = Boolean(activeChild && !loading && !error && hasActiveFilter && visibleRecords.length === 0);
  const showNoRecordsState = Boolean(activeChild && !loading && !error && !hasActiveFilter && records.length === 0);
  return (
    <div style={refPageStyle}>
      <header style={{ position: 'sticky', top: 0, zIndex: 4, background: 'rgba(5,9,24,0.88)', backdropFilter: 'blur(22px)', padding: 'calc(26px + env(safe-area-inset-top)) 20px 10px', borderBottom: filterOpen ? '1px solid var(--nl-border)' : '1px solid transparent', transition: 'border-color 0.18s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div style={{ display: 'grid', gap: 5, minWidth: 0, flex: 1 }}>
            <h1 style={{ margin: 0, color: 'var(--nl-ink)', fontSize: 26, fontWeight: 950, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>成长时间轴</h1>
            <p style={{ margin: 0, color: 'var(--nl-muted)', fontSize: 12, lineHeight: 1.25, fontWeight: 850 }}>记录{activeChild?.name ?? '孩子'}每一个珍贵的第一次</p>
          </div>
          <button type="button" aria-label="筛选记录" aria-pressed={filterOpen} onClick={() => setFilterOpen((current) => !current)} style={{ ...iconButtonStyle, width: 44, height: 44, flexShrink: 0, background: filterOpen || hasActiveFilter ? 'linear-gradient(135deg, var(--nl-primary), var(--nl-primary-2))' : 'rgba(var(--nl-surface-rgb),0.74)', color: filterOpen || hasActiveFilter ? '#ffffff' : 'var(--nl-ink)' }}>
            <SlidersHorizontal size={21} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {yearOptions.map((year) => {
            const active = selectedYear === year;
            return (
              <button key={year} type="button" aria-pressed={active} onClick={() => setSelectedYear(year)} style={{ minWidth: 70, minHeight: 36, border: active ? '1px solid rgba(197,190,255,0.72)' : '1px solid transparent', borderRadius: '999px', background: active ? 'linear-gradient(135deg, var(--nl-primary), var(--nl-primary-2))' : 'transparent', color: active ? '#ffffff' : 'var(--nl-muted)', padding: '6px 12px', fontSize: 13, fontWeight: 950, boxShadow: active ? '0 10px 24px rgba(var(--nl-primary-rgb),0.30), inset 0 1px 0 rgba(255,255,255,0.24)' : 'none', cursor: 'pointer', flexShrink: 0 }}>
                {year}年
              </button>
            );
          })}
        </div>
        {hasActiveFilter && !filterOpen ? (
          <button
            type="button"
            aria-label="清除当前筛选"
            onClick={clearFilters}
            style={{
              minHeight: 34,
              border: '1px solid var(--nl-border)',
              borderRadius: '999px',
              background: 'rgba(var(--nl-surface-rgb),0.72)',
              color: 'var(--nl-muted-strong)',
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
            当前筛选：{activeFilterText}，点击清除
          </button>
        ) : null}
      </header>

      <main style={{ ...refContentStyle, padding: '12px 20px calc(168px + env(safe-area-inset-bottom))', gap: 12 }}>
        {filterOpen ? (
          <div
            style={{
              borderRadius: 26,
              border: '1px solid var(--nl-border)',
              background: 'var(--nl-surface)',
              padding: 15,
              display: 'grid',
              gap: 14,
              boxShadow: 'var(--nl-shadow-sm)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <strong style={{ color: 'var(--nl-ink)', fontSize: 14, fontWeight: 950 }}>筛选记录</strong>
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{ border: 'none', background: 'transparent', color: 'var(--nl-accent)', padding: 0, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  清除
                </button>
              ) : null}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em' }}>记录类型</span>
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
                        border: active ? '1px solid var(--nl-primary)' : '1px solid var(--nl-border)',
                        borderRadius: '999px',
          background: active ? 'linear-gradient(135deg, var(--nl-primary), var(--nl-primary-2))' : 'rgba(var(--nl-surface-rgb),0.72)',
                        color: active ? '#ffffff' : 'var(--nl-ink)',
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 850,
                        cursor: 'pointer',
                        boxShadow: active ? '0 10px 22px rgba(var(--nl-primary-rgb),0.24)' : 'none',
                      }}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em' }}>标签</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tags.length ? tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={tagFilter === tag}
                    onClick={() => setTagFilter((current) => (current === tag ? null : tag))}
                    style={{
                      minHeight: 36,
                      border: tagFilter === tag ? '1px solid var(--nl-accent)' : '1px solid var(--nl-border)',
                      borderRadius: '999px',
                      background: tagFilter === tag ? 'linear-gradient(135deg, var(--nl-primary), var(--nl-primary-2))' : 'rgba(var(--nl-surface-rgb),0.72)',
                      color: tagFilter === tag ? '#ffffff' : 'var(--nl-muted-strong)',
                      padding: '7px 11px',
                      fontSize: 12,
                      fontWeight: 850,
                      cursor: 'pointer',
                    }}
                  >
                    #{tag}
                  </button>
                )) : <span style={{ color: 'var(--nl-muted)', fontSize: 12, fontWeight: 700 }}>当前记录还没有可用标签。</span>}
              </div>
            </div>
          </div>
        ) : null}
        {!activeChild ? <EmptyState message="请先选择孩子，再查看时间轴。" /> : null}
        {loading ? <EmptyState message="正在加载记录列表…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {!loading && !error && activeChild && timelineRecords.length ? (
          <div style={{ display: 'grid', gap: 0, padding: '0 0 18px' }}>
            {timelineRecords.map((record, index) => (
              <TimelineRecordRow
                key={record.record_no}
                record={record}
                index={index}
                ageLabel={formatAgeAtEvent(activeChild.birthday, record.event_time)}
                onClick={() => navigate(`/record/${record.record_no}`)}
              />
            ))}
          </div>
        ) : null}
        {activeChild && !loading && !error && visibleRecords.length > 0 && !timelineRecords.length ? (
          <div style={{ ...refCardStyle, padding: 18, display: 'grid', gap: 12 }}>
            <EmptyState message={`${selectedYear}年还没有记录。`} />
          </div>
        ) : null}
        {showFilterEmptyState ? (
          <div style={{ ...refCardStyle, padding: 18, display: 'grid', gap: 12 }}>
            <EmptyState message={`没有符合「${activeFilterText}」的记录。`} />
            <button type="button" onClick={clearFilters} style={refPrimaryButtonStyle}>清除筛选</button>
          </div>
        ) : null}
        {showNoRecordsState ? (
          <div style={{ ...refCardStyle, padding: 18, display: 'grid', gap: 12 }}>
            <EmptyState message="当前孩子还没有已发布记录。" />
            <button type="button" onClick={() => navigate('/record/create')} style={refPrimaryButtonStyle}>去创建第一条记录</button>
          </div>
        ) : null}
      </main>
    </div>
  );
};
