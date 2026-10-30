import { AiError } from '@/ai/types';
import type { I18n } from '@/i18n';
import { StickerTooLargeError } from '@/imaging/exportWebp';
import { CutoutError } from '@/native/cutout';

/** Turns any error from the pipeline into a friendly, translated sentence. */
export function describeError(e: unknown, { t }: Pick<I18n, 't'>, model?: string): string {
  if (e instanceof AiError) {
    switch (e.kind) {
      case 'missing_key':
        return t('error.missingKey');
      case 'invalid_key':
        return t('error.invalidKey');
      case 'rate_limit':
        return t('error.rateLimit');
      case 'quota':
        return t('error.quota');
      case 'content_policy':
        return t('error.contentPolicy');
      case 'org_verification':
        return t('error.orgVerification');
      case 'model_unavailable':
        return t('error.modelUnavailable', { model: model ?? '' });
      case 'network':
        return t('error.network');
      case 'timeout':
        return t('error.timeout');
      case 'cancelled':
        return t('error.cancelled');
      case 'server':
        return t('error.server', { status: e.status ?? '5xx' });
      case 'bad_response':
        return t('error.badResponse');
      case 'bad_request':
        return t('error.badRequest', { message: e.message });
    }
  }
  if (e instanceof CutoutError) {
    switch (e.code) {
      case 'unsupported':
        return t('error.cutoutUnsupported');
      case 'no_subject':
        return t('error.cutoutNoSubject');
      case 'model_downloading':
        return t('error.cutoutModelDownloading');
      default:
        return t('error.cutoutFailed', { message: e.message });
    }
  }
  if (e instanceof StickerTooLargeError) return t('error.exportTooBig');
  if (e instanceof Error && e.message === 'EMPTY_CUTOUT') return t('error.cutoutNoSubject');
  return t('error.unknown', { message: e instanceof Error ? e.message : String(e) });
}

export const isAiKind = (e: unknown, ...kinds: AiError['kind'][]) => e instanceof AiError && kinds.includes(e.kind);
