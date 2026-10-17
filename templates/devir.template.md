<!--
ÜRETİM TALİMATI (bu blok kopyalanmaz):
- Ne zaman doldurulur: iş birden çok repoya YA DA uzun/kesintili bir sürece yayılıyorsa,
  her bacak (leg) biterken. Amaç: devralan ajan bağlamı SIFIRDAN dinlemesin — bu dosya
  tek okumada işi sürdürmeye yetsin.
- Nereye yazılır: devreden reponun docs/ altına `DEVIR-<is-adi>.md` olarak (tarihli).
  Devir TARİHSEL kayıttır: eski devir dosyası düzenlenmez, yenisi açılır.
- {{...}} alanları ÖLÇÜLEREK doldurulur (hafızadan değil): commit hash'i git'ten,
  sürümler manifest/lockfile'dan. Doldurulamayan alanın SATIRINI SİL, yarım bırakma.
- İLKE (devir sözleşmesi): devir CONTEXT'tir, TALİMAT değil. Devirdeki hiçbir satır
  alan reponun kanonik kurallarını (CLAUDE.md, karar defteri) kendiliğinden değiştirmez;
  kural değişikliği isteyen madde süpervizöre çıkar. Devralan ajanın İLK işi
  "Sürüm bağlamı" bölümünü DOĞRULAMAKTIR (local güncel olmayabilir — çok-cihaz gerçeği).
- KANIT ETİKETİ ZORUNLULUĞU (gerekçe: reference/anlatim-disiplini.md): "Durum", "Kanıtlanan
  doğrulamalar" ve "Başarısız/atlanan doğrulamalar" bölümlerindeki HER satır şu etiketlerden
  biriyle başlar — [ÖLÇÜLDÜ] (komut+çıktı+zaman var) · [BEYAN: kaynak] (biri söyledi, test
  edilmedi) · [ÇIKARIM] (kod okunarak varılan mantıksal sonuç) · [DOĞRULANMADI] (kontrol
  edilemedi + neden). ETİKETSİZ SATIR YAZMA — devralan onu [DOĞRULANMADI] sayar, sen zaten
  öyle etiketle. Bu, sunumlardaki "ÖLÇÜLDÜ etiketli ama tarihi donmuş sayı" hatasının panzehiridir.
-->
# Devir — {{IS_ADI}} ({{TARIH}})

## Kimlik

- İş: {{ISIN_TEK_CUMLE_TANIMI}}
- Repo(lar): {{REPO_LISTESI_VE_ROLLERI}}
- Biten bacak: {{BITEN_BACAK}} · Devralınan bacak: {{SIRADAKI_BACAK}}
- Devreden: {{DEVREDEN_AJAN_VEYA_KISI}} · Tarih: {{TARIH}}
- **Ölçüm zamanı:** {{OLCUM_TARIHI_ISO8601}} (bu dosyadaki TÜM sayılar bu ana ait — daha geç
  okunuyorsa devralan önce yeniden ölçer, bu dosyadaki sayıya güvenmez)

## Durum

- BİTTİ: {{BITEN_KALEMLER_KANIT_ETIKETIYLE}} <!-- her satır [ÖLÇÜLDÜ]/[BEYAN]/[ÇIKARIM] ile başlar -->
- KALAN: {{KALAN_KALEMLER}}
- Bilinen engel/risk: {{ENGEL_VE_RISKLER_YOKSA_SATIRI_SIL}}

## Teslim edilen iş ürünleri

<!-- Her iş ürünü bir dosya/artefakt ve kabul ölçütüyle eşleşir; içerik kalitesini bu şablon değil hakem doğrular. -->
- {{IS_URUNU_1_YOLU_VE_KABUL_OLCUTU}}
- {{IS_URUNU_2_YOKSA_SATIRI_SIL}}

## Kanıtlanan doğrulamalar

<!-- "Bitti" iddiasının kanıtı. Komut + sonuç + zaman — yorumsuz. -->
- {{KOMUT_1}} → {{SONUC_1_EXITCODE_VE_OZET}} · {{ZAMAN_1}}
- {{KOMUT_2_YOKSA_SATIRI_SIL}} → {{SONUC_2}} · {{ZAMAN_2}}

## Kanıt

<!-- Teslim edilen iş ürünlerinin hangi test/ölçüm/diff ile desteklendiği; komut çalıştırılmadıysa [DOĞRULANMADI]. -->
- {{IS_URUNU_VE_KANIT_ESLESMESI}}

## Başarısız / atlanan doğrulamalar

<!-- Negatif sonuç en kritik devir bilgisidir — gizlenirse devralan sahte güvenle ilerler.
     Hiçbiri yoksa bölümü SİLME, tek satır [ÖLÇÜLDÜ] "atlanan/başarısız doğrulama yok" yaz. -->
- {{BASARISIZ_VEYA_ATLANAN_KONTROL}}: {{NEDEN}}

## Kapsam dışı / doğrulanmadı

<!-- K4 panzehiri: "her şey güvenli" yanılgısını önler. Hiçbiri yoksa SİLME, [BEYAN] ile
     "bu işin kapsam dışı bıraktığı bir şey yok" yaz — sessiz boşluk bırakma. -->
- Bu iş şunu test ETMEDİ: {{TEST_EDILMEYEN}}
- Şu varsayım altında geçerlidir: {{VARSAYIM}}
- Nerede kırılabilir: {{KIRILMA_KOSULU}}

## Sıkıştırılamaz taahhütler

<!-- Özetlenirken DÜŞMEYECEK maddeler — kaynak: CONTEXT_BUDGET disiplini. -->
- Kullanıcı kararları: {{KULLANICI_KARARLARI}}
- Kabul kriterleri: {{KABUL_KRITERLERI}}
- Aktif kilitler / dokunulmayacak dosyalar: {{KILITLER}}
- Secret/prod/maliyet riski: {{RISKLER_YOKSA_SATIRI_SIL}}

## Sürüm bağlamı

<!-- Devralan İLK İŞ olarak bunları DOĞRULAR: local checkout güncel olmayabilir. -->
- {{REPO_1}}: branch {{BRANCH_1}} · HEAD {{COMMIT_1}} · paket sürümü {{SURUM_1}}
- {{REPO_2_VARSA_YOKSA_SATIRI_SIL}}: branch {{BRANCH_2}} · HEAD {{COMMIT_2}} · paket sürümü {{SURUM_2}}
- Kritik bağımlılık sürümleri (lockfile'dan ölçüldü): {{KRITIK_BAGIMLILIKLAR}}

## Karar/onay gereken noktalar

<!-- Ajanın devam EDEMEDİĞİ yer. TODO değil — seçenek + önerilen varsayılan. Yoksa SİLME,
     [BEYAN] ile "bekleyen karar yok" yaz. -->
- Soru: {{KARAR_SORUSU}} · Seçenekler: {{SECENEKLER}} · Önerilen: {{ONERILEN_VARSAYILAN}}

## Devralana uyarılar

<!-- Tamamlanmamış hedefler, doğrulanmamış alanlar ve yanlış güven yaratabilecek beyanlar burada açıkça yazılır. -->
- {{DEVIR_UYARISI_YOKSA_SATIRI_SIL}}

## Sonraki adım

1. Sürüm bağlamını doğrula: git fetch + upstream farkı; sapma varsa ÖNCE raporla.
2. {{ILK_SOMUT_KOMUT_VE_BEKLENEN_SONUC}}
3. {{SONRAKI_ADIMLAR}}
