/** Storage 모듈. */

import type { MatchedItem } from '../matcher/index.js';

export const save = (items: MatchedItem[]): number => {
  return items.length;
};
