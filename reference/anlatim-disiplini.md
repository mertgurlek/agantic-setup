# Anlatım disiplini — sunum ve ajan-aktarımı ortak kökü, ayrışan dalları

> Kaynak: dış araştırma (web + 3 bağımsız model: Gemini 3.1 Pro, GPT-5.5, Claude Sonnet 5) +
> bu repodaki 5 pilot sunumun ve 7 aktarım şablonunun ölçülerek denetimi (2026-07-28).
> Zorlayıcı: `gates/check-history.mjs --rule=stale-constants` (K3) · `templates/devir.template.md` (K2-K4) ·
> `.claude/agents/uygulayici.md` (K3, kanıt etiketleri). Kural → mekanizman yoksa yazma.

## Kök teşhis

Hem 5 sunum hem çıkış raporu/devir şablonlarında **aynı hastalığın** iki yüzeydeki belirtisi
bulundu: içerik **yazarın aktivitesi** ekseninde kurulu ("ne yaptım"), **okuyanın vereceği karar**
ekseninde değil ("bu bana ne fark ettirir, şimdi ne yapmalıyım"). "Çok detaylı ↔ çok özet" salınımı
bu kök hatanın belirtisidir — her geri bildirime HACİMLE cevap verilir (slayt ekle/çıkar), YAPIYA
dokunulmaz.

## Sunum ≠ aktarım — kopyalamadan önce ayrım şart

İnsan→insan sunumu **ikna** metnidir; ajan→developer/ajan aktarımı **kanıt zinciri**dir. Bu iki
tür karıştırılırsa ya sunum kupkuru bir log'a döner (okunmaz) ya da aktarım pazarlama diline kayar
(halüsinasyon maskelenir).

| Boyut | Sunum | Aktarım |
|---|---|---|
| İkna | Meşru | **Zehir** — ajan kendi işini pazarlamaz |
| Kısalık | Erdem (dikkat kıt) | Yalnız doğrulanabilirlik düşmüyorsa |
| Sıkıştırma | Kayıplı olabilir | **Kayıpsız** — kritik kısıt asla düşmez |
| Belirsizlik | Yumuşatılır | **Açıkça işaretlenir** |
| Okuyucu | İnsan, boşluğu bağlamla doldurur | Çoğu zaman ajan/LLM — boşluğu **halüsinasyonla** doldurur |
| Başlık | İddia cümlesi işe yarar ("Mimari X'i 3 kata çıkarıyor") | **Durum sinyali** gerekir ("ENGEL: migration uygulanamadı") — iddia başlığı ayrıştırmayı bozar |

## Ortak 6 kusur — sunumda bulunan, aktarımda nasıl yaşadığı

Bunlar 5 pilot sunumda ölçülerek bulundu (bkz. karar defteri K25). Her biri aktarım yüzeyinde ya
AYNEN geçerli, ya DÖNÜŞEREK geçerli, ya GEÇERSİZ:

- **K1 — "ne yaptım" ekseni:** DÖNÜŞÜR. Aktarımda "ne değişti" gerekir ama ana eksen değildir;
  ana eksen "devralan ne yapmalı / neye dokunmamalı".
- **K2 — ASK/istem yok:** DÖNÜŞÜR. İnsana soru değil, **bloke eden karar noktası** (seçenek +
  önerilen varsayılan). Devir dosyası "TODO listesi" değil "karar noktası" taşımalı.
- **K3 — bayat sayı:** AYNEN geçerli, daha kritik. "19 kapı" diyen sunum doğruydu; "15/16 kapı"
  diyen ikisi 22 Temmuz'da donmuştu — biri `ÖLÇÜLDÜ` etiketiyle bile. Ajan raporunda "9 dosya
  değiştirdim" derken gerçek 6 ise güven tamamen çöker. **Zorlayıcı:** her ölçüm komut + zaman
  + commit ile damgalanır; sayı hiçbir zaman hafızadan yazılmaz (`kasif.md` "Sabit verme yasağı"
  ile ajanlar için zaten var — bu kural buraya, aktarım şablonlarına da taşınır).
- **K4 — kapsam/sınır beyanı yok:** AYNEN geçerli, ZORUNLU hale gelir. "Neyi test etmedim",
  "hangi varsayımla geçerli", "nerede kırılır" aktarımın merkezidir — eksikse devralan kapsam
  dışını da güvenli sanır.
- **K5 — etiket başlık:** TERSİNE döner. Sunumda iddia iyi; aktarımda başlık **makine anahtarı**
  olmalı (`STATUS: FAILED`, `ENGEL: ...`) — serbest iddia formatı parse'ı bozar.
- **K6 — jargon tanım sırası ters:** KISMEN geçersiz. Ajan→ajan aktarımında ortak sözlük
  varsayılabilir (repo bağlamı paylaşılıyor); ajan→insan aktarımında hâlâ geçerli.

## Ajan aktarımına özgü kusurlar (sunumda karşılığı yok)

| Kusur | Tespit yolu |
|---|---|
| Fantom başarı — "güncelledim" der, diff boş | İddiayı `git diff --stat` ile çapraz doğrula |
| Sahte kesinlik — çalıştırmadığı teste "geçti" der | Kanıt kaynağı yoksa iddia `DOĞRULANMADI` sayılır |
| Negatif sonuç gizleme — fail testi rapora yazmaz | "Başarısız/atlanan doğrulama" alanı zorunlu; boşsa gerekçe |
| Kısıt düşürme — blocking'i "ufak sorun"a indirir | Şiddet serbest metin değil sabit sınıf (bloke/uyarı) |
| Kendi işini övme — "temiz çözüm", "mükemmel" | Şablonda değerlendirme alanı YOK — yalnız olgu + kanıt |
| Zamansız doğruluk — dünkü test bugün geçerli sanılır | Her ölçüm HEAD + zaman damgalı |

## Güven kalibrasyonu — repoda zaten var, dağınık

Kanıt etiketleri (`ÖLÇÜLDÜ`/`BEYAN`/`ÇIKARIM`/`ÖLÇÜLMEDİ` ailesi) bugün `hakem.md` ve kapılarda
yaşıyor ama `devir.template.md`, `uygulayici.md` çıkış raporunda YOK. Bu asimetri kapatılır —
yeniden icat edilmez, `hakem-verdict.template.json`'daki `timestamp` zorunlu-alan deseni
`devir.template.md`'ye taşınır.

**Kural: etiketsiz iddia otomatik `DOĞRULANMADI` sayılır.** Varsayılan güvensizlik — ajanın
sessizliği güven üretmeyecek.

**Kanonik tanım (TEK KAYNAK — `uygulayici.md`/`sunum-yazari.md` buraya link verir, kopyalamaz):**

| Etiket | Anlamı |
|---|---|
| `[ÖLÇÜLDÜ]` | komut+çıktı+zaman damgası — gerçekten çalıştırdın, gördün |
| `[BEYAN: kaynak]` | biri (kullanıcı/başka ajan/dosya) söyledi, sen test etmedin |
| `[ÇIKARIM]` | koddan/dokümandan mantık yürüttün, doğrudan ölçmedin |
| `[DOĞRULANMADI]` | kontrol edemedin + neden — etiketsiz cümle otomatik bu sayılır |

## Eksiksizlik = hacim değil, sınır iddiasıdır

"Tez gibi eksiksiz" isteğinin çözümü daha çok sayfa değildir. Bir belge eksiksiz HİSSETTİRİR çünkü
sınırlarını açıkça çizer, hacmini artırdığı için değil:

- Kapsam + Kapsam-Dışı beyanı ("Bu bir runtime motoru DEĞİLDİR")
- Açık sorular / bilinmeyenler listesi ("düşünmedik" eleştirisini "düşündük, ertelendi"ye çevirir)
- Zayıflığı GİZLEYEN belge şüphe uyandırır; zayıflığı ADLANDIRAN belge güven uyandırır

Bu ilke katmanlı belge mimarisiyle birleşir: Karar Notu (5-8 slayt) → Benimseme Notu → Uygulama
Kılavuzu → Tam Referans. Karar Notu asla Tam Referans'a GİRMEZ, yalnız LİNK verir.

## Sunum HTML teknik gereksinimleri (sunum-yazari.md için TEK KAYNAK)

`<!doctype html>` + `<html lang="tr">` + `<meta charset="utf-8">` + `<meta name="viewport">`
ZORUNLU — bunlar eksikse Türkçe karakter bozulur ve quirks mode'a düşer (ölçülmüş kusur, K25).
Dış CDN'e (fonts/CSS/JS) bağımlı kalma — sunum internetsiz açılmalı; gerekiyorsa gömülü
(`<style>`/`<script>` inline) üret.

**Türkçe üslup:** cümle ~25 kelimeyi geçmezse böl; "-nin yapılması" yerine fiil; edilgen yalnız
özne gerçekten önemsizse. Terim sözlüğü tek (depo/ajan/kapı/betik/kanca) — kod-satırı isimleri
(marketplace, commit, plugin) çevrilmez, kavram isimleri çevrilir.

## Tek altın kural (her iki yüzey için)

> Her iddianın yanında onu çürütebilecek kanıt ya da "kanıtım yok" itirafı bulunmadıkça,
> o iddia yazılmamış sayılır.
