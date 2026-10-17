# Doktrin — Neden Böyle Çalışıyor

Kuran ajanın el kitabı. Bu sistem 2026-06'da gerçek bir repoda (yüzlerce dosya ve API
route) 7-ajanlı denetim + 2 Codex eleştiri turu + 25 kaynaklı doğrulanmış web
araştırmasıyla tasarlandı; v0.5'te iki dış model (GPT, Gemini) geri bildirimi + canlı bir
olgun repo denetimiyle, v0.8'de bir başka kurulum aracıyla (CodexQB) karşılaştırmayla
sertleşti. Çekirdek hiçbir incelemede devrilmedi.

## Temel teşhis

Çok-ajanlı geliştirmede ana hata kaynağı model zekâsı değil, **ajanın okuduğu
gerçeklik modeli**dir. Ajan repoyu okuyarak dünya modelini kurar; rehber dosya
yanlışsa ajan baştan yanlış düşünür. Kanıt vakası: rehberde "test altyapısı yok"
yazarken repoda 1504 geçen test vardı — ajanlar testleri hiç koşmadı, çözülmüş
borçları yeniden çözdü, olmayan dosyaları aradı. (Canlı bir olgun repo denetiminde
küçük bir tekrarını gördük: "test yok" iddiası varken test namespace'i import edilmişti.)

İkinci teşhis: **kırmızı baseline ajanı eğitir** — temiz ağaçta bile fail eden
kontrol, ajana "kırmızı normaldir"i öğretir ve tüm kapılar değersizleşir.

## 4 dosya sınıfı — repo, ajanın işletim sistemidir

| Sınıf | İş | Ömür |
|-------|----|------|
| 📖 BİLGİ | ajan okuyup öğrenir (CLAUDE.md, modül dosyaları, roller) | kalıcı |
| 📋 TAKİP | ne yapıldı/yapılacak/karar/ürün/sürtünme (STATE, DECISIONS, PRODUCT_LOG, FRICTION_LOG, dalga) | karışık |
| 🚦 KONTROL | hatayı insansız yakalar (kapı scriptleri, hook, CI, lint) | kalıcı |
| ✅ KANIT | çalıştığını ispatlar (testler, baseline manifestosu, acceptance.json) | kalıcı |

**Çürümeyi önleyen tek ayrım:** kalıcı dosyalar koddan türetilemeyen gerçeği tutar;
anlık-durum bilgisi ("şu an şöyle") SADECE geçici/yaşayan dosyalara yazılır ve işi
bitince ölür. Tarihsel kayıt (DECISIONS, PRODUCT_LOG, FRICTION_LOG) çürümez çünkü
geçmiş hep doğrudur; durum anlatısı çürür çünkü yarın değişir. **Bu yüzden tarihsel
kayıtlar append-only'dir (`check-history --rule=append-only` zorlar): geçmişi düzenlemek invariant'ı yok eder.**

## İki dik eksen (v0.5): boyut × muhatap

Kurulum tek boyutla ölçeklenmez. İki BAĞIMSIZ eksen var:
- **D-1 · Boyut** (küçük/orta/büyük) = "ne kadar tören" — dosya sayısı + paralellik belirler.
- **D-2 · Muhatap** (dev / PM / QA / son-kullanıcı-dokümanı / …) = "kimler için" — koda dokunmayan
  ekipler VE müşteriye doküman/chatbot sunan ekip için ayrı katman (sonuncusu: multi-team.md §4, Faz 2).

İkisi dik: küçük bir repoda bile ürün ekibi olabilir; büyük bir repoda hiç PM olmayabilir.
Bu yüzden çok-ekip / ürün / test içeriği **toggle'a** bağlanır, boyuta değil. **Asıl yasa:
kullanmayan ödemez.** Muhatap toggle'ı kapalıysa o katmanın tek satırı bile kurulmaz; çekirdek
dosyalar (SKILL, CLAUDE.md) çok-ekip içeriğiyle ŞİŞMEZ — ağır içerik reference/multi-team.md'de
lazy durur. (Bu ders, dışarıdan gelen 40-dosyalık "her ekibe her şey" önerisini elerken
billurlaştı: tutarlılık kanıt değildir; ihtiyacı kanıtlanmamış her dosya entropidir.)

## 5 katman (ROI sırasıyla — zaman darsa alttakileri kes)

1. **L2 Doğrulama** (en yüksek ROI, asla kesme): hızlı verify, main-hep-yeşil,
   baseline manifestosu, failure taksonomisi, makine kapıları.
2. **L3 Determinizm**: altın-yol şablonları, merkezi-altyapı tablosu, yerleşim
   kuralları — iki ajan aynı işi aynı yere yazsın.
3. **L5 Güvenlik tabanı**: düz-metin secret yok (ajanlar gitignore'u da okur),
   sızan her şey rotasyon, commit→deploy arası en az bir kapı.
4. **L1 Bilgi**: kısa+doğru rehber. Yararlı ama kapıları ikame edemez.
5. **L4 Süreç** (ilk kesilecek): roller, dalgalar, kilitler — sadece gerçek
   paralellik varsa değerli.

## v0.6 Adaptif bütçe yasası — context de kaynak

Son token/context literatürü aynı yöne işaret eder: verimlilik "her şeyi kısalt" değil,
**hesabı seçici harca** problemidir. Bu sisteme çevrilen kural:

- Her işe aynı context bütçesi verilmez. Hafif/normal/derin mod sadece tören değil,
  okuma ve reasoning bütçesidir.
- Uzun keşif ham geçmiş olarak taşınmaz; focus summary'ye sıkıştırılır.
- Sıkıştırma kalite kapısı değildir. Kabul kriteri, insan kararı, baseline, secret/prod/auth
  riski ve aktif kilit gibi taahhütler düşerse özet başarısızdır.
- Tekrar eden iş aileleri "skill card" olur; her seferinde sıfırdan düşünme maliyeti azaltılır.
- Token sayısı ancak araç telemetrisiyle kanıttır. Ajan self-report'u maliyet defteri olamaz.

Bu yasa yeni bir runtime veya vektör bellek sistemi kurmaz. Mevcut metabolizmaya bağlanır:
`check-hygiene --rule=file-size` rehber şişmesini sezer, Hakem focus summary'yi denetler, budama
turu işe yaramayan kartları/kuralı siler, FRICTION_LOG gereksiz töreni görünür kılar.

> DÜRÜSTLÜK (v0.6 — kendi "varlık≠kalite" + MAST disiplinimizi bu katmana da uygula): bu
> katmanın TEK makine bekçisi `check-hygiene --rule=file-size`'ın KABA şişme tripwire'ıdır. Focus summary'nin
> taahhüt düşürüp düşürmediğini, bütçeye uyumu ve skill-card değerini Hakem (LLM) + insan
> denetler — ve MAST'a göre LLM doğrulayıcı yüzeyseldir. Yani token/context ekonomisi E0
> (makine-kesin) DEĞİL, E2/E3 (öğüt + insan-disiplin) seviyesindedir; "makine garantisi" diye
> satılmaz. Değeri gerçek: ham geçmişi taşımamak ve taahhüt-kaybını önlemek ölçülebilir fayda —
> ama mekanizması kapı değil disiplindir. Telemetri gelmeden token sayısı yazılmaz.

## Kapı taksonomisi (v0.5): VARLIK kapısı ≠ KALİTE kapısı

Her makine kapısı aynı güçte değil; dürüstçe iki sınıfa ayrılır ve GUARDS.md'de öyle etiketlenir:
- **D-3 · KALİTE/GERÇEK kapısı:** iddiayı nesnel doğrular. `check-hygiene --rule=secrets` (regex
  eşleşir/eşleşmez), `--rule=utf8` (decode olur/olmaz), `check-doc-integrity --rule=doc-truth`
  (yol var/yok), `--rule=placeholders` ({{}} var/yok). Bunlar yanlış POZİTİFle savaşır ama
  yakaladığı şey gerçektir.
- **D-4 · VARLIK/TRIPWIRE kapısı:** bir alanın DOLU olduğunu doğrular, DOĞRU olduğunu değil.
  `check-history --rule=co-update` (akış dokümanı dokunuldu mu — içeriği doğru mu bilemez),
  `check-provenance --rule=acceptance` (passes bayrağı + kanıt boş değil — kanıt geçerli mi
  bilemez), bir handover/kontrat kapısı
  (başlık altı dolu mu — anlamlı mı bilemez). Bunlar BOŞ-BIRAKMAYI önler; kaliteyi GARANTİ ETMEZ.

Bu ayrım taşıyıcıdır: varlık kapısını "kalite garantisi" diye satmak, ajanı yanlış güvene
sokar (en sık hata budur). Varlık kapısı yine değerlidir — boş kontrat/kanıtsız-done en sık
sızıntıdır — ama kaliteyi Hakem (LLM) + insan doğrular, kapı değil.

**🔴 SELF-REPORT ENFORCEMENT YASASI (v0.10, iki pilot + Codex/GPT dış-göz — 2026-07-16):**
Bir alan bir kapının KARARINI DEĞİŞTİRİYORSA (enforcement metadata), o alan aynı ajanın SERBEST
BEYANI OLAMAZ — ya makinece TÜRETİLMELİ ya bağımsız DOĞRULANMALI. Yoksa ajan alanı "uygun" değere
yazıp kapıyı kendi etrafında kapatır. Bu desen DEFALARCA tekrarladı ve her seferinde AYNI panzehir:
- `mock_depth` (beyan) → `test_anchors[].mock_depth` (gerçek) ile ÇAPRAZLA
- `kanit_tipi: test` (beyan) → `test_anchors` VAR MI ile ÇAPRAZLA
- `risk_sinifi: normal` (beyan) → metin/anchor'daki para/veri SİNYALİ ile ÇAPRAZLA
- `mode: hafif` (beyan) → diff'teki ağır-sinyal (API/DTO/migration) ile ÇAPRAZLA
Kapı "kesin doğru" DİYEMEZ (o E2/hakem), ama "BEYAN ile GÖZLENEBİLİR GERÇEK çelişiyor → İNCELE"
DİYEBİLİR. Kural: **enforcement-değiştiren her yeni self-report alanı için, onu çürütecek
gözlemlenebilir bir karşı-sinyal de tanımla — yoksa alan güvenlik değil, güvenlik TİYATROSUDUR.**

## Olgunluk katmanı (v0.8): kapıyı kim denetler?

Kapı bir invariant'ı zorlar — ama kapının KENDİSİ yanlışsa? "8 kapının 3'ünü koşup temiz demek"
(gerçek bir regresyon) bu sistemin önlemek için var olduğu "ürettim, doğru sandım" hatasının ta
kendisidir. Cevap CodexQB karşılaştırmasından ödünç alındı ama kimliğimizi değiştirmeden uyarlandı
(biz kurulum süreciyiz, runtime motoru değil): **kapı davranışı artık makineyle kanıtlanır.**
- **D-5 · Birim testleri** (`tests/`, `node --test`): her kapı için fixture-tabanlı — kötü girdi → exit 1,
  temiz girdi → exit 0. Sıfır bağımlılık (`node:test`); kapılar bağımlılıksızsa testleri de öyle olur.
- **D-6 · Öz-doğrulama** (`verify.mjs`): paket KENDİ statik kapılarından geçtiğini kanıtlar; doc-truth gibi
  layout/referans driftini yakalayan kapıyı ASLA atlamaz.
- **D-7 · Sürümlü sözleşme** (`CONTRACT.md`, `gates_contract_version`): kapıların CLI arayüzü (argüman/
  çıkış-kodu/JSON şeması) sabitlenir; geriye-uyumsuz değişiklik sürümü artırır ve karar defterine
  gerekçe yazılır. Bu, "aşağı-basınç yasası"nın kapı-bakım maliyetine uygulanması: kapı E0'da ~0
  çevrim maliyetlidir ama bakım maliyeti sıfır değildir — test + sözleşme o bakımı disipline eder.

Bilinçle ALINMADI: writer-lock'lu runtime resume / durum makinesi (~7000 satır Python runtime
doktrine aykırı). İdempotentlik TALİMAT düzeyinde kalır; izlenebilirlik karşılığımız doc-truth +
append-only + Hakem'dir. (Ayrıntı + ödünç/red tablosu: archive/v0.8 karar defteri.)


**Paketin KENDİ kapı disiplini (v0.8 — SKILL.md FAZ kuyruğundan taşındı, v0.25):**
sözleşmesine tabidir (`CONTRACT.md`, `gates_contract_version`); davranışları birim testle
kanıtlanır (`node --test`) ve `node verify.mjs` paketin kendi kapılarından geçtiğini doğrular.
Hedef repoya kapı kopyalarken bu sözleşmeyi koru — argüman/çıkış-kodu anlamını geriye-uyumsuz
değiştiren her şey sürümü artırır. Yeni runtime/durum makinesi KURMA (writer-lock'lu resume
bilinçle reddedildi); idempotentlik TALİMAT düzeyinde kalır (FAZ başı "zaten kurulu mu?").

## Tarif/kapı sınırı (v0.9): neyi şimdi kodlarsın, neyi ölçmeden kodlamazsın

Skill bir KURULUM SÜRECİ olduğundan içeriği "ne kurulacağının TARİFİ"dir. Bu iki şeyi ayırır:
- **D-8 · Tarif/şablon eklemek MEŞRU, şimdi yapılır:** SKILL adımları, `reference/` rehberleri, `templates/`
  iskeletleri — kurulum ajanının repoyu ÖLÇEREK dolduracağı format. Bunlar muhakeme gerektirir, kalibrasyon değil.
- **D-9 · Kalibre edilmemiş KAPI KODU gömmek İHLAL:** bir kapının regex/eşik/davranışı, üzerinde koşacağı
  gerçek repoda ÖLÇÜLMEDEN "global doğru" sanılıp kodlanırsa yanlış-pozitif üretir ve güveni eritir
  (aşağı-basınç yasası: kapının çevrim maliyeti ~0 ama yanlış-pozitif maliyeti yüksek). Önce tek pilot, sonra kapı.

🔴 **"Önce pilot" bir ERTELEME BAHANESİ DEĞİLDİR — ayrım invariant'ın SAHİBİNDEDİR (v0.20, pilot
geri bildirimi 2026-08-11).** Yukarıdaki kural BAŞKASININ kodu hakkında ÇIKARILAN invariant içindir
(hedef repoda ölçülmemiş regex/eşik → kalibrasyon şart). **KENDİ tanımladığın ŞEMA ALANI için tersi
geçerlidir:** alanın doğru biçimini sen belirlersin, kalibrasyon gerektirmez — dolayısıyla
**kapısı AYNI commit'te doğar.** Şemayı kapısız yayınlamak alanı ÖLÜ ALAN yapar: doldurulmayan
alan kimseyi uyarmaz, sessizce boş kalır, sonra toplu geriye-dönük düzeltme borcu olur.
- **D-10 · Ölçülmüş vaka:** bu paketin `[L0]` şablonu `config_flags: {}` alanını kapısız yayınladı;
  pilotta makalelerin **büyük çoğunluğu** alanı boş bıraktı ve kimse fark etmedi (v0.20 dalgasında
  kapatıldı — `check-provenance --rule=config-flags`). Bu, ALTIN KURAL ②'nin ("mekanizması olmayan
  kural gürültüdür") ZAMAN eksenidir: kural ile mekanizması arasındaki her commit, borç biriktirir.
- **D-11 · İki-yönlü doğum (v0.20, aynı kaynak §5.3):** her kapı İKİ kontrolle doğar — **pozitif**
  (bozuk deneği YAKALIYOR mu, exit ≠ 0) VE **negatif** (meşru deneği GEÇİRİYOR mu, exit 0).
  İkincisi atlanırsa kapı sahada yanlış-pozitife boğulur, ekip onu kapatır — bu, kapıyı hiç
  yazmamakla aynı sonuçtur. ⚠️ TERİM UYARISI: sahada bu iki yön için "pozitif/negatif" adlandırması
  ekipten ekibe TERS kullanılıyor (pilot geri bildirimi ikisini de "negatif kontrol" diye adlandırdı).
  Bu pakette kanonik ad: **yakalama kontrolü** (bozuğu yakalar) + **geçirme kontrolü** (meşruyu
  geçirir). `verify.mjs --install-exam` ② ikisini birden sorar.

Bu yüzden v0.9 DEAK'te CI'ın GHA üreteci (deterministik şablon) KOD'dur, ama Azure/GitLab üreteci ve
Fibery senkron uzlaştırma kapısı gerçek-repo pilotuna kadar TASARIM bırakıldı — "kuruldu" diye satılmaz,
dürüstçe STATE'e yazılır. (Sınırın dışı: paketin KENDİ araçları — `verify.mjs`, `scripts/pack-skill.mjs`,
`scripts/install-hook.mjs` — bunlar hedef-repo runtime'ı değil, paketin öz-bakım/dağıtım mekanizmasıdır;
kimlik kırmızı çizgisi "hedef repoda runtime motoru barındırmamak"la ilgilidir, paketin kendi build aracıyla değil.)

## Global stack profili (v0.8.2): tek mimari, çok dil

Kapılar baştan stack-nötr tasarlandı (utf8/file-size/placeholder/append-only/acceptance dile
bakmaz; doc-truth çok-runner; secrets çok-desen). v0.8.2 bunu KANITA çevirdi: bir onlarca repoluk
ekosistem (pilot) simülasyonunda iki KÖR nokta ölçüldü — (1) secrets .NET'in en sık sızma yerini
(appsettings connection-string + JSON `"Secret"/"ApiKey"` + canlı Stripe `sk_live_`) kaçırıyordu;
(2) doc-truth dotnet/flutter/terraform komut-drift'ine kördü. Çözüm YENİ MİMARİ değil, mevcut
genişleme noktalarını doldurmak oldu:
- **D-12 · secrets:** Stripe / .NET conn-string / appsettings-JSON / Azure / MongoDB desenleri EKLENDİ
  (silinmedi); VALUE_PH/SOURCE_PH FP-filtreleri korundu → recall arttı, FP artmadı.
- **D-13 · doc-truth:** dotnet/flutter/terraform alt-komut SÖZLÜKLERİ eklendi, MANIFEST-TESPİTLİ (ilgili
  manifest yoksa o runner ateşlenmez → npm/make/just'taki "kanıt yoksa atla" mantığının aynısı, yeni FP yok).
- **D-14 · utf8/file-size:** dart, tf, kt, fs, swift vb. uzantılar alternation'a eklendi (tek satır, geriye-uyumlu).

Taşıyıcı ders: "global yapmak" = orkestratör/runtime KURMAK değil, stack-nötr çekirdeğin DESEN
SÖZLÜKLERİNİ büyütmek. Yeni dil = birkaç regex/Set satırı + birim test, mimari değişikliği değil.
Sözleşme açısından recall genişletmesi `gates_contract_version`'ı artırmaz (CLI arayüzü kararlı;
bkz. CONTRACT.md) — ama güncel kapı mevcut repoda eski bir secret'ı yeni FAIL olarak yüzeye çıkarabilir
(regresyon değil, kapının işini daha iyi yapması). Uygulama orkestrasyonu: uygulayıcı (Sonnet) kalibre
eder, Hakem (ayrı ajan, salt-okur) geriye-uyum + FP açısından düşmanca denetler — bu katman da kendi
"uygulayan ≠ doğrulayan" ilkemizle üretildi (bir uygulayıcı doc-truth'u yarım bıraktı, Hakem yakaladı).

## Doküman bayatlamasının 3 sınıfı (v0.8.4): entropiyi katmanda savun

Doküman "gerçeğin gerisinde kalır" (bu sistemin kuruluş sebebi) tek bir şey değil, üç sınıftır;
her biri farklı bir halkada savunulur (dört-halka felsefesinin doküman-tazeliğine uygulanması):
- **D-15 · (A) Ölü referans:** doküman bir yol/komut der (örn. src/auth dosyası), o yol silinmiş.
  → `check-doc-integrity --rule=doc-truth` (E0, kesin). ✅
- **D-16 · (B) Sahipsiz güncelleme:** doc-anchor'lı kod yolu değişti ama anchor'layan doküman dokunulmadı.
  → `check-doc-integrity --rule=doc-recency` (E0, deterministik, LLM YOK). doc-anchor (bir HTML yorumu: `doc-anchor:` + kod yolu) bir doküman
  bölümünün bir kod yolunu SAHİPLENMESİDİR; sahip değişince doküman dokunulmazsa tripwire. SINIF: VARLIK
  (dokunuldu mu — doğru mu DEĞİL). İnsan boşluk ekleyip susturabilir; kabul edilen sınır, BOŞLUĞU önler.
- **D-17 · (C) Sessiz içerik bayatlaması:** dosya hâlâ var, içi değişti, doküman eski içeriği "geçerli görünür"
  biçimde anlatıyor (JWT→OAuth ama doküman hâlâ JWT diyor). Bu BULANIK → E0'a inmez. Yalnız LLM-denetçi
  (doc-guardian, E2) yakalayabilir — ama MAST: LLM yüzeyseldir. Bu yüzden doc-guardian OPSİYONEL ve ağır
  ön-koşullu (test-durumu girdisi + sürümlü çıkış şeması + çelişki eskalasyonu + maliyet telemetrisi);
  A+B yetmediği ÖLÇÜLMEDEN kurulmaz (dış-öneri bloat panzehiri). Tasarım taslağı (kurulmadı) git
  geçmişinde: `git log --all -- pilot-proje/arsiv/pilot-repolari/doc-guardian-faz2-tasarim.md`.

Neden B E0'a iner ama C inmez: "dokunuldu mu" keskin invariant (git diff, düşük FP, deterministik —
aynı diff hep aynı sonuç). "İçerik gerçeği yansıtıyor mu" yargı gerektirir (E2). Aşağı-basınç testi:
mekanize edilebilen (B) makineye iner; bulanık olan (C) disiplinde/LLM'de kalır ve öyle DÜRÜSTÇE etiketlenir.

## Araştırma bulguları (bildirilen değerler — bağımsız doğrulama önerilir)

> v0.5 dürüstlük notu: aşağıdaki nicel değerler kaynak makalelerden BİLDİRİLEN sonuçlardır;
> kendi reponda tekrarlanmaları garanti değildir. Yön doğru, sayı yaklaşık. Tek bir makaleyi
> mutlak gerçek sanma — kendi pilot dalganla kalibre et.

- Kısa kök + modül-bazlı CLAUDE.md = Anthropic'in büyük-repo tavsiyesi; alt-dizin
  dosyaları lazy yüklenir (ilgisiz görevde ~sıfır token). AGENTS.md artık sektör standardı
  (Linux Foundation/AAIF) — otomatik kod-inceleme araçları onu okur.
- Topluluk konsensüsü ≤300 satır; "kopya değil pointer — kod parçacığı bayatlar".
- MAST (NeurIPS 2025, 1600+ ajan izi): LLM doğrulayıcılar "kapsamlı incele" istemine rağmen
  YÜZEYSEL kontrol yapar → güvence makine kapısından gelir. Süpervizöre nihai karar yetkisi ve
  "asıl görev hedefi karşılandı mı?" kontrolü görev başarısını belirgin artırır (bildirilen
  ~+%9 ve ~+%16; mertebe doğru, kesin değer repo-bağımlı).
- ETH Zürih: elle yazılmış İYİ rehber dosyaları bile başarıyı ortalama birkaç puan artırıp
  maliyeti kayda değer ölçüde yükseltebilir (bildirilen ~%4 fayda / ~%19'a varan maliyet)
  → satır tavanları süs değil taşıyıcı duvar; rehbere aşırı yatırımın getirisi azalandır.
- Hata sınıflarının en büyüğü (~%44) spesifikasyon/tasarım kaynaklı → plan-first akış en
  büyük hata sınıfını hedefler. (Bunu makine-tarafına indiren v0.5 organı: acceptance.json —
  kabul ölçütü hem implementasyon kontratı hem doğrulama oracle'ı.)
- v0.5 yakınsaması: token/model-kademe katmanını üç bağımsız kaynak (GPT, Gemini ve canlı bir olgun reponun
  token-optimizörü) önerdi → katmanın gerçekliği yakınsamayla desteklendi. Ama
  yakınsama "aynı havuzdan içmek" de olabilir; mekanizma sorusu (kim uyguluyor?) hâlâ şarttır.

## Rol ilkeleri

- Rol = kapsam + araç kısıtı + çıkış kapısı. Kişilik metni ("sen kıdemli X'sin") davranışı
  değiştirmez; somut kural ve checklist değiştirir.
- Doğru rol sayısını teknoloji değil ÇIKAR ÇATIŞMASI belirler: uygulayan ≠ doğrulayan (kendi
  kodunu inceleyen ajan zayıf incelemecidir). Salt-okunurluk iki katmanla sağlanır: Edit/Write
  araç kısıtı (kesin garanti) + Bash için yazılı sınır ("sadece doğrulama; yazma/commit rol
  ihlali"). Bash tamamen kesilemez — hakem komut yeniden koşar, kâşif ölçer; dürüst ödünleşim budur.
- Süpervizör = ana oturum (subagent değil). Eskalasyon matrisi somut örneklerle yazılır;
  sorular dalga sonunda TOPLU sorulur.
- **D-18 · Model-kademe (v0.5): mekanizma rol dosyasındaki `model:` satırıdır** (Claude Code'un kendi
  özelliği), bir API gateway değil — biz orkestratör değil, kurulum süreciyiz. Tier işe göre
  yazılır (keşif→ucuz, uygulama/hakem→orta, mimari-karar/güvenlik→pahalı); öznel "stratejik mi?"
  tetikleyicileri OTOMATİK ateşlenemez, onlar insana bırakılır. cost-ledger ancak Claude Code
  telemetrisinden türerse kurulur — ajan self-report'u güvenilmezdir (ajan kendi token'ını bilmez).
- **D-19 · Uyarlanır roller (v0.7): kurulum-zamanı taslakla, insan onayıyla aktifleştir.** Sabit roller
  her repoya tam oturmaz; rolleri repoyu ölçerek taslakla — ama yetki zarfı (özellikle Hakem'in
  salt-okunurluğu) İNSAN ONAYINDAN geçince aktifleşir, böylece bir makine garantisi olarak kalır.
  **Runtime rol fabrikası (görev-zamanı rol üreten ajan) bilinçle REDDEDİLDİ:** üreteç kendi rolünü
  onaylarsa self-preference doğar ve yetki garantisi "disiplin"e düşer. `model:` değeri ortamda
  ERİŞİLEBİLİR model envanterinden yazılır — erişilemeyen modele işaret eden `model:` ölü dosya
  yolu kadar yanlıştır (model-truth). **YAZAN işte** gerçek paralellik yoksa tek-ajana düşülür;
  koordinasyon sürtünmesi 3+ tekrarlarsa çok-ajan budanır. (Ayrıntı + red tablosu: v0.7 defteri.)
  🔴 **KAPSAM (v0.21 K50):** bu cümle SALT-OKUR fan-out'a (keşif/tarama/denetim) UYGULANMAZ —
  orada paralellik VARSAYILANDIR. Gerekçe: dört çakışma sınıfının (metinsel · semantik ·
  bayat-bağlam · kaynak yarışması) DÖRDÜ de bir YAZMA gerektirir; eşzamanlı okuyucular aynı
  HEAD'i görür. v0.7 RED'i "paralellik KANITI olmadan" koşuluna bağlıydı ve dayanağı MAST
  ölçümüydü (ajan-arası uyumsuzluk ~%37) — o uyumsuzluk YAZAN ajanlar arasında doğar. Fan-out'un
  bedeli sentez protokolüdür (çelişkide oylama YOK, ana ajan ölçer — olgu-taşıma %84, K48).
  Runtime orkestratör motoru reddi AYNEN DURUYOR. Tam gerekçe: `reference/orkestrasyon-ve-paralellik.md`.

## Bilimsel çalışma disiplini (v0.13)

Kaynak: süpervizör talebi (2026-07-27) + ECC ("Everything Claude Code") sürekli-öğrenme
sisteminin 3 dış-modelli incelemesi (Codex · GLM 5.2 · Gemini — üçü de aynı hükme vardı).

- **D-20 · Dalkavukluk yasak (bilimsel şüphecilik):** ajan bir bilim insanı gibi çalışır — iddia,
  SAHİBİNE bakılmaksızın (kullanıcı/süpervizör dahil) kanıtla sınanır. Kanıt aksini
  gösteriyorsa "bu iddia yanlış görünüyor, kanıt: ..." demek görevdir, saygısızlık değil;
  emin olunamıyorsa "bilmiyorum" + nasıl doğrulanacağı söylenir. Onay kanıt DEĞİLDİR:
  kullanıcının sessiz kalması ya da tekrar etmesi bir tezi doğrulamaz (sıklık ≠ doğruluk —
  ECC confidence-formülü incelemesinin ortak bulgusu). Mekanizma dürüstlüğü: bu kuralın
  E0 kapısı YOKTUR ve olamaz ("yeterince şüpheci mi" bulanıktır) — zorlanan şey kritik
  cümlelerin VARLIĞIDIR (`gates/check-self-registry.mjs --rule=rule-contracts`); davranışı Hakem (E2) denetler.
- **D-21 · Türetilmiş katman YÖN GÖSTERİR, KANIT DEĞİLDİR (v0.20, pilot geri bildirimi 2026-08-11):**
  bir özet/indeks/doküman katmanı ([T], registry, envanter tablosu, rapor özeti) kaynaktan
  TÜRETİLMİŞTİR — hangi dosyaya bakacağını söyler, o dosyanın ne yaptığını KANITLAMAZ.
  🔴 **Kanıt = kaynağın kendisi VE çağırdığı BİR SEVİYE ALT.** Bir handler'ın gövdesine bakıp
  "bu ayarı okumuyor" demek eksik ölçümdür; ayar çağırdığı SERVİSTE okunuyor olabilir.
  Ölçülmüş vaka: pilotta 6 handler konfigürasyonu çağırdığı serviste okuyordu, [T] katmanı
  altısına da `flags: []` diyordu — türetilmiş katman kaynağın yerine geçmişti ve **şu an
  yanlış bilgi veren** 6 doküman üretti. Zıt yön de yasaktır: türetilmiş katman kaynakla
  çelişiyorsa düzeltilecek olan KAYNAK değil TÜRETİLMİŞ katmandır.
  Mekanizma: bu cümlenin varlığı `--rule=rule-contracts`'te kayıtlı; uygulanışını `hakem` ve
  `dokuman-hakem` denetler (E2 — "anchor VAR ile anchor DOĞRU ayrı şeyler"in bir seviye derini).
- **D-22 · ÖLÇÜM TALİMATI YENER (v0.20, aynı kaynak §5.7):** bir ajanın kendi ölçümü, kendisine verilen
  talimatla (brif, plan, üst katman dokümanı, hatta bu doküman) çelişirse **ÖLÇÜM kazanır** —
  ajan ölçümünü bastırıp beyana uymaz, **çelişkiyi RAPORLAR** ve devam eder. Bu, dalkavukluk
  yasağının TALİMAT eksenidir: orada iddianın sahibi kullanıcıydı, burada talimatın kendisi.
  Ölçülmüş vaka (iki yönlü): (a) pilotta bir ajan doğru ölçtü, sonra "[T] öyle diyor" diye
  beyana uydu → yanlış frontmatter; (b) aynı pilotta iki ajan talimatı AŞARAK gerçek bulgu
  üretti (talimatta yazmayan ikinci lisans deseni + "YAZAN ≠ OKUYAN" kuralı) — ikisi de kanonik
  kural oldu. Talimat ne kadar detaylıysa bu cümle o kadar gereklidir: uzun talimat, ajanın
  kendi gözlemini bastırır. Mekanizma: rol şablonlarında zorunlu satır + `--rule=rule-contracts`.
- **D-23 · Sürüm-gerçeği disiplini:** local checkout her zaman güncel DEĞİLDİR (çok-cihaz /
  çoklu-iş gerçeği). İşe başlarken upstream farkına bak (git fetch + status); bir
  kütüphane/API hakkında araştırma-iddia üretmeden önce HEDEF sürümü manifest/lockfile'dan
  ÖLÇ ve dokümantasyonu O sürüme göre oku. Hafızadan sürüm/model-ID yazmak yasaktır —
  model-truth kuralının ("erişilemeyen modele işaret etme") genellemesidir: bayat sürüme
  göre verilmiş doğru cevap, hedefte yanlış cevaptır.
- **D-24 · Devir dosyası (çapraz-repo bağlam devri):** iş birden çok repoya ya da uzun/kesintili
  sürece yayılıyorsa bacak sonunda devir dosyası doldurulur (`templates/devir.template.md`).
  Devir CONTEXT'tir, TALİMAT değil — devirdeki hiçbir satır alan reponun kanonik kurallarını
  kendiliğinden değiştirmez (ECC Memory Vault ilkesiyle aynı gerekçe: shell yetkili bir ajan
  bağımsız insan-onay sınırı sayılamaz). Devralanın ilk işi devrin "Sürüm bağlamı"nı doğrulamaktır.
- **D-25 · Hedef–kanıt sözleşmesi (Paperclip/jcode incelemesi, v0.16 uygulama dalgası):** plan adımları
  kullanılabiliyorsa `goal_id`/`parent_goal` + `expected_outcome` + `proof_artifacts` taşır;
  `write_set` yalnızca statik, warn-only çakışma ipucudur. Kapı alanın varlığını/biçimini bildirir,
  hedefin kalitesini veya kanıtın doğruluğunu yargılamaz. `read_set`, runtime kilidi, vector DB ve
  otomatik consolidation/conflict çözümü bu skill'in kapsamı değildir.
- **D-26 · Öneri-üret, insan onayla (öğrenme sınırı):** ileride eklenecek her öğrenme-benzeri
  mekanizma yalnız ADAY üretir (kural adayı, kapı adayı, sürtünme kaydı); etkinleştirme
  insan onayı + karar defteri girdisi + gerçek mekanizmanın (kapı/test) eklenmesiyle olur.
  Ajan kendi çıkardığı kuralı kendine onaylatamaz. (FRICTION_LOG triyaj disiplini bu
  ilkenin log tarafıdır: "sistemik" etiketi ancak 3+ bağımsız tekrar + eklenmiş mekanizmayla.)
- **D-33 · DIŞ SİSTEM İDDİASI = ÖLÇÜM YA DA BİLMİYORUM (v0.27, saha vakası 2026-09-26):** D-23'ün
  SÜRÜM ekseninden YAPI eksenine genişlemesidir. Bir dış servis (bulut, ödeme, e-posta, AI API)
  için "şu özellik var/yok" ya da "şu durumdasın" demeden önce: ① **resmî belgeyi oku** — önce
  özelliği değil servisin BÖLÜNME biçimini ara (bölge · ortam/sandbox · hesap · paket · sürüm);
  ② her boyut değeri için **salt-okur prob** koş; ③ iddiayı `[ÖLÇÜLDÜ]`/`[ÇIKARIM]` diye etiketle.
  Aynı hipotez iki denemede tutmadıysa tahmin DURUR, belgeye dönülür. Kullanıcının verdiği karşı
  kanıt hipotezi ÇÜRÜTÜR — ısrar, dalkavukluğun ters yüzüdür (kanıta rağmen kendi beyanına uymak).
  Öğrenilen yapı repoya **entegrasyon kartı** olarak yazılır (`docs/integrations/<servis>.md`,
  şablon `templates/entegrasyon-karti.template.md`) ki sonraki ajan aynı bedeli ödemesin.
  Ölçülmüş vaka: AWS SES iki bölgede kurulu, biri sandbox biri production; ajan bölge boyutunu
  bilmeden "sandbox'tasın" dedi ve kullanıcı canlı bilgileri verdiği hâlde ~1 saat ısrar etti.
  Mekanizma: kartın VARLIĞI ve doluluğu `check-provenance --rule=integration-cards` (E0); ajanın
  gerçekten prob koşup koşmadığı hakem işidir (E2) — kapı onu göremez.
- **D-34 · Node ARACIN bağımlılığıdır, projenin değil (v0.28):** kapılar sıfır-bağımlılıklı Node
  betikleridir (yalnız `node:` yerleşik modülleri; `package.json`/`npm install` gerekmez). Eski
  kural "Node'suz repoya Node-kapısı KURMA" diyordu → .NET/Flutter/Python repoları kuralları alıp
  onları zorlayan HİÇBİR mekanizmayı almıyordu (dogfood yasasının hedefteki ihlali). Yeni kural:
  kapılar makinedeki `node` ile koşar, repoda Node izi aranmaz. Makinede de yoksa commit ENGELLENMEZ
  ama başlatıcı (`templates/pre-commit-shim.template.sh`) atlandığını HER commit'te söyler — sessiz
  kapalılık yok. Claude Code hook'ları (`.claude/settings.json`) da node ister; node'suz makinede
  bloke etmeyen hata vermeleri beklenir [BEYAN — Claude Code hook belgesi: yalnız exit 2 bloke eder;
  node'suz makinede ÖLÇÜLMEDİ]. **Neden yeniden yazım değil:** kapıları ikinci bir dile (Python/
  PowerShell) taşımak iki kod tabanı demektir ve kopma (drift) kaçınılmazdır; önce "node'suz
  geliştirici makinesi gerçekten var mı" pilotta ÖLÇÜLÜR. Mekanizma: başlatıcının iki yönlü testi
  (`tests/pre-commit-shim.test.mjs`) — node yok → exit 0 + uyarı · node var + kapı FAIL → exit 1.

## Yaşayan sistem yasaları (entropiye karşı minimum enerji)

Sistemin amacı: entropiyle sürekli savaşan, bunu EN AZ enerjiyle yapan canlı bir yapı.
Dört ENERJİ katmanı (E0-E3 — L1-L5 ROI katmanlarıyla karıştırma; L=ne kurulur, E=kim öder);
soldaki neredeyse bedava:

| E-katman | Maliyet | Örnek |
|----------|---------|-------|
| E0 Makine | kurulunca ~0/çevrim | kapılar, CI, lint, doc-truth, Claude Code hook'ları |
| E1 Lazy LLM | sadece temasta | modül CLAUDE.md, roller, reference/multi-team.md |
| E2 Sabit bağlam | her görevde | kök CLAUDE.md + stub |
| E3 İnsan | en kıt | eskalasyon, mimari, ürün-kararı, zevk |

**Aşağı-basınç yasası (metabolizma):** her kural sürekli "bir alt E-katmana inebilir miyim?"
basıncı altındadır. İnsan-checklist'i guard'a, LLM-kontrolü CI assert'ine inebildiği an İNER
(örnek: rehber tazeliği Hakem'den `check-doc-integrity --rule=doc-truth`'a indi; v0.5'te placeholder
kontrolü insandan `check-hygiene --rule=placeholders`'a, döngü-içi savunma git-hook'tan Claude Code
PreToolUse'a indi). E0'a inme
TESTİ: "keskin bir invariant olarak DÜŞÜK yanlış-pozitifle mekanize edilebilir mi?" — bulanık
kurallar ("okunabilir olsun") inemez, E1-E2'de kalır. Guard'ın çevrim maliyeti ~0 ama bakım
maliyeti sıfır DEĞİL: yanlış-pozitif veren kapı güveni eritir ve bypass edilir.

**Damıtma eşiği (v0.17.2 K32) — aşağı-basıncın NE ZAMAN uygulanacağı:** yukarıdaki test "inebilir
mi?" sorusunu cevaplar ama "ne zaman bakayım?" sorusunu cevaplamaz; bu boşluk yüzünden basınç
pratikte hiç uygulanmaz (bu repo `npm run release`'i damıttı — ama onu doğuran bir kural yoktu,
ad-hoc'tu). Eşik, repodaki mevcut 3+ emsaliyle hizalıdır (FRICTION_LOG kural değişimi · "sistemik"
etiketi · çok-ajan budaması hep 3+ ister):

> Aynı iş-ailesi (aynı komut dizisi / aynı prosedür / aynı ajan görevi) **3+ kez** koşulduysa,
> damıtma ADAYIDIR: E2'de (her seferinde LLM düşünüyor) kalmaya devam mı etsin, yoksa E0'a mı
> insin (script · kapı · paket betiği)?

Zorunlu bileşenler — bunlar olmadan damıtma YAPILMAZ (yarım damıtma sessiz yanlış üretir):
① damıtılan script'in **testi**, ② girdi/çıktı **sözleşme kontrolü** (dış kaynağa bağlıysa şema
doğrulaması — kaynak değişince sessizce yanlış veri üretmesin), ③ **fail-open**: sözleşme kırılırsa
otomatik LLM-moduna geri düş + "yeniden damıt" sinyali, ④ ne için damıtıldığı + tarih (budama
yasasının iki etiketi). Damıtmanın KENDİSİ LLM işidir → sonucu **insan onaylar** (E3), otomatik
devreye girmez. Kullanılmayan/sürekli kırılan araç budama turunda masaya yatar.

Sınır: damıtma **prosedürü** koda indirir, **yargıyı** indirmez. "Hangi model bu işe uygun",
"bu kod okunabilir mi" bulanıktır — 100 kez tekrarlansa da E0'a inmez.

**Dört zorlama halkası (v0.5):** aynı invariant birden çok halkada savunulabilir, erkenden geçe:
① Claude Code hook (döngü-içi, ajan yazarken, en erken+ucuz) → ② git pre-commit → ③ CI (otorite)
→ ④ Hakem (LLM, son süzgeç). Hook hijyendir, CI otoritedir; biri ötekini ikame etmez.

**Budama yasası (apoptoz):** Sil ⟺ (yanlış-pozitif oranı yüksek) VEYA (koruduğu invariant artık
yok). "Hiç ateşlemedi" TEK BAŞINA silme nedeni DEĞİLDİR — felaket-sınıfı guard'lar (secret,
prod-DB) sigortadır; duman dedektörü yangın çıkmadı diye sökülmez. Her artefakt iki etiket taşır:
NEYLE savaşıyor + son GERÇEK yakalama. Budama turu bu etiketi sorar; cevabı olmayan artefakt
masaya yatar.

**Taşma yasası — rehber tavanı aşınca içerik ATILMAZ, KATMAN DEĞİŞTİRİR (v0.20, pilot geri
bildirimi §5.6):** satır tavanı bir BÜTÇE sinyalidir, bir silme emri değil. Tavan kapısı bloke
ettiğinde varsayılan tepki "en az değerli paragrafı sil" olursa sistem, kazanılmış dersi kaybeder —
tavanın amacı okunabilirlik, bilgi imhası değil. Taşan içerik **türüne göre** yönlendirilir:

| Taşan içeriğin türü | Gideceği katman |
|---|---|
| davranışı bağlayan **kural** | rehber (CLAUDE.md) — kalır, kısaltılır |
| gerekçe / tarihçe / **ayrıntı** | `reference/*.md` ya da kanonik sözlük |
| bir vakadan çıkan **ders** | append-only günlük (FRICTION_LOG / GARDEN_LOG / karar defteri) |
| kuralı zorlayan **mekanizma** | kapı / hook / test (kod) |
| doldurulacak **format** | `templates/*.template.md` |

Rehberde kalan, taşınan içeriğe bir SATIRLIK işarettir (ölü referans olmayacak şekilde — `doc-truth`
denetler). Ölçülmüş vaka: pilotta rehber 366 satıra çıkıp kapıya takıldı; içerik atılmadı,
üç katmana dağıtıldı (ayrıntı→sözlük, gerekçe→günlük, rehberde 6 satır işaret) ve tavan altına indi.
Bu yasa budama yasasının tamamlayıcısıdır: **budama** invariant'ı ÖLMÜŞ artefaktı siler, **taşma**
invariant'ı YAŞAYAN ama yanlış katmandaki içeriği taşır. İkisini karıştırmak bilgi kaybıdır.

**Sürtünme yasası (v0.5 — öz-gözlem):** sistemin KENDİ kuralları bazen iş yapmayı engeller
(gereksiz tören, yanlış-pozitif kapı, çelişen rehber). Bunlar FRICTION_LOG'a (append-only) yazılır;
çıkış raporlarında ayrı bir failure sınıfıdır: **sistem-kuralı**. İki kural: (1) sürtünme kaydını
ajan değil Hakem/insan onaylar (ajan self-report'u taraflıdır); (2) kural ancak TEKRAR EDEN desen
görülünce değişir, tek vakayla değil. Bu, sistemi yaşayan kılan geri besleme: entropiyle savaşan
kurallar da entropi üretebilir; sürtünme günlüğü onu görünür yapar. (Homeostaz örneği: dosya-boyu
kapısı ↔ okuma kara-listesi tek döngünün iki yarısıdır — kapı bağlam-bombasını sezer, dosya bölünür
ya da kara-listeye girer, token maliyeti sabit kalır.)

## Bilinen başarısızlık modları (sistemin panzehirleri)

- **D-27 · Dalga sürüklenmesi** (5. dalgada görünür): bağımsız dalgaların kısmen-doğru fix'leri birikir —
  kopya soyutlamalar, sapan zarflar, ölü testler. Panzehir: periyodik "bahçıvan turu" (yeni
  desen/bypass/konsolidasyon taraması) + ders çıkarma adımı (→ FRICTION_LOG / yeni guard önerisi).
  Panzehrin HAFIZASI [BÜYÜK] **GARDEN_LOG.md** (append-only): bahçıvan turu bulguları burada birikir
  yoksa her tur amneziktir ("bunu geçen turda da görmüştük" kaybolur — FRICTION_LOG/GUARDS'ın
  öz-gözlemi kalıcı kılma gerekçesiyle birebir aynı). GARDEN_LOG §2 ayrıca "atlanan-kontrol borcu"nu
  tutar: çıkış raporunda kabul edilen test-edilmemiş davranış ölümlü dalga dosyasıyla silinmesin diye
  (kod borcu TECH_DEBT'te, davranış borcu burada — ayrı sınıf). `check-history --rule=append-only` zorlar.
- **D-28 · Meta-kural enflasyonu**: rehber+rol+takip dosyaları "ikinci bir kod tabanına" dönüşebilir.
  Panzehir: satır tavanları + gözlem-tetiklemeli budama + muhatap toggle'ı (kullanmayan ödemez).
- **D-29 · Tören şişmesi**: her işe tam dalga = hız ölür. Panzehir: hafif/tam mod ayrımı.
- **D-30 · Veri-durumu körlüğü**: hataların çoğu kod değil veri-durumu hatasıdır (boş liste, ilk
  kullanıcı, aşırı dolu hesap). Panzehir: persona tohumları + ürünü KULLANAN test (assert değil
  gezi raporu); v0.5'te qa 3-eksen senaryosu (veri-durumu/persona/akış-kesintisi).
- **D-31 · Dış-öneri bloat'ı (v0.5)**: dış modeller/danışmanlar tutarlı ama kanıtsız büyük yapılar önerir.
  Panzehir: her öneriye tek soru — "mekanizması ne, ihtiyaç kanıtı ne, kullanmayan ödüyor mu?"
- **D-32 · Yokluk körlüğü (v0.18.2 pilot bulgusu)**: bir kapı aradığı yapı (arayüz/desen/kontrol) dosyada
  HİÇ yoksa sinyal üretmiyordu — yokluk sessizce "temiz" sayıldı. Negatif kontrolde yakalandı:
  doğrulanmış bir açığı olan komut, güvenlik arayüzü hiç bulunamadığı için "temiz" çıktı. En
  tehlikeli hâl arayüzün var-ama-filtresiz olması DEĞİL, hiç olmamasıdır — kontrol o katmanda
  fiziksel olarak imkânsız hale gelir. Bu, boş-küme körlüğünün (yukarı bkz. "veri-durumu körlüğü")
  kavramsal ikizidir: biri veri boşken davranışı sınamayı unutur, biri aranan yapı boşken sonucu
  "temiz" sayar. Panzehir: kapı "aradığım şeyi bulamadım" durumunu AYRI bir sınıf olarak raporlar
  ("yok" ≠ "var ve uygun"), bu ikisini asla aynı "temiz" etiketine düşürmez.
  🔴 **Etiket (dogfood dürüstlüğü):** bu maddenin KISMİ mekanizması var — boş-küme/kayıp-dosya
  ayağı KODLANDI (`--allow-empty` + `[taranan=N]` + missing sınıfı, CONTRACT MADDE 15). "Aranan
  YAPI (arayüz/desen) yok" ayağı ise TARİF'tir, kapı kodu DEĞİL: hangi yapının aranması gerektiği
  repoya/dile özgüdür, kalibre edilmeden kodlanırsa yanlış-alarm üretir (bkz. "tarif/kapı sınırı").
  Savunması Hakem/E2'dedir — kâşif "yok" derse hakem bunu kanıt saymadan önce sorgular.

## Tamamlanma-beyanı kataloğu (TB) — "bitti" ne zaman yalandır

> **Neden sayılı:** bu maddeler repoda vardı ama **dağınık nesir** hâlindeydi (hakem rolü md.2 ·
> 7a · 7b · 8a · 8b · 8c, K59, K62, v0.12). Sayısız oldukları için hakem/dış-model onlara ATIF
> yapamıyordu. Katalog bunları adreslenebilir kılar: bir bulgu artık `TB-3 ihlali` diyebilir.
> **Üç bağımsız kaynak aynı deseni önerdi** (dış tarama K64/K65): sayılı katalog + ucuz denetim.
> 🔴 Her madde repoda ÖLÇÜLMÜŞ bir kaynağa bağlıdır — dışarıdan kopyalanmadı.
> **Önek uyarısı:** `SB-` bu repoda YAN-BUG numarasıdır (`SB-8-rev`, `SB-19`); tamamlanma-beyanı
> kataloğu bu yüzden `TB-` önekini kullanır.

- **TB-1 · "Test geçti" ≠ hedef karşılandı.** Yeşil koşu, asıl görev hedefinin karşılandığını
  göstermez. *Kaynak: hakem md.2.*
- **TB-2 · Assert gevşetildi/silindi, davranış aynı kaldı.** Testi koda uydurmak (test-gaming).
  Ayrım: refactor → test değişmemeli; bilinçli davranış değişikliği → plana bağlı değişmeli.
  *Kaynak: hakem md.8a.*
- **TB-3 · Test mock erken-return yapıyor, davranış hiç koşmuyor.** "Kimse testi bozmadı ama test
  zaten boşluğa koşuyordu." `mock_depth: mock-guarded` iken `verification: dogrulandi` yazılamaz.
  *Kaynak: hakem md.8c + `reference/pilot-dersleri.md` §3 (mock_depth deliği).*
- **TB-4 · "Hafif mod" beyanı, kullanıcı-görünür yüzeye dokunan diff.** UI/route/şema değişmiş
  ama eşlik eden doküman/akış güncellenmemişse beyan geçersizdir; diff yener. *Kaynak: hakem md.8b.*
- **TB-5 · "Aranan yapı yok, o yüzden temiz."** Yokluk körlüğü: "yok" ile "var ve uygun" aynı
  TEMİZ etiketine düşürülemez. *Kaynak: D-32 + hakem md.7a.*
- **TB-6 · Kanıt türetilmiş katmandan.** Özet/registry/mevcut doküman "öyle diyor" kanıt değildir;
  kaynak okunmalıdır. *Kaynak: D-21 (türetilmiş katman) + hakem md.7b.*
- **TB-7 · Tek seviye ölçüldü.** Aranan davranış fonksiyonun gövdesinde değil, çağırdığı serviste
  olabilir: "gövdesinde yok" ≠ "yapmıyor". *Kaynak: hakem md.7b.*
- **TB-8 · Kapanış ajanın "bitti" cümlesine dayanıyor.** Kapanış koşulu beyan değil, **diff'in
  vaadi örtmesidir**. *Kaynak: K59 ters-spec receipt.*
- **TB-9 · Kapsam beyanı ölçülmemiş.** "Şu kadar vakayı hedefler" bir NİYETtir; kapsam ancak
  korpusa karşı replay edilince ÖLÇÜMdür. Ölçüldü: K58 "158" dedi, replay **29/158 (%18)** çıkardı.
  *Kaynak: K62 REPLAY.*
- **TB-10 · "Yeşil" denmiş, komut çıktısı gösterilmemiş.** Beyan kanıt değildir; komut koşulur ve
  çıktısı gösterilir. *Kaynak: kod-yazma-disiplini §3.*
- **TB-11 · Kontrol sessizce atlanmış.** Atlamak serbesttir, **sessiz atlamak değildir** — atlanan
  kontrol artefakta yazılır. *Kaynak: v0.12 dış-model alanı kuralı.*

**Kullanım (E2 ile bağ):** TB-1…TB-11 denetiminin **mekanik** olan kısmı (TB-2 · TB-3 · TB-9 ·
TB-10) ucuz model kademesine iner; **yargı** gerektiren kısmı (TB-4 · TB-5 · TB-6 · TB-7) hakemde
kalır — bkz. `reference/model-effort-tiering.md`.


## Kurulum ajanının sık hataları (yapma)

Şablon metnini içerik sanmak (iskelet şablondan, et ölçümden) · küçük repoya rol/dalga/takip
kurmak (tören küçük projeyi öldürür) · kırmızı baseline üstüne kapı kurmak (önce yeşil veya
staged-only) · tüm modüllere birden CLAUDE.md dikmek (önce tek pilot) · kullanıcıya sormadan
dosya silmek/secret'a dokunmak (her zaman eskalasyon) · muhatap toggle'ı kapalıyken çok-ekip
katmanı kurmak (kullanmayan ödemez) · varlık kapısını kalite garantisi diye satmak · doğrulanmamış
atfı (makale/sayı) gerçek diye yazmak (önce web-doğrula veya hiç anma).

## Bilinçli YAPILMAYACAKLAR (varsayılan ret listesi)

Vektör kod DB'si (sembolik grep + bilgi katmanı yeter; repo 5-10x büyürse yeniden değerlendir) ·
elle changelog (git zaten o) · kod haritaları/dosya envanterleri (en hızlı çürüyen doküman) ·
kural kopyalama (hiyerarşi varken) · her klasöre barrel index · coverage eşikleri ·
PR/branch-protection töreni (solo akışta) · kişilik-bazlı rol metinleri · statik index/context-packet
JSON'ları (denormalizasyon → drift; ancak üreteç + "index==kaynak" kapısıyla kurulur) ·
özerk model-policy MOTORU sanmak (Claude Code skill'inde bu YAML'ı okuyup model seçen runtime yok) ·
"Feature ID yoksa iş yok"u chore/deps kaçışı olmadan dayatmak (sürtünme jeneratörü) ·
hidden-state / K-token / DiffuMask / ComprExIT gibi model-runtime compression tekniklerini
kurulum skill'i sanmak · Türkçe bağlamı otomatik İngilizceye çevirip ürün/karar anlamını riske
atmak (ancak ölçülmüş, opsiyonel middleware olabilir).
