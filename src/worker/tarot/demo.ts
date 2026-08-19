/**
 * The built-in demo reader.
 *
 * Agent 2 is a separate agent on a separate schedule. Until it is connected —
 * and in local dev, and in any deploy whose agent later goes away — the site
 * still has to run end to end, or there is nothing to demo and nothing to test
 * against. So this module answers in the diviner's voice using the deck's own
 * keywords and the question's own words.
 *
 * It writes through the SAME tagged protocol as a real agent, so the parser,
 * the streaming path and the UI are exercised identically. What it deliberately
 * does NOT do is pretend to be Agent 2: every response it produces is flagged
 * `demo: true` all the way to the browser, which shows a notice.
 */

import { cardById, cardLabel, cardKeywords, type Locale } from '../../shared/tarot/deck';
import { copyFor } from '../../shared/tarot/i18n';
import { NEW_READING_MARKER } from './prompt';
import type { DrawnCard } from './draw';

const slotTitle = (slot: DrawnCard['slot'], locale: Locale) => copyFor(locale).slots[slot].title;

const label = (card: DrawnCard, locale: Locale): string => {
  const deckCard = cardById(card.cardId);
  return deckCard ? cardLabel(deckCard, card.reversed, locale) : card.cardId;
};

const keywords = (card: DrawnCard, locale: Locale): string => {
  const deckCard = cardById(card.cardId);
  return deckCard ? cardKeywords(deckCard, card.reversed, locale) : '';
};

/** A short, neutral echo of the question — never the whole thing, per the spec. */
function questionEcho(question: string, locale: Locale): string {
  const compact = question.replace(/\s+/g, ' ').trim();
  const limit = locale === 'zh' ? 18 : 60;
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit)}${locale === 'zh' ? '……' : '…'}`;
}

export function demoGreeting(question: string, locale: Locale): string {
  const echo = questionEcho(question, locale);
  if (locale === 'zh') {
    return [
      `你问的是「${echo}」——我听见的，是你已经在心里翻来覆去想了很久的那一件事。`,
      '让我为你抽三张牌，看看此刻的处境、隐藏的影响，以及牌面给你的指引。',
    ].join('');
  }
  return [
    `You are asking about “${echo}” — and what I hear underneath it is something you have already turned over many times.`,
    ' Let me draw three cards for you: where you stand, what is working out of sight, and what the cards point you toward.',
  ].join('');
}

export function demoHint(card: DrawnCard, locale: Locale): string {
  const name = label(card, locale);
  const meaning = keywords(card, locale);
  if (locale === 'zh') {
    return `${name}。在「${slotTitle(card.slot, locale)}」这个位置上，它说的是：${meaning}。`;
  }
  return `${name}. In the position of "${slotTitle(card.slot, locale)}", it speaks of ${meaning}.`;
}

/**
 * A full reading in the tagged format. Composed rather than templated word for
 * word: each section is built from the actual cards drawn, so two demo readings
 * never read the same.
 */
export function demoReading(question: string, cards: DrawnCard[], locale: Locale): string {
  const [first, second, third] = cards;
  const echo = questionEcho(question, locale);
  const names = cards.map((card) => label(card, locale));
  const meanings = cards.map((card) => keywords(card, locale));

  if (locale === 'zh') {
    return [
      '[CONCLUSION]',
      `牌面的回答是：这件事还没有定论，但主动权比你以为的更多地在你手里。${names[2]}落在「${slotTitle(third.slot, locale)}」，指的是一个你已经隐约知道、却还没有开始做的动作。`,
      '[OVERVIEW]',
      `三张牌是${names[0]}、${names[1]}、${names[2]}。它们连起来讲的是一个从停滞走向选择的过程：你所处的位置已经清楚，真正没被看清的是中间那一层，而出路指向具体的行动而不是继续等待。`,
      '[CARD1]',
      `${names[0]}落在「${slotTitle(first.slot, locale)}」。${meanings[0]}。这说明你现在的处境并不是凭空而来，它是你过去一段时间里做过的选择累积出来的结果。你对「${echo}」的焦虑，多半来自于你其实已经感觉到了变化，只是还没有承认它。`,
      '[CARD2]',
      `${names[1]}落在「${slotTitle(second.slot, locale)}」。${meanings[1]}。这一层是你看得最不清楚的地方——它可能是某个人的态度，也可能是你自己一直不愿意深究的动机。它一直在影响事情的走向，只是没有被放到台面上。`,
      '[CARD3]',
      `${names[2]}落在「${slotTitle(third.slot, locale)}」。${meanings[2]}。这张牌不是在预告结果，而是在告诉你，从现在起哪一种姿态最有可能把局面往你想要的方向推。`,
      '[CONNECTIONS]',
      `把三张牌放在一起看，${names[0]}描述的处境之所以卡住，正是因为${names[1]}那一层没有被说破；而${names[2]}给出的方向，恰好需要你先面对第二张牌指出的东西才走得通。换句话说，指引不是绕过隐藏的影响，而是穿过它。`,
      '[RESPONSE]',
      `回到你的问题：牌面并不认为你需要一个更完美的判断，它认为你需要一个更明确的动作。你已经掌握了足够的信息，缺的是把信息变成决定的那一步。你担心的那个最坏结果，在这组牌里没有出现。`,
      '[ACTIONS]',
      '- 把你最不愿意问出口的那个问题，直接问出来，向那个真正能给你答案的人。',
      '- 给自己设一个明确的期限，在期限之前不反复推翻已经做过的判断。',
      '- 写下你目前掌握的事实和你自己的推测，分成两栏，你会看见它们的比例。',
      '[REFLECTION]',
      '如果这件事下个月就已经有了结果，你希望回头看时，自己现在做了什么？',
      '[CLOSING]',
      '牌只是把你已经知道的东西摆到了光下。剩下的部分，一直都在你这边。',
    ].join('\n');
  }

  return [
    '[CONCLUSION]',
    `The cards answer this way: nothing here is settled, and more of it sits in your hands than you think. ${names[2]} in "${slotTitle(third.slot, locale)}" points at a move you already half know and have not yet made.`,
    '[OVERVIEW]',
    `The three cards are ${names[0]}, ${names[1]} and ${names[2]}. Together they describe a passage out of stalling and into choosing: where you stand is already clear, the middle layer is what you have not seen, and the way through is an action rather than more waiting.`,
    '[CARD1]',
    `${names[0]} lands in "${slotTitle(first.slot, locale)}". ${meanings[0]}. Your situation did not appear out of nowhere — it is the accumulation of choices you made over the last stretch. The unease you feel about “${echo}” most likely comes from having already sensed the shift without admitting it yet.`,
    '[CARD2]',
    `${names[1]} lands in "${slotTitle(second.slot, locale)}". ${meanings[1]}. This is the layer you can see least clearly. It may be someone's real position, or a motive of your own you have avoided examining. It has been steering things the whole time without being named.`,
    '[CARD3]',
    `${names[2]} lands in "${slotTitle(third.slot, locale)}". ${meanings[2]}. This card does not announce an outcome — it tells you which stance, from here, is most likely to move things the way you want.`,
    '[CONNECTIONS]',
    `Read together: the situation in ${names[0]} is stuck precisely because the layer shown by ${names[1]} has never been said out loud, and the direction offered by ${names[2]} only works once you face what the second card names. The guidance does not route around the hidden influence — it goes through it.`,
    '[RESPONSE]',
    'Back to your question: the cards do not think you need a better judgement, they think you need a clearer move. You already hold enough information; what is missing is the step that turns information into a decision. The worst outcome you have been carrying does not appear in this spread.',
    '[ACTIONS]',
    '- Ask the question you least want to ask, directly, of the person who can actually answer it.',
    '- Set yourself a real deadline, and stop relitigating settled judgements before it arrives.',
    '- Write what you know and what you are assuming in two columns — the ratio will tell you something.',
    '[REFLECTION]',
    'If this were already resolved a month from now, what would you want to find that you had done today?',
    '[CLOSING]',
    'The cards only set what you already knew into the light. The rest of it was always yours.',
  ].join('\n');
}

export function demoFollowUp(followUp: string, cards: DrawnCard[], locale: Locale): string {
  const names = cards.map((card) => label(card, locale));
  const asked = questionEcho(followUp, locale);
  // The demo reader flags a new round on the same signals a real one would: the
  // follow-up names a different subject rather than a card on the table.
  const newTopic = /^(那|另外|还有|再问|如果我|我还想问|what about|another|also,? what)/i.test(
    followUp.trim(),
  );
  if (locale === 'zh') {
    const body = [
      `关于「${asked}」——留在这三张牌里看的话，${names[1]}是最值得停一停的那张。它落在「隐藏的影响」上，说明你问的这个点，答案多半不在你正盯着的地方。`,
      `${names[0]}给出的是你现在的位置，而${names[2]}给出的是方向。你问的这件事，其实是在问这两者之间的距离要怎么走。牌面的意思是：这段距离不需要一次跨完。`,
      '如果你希望我再具体一点，可以告诉我你最在意的是哪一张牌，或者哪一句话让你不太确定。',
    ].join('\n\n');
    return newTopic ? `${body}\n\n[[${NEW_READING_MARKER}]]` : body;
  }
  const body = [
    `About “${asked}” — staying inside these three cards, ${names[1]} is the one worth pausing on. It sits in the hidden influence, which suggests the answer to what you are asking is not where you have been looking.`,
    `${names[0]} gives your current position and ${names[2]} gives the direction. What you are really asking is how to cross the distance between them, and the spread says you do not have to cross it in one step.`,
    'If you want me to go further, tell me which card you keep returning to, or which line left you unsure.',
  ].join('\n\n');
  return newTopic ? `${body}\n\n[[${NEW_READING_MARKER}]]` : body;
}
