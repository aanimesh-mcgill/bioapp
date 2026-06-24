import { BilingualLine } from '@/components/BilingualText';
import { micErrorMessages, type MicErrorKind } from '@/lib/mediaPermissions';

interface MicPermissionHelpProps {
  kind: MicErrorKind;
  onRetry?: () => void;
}

export function MicPermissionHelp({ kind, onRetry }: MicPermissionHelpProps) {
  const msg = micErrorMessages(kind);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs">
      <BilingualLine en={msg.en} hi={msg.hi} enClass="font-medium text-amber-900" hiClass="mt-1 text-amber-800" />

      {kind === 'denied' && (
        <ul className="mt-2 list-inside list-disc space-y-1 text-amber-800">
          <li>
            iPhone Safari: address bar → aA → Website Settings → Microphone → Allow
            <span className="font-hindi block text-[11px] text-amber-700">
              iPhone: पता पट्टी → aA → वेबसाइट सेटिंग्स → माइक्रोफ़ोन → Allow
            </span>
          </li>
          <li>
            Android Chrome: lock icon → Permissions → Microphone → Allow
            <span className="font-hindi block text-[11px] text-amber-700">
              Android: ताला आइकन → अनुमतियाँ → माइक्रोफ़ोन → Allow
            </span>
          </li>
        </ul>
      )}

      {kind === 'insecure' && (
        <p className="mt-2 text-amber-800">
          Live app:{' '}
          <a href="https://autobio-b5dbf.web.app" className="font-semibold underline">
            autobio-b5dbf.web.app
          </a>
        </p>
      )}

      {onRetry && (
        <button type="button" className="btn-primary mt-3 w-full py-2 text-xs" onClick={onRetry}>
          Try again / फिर कोशिश करें
        </button>
      )}
    </div>
  );
}
