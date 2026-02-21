/** Matcher 모듈. */

import type { ParsedItem } from '../parser/index.js';

export type MatchedItem = ParsedItem;

export const match = (parsedItems: ParsedItem[]): MatchedItem[] => {
  return parsedItems;
};
