import type { ImagePromptAnswers } from '@/types';

export const IMAGE_PROMPT_QUESTIONS: {
  key: keyof ImagePromptAnswers;
  label: string;
  labelHi: string;
}[] = [
  { key: 'whereTaken', label: 'Where was this photo taken?', labelHi: 'यह फोटो कहाँ ली गई?' },
  { key: 'whoInPhoto', label: 'Who is in the photo?', labelHi: 'फोटो में कौन है?' },
  { key: 'event', label: 'What event or occasion?', labelHi: 'कौन सा कार्यक्रम या अवसर?' },
  { key: 'interesting', label: 'What is interesting about this image?', labelHi: 'इस तस्वीर में क्या दिलचस्प है?' },
  { key: 'beforeAfter', label: 'What happened before or after?', labelHi: 'इससे पहले या बाद में क्या हुआ?' },
  { key: 'relevance', label: 'Why is this important to your life story?', labelHi: 'यह आपकी जीवन कहानी के लिए क्यों महत्वपूर्ण है?' },
];
