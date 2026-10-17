<!--
ÜRETİM TALİMATI: Bu dosya birkaç ayrı şablonu ayraçlarla içerir. Kurulumda her bölümü
kendi dosyasına çıkar; {{...}} alanlarını FAZ 1 bulgularıyla doldur.
Seviye/toggle eşlemesi:
  DECISIONS = [ORTA+]  ·  STATE = [ORTA+ ve toggle: takip.state]   ·   TECH_DEBT+BASELINE+wave = [BÜYÜK]
  GUARDS = [tüm seviyeler]    ·   PRODUCT_LOG = [toggle: PM]   ·   FRICTION_LOG = [daima]
  GARDEN_LOG = [BÜYÜK — gerçek dalga/drift olan yer; ORTA'da gözlemle aç]
-->

<!-- ===== docs/STATE.md — tek durum kaynağı, her dalga sonu süpervizör günceller ===== -->
# Proje Durumu — son güncelleme: {{TARIH}}

> Tek kural: geçmiş git'te, gelecek burada, anlatı hiçbir yerde.
> 40 satırı geçerse en eski "tamamlanan" satırları silinir.

## Aktif iş  ← CANLI BOARD (tek kaynak: "şu an ne koşuyor?")
<!-- Bu tablo bir BOARD'dur: aktif iş varken doldurulur, iş BİTİNCE satır SİLİNİR (arşiv değil —
     geçmiş git'te yaşar). İkinci bir "board" dosyası AÇMA; canlı durum tek yerde durur.
     Paralel iş varsa her biri AYRI SATIR — "Dokunma kümesi" sütunu çakışma denetiminin verisidir:
     iki satırın kümesi KESİŞİYORSA paralel koşmazlar (bkz. CLAUDE.md bayat-bağlam tablosu).
     🔗 "Dokunma kümesi" = `plan.template.json` → `plan_adimlari[].write_set` ile AYNI KAVRAM
     (biri insan-okur dalga board'u, diğeri makine-okur plan verisi). Plan varsa buraya write_set'in
     ÖZETİ yazılır — iki yerde FARKLI küme yazmak sürüklenmedir. Makine tarafı zaten kesişimi
     warn-only denetler (`check-process-discipline --rule=plan-exists`). -->
| ID | Konu | Mod | Rol/ajan | Durum | Dokunma kümesi (glob) | Kilitli dosyalar |
|----|------|-----|----------|-------|----------------------|------------------|
| — | — | — | — | — | — | — |

## Sıradaki (öncelik sırasıyla)
| # | İş | Boyut | Bloke eden |
|---|-----|-------|------------|
| 1 | {{ILK_IS}} | — | — |

## Tamamlanan (son 5 — fazlası git log'da)
| ID | Konu | Tarih | DECISIONS girdisi? |
|----|------|-------|--------------------|

<!-- ===== docs/DECISIONS.md — append-only, ASLA düzenlenmez/silinmez (`check-history --rule=append-only`) ===== -->
# Mühendislik Kararları (append-only)

> Sadece KALICI mimari seçimler — tercih günlüğü değil. 3-6 satır/karar.
> Bir ajan "bu garip, düzelteyim" derse önce burayı okur.

## {{TARIH}} · Agentik altyapı kuruldu (agentic-repo-setup v0.8)
**Bağlam:** {{NEDEN_KURULDU}}
**Karar:** kapılar + kanonik CLAUDE.md + {{KURULAN_SEVIYE}} seviye + {{ACIK_TOGGLELAR}} toggle'lar.
**Etki:** ajanlar CLAUDE.md'deki öncelik sırasına ve çıkış raporu formatına uyar.

<!-- ===== docs/PRODUCT_LOG.md [toggle: PM] — append-only ürün hafızası ===== -->
# Ürün Günlüğü (append-only)

> Git "kod ne değişti"yi tutar; bu dosya "ürün NEDEN değişti, kim onayladı"yı tutar.
> Sadece kullanıcı-görünür / ürün-kararı değişiklikleri. 3-6 satır/girdi. ASLA düzenlenmez.

## {{TARIH}} · {{DEGISIKLIK_BASLIGI}}
**Ne değişti (kullanıcı-görünür):** {{NE}}
**Neden / hangi problem:** {{NEDEN}}
**Onaylayan:** {{KIM}} · **İlgili:** {{FEATURE_ID_VEYA_LINK}}

<!-- ===== docs/FRICTION_LOG.md [daima] — append-only öz-gözlem ===== -->
# Sürtünme Günlüğü (append-only)

> Sistemin KENDİ kurallarının yarattığı sorun (gereksiz tören, yanlış-pozitif kapı, çelişen
> rehber, yanıltan format). İki kural: (1) kaydı Hakem/insan onaylar, ajan değil; (2) kural
> ancak TEKRAR EDEN desen (3+) görülünce değişir. Reflection/bahçıvan turu bunu okur.

| Tarih | Hangi kural/kapı | Ne engelledi/yanılttı | Tekrar mı (kaçıncı) | Onaylayan |
|-------|------------------|------------------------|---------------------|-----------|
| {{TARIH}} | {{KURAL}} | {{NE}} | 1 | {{KIM}} |

<!-- ===== docs/GARDEN_LOG.md [BÜYÜK] — append-only bahçıvan turu + atlanan-kontrol borcu ===== -->
# Bahçıvan Günlüğü (append-only)

> NEDEN VAR: FRICTION_LOG sistemin KENDİ kuralının sürtünmesini izler; bu dosya KODUN
> zamanla SÜRÜKLENMESİNİ (drift) izler. İkisi kardeş — ikisi de append-only öz-gözlem.
> "Dalga sürüklenmesi 5. dalgada görünür" (doctrine): bağımsız dalgaların kısmen-doğru
> fix'leri birikir (kopya soyutlama, sapan zarf, ölü test). Bu defter olmadan her bahçıvan
> turu amneziktir — "bunu geçen turda da görmüştük" bilgisi hiçbir yerde birikmez.
> İki kural (FRICTION_LOG ile aynı): (1) bulguyu Hakem/insan onaylar; (2) konsolidasyon
> kararı 3+ tekrarda olgunlaşır, tek vakayla değil. Bahçıvan/güvenlik-tarama turu bunu okur+yazar.

## 1. Drift bulguları (periyodik bahçıvan turu — kopya/sapma/ölü kod)

> Her tur: yeni kopya soyutlama? sapan hata-zarfı? ölü test/yol? bypass edilen kapı?

| Tarih | Tur # | Tespit (drift türü) | Kanıt (yol/grep) | Tekrar mı (kaçıncı) | Konsolide edildi mi | Onaylayan |
|-------|-------|---------------------|------------------|---------------------|---------------------|-----------|
| {{TARIH}} | 1 | {{NE_DRIFT}} | {{KANIT}} | 1 | {{EVET/HAYIR/ertelendi}} | {{KIM}} |

## 2. Atlanan-kontrol borcu (test edilmemiş davranış — dalga kapanınca buraya akar)

> Çıkış raporundaki "atlanan kontroller" ölümlü dalga dosyasında doğar ve dalga kapanınca
> SİLİNİR; bilinçle kabul edilmiş bu RİSK BORCU kaybolmasın diye buraya bir satır düşer.
> (Kod borcu TECH_DEBT'te; bu "test edilmemiş davranış borcu" — ayrı sınıf.) Bahçıvan turu
> en eski açık satırı yeniden değerlendirir: hâlâ kabul edilebilir mi, kapatıldı mı?

| Tarih | Dalga/İş | Atlanan kontrol (hangi eksen/durum) | Neden atlandı | Risk | Durum (açık/kapandı) |
|-------|----------|-------------------------------------|---------------|------|----------------------|
| {{TARIH}} | {{IS}} | {{ATLANAN}} | {{NEDEN}} | {{RISK}} | açık |

## 3. Anlama borcu (comprehension debt — İNSANIN sistemi anlama hızı)

> **Neden ayrı sınıf (v0.25):** §1 kodun sapmasını, §2 test edilmemiş davranışı tutar. Bu üçüncü
> sınıf **insanın kendi anlama borcunu** tutar: ajanın ürettiği kod, senin sistemi anlama hızından
> HIZLI büyür. Kod doğru olsa bile "nasıl çalıştığını artık bilmiyorum" ölçülmeyen bir borçtur.
> **Panzehir iki ritüeldir** ve ikisi de bahçıvan turunda koşar:
> ① yazmadığın diff'leri OKU (örnekleme yeter, hepsi değil) ·
> ② **kapının hâlâ DOĞRU hatayı yakaladığını doğrula** — negatif deneyi yeniden koş.
> ②(nin) gerekçesi ölçülmüştür: bu repoda bir kapı, aradığı yapıyı hiç bulamadığında sessizce
> "temiz" diyordu (yokluk körlüğü). Kapı yeşil yanarken de bozulabilir.

| Tarih | Tur # | Ne anlaşılmıyor (alan/akış) | Neden borç doğdu | Kapatma eylemi (diff oku / negatif deney) | Durum |
|-------|-------|-----------------------------|------------------|-------------------------------------------|-------|
| {{TARIH}} | {{TUR_NO}} | {{ANLASILMAYAN}} | {{NEDEN}} | {{KAPATMA_EYLEMI}} | açık |

> 🔴 **Çürütme koşulu:** iki ardışık bahçıvan turunda bu tabloya HİÇ satır girmiyorsa ritüel
> koşmuyor demektir — bölümü kaldır (mekanizmasız kural gürültüdür), STATE'e gerekçesini yaz.

<!-- ===== docs/TECH_DEBT.md [BÜYÜK] — borç defteri ===== -->
# Teknik Borç

> Her satırda son-doğrulama tarihi zorunlu. Hakem her dalgada EN AZ 1 satırı yeniden
> doğrular — 3 aydan eski doğrulamalı satır "şüpheli" sayılır.

| Borç | Önem | Son doğrulama | Durum |
|------|------|---------------|-------|
{{FAZ1_BULUNAN_BORCLAR}}

<!-- ===== docs/BASELINE.md [BÜYÜK] — kanıt manifestosu ===== -->
# Baseline — beklenen yeşil durum

> Her yeşil CI sonrası değişiklik varsa güncellenir. Ajan failure görünce önce buraya bakar.

| Kontrol | Beklenen | Ölçüm tarihi |
|---------|----------|--------------|
| {{VERIFY_KOMUTU}} | yeşil, ~{{VERIFY_SURESI}} | {{TARIH}} |
| lint | 0 hata | {{TARIH}} |
| testler | {{TEST_SAYISI}} geçer, ~{{TEST_SURESI}} | {{TARIH}} |

<!-- ===== docs/GUARDS.md — guard kayıt defteri (TÜM seviyeler) ===== -->
# Guard Kayıt Defteri — budama yasasının verisi

> Budama kuralı: Sil ⟺ FP oranı yüksek VEYA invariant öldü. "Hiç ateşlemedi" tek başına
> neden DEĞİL — sigorta-guard'lar duman dedektörüdür. Güvenlik-tarama/budama turu günceller.
> Sınıf sütunu (doctrine taksonomisi): KALİTE (iddiayı doğrular) / VARLIK (alan dolu mu) / sigorta.

| Kapı | E-katman/halka | Savaştığı entropi | Son GERÇEK yakalama | FP | Sınıf |
|------|----------------|-------------------|---------------------|-----|-------|
| {{KAPI}} | E0 {{hook/ci}} | {{NE}} | {{TARIH+OLAY veya "henüz yok"}} | 0 | {{KALITE/VARLIK/sigorta}} |

<!-- ===== .claude/waves/{{ID}}.md şablonu [ORTA+] — GEÇİCİ, dalga kapanınca silinir/arşivlenir =====
     v0.18.1 (K34): seviye [BÜYÜK]→[ORTA+] indirildi. Gerekçe: çok-ajanlı dalga ORTA repolarda da
     koşuyor (roller ORTA'da zaten kuruluyor: kasif+uygulayici+hakem) — dalga dosyası olmadan
     "kim neye dokunuyor" görünmez kalıyordu. KÜÇÜK'te hâlâ KURULMAZ (tek ajan, tören maliyeti).
     STATE.md "Aktif iş" board'u ÖZET görünümdür; bu dosya dalganın DETAYIDIR (kilit + raporlar). -->

# {{DALGA_ID}} · {{KONU}} · {{TARIH}}

Mod: hafif / tam · Plan: {{PLAN_LINKI_VEYA_3_SATIR}}

## Kilitler (bu dalgada bu dosyalara sadece atanan ajan dokunur)
- {{DOSYA}} → {{ROL}}

## Çıkış raporları
### {{ROL}} ({{SAAT}})
- Değişen: {{DOSYALAR_VE_SATIR}}
- Koşulan: {{KOMUTLAR_VE_SONUC}}
- Context: en pahalı kaynak {{HOTSPOT}} · focus summary gerekli miydi {{EVET/HAYIR}}
- Failure sınıfı: baseline / benim / ortam / flaky / engel / sistem-kuralı / yok
- Atlanan: {{VARSA}}

### hakem ({{SAAT}})
- Rapor doğrulandı mı (komutlar gerçekten koştu mu): ✓/✗
- Asıl görev hedefi karşılandı mı: ✓/✗ · İnvariant/ikiz/yerleşim: ✓/✗
- VERDICT: kapanabilir / düzeltme gerek

## Ölçüm satırı (kapanışta WAVES.log'a)
`{{DALGA_ID}} | {{KONU}} | {{MOD}} | {{CONTEXT_HOTSPOT}} | {{HAKEM_BULGU_SAYISI}} | {{SURE}}`
