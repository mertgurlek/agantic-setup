<!--
ÜRETİM TALİMATI (bu blok kopyalanmaz):
- Her {{...}} alanı FAZ 1 denetiminde ÖLÇÜLMÜŞ değerle doldurulur. Ölçmediysen yazma.
- Satır tavanı: KÜÇÜK seviye ≤60, ORTA/BÜYÜK ≤150. Tavana sığmayan içerik ya gereksizdir
  ya da modül dosyasına/docs'a aittir.
- YASAK: "şu an şöyle" durum anlatısı · kod parçacığı (file:line işaretçisi kullan) ·
  koddan okunabilen bilgi (dizin ağacı dökümü vb.) · başka repodan taşınan satır.
- Bölüm başlıklarını koru, içini bu repoya göre yaz. Uymayan bölümü SİL (boş bölüm bırakma).
- [toggle: PM] etiketli satırlar yalnız ürün-ekibi toggle'ı AÇIKSA yazılır; kapalıysa SİL.
- [toggle: dış-model] {{DIS_MODEL_*}} alanları yalnız ADIM 0 envanterinde bir dış model (Codex/GPT/
  Gemini/yerel LLM) ERİŞİLEBİLİRSE doldurulur. {{DIS_MODEL_CAGRI_KOMUTU}} = ortamda ölçülen GERÇEK çağrı
  yolu (ör. global wrapper `node ~/.claude/scripts/codex-run.mjs` ya da repoda varsa yerel `scripts/codex-run.mjs`;
  emin değilsen ADIM 0'da KOŞ ve gör). Hiç dış model yoksa: iki akış-alanına "(yok)" yaz ve dış-model bloğunu
  tümüyle SİL — kullanmayan ödemez, çekirdek şişmez.
- ÜRETİM SONRASI: `check-hygiene --rule=placeholders` + `check-doc-integrity --rule=doc-truth` koş —
  doldurulmamış {{}} / ölü yol kalmasın.
-->
# {{PROJE_ADI}} — Proje Kuralları

Bu dosya kanoniktir. Ajanlar işe başlamadan okur; çelişki durumunda öncelik sırası:
kullanıcı talebi > aktif plan dosyası > bu dosya > en yakın modül CLAUDE.md >
docs/DECISIONS.md > rol dosyası > diğer dokümanlar. Çatışmada dur ve süpervizöre çıkar.

## Çalıştırma & Doğrulama

| Komut | Ne yapar | Ölçülen süre |
|-------|----------|--------------|
| {{DEV_KOMUTU}} | geliştirme sunucusu | — |
| {{VERIFY_KOMUTU}} | tip + test + şema (her değişiklik sonrası ZORUNLU) | {{VERIFY_SURESI}} |
| {{HEDEFLI_TEST_KOMUTU}} | dokunulan modülün testleri | — |
| {{CI_KOMUTU}} | tam kapı (commit öncesi) | {{CI_SURESI}} |

**Baseline manifestosu (failure yeni mi eski mi ayrımı için):** lint {{LINT_DURUMU}} ·
{{TEST_SAYISI}} test {{TEST_SURESI}}'de yeşil · typecheck yeşil. Bundan sapma = SENİN değişikliğin.

## Merkezi altyapı — BUNLARI YENİDEN YAZMA

| İş | Kullan | Konum |
|----|--------|-------|
{{MERKEZI_ALTYAPI_SATIRLARI}}
<!-- ör (BU REPODAN DEĞİL): | HTTP istekleri | apiFetch | src/lib/apiClient.ts | -->

## Yerleşim kuralları (yeni kod nereye)

{{YERLESIM_TABLOSU}}
<!-- 3-6 satır: yeni özellik kodu nereye, paylaşılan kod nereye, hangi dizin donmuş-legacy,
     yeni çok-dosyalı modülün kanonik şablonu hangisi (mevcut en temiz modülü işaret et) -->

<!-- [ORTA+] kod-yazma disiplini dosyası kurulduysa bu satır KALIR; kurulmadıysa SİL (ölü referans
     olmasın). Kurulum: SKILL FAZ 3 madde 3a2. -->
- **Kod yazarken** (referans desen · dokunma kümesi · test-yok alan · stack kuralları):
  {{KOD_YAZMA_DISIPLINI_YOLU}}

## Okuma protokolü (token disiplini)

- ASLA tam okuma: {{KARA_LISTE_DOSYALARI}} — {{NEDEN_KISA}}
- Büyük şema/config dosyalarında bölüm-bazlı grep kullan, tamamını açma.
- Önce ara (grep), sonra dosya aç. Yeni kod yazmadan önce 1 referans desen oku: {{REFERANS_DOSYALAR}}.
- Uzun keşif / 3+ tool okuması sonrası ham geçmişi taşıma: focus summary yaz
  (gerçekler + risk + sonraki adım + atlanan ham bağlam). [ORTA+] Detay: docs/CONTEXT_BUDGET.md.
- Sıkıştırılamaz taahhütler özetlemede DÜŞMEZ: kullanıcı kararı · kabul kriteri · baseline ·
  secret/prod/auth/maliyet riski · aktif kilitler. [ORTA+] Kanonik liste tek yerde: docs/CONTEXT_BUDGET.md.

## Süreç kuralları

- 🔴 **OKUR KAYDI — yazmadan ÖNCE seç.** Jargon seviyesi kullanıcının değil,
  **ÇIKTININ** özelliğidir: aynı kişi koda teknik, plana sade ister. Varsayılan tablo:

  | Çıktı | Kayıt |
  |---|---|
  | kod · diff · kapı · şema · CONTRACT | **teknik** |
  | plan · rapor · özet · açıklama · durum · geri bildirim | **sade** |

  **sade** = terim ya hiç yok ya İLK geçişte tek cümle tanım · önce karar/sonuç, sonra ayrıntı.
  Kullanıcı o turda "teknik anlat" derse tablo geçersiz — **override yalnız o iş içindir**, buraya yazılmaz.
  Skill geliştiricisinin ölçümü (agentic-repo-setup paketi, 2026-08-27, 137 oturum): 13 doğrulanmış
  vakada seviye çıktıdan SONRA düzeltildi; hepsi *sadeleştirme* talebiydi, hiçbiri "daha teknik yaz"
  değildi. Asimetri: sade üretip teknikleştirmek ucuz, tersi pahalı. **Bu bir KAPI DEĞİLDİR** —
  "çok teknik" ölçülebilir invariant değil, E2'dir (aynı ölçümde kelime-listesi kapısı 19/19
  yanlış-alarm üretti — bu HEDEF REPODA henüz ölçülmedi, skill paketinin kendi ölçümüdür).
- **İş tipini ÖNCE belirle (mod otomatik buradan çıkar):** küçük/yerel fix mi (tek dosya,
  davranış değişmez, baseline'da iz yok) → **hafif mod**; şema/auth/çok-modül/yeni özellik /
  kullanıcı-görünür davranış / spec belirsiz → **tam dalga**. Belirsizse tam dalga seç.
- **Hafif mod** (küçük fix): tek uygulayıcı + verify + kısa çıkış raporu. Dış-model danışma YOK.
  **Tam dalga**: kâşif → plan → {{DIS_MODEL_PLAN_ADIMI}} → onay → uygulama → hakem → {{DIS_MODEL_DENETIM_ADIMI}}.
- 🔴 **DELEGASYON EKONOMİSİ — ana ajan YÖNLENDİRİR, her işi kendi yapmaz.** Uzun işte asıl darboğaz
  model değil ANA BAĞLAMDIR: şişen bağlamda geri-çağırma bozulur (context rot) ve ajan kendi
  kararlarını unutur. Panzehir, alt ajanı bir **BAĞLAM KALKANI** gibi kullanmaktır — 50 dosya okur,
  20 satır döner; ana bağlam kirlenmez. Kurallar:
  - **Ana ajanda KALAN:** kullanıcı diyaloğu · karar ve sentez · kabul ölçütü · aktif kilitler.
    **Delege EDİLEN:** geniş keşif · tarama · toplu okuma · bağımsız doğrulama.
  - **Eşik:** geniş keşif/tarama/toplu okuma **VARSAYILAN OLARAK
    delege edilir — delege ETMEMEK gerekçe ister.** Gerekçe üç katlı: ① maliyet (ucuz tier'a
    düşülebilir) ② context (ana bağlam kirlenmez) ③ **görev sadakati** — şişen bağlamda
    geri-çağırma bozulur ve ajan kendi kararlarını unutur.
    🔴 İSTİSNA — amaç belirleyicidir: *değiştireceğin* dosyayı KENDİN okursun (uygulayıcı kendi
    yazacağı dosyayı başkasına okutamaz). Delege edilen KEŞİFTİR, düzenleme değil.
  - **KÖRLÜK PANZEHİRİ (aşırı delegasyonun karşı-ağırlığı):** {{KILIT_DOSYALARI}} · kabul ölçütü ·
    baseline değerleri ana ajanın KENDİ okuduğu şeylerdir — bunları delege etmek ajanı koddan
    koparır ve yanlış senteze götürür. Sentezi asla delege etme.
  - **SENTEZ YÜKÜMLÜLÜĞÜ:** alt ajan raporundaki `[ÇIKARIM]` ve `[BEYAN]` etiketli iddialar
    **doğrulanmamış** sayılır; karara temel yapılacaksa ana ajan KENDİ ölçer. Yalnız `[ÖLÇÜLDÜ]`
    kanıttır. (Rapor sözleşmesi: `templates/rapor.template.md`.)
  - **DERİNLİK = 1:** alt ajan başka bir alt ajan çağırmaz. Daha çok keşif gerekiyorsa raporunun
    "sonraki adım" alanına yazar, ana ajan yeni tur açar. Derin özyineleme bağlamı parçalar ve
    sentezi imkânsızlaştırır (ölçüm: RLM manşet sonuçları depth-1'dedir — kaynak: agentic-repo-setup paketi, reference/rlm-recursive-language-models-ozet.md).
    ⚠️ **Zorlama düzeyi ROLE GÖRE değişir — dürüst etiket:** salt-okur rollerde (kâşif/hakem)
    `tools:` listesi ajan-çağırma aracını İÇERMEZ → MEKANİK olarak imkânsız. `tools:` satırı
    OLMAYAN roller (tüm araçları miras alır — genelde uygulayıcı) için bu kural yalnız TALİMATTIR.
    Yetki zarfını daraltmak (`tools:` eklemek) İNSAN ONAYI ister — ajan kendi zarfını değiştiremez.
  - 🔴 **SALT-OKUR FAN-OUT = VARSAYILAN.** Keşif/tarama/denetim işleri aynı turda
    PARALEL açılır — delege etmemek gerekçe ister, delege etmek değil. Bayat-bağlam riski bu
    sınıfta YOKTUR: eşzamanlı okuyucular aynı HEAD'i görür, hiçbiri yazmaz (aşağıdaki dört
    çakışma sınıfının DÖRDÜ de yazma gerektirir). Kısıtlamanın doğruluk gerekçesi yok.
    - Her brif AYRI soru sorar (aynı soruyu N kez sormak israf + sahte konsensüs).
    - Derinlik=1 korunur · sentez ana ajanda KALIR.
    - **HAFİF MOD MUAFİYETİ:** tek dosya + davranış değişmez işte delegasyon TÖREN maliyetidir
      (alt ajan bağlamını sıfırdan kurar) — ana ajan kendi yapar.
  - **PARALEL YAZAN İŞ — koşullu (DEĞİŞMEDİ):** ikinci ajan bağlamı korur ve işi tekrar
    anlatmayı önler; ama **yalnız dokunma kümeleri AYRIKSA**. Kesişiyorsa SIRAYLA koş (gerekçe:
    aşağıdaki bayat-bağlam tablosu — paralel çalışmanın K2/K3 hatası).
  - **EK İSTEK YÖNLENDİRME:** iş sürerken yeni istek gelince ana ajan ÖNCE sınıflandırır —
    salt-okur ise anında paralel ajana verir; yazan iş ise dokunma-kümesi kontrolünden geçirir.
    Ana ajan diyaloğu ve sentezi tutar, işi kendi yapmaz.
  - 🔴 **SENTEZ PROTOKOLÜ (fan-out'un karşı-ağırlığı — atlanırsa hız doğruluğu yer):**
    ⓐ `[ÖLÇÜLDÜ]` dışındaki hiçbir iddia karara temel olamaz — `[ÇIKARIM]`/`[BEYAN]` doğrulanmamıştır.
    ⓑ İki rapor ÇELİŞİRSE ana ajan KENDİ ölçer — **oylama YAPILMAZ, çoğunluk kanıt değildir.**
    ⓒ Kilit dosyalar · baseline · kabul ölçütü ana ajanın KENDİ okumasıdır (körlük panzehiri).
    Gerekçe [ÖLÇÜLDÜ]: rol raporlarında belirleyici olgunun karara taşınma oranı **%84** — ~6
    raporun 1'i kritik olguyu ana ajana HİÇ taşımıyor; fan-out bu kaybı ajan sayısıyla ÇARPAR.
  - **DÜRÜST SINIR:** bunlar TARİF'tir, kapı DEĞİL — "bağlam şişti" bulanık invariant, E0'a inmez
    (ajan self-report'u kanıt değildir). Hakem/insan denetler.
<!-- [toggle: dış-model — ADIM 0'da Codex/GPT/Gemini vb. ERİŞİLEBİLİRSE doldur; yoksa iki {{}} alanını da
     "(yok)" yazıp bu yorumu ve aşağıdaki dış-model bloğunu SİL — kullanmayan ödemez]
     {{DIS_MODEL_PLAN_ADIMI}}  = "dış-model plan-eleştirisi"
     {{DIS_MODEL_DENETIM_ADIMI}} = "dış-model adversarial denetim" -->
- **Dış-model danışma (tam dalgada, İNSAN-onaylı — spec/tasarım hatası en büyük hata sınıfı):**
  - **PLAN sonrası, uygulamadan ÖNCE:** planı dış-modele ÇÜRÜTTÜR (plan-eleştirisi) →
    `{{DIS_MODEL_CAGRI_KOMUTU}} "<plan + bu repodaki kısıt>; bu planı çürüt: eksik kenar-durum, yanlış varsayım, daha basit yol?"`
    Çıkan itirazları plana işle ya da gerekçesini DECISIONS.md'ye yaz.
  - **ONAY kapısında (hakem sonrası, salt-okur denetim):** diff'i dış-modele adversarial denetlet —
    Hakem'in dış-göz tamamlayıcısı (uygulayan ≠ doğrulayan'ın ikinci halkası).
  - **Sınır:** dış model SON ÇARE + insan-onaylı (gizli kod sızabilir); yalnız gerekli bağlamı ver,
    secret/prod sırrı gönderme. Atfı yaz (hangi model). Hafif modda KULLANMA (tören maliyeti boğar).
- **Sahiplik kilitleri** (dalga başına tek ajan dokunur): {{KILIT_DOSYALARI}}
- 🔴 **BAYAT BAĞLAM — paralel çalışmanın sinsi hatası (kilitler bunu ÇÖZMEZ):** çakışma tek şey
  değil, DÖRT şey. Kilit/worktree yalnız ilkini çözer:
  | Sınıf | Ne olur | Kilit çözer mi |
  |---|---|---|
  | Yazma-yazma (metinsel) | aynı dosyaya iki yazım, biri ezilir | EVET |
  | Yazma-yazma (SEMANTİK) | ayrı dosyalar, git temiz birleştirir, **kod kırık** (A imzayı değiştirdi, B eski imzayla çağıran ekledi) | hayır |
  | Okuma-yazma (**BAYAT BAĞLAM**) | B keşfi 10 dk önce yaptı; A o arada akışı değiştirdi; B **eski dünya modeline** göre kod yazar | hayır — izolasyon bunu KÖTÜLEŞTİRİR (daha geç haber) |
  | Kaynak yarışması | ortak port/test-DB/cache çarpışır | hayır |
  **Savunma (talimat — bu satır bir kapı DEĞİL, disiplindir):** ① paralel dalgada iş bölümü
  DOSYA sınırından değil, ÖZELLİK/alan sınırından yapılır · ② bir ajan merge ettiyse, açık
  görevdeki diğer ajanlar **etkilenen dosyaları yeniden OKUR** (bellekteki sürüme göre yazma) ·
  ③ keşif ile uygulama arasında başka bir dalga kapandıysa keşif **bayattır**, tazelenir ·
  ④ semantik çakışmanın tek gerçek savunması merge sonrası **tam doğrulama koşumudur** —
  metinsel merge temizliği kanıt değildir.
<!-- [toggle: paralel-oturum — aynı repoda birden çok Claude oturumu ya da dış-model YAZIMI olağansa yaz
     ve dosya-sahipliği hook'larını kur (örnek: paketin examples/settings.json'u); değilse bu maddeyi SİL] -->
- 🔴 **PARALEL YAZIM SÖZLEŞMESİ (dosya sahipliği):** yazan her ajan (ana oturum, alt ajan, ayrı
  terminal oturumu, dış model) dosyayı ilk yazışta SAHİPLENİR; kayıt ortak (`node scripts/sahiplik.mjs liste`).
  Sahiplik yalnız ÇALIŞIRKEN tutulur: ana ajanınki tur sonunda, alt ajanınki bitince bırakılır → kayıt
  varsa sahibi şu an çalışıyordur, bu yüzden çakışan yazım REDDEDİLİR (uyarı yazımı önlemez — ölçüldü).
  - **Öncelik (oylama/pazarlık YOK):** ① kilitli dosya ({{KILIT_DOSYALARI}}) → yalnız yönetici ·
    ② temeli değiştiren (imza/şema/arayüz) önce biter, onu kullanan sonra · ③ eşitse ilk sahiplenen ·
    ④ bekleyen kendi dokunma kümesindeki başka dosyaya geçer; sıra gelince dosyayı **YENİDEN OKUR**.
  - **El sıkışma:** hook "DOSYA SAHİPLİĞİ" ile reddedince önce başka dosyana geç; ana oturumsan
    sahibe `SendMessage` + `notify_when_idle` — sahibin boşa düşmesi = sahipliğin bırakılması.
    "bitti mi?" yoklaması YASAK. Alt ajansan ana ajana bildir.
    Etkileşimli ana oturum adını bir kez beyan eder: `node scripts/sahiplik.mjs ad <ListAgents adı>`
    (oturum kimliği mesaj adresi DEĞİLDİR).
  - **YÖNETİCİ bir ROLDÜR, süreç değil:** oturum içinde ana ajan; oturumlar arasında insanın atadığı,
    yoksa ilk sahiplenen ana oturum. Devreye girer: 3+ oturum aynı dosya · karşılıklı bekleme · kilitli
    dosya. Alt ajan yönetici olamaz (diğer oturumları göremez). Yönetici sırayı yazar, kod yazmaz.
  - **Dış model:** OpenRouter yazımı sahiplik + okuma-sonrası-değişti kontrolünden geçer; Codex
    `--write` yalnız `--yaz <dosyalar>` BEYANIYLA koşar, bitince beyan dışı/çakışan yazım raporlanır.
  - **Kapsanmayan (dürüst sınır):** Bash/`sed` yazımları hook'a görünmez — paralel dalgada dosya
    yazımı Edit/Write ile yapılır.
- **Çıkış raporu** (her iş sonu zorunlu): değişen dosyalar + eklenen satır + koşulan doğrulama
  komutları + failure sınıfı (baseline/benim/ortam/flaky/engel/**sistem-kuralı**) + atlanan kontroller.
  ("sistem-kuralı" = sistemin KENDİ kuralının yarattığı sürtünme → FRICTION_LOG'a; Hakem onaylar.)
  **ANA ajan ile ALT ajan aynı şeyi yazmaz:** bu madde ANA ajanın kullanıcıya raporudur. ALT
  ajanın (subagent) ana ajana DÖNÜŞÜ ayrı bir sözleşmedir — rol dosyasındaki "Çıktın:" bloğu
  bağlayıcıdır ve `templates/rapor.template.md` biçimini izler. Alt ajan raporu kullanıcıya
  değil, ana ajana yazılır: ham çıktı yığma, kanıt etiketi zorunlu.
- **Süpervizör eskalasyonu — kullanıcıya sorulur:** prod veriye dokunan her şey · kullanıcıya
  görünür davranış değişikliği · yeni bağımlılık · secret/maliyet işlemi · kapsam genişlemesi.
  Kendi karar verir + DECISIONS.md'ye yazar: desen-içi teknik seçimler. Sorular dalga sonunda TOPLU.
- [toggle: PM] **Ürün-karar eskalasyonu (teknik-karardan AYRI kademe):** kullanıcı-görünür davranış ·
  fiyat/paket · persona/hedef-kitle · kapsam değişiminde → AI seçenek+öneri üretir, İNSAN karar verir
  + PRODUCT_LOG.md'ye yazar. Öznel "stratejik mi?" tetiği otomatik ateşlenmez, insana çıkar.

## Bilimsel çalışma disiplini

- **Dalkavukluk yasak:** iddia, sahibine bakılmaksızın (kullanıcı dahil) kanıtla sınanır.
  Kanıt aksini gösteriyorsa açık söyle ("bu varsayım yanlış görünüyor, kanıt: ...");
  emin değilsen "bilmiyorum" de ve nasıl doğrulanacağını öner. Kanıtsız "haklısın" YASAK —
  onay kanıt değildir, kullanıcının tekrar etmesi tezi doğrulamaz.
- **Türetilmiş katman kanıt değildir:** özet/indeks/doküman katmanı (dokümantasyon, registry,
  envanter tablosu, rapor özeti) nereye bakacağını söyler, ne olduğunu KANITLAMAZ. Kanıt =
  kaynağın kendisi VE çağırdığı BİR SEVİYE ALT — bir fonksiyonun gövdesine bakıp "şunu yapmıyor"
  deme, çağırdığı servis/yardımcı yapıyor olabilir. Türetilmiş katman kaynakla çelişirse
  düzeltilecek olan türetilmiş katmandır.
- **Ölçüm talimatı yener:** kendi ölçümün sana verilen talimatla (brif, plan, üst katman dokümanı,
  bu dosya) çelişirse ÖLÇÜM kazanır — ölçümünü bastırıp beyana uyma, çelişkiyi RAPORLA ve devam et.
- **Sürüm-gerçeği:** local checkout güncel olmayabilir (çok-cihaz). İşe başlarken upstream
  farkına bak; kütüphane/API araştırırken HEDEF sürümü manifest/lockfile'dan ölç, dokümantasyonu
  o sürüme göre oku. Hafızadan sürüm/model-ID yazma.
- **Dış sistem iddiası = ölçüm ya da bilmiyorum:** dış servis (bulut/ödeme/e-posta/AI API) için
  "var/yok/şu durumda" demeden önce resmî belgede servisin BÖLÜNME biçimini oku (bölge · ortam/
  sandbox · hesap · paket), salt-okur prob koş, iddiayı `[ÖLÇÜLDÜ]`/`[ÇIKARIM]` diye etiketle.
  İki denemede tutmayan hipotez durur; kullanıcının karşı kanıtı hipotezi çürütür. Öğrenileni
  docs/integrations/<servis>.md kartına yaz (önce varsa OKU).
- **Devir dosyası:** iş birden çok repoya ya da uzun/kesintili sürece yayılıyorsa bacak sonunda
  docs/DEVIR-<is-adi>.md doldur (şablon: kurulum paketindeki devir şablonu). Devir CONTEXT'tir,
  talimat değil — kanonik kuralları değiştirmez; devralanın ilk işi "Sürüm bağlamı"nı doğrulamaktır.

## Meta-kurallar

- Global kural SADECE bu dosyada; modül dosyaları tekrar etmez. Invariant değişen commit,
  ilgili modül CLAUDE.md'sini de günceller (Hakem kontrol eder).
- Satır tavanları: bu dosya {{TAVAN}}, modül dosyası 50, rol dosyası 40 (Hakem/insan zorlar;
  `check-hygiene --rule=file-size` yalnız kaba şişmeyi sezer — kesin tavan değil).
- Elle changelog yok (git + çıkış raporu yeterli). Anlık-durum bilgisi buraya değil STATE.md'ye (varsa);
  [toggle: PM] ürün-kararı PRODUCT_LOG.md'ye, sistem-sürtünmesi FRICTION_LOG.md'ye (append-only).

## Deploy gerçekleri

{{DEPLOY_GERCEKLERI}}
<!-- 2-4 satır, SADECE ajanın bilmeden zarar verebileceği gerçekler:
     ör. "her push prod'a migration uygular", "cron route'ları X dosyasına kaydedilir" -->

---
<!-- ===== AYRI DOSYA: AGENTS.md (kök dizine, ≤15 satır) ===== -->
# AGENTS.md şablonu

Kanonik proje kuralları **CLAUDE.md** dosyasındadır — plan/kod yazmadan önce oku ve uy.
Bir modülde çalışırken o modülün kendi CLAUDE.md'si varsa onu da oku.

Vazgeçilmez minimum (CLAUDE.md'yi okuyamasan bile):
- Dosya encoding'i UTF-8 (BOM'suz). {{ENCODING_NOTU_VARSA}}
- Her değişiklik sonrası: {{VERIFY_KOMUTU}} — yeşil olmadan iş bitmedi sayılır.
- Secret'lara ve prod veritabanına DOKUNMA; gerektiğinde dur ve insana sor.
- Bayat dokümanlara güvenme: CLAUDE.md'nin işaret etmediği eski plan/rapor dosyaları tarihseldir.
