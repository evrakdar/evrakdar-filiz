export type UserProfile = {
  firstName: string;
  lastName: string;
  title: string;
  department: string;
};

export type SubCategory = {
  id: string;
  title: string;
  description: string;
};

export type MainCategory = {
  id: string;
  title: string;
  description: string;
  count: number;
  subCategories: SubCategory[];
};

export type DocumentItem = {
  id: string;
  itemType?: "document" | "folder";
  name: string;
  size: string;
  date: string;
  documentType: string;
  department: string;
  responsiblePerson: string;
  validityDate: string;
  isFavorite: boolean;
  originalFileName?: string | null;
  mimeType?: string | null;
  storageBucket?: string | null;
  storageKey?: string | null;
};

export const currentUser: UserProfile = {
  firstName: "Ayşe",
  lastName: "Demir",
  title: "Doküman Yönetim Sorumlusu",
  department: "Yönetim"
};

export const mainCategories: MainCategory[] = [
  {
    id: "akademik",
    title: "Akademik",
    description: "Akademik fırsatlar, ders planları ve tanıtım sunumları",
    count: 3,
    subCategories: [
      {
        id: "erasmus-bilgi-paketleri",
        title: "Erasmus+ Bilgi Paketleri",
        description: "Erasmus toplantı sunumları, ülke listeleri ve MoU dosyaları"
      },
      {
        id: "ders-planlari",
        title: "Ders Planları",
        description: "Yıllık ve dönemlik ders planları"
      },
      {
        id: "tanitim-sunumlari",
        title: "Tanıtım Sunumları",
        description: "Kurumsal tanıtım, oryantasyon ve temel bilgi sunumları"
      }
    ]
  },
  {
    id: "idari",
    title: "İdari",
    description: "Toplantı tutanakları, personel dosyaları ve anket raporları",
    count: 3,
    subCategories: [
      {
        id: "toplanti-tutanaklari",
        title: "Toplantı Tutanakları",
        description: "Kurul, komisyon ve birim toplantı tutanakları"
      },
      {
        id: "personel-dosyalari",
        title: "Personel Dosyaları",
        description: "Personel özlük ve görev tanımı belgeleri"
      },
      {
        id: "anket-raporlari",
        title: "Anket Raporları",
        description: "2025 ve 2026 analiz raporları ile değerlendirme sonuçları"
      }
    ]
  },
  {
    id: "kalite-akreditasyon",
    title: "Kalite & Akreditasyon",
    description: "Kalite el kitabı, prosedürler ve akreditasyon raporları",
    count: 2,
    subCategories: [
      {
        id: "akreditasyon-raporlari",
        title: "Akreditasyon Raporları",
        description: "Kurumsal değerlendirme ve izleme raporları"
      },
      {
        id: "proseduler",
        title: "Prosedürler",
        description: "Onaylı süreç prosedürleri ve talimatlar"
      }
    ]
  },
  {
    id: "sistem-yonetim",
    title: "Sistem & Yönetim",
    description: "Yönetmelikler, yönergeler ve kullanım kılavuzları",
    count: 2,
    subCategories: [
      {
        id: "yonetmelikler",
        title: "Yönetmelikler ve Yönergeler",
        description: "Kurum yönetmelikleri, yönergeler ve uygulama esasları"
      },
      {
        id: "kullanim-kilavuzlari",
        title: "Kullanım Kılavuzları",
        description: "Sistem kullanım kılavuzları ve sözlük"
      }
    ]
  }
];

export const documents: DocumentItem[] = [
  createDocument("doc-8", "2025 Yılı Analiz Raporları", "Klasör", "09.10.2025", "Klasör", "İdari İşler", "Ayşe Demir", "31.12.2026", true, "folder"),
  createDocument("doc-18", "2026 Yılı Analiz Raporları", "Klasör", "07.05.2026", "Klasör", "İdari İşler", "Ayşe Demir", "30.06.2027", false, "folder"),
  createDocument("doc-22", "Personel Dosyaları", "Klasör", "20.11.2025", "Klasör", "İdari İşler", "Ayşe Demir", "20.11.2026", false, "folder"),
  createDocument("doc-23", "Toplantı Tutanakları", "Klasör", "10.03.2026", "Klasör", "İdari İşler", "Ayşe Demir", "10.03.2027", false, "folder"),
  createDocument("doc-24", "Akreditasyon Raporları", "Klasör", "19.11.2025", "Klasör", "Kalite ve Raporlama", "Ayşe Demir", "19.11.2026", false, "folder"),
  createDocument("doc-25", "Kalite Eğitim Sunumları", "Klasör", "29.12.2025", "Klasör", "Kalite ve Raporlama", "Ayşe Demir", "29.06.2026", true, "folder"),
  createDocument("doc-26", "Yönetim Sistemi Dokümanları", "Klasör", "16.12.2025", "Klasör", "Kurumsal Gelişim", "Ayşe Demir", "16.12.2026", false, "folder"),
  createDocument("doc-27", "01. Kurumsal Temeller", "Klasör", "16.12.2025", "Klasör", "Kurumsal Gelişim", "Ayşe Demir", "16.12.2026", false, "folder"),
  createDocument("doc-28", "02. El Kitapları", "Klasör", "16.12.2025", "Klasör", "Kurumsal Gelişim", "Ayşe Demir", "16.12.2026", false, "folder"),
  createDocument("doc-29", "03. Süreç Kartları", "Klasör", "16.12.2025", "Klasör", "Kurumsal Gelişim", "Ayşe Demir", "16.12.2026", false, "folder"),
  createDocument("doc-30", "04. Detay Süreç Akışları", "Klasör", "16.12.2025", "Klasör", "Kurumsal Gelişim", "Ayşe Demir", "16.12.2026", false, "folder"),
  createDocument("doc-31", "05. Yönetmelikler", "Klasör", "16.12.2025", "Klasör", "Kurumsal Gelişim", "Ayşe Demir", "16.12.2026", false, "folder"),
  createDocument("doc-32", "06. Yönergeler", "Klasör", "16.12.2025", "Klasör", "Kurumsal Gelişim", "Ayşe Demir", "16.12.2026", false, "folder"),
  createDocument("doc-33", "07. Uygulama Esasları ve Rehberler", "Klasör", "16.12.2025", "Klasör", "Kurumsal Gelişim", "Ayşe Demir", "16.12.2026", false, "folder"),
  createDocument("doc-1", "Erasmus Koordinatörlüğü - 7.10.2025 Toplantı Sunumu.pptx", "12.8 MB", "07.10.2025", "Sunum", "Akademik Birimler", "Ayşe Demir", "31.12.2026", true),
  createDocument("doc-2", "KA171 Ülkeler.docx", "892 KB", "07.10.2025", "Word", "Akademik Birimler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-3", "MoU Listesi.docx", "746 KB", "07.10.2025", "Word", "Akademik Birimler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-4", "Proje Teşvikleri Sunumu 2026.pptx", "13.4 MB", "18.03.2026", "Sunum", "Akademik Birimler", "Ayşe Demir", "30.06.2027", true),
  createDocument("doc-5", "Facts and Figures 2025.pptx", "11.9 MB", "05.11.2025", "Sunum", "Akademik Birimler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-6", "Oryantasyon Sunumu.pdf", "3.2 MB", "05.11.2025", "PDF", "Akademik Birimler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-7", "Temel Bilgiler ve İstatistikler 2025.pptx", "14.1 MB", "05.11.2025", "Sunum", "Akademik Birimler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-9", "Çalışan Memnuniyeti Anketi Değerlendirme Raporu.docx", "1.1 MB", "09.10.2025", "Word", "İdari İşler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-10", "Dış Hizmet Alımları Memnuniyet Anketi Raporu.pdf", "2.8 MB", "09.10.2025", "PDF", "İdari İşler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-11", "Veli Bilgilendirme Toplantısı Değerlendirme Anketi Raporu.docx", "1.5 MB", "18.09.2025", "Word", "İdari İşler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-12", "İnsan, Kalite ve Akreditasyon Kültürü Eğitimi Değerlendirme Anketi Analiz Raporu.pdf", "3.1 MB", "27.11.2025", "PDF", "İdari İşler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-13", "Proje Eğitimi Değerlendirme Sonuçları Anket Raporu.docx", "1.3 MB", "11.09.2025", "Word", "İdari İşler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-14", "İç Tetkik Süreci Geri Bildirim Anketi Sonuçları.docx", "952 KB", "20.11.2025", "Word", "İdari İşler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-15", "2025 Lider Davranışı Değerlendirme Anketi Analiz Raporu.pdf", "2.6 MB", "29.12.2025", "PDF", "İdari İşler", "Ayşe Demir", "31.12.2026", true),
  createDocument("doc-16", "2024-2025 Bahar Dönemi Ders Değerlendirme Anketi Analiz Raporu.pdf", "2.4 MB", "23.07.2025", "PDF", "İdari İşler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-17", "Öğrenci Genel Memnuniyet Anketi Raporu.pdf", "2.9 MB", "23.07.2025", "PDF", "İdari İşler", "Ayşe Demir", "31.12.2026", false),
  createDocument("doc-19", "Kariyer Günü Değerlendirme Anketi Analiz Raporu.pdf", "2.7 MB", "07.05.2026", "PDF", "İdari İşler", "Ayşe Demir", "30.06.2027", false),
  createDocument("doc-20", "2025-2026 Güz Dönemi Ders Değerlendirme Anketi Analiz Sunumu.pdf", "3.4 MB", "07.05.2026", "PDF", "İdari İşler", "Ayşe Demir", "30.06.2027", false),
  createDocument("doc-21", "Hizmet İçi Eğitim Değerlendirme Anketi Raporu.pdf", "2.5 MB", "07.05.2026", "PDF", "İdari İşler", "Ayşe Demir", "30.06.2027", false),
  createDocument("doc-40", "Doküman Sistemi Kullanım Kılavuzu.pdf", "9.52 MB", "23.07.2025", "PDF", "Kurumsal Gelişim", "Ayşe Demir", "23.07.2026", true),
  createDocument("doc-41", "Doküman Ağacı.xlsx", "142.57 KB", "03.06.2026", "Excel", "Kurumsal Gelişim", "Ayşe Demir", "03.06.2027", false),
  createDocument("doc-42", "Doküman Ağacı Sözlüğü.doc", "135 KB", "08.06.2026", "Word", "Kurumsal Gelişim", "Ayşe Demir", "08.06.2027", false)
];

export const favorites = documents.filter((document) => document.isFavorite).slice(0, 7);

export const frequentlyUsed = [
  "EYS Dokümanları",
  "Anket Raporları",
  "Erasmus+ Bilgi Paketleri",
  "YÖKAK Raporları"
];

function createDocument(
  id: string,
  name: string,
  size: string,
  date: string,
  documentType: string,
  department: string,
  responsiblePerson: string,
  validityDate: string,
  isFavorite: boolean,
  itemType: "document" | "folder" = "document"
): DocumentItem {
  return {
    id,
    itemType,
    name,
    size,
    date,
    documentType,
    department,
    responsiblePerson,
    validityDate,
    isFavorite
  };
}
