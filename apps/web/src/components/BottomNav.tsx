import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home', labelHi: 'होम', icon: '🏠' },
  { to: '/prompts', label: 'Prompts', labelHi: 'प्रश्न', icon: '✨' },
  { to: '/book', label: 'Book', labelHi: 'पुस्तक', icon: '📚' },
  { to: '/stories', label: 'Stories', labelHi: 'कहानियाँ', icon: '📖' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {links.map(({ to, label, labelHi, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition ${
                isActive ? 'text-brand-600' : 'text-slate-500'
              }`
            }
          >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
            <span className="font-hindi text-[10px] leading-none">{labelHi}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
