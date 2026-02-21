/** Collector 모듈. */

export type SourceOrg = 'SH' | 'LH';

const SH_POC_BOARD_URL =
  'https://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/brd/m_247/list.do?multi_itm_seq=0';
const LH_POC_BOARD_URL =
  'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026';
const DEFAULT_RECENT_LIMIT = 10;
const REQUEST_TIMEOUT_MS = 10_000;

export type CollectorFailureCode =
  | 'NETWORK_ERROR'
  | 'BAD_STATUS_CODE'
  | 'PARSE_ERROR';

export type CollectorErrorMeta = {
  code: CollectorFailureCode;
  message: string;
  targetUrl: string;
  status?: number;
};

export type CollectedAnnouncement = {
  source_org: SourceOrg;
  announcement_id: string;
  title: string;
  detail_url: string;
  posted_at: string;
};

/** 후속 모듈(파서/매처/저장소) 공통 입력 타입. */
export type DownstreamAnnouncementInput = Pick<
  CollectedAnnouncement,
  'announcement_id' | 'title' | 'detail_url' | 'posted_at' | 'source_org'
>;

export type OrgCollectResult = {
  source_org: SourceOrg;
  source_url: string;
  requested_limit: number;
  items: CollectedAnnouncement[];
  error: CollectorErrorMeta | null;
};

export type CollectResult = {
  requested_limit: number;
  items: CollectedAnnouncement[];
  by_org: Record<SourceOrg, OrgCollectResult>;
  has_partial_failure: boolean;
};

export type CollectOptions = {
  recentLimit?: number;
};

const stripHtml = (value: string): string => {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractNoticeNumber = (value: string): string => {
  const match = value.match(/(\d{4})\s*[-./년]\s*(\d{1,4})(?!\d)/);

  if (match === null) {
    return 'UNKNOWN';
  }

  return `${match[1]}-${match[2]}`;
};

const extractRecruitRound = (value: string): string => {
  const roundMatch = value.match(/(\d+)\s*차/);
  return roundMatch?.[1] ?? '1';
};

/** SH announcement_id 규칙: SH-{공고번호(YYYY-NNN)}-{차수}. */
const buildShAnnouncementId = (rawText: string): string => {
  const noticeNumber = extractNoticeNumber(rawText);
  const recruitRound = extractRecruitRound(rawText);
  return `SH-${noticeNumber}-${recruitRound}`;
};

/** LH announcement_id 규칙: LH-{공고번호(YYYY-NNN)}-{행순번(2자리)}. */
const buildLhAnnouncementId = (rawText: string, rowIndex: number): string => {
  const noticeNumber = extractNoticeNumber(rawText);
  return `LH-${noticeNumber}-${String(rowIndex + 1).padStart(2, '0')}`;
};

const normalizeDetailUrl = (href: string, baseUrl: string): string => {
  if (href.length === 0) {
    return baseUrl;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return baseUrl;
  }
};

const parsePostedAt = (rowText: string): string => {
  const dateMatch = rowText.match(/\d{4}[.-]\d{2}[.-]\d{2}/);
  return dateMatch?.[0].replace(/\./g, '-') ?? '';
};

const parseBoard = (
  html: string,
  options: {
    sourceOrg: SourceOrg;
    sourceUrl: string;
    recentLimit: number;
    buildAnnouncementId: (rawText: string, rowIndex: number) => string;
  },
): CollectedAnnouncement[] => {
  const rowBlocks = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const items: CollectedAnnouncement[] = [];

  for (const [rowIndex, rowBlock] of rowBlocks.entries()) {
    if (items.length >= options.recentLimit) {
      break;
    }

    const titleMatch = rowBlock.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (titleMatch === null) {
      continue;
    }

    const rawHref = titleMatch[1].trim();
    const title = stripHtml(titleMatch[2]);

    if (title.length === 0) {
      continue;
    }

    const rowText = stripHtml(rowBlock);
    items.push({
      source_org: options.sourceOrg,
      announcement_id: options.buildAnnouncementId(`${title} ${rowText}`, rowIndex),
      title,
      detail_url: normalizeDetailUrl(rawHref, options.sourceUrl),
      posted_at: parsePostedAt(rowText),
    });
  }

  return items;
};

const fetchBoard = async (
  sourceOrg: SourceOrg,
  sourceUrl: string,
  options: CollectOptions = {},
  buildAnnouncementId: (rawText: string, rowIndex: number) => string,
): Promise<OrgCollectResult> => {
  const requestedLimit = options.recentLimit ?? DEFAULT_RECENT_LIMIT;

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'housing-policy-collector/1.0',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        source_org: sourceOrg,
        source_url: sourceUrl,
        requested_limit: requestedLimit,
        items: [],
        error: {
          code: 'BAD_STATUS_CODE',
          message: `${sourceOrg} board 요청 실패(status=${response.status})`,
          targetUrl: sourceUrl,
          status: response.status,
        },
      };
    }

    const html = await response.text();
    const items = parseBoard(html, {
      sourceOrg,
      sourceUrl,
      recentLimit: requestedLimit,
      buildAnnouncementId,
    });

    if (items.length === 0) {
      return {
        source_org: sourceOrg,
        source_url: sourceUrl,
        requested_limit: requestedLimit,
        items,
        error: {
          code: 'PARSE_ERROR',
          message: `${sourceOrg} board HTML에서 공고 항목을 찾지 못했습니다.`,
          targetUrl: sourceUrl,
        },
      };
    }

    return {
      source_org: sourceOrg,
      source_url: sourceUrl,
      requested_limit: requestedLimit,
      items,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';

    return {
      source_org: sourceOrg,
      source_url: sourceUrl,
      requested_limit: requestedLimit,
      items: [],
      error: {
        code: 'NETWORK_ERROR',
        message,
        targetUrl: sourceUrl,
      },
    };
  }
};

export const collectSh = async (options: CollectOptions = {}): Promise<OrgCollectResult> => {
  return fetchBoard('SH', SH_POC_BOARD_URL, options, (rawText) => buildShAnnouncementId(rawText));
};

export const collectLh = async (options: CollectOptions = {}): Promise<OrgCollectResult> => {
  return fetchBoard('LH', LH_POC_BOARD_URL, options, (rawText, rowIndex) =>
    buildLhAnnouncementId(rawText, rowIndex),
  );
};

export const collectAll = async (options: CollectOptions = {}): Promise<CollectResult> => {
  const [shResult, lhResult] = await Promise.all([collectSh(options), collectLh(options)]);
  const items = [...shResult.items, ...lhResult.items];

  return {
    requested_limit: options.recentLimit ?? DEFAULT_RECENT_LIMIT,
    items,
    by_org: {
      SH: shResult,
      LH: lhResult,
    },
    has_partial_failure: [shResult.error, lhResult.error].some((error) => error !== null),
  };
};

export const collect = collectAll;
