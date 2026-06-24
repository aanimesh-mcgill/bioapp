export const SESSION_STATUS: Record<
  string,
  { en: string; hi: string }
> = {
  recording: { en: 'Recording', hi: 'रिकॉर्डिंग' },
  transcribing: { en: 'Transcribing…', hi: 'प्रतिलेखन…' },
  generating: { en: 'Writing story…', hi: 'कहानी लिखी जा रही…' },
  ready: { en: 'Draft ready', hi: 'ड्राफ्ट तैयार' },
  pending_approval: { en: 'Awaiting approval', hi: 'स्वीकृति की प्रतीक्षा' },
  approved: { en: 'Approved', hi: 'स्वीकृत' },
  rejected: { en: 'Needs revision', hi: 'संशोधन चाहिए' },
  error: { en: 'Error', hi: 'त्रुटि' },
};

export const CLIP_STATUS: Record<
  string,
  { en: string; hi: string }
> = {
  uploading: { en: 'Uploading…', hi: 'अपलोड…' },
  transcribing: { en: 'Transcribing…', hi: 'प्रतिलेखन…' },
  ready: { en: 'Ready', hi: 'तैयार' },
  error: { en: 'Failed', hi: 'विफल' },
};

export function clipStatusLabel(status: string): string {
  const s = CLIP_STATUS[status];
  return s ? `${s.en} / ${s.hi}` : status;
}

export function sessionStatusLabel(status: string): string {
  const s = SESSION_STATUS[status];
  return s ? `${s.en} / ${s.hi}` : status;
}
