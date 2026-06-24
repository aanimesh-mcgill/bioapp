export type MicErrorKind = 'insecure' | 'denied' | 'notfound' | 'unsupported' | 'unknown';

export function isSecureRecordingContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext;
}

export function classifyMicError(err: unknown): MicErrorKind {
  if (!isSecureRecordingContext()) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';

  const name = (err as DOMException)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'notfound';
  return 'unknown';
}

export function micErrorMessages(kind: MicErrorKind): { en: string; hi: string } {
  switch (kind) {
    case 'insecure':
      return {
        en: 'Microphone needs a secure (HTTPS) connection. On your phone, use the live app link or https://your-computer-ip:5173 — not http://.',
        hi: 'माइक्रोफ़ोन के लिए सुरक्षित (HTTPS) कनेक्शन चाहिए। फ़ोन पर लाइव ऐप या https:// लिंक का उपयोग करें — http:// नहीं।',
      };
    case 'denied':
      return {
        en: 'Microphone access was blocked. Tap Allow when the browser asks, or enable it in site settings (lock icon in the address bar).',
        hi: 'माइक्रोफ़ोन अवरुद्ध है। ब्राउज़र पूछे तो Allow दबाएं, या पते की पट्टी में साइट सेटिंग्स से चालू करें।',
      };
    case 'notfound':
      return {
        en: 'No microphone found on this device.',
        hi: 'इस डिवाइस पर कोई माइक्रोफ़ोन नहीं मिला।',
      };
    case 'unsupported':
      return {
        en: 'Recording is not supported in this browser. Try Chrome or Safari.',
        hi: 'यह ब्राउज़र रिकॉर्डिंग सपोर्ट नहीं करता। Chrome या Safari आज़माएं।',
      };
    default:
      return {
        en: 'Could not access the microphone. Check permissions and try again.',
        hi: 'माइक्रोफ़ोन एक्सेस नहीं हो सका। अनुमति जाँचें और फिर कोशिश करें।',
      };
  }
}

export async function requestMicrophoneAccess(): Promise<{ ok: true } | { ok: false; kind: MicErrorKind }> {
  if (!isSecureRecordingContext()) {
    return { ok: false, kind: 'insecure' };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, kind: 'unsupported' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true };
  } catch (err) {
    return { ok: false, kind: classifyMicError(err) };
  }
}
