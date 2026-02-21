/** Notifier 모듈. */

import type { MatchedItem } from '../matcher/index.js';

export const notify = (matchedItems: MatchedItem[]): number => {
  return matchedItems.length;
};
