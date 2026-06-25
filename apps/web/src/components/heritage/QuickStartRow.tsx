import { Link } from 'react-router-dom';
import { usePickText } from '@/context/UiLocaleContext';

const ITEMS = [
  {
    to: '/add-stimulus?mode=photo',
    en: 'Photo',
    hi: 'तस्वीर',
    icon: '📷',
  },
  {
    to: '/record',
    en: 'Voice',
    hi: 'आवाज़',
    icon: '🎙️',
  },
  {
    to: '/add-stimulus?mode=text',
    en: 'Write',
    hi: 'लिखें',
    icon: '✎',
  },
] as const;

export function QuickStartRow() {
  const t = usePickText();

  return (
    <div>
      <p className="heritage-label mb-3">{t({ en: 'Quick start', hi: 'त्वरित शुरुआत' })}</p>
      <div className="grid grid-cols-3 gap-2">
        {ITEMS.map(({ to, en, hi, icon }) => (
          <Link
            key={to}
            to={to}
            className="card flex flex-col items-center gap-1 py-4 text-center transition active:scale-[0.98]"
          >
            <span className="text-xl">{icon}</span>
            <span
              className={`text-xs font-semibold uppercase tracking-wide text-heritage-ink ${
                t({ en, hi }) === hi ? 'font-hindi normal-case' : ''
              }`}
            >
              {t({ en, hi })}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
