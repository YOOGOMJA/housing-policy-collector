/** Collector 모듈. */

const SH_POC_BOARD_URL =
  'https://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/brd/m_247/list.do?multi_itm_seq=0';
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

export type ShAnnouncement = {
  announcement_id: string;
  title: string;
  detail_url: string;
  posted_at: string;
};

/** 후속 모듈(파서/매처/저장소) 공통 입력 타입. */
export type DownstreamAnnouncementInput = Pick<
  ShAnnouncement,
  'announcement_id' | 'title' | 'detail_url' | 'posted_at'
> & {
  source_org: 'SH';
};

export type CollectResult = {
  source_url: string;
  requested_limit: number;
  items: ShAnnouncement[];
  error: CollectorErrorMeta | null;
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

const buildAnnouncementId = (rawText: string): string => {
  const noticeNumber = extractNoticeNumber(rawText);
  const recruitRound = extractRecruitRound(rawText);
  return `SH-${noticeNumber}-${recruitRound}`;
};

const normalizeDetailUrl = (href: string): string => {
  if (href.length === 0) {
    return SH_POC_BOARD_URL;
  }

  try {
    return new URL(href, SH_POC_BOARD_URL).toString();
  } catch {
    return SH_POC_BOARD_URL;
  }
};

const parsePostedAt = (rowText: string): string => {
  const dateMatch = rowText.match(/\d{4}[.-]\d{2}[.-]\d{2}/);
  return dateMatch?.[0].replace(/\./g, '-') ?? '';
};

const parseShBoard = (html: string, recentLimit: number): ShAnnouncement[] => {
  const rowBlocks = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const items: ShAnnouncement[] = [];

  for (const rowBlock of rowBlocks) {
    if (items.length >= recentLimit) {
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
      announcement_id: buildAnnouncementId(`${title} ${rowText}`),
      title,
      detail_url: normalizeDetailUrl(rawHref),
      posted_at: parsePostedAt(rowText),
    });
  }

  return items;
};

export const collect = async (
  options: CollectOptions = {},
): Promise<CollectResult> => {
  const requestedLimit = options.recentLimit ?? DEFAULT_RECENT_LIMIT;

  try {
    const response = await fetch(SH_POC_BOARD_URL, {
      headers: {
        'User-Agent': 'housing-policy-collector/1.0',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        source_url: SH_POC_BOARD_URL,
        requested_limit: requestedLimit,
        items: [],
        error: {
          code: 'BAD_STATUS_CODE',
          message: `SH board 요청 실패(status=${response.status})`,
          targetUrl: SH_POC_BOARD_URL,
          status: response.status,
        },
      };
    }

    const html = await response.text();
    const items = parseShBoard(html, requestedLimit);

    if (items.length === 0) {
      return {
        source_url: SH_POC_BOARD_URL,
        requested_limit: requestedLimit,
        items,
        error: {
          code: 'PARSE_ERROR',
          message: 'SH board HTML에서 공고 항목을 찾지 못했습니다.',
          targetUrl: SH_POC_BOARD_URL,
        },
      };
    }

    return {
      source_url: SH_POC_BOARD_URL,
      requested_limit: requestedLimit,
      items,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';

    return {
      source_url: SH_POC_BOARD_URL,
      requested_limit: requestedLimit,
      items: [],
      error: {
        code: 'NETWORK_ERROR',
        message,
        targetUrl: SH_POC_BOARD_URL,
      },
    };
  }
};
