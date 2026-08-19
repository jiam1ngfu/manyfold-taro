/**
 * The full reading: eight sections, always in this order, never relabelled as
 * machine output.
 *
 *   1 直接结论 · 2 三张牌概览 · 3 每张牌在牌位上的解释 · 4 三张牌之间的联系
 *   5 对问题的综合回应 · 6 现实行动建议 · 7 一个反思问题 · 8 收尾语
 *
 * The order lives here, in one array-free explicit sequence, so that a section
 * cannot quietly go missing or swap places: whatever the reader sends back is
 * poured into this shape.
 */

import { cardById, type Locale } from '../../shared/tarot/deck';
import { copyFor } from '../../shared/tarot/i18n';
import type { DrawnCardView, Interpretation, SlotId } from '../../shared/tarot/types';

/** Renders reader prose: blank lines become paragraphs, nothing else is parsed. */
export function Prose({ text, className }: { text: string; className?: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return null;
  return (
    <div className={className ? `taro-prose ${className}` : 'taro-prose'}>
      {paragraphs.map((block, index) => (
        <p key={index}>
          {block.split('\n').map((line, lineIndex, lines) => (
            <span key={lineIndex}>
              {line}
              {lineIndex < lines.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

export interface ReadingProps {
  interpretation: Interpretation;
  cards: DrawnCardView[];
  locale: Locale;
}

export default function Reading({ interpretation, cards, locale }: ReadingProps) {
  const copy = copyFor(locale);
  const bySlot = new Map<SlotId, DrawnCardView>(cards.map((card) => [card.slot, card]));

  const cardLine = (slot: SlotId): string => {
    const drawn = bySlot.get(slot);
    const entry = drawn ? cardById(drawn.cardId) : null;
    if (!drawn || !entry) return copy.slots[slot].title;
    const orientation = drawn.reversed ? copy.reveal.reversed : copy.reveal.upright;
    return `${entry.name[locale]} · ${orientation}`;
  };

  return (
    <article className="taro-reading">
      <h2 className="taro-reading-title">{copy.result.title}</h2>

      {/* 1 — the answer, before anything else */}
      <Prose text={interpretation.conclusion} className="taro-conclusion" />

      {/* 2 */}
      <section className="taro-section">
        <h3>{copy.result.overview}</h3>
        <Prose text={interpretation.overview} />
      </section>

      {/* 3 — one per card, in reveal order */}
      {interpretation.perCard.map((entry) => (
        <section className="taro-section" key={entry.slot}>
          <h3>
            {copy.slots[entry.slot].title}
            <span className="taro-section-card">{cardLine(entry.slot)}</span>
          </h3>
          <Prose text={entry.text} />
        </section>
      ))}

      {/* 4 */}
      <section className="taro-section">
        <h3>{copy.result.connections}</h3>
        <Prose text={interpretation.connections} />
      </section>

      {/* 5 */}
      <section className="taro-section">
        <h3>{copy.result.response}</h3>
        <Prose text={interpretation.response} />
      </section>

      {/* 6 */}
      {interpretation.actions.length > 0 && (
        <section className="taro-section">
          <h3>{copy.result.actions}</h3>
          <ol className="taro-actions">
            {interpretation.actions.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ol>
        </section>
      )}

      {/* 7 */}
      {interpretation.reflection.trim() && (
        <section className="taro-section taro-reflection">
          <h3>{copy.result.reflection}</h3>
          <Prose text={interpretation.reflection} />
        </section>
      )}

      {/* 8 */}
      {interpretation.closing.trim() && (
        <Prose text={interpretation.closing} className="taro-closing" />
      )}
    </article>
  );
}
