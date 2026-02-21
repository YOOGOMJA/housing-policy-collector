/** Parser 모듈. */

export type ParsedItem = {
  sourceId: string;
  title: string;
};

export const parse = (sourceIds: string[]): ParsedItem[] => {
  return sourceIds.map((sourceId) => ({
    sourceId,
    title: '샘플 공고',
  }));
};
