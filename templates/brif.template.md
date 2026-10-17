<!--
DELEGASYON BRİFİ ŞABLONU — alt-ajana iş paslarken GİRİŞ sözleşmesi.
(Karşılığı: templates/rapor.template.md = alt-ajanın ÇIKIŞ sözleşmesi. İkisi çifttir:
rapor, brifteki kabul ölçütüne cevap verir. Brifi doldurmadan rapor formatı anlamsızdır.)

NEDEN VAR: "delegasyon brifi = amaç + kurallar + NEDEN + kabul ölçütü" kuralı nesirde vardı ama
ŞABLONU yoktu — her orkestratör brifi kendi keyfine göre yazıyordu. Brifin İÇERİĞİ orkestratörün
yargısıdır, ama ALANLARI kural olmalı: eksik alan = alt ajanın icat etmesi = dalga zehirlenmesi.

DÜRÜST SINIR: bu bir TARİF'tir, kapı DEĞİL. "Brif eksik" bulanık bir invariant — E0'a inmez,
Hakem/insan denetler. Kalibrasyon (pilot) olmadan kapı yazılmaz.

KULLANIM: alt-ajan çağrısının prompt'una bu alanlar doldurularak gömülür. Dosya olarak
saklamak ZORUNLU DEĞİL (tek-oturumluk iş için prompt içinde kalır); çok-dalgalı/uzun işte
.claude/waves/ altına yazılır.
-->

# BRİF — <görev adı>

## Rol
<hangi alt-ajan: kasif | uygulayici | hakem | ...>

## Ağırlık
<hafif | orta | agir>

Ağırlık, çağrı-başına `model`/`effort` override'ını belirler — rol frontmatter'ındaki değer
TABANDIR, tavan değil. Aynı rol hem tek-satırlık düzeltme hem mimari iş yapabilir; ikisine aynı
ağırlığı göndermek israftır (ya da yetersizdir). Eşleme: hafif → rol tabanının altı/ucuz+low ·
orta → rol tabanı · agir → bir üst tier / `effort: high`. Gerekçe: agentic-repo-setup paketi, reference/model-effort-tiering.md.
`thinking` override'ı YOKTUR — derinlik yalnız `effort` ile ayarlanır.

## Amaç
<bu işin çözdüğü problem — TEK cümle>

## NEDEN (bağlam)
<bu iş neden şimdi gerekiyor; hangi karara/bulguya dayanıyor>

🔴 Bu alan atlanmaz. Sadece "görev" verilen ajan, amaca uymayan ama talimata uyan iş üretir.
NEDEN'i bilen ajan, talimat ile gerçek çeliştiğinde DURUP sorar.

## Kapsam
<dahil olan işler — somut dosya/alan>

## Kapsam DIŞI
<bu görevde YAPILMAYACAK işler>

🔴 Bu alan da atlanmaz: scope creep'in en ucuz panzehiri. "Yol üstünde gördüğün şeyi düzeltme"
kuralının somut hali (yan-bug protokolü: gördüğünü LOGLA, düzeltme).

## Kurallar / kısıtlar
- <dokunulmaması gereken dosyalar (sahiplik kilitleri)>
- <uyulacak kanonik desen — hangi mevcut dosyayı örnek alacak>
- <alan sınırı / okuma protokolü kısıtı>

## Bağlam tazeliği
<bu brifin dayandığı keşif/ölçüm ne zaman yapıldı>

Paralel dalga koşuyorsa: başka bir ajan bu sırada merge ettiyse, etkilenen dosyaları YENİDEN OKU
— bellekteki sürüme göre yazma (bayat bağlam sınıfı; kök CLAUDE.md'deki tabloya bak).

## Kabul ölçütü
- [ ] <gözlemlenebilir sonuç 1 — hangi komut ne çıktı verecek>
- [ ] <gözlemlenebilir sonuç 2>

Ölçüt "koşulan komut + beklenen sonuç" biçiminde yazılır; "iyi çalışsın" kabul ölçütü değildir.
Alt ajan raporunda bu maddelere TEK TEK cevap verir (`templates/rapor.template.md`).

## Teslim biçimi
<rapor.template.md — sapma gerekiyorsa burada belirt>

## Fan-out (paralel tur) — yalnız aynı turda birden çok ajan koşuyorsa doldur

**Kardeş ajan sayısı:** <bu turda kaç ajan paralel koşuyor — sen dahil>
**Senin ayrık sorun:** <bu brifin SENDEN istediği, kardeşlerden FARKLI olan soru>

- Paralel turda her brif **AYRI soru** sorar. Aynı soruyu N ajana sormak israftır ve sahte
  konsensüs üretir (N ajan aynı yanlışı bağımsızmış gibi döndürür).
- Kardeşlerin VARLIĞINI bilirsin, BULGULARINI bilmezsin — bağımsızlık kasıtlıdır. Onların
  bulacağını tahmin edip kendi kapsamını daraltma.
- 🔴 **DÖNGÜSEL REFERANS YASAĞI:** bu brifte sana VERİLEN bilgi `KANIT_REFERANSI` olarak GERİ
  DÖNDÜRÜLEMEZ. Brifteki iddia senin için `[BEYAN]`dır: ölçüp doğrularsan `[ÖLÇÜLDÜ]`ye
  yükseltirsin, doğrulamadıysan `[BEYAN]` bırakırsın. Çağıranın kendi cümlesini ona kanıt diye
  geri vermek, doğrulama görüntüsü altında hiçbir şey doğrulamaz.
  (ÖLÇÜLEN VAKA 2026-08-12: iki paralel kâşif turunda biri brifteki cümleyi kanıt olarak geri
  döndürdü; diğeri `[ÖLÇÜLDÜ]` etiketiyle yanlış bir sabit verdi — ana ajan kendi ölçünce çürüdü.)
- Dokunma kümeniz KESİŞİYORSA bu tur paralel KOŞMAMALIYDI — fark edersen RAPORLA ve dur.

## Bağlam kalkanı sözleşmesi (her brifte geçerli — silme)

🔴 **Sen bir BAĞLAM KALKANISIN.** Ana ajanın bağlamı kıt kaynaktır; senin bağlamın harcanabilir.
- Gereken kadar OKU (geniş tara, derine in) — ama ana ajana **ham çıktı taşıma**.
- Dönüşün sentezdir: bulgular + kanıt etiketi + belirsizlik. Terminal dökümü, dosya içeriği,
  uzun alıntı YAPIŞTIRMA. Ana ajan senin okuduklarını değil, SONUCUNU okur.
- **Alt ajan çağırma iznin YOK** (derinlik = 1). Daha fazla keşif gerekiyorsa raporunun
  "sonraki adım" alanına yaz; yeni turu ana ajan açar.
- **Sıkıştırılamaz taahhütler** özetlemede ASLA düşmez: kullanıcı kararı · kabul ölçütü ·
  baseline · secret/prod/maliyet riski · aktif kilitler. Bunlardan birini gördüysen raporuna
  AYNEN taşı — "önemsiz göründü" diye kırpma.
- Emin olmadığını `[DOĞRULANMADI]` ya da ⚠ ile işaretle. Ana ajan senin `[ÇIKARIM]`ını
  doğrulanmamış sayar; bunu bilerek yaz — kesinmiş gibi sunmak dalgayı zehirler.
