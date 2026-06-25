import { InfoPageLayout, InfoSection } from '@/components/InfoPageLayout';
import { T } from '@/components/BilingualText';
import { useUiLocale } from '@/context/UiLocaleContext';

export function PrivacyPage() {
  const { locale } = useUiLocale();

  return (
    <InfoPageLayout
      title={{ en: 'Privacy Policy', hi: 'गोपनीयता नीति' }}
      subtitle={{ en: 'Last updated: June 2026', hi: 'अंतिम अपडेट: जून 2026' }}
    >
      <InfoSection
        title={{ en: '1. Who we are', hi: '1. हम कौन हैं' }}
        paragraphs={[
          {
            en: 'AATMA KATHA is operated by Solutions Technologiques Quotidiennes Inc. (“we”, “us”). This Privacy Policy explains how we collect, use, and protect information when you use our app and website.',
            hi: 'AATMA KATHA Solutions Technologiques Quotidiennes Inc. (“हम”) द्वारा संचालित है। यह गोपनीयता नीति बताती है कि जब आप हमारे ऐप और वेबसाइट का उपयोग करते हैं तो हम जानकारी कैसे एकत्र, उपयोग और सुरक्षित करते हैं।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '2. Information we collect', hi: '2. हम कौन सी जानकारी एकत्र करते हैं' }}
        paragraphs={[
          {
            en: 'Account information: name, email address, and authentication data when you sign up (including via Google sign-in).',
            hi: 'खाता जानकारी: साइन अप करते समय नाम, ईमेल पता और प्रमाणीकरण डेटा (Google साइन-इन सहित)।',
          },
          {
            en: 'Content you create: audio recordings, photos, text, story drafts, transcripts, book and chapter organization, and sharing settings.',
            hi: 'आपकी बनाई सामग्री: ऑडियो रिकॉर्डिंग, फोटो, टेक्स्ट, कहानी ड्राफ्ट, प्रतिलेख, पुस्तक और अध्याय व्यवस्था, और साझाकरण सेटिंग्स।',
          },
          {
            en: 'Usage data: basic technical logs (device type, browser, timestamps, errors) to keep the Service running and secure.',
            hi: 'उपयोग डेटा: सेवा चालू और सुरक्षित रखने के लिए बुनियादी तकनीकी लॉग (डिवाइस प्रकार, ब्राउज़र, समय, त्रुटियाँ)।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '3. How we use information', hi: '3. हम जानकारी का उपयोग कैसे करते हैं' }}
        paragraphs={[
          {
            en: 'We use your information to provide and improve the Service: storing your stories, transcribing audio, generating drafts, organizing albums, enabling collaboration, and displaying published content you choose to share.',
            hi: 'हम आपकी जानकारी का उपयोग सेवा प्रदान और सुधारने के लिए करते हैं: कहानियाँ संग्रहीत करना, ऑडियो का प्रतिलेखन, ड्राफ्ट बनाना, एल्बम व्यवस्थित करना, सहयोग सक्षम करना, और आपके द्वारा साझा की गई प्रकाशित सामग्री प्रदर्शित करना।',
          },
          {
            en: 'We do not sell your personal information. We do not use your private stories for advertising.',
            hi: 'हम आपकी व्यक्तिगत जानकारी नहीं बेचते। हम आपकी निजी कहानियों का उपयोग विज्ञापन के लिए नहीं करते।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '4. Service providers', hi: '4. सेवा प्रदाता' }}
        paragraphs={[
          {
            en: 'We use trusted third-party providers to operate the Service, including cloud hosting and database services (such as Google Firebase), authentication providers, and speech/transcription APIs. These providers process data on our behalf under their own privacy terms and security standards.',
            hi: 'सेवा संचालित करने के लिए हम विश्वसनीय तृतीय-पक्ष प्रदाताओं का उपयोग करते हैं, जिसमें क्लाउड होस्टिंग और डेटाबेस सेवाएँ (जैसे Google Firebase), प्रमाणीकरण प्रदाता, और भाषण/प्रतिलेखन API शामिल हैं। ये प्रदाता अपनी गोपनीयता शर्तों और सुरक्षा मानकों के तहत हमारी ओर से डेटा संसाधित करते हैं।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '5. Sharing & public links', hi: '5. साझाकरण और सार्वजनिक लिंक' }}
        paragraphs={[
          {
            en: 'Private content stays private unless you publish an album or share a link. Published albums, story pages, and browse snapshots may be viewed by anyone who has the URL. You decide what to publish.',
            hi: 'निजी सामग्री निजी रहती है जब तक आप एल्बम प्रकाशित न करें या लिंक साझा न करें। प्रकाशित एल्बम, कहानी पृष्ठ और ब्राउज़ स्नैपशॉट URL वाला कोई भी देख सकता है। आप तय करते हैं कि क्या प्रकाशित करना है।',
          },
          {
            en: 'Collaborators and contributors you invite can access content within the books you authorize.',
            hi: 'आपके द्वारा आमंत्रित सहयोगी और योगदानकर्ता उन पुस्तकों की सामग्री तक पहुँच सकते हैं जिन्हें आप अधिकृत करते हैं।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '6. Storage & security', hi: '6. संग्रहण और सुरक्षा' }}
        paragraphs={[
          {
            en: 'We use industry-standard measures to protect data in transit and at rest. However, no method of transmission or storage is 100% secure. We cannot guarantee absolute security.',
            hi: 'हम ट्रांज़िट और रेस्ट में डेटा की सुरक्षा के लिए उद्योग-मानक उपायों का उपयोग करते हैं। हालाँकि, संचरण या संग्रहण की कोई भी विधि 100% सुरक्षित नहीं है। हम पूर्ण सुरक्षा की गारंटी नहीं दे सकते।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '7. Retention & deletion', hi: '7. रखरखाव और हटाना' }}
        paragraphs={[
          {
            en: 'We retain your content while your account is active and as needed to provide the Service. You may delete stories and content within the app. Account deletion requests may be handled according to our data retention policies and legal obligations.',
            hi: 'आपका खाता सक्रिय रहने तक और सेवा प्रदान करने के लिए आवश्यकतानुसार हम आपकी सामग्री रखते हैं। आप ऐप के भीतर कहानियाँ और सामग्री हटा सकते हैं। खाता हटाने के अनुरोध हमारी डेटा रखरखाव नीतियों और कानूनी दायित्वों के अनुसार संभाले जा सकते हैं।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '8. Children', hi: '8. बच्चे' }}
        paragraphs={[
          {
            en: 'The Service is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us data, contact us so we can take appropriate steps.',
            hi: 'सेवा 13 वर्ष से कम उम्र के बच्चों के लिए नहीं है। हम जानबूझकर 13 वर्ष से कम उम्र के बच्चों से व्यक्तिगत जानकारी एकत्र नहीं करते। यदि आपको लगता है कि किसी बच्चे ने हमें डेटा दिया है, तो हमसे संपर्क करें।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '9. Your choices', hi: '9. आपके विकल्प' }}
        paragraphs={[
          {
            en: 'You can update account preferences in Settings. You control publishing and sharing. You may stop using the Service at any time.',
            hi: 'आप सेटिंग्स में खाता प्राथमिकताएँ अपडेट कर सकते हैं। आप प्रकाशन और साझाकरण नियंत्रित करते हैं। आप किसी भी समय सेवा का उपयोग बंद कर सकते हैं।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '10. Changes to this policy', hi: '10. इस नीति में परिवर्तन' }}
        paragraphs={[
          {
            en: 'We may update this Privacy Policy from time to time. The “Last updated” date at the top reflects the latest version. Continued use after changes means you accept the updated policy.',
            hi: 'हम समय-समय पर इस गोपनीयता नीति को अपडेट कर सकते हैं। शीर्ष पर “अंतिम अपडेट” तिथि नवीनतम संस्करण दर्शाती है। परिवर्तनों के बाद निरंतर उपयोग का अर्थ है कि आप अपडेट की गई नीति स्वीकार करते हैं।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '11. Disclaimer', hi: '11. अस्वीकरण' }}
        paragraphs={[
          {
            en: 'To the extent permitted by law, Solutions Technologiques Quotidiennes Inc. is not liable for unauthorized access, data loss, or disclosure beyond our reasonable control. See our Terms & Conditions for full liability limitations.',
            hi: 'कानून द्वारा अनुमत सीमा तक, Solutions Technologiques Quotidiennes Inc. हमारे उचित नियंत्रण से परे अनधिकृत पहुँच, डेटा हानि, या प्रकटीकरण के लिए उत्तरदायी नहीं है। पूर्ण दायित्व सीमाओं के लिए हमारे नियम और शर्तें देखें।',
          },
        ]}
      />

      <p className={`mt-4 text-xs text-slate-400 ${locale === 'hi' ? 'font-hindi' : ''}`}>
        <T en="© Solutions Technologiques Quotidiennes Inc." hi="© Solutions Technologiques Quotidiennes Inc." />
      </p>
    </InfoPageLayout>
  );
}
