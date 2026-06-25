import { InfoPageLayout, InfoSection } from '@/components/InfoPageLayout';
import { T } from '@/components/BilingualText';
import { useUiLocale } from '@/context/UiLocaleContext';

export function AboutPage() {
  const { locale } = useUiLocale();

  return (
    <InfoPageLayout
      title={{ en: 'About us', hi: 'हमारे बारे में' }}
      subtitle={{ en: 'AATMA KATHA · Solutions Technologiques Quotidiennes Inc.', hi: 'AATMA KATHA · Solutions Technologiques Quotidiennes Inc.' }}
    >
      <InfoSection
        title={{ en: 'Our app', hi: 'हमारा ऐप' }}
        paragraphs={[
          {
            en: 'AATMA KATHA helps families and communities capture life stories through voice, photos, and prompts — then organize them into beautiful digital albums you can share.',
            hi: 'AATMA KATHA परिवारों और समुदायों को आवाज़, फोटो और प्रश्नों के माध्यम से जीवन की कहानियाँ रिकॉर्ड करने, उन्हें व्यवस्थित करने और सुंदर डिजिटल एल्बम के रूप में साझा करने में मदद करता है।',
          },
        ]}
      />

      <InfoSection
        title={{ en: 'Who we are', hi: 'हम कौन हैं' }}
        paragraphs={[
          {
            en: 'AATMA KATHA is made by Solutions Technologiques Quotidiennes Inc. — a company that builds technology-enabled solutions for everyday routines as well as challenging problems.',
            hi: 'AATMA KATHA Solutions Technologiques Quotidiennes Inc. द्वारा बनाया गया है — एक कंपनी जो रोज़मर्रा के कामों और चुनौतीपूर्ण समस्याओं दोनों के लिए तकनीक-सक्षम समाधान बनाती है।',
          },
          {
            en: 'We believe personal history matters. Our tools are designed to be simple enough for anyone to use, while still powerful enough to preserve rich, multi-media memoirs for generations.',
            hi: 'हम मानते हैं कि व्यक्तिगत इतिहास महत्वपूर्ण है। हमारे उपकरण सरल हैं ताकि कोई भी उपयोग कर सके, और साथ ही समृद्ध, बहु-मीडिया संस्मरणों को पीढ़ियों तक सुरक्षित रखने के लिए पर्याप्त शक्तिशाली भी हैं।',
          },
        ]}
      />

      <InfoSection
        title={{ en: 'Our approach', hi: 'हमारा दृष्टिकोण' }}
        paragraphs={[
          {
            en: 'From transcription and story drafting to chapter organization and public sharing, we combine thoughtful design with reliable cloud technology so you can focus on the stories themselves.',
            hi: 'प्रतिलेखन और कहानी ड्राफ्ट से लेकर अध्याय व्यवस्था और सार्वजनिक साझाकरण तक, हम विचारशील डिज़ाइन को विश्वसनीय क्लाउड तकनीक के साथ जोड़ते हैं ताकि आप कहानियों पर ध्यान केंद्रित कर सकें।',
          },
        ]}
      />

      <p className={`mt-8 text-center text-xs text-slate-400 ${locale === 'hi' ? 'font-hindi' : ''}`}>
        © {new Date().getFullYear()} Solutions Technologiques Quotidiennes Inc.
      </p>
      <p className="text-center text-xs text-slate-400">
        <T en="All rights reserved." hi="सर्वाधिकार सुरक्षित।" />
      </p>
    </InfoPageLayout>
  );
}
