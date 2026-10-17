<!--
ALT-AJAN RAPOR ŞABLONU — subagent'ın ana ajana DÖNÜŞ sözleşmesi.
(Karşılığı: templates/brif.template.md = GİRİŞ sözleşmesi. Rapor, brifteki kabul ölçütüne
madde madde cevap verir — ikisi çifttir.)

NEDEN VAR: rol dosyalarında nesir "Çıktın:" blokları vardı, ama makine-okunur/denetlenebilir
dönüş yalnız HAKEM için tanımlıydı (hakem-verdict.template.json + kapı). Kâşif ya da uygulayıcı
raporunu hiç üretmese veya boş üretse hiçbir mekanizma görmüyordu. Çok-ajanlı sistemde bilgi
kaybının bir numaralı kaynağı budur.

🔴 ANA AJAN ≠ ALT AJAN: kök CLAUDE.md'deki "çıkış raporu" ANA ajanın KULLANICIYA raporudur.
Bu şablon ALT ajanın ANA AJANA dönüşüdür. Alt ajan raporu kullanıcıya yazılmaz: ham terminal
çıktısı yığılmaz, nezaket cümlesi yazılmaz, özet-of-özet üretilmez.

DÜRÜST SINIR: bu bir TARİF'tir, kapı DEĞİL — "rapor eksik/yetersiz" bulanık invariant, E0'a
inmez (Hakem denetler). Pilot kalibrasyonundan SONRA bir varlık kapısı (rapor üretildi mi)
değerlendirilebilir; kalite kapısı asla.

KANIT ETİKETİ ZORUNLU (HER İKİ ŞEMADA) — her iddia şu dördünden birini taşır:
  [ÖLÇÜLDÜ]      komut koştum, çıktısı bu
  [BEYAN]        başkası (plan/brif/başka ajan) söyledi, ben doğrulamadım
  [ÇIKARIM]      koddan/desenden çıkardım, koşarak doğrulamadım
  [DOĞRULANMADI] bakmam gerekirdi ama bakmadım/bakamadım
Etiketsiz iddia = BEYAN sayılır. "Yeşil" demek kanıt değildir; komutu koş ve çıktısını ver.

🔴 İKİ ŞEMA VAR, ROLE GÖRE SEÇ (çok-model danışma kararı, 2026-08-06, panel 5/5 + kanarya
bağımsız doğruladı): önerilen tek-tip "NE/NEDEN/ŞİMDİ NE" şeması ÇÜRÜTÜLDÜ — "ŞİMDİ NE" (eylem)
alanı, GÖZLEM rolündeki ajanı (kâşif) KARAR İCAT ETMEYE İTER; yani kuralın çözmeye çalıştığı
hata (kâşifin hazır tavsiye paketi döndürmesi) kuralın KENDİSİ tarafından üretilir. Boş bir
öneri başlığı doldurulmayı BEKLER — bu bir davettir, nötr alan değil. Bu yüzden roller ikiye
ayrılır:

(a) KEŞİF ŞEMASI — GÖZLEM rolleri (kasif/web-kasif/seed-kasif gibi): aşağıdaki "Keşif raporu"
    bölümünü kullan. Karar/öneri/tavsiye/"sonraki adım" alanı bu şemada YOKTUR — boş bırakılmaz,
    şemada hiç bulunmaz.
(b) UYGULAMA ŞEMASI — DEĞİŞİKLİK yapan roller (uygulayici, hakem, dokuman-uretici gibi):
    aşağıdaki "Uygulama raporu" bölümünü kullan — mevcut yapı (Sonuç/Kabul ölçütü/Yapılanlar/…).
    Bu rol zaten karar UYGULAR, "sonraki adım" alanı burada meşrudur.

Rolün frontmatter'ı hangi şemayı kullanacağını belirtmez — rolün TANIMI belirler: GÖZLEM mi
DEĞİŞİKLİK mi? Edit/Write aracı olmayan salt-okur roller varsayılan olarak (a)'yı kullanır.
-->

# RAPOR — <görev adı> · <rol>

`okur: sade | teknik`  ← ZORUNLU, yazmadan ÖNCE seçilir (kök CLAUDE.md "Okur kaydı").
Rapor/özet/açıklama varsayılanı **sade**: terim ya yok ya ilk geçişte tek cümle tanım;
önce karar/sonuç, sonra ayrıntı. Kullanıcı "teknik anlat" derse o iş için `teknik` yazılır.

## (a) KEŞİF RAPORU — GÖZLEM rolleri için (kasif / web-kasif / seed-kasif / pm-sorgu / design-steward)

| OLGU | KANIT_REFERANSI | SINIR | AÇIK_SORU |
|---|---|---|---|
| <gözlemlenen durum, yorumsuz> | `dosya:satır` \| `komut → çıktı` \| git hash \| URL | <bu olgunun kapsamı/geçerlilik sınırı> | <yanıtsız kalan soru, varsa> |

- **OLGU:** yalnız gözlem. Yorum/tahmin/tavsiye buraya YAZILMAZ.
- **KANIT_REFERANSI:** serbest metin DEĞİL, yapılandırılmış referans (`dosya:satır` · `komut → çıktı`
  · git hash · URL) — fiziksel varlığı mekanik doğrulanabilir olsun.
  🔴 **Çözülemiyorsa SESSİZ GEÇME, İŞARETLE** (v0.24): referansı kaynakta bulamadıysan olguyu
  `KANIT_REFERANSI: COZULMEDI — <ne arandı, nerede bulunamadı>` diye yaz. "Bulamadım" ile
  "bakmadım" aynı şey DEĞİLDİR ve ikisi de "temiz"e düşmez (doktrin `TB-5` yokluk körlüğü).
  `COZULMEDI` bir başarısızlık değil DÜRÜST bir beyandır; ana ajan onu kanıt SAYMAZ.
  Aynı sözleşme hakem artefaktında `dayanak_durumu` alanıdır (`templates/hakem-verdict.template.json`).
- **SINIR:** bu olgunun nereye kadar geçerli olduğu (ör. "yalnız `gates/` dizini tarandı").
- **AÇIK_SORU:** yanıtsız kalan soru. Semantik/yorum İÇEREN iddia buraya `hipotez` diye yazılır —
  OLGU değildir, ana ajanı anchor'lamaz (bağlayıcı değildir, çağıran serbestçe değerlendirir).
- 🔴 Karar/öneri/tavsiye/"sonraki adım" SÜTUNU YOKTUR — eklenmez, boş da bırakılmaz.

**Süre:** <bu keşif kaç dakika sürdü — kaba, [BEYAN] sayılır> · **Taranan kapsam:** <kaç dosya/dizin>

Süre alanı hız ekseninin (v0.21 FAZ A) veri kaynağıdır: paralel fan-out'un seri delegasyona göre
kazancı ancak tur süreleri toplanırsa ölçülebilir. Bu alan OLGU tablosunun parçası DEĞİLDİR
(görevin kendisi hakkında meta-veridir), o yüzden tablonun altında durur.

## (b) UYGULAMA RAPORU — DEĞİŞİKLİK yapan roller için (uygulayici / hakem / dokuman-uretici / ...)

### Sonuç
<TAMAM | KISMEN | ENGEL — tek kelime, ilk satır>

### Kabul ölçütü karşılığı
Brifteki her maddeye TEK TEK cevap (atlanan madde varsa nedeniyle):

- [x] <ölçüt 1> — [ÖLÇÜLDÜ] `<komut>` → `<çıktı özeti>`
- [ ] <ölçüt 2> — [DOĞRULANMADI] <neden>

### Yapılanlar
<değişen dosyalar: yol + tek satır ne değişti. Ham diff YAPIŞTIRMA.>

### Koşulan doğrulama
| Komut | Sonuç | Etiket |
|---|---|---|
| `<komut>` | <geçti/kaldı + sayı> | [ÖLÇÜLDÜ] |

### Süre (hız ekseni — v0.21 FAZ A)
<bu adım kaç dakika sürdü (yaklaşık kabul edilir) · bekleme/engel varsa ayrıca yaz>

NEDEN VAR: hız bu paketin İKİNCİ hedefidir (birinci doğruluk) ama v0.20'ye kadar hiç ÖLÇÜLMEDİ —
`scripts/`+`gates/`+`templates/` genelinde tek süre ölçüm noktası yoktu. Paralelleştirme/delegasyon
kararlarının "işe yaradı" iddiası ancak baseline varsa kanıtlanabilir. Ajanın kendi süre BEYANI
kabadır (kanıt etiketi [BEYAN]); kesin ölçüm koşucu/telemetri tarafındadır — bu alan dalga
kırılımı için kaba veri toplar, fatura değildir.

### Failure sınıfı
<yoksa "yok". Varsa: baseline | benim | ortam | flaky | engel | sistem-kuralı>

"sistem-kuralı" = sistemin KENDİ kuralının yarattığı sürtünme → FRICTION_LOG adayı (Hakem onaylar).
"baseline" iddiası için baseline'ı ÖLÇ, hafızadan söyleme.

### Atlanan kontroller
<koşmadığın doğrulama + NEDEN. "Hepsini koştum" diyorsan hepsini koşmuş ol.>

### Kapsam dışı gördüklerin (YAN-BUG)
<iş sırasında görülen plan-dışı kusur — SESSİZCE DÜZELTME. Buraya yaz, ana ajan karar versin.>

### Belirsizlikler
<⚠ ile işaretle. Emin olmadığını "muhtemelen" ile geçiştirme — "bilmiyorum" geçerli cevaptır.>

### Bir sonraki adım için gerekli bağlam
<ana ajanın devam edebilmesi için bilmesi gereken minimum. Ham keşif geçmişini taşıma —
focus summary yaz (context de bütçedir).>
