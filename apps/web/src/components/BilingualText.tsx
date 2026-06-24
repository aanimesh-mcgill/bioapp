export function PageHeading({ en, hi, className = '' }: { en: string; hi: string; className?: string }) {
  return (
    <div className={className}>
      <h1 className="text-2xl font-bold text-brand-600">{en}</h1>
      <p className="font-hindi text-lg text-brand-500">{hi}</p>
    </div>
  );
}

export function PageSubheading({ en, hi, className = 'mb-6 mt-2' }: { en: string; hi: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm text-slate-600">{en}</p>
      <p className="font-hindi text-sm text-slate-500">{hi}</p>
    </div>
  );
}

export function BilingualLine({ en, hi, enClass = '', hiClass = 'text-slate-500' }: {
  en: string;
  hi: string;
  enClass?: string;
  hiClass?: string;
}) {
  return (
    <>
      <p className={enClass}>{en}</p>
      <p className={`font-hindi ${hiClass}`}>{hi}</p>
    </>
  );
}

export function SectionHeading({ en, hi }: { en: string; hi: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{en}</h2>
      <p className="font-hindi text-xs text-slate-400">{hi}</p>
    </div>
  );
}

/** Single-line button label: "English / हिन्दी" */
export function BilingualBtn({ en, hi }: { en: string; hi: string }) {
  return (
    <>
      {en} / {hi}
    </>
  );
}

/** Stacked button label — English on top, Hindi below */
export function BilingualBtnStack({ en, hi }: { en: string; hi: string }) {
  return (
    <>
      {en}
      <span className="font-hindi block text-xs font-normal">{hi}</span>
    </>
  );
}

/** Inline status badge — English + Hindi on two lines */
export function BilingualStatus({ en, hi, className = '' }: { en: string; hi: string; className?: string }) {
  return (
    <span className={className}>
      <span className="block">{en}</span>
      <span className="font-hindi block text-[10px] leading-tight opacity-90">{hi}</span>
    </span>
  );
}
