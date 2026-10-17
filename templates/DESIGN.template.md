<!--
ÜRETİM TALİMATI (bu blok kopyalanmaz):
- Ne zaman kurulur: FAZ 1'de tespit adımı ≥2 bağımsız sinyal buldu (tailwind.config/theme
  uzantısı, CSS custom properties, components/ui/ envanteri, shadcn/Radix/MUI bağımlılığı) İLA
  hiç sinyal yoksa insan onaylı bir varsayılan/referans seçildi. Sinyal YOKSA VE insan onayı da
  YOKSA bu dosyayı KURMA — onaysız varsayılan, "AI slop"un insan-onaylı versiyonu değil, aynısıdır.
- Nereye yazılır: repo köküne `DESIGN.md` (CLAUDE.md'nin YANINA, İÇİNE DEĞİL).
- SORUMLULUK AYRIMI (karıştırılırsa iki ajan iki alanı birbirine karıştırır):
  * CLAUDE.md = "nasıl KODLANIR" (mimari, davranış, süreç kuralları).
  * DESIGN.md (bu dosya) = "nasıl GÖRÜNÜR" (repo-geneli, statik token sözleşmesi).
  * `[T]` şemasındaki `profile: ui` alanı (templates/T-teknik-dokuman.template.md) = "TEK bir
    ekranın davranışı nereye gider" (navigasyon hedefi, i18n key, kod-anchor'lı, [T] içinde
    yaşar). DESIGN.md bundan AYRI: [T]'den bağımsız, tek dosya, yalnız görsel token taşır.
    Üçü birbirinin YERİNE geçmez.
- {{...}} alanları ÖLÇÜLEREK doldurulur (hafızadan değil): tailwind.config/theme dosyasından,
  CSS custom properties'ten, components/ui/ envanterinden. Sinyal yoksa insan onayından
  (kullanıcıya sorulan "referans marka/stil?" cevabından). Doldurulamayan alanın SATIRINI SİL.
- KAYNAK BEYANI ZORUNLU: her token grubunun altına nereden geldiği yazılır — "ÖLÇÜLDÜ:
  <dosya-yolu>" ya da "VARSAYILAN — insan onayı almadı" (bu iki durumu ayırt etmek şart; ikincisi
  bir gate/hatırlatma adayıdır, `gates/check-self-registry.mjs --rule=design-tokens` bunu ZORLAMAZ, yalnız kullanımı
  denetler — sözleşmenin KAYNAĞINI değil).
- Bu dosya varsa `gates/check-self-registry.mjs --rule=design-tokens` (Kademe 1, statik) devreye girer: UI dosyalarında
  DESIGN.md'de tanımsız hardcoded hex/rgb/inline-style/Tailwind-arbitrary-değer'i UYARIR
  (varsayılan) / bloke eder (`--strict`, CI'da). Bu kapı yalnız TUTARLILIK ölçer, KALİTE ölçmez —
  Kademe 2 (erişilebilirlik) ve Kademe 3 (görsel regresyon/VLM) `templates/ci-workflow.template.yml`
  üzerinden hedef repoya OPSİYONEL CI şablonu olarak reçete edilir; bu paket tarayıcı ÇALIŞTIRMAZ
  (kimlik: kurulum süreci, runtime motoru DEĞİL).
-->
# {{REPO_ADI}} — Tasarım Sözleşmesi

**Durum:** {{TESPIT_EDILDI | VARSAYILAN_INSAN_ONAYLI | VARSAYILAN_ONAYSIZ}}
<!-- TESPIT_EDILDI: ≥2 sinyal, repoda zaten kurulu bir dil var. VARSAYILAN_INSAN_ONAYLI: sinyal
     yoktu, kullanıcıya soruldu, referans seçildi. VARSAYILAN_ONAYSIZ: bu değer varsa dosyayı
     KURMA — süpervizöre çıkar, onay almadan ilerleme (ana talimata bak). -->

## Renk token'ları

| Token | Değer | Kullanım |
|---|---|---|
| {{TOKEN_ADI}} | {{CSS_DEGISKENI_VEYA_HEX}} | {{NEREDE_KULLANILIR}} |

**Kaynak:** {{ÖLÇÜLDÜ: dosya-yolu | VARSAYILAN — insan onayı almadı}}

## Tipografi

| Token | Değer |
|---|---|
| {{FONT_AILESI}} | {{DEGER}} |
| {{OLCEK_ADIMI}} | {{DEGER}} |

**Kaynak:** {{ÖLÇÜLDÜ: dosya-yolu | VARSAYILAN}}

## Spacing / radius / shadow

| Token | Değer |
|---|---|
| {{SPACING_SKALASI}} | {{DEGER}} |
| {{RADIUS_SKALASI}} | {{DEGER}} |
| {{SHADOW_SKALASI}} | {{DEGER}} |

**Kaynak:** {{ÖLÇÜLDÜ: dosya-yolu | VARSAYILAN}}

## Bileşen envanteri

<!-- "Buton icat etme, var olanı kullan" — envanter isim + import yolu taşır, pixel-perfect
     mockup ZORUNLU DEĞİL. Ajan yeni bir Button/Card/Modal yazmadan önce burayı okur. -->

| Bileşen | Import yolu | Notlar |
|---|---|---|
| {{BILESEN_ADI}} | {{IMPORT_YOLU}} | {{VARYANT_VEYA_KISIT}} |

## Yasaklar

<!-- LLM'ler pozitif yönergeden çok yasaklara uyar (dış araştırma, Kimi-k3 bulgusu). -->
- Token dışı hardcoded renk (hex/rgb) — `gates/check-self-registry.mjs --rule=design-tokens` bunu yakalar.
- Inline `style=` özniteliği.
- Tailwind arbitrary değer (`w-[437px]` gibi) — skalada karşılığı yoksa DESIGN.md'ye token olarak ekle, uydurma.
- {{REPO_OZGU_YASAK_VARSA}}

## Bilinen sınırlar

<!-- Eksiksizlik hacim değil sınır iddiasıdır (dış araştırma). Bu bölüm zayıflık değil güven
     kaynağıdır — boşsa "sınır yok" diye SİLME, "şu an bilinen sınır yok" yaz. -->
- {{VARSA: dark-mode desteklenmiyor, mobile breakpoint tanımsız, vb.}}

## Görsel doğrulama (opsiyonel, Kademe 2-3)

<!-- Bu bölüm yalnız kullanıcı `ui_quality: strict` seçtiyse veya UI-ağır repo ise doldurulur.
     Paket kendisi render YAPMAZ — CI şablonuna reçete bırakır (templates/ci-workflow.template.yml). -->
- Erişilebilirlik taraması: {{axe-core | Lighthouse | KURULMADI}}
- Görsel regresyon baseline: {{VARSA_YOL}} — **ilk baseline insan onayıyla kilitlenir**, aksi
  halde kötü bir ekran "referans" olarak korunur (dış araştırma, GPT-5.5-pro bulgusu).
