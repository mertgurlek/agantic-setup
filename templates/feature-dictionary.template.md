<!--
ÜRETİM TALİMATI (v0.20 — konfig ekseni toggle'ı AÇIKSA kurulur, kapalıysa TEK satırı bile kurulmaz):
  Hedef: `docs/FEATURE-DICTIONARY.md`. Bu dosya ÇOK-KİRACILI ürünün kanonik sözleşmesidir:
  "hangi özellik/ayar hangi ADLA anılır ve kapısını FİİLEN kim uygular".

  🔴 HER DEĞER ÖLÇÜLEREK DOLDURULUR — tek satır uydurma. Kaynak: lisans/yetki kontrolünü
  gerçekten yapan kodun kendisi (enum/sabit tanımı + kontrol çağrıları), doküman DEĞİL.
  (doctrine: "türetilmiş katman YÖN GÖSTERİR, KANIT DEĞİLDİR".)

  Zorlayan kapı: `gates/check-provenance.mjs --rule=config-flags` — bu dosya VARSA konfig ekseni
  KURULU sayılır ve her [L0] "bu özelliğe kim erişir" sorusunu cevaplamak ZORUNDADIR. Bu dosya
  YOKSA alt-kural tümüyle no-op'tur (kullanmayan ödemez).
  ⚠️ Aşağıdaki ```yaml bloğu MAKİNE OKUR — silme, biçimini bozma. Nesir bölümler insan içindir.
-->

# Özellik Sözlüğü — {{URUN_ADI}}

> Kanonik kaynak: **{{KANONIK_REPO}}**. Bir ad burada nasıl yazılıysa öyledir; türev repolar
> (web/mobil/connector) bu dosyayı KOPYALAMAZ, buraya ATIF yapar.

```yaml
# --- MAKİNE-OKUNUR SÖZLEŞME (kapı bu bloğu okur) --------------------------------------
canonical_source: {{KANONIK_REPO}}   # kapıyı FİİLEN uygulayan repo — "en çok kod olan" değil,
                                     #   erişimi GERÇEKTEN reddeden kod nerede yaşıyorsa orası.
consumers: []                        # bu sözleşmeye UYAN türev repolar, örn. [web, mobil]

features:                            # ÖLÇÜLEREK doldurulur; enum'da olmak ≠ kapı uygulanmak
  - name: {{OZELLIK_ADI}}            # KANONİK ad (birebir yazım — kapı case-insensitive DEĞİL)
    enforced_in: {{KANONIK_REPO}}    # kontrolü fiilen yapan repo
    checks: 0                        # ÖLÇÜLEN kontrol sayısı; 0 = enum'da VAR ama kodda hiç
                                     #   kontrol edilmiyor (bu bir BULGUDUR, hata değil — yaz)
```

## Nasıl ölçülür (6 adım — atlanmaz)

Bir özelliğin/ayarın gerçek davranışını çıkarmak için **grep yetmez**; sırayla:

1. **İşleyiciyi AÇ** — üst katman dokümanının `flags`/`config` alanı KANIT DEĞİLDİR, yön gösterir.
2. **Lisans deseni var mı?** Bir kod tabanında lisans kontrolü genelde BİRDEN ÇOK biçimde yazılır
   (doğrudan çağrı · liste üzerinde arama · attribute/decorator). Birini bulunca DURMA, ötekini de ara.
   Hiçbiri yoksa → `paid_feature: null` (ölçüldü, kapı yok).
3. **Ayar okunuyor mu?** ⚠️ İşleyicinin ÇAĞIRDIĞI SERVİSTE de bak — "gövdesinde yok" ≠ "yapmıyor"
   (doctrine: kanıt = kaynak VE çağırdığı bir seviye alt).
4. **Alanın TİPİNİ ve varsayılanını oku** — ayar varlığındaki gerçek tip (`bool`/sayı/enum/metin)
   ve kullanıcının fiilen yaşadığı varsayılan; ikisi de kaynaktan (initializer/config/factory),
   dokümandan DEĞİL. ⚠️ Tipi varsayma: alanların önemli bir bölümü boolean değildir.
5. **Sınıflandır** — aşağıdaki dört sınıftan biri.
6. **Kapıyı koş** — `check-provenance --rule=config-flags`; 0 bulgu olmadan iş kapanmaz.

## Ayar TİPİ önce gelir — şema açık/kapalı VARSAYMAZ (v0.20.1)

Ölçüldü (gerçek bir üründe, birkaç ayar varlığı, yüzlerce alan): **yaklaşık üçte biri boolean DEĞİL** — sayı eşiği,
enum/seçim, metin. Bu alanlarda "kapalıysa ne olur" sorusunun cevabı YOKTUR; davranış **değere**
bağlıdır. Bu yüzden önce `tip` ölçülür:

| `tip` | Ne demek | Nasıl yazılır |
|---|---|---|
| `bool` | açık/kapalı | `when_false: <sınıf>` (kısayol) |
| `sayi` | eşik/limit/adet | `kosul: "... aşarsa"` + `etki_sinifi` |
| `secim` | enum — davranış SEÇER (`...Behavior` adlı alanlar) | `kosul: "... seçiliyse"` + `etki_sinifi` |
| `metin` | serbest değer | `kosul: "... boşsa/doluysa"` + `etki_sinifi` |

🔴 bool olmayan alanda `when_false` YAZMA — uydurma olur, kapı reddeder.

## Beş sınıf (`etki_sinifi` / `when_false`) — cevabın TONUNU bu belirler

| Sınıf | Kodda tipik karşılığı | Kullanıcıya ne denir |
|---|---|---|
| `engel` | hata fırlatır / erişim reddedilir | "Yapamazsınız, yöneticinize başvurun" |
| `kisit` | doğrulama başarısız olur | "Şu alanı da doldurmalısınız" |
| `hesap` | sonuç/hesaplama değişir | "Şirketinizde şöyle hesaplanıyor" |
| `gorunurluk` | **sessiz filtre** — boş liste döner | "Eksik veri görüyorsanız bu ayar kapalı olabilir" |
| `kapsam` | **erken çıkış** — işlem yapılır ama BAĞLI kayıtlara uygulanmaz | "İşlem yapıldı; bağlı kayıtlarınız etkilenmemiş olabilir" |

🔴 **Son iki sınıf en tehlikelileridir: kullanıcı HATA GÖRMEZ.** `gorunurluk`ta eksik VERİ görür,
`kapsam`da işlem eksik ÇALIŞIR — ikisi de destek kaydına "sistem bozuk" diye düşer, ikisinin de
cevabı farklıdır. `kapsam` ölçülerek eklendi (2026-08-12): bir işlem, özellik kapalıyken bağlı
alt kayıtlara dokunmadan sessizce dönüyordu. Kod kalıbı: `if (!ozellikAktif) return <kısmi sonuç>;`

> ⚠️ Sınıf listesi ÖLÇÜMLE büyür, tahminle değil. Aynı turda iki aday sınıf daha değerlendirildi
> ("giriş noktası hiç görünmüyor", "akış değişir") ve **kanıt bulunamadığı için EKLENMEDİ** —
> istemciye giden yetenek bayrakları vardı ama tüketen yüzeyde kullanımları doğrulanamadı.
> "Enum'da olmak ≠ kapı uygulanmak" kuralı sınıf listesine de uygulanır.

## Çok-repo drift'i — dört kural

Aynı sözleşmeyi birden çok repo taşıyorsa (backend + web + mobil) drift KAÇINILMAZDIR; tek
savunma sahipliktir:

1. **Kanonik kaynak = kapıyı FİİLEN uygulayan repo.** Erişimi reddeden kod nerede yaşıyorsa
   sözleşme oradadır; en büyük repo ya da ilk yazılan repo değil.
2. **Kapı kanonik repoda yaşar ve ötekileri ORADAN denetler.** Türev repo kendi kopyasını koşmaz.
3. **Kapı KOPYALANMAZ** — kopya = ikinci kaynak = drift'in kendisi. (Bu, kök CLAUDE.md'deki
   "TEK kanonik konum" kuralının çok-repo hâlidir.)
4. **Denetlenen DOKÜMAN ATFIDIR, kod adlandırması DEĞİL.** Her dil kendi konvansiyonunu kullanabilir
   (`LoyaltyProgram` / `loyalty_program`); sözleşme dokümanın hangi kanonik ada ATIF yaptığıdır.
   Kod adlandırmasını denetlemek yanlış-pozitife boğar ve kapıyı öldürür.

> **Paylaşım mekanizması yoksa drift kaçınılmazdır:** sözleşme bir paket/şema olarak
> paylaşılamıyorsa (yalnız derleme-zamanı alias, kopyala-yapıştır), bunu bir BULGU olarak yaz —
> kapı adlandırma drift'ini görebilir ama paylaşım mekanizmasını KURAMAZ.

## Bilinen boşluklar (dürüstlük kaydı)

> Ölçülemeyen/atlanan her şey buraya YAZILIR — boş bırakmak da bir cevaptır, ama beyan edilmiş
> olmalı. "Enum'da var ama kodda hiç kontrol edilmiyor" bir BULGUDUR; sil değil, `checks: 0` yaz.

| Özellik/ayar | Ne ölçülemedi | Neden | Tarih |
|---|---|---|---|
| {{ORNEK_OZELLIK}} | {{OLCULEMEYEN}} | {{NEDEN}} | {{TARIH}} |
