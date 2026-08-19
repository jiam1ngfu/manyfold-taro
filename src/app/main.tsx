/**
 * Entry point and the whole router.
 *
 *   /          the reading — this is the product, and it is the first paint
 *   /s/:token  one shared reading, frozen
 *   /console   the operator console that ships with the starter: connect an
 *              agent, verify it, chat with it. Not part of the visitor's path.
 *
 * Path-based rather than hash-based because a share link has to look like a
 * link; the Worker serves index.html for unknown paths (single-page-application
 * asset handling in wrangler.jsonc), so these resolve on a cold load too.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import SharePage from './tarot/SharePage';
import TarotApp from './tarot/TarotApp';
import './styles.css';
import './tarot/tarot.css';

const path = location.pathname;
const isConsole = path === '/console' || path.startsWith('/console/');
const isShare = path.startsWith('/s/');

// Lets the tarot stylesheet own the page background without touching the
// console's own :root theme.
if (!isConsole) document.documentElement.dataset.app = 'taro';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isConsole ? <App /> : isShare ? <SharePage /> : <TarotApp />}</StrictMode>,
);
