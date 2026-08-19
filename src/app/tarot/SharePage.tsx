/**
 * A shared reading, at /s/:token.
 *
 * Everything on this page comes out of the snapshot row, which was written once
 * and is never updated. Nothing here fetches the reading it came from, so a page
 * opened today shows exactly what was shared, whatever has happened to that
 * round since.
 *
 * No session, no ownership: a share link is meant to be opened by anyone, which
 * is also why the snapshot carries so little — three cards, their positions and
 * orientations, one sentence, and the signature.
 */

import { useEffect, useState } from 'react';
import { copyFor, normalizeLocale } from '../../shared/tarot/i18n';
import type { ShareSnapshot } from '../../shared/tarot/types';
import CardSlot from './Card';
import { fetchShare } from './api';

const tokenFromPath = (): string => decodeURIComponent(location.pathname.replace(/^\/s\//, ''));

export default function SharePage() {
  const [snapshot, setSnapshot] = useState<ShareSnapshot | null>(null);
  const [missing, setMissing] = useState(false);
  const locale = snapshot ? snapshot.locale : normalizeLocale(navigator.language);
  const copy = copyFor(locale);

  useEffect(() => {
    void fetchShare(tokenFromPath())
      .then(({ share }) => setSnapshot(share))
      .catch(() => setMissing(true));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : 'en';
    document.title = `${copy.share.viewTitle} · ${copy.brand}`;
  }, [locale, copy]);

  if (missing) {
    return (
      <div className="taro">
        <main className="taro-stage">
          <p className="taro-error">{copy.share.notFound}</p>
          <a className="taro-primary" href="/">
            {copy.share.startYours}
          </a>
        </main>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="taro">
        <main className="taro-stage">
          <p className="taro-instruction">…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="taro">
      <main className="taro-stage taro-shared">
        <h1 className="taro-shared-title">{copy.share.viewTitle}</h1>

        {snapshot.question && (
          <p className="taro-asked">
            <span className="taro-asked-label">{copy.share.viewQuestion}</span>
            {snapshot.question}
          </p>
        )}

        <div className="taro-cards">
          {snapshot.cards.map((card, index) => (
            <CardSlot
              key={card.slot}
              slot={card.slot}
              locale={locale}
              card={{
                slot: card.slot,
                index,
                cardId: card.cardId,
                reversed: card.reversed,
                hint: '',
              }}
            />
          ))}
        </div>

        <p className="taro-conclusion">{snapshot.conclusion}</p>

        <footer className="taro-foot">
          <p className="taro-signature">{snapshot.signature}</p>
          <p className="taro-frozen">{copy.share.frozen}</p>
          <a className="taro-primary" href="/">
            {copy.share.startYours}
          </a>
        </footer>
      </main>
    </div>
  );
}
