interface AppLogoProps {
  className?: string;
}

export function AppLogo({ className = 'h-14 w-auto max-w-[280px] object-contain' }: AppLogoProps) {
  return <img src="/logo.png" alt="Aatma Katha — आत्म कथा" className={className} />;
}
