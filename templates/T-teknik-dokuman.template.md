---
# ============================================================================
# [T] TEKNİK DÖKÜMAN ŞABLONU (Katman A — genel, repo-özgü değil)
#
# ÜRETİM TALİMATI: Bu FORMAT'tır, içerik değil. Her {{...}} alanı ve her açıklama
# satırındaki örnek KURULUMDA hedef repoya göre ÖLÇÜLEREK dolar/değişir. Kapalı-küme
# alanları (`profile`, `mock_depth`, `verification.status`) hedef repoya göre daralt/genişlet
# ama üç değerin ANLAMINI koru — bu şablonun panzehir olduğu hata sınıfları bu değerlere bağlı.
#
# Yer: KODUN YANINDA — her repoda, `docs/tech/<konu>.md`. Dağıtık.
# Saat: SENKRON — kodla AYNI commit'te güncellenir. Güncel değilse doc-recency
#       kapısı commit'i BLOKE EDER (kapı kuruluysa — bkz. gates/check-doc-integrity.mjs --rule=doc-recency).
#       Kapı kurulmadıysa bu senkron disiplin, uygulayan/hakem rolüne kalır.
# Kim yazar: kodu değiştiren geliştirici (yeni iş) · kâşif→uygulayıcı→hakem (geçmişe dönük).
# Kim okur: [L0] son-kullanıcı üreteci (varsa) · test-brief üreteci · bayatlama kapısı ·
#       API tüketicisi (entegrasyon geliştiricisi).
#
# ALTIN KURAL: KOD PARÇACIĞI YOK. Kodu buraya kopyalarsan iki gerçek olur ve
# kopya sessizce eskir. Koda `repo:symbol` işaretçisiyle bağlan; kod değişince
# doc-recency/doc-truth kapısı (kuruluysa) seni uyarır.
#
# NE DEĞİL: Bu Swagger/OpenAPI değil. Swagger "hangi endpoint hangi payload alır" der
# (ve koddan otomatik üretilir). Bu dosya Swagger'ın SÖYLEMEDİĞİNİ söyler: bu çağrı ne
# işe yarar, hangi sırayla çağrılır, bu hata kodu ne demek, hangi ayar sonucu değiştirir.
# ============================================================================

id: TECH-<MODUL>-<NNN>              # örn. TECH-AUTH-001 — modül kısaltması hedef repoya göre

# ============================================================================
# RISK_SINIFI (mekanizma — kaynağı: pilot bulgusu, önceki pilot kaydı pilot-proje/PILOT-BULGULARI.md (git geçmişi): 35 [T]'nin
# yalnız 3'ü DOĞRULANMIŞ, çoğu "kod okumasına dayanıyor, testle doğrulanmadı" — en derin
# eleştiri, GPT-5.6 ile bağımsız doğrulandı: "doğrulamanın altın standardı KOD OKUMASI
# oldu, ÇALIŞTIRMA değil". `profile` KOD SINIFINI ayırır (api/ui/webhook/ai); bu AYRI
# bir eksen — bulgunun/[T]'nin KENDİSİNİN riskini sınıflar (para/veri kaybı mı, yoksa
# zararsız görsel bir kusur mu). Aşağıdaki `verification.kanit_tipi` kısıtı BUNA bağlıdır.
# ============================================================================
risk_sinifi: <para|veri|guvenlik|normal>   # bu [T]'nin anlattığı davranış YANLIŞSA ne kaybedilir?
                                    #   para     → hatalı işlem/ödeme/faturalama (örn. çifte tahsilat)
                                    #   veri     → hatalı/kayıp kalıcı veri (örn. yanlış kullanıcıya yazma)
                                    #   guvenlik → yetki/erişim ihlali (örn. yanlış rol onayı)
                                    #   normal   → yukarıdakilerin hiçbiri (görsel/kozmetik/düşük-etki)
                                    # [E2 — hakem doğrular]: kapı yalnız kapalı-küme değerini görür,
                                    # DOĞRU sınıfın seçildiğini göremez (yanlış-düşük seçmek riski gizler).

# ============================================================================
# feature_id ÇOĞUL + İDDİA (mekanizma — kaynağı: gerçek bir pilotta bulunan kök hata)
#
# KÖK HATA SINIFI: feature_id [T]'ye SAHİPLENDİRİLİRSE — sanki birincil anahtarmış gibi —
# geliştirici ekran için [T] yazarken KOD terimleriyle isimlendirir (`giris-ekrani`),
# oysa kullanıcının görevi başka bir kelimeyle anılır (`sifre-sifirlama`) ve birden çok
# yüzeye (ekran + rota + e-posta + token) YAYILIR. İki [T] aynı işin iki yüzü ama AYRI
# feature_id taşırsa → gruplaşma çöker → [L0]/registry "bu makale hangi [T]'lerden
# beslenir" sorusunu cevaplayamaz.
#
# ⭐ KURAL:
#   KOD kimliği   = anchor (repo:symbol)  ← kapı/CI türetir, DETERMİNİSTİK
#   GÖREV kimliği = feature_id            ← İNSAN kararı, KULLANICININ DİLİYLE
#   REGISTRY      = ikisi arasındaki JOIN ← gruplamanın SAHİBİ (kanonik; kuruluysa registry.template.yaml)
#
# ⚠️ feature_id GÖREV ŞEKLİNDE olmalı, KOD ŞEKLİNDE ASLA:
#      ✅ sifre-sifirlama · siparis-limiti      (kullanıcı bunu arar)
#      ❌ giris-ekrani · LoginCommandHandler        (kod yapısı — kullanıcı bunu aramaz)
#   TEST: "Kullanıcı bunu arar mı?" (retrieval.search_queries ile AYNI eksen — [L0] kuruluysa)
# ============================================================================
feature_ids: []                     # ⭐ ÇOĞUL — bir [T] BİRDEN ÇOK görevi besleyebilir
                                    #   örn. [sifre-sifirlama, giris-yapma]
                                    #   ⚠️ Bu bir İDDİADIR, tanım DEĞİL — KANONİK liste registry'dedir (varsa).
                                    #   Registry/join kapısı kuruluysa çift-yönlü tutarlılığı denetler:
                                    #     · buradaki her id registry'de VAR MI?
                                    #     · registry o feature'ın tech_docs'unda BU dosyayı listeliyor mu?
                                    #   BOŞSA → YETİM [T]: hiçbir [L0]'a görünmez → kapı (kuruluysa) UYARIR.

module: {{MODUL_SLUG}}              # kurulumda ÖLÇÜLÜR — hedef repo modül/klasör adıyla eşleşir
repo: {{REPO_ADI}}                  # kurulumda ÖLÇÜLÜR — bu şablonu barındıran reponun gerçek adı

# --- SURFACE: kullanıcı-görür yüzey -----------------------------------------
# "Bu değişiklik kullanıcı akışını etkiler mi?" filtresinin TEMELİ.
# Buradaki bir sembol değişirse → [L0]/co-update sinyali (kuruluysa) tetiklenir.
# Buranın DIŞINDA kalan iç refactor → kullanıcı dokümanına DOKUNULMAZ (ucuz eler).
surface:
  commands: []                      # örn. [LoginCommand, ForgotPasswordCommand] — hedef repo terimleriyle
  api: []                           # örn. ["POST /auth/login"]
  dtos: []                          # örn. [LoginRequestDto, TokenResponseDto]
  enums: {}                         # örn. {LoginFailureReason: [InvalidCredentials, Locked]}

# --- BEHAVIOR: davranış sözleşmesi -----------------------------------------
# ⚠️ Sembol-varlık kapısı davranışı GÖRMEZ. "Sembol duruyor" ≠ "doğru çalışıyor".
# Aynı bayrak/varyant farklı ortamda farklı davranabilir → her varyant beklenen çıktısını
# BURAYA yazar. Golden test (varsa) bunu sınar.
# Akış GLOBAL ise (varyanta göre değişmiyorsa) tek satır yaz: `global: "..."`.
behavior:
  global: "<koşulsuz davranış — akış her ortamda/varyantta aynıysa>"
  # veya varyanta göre ayrışıyorsa hedef repoya göre isimlendirilmiş anahtarlar kullan:
  # {{VARYANT_ADI_1}}: "<bu varyantta ne olur>"
  # {{VARYANT_ADI_2}}: "<bu varyantta ne olur>"

# --- FLAGS: bu yüzeyi kapılayan bayraklar ----------------------------------
# Firma/tenant/feature-flag applicability'sinin HAMMADDESİ (varsa). Boşsa akış global
# demektir — bunu da AÇIKÇA yaz (`flags: []  # global`), boş bırakıp belirsiz bırakma.
#
# 🔴 EN SIK YAPILAN HATA (ölçülmüş: bir pilotta 6 [T] bu yüzden YANLIŞ bilgi veriyordu):
#    Bayrağı işleyicinin KENDİ GÖVDESİNDE arayıp bulamayınca `flags: []` yazmak.
#    Ayar/lisans çoğu zaman işleyicinin ÇAĞIRDIĞI SERVİSTE okunur — "gövdesinde yok" ≠ "yapmıyor".
#    Kanıt = kaynağın kendisi VE çağırdığı BİR SEVİYE ALT (bkz. reference/doctrine.md).
#    Zorlayan: `check-provenance --rule=config-flags` — bu [T] `flags: []` derken beslediği [L0]
#    gerçek bir koşul beyan ediyorsa ÇELİŞKİ olarak raporlanır (biri yanlış ölçülmüş demektir).
#
# Doluysa her madde İKİ alanı taşır (konfig ekseni toggle'ı açıksa kapı denetler):
#   - ad: <KanonikAd>              # docs/FEATURE-DICTIONARY.md'deki BİREBİR yazım (drift denetlenir)
#     etki_sinifi: engel           # engel | kisit | hesap | gorunurluk | kapsam
flags: []                           # `[]` = ÖLÇÜLDÜ ve koşul YOK (global). Ölçmediysen ölç, boş bırakma.

# --- ELIGIBILITY: kim / hangi rol / hangi koşulda kullanır (OPSİYONEL) -------
# ⚠️ `flags` "hangi bayrak" der; eligibility "kim, hangi rol, hangi aksiyonu, hangi bayrakla
#    yapabilir" der (rol × flag × aksiyon → izin/reddet). Çok-kiracılı/yetki-duyarlı sistemlerde
#    kritik; API tüketicisi bunu bilmeden entegre olamaz. OPSİYONEL — yetki-duyarlı yüzeylerde
#    aç; global akışta boş bırak (`# global`). Yetki modeli yoksa bu bloğu SİL.
eligibility: []                     # örn. [{role: Admin, action: approve, requires_flags: [X], result: allow}]

# --- STATE_TRANSITIONS: yaşam döngüsü geçişleri (OPSİYONEL, stateful akışta) --
# ⚠️ Hata sözlüğü DURUMLARI listeler; bu GEÇİŞLERİ verir (hangi durumdan hangisine, hangi
#    tetikleyiciyle, hangi guard altında). Stateful bir akışsa (Draft→Submitted→Approved
#    gibi) aç. [L0] (varsa) "kullanıcı ne yapabilir"i bundan çıkarır. Stateless akışta SİL.
state_transitions: []               # örn. [{from: Submitted, trigger: some_action, to: Approved, guard_anchor: repo:Symbol}]

# --- OBSERVABLE_EFFECTS: gözlemlenebilir yan-etkiler (OPSİYONEL, yan-etkili komutta) --
# ⚠️ Public yüzey "ne döner"i verir; bu "ne YAZILIR / hangi event fırlar / kim bildirilir"i verir.
#    Asenkron entegrasyon/event akışı varsa API tüketicisi hangi webhook'un tetiklendiğini
#    BİLMELİ. OPSİYONEL — yan-etkili komutlarda aç, saf sorguda SİL.
observable_effects:                 # her biri anchor'lı — sembol-varlık kapısı (kuruluysa) denetler
  emits: []                         # örn. [{event: SomeEvent, anchor: repo:SomeEventSymbol}]
  writes: []                        # kalıcı yan-etki (hangi entity/tablo — İSİM, şema DEĞİL)
  notifies: []                      # bildirim/e-posta tetiği

# --- ANCHORS: koda bağ (bayatlama tripwire'ı) — OBJECT, düz string DEĞİL ------
# ⚠️ düz string yetmez → object: hangi anchor CANONICAL, hangi değişimde doc invalid.
# `repo:symbol` ZORUNLU (aynı sembol birden çok reponun barındırdığı ortamlarda tekrar edebilir —
# tekil isimden hangi reponun kastedildiği anlaşılmaz).
anchors: []                         # örn. [{repo: {{REPO_ADI}}, symbol: LoginCommandHandler, kind: handler, primary: true}]
                                    #   kind: handler|service|dto|enum|test · primary: canonical mi

# --- TEST_ANCHORS: davranışı DOĞRULAYAN teste bağ (OPSİYONEL ama güçlü tavsiye) --
# ⚠️ Davranışı testle kanıtla, halüsinasyon değil. Ajan "bu kural hangi testle
#    doğrulanıyor"u okur; [L0]/API tüketicisi "test edilmiş" diyebilir.
#    behavior contract'ın DOĞRULAMA bağı — `behavior.*` iddiasını teste demirler.
#
# 🔴 `mock_depth` ZORUNLU (mekanizma — kaynağı: gerçek bir pilotta bulunan doğrulama-zinciri
#    deliği): mock guard ERKEN-RETURN yapabiliyorsa test YEŞİL, anchor GERÇEK, ama ASIL
#    DAVRANIŞ HİÇ KOŞMUYOR olabilir. "test_anchors doluysa dogrulandi" kuralı bu sınıfta
#    SİSTEMATİK OLARAK YALAN SÖYLER. test-gaming'in akrabası — kimse testi bozmadı, test
#    zaten baştan boşluğa koşuyordu. mock_depth bunu görünür kılar.
#
# ⚠️⚠️ DÜRÜST SINIR (uydurma yok — bunu OLDUĞU GİBİ oku, "otomatik zorlanıyor" SANMA):
#    Bu alanın DOLU olması, kapının kontrol edebileceği TEK şeydir. Alanın DOĞRU
#    doldurulduğunu (geliştirici gerçekten mi baktı, yoksa reflekle mi "real" yazdı)
#    HİÇBİR KAPI GÖREMEZ — kapı yalnız "alan boş mu dolu mu" görür, "iddia doğru mu"yu göremez.
#    → [E2 — HAKEM doğrular, KAPI doğrulayamaz]. `verification: dogrulandi` verilebilmesi
#    İÇİN HAKEM İMZASI ŞARTTIR (bkz. verification bloğu). Bu alanı "real" yazıp geçmek,
#    kapıyı memnun eder ama deliği KAPATMAZ — yanlış güven, deliğin kendisinden tehlikelidir.
test_anchors: []                    # örn. [{behavior: "limit aşımı → Block",
                                    #        anchor: {{REPO_ADI}}:SomeTest#RejectsOverLimit,
                                    #        mock_depth: real}]
                                    # mock_depth ZORUNLU — üç değer:
                                    #   real         → davranış GERÇEKTEN koşuyor      → hakem onayıyla `dogrulandi` verilebilir
                                    #   partial      → bazı bağımlılıklar mock         → hakem onayıyla `dogrulandi` verilebilir (not düş)
                                    #   mock-guarded → ⚠️ erken-return, DAVRANIŞ KOŞMUYOR
                                    #                  🚫 `verification: dogrulandi` YASAK → `kontrol-bekliyor`da kalır

# ============================================================================
# KOD-SINIFI PROFİLLERİ (mekanizma — kaynağı: tek şablonun her kod sınıfında
# yetersiz kaldığı gerçek pilot bulgusu)
#
# BULGU: Tek [T] şablonu genelde YETMEZ. Her kod sınıfı, şablonun HİÇ SORMADIĞI bir
# soru doğurur. Aşağıdaki bloklar OPSİYONEL — yalnız o sınıfta çalışıyorsan doldur,
# değilse SİL. Hedef repoda hangi profillerin var olduğu FAZ 1'de ölçülür.
# ============================================================================

profile: <api|ui|webhook|ai>        # bu [T] hangi kod sınıfını anlatıyor (kapı — kuruluysa — bunu okur)
                                    # [E2 — hakem/insan doğrular, mekanik kapı DEĞİL]: kapı yalnız
                                    # değerin KAPALI KÜME'den geldiğini görebilir, DOĞRU sınıfın
                                    # seçildiğini (yanlış profil → yanlış bölümler açılır/kapanır,
                                    # yanlış risk sınıfı denetlenir) göremez.

# --- PROFİL: UI/EKRAN (profile: ui) ----------------------------------------
# ⚠️ BİLİNEN RİSK SINIFI: UI'da çıktı bir YANIT değil, bir NAVİGASYON — ve o navigasyon
#    middleware'den TEKRAR geçebilir. Dahası navigasyon hedefi (`window.location.assign(string)`
#    gibi) çoğu zaman DERLEYİCİDEN KAÇAR (tip sistemi hedef rotayı denetlemez) → kırık link
#    sessizce prod'a çıkabilir. Bu bloğun var oluş nedeni tam bu sınıf hatayı yakalamak.
ui_ref: []                          # buton/metin İÇERİĞİNİ KOPYALAMA → i18n KEY'ine BAĞLAN (varsa)
                                    #   örn. [{element: "giriş butonu", key: "auth.login.submit"}]
                                    #   Metin değişince doküman BAYATLAMAZ (key sabit). Key varlığı → doc-truth (E0, kuruluysa).
                                    #   ⚠️ KURULUMDA DOĞRULA: i18n key sistemi var mı, yoksa metin doğrudan koda mı gömülü?
                                    #      Gömülüyse ui_ref KURULAMAZ — yalnız ui_exits kalır.
ui_exits: []                        # ⭐ NAVİGASYON HEDEFLERİ — "bu ekran nereye gider"
                                    #   örn. [{trigger: "başarılı giriş", target: "/dashboard"}]
                                    #   KAPI (kuruluysa): hedef rota filesystem'de VAR MI? → deterministik, kırık-link avcısı
middleware_reentry: <true|false>    # navigasyon middleware'e geri giriyor mu (auth/redirect döngüsü riski)

# --- PROFİL: WEBHOOK/ASYNC (profile: webhook) -------------------------------
# ⚠️ BİLİNEN RİSK SINIFI: 200 DÖNDÜKTEN SONRAKİ ÇÖKME İSTEMCİDEN GİZLİ olabilir. Kurtarma
#    zincirinin her halkasının KENDİ FİLTRESİ varsa → hiçbirine uymayan bir "YETİM DURUM"
#    doğabilir. Sessiz veri/iş kaybının klasik kaynağı (test yeşil, monitoring sakin).
post_ack_failure: <null|"...">      # 200/ACK döndükten SONRA çökerse ne olur? (istemci bilmez!)
recovery_chain: []                  # kurtarma halkaları + HER BİRİNİN FİLTRESİ
                                    #   örn. [{step: retry-queue, filter: "yalnız 5xx"}, {step: dlq, filter: "yalnız N deneme sonrası"}]
orphan_states: []                   # ⭐ HİÇBİR kurtarma filtresine uymayan durumlar — YETİM
                                    #   örn. ["4xx + ilk denemede çökme → ne retry'ya ne DLQ'ya girer"]
                                    #   BOŞ BIRAKMA: "yetim durum yok" bir İDDİADIR, kanıtla (inceleyip yaz).

# --- PROFİL: AI/PROMPT (profile: ai) ---------------------------------------
# ⚠️ BİLİNEN RİSK SINIFI: mock guard ERKEN-RETURN → test yeşil, davranış hiç koşmuyor.
#    → test_anchors'ta `mock_depth` ZORUNLU (yukarı bak). Bu profilde ÖZELLİKLE denetlenir.
prompt_anchors: []                  # prompt şablonu nerede (kod parçacığı DEĞİL — anchor)
model_dependency: <null|"...">      # hangi modele bağlı; model değişirse davranış değişir mi

# ============================================================================
# CONSTANTS (mekanizma — kaynağı: bir değerlendirmede bulunan "bot sayı uydurmaya
# itiliyor" bulgusu)
#
# BULGU: Son-kullanıcı dokümanı (varsa) belirsiz süre/eşik ifadeleri kullanırsa
# ("birkaç dakika", "link süreli") okuyan/üreten taraf (bot dahil) SAYI UYDURMAYA itilir.
# KÖK NEDEN: [T] DAVRANIŞI ve BAYRAĞI yakalar ama SABİTLERİ yakalamazsa bu boşluk açılır.
#
# ⭐ O sayılar genelde KODDA VARDIR → ANCHOR'LANABİLİR → değişince doc-recency (kuruluysa)
#    ateşler. Sabit ya ANCHOR'LI GERÇEKTİR, ya YOKTUR (ve okuyan taraf dürüstçe
#    "bilmiyorum" der). Uydurma YOK.
# ============================================================================
constants: []                       # koddan çıkarılan SOMUT değerler — her biri ANCHOR'LI
                                    # örn:
                                    #  - {name: {{SABIT_ADI}}, value: "{{DEGER}}",
                                    #     anchor: {{REPO_ADI}}:{{SEMBOL}}}
                                    # ⚠️ ANCHOR'SIZ SABİT YAZMA — anchor'sızsa uydurmadır, [L0]'a (varsa) geçemez.
                                    # ⚠️ GLOBAL sabitler (destek e-postası, yardım merkezi URL'i gibi feature'a
                                    #    AİT OLMAYAN değerler) BURAYA GİRMEZ — onlar `site-config` global sözlüğüne
                                    #    aittir (bkz. templates/site-config.template.yaml). Aksi halde her feature'ın
                                    #    kendi kopyası olur → drift garantisi.

# ============================================================================
# VERIFIED_ABSENCES (mekanizma — kaynağı: bir değerlendirmede bulunan "yokluk
# halüsinasyonu" bulgusu)
#
# BULGU: Bir yokluk iddiası ("bu özellik yoktur") DOĞRULANMADAN yazılırsa, üreteç/okuyan
# taraf o boşluğu ÇIKARIMLA doldurabilir ve iddia YANLIŞ KESİNLİĞE dönüşebilir.
#
# ⭐ SERT KURAL: Bir yokluk iddiası, o yokluk BURADA DOĞRULANMADIKÇA hiçbir yerde
#    (özellikle [L0]'da) İMA EDİLEMEZ. "X yapamazsınız" demek, "X yapabilirsiniz" demek
#    KADAR kanıt ister. Doğrulanmamış yokluk → okuyan taraf `bilinmiyor` der, KESİNLİK ÜRETMEZ.
# ============================================================================
verified_absences: []               # KODDA OLMADIĞI DOĞRULANMIŞ yetenekler (negatif kanıt)
                                    # örn:
                                    #  - {claim: "{{IDDIA}}",
                                    #     evidence: "{{KOD_KANITI — hangi dosyada ne YOK, nasıl doğrulandı}}",
                                    #     checked_at: {{TARIH}},
                                    #     checked_commit: {{SHA}}}
                                    # ⚠️ BOŞ ≠ "yokluk yok". BOŞ = "hiçbir yokluk DOĞRULANMADI" →
                                    #    okuyan taraf bu konuda YOKLUK İDDİA EDEMEZ, `bilinmiyor` der.

intent_source: {{NIYET_KAYNAGI}}    # "neden böyle" niyeti — varsa iş-takip aracı ticket bağı (örn. fibery://...)
                                    # iş-takip aracı entegrasyonu yoksa bu alanı SİL.

# --- VERIFICATION: YAPILANDIRILMIŞ, free-text DEĞİL --------------------------
# ⚠️ "kod değişince senkron denetlenebilir"in GERÇEK kapısı. Serbest metin makine-okunamaz.
#
# 🔴 KISIT: `test_anchors`ta HERHANGİ bir anchor `mock_depth: mock-guarded` ise
#    → `status: dogrulandi` YASAK. `kontrol-bekliyor`da kalır.
#    NEDEN: test yeşil + anchor gerçek AMA davranış hiç koşmuyor olabilir → "doğrulandı"
#    demek YALAN olur. Bu kısıt DETERMİNİSTİK (E0, kuruluysa kapı denetler).
#
# 🔴 AYRI KISIT — `mock_depth` İDDİASININ KENDİSİ (E2): yukarıdaki E0 kısıtı yalnız alan
#    DOLU mu'yu görür; `real`/`partial` iddiasının DOĞRU olup olmadığını göremez. Bu yüzden
#    `status: dogrulandi` HAKEM (insan ya da ayrı doğrulayıcı ajan) İMZASI OLMADAN verilemez —
#    kapı burada TEK BAŞINA yeterli değildir, yalnız yanlış iddiaları FİLTRELER, DOĞRU iddiayı
#    ONAYLAYAMAZ.
#
# 🔴 YENİ KISIT — `kanit_tipi` (mekanizma — kaynağı: pilot bulgusu, "35 [T]'nin yalnız 3'ü
#    DOĞRULANMIŞ" + GPT-5.6'nın bağımsız bulgusu "altın standart KOD OKUMASI oldu, ÇALIŞTIRMA
#    değil"): `status: dogrulandi` NASIL doğrulandığını ŞEFFAFLAŞTIRIR — okuma mı, test mi,
#    fiilen çalıştırma mı. Üç değer GÜÇ SIRASIYLA:
#      okuma      → yalnız kod okundu (statik inceleme) — DAVRANIŞSAL iddiada ZAYIF kanıt
#                    (kod "doğru görünür" ama gerçekten o yolu hiç koşturmadın)
#      test       → bir test bu davranışı koşuyor (test_anchor'lı, mock_depth ile çapraz denetlenir)
#      calistirma → repro/verify script'i FİİLEN çalıştırıldı, çıktı GÖRÜLDÜ (en güçlü kanıt)
#    🔴 SERT KISIT: `risk_sinifi: para|veri` olan bir [T], `kanit_tipi: okuma` ile
#    `status: dogrulandi` ALAMAZ (kapı — kuruluysa — bunu E0 olarak zorlar, bkz.
#    gates/check-provenance.mjs --rule=coverage-gate). Para/veri kaybı davranışsal bir iddiadır — kodun
#    "doğru görünmesi" gerçekten öyle çalıştığını KANITLAMAZ. En az `test` ya da
#    `calistirma` ister. (`normal`/`guvenlik` risk sınıfında `okuma` hâlâ ZAYIF kanıttır ama
#    kapı yalnız para/veri'de SERT bloke eder — ilk turda en yüksek-zarar sınıfı hedeflenir.)
verification:
  status: <dogrulandi|dogrulanamadi|kontrol-bekliyor>
  kanit_tipi: <okuma|test|calistirma>  # NASIL doğrulandı — ŞEFFAFLIK (yukarı bak)
                                    #   risk_sinifi: para|veri + kanit_tipi: okuma + status: dogrulandi
                                    #   → kapı (kuruluysa, --strict) BLOKE EDER: salt-okuma yüksek-riskte kanıt DEĞİLDİR.
  tests: []                         # test_anchors'ın koşan hali (CI'da geçer mi)
  ci_workflow: {{CI_WORKFLOW_ADI}}  # hangi workflow denetliyor (CI yoksa SİL)
  last_verified_commit: {{SHA}}     # hangi commit'te doğrulandı (bayatlama tarihi)
  mock_guarded_count: 0             # ⭐ kaç test_anchor mock-guarded → >0 ise `dogrulandi` VERİLEMEZ
  reviewed_by: {{HAKEM_KIMLIGI}}    # [E2] `dogrulandi` durumunda ZORUNLU — hakem/insan imzası olmadan bu alan boşsa
                                    #   `dogrulandi` iddiası kapı-doğrulanabilir DEĞİLDİR (yalnız disiplin/süreçle tutar)
---

# <Başlık>

## Ne yapar — iş-dili özeti

> ⭐ Bu bölüm [L0] SON-KULLANICI dokümanının TOHUMUDUR (varsa). Üreteç bunu okuyup
> müşteri diline çevirir. Teknik jargonla yazarsan üreteç çöp üretir.
> Bir cümle: bu yetenek kullanıcıya ne kazandırır?

<İş dilinde, 2-4 cümle.>

## Akış

> Handler → servis → kural → çıktı. Hangi kural HANGİ SIRAYLA işler,
> ne zaman uyarır, ne zaman engeller. [L0]'ın (varsa) "Sistem ne yapar" bölümü buradan türer.

1. <adım — kod parçacığı değil, akış>
2. <adım>

## Public yüzey

> `repo:symbol` İŞARETÇİSİ — KOD PARÇACIĞI DEĞİL.

| Yüzey | Anchor | Not |
|---|---|---|
| <endpoint/komut> | `<repo>:<Symbol>` | <ne işe yarar> |

## Hata / durum sözlüğü

> API tüketicisinin ve son-kullanıcının gördüğü sonuçlar. Swagger/OpenAPI bunu vermez.

| Kod / durum | Ne demek | Kullanıcı ne yapmalı |
|---|---|---|
| <kod> | <anlam> | <eylem> |

## Bayrak davranış haritası

> Hangi ayar bu akışı NASIL değiştirir. Boşsa "global — bayrağa bağlı değil" yaz.

| Bayrak | Değer | Davranış |
|---|---|---|
| <flag> | true/false | <ne değişir> |

## Yaşam döngüsü (state machine) — OPSİYONEL, stateful modülde

> ⚠️ SADECE stateful akışlarda. Global tek-adımlı akışta bu bölümü SİL.
> Durum GEÇİŞLERİ — hata sözlüğündeki durum LİSTESİ değil. Kaynak: `state_transitions` frontmatter.
> [L0] (varsa) "kullanıcı bu aşamada ne yapabilir"i buradan türetir.

| Durum (from) | Tetikleyici | Sonraki (to) | Koşul (guard flag) | Anchor |
|---|---|---|---|---|
| <Draft> | <Submit> | <PendingApproval> | <flag/rol> | `<repo>:<Symbol>` |

## Kimler kullanır — yetki — OPSİYONEL, yetki-duyarlı yüzeyde

> ⚠️ SADECE rol/koşula göre değişen yüzeylerde. Global akışta SİL. Kaynak: `eligibility` frontmatter.
> [L0]'ın (varsa) `roles` applicability'sinin + API tüketicisinin "beni kim çağırabilir" sorusunun cevabı.

| Rol | Aksiyon | Gereken bayrak | Sonuç | Doğrulayan test |
|---|---|---|---|---|
| <Rol> | <aksiyon> | <bayrak> | <allow/deny> | `<test_anchor>` |

## Yan etkiler — OPSİYONEL, yan-etkili komutta

> ⚠️ Response DIŞINDA ne olur: hangi event fırlar, ne yazılır, kim bildirilir. Kaynak: `observable_effects`.
> API tüketicisi için kritik (asenkron entegrasyon/event akışı varsa). Yan-etkisiz sorguda SİL.

| Tür | Ne | Anchor |
|---|---|---|
| emit | <event> | `<repo>:<EventSymbol>` |
| write | <hangi entity> | `<repo>:<Symbol>` |
| notify | <e-posta/bildirim> | `<repo>:<Symbol>` |
