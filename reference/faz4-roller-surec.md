# FAZ 4 — Roller + Süreç (tam talimat)

> SKILL.md FAZ 4'ün ağır gövdesi buraya taşındı (v0.13.1 budaması — SKILL tavan baskısı;
> FRICTION_LOG 2026-07-22 kaydının önerisi). SKILL.md'deki iskelet bağlayıcıdır; uygulama
> sırası ve ayrıntı buradadır. Kurulum ajanı FAZ 4'e gelince BU dosyayı okur.

1. `templates/roles.template.md`'den rolleri `.claude/agents/` altına kur. Roller evrensel
   KONTROL artefaktıdır (süreç boilerplate'i) — "kopyalama" yasağı repo-GERÇEKLERİ içindir;
   {{}} alanlar repo-özgü doldurulur, alakasız roller SİLİNİR. ORTA = kasif+uygulayici+hakem;
   BÜYÜK = + ui/server; qa-gezgini/guvenlik-tarama BÜYÜK'te bile İLK DALGALARDAN SONRA açılır.
   [toggle: PM] pm-sorgu (salt-okunur ürün rolü); [toggle: QA] uygulayıcıya 3-eksen senaryo
   (veri-durumu/persona/akış-kesintisi) çıkış-kapısı — reference/multi-team.md'den.
   Tavan 40 satır/rol; roller kök CLAUDE.md'nin DELTASIDIR — global kural tekrarı yasak.
   **Bölme doğrulaması:** her dosyada ① frontmatter var mı, ② `name:` dosya adıyla eşleşiyor mu,
   ③ ayraç yorumları temizlendi mi, ④ **`model:`/`effort:` satırları ya doldurulmuş ya TAMAMEN
   silinmiş mi** (`<...>` yarım kalırsa check-hygiene --rule=placeholders FAIL verir; SKILL §2 rubriğine bak) —
   dördünü kontrol et.
2. **İKİ maliyet ekseni: `model:` + `effort:`** — rol frontmatter'ında İKİ BAĞIMSIZ eksen (HANGİ
   model / NE KADAR düşünme). Rubrik, telemetri ve değer kaynağı: `reference/model-effort-tiering.md`
   (kanonik, ağır gerekçe orada). Satır ya doldurulur ya TÜMÜYLE silinir; `<...>` yarım kalırsa
   `check-hygiene --rule=placeholders` FAIL. **`thinking:` YAZMA:** rol-başına thinking ayarı YOKTUR (ana oturumdan
   miras); yazılırsa sessizce yok sayılır → derinliği `effort:` ile ayarla. cost-ledger yalnız
   telemetriden türetilir (`scripts/token-audit.mjs`), ajan self-report'uyla ASLA.
2a. **Uyarlanır roller + tek-ajana düş (v0.7):** sabit roller her repoya tam oturmaz; rolleri
   repoyu ÖLÇEREK taslakla, ama yetki zarfı (özellikle Hakem salt-okunur) İNSAN ONAYINDAN geçince
   aktifleşir — hiçbir üreteç bunu otomatik genişletemez. [tasarım] runtime rol
   fabrikası bilinçle REDDEDİLDİ (yetki garantisini disipline düşürür). **Gerçek paralellik yoksa
   tek-ajana düş:** roller L4 (en düşük ROI); paralellik kanıtı olmadan rol/dalga kurmak entropidir.
   Bu kural YAZAN işler içindir — salt-okur fan-out KAPSAM DIŞI (tam gerekçe: D-19,
   `reference/orkestrasyon-ve-paralellik.md`). Koordinasyon sürtünmesi 3+ tekrar ederse çok-ajanı
   buda (FRICTION_LOG → Hakem onayı). Delegasyon brifi = amaç + kurallar + NEDEN + kabul ölçütü
   (sadece görev değil). Detay: v0.7 karar defteri.
2b. **BRİF/RAPOR ÇİFTİ (v0.17.2 K31) — delegasyonun giriş/çıkış sözleşmesi.** v0.7'den beri kural
   nesirde vardı ("brif = amaç + kurallar + NEDEN + kabul ölçütü") ama ŞABLONU yoktu; ölçüm
   (2026-08-06) gösterdi ki alt-ajan DÖNÜŞÜ yalnız Hakem için yapılandırılmıştı (verdict JSON +
   kapı) — kâşif/uygulayıcı raporunu boş üretse hiçbir mekanizma görmüyordu.
   - `templates/brif.template.md` kur: rol · **ağırlık** · amaç · **NEDEN** · kapsam · **kapsam DIŞI**
     · kurallar/kilitler · **bağlam tazeliği** · kabul ölçütü · teslim biçimi.
   - `templates/rapor.template.md` kur: sonuç · kabul-ölçütü karşılığı (madde madde) · yapılanlar ·
     koşulan doğrulama · failure sınıfı · atlanan kontroller · yan-bug · belirsizlikler ·
     sonraki adım bağlamı. **Kanıt etiketi zorunlu:** [ÖLÇÜLDÜ]/[BEYAN]/[ÇIKARIM]/[DOĞRULANMADI].
   - Rollerin "Çıktın:" bloğu KALIR (rol-özgü içerik), biçimi rapor şablonuna bağlanır.
   - 🔴 **ANA ajan ≠ ALT ajan:** kök CLAUDE.md'deki "çıkış raporu" ana ajanın KULLANICIYA raporudur;
     bu çift alt-ajanın ANA AJANA dönüşüdür. İkisi karıştırılırsa alt ajan kullanıcıya yazar gibi
     nezaket/özet üretir, ana ajan da ham çıktı yığınıyla boğulur.
   - **Ağırlık ekseni (K31):** brifteki `agirlik: hafif|orta|agir` çağrı-başına `model`/`effort`
     override'ını besler. Rol frontmatter'ı VARSAYILANDIR (taban), tavan değil — Claude Code'un
     Agent aracı çağrı başına override kabul eder. `thinking` override'ı YOKTUR.
   - Plan tarafı: `templates/plan.template.json` → `plan_adimlari[].rol` + `.agirlik` (OPSİYONEL,
     geriye uyumlu; kapı yokluklarını yok sayar — doğru rol seçimi bulanık yargıdır, E2).
   - **DÜRÜST SINIR:** ikisi de TARİF'tir, kapı DEĞİL. "Brif/rapor eksik" bulanık invariant → E0'a
     inmez. Varlık kapısı (rapor üretildi mi) ancak PİLOT kalibrasyonundan sonra değerlendirilir;
     kalite kapısı asla.
3. **Kök CLAUDE.md'ye süreç bölümü:** süpervizör karar matrisi (somut örneklerle), hafif/tam
   mod ayrımı, sahiplik kilitleri (şema/bağımlılık/auth/global stil → dalga başına tek ajan),
   çıkış raporu + failure taksonomisi (baseline/benim/ortam/flaky/engel/**sistem-kuralı**).
   ("sistem-kuralı" v0.5: sistemin KENDİ kuralının yarattığı sürtünme → FRICTION_LOG'a;
   hakem/insan doğrular, ajan self-report'u değil.)
   **[toggle: dış-model] DIŞ-MODEL DANIŞMA ADIMI (v0.10, sıra v0.18.2'de DÜZELTİLDİ — yalnız MODEL
   envanterinde dış model ERİŞİLEBİLİRSE):** `CLAUDE.template.md`'deki tam-dalga akışına dış-model
   danışmayı YAZ — iki nokta: ① PLAN sonrası/uygulamadan ÖNCE plan-eleştirisi (spec/tasarım en büyük
   hata sınıfı — doctrine), ② **ONAY kapısında, hakem'den ÖNCE** dış-model salt-okur adversarial
   taramayı yapar (AVLAR — geniş, sistematik hata arar); **hakem dış-modelin HER bulgusunu YARGILAR**
   (GEÇERLİ/YANLIŞ-POZİTİF kararı + gerekçe) ve kendi bağımsız denetimini de ekler. Sıra v0.10'da
   tersti (dış-model hakem SONRASI); **pilot ölçümü (2026-08-06, Pilot) ters sırayı çürüttü:**
   hakem 80/80 "geçti" derken aynı kümede dış-model (GLM 5.2) **19 gerçek hata** buldu. Dış-model
   AVLAMA'da güçlü (geniş tarama), hakem YARGILAMA'da güçlü (derin doğrulama) — sıra ters kurulunca
   hakemin kaçırdığı hata ancak şans eseri yakalanır. Çağrı-komutu alanı = ADIM 0'da KANIT'la
   sabitlenen gerçek çağrı yolu. İLKELER (hedef CLAUDE.md'ye de yazılır, AYNEN kalır): İNSAN-onaylı ·
   SON ÇARE (gizli kod sızabilir, yalnız gerekli bağlam) · atfı yaz (hangi model) · HAFİF MODDA
   KULLANMA (tören maliyeti). Dış model YOKSA bu adımı KURMA (akış alanlarına "(yok)" + bloğu sil —
   no-op). Bu bir TARİF/TALİMAT'tır, kapı KODU DEĞİL: "aşama atlandı" bulanık invariant E0'a inmez
   (doctrine: bulanık kural disiplinde/Hakem'de kalır).
   **RED'i reddetme kuralı:** hakem bir dış-model bulgusunu YANLIŞ-POZİTİF sayarken kanıt ister —
   "bu dosyada yok" + `[DOĞRULANMADI]` yanlış-pozitif kararı için YETERSİZDİR (henüz doğrulanmamış
   demektir, yanlış demek değildir); red için karşı-alıntı (`[ÖLÇÜLDÜ]`) gerekir. Kanıt etiketleri
   `templates/roles.template.md`/`templates/rapor.template.md`'deki mevcut sözlükten
   ([ÖLÇÜLDÜ]/[BEYAN]/[ÇIKARIM]/[DOĞRULANMADI]) — yeni sözlük İCAT EDİLMEZ. Kanıtsız RED, kanıtsız
   KABUL kadar kusurludur.
   [toggle: PM] **ürün-karar eskalasyonu:** AI seçenek+öneri üretir, İNSAN karar verir +
   PRODUCT_LOG'a yazar (teknik-karardan ayrı kademe).
4. [ORTA+] Dalga dosyası konvansiyonu (v0.18.1 K34 — [BÜYÜK]'ten indirildi): dalga dizini +
   şablon; kapanınca silinir/arşivlenir. Gerekçe: çok-ajanlı dalga ORTA'da da koşuyor (roller
   ORTA'da zaten kurulu), dosyasız "kim neye dokunuyor" görünmez kalıyordu. KÜÇÜK'te kurulmaz.
   **STATE varsa (toggle: takip.state) "Aktif iş" tablosu CANLI BOARD'dur:** rol · dokunma kümesi · kilit sütunları taşır,
   iş bitince satır SİLİNİR (geçmiş git'te). İkinci bir board dosyası AÇILMAZ (tek-kaynak).
   Dokunma kümesi sütunu çakışma denetiminin verisidir: kesişen iki satır paralel koşmaz.
   WAVES ölçüm logu: dalga başına 1 satır (token/bulgu/süre) — budama kararlarının verisi.

## Rol kurallarının saha kaynakları

`templates/roles.template.md`'deki kâşif/hakem kurallarının çoğu bir pilot vakasından çıktı;
kural cümlesi rolde kalır, vakanın ANLATISI burada toplanır (rol dosyası tavan baskısı altında —
40 satır/rol).

- **Kâşif — sabit verme yasağı:** kâşif iskeleti tekrar tekrar yanlış sayısal sabit verdi (TTL
  30s→5s, cron yok→var, slot 18→runtime, budget 25s→60s) — hafızadan/eski-logdan çekiyordu, sayı
  veren iskelet hatayı çoğaltıyordu.
- **Kâşif — karar verme yasağı:** kâşiften gözlem istendi, rapor sonunda hazır tavsiye paketi
  (dosya adları + sürüm numarası + karar önerileri) döndü; kullanılsaydı sonraki adımı
  anchor'layacaktı.
- **Kâşif — canlılık refleksi:** kâşif projeden çıkarılmış ama silinmemiş bir dosyayı analiz edip
  kök neden ilan etti — sökülmüş motora bakıp teşhis koymak. Yanlış dünya modeli tüm dalgayı zehirler.
- **Kâşif — türetilmiş katman kanıt değildir:** 6 handler ayarı çağırdığı serviste okuyordu, üst
  katman altısına da "okumuyor" diyordu.
- **Kâşif — brifteki bilgi kanıt değildir:** iki paralel kâşiften biri brif cümlesini kanıt diye
  döndürdü, diğeri `[ÖLÇÜLDÜ]` etiketiyle yanlış sabit verdi — ana ajan kendi ölçünce çürüdü
  (2026-08-12).
- **Hakem — dış-model sırası + atlama izi:** pilot ölçümü (2026-08-06) hakem 80/80 "geçti" derken
  dış-model (GLM 5.2) aynı kümede 19 gerçek hata buldu (sıra bu yüzden v0.18.2'de tersine çevrildi);
  ayrıca dış-model danışma adımı iki kez gerekti, iki kez atlandı, hiç iz kalmadı — rehber "bu adım
  yapılıyor" izlenimi veriyordu. Mekanizması olmayan kural gürültüdür.
