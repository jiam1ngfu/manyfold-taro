/**
 * Sharing the round on screen.
 *
 * Two things this file is careful about:
 *
 * 1. It shares the reading it was handed — the one being read right now. There
 *    is no "share my last reading" path anywhere, so a visitor scrolling an old
 *    round can never publish a newer one by accident.
 * 2. A generated link is a frozen snapshot. Changing what goes into it therefore
 *    cannot edit the link already made: toggling the question back in drops the
 *    old link and mints a new one, which is the honest behaviour.
 */

import { useEffect, useState } from 'react';
import type { Locale } from '../../shared/tarot/deck';
import { copyFor } from '../../shared/tarot/i18n';
import type { ReadingView } from '../../shared/tarot/types';
import { createShare, errorText } from './api';

export default function ShareBox({ reading, locale }: { reading: ReadingView; locale: Locale }) {
  const copy = copyFor(locale);
  const [open, setOpen] = useState(false);
  const [includeQuestion, setIncludeQuestion] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // A different round is on screen: nothing from the last one carries over.
  useEffect(() => {
    setOpen(false);
    setUrl('');
    setCopied(false);
    setError('');
  }, [reading.readingId]);

  const make = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { url: link } = await createShare(reading.readingId, includeQuestion);
      setUrl(link);
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2400);
      } catch {
        // No clipboard permission: the link is on screen and selectable instead.
      }
    } catch (caught) {
      setError(errorText(caught, copy.errors.generic));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="taro-primary" onClick={() => setOpen(true)}>
        {copy.outro.share}
      </button>
    );
  }

  return (
    <div className="taro-share">
      <label className="taro-check">
        <input
          type="checkbox"
          checked={includeQuestion}
          onChange={(event) => {
            setIncludeQuestion(event.target.checked);
            setUrl('');
            setCopied(false);
          }}
        />
        <span>{copy.share.includeQuestion}</span>
      </label>

      {url ? (
        <>
          <input
            className="taro-share-url"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
            aria-label={copy.share.copyLink}
          />
          <div className="taro-share-row">
            <button type="button" className="taro-primary" onClick={() => void make()} disabled={busy}>
              {copied ? copy.share.copied : copy.share.copyLink}
            </button>
            <a className="taro-link" href={url} target="_blank" rel="noreferrer">
              {copy.share.openLink}
            </a>
            <button type="button" className="taro-link" onClick={() => setOpen(false)}>
              {copy.share.close}
            </button>
          </div>
        </>
      ) : (
        <div className="taro-share-row">
          <button type="button" className="taro-primary" onClick={() => void make()} disabled={busy}>
            {busy ? copy.outro.sharing : copy.outro.share}
          </button>
          <button type="button" className="taro-link" onClick={() => setOpen(false)}>
            {copy.share.close}
          </button>
        </div>
      )}

      {error && <p className="taro-error">{error}</p>}
    </div>
  );
}
