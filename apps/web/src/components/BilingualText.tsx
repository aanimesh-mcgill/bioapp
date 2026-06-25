import { usePickText } from '@/context/UiLocaleContext';
import type { BilingualString } from '@/lib/locale';

export function PageHeading({ en, hi, className = '' }: BilingualString & { className?: string }) {
  const t = usePickText();
  const isHi = t({ en, hi }) === hi;
  return (
    <div className={className}>
      <h1 className={`text-2xl font-bold text-brand-600 ${isHi ? 'font-hindi' : ''}`}>{t({ en, hi })}</h1>
    </div>
  );
}

export function PageSubheading({
  en,
  hi,
  className = 'mb-6 mt-2',
}: BilingualString & { className?: string }) {
  const t = usePickText();
  const text = t({ en, hi });
  const isHi = text === hi;
  return (
    <div className={className}>
      <p className={`text-sm ${isHi ? 'font-hindi text-slate-500' : 'text-slate-600'}`}>{text}</p>
    </div>
  );
}

export function BilingualLine({
  en,
  hi,
  enClass = '',
  hiClass = 'text-slate-500',
  inline = false,
}: BilingualString & {
  enClass?: string;
  hiClass?: string;
  /** Use spans instead of paragraphs — required inside <p> or inline with buttons. */
  inline?: boolean;
}) {
  const t = usePickText();
  const text = t({ en, hi });
  const isHi = text === hi;
  const className = isHi ? `font-hindi ${hiClass}` : enClass;

  if (inline) {
    return <span className={className}>{text}</span>;
  }

  return (
    <div>
      <p className={className}>{text}</p>
    </div>
  );
}

export function SectionHeading({ en, hi }: BilingualString) {
  const t = usePickText();
  const text = t({ en, hi });
  const isHi = text === hi;
  return (
    <div className="mb-2">
      <h2
        className={`text-sm font-semibold uppercase tracking-wide ${isHi ? 'font-hindi text-slate-400' : 'text-slate-500'}`}
      >
        {text}
      </h2>
    </div>
  );
}

export function BilingualBtn({ en, hi }: BilingualString) {
  const t = usePickText();
  const text = t({ en, hi });
  return <>{text === hi ? <span className="font-hindi">{text}</span> : text}</>;
}

export function BilingualBtnStack({ en, hi }: BilingualString) {
  const t = usePickText();
  const text = t({ en, hi });
  const isHi = text === hi;
  return isHi ? <span className="font-hindi">{text}</span> : text;
}

export function BilingualStatus({
  en,
  hi,
  className = '',
}: BilingualString & { className?: string }) {
  const t = usePickText();
  const text = t({ en, hi });
  const isHi = text === hi;
  return (
    <span className={className}>
      <span className={`block ${isHi ? 'font-hindi text-[10px] leading-tight' : ''}`}>{text}</span>
    </span>
  );
}

/** Inline bilingual text — use where BilingualLine is too heavy. */
export function T({
  en,
  hi,
  className = '',
}: BilingualString & { className?: string }) {
  const t = usePickText();
  const text = t({ en, hi });
  const isHi = text === hi;
  return <span className={`${isHi ? 'font-hindi' : ''} ${className}`.trim()}>{text}</span>;
}
