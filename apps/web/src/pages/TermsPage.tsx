import { InfoPageLayout, InfoSection } from '@/components/InfoPageLayout';
import { T } from '@/components/BilingualText';
import { useUiLocale } from '@/context/UiLocaleContext';

export function TermsPage() {
  const { locale } = useUiLocale();

  return (
    <InfoPageLayout
      title={{ en: 'Terms & Conditions', hi: 'नियम और शर्तें' }}
      subtitle={{ en: 'Last updated: June 2026', hi: 'अंतिम अपडेट: जून 2026' }}
    >
      <InfoSection
        title={{ en: '1. Acceptance', hi: '1. स्वीकृति' }}
        paragraphs={[
          {
            en: 'By accessing or using AATMA KATHA (“the Service”), you agree to these Terms & Conditions. If you do not agree, do not use the Service.',
            hi: 'AATMA KATHA (“सेवा”) का उपयोग करके, आप इन नियमों और शर्तों से सहमत होते हैं। यदि आप सहमत नहीं हैं, तो सेवा का उपयोग न करें।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '2. The Service', hi: '2. सेवा' }}
        paragraphs={[
          {
            en: 'AATMA KATHA is provided by Solutions Technologiques Quotidiennes Inc. The Service lets you record, transcribe, edit, organize, and share personal stories and albums. Features may change over time.',
            hi: 'AATMA KATHA Solutions Technologiques Quotidiennes Inc. द्वारा प्रदान की जाती है। सेवा आपको व्यक्तिगत कहानियाँ और एल्बम रिकॉर्ड, प्रतिलेखित, संपादित, व्यवस्थित और साझा करने देती है। सुविधाएँ समय के साथ बदल सकती हैं।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '3. Your content', hi: '3. आपकी सामग्री' }}
        paragraphs={[
          {
            en: 'You retain ownership of content you upload or create (recordings, photos, text, stories). You grant us a limited license to store, process, transcribe, display, and transmit your content solely to operate the Service.',
            hi: 'आप अपनी अपलोड या बनाई गई सामग्री (रिकॉर्डिंग, फोटो, टेक्स्ट, कहानियाँ) के स्वामी रहते हैं। आप हमें केवल सेवा संचालित करने के लिए सामग्री संग्रहीत, प्रसंस्कृत, प्रतिलेखित, प्रदर्शित और प्रसारित करने का सीमित अधिकार देते हैं।',
          },
          {
            en: 'You are solely responsible for your content and for obtaining any permissions needed from people you record, photograph, or mention. You must not upload unlawful, infringing, or harmful material.',
            hi: 'आप अपनी सामग्री और जिन लोगों को आप रिकॉर्ड, फोटोग्राफ या उल्लेख करते हैं उनकी अनुमति प्राप्त करने के लिए पूर्णतः जिम्मेदार हैं। आप गैरकानूनी, उल्लंघनकारी या हानिकारक सामग्री अपलोड नहीं कर सकते।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '4. No professional advice', hi: '4. कोई पेशेवर सलाह नहीं' }}
        paragraphs={[
          {
            en: 'The Service is for personal storytelling and memoir purposes only. It does not provide legal, medical, financial, or other professional advice. AI-generated transcripts and drafts may contain errors — always review before sharing or publishing.',
            hi: 'सेवा केवल व्यक्तिगत कहानी और संस्मरण के लिए है। यह कानूनी, चिकित्सा, वित्तीय या अन्य पेशेवर सलाह नहीं देती। AI-जनित प्रतिलेख और ड्राफ्ट में त्रुटियाँ हो सकती हैं — साझा या प्रकाशित करने से पहले हमेशा समीक्षा करें।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '5. Disclaimer of warranties', hi: '5. वारंटी अस्वीकरण' }}
        paragraphs={[
          {
            en: 'THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not guarantee uninterrupted, error-free, or secure operation.',
            hi: 'सेवा “जैसी है” और “जैसी उपलब्ध है” के आधार पर बिना किसी प्रकार की व्यक्त या निहित वारंटी के प्रदान की जाती है, जिसमें व्यापारिकता, किसी विशेष उद्देश्य के लिए उपयुक्तता और गैर-उल्लंघन शामिल हैं। हम निर्बाध, त्रुटि-मुक्त या सुरक्षित संचालन की गारंटी नहीं देते।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '6. Limitation of liability', hi: '6. दायित्व की सीमा' }}
        paragraphs={[
          {
            en: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, SOLUTIONS TECHNOLOGIQUES QUOTIDIENNES INC. AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, GOODWILL, OR OTHER INTANGIBLE LOSSES.',
            hi: 'कानून द्वारा अनुमत अधिकतम सीमा तक, SOLUTIONS TECHNOLOGIQUES QUOTIDIENNES INC. और इसके अधिकारी, निदेशक, कर्मचारी और सहयोगी किसी भी अप्रत्यक्ष, आकस्मिक, विशेष, परिणामी या दंडात्मक क्षति, या डेटा, लाभ, सद्भाव या अन्य अमूर्त हानि के लिए उत्तरदायी नहीं होंगे।',
          },
          {
            en: 'Our total liability for any claim arising from the Service shall not exceed the greater of (a) the amount you paid us in the twelve months before the claim, or (b) one hundred Canadian dollars (CAD $100).',
            hi: 'सेवा से उत्पन्न किसी भी दावे के लिए हमारा कुल दायित्व (a) दावे से पहले बारह महीनों में आपके द्वारा भुगतान की गई राशि, या (b) एक सौ कनाडाई डॉलर (CAD $100) में से जो अधिक हो, से अधिक नहीं होगा।',
          },
          {
            en: 'We are not responsible for content posted by users, actions of collaborators or contributors, accuracy of transcriptions, public links you choose to share, or third-party services (such as authentication or cloud hosting).',
            hi: 'हम उपयोगकर्ताओं द्वारा पोस्ट की गई सामग्री, सहयोगियों या योगदानकर्ताओं के कार्य, प्रतिलेखों की सटीकता, आपके द्वारा साझा किए गए सार्वजनिक लिंक, या तृतीय-पक्ष सेवाओं (जैसे प्रमाणीकरण या क्लाउड होस्टिंग) के लिए जिम्मेदार नहीं हैं।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '7. Indemnification', hi: '7. क्षतिपूर्ति' }}
        paragraphs={[
          {
            en: 'You agree to indemnify and hold harmless Solutions Technologiques Quotidiennes Inc. from claims, damages, and expenses (including reasonable legal fees) arising from your use of the Service, your content, or your violation of these Terms.',
            hi: 'आप सेवा के उपयोग, अपनी सामग्री, या इन नियमों के उल्लंघन से उत्पन्न दावों, क्षति और खर्चों (उचित कानूनी शुल्क सहित) से Solutions Technologiques Quotidiennes Inc. को क्षतिपूर्ति और हानिरहित रखने के लिए सहमत हैं।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '8. Public sharing', hi: '8. सार्वजनिक साझाकरण' }}
        paragraphs={[
          {
            en: 'When you publish albums or share links, anyone with the link may access that content. You control what is published and are responsible for reviewing content before making it public.',
            hi: 'जब आप एल्बम प्रकाशित करते हैं या लिंक साझा करते हैं, तो लिंक वाला कोई भी व्यक्ति उस सामग्री तक पहुँच सकता है। आप नियंत्रित करते हैं कि क्या प्रकाशित हो, और सार्वजनिक करने से पहले सामग्री की समीक्षा के लिए जिम्मेदार हैं।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '9. Account & termination', hi: '9. खाता और समाप्ति' }}
        paragraphs={[
          {
            en: 'You may stop using the Service at any time. We may suspend or terminate access if you violate these Terms or if required for security or legal reasons. Provisions that by nature should survive (including disclaimers and liability limits) will survive termination.',
            hi: 'आप किसी भी समय सेवा का उपयोग बंद कर सकते हैं। यदि आप इन नियमों का उल्लंघन करते हैं या सुरक्षा या कानूनी कारणों से आवश्यक हो, तो हम पहुँच निलंबित या समाप्त कर सकते हैं। जो प्रावधान स्वभाव से बने रहने चाहिए (अस्वीकरण और दायित्व सीमाएँ सहित) समाप्ति के बाद भी प्रभावी रहेंगे।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '10. Changes', hi: '10. परिवर्तन' }}
        paragraphs={[
          {
            en: 'We may update these Terms from time to time. Continued use after changes means you accept the updated Terms. Material changes will be reflected on this page with an updated date.',
            hi: 'हम समय-समय पर इन नियमों को अपडेट कर सकते हैं। परिवर्तनों के बाद निरंतर उपयोग का अर्थ है कि आप अपडेट किए गए नियमों को स्वीकार करते हैं। महत्वपूर्ण परिवर्तन इस पृष्ठ पर अपडेट की गई तिथि के साथ दिखाए जाएंगे।',
          },
        ]}
      />

      <InfoSection
        title={{ en: '11. Governing law', hi: '11. लागू कानून' }}
        paragraphs={[
          {
            en: 'These Terms are governed by the laws applicable in the jurisdiction where Solutions Technologiques Quotidiennes Inc. operates, without regard to conflict-of-law principles.',
            hi: 'ये नियम उस अधिकार क्षेत्र के लागू कानूनों द्वारा शासित हैं जहाँ Solutions Technologiques Quotidiennes Inc. संचालित होती है, कानून के टकराव के सिद्धांतों की परवाह किए बिना।',
          },
        ]}
      />

      <p className={`mt-4 text-xs text-slate-400 ${locale === 'hi' ? 'font-hindi' : ''}`}>
        <T
          en="Questions? See our Privacy Policy or About page."
          hi="प्रश्न? हमारी गोपनीयता नीति या About पृष्ठ देखें।"
        />
      </p>
    </InfoPageLayout>
  );
}
