import type { FirebaseError } from 'firebase/app';

export type PdfErrorStage = 'images' | 'render' | 'upload' | 'metadata' | 'download';

export type ImageLoadFailure = {
  storagePath?: string;
  url?: string;
  pageLabel?: string;
  code: string;
  message: string;
};

export class PdfOperationError extends Error {
  readonly stage: PdfErrorStage;
  readonly code: string;
  readonly failures?: ImageLoadFailure[];
  readonly pageIndex?: number;
  readonly pageLabel?: string;

  constructor(
    stage: PdfErrorStage,
    message: string,
    opts?: {
      code?: string;
      cause?: unknown;
      failures?: ImageLoadFailure[];
      pageIndex?: number;
      pageLabel?: string;
    },
  ) {
    super(message);
    this.name = 'PdfOperationError';
    this.stage = stage;
    this.code = opts?.code ?? describeFirebaseError(opts?.cause).code;
    this.failures = opts?.failures;
    this.pageIndex = opts?.pageIndex;
    this.pageLabel = opts?.pageLabel;
    if (opts?.cause instanceof Error && opts.cause.stack) {
      this.stack = opts.cause.stack;
    }
  }
}

export function describeFirebaseError(error: unknown): { code: string; message: string } {
  const err = error as FirebaseError | undefined;
  const code = err?.code?.trim() || 'unknown';
  const message =
    err?.message?.trim() ||
    (error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error');
  return { code, message };
}

export function logPdfError(stage: PdfErrorStage, detail: string, error?: unknown): void {
  const { code, message } = describeFirebaseError(error);
  const payload: Record<string, unknown> = { stage, detail, code, message };
  if (error && typeof error === 'object') payload.raw = error;
  console.error('[PDF]', payload);
}

export function formatPdfErrorForUi(error: unknown): string {
  if (error instanceof PdfOperationError) {
    const lines = [
      `Stage: ${error.stage}`,
      `Code: ${error.code}`,
      error.message,
    ];
    if (error.pageIndex != null) {
      lines.push(`Page: ${error.pageIndex + 1}${error.pageLabel ? ` (${error.pageLabel})` : ''}`);
    }
    if (error.failures?.length) {
      lines.push('', 'Image load failures:');
      for (const failure of error.failures.slice(0, 6)) {
        const target = failure.pageLabel ?? failure.storagePath ?? failure.url ?? 'image';
        lines.push(`• ${target}`);
        lines.push(`  ${failure.code}: ${failure.message}`);
      }
      if (error.failures.length > 6) {
        lines.push(`…and ${error.failures.length - 6} more (see browser console)`);
      }
    }
    lines.push('', 'Open DevTools → Console and filter for [PDF] for full details.');
    return lines.join('\n');
  }

  const { code, message } = describeFirebaseError(error);
  return `Code: ${code}\n${message}`;
}
