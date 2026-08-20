/**
 * The 78-card deck, bilingual (zh-Hans / en).
 *
 * Shared because both sides need it: the Worker draws from it and builds the
 * diviner's prompt out of it, the browser renders names and art from it.
 * Pure data plus pure lookups — no imports, no side effects.
 *
 * Major arcana are written out by hand. Minor arcana are composed from a suit
 * table (domain) crossed with a rank table (movement), which is how the minors
 * are read anyway, and keeps 56 entries honest instead of 56 entries of filler.
 *
 * The keyword lines here are NOT the reading. They are the deterministic
 * fallback used when the diviner is unreachable, and the vocabulary handed to
 * the diviner as context. The actual interpretation always comes from Agent 2.
 */

export type Locale = 'zh' | 'en';

export const LOCALES: readonly Locale[] = ['zh', 'en'] as const;

export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';

export interface Localized {
  zh: string;
  en: string;
}

export interface TarotCard {
  /** Stable id, e.g. `major-00`, `cups-03`, `swords-king`. Stored in D1. */
  id: string;
  arcana: 'major' | 'minor';
  suit?: Suit;
  /** 0–21 for majors, 1–14 for minors (11=Page … 14=King). */
  number: number;
  name: Localized;
  /** Roman numeral for majors, rank mark for minors. Printed on the art too. */
  mark: string;
  upright: Localized;
  reversed: Localized;
}

/* ───────── major arcana ───────── */

const ROMAN = [
  '0',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX',
  'XXI',
];

interface MajorSeed {
  zh: string;
  en: string;
  uz: string;
  ue: string;
  rz: string;
  re: string;
}

const MAJOR_SEEDS: MajorSeed[] = [
  {
    zh: '愚人',
    en: 'The Fool',
    uz: '起步、天真、纵身一跃',
    ue: 'beginnings, innocence, a leap taken on faith',
    rz: '鲁莽、准备不足、逃避承担',
    re: 'recklessness, stepping off before looking, avoidance',
  },
  {
    zh: '魔术师',
    en: 'The Magician',
    uz: '资源齐备、意志集中、开始行动',
    ue: 'resources at hand, focused will, making it happen',
    rz: '手段散乱、说服过头、能力被浪费',
    re: 'scattered effort, manipulation, talent left idle',
  },
  {
    zh: '女祭司',
    en: 'The High Priestess',
    uz: '直觉、尚未说出口的知晓、静观',
    ue: 'intuition, knowledge not yet spoken, watching',
    rz: '忽视内在声音、信息被隐瞒、过度封闭',
    re: 'ignoring the inner voice, withheld information, shutting down',
  },
  {
    zh: '女皇',
    en: 'The Empress',
    uz: '滋养、丰盛、让事情自然生长',
    ue: 'nurture, abundance, letting things grow',
    rz: '过度付出、依赖、创造力停滞',
    re: 'over-giving, dependence, creativity stalled',
  },
  {
    zh: '皇帝',
    en: 'The Emperor',
    uz: '秩序、边界、承担责任',
    ue: 'structure, boundaries, taking responsibility',
    rz: '控制过度、僵硬、权威带来的压迫',
    re: 'over-control, rigidity, authority that presses down',
  },
  {
    zh: '教皇',
    en: 'The Hierophant',
    uz: '传承、规则、向有经验者学习',
    ue: 'tradition, shared rules, learning from someone experienced',
    rz: '因循守旧、被规范束缚、需要自己的解法',
    re: 'convention for its own sake, constraint, needing your own answer',
  },
  {
    zh: '恋人',
    en: 'The Lovers',
    uz: '关系、共鸣、需要做出选择',
    ue: 'connection, resonance, a choice that must be made',
    rz: '价值不一致、犹疑、关系失衡',
    re: 'misaligned values, hesitation, imbalance',
  },
  {
    zh: '战车',
    en: 'The Chariot',
    uz: '前进、掌控方向、以意志推动',
    ue: 'forward motion, holding the reins, will in charge',
    rz: '方向不明、内耗、用力过猛',
    re: 'no clear direction, friction within, forcing it',
  },
  {
    zh: '力量',
    en: 'Strength',
    uz: '柔韧的勇气、与情绪共处、耐心',
    ue: 'soft courage, sitting with feeling, patience',
    rz: '自我怀疑、情绪压过判断、勉强撑住',
    re: 'self-doubt, feeling running the show, white-knuckling it',
  },
  {
    zh: '隐者',
    en: 'The Hermit',
    uz: '独处、向内寻找、慢下来看清',
    ue: 'solitude, looking inward, slowing down to see',
    rz: '孤立、拖延面对、拒绝支持',
    re: 'isolation, postponing the reckoning, refusing help',
  },
  {
    zh: '命运之轮',
    en: 'Wheel of Fortune',
    uz: '转折、时机到来、顺势而变',
    ue: 'a turn, timing arriving, moving with the shift',
    rz: '抗拒变化、错过窗口、循环重演',
    re: 'resisting change, a window missed, the same loop again',
  },
  {
    zh: '正义',
    en: 'Justice',
    uz: '权衡、如实面对、后果分明',
    ue: 'weighing, seeing it as it is, consequences that land',
    rz: '偏颇、回避责任、判断被情绪染色',
    re: 'bias, dodging accountability, judgment tinted by feeling',
  },
  {
    zh: '倒吊人',
    en: 'The Hanged Man',
    uz: '暂停、换个角度、主动等待',
    ue: 'pause, a reversed angle, waiting on purpose',
    rz: '停滞、无谓牺牲、拖着不决定',
    re: 'stagnation, pointless sacrifice, deciding not to decide',
  },
  {
    zh: '死神',
    en: 'Death',
    uz: '结束、让旧的离开、彻底的转化',
    ue: 'an ending, letting the old go, real transformation',
    rz: '拒绝告别、卡在过渡期、旧模式续命',
    re: 'refusing the goodbye, stuck mid-transition, old patterns on life support',
  },
  {
    zh: '节制',
    en: 'Temperance',
    uz: '调和、找到比例、慢火细炖',
    ue: 'blending, finding the proportion, a slow simmer',
    rz: '失衡、极端、耐心用尽',
    re: 'imbalance, extremes, patience run out',
  },
  {
    zh: '恶魔',
    en: 'The Devil',
    uz: '束缚、欲望、看清自己被什么绑住',
    ue: 'bonds, appetite, seeing what has hold of you',
    rz: '松动、开始挣脱、承认代价',
    re: 'the grip loosening, breaking away, naming the cost',
  },
  {
    zh: '高塔',
    en: 'The Tower',
    uz: '突变、结构崩解、真相冲破表面',
    ue: 'sudden change, a structure giving way, truth breaking through',
    rz: '延迟的崩塌、勉强修补、恐惧变动',
    re: 'a collapse deferred, patching what should fall, fear of upheaval',
  },
  {
    zh: '星星',
    en: 'The Star',
    uz: '希望、疗愈、重新相信',
    ue: 'hope, healing, believing again',
    rz: '信心动摇、疲惫、看不见出口',
    re: 'faith wavering, depletion, no exit in sight',
  },
  {
    zh: '月亮',
    en: 'The Moon',
    uz: '不确定、潜意识、雾中前行',
    ue: 'uncertainty, the underneath, walking through fog',
    rz: '迷雾散去、误会澄清、恐惧被看穿',
    re: 'the fog lifting, a misreading cleared, fear seen for what it is',
  },
  {
    zh: '太阳',
    en: 'The Sun',
    uz: '清晰、生命力、事情摊在光下',
    ue: 'clarity, vitality, everything in plain light',
    rz: '光被遮住、乐观勉强、延迟的好消息',
    re: 'light obscured, forced optimism, good news delayed',
  },
  {
    zh: '审判',
    en: 'Judgement',
    uz: '召唤、清算过去、做出回应',
    ue: 'a call, reckoning with the past, answering it',
    rz: '自我苛责、听不见召唤、悬而未决',
    re: 'self-reproach, the call unheard, left unresolved',
  },
  {
    zh: '世界',
    en: 'The World',
    uz: '完成、整合、一个阶段圆满',
    ue: 'completion, integration, a chapter whole',
    rz: '差最后一步、收尾未竟、迟迟不肯结束',
    re: 'one step short, loose ends, refusing to close it',
  },
];

/* ───────── minor arcana ───────── */

interface SuitSeed {
  zh: string;
  en: string;
  /** The life domain the suit speaks about. */
  domainZh: string;
  domainEn: string;
}

const SUITS: Record<Suit, SuitSeed> = {
  wands: { zh: '权杖', en: 'Wands', domainZh: '行动与热情', domainEn: 'action and drive' },
  cups: { zh: '圣杯', en: 'Cups', domainZh: '情感与关系', domainEn: 'feeling and relationship' },
  swords: { zh: '宝剑', en: 'Swords', domainZh: '思绪与真相', domainEn: 'thought and truth' },
  pentacles: {
    zh: '星币',
    en: 'Pentacles',
    domainZh: '现实与资源',
    domainEn: 'material life and resources',
  },
};

export const SUIT_ORDER: readonly Suit[] = ['wands', 'cups', 'swords', 'pentacles'] as const;

interface RankSeed {
  n: number;
  zh: string;
  en: string;
  mark: string;
  uz: string;
  ue: string;
  rz: string;
  re: string;
}

const RANKS: RankSeed[] = [
  {
    n: 1,
    zh: '一',
    en: 'Ace',
    mark: 'A',
    uz: '一个全新的开端正在出现',
    ue: 'a fresh opening is presenting itself',
    rz: '开端被耽搁，机会还没被接住',
    re: 'the opening is delayed, the offer not yet taken',
  },
  {
    n: 2,
    zh: '二',
    en: 'Two',
    mark: 'II',
    uz: '两股力量需要被放到一起权衡',
    ue: 'two forces are asking to be weighed together',
    rz: '取舍被拖延，平衡还没找到',
    re: 'the choice is postponed, the balance not yet found',
  },
  {
    n: 3,
    zh: '三',
    en: 'Three',
    mark: 'III',
    uz: '最初的成果已经可以看见',
    ue: 'the first results are visible',
    rz: '进展慢于预期，配合出了偏差',
    re: 'progress lags, the collaboration is off',
  },
  {
    n: 4,
    zh: '四',
    en: 'Four',
    mark: 'IV',
    uz: '稳定下来，把已有的守住',
    ue: 'settling, holding what is already there',
    rz: '安稳变成停滞，抓得太紧',
    re: 'stability turned stagnant, holding on too tight',
  },
  {
    n: 5,
    zh: '五',
    en: 'Five',
    mark: 'V',
    uz: '出现冲突与失衡，需要重新对齐',
    ue: 'conflict and imbalance, asking to be realigned',
    rz: '争执渐息，损耗开始被修复',
    re: 'the dispute settling, the damage starting to mend',
  },
  {
    n: 6,
    zh: '六',
    en: 'Six',
    mark: 'VI',
    uz: '交流与给予让局面重新流动',
    ue: 'exchange and giving get things moving again',
    rz: '付出与回报不对等，流动被卡住',
    re: 'give and take out of proportion, the flow blocked',
  },
  {
    n: 7,
    zh: '七',
    en: 'Seven',
    mark: 'VII',
    uz: '需要评估，并决定坚持什么',
    ue: 'a moment to assess and decide what to hold',
    rz: '摇摆不定，标准还没立起来',
    re: 'wavering, no standard set yet',
  },
  {
    n: 8,
    zh: '八',
    en: 'Eight',
    mark: 'VIII',
    uz: '投入加速，事情开始快速推进',
    ue: 'commitment accelerating, things moving fast',
    rz: '节奏失控，方向没有跟上速度',
    re: 'pace out of hand, direction not keeping up with speed',
  },
  {
    n: 9,
    zh: '九',
    en: 'Nine',
    mark: 'IX',
    uz: '接近完成，只差最后的坚持',
    ue: 'near completion, one last stretch',
    rz: '独自硬撑，防备心过重',
    re: 'carrying it alone, guard held too high',
  },
  {
    n: 10,
    zh: '十',
    en: 'Ten',
    mark: 'X',
    uz: '一个循环走到尽头，圆满或负荷已满',
    ue: 'a cycle at its end, complete or fully loaded',
    rz: '负担该被卸下，结局需要重新定义',
    re: 'a load ready to be set down, an ending to redefine',
  },
  {
    n: 11,
    zh: '侍从',
    en: 'Page',
    mark: 'P',
    uz: '带着好奇去试，允许自己是新手',
    ue: 'trying with curiosity, allowed to be a beginner',
    rz: '三心二意，学习停在表面',
    re: 'half-hearted, learning left on the surface',
  },
  {
    n: 12,
    zh: '骑士',
    en: 'Knight',
    mark: 'N',
    uz: '主动出击，为目标全力奔赴',
    ue: 'taking the initiative, going all in',
    rz: '冲动或迟疑，行动没有落到点上',
    re: 'impulsive or stalled, action not landing',
  },
  {
    n: 13,
    zh: '皇后',
    en: 'Queen',
    mark: 'Q',
    uz: '以涵容与体察去处理，照顾到人',
    ue: 'holding it with care, attending to people',
    rz: '情绪耗竭，界线被模糊',
    re: 'emotionally spent, boundaries blurred',
  },
  {
    n: 14,
    zh: '国王',
    en: 'King',
    mark: 'K',
    uz: '成熟地掌控全局，为结果负责',
    ue: 'mature command, owning the outcome',
    rz: '强势或缺席，掌控变成压制',
    re: 'domineering or absent, command turned into pressure',
  },
];

function minorName(suit: Suit, rank: RankSeed): Localized {
  const s = SUITS[suit];
  return {
    // 权杖三 / 权杖侍从 — the Chinese convention is suit first, no connector.
    zh: `${s.zh}${rank.zh}`,
    en: `${rank.en} of ${s.en}`,
  };
}

function buildDeck(): TarotCard[] {
  const cards: TarotCard[] = MAJOR_SEEDS.map((seed, index) => ({
    id: `major-${String(index).padStart(2, '0')}`,
    arcana: 'major' as const,
    number: index,
    name: { zh: seed.zh, en: seed.en },
    mark: ROMAN[index],
    upright: { zh: seed.uz, en: seed.ue },
    reversed: { zh: seed.rz, en: seed.re },
  }));

  for (const suit of SUIT_ORDER) {
    const domain = SUITS[suit];
    for (const rank of RANKS) {
      cards.push({
        id: `${suit}-${String(rank.n).padStart(2, '0')}`,
        arcana: 'minor',
        suit,
        number: rank.n,
        name: minorName(suit, rank),
        mark: rank.mark,
        upright: {
          zh: `${domain.domainZh}上，${rank.uz}`,
          en: `In ${domain.domainEn}, ${rank.ue}`,
        },
        reversed: {
          zh: `${domain.domainZh}上，${rank.rz}`,
          en: `In ${domain.domainEn}, ${rank.re}`,
        },
      });
    }
  }
  return cards;
}

export const DECK: readonly TarotCard[] = Object.freeze(buildDeck());

export const DECK_SIZE = DECK.length;

const BY_ID = new Map(DECK.map((card) => [card.id, card]));

export function cardById(id: string): TarotCard | null {
  return BY_ID.get(id) ?? null;
}

/* ───────── the art ─────────

   78 faces and one back, served as static assets from `public/cards/`. Each
   file is named for the id above, so the deck is its own index and there is no
   second table to keep in step — a card cannot point at another card's picture.
   `tests/tarot-art.test.ts` holds the other half of that bargain: every id has
   a file, and every file has an id.

   The name and the numeral are printed on the art itself, in English. The
   localized name lives in the caption under the card, not on it. */

/** Where a card's picture is. Absolute, because it is served, not bundled. */
export function cardArt(id: string): string {
  return `/cards/${id}.webp`;
}

/** The one back. Every face-down card in the site is this image. */
export const CARD_BACK_ART = '/cards/back.webp';

/** Localized card name plus orientation, e.g. `月亮（逆位）` / `The Moon (reversed)`. */
export function cardLabel(card: TarotCard, reversed: boolean, locale: Locale): string {
  const name = card.name[locale];
  if (locale === 'zh') return `${name}（${reversed ? '逆位' : '正位'}）`;
  return `${name} (${reversed ? 'reversed' : 'upright'})`;
}

/** The keyword line for the drawn orientation — the diviner's raw material. */
export function cardKeywords(card: TarotCard, reversed: boolean, locale: Locale): string {
  return (reversed ? card.reversed : card.upright)[locale];
}
