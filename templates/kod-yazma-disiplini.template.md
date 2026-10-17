<!--
ÜRETİM TALİMATI (bu blok kopyalanmaz):
- Bu dosya hedef repoda docs/KOD-YAZMA-DISIPLINI.md olarak kurulur (yol backtick'siz: hedefte
  üretilir, BU repoda yoktur — backtick'lenirse doc-truth ölü referans sayar); kök CLAUDE.md
  ona tek satırla işaret eder.
- Kapsam: kod yazma ANINDAKİ karar disiplini. Global kurallar (delegasyon · bilimsel disiplin ·
  token ekonomisi · kanıt etiketleri) BURAYA KOPYALANMAZ — kök CLAUDE.md'de yaşar, buradan
  yalnız İŞARET edilir. Kopyalarsan iki yerde yaşar, biri bayatlar (meta-kural: alt dosya = DELTA).
- 🔴 STACK KURALI EZBERDEN YAZILMAZ. "any kullanma / camelCase / DI uygula" gibi dile özgü sabit
  kural YASAK. Ölçülmüş gerekçe: bir kapının ilk sürümü türev repoların kodunu ihlal saydı ve
  geri çekildi (17 yanlış-pozitif). Stack bölümü hedef repodan ÖLÇÜLEREK doldurulur; ölçemiyorsan
  o bölümün TAMAMINI SİL — yarım bırakma.
- {{...}} alanlarının ölçüm KAYNAĞI her satırda yazılıdır. Ölçmediysen yazma, satırı sil.
- Satır tavanı: ≤120. Ağır gerekçe buraya değil, kararı doğuran deftere/reference'a.
- ÜRETİM SONRASI: placeholder + doc-truth kapılarını koş — doldurulmamış {{}} / ölü yol kalmasın.
-->
# Kod Yazma Disiplini — {{PROJE_ADI}}

Bu dosya kök CLAUDE.md'nin DELTASIdır: yalnız **kod yazma anındaki** kararları tanımlar.
Delegasyon, bilimsel çalışma disiplini, okuma protokolü ve kanıt etiketleri için → **CLAUDE.md**.
Çelişki olursa CLAUDE.md kazanır.

## 1 — YAZMADAN ÖNCE (dördü de cevaplanmadan editöre dokunma)

| Soru | Nasıl cevaplanır | Cevapsızsa |
|------|------------------|------------|
| Hangi **referans deseni** kopyalayacağım? | Aynı işi yapan mevcut EN TEMİZ dosyayı aç ve oku: {{REFERANS_DESEN_DOSYALARI}} <!-- KAYNAK: FAZ 1 madde 10 (tekrar/yerleşim ölçümü) --> | Yazma — desen okumadan yazılan kod icattır |
| **Dokunma kümem** ne? | Değişecek dosyaları ADLARIYLA say; keşifte gördüğün ≠ değiştireceğin | Kapsam belirsiz → plana dön |
| Bu dosyalar **kilitli mi**? | CLAUDE.md sahiplik kilitleri + aktif dalga tablosu | Kilitliyse SIRAYLA koş, paralel yazma |
| **Testi var mı**? | {{HEDEFLI_TEST_KOMUTU}} ile dokunacağın alanı koş | Testi YOKSA → önce karakterizasyon testi (aşağıda §4) |

**İş tipini burada seç** — hafif mod / tam dalga ayrımı ve kriterleri: kök CLAUDE.md "Süreç
kuralları". Belirsizse tam dalga.

🔴 **Değiştireceğin dosyayı KENDİN okursun.** Keşif delege edilir, düzenleme edilmez — başkasının
raporuna dayanarak dosya değiştirmek bayat bağlamla yazmaktır.

## 2 — YAZARKEN

- **Kopyala, icat etme.** Repoda o iş için bir desen varsa ona uy; "daha iyisini biliyorum"
  refactor'ı ayrı bir iştir, bu işin içine gizlenmez.
- **Merkezi altyapıyı YENİDEN YAZMA.** Kanonik liste kök CLAUDE.md "Merkezi altyapı" tablosunda.
  İkinci bir HTTP sarmalayıcı / tarih yardımcısı / logger üretmek en sık sessiz entropidir.
- **Plan dışına çıkma.** İki çelişki tipini AYIRMAK zorundasın (KAPSAM → DUR · OLGU → ölçüm
  kazanır, raporla ve devam et); kanonik tanım rol dosyanın "Plan dışına çıkma" maddesinde.
- **Değişiklik boyutu:** bir iş = bir amaç. Yol üstünde gördüğün ilgisiz kusuru düzeltmek
  diff'i denetlenemez yapar.
- 🔴 **Yan-bug gördüğünde SOR ya da LOGLA, sessizce düzeltme YASAK.** Protokolün tamamı (SOR
  eşikleri · yasaklar · eskalasyon) rol dosyanın yan-bug maddesinde. Log yolu: {{YAN_BUG_LOG_YOLU}}
  <!-- KAYNAK: FAZ 3 takip dosyaları adımında kurulan yan-bug günlüğü -->
- **Secret'a ve prod veriye dokunma.** Gerekiyorsa dur ve insana sor.

## 3 — YAZDIKTAN SONRA (sırayla, atlamadan)

1. **Doğrulama koş:** {{VERIFY_KOMUTU}} → yeşil olmadan iş bitmedi sayılır.
2. **Baseline sapmasını sınıflandır.** Beklenen değerler kök CLAUDE.md "Baseline manifestosu"nda —
   sayıyı buraya YAZMA, bayatlar. Sapma varsa failure sınıfını belirt (sınıf listesi: kök
   CLAUDE.md); sistemin kendi kuralı iş yapmayı engellediyse → {{SURTUNME_LOG_YOLU}}
   <!-- KAYNAK: FAZ 3 takip dosyaları adımında kurulan sürtünme günlüğü -->.
   🔴 "Yeşil" demek kanıt değildir — komutu koş, çıktısını göster.
3. **Çıkış raporu:** biçim ve zorunlu alanlar rol dosyanda. **Atlanan kontrolleri** yazmamak,
   atlamamaktan daha pahalıdır.

## 4 — Test disiplini (stack-nötr kısım)

- **Test-yok alana giriş** (karakterizasyon testi zorunluluğu): kanonik tanım rol dosyanın çıkış
  kapısında — testi olmayan davranışa dokunmadan ÖNCE mevcut davranışı sabitle.
- **Refactor → test DEĞİŞMEMELİ.** Test de değişiyorsa o refactor değil, davranış değişikliğidir;
  plana bağlı olmalı.
- **Kırmızı baseline üstüne yeni kapı kurma** — önce yeşile getir, yoksa "kırmızı normaldir"
  öğrenilir ve tüm kapılar değersizleşir.

## 5 — Stack kuralları (ÖLÇÜLEREK doldurulur)

<!-- KAYNAK: hedef reponun KENDİ konfigürasyonu — linter/formatter config, tsconfig/compiler
     ayarları, .editorconfig, CI lint adımı, ve mevcut kodun BASKIN deseni.
     🔴 Ezberden kural yazma. Ölçemediğin satırı yazma. Hiçbiri ölçülemiyorsa BÖLÜMÜ TÜMÜYLE SİL —
     boş/yarım bırakılan stack bölümü rehberi yalancı yapar. -->

- Biçimlendirme/lint zorlayıcısı: {{LINT_ARACI_VE_KOMUTU}}
- Derleyici/tip katılığı: {{TIP_KATILIGI_AYARI}}
- Bu repoda zorlanan diğer ölçülmüş kural: {{OLCULEN_STACK_KURALI}}

Bu bölümdeki kurallar **araç tarafından zorlanır**; burada tekrar edilmelerinin tek sebebi
ajanın onları yazmadan ÖNCE bilmesidir. Araçla çelişirse **araç kazanır**.

## 6 — Bu dosyanın sınırı (dürüstlük kaydı)

Buradaki maddeler **TARİF**tir, kapı DEĞİL. "Referans desen okundu mu", "kapsam dar mı" bulanık
invariantlardır; makineye inmezler. Zorlayanlar: {{VERIFY_KOMUTU}} (baseline), commit kapıları,
ve hakem/insan denetimi. Bir maddenin makine zorlayıcısı doğduğunda bu satır güncellenir.
