# FAZ 2 — Kapı Kataloğu (hangi kapı, hangi halka, hangi sınıf)

> SKILL.md FAZ 2 adım 3(un) agir detayi buraya tasindi (SKILL.md tavani ~300 satir; agir icerik
> reference/e). SKILL.md kisa isaretci ile buraya bakar. Kapi CLI sozlesmesi: `CONTRACT.md`.
> Kanonik kapi kayit tablosu ve sinif beyanlari CONTRACT.md(de) yasar — burasi KURULUM rehberidir.

## 6 kategori kapı script(i) — hangisi ne zaman kurulur

   - **`check-hygiene`** (her seviye çekirdek): `--rule=utf8|file-size|secrets|placeholders`
     (placeholders v0.5 — doldurulmamış `{{...}}` yakalar, bu sistemin 1 no'lu felaket panzehiri;
     FAZ 3 nesir üretildikten SONRA koş).
   - **`check-doc-integrity --rule=doc-truth`** (her seviye çekirdek): ölü yol/komut referansı.
   - **`check-doc-integrity --rule=doc-recency`** (v0.8.4, opt-in): kod yoluna `doc-anchor:` HTML
     yorumu koy; anchor'lı yol değişip doküman dokunulmazsa tripwire. VARSAYILAN uyarı, CI'da `--strict`.
   - **Toggle'lı (`check-history`):** UI/senaryo toggle → `--rule=co-update` (İÇERİK/tripwire);
     takip dosyaları varsa `--rule=append-only` (KALİTE, git diff'le silinen satırı kesin yakalar).
   - **Kabul ölçütü (opt-in, `check-provenance --rule=acceptance`):** `*.acceptance.json` VARSA
     verify reçetesine ekle; `--release` modu `passes:false`+"released" çakışmasını bloklar.
   - **[ORTA+, v0.16] `DESIGN.md` kuruluysa:** `check-self-registry --rule=design-tokens` hook'a
     bağlanır (staged UI taraması, Kademe 1/statik); yoksa no-op. Kademe 2-3 pakete GİRMEZ, CI
     şablonuna opsiyonel blok olarak reçete edilir.
   - **🔴 Faz-2 doküman toggle'ı açıksa (docs/user + [T]/[L0]):** `check-provenance --rule=coverage-gate`
     + `--rule=registry-join` **verify reçetesine VE CI'ına** girer — yoksa ORPHAN olurlar (kurulu
     ama hiç koşmaz). İkisi de registry/[L0] YOKSA no-op, VARSA koşmaları ZORUNLU.
   - **🔴 Faz-2 EK — "tamamlandı" öncesi bütünlük:** `check-doc-integrity --rule=integrity` bir
     [T]/[L0]/registry "tamamlandı" DENMEDEN ÖNCE koşar: stub'a dönmüş [T] · dangling anchor ·
     id/anchor çakışması · yetim stub yakalar.
   - **🔴 Test-köprüsü toggle'ı açıksa:** `check-provenance --rule=brief-provenance` — test-brief'in
     `derived_from`/anchor/`feature_id`/`source_commit` doluluğunu + approved-crosscheck'i zorlar.
   - **🔴 Konfig ekseni toggle'ı açıksa (v0.20):** `check-provenance --rule=config-flags` verify
     reçetesine VE CI'ına girer. TETİKLEYİCİ kanonik sözlük dosyasıdır (`docs/FEATURE-DICTIONARY.md`,
     `--dictionary=` ile override) — sözlük YOKSA no-op. Beyan↔dayanak tutarlılığını, `config_flags: {}`
     cevapsızlığını, sınıf kapalı kümesini ve çok-repo ad drift'ini zorlar. Detay: `reference/multi-team.md` §4.6/§4a.
     **v0.20.1 — şema açık/kapalı VARSAYMAZ:** ayarların önemli bir bölümü boolean değildir
     (ölçüldü: yaklaşık üçte biri sayı/enum/metin); `tip` + `kosul` + `etki_sinifi` ile yazılır, `when_false`
     yalnız bool KISAYOLUDUR. Beşinci sınıf `kapsam` (işlem sessizce daralır) ölçülerek eklendi.
     Aynı sürümde `[T].flags` yapısallaştı ve **[L0]↔[T] ÇELİŞKİ kontrolü** açıldı: [T] "koşul yok"
     derken [L0] gerçek koşul beyan ediyorsa FAIL — besleyen katmanın yanlış ölçülmesinin panzehiri.
   - **`check-history --rule=friction-repeat` (v0.20, daima — FRICTION_LOG her kurulumda var):**
     pre-commit'e VARSAYILAN (`--strict`SİZ) bağlanır. Sertleştirme YAPMA: sürtünme kaydını bloke
     etmek, kaydın hiç yazılmamasına yol açar (kayıt kötü yazılsın, hiç yazılmamasından iyidir).
   - **🔴 Faz-2 EK — yanlış-kanıt sınıfı (v0.17.1, KAPI YOK — E2/hakem):** anchor VAR ile anchor
     DOĞRU ayrı şeylerdir; generic bir guard testi spesifik bir gate'in kanıtı sanılabilir (alan
     dolu, anchor gerçek, test yeşil — kanıt YOK). Bu sınıf MEKANİZE EDİLEMEDİ: token-kesişimi
     kapısı denendi, 12 doğru-anchor'lı çiftte 11 yanlış-pozitif verdi (TR/EN dil özdeşliği ölçüyordu)
     ve geri çekildi. Kanonik savunma HAKEM'dedir (`roles.template.md` denetim listesi + hakem md.3b);
     vaka ve ölçüm: `reference/pilot-dersleri.md` §3b.
   - **🔴 Çok-ajan/hakem toggle'ı açıksa (ORTA+, roller kurulu):** `check-process-discipline`'ın
     üç alt-kuralı CI'a girer — hepsi VARSAYILAN uyarı, `--strict` bloklar:
     - `--rule=hakem-verdict` — kod diff + hakem verdict yoksa uygulayan≠doğrulayan KOŞMAMIŞ
       (YARI-MEKANİK). v0.12: `dis_model` alanı ZORUNLU (`atlandi`→gerekçe, `kosuldu`→model atfı).
     - `--rule=plan-exists` — anlamlı kod diff + plan artefaktı yoksa/şeması boşsa → plansız kod.
     - `--rule=mode-escalation` — ağır sinyal + "hafif mod" beyanı → tam-dalgaya zorla. v0.12: DÖRT
       değer `hafif`·`tam`·`devir`·`engel` (son ikisi kod yazılmaz, kapı FAIL vermez).
     - `check-history --rule=stale-constants` — rol dosyasına gömülü ölçüm sabiti (hata/test sayısı)
       yakalar; roller kurulunca ekle.
   - **file-size guide-modu (v0.5, K6):** kod tavanı (500/1000) + düşük rehber-tavanı — `check-hygiene
     --rule=file-size`'ın ikinci modu, yeni dosya değil.
   - Regex'leri stack'e uyarla; secret FP'lerini `--all` ile bul → placeholder filtresine ekle.
     **Smoke-test:** sahte secret/BOM'lu geçici dosya → kapı exit 1; sil. Gerekçe/dürüst-sınır
     detayları: `CONTRACT.md` "Kapı kayıt tablosu" + `reference/doctrine.md`.
   - **🔴 SIZE-BASELINE ZORUNLU (v0.12 — ATLAMA; pilotta atlandı ve kapı REDDEDİLDİ):** dosya-boyu
     kapısını kurduysan `scripts/size-baseline.json`'ı script'in KENDİ sayımıyla ÜRET. Tavanı zaten
     aşan her dosya bu listeye girer — muafiyet **AF DEĞİL DONDURMA**: muaf dosya küçülebilir,
     BÜYÜYEMEZ. Üretmezsen kapı ilk gerçek işte var olan bir dosyaya dokunan geçerli bir düzeltmeyi
     bloke eder ve ekip kapıyı kapatır. **Sınırı BÜYÜTEREK çözme** — bu, o dosya sınıfının korumasını
     tümüyle kaldırır; doğru araç muafiyet listesidir. `verify.mjs --install-exam` ⑥ bunu denetler.
   - **Çok-stack profili HAZIR gelir (v0.8.2 — global):** `check-hygiene --rule=secrets` .NET (appsettings conn-string
     Password ataması, JSON Secret/ApiKey alanları), Stripe (sk_live/sk_test önekleri), Azure (AccountKey/
     SharedAccessKey), MongoDB desenlerini; `check-doc-integrity --rule=doc-truth` dotnet/flutter/terraform alt-komut drift'ini;
     `check-hygiene --rule=utf8`/`--rule=file-size` .cs .dart .tf .kt .fs .swift uzantılarını ZATEN tanır (manifest-tespitli,
     geriye-uyumlu). Hedef repo .NET/Flutter/IaC ise EK regex yazmana çoğu zaman GEREK YOK — önce mevcut profille
     smoke-test et, eksik kalan repo-özgü deseni (örn. müşteriye-özel token öneki) ekle. Yeni stack için
     desen eklerken kuralı koru: sadece EKLE (mevcut deseni silme), VALUE_PH/SOURCE_PH filtresinden geçir.
   - **Kapı kayıt tablosu:** her kapıyı hedef reponun kendi `CONTRACT.md`'sine (ya da eşdeğerine)
     işle (kapı | halka | savaştığı entropi | sınıf). KÜÇÜK'te 4-5 satır.
   - **Context budget kaydı (v0.6):** `check-hygiene --rule=file-size` rehber-modu CONTEXT_BUDGET'ta yazan
     tavanlarla tutarlı mı kontrol et. Yeni guard yazma; mevcut file-size + Hakem + budama turu
     uygular. Token sayısı telemetriden gelmiyorsa kapıya bağlama.
