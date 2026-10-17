---
# ============================================================================
# [L0] SON-KULLANICI DOKÜMANI ŞABLONU (Katman A — genel, repo-özgü değil)
#
# ÜRETİM TALİMATI: Bu FORMAT'tır, içerik değil. [toggle: son-kullanıcı doküman] muhatap
# toggle'ı KAPALIYSA bu dosya hiç kurulmaz (bkz. SKILL.md ADIM 0 — "kullanmayan ödemez").
# Toggle açıksa her {{...}} alanı ve kapalı-küme değeri (`object_type`, `feature_exists`
# gibi) hedef reponun gerçek iş nesnelerine/rollerine göre KURULUMDA ölçülerek daralt/genişlet.
#
# Yer: KONTROL DÜZLEMİ (docs repo veya `docs/user/`) — merkezî. `docs/user/<feature-id>.md`
# Saat: ASENKRON — kod commit'ini BLOKE ETMEZ. Sinyal (PR / iş-takip aracı durum değişimi /
#       konfig değişimi) → kuyruk → üreteç önerir → İNSAN ONAYLAR → yayın → doc_version++.
# Kim yazar: üreteç [T]'nin "iş-dili özeti"nden TASLAK üretir. Ajan bu dosyayı
#       DOĞRUDAN DEĞİŞTİRMEZ, yalnız ÖNERİR — müşteri-görür içerikte doğrulanmamış
#       değişiklik yüksek hasar (yanlış iş → destek bileti → güven kaybı).
# Kim okur: bu dosya doğrudan okunmaz. Bir IR'ye (ara temsil) derlenebilir; oradan
#       yüzeyler beslenir: ekran · chatbot (RAG) · PDF · destek-intake ajanı (hangileri
#       varsa — hepsi zorunlu değil, hedef repoda ölçülerek belirlenir).
#
# ALTIN KURAL — DOSYA BÖLME: Bu dosya BİR TANEDİR. Rol başına, firma/tenant başına,
# platform başına AYRI DOSYA AÇMA. Farklılıklar `fragment` bloklarıyla TEK gövdenin
# içinde yaşar. Böldüğün an kopyalar birbirinden ayrı düşer — en hızlı çürüyen doküman
# türü budur.
# ============================================================================

id: TR-<MODUL>-<NNN>                # örn. TR-AUTH-001 — chatbot/destek atıfı (varsa) bu ID'yi kullanır
feature_id: <registry-feature-id>   # [T] ile AYNI id (registry kuruluysa oradan doğrulanır)
doc_version: "1.0"                  # İÇERİK sürümü — ürün sürümü DEĞİL
lang: {{DIL_KODU}}                  # örn. tr — çok-dilli değilse tek dil, çok-dilliyse dil başına ayrı dosya
module: {{MODUL_SLUG}}

# --- OBJECT_TYPE: iş nesnesi türü (OPSİYONEL — çok-nesneli sistemde aç) ------
# ⚠️ Bazı sistemlerde aynı aksiyon farklı iş nesnesinde farklı anlam taşır (örn. "onayla"
#    hangi nesneyi onaylıyor?). `module` bunu her zaman çözmez. Chatbot retrieval + intake
#    sınıflandırması (varsa) bunu ayırt eder. KAPALI KÜME — hedef repo nesne modeline göre
#    kurulumda ölçülerek doldurulur, uydurulmaz. Tek-nesneli sistemde bu alanı SİL.
object_type: {{IS_NESNESI_TIPI}}    # kapalı küme — kurulumda hedef repodan çıkar

# --- RETRIEVAL: chatbot'un (varsa) bu makaleyi BULMASININ hammaddesi ---------
# ⚠️ Kullanıcı sistemin terimini kullanmaz; kendi kelimeleriyle sorar. Başlık tek, soru-formu
#    çok. Bu alan olmadan RAG doğru makaleyi bulamaz → "cevap bulunamadı" patlar.
#
# 🔴 ALIAS SINIRI (bilinen risk sınıfı — bir değerlendirmede yakalandı): alias'a konu-komşu
# bir ifade eklenirse ("giriş yapamıyorum" şifre-sıfırlama makalesine eklenirse) retrieval bu
# makaleye çeker AMA makale o soruyu KAPSAMIYORSA bot ya "ayırt edemiyorum" der ya da (daha
# kötüsü) boşluğu UYDURARAK doldurmaya itilir. RAG'in klasik "yanlış chunk" hatası.
#
# ⭐ KURAL — BİR feature_id = TEK BİR CEVAP KÜMESİ:
#    İki soru FARKLI cevap gerektiriyorsa → FARKLI feature'dır.
#      "nasıl sıfırlarım"     → sifre-sifirlama
#      "neden giremiyorum"    → giris-sorunlari      ← AYRI FEATURE
#    ⚠️ `aliases` CEVAP-SINIRLI olmalı, KONU-KOMŞU değil.
#       "giriş yapamıyorum" → giris-sorunlari'nın alias'ı · sifre-sifirlama'nın DEĞİL.
#    TEST: "Bu sorgu bu makaleyle CEVAPLANIR mı?" Hayırsa alias DEĞİLDİR (negative_queries'e yaz).
#    [E2 — hakem/insan doğrular, mekanik kapı DEĞİL]: kapı `aliases` alanının DOLU olduğunu görebilir,
#    ama her alias'ın cevap-sınırı testini GERÇEKTEN geçtiğini (konu-komşu mu, cevaplanır mı) göremez —
#    bu içerik yargısı dokuman-hakem/insan denetimine kalır.
retrieval:
  intent_id: <kanonik-niyet-slug>   # örn. auth.password-reset — intent registry'den (varsa)
  aliases: []                       # ⚠️ YALNIZ bu makalenin CEVAPLADIĞI sorgular (cevap-sınırlı!)
  search_queries: []                # gerçek soru-formları: örn. ["şifremi unuttum","parolamı sıfırlama"]
  # --- NEGATİF SINIR: RAG halüsinasyonunun ana panzehiri ---
  # ⚠️ "Bu makale ŞUNU kapsamaz." Makale X'i anlatır, kullanıcı Y sorar, RAG yakın bulur,
  #    YANLIŞ cevap verebilir. negative_queries bunu keser → intake'e (varsa) "insana yükselt" der.
  negative_queries: []              # örn. ["SSO ile giriş","parolam doğru ama giremiyorum"]
  answerability: <yes|partial|no>   # bu makale niyeti tam mı karşılar
  fallback_hint: <baska-feature-id|null>  # cevap yoksa nereye yönlendir (feature_id, serbest-URL DEĞİL)

# --- 🔴 FEATURE_EXISTS: yokluk-halüsinasyonu panzehiri (bilinen risk sınıfı) --
# ⚠️ `answerability: partial` TEK BAŞINA yeterli DEĞİLDİR. Ayrım: "kısmen cevaplayabiliyorum"
#    ≠ "bu özellik VAR MI bilmiyorum". Bir değerlendirmede makale "bu özellik yoktur" dedi ama
#    bu "hiç kullanamazsın" gibi okundu; [T] bu yokluğu DOĞRULAMAMIŞTI → üreteç ÇIKARIMLA
#    doldurmuştu → YANLIŞ KESİNLİK.
#
# ⭐ SERT KURAL: [L0] asla YOKLUK İMA EDEMEZ — [T].verified_absences o yokluğu DOĞRULAMADIKÇA.
#    "X yapamazsınız" demek, "X yapabilirsiniz" demek KADAR kanıt ister.
feature_exists: <var|yok|bilinmiyor>
                                    #   var         → [T] yeteneği doğruladı
                                    #   yok         → [T].verified_absences'ta KANITLI (negatif kanıt VAR)
                                    #   bilinmiyor  → ⚠️ [T] söylemiyor → okuyan taraf (bot dahil) ASLA
                                    #                  KESİNLİK ÜRETMEZ ("bu konuda emin değilim, {{DESTEK_YONLENDIRME}}")

# --- RELATED / SEE_ALSO: ilgili yetenekler — feature_id REFERANSLI, serbest-link DEĞİL --
# ⚠️ GERİLİM: cross-link chatbot bağlamı için gerekli, ama serbest URL bayatlar (taşınır/yeniden
#    adlanır). Sentez: serbest URL değil, `feature_id` referansı → registry (varsa) canonical,
#    modül taşınsa/yeniden-adlansa bile join-key sabit → BAYATLAMAZ.
#
# 🔴 ABSTAIN'E BAĞLANDI (bilinen risk sınıfı): see_also boşsa bot doğru "bilmiyorum" der AMA
#    kullanıcıyı BOŞTA bırakabilir. Abstain = "bilmiyorum" + "AMA ŞURAYA BAK".
#    ⭐ negative_queries'teki her sorgu, MÜMKÜNSE bir related_features hedefine eşlenmeli.
related_features: []                # örn. [{id: giris-sorunlari, when: "parolam doğru ama giremiyorum"}]
                                    #   `when` = hangi (negatif) sorguda buraya yönlendir → abstain'in ÇIKIŞI

# --- 🔴 GLOBAL SÖZLÜK MAKROLARI (bilinen risk sınıfı: "destek kanalı N yerde geçiyor, adres HİÇBİR YERDE") --
# ⚠️ YANLIŞ KATMAN HATASI: destek e-postası/yardım-merkezi gibi değerler bir FEATURE'a AİT DEĞİL.
#    Feature başına yazılırsa çok-makaleli bir sistemde ÇOK KOPYA olur → drift GARANTİSİ.
# ⭐ DOĞRU YER: kontrol düzleminde GLOBAL SÖZLÜK (bkz. `templates/site-config.template.yaml`) —
#    [T].constants'ın İKİZİ (feature-scoped sabit orada, global sabit burada).
#    Gövdede makro olarak çağrılır: {{support.email}} · {{support.help_center}}
#    → render-anında (varsa IR derleyicisi) çözülür. TEK KAYNAK, SIFIR KOPYA.
# (Bu blokta alan yok — makrolar GÖVDEDE kullanılır. Burada sadece kural hatırlatması.)

# --- SUPPORT_ROUTING: intake ajanı (varsa) çözemezse nereye ------------------
# ⚠️ Destek-bileti-intake yüzeyinin kapısı (bu yüzey kuruluysa). Chatbot çözemezse bileti
#    doğru ekibe/kanala atar. self_serviceable + escalate_to hedef repo destek modeline göre kapalı küme.
support_routing:
  self_serviceable: <true|false>    # kullanıcı tek başına çözebilir mi, yoksa yükseltme mi gerekir
  escalate_to: {{ESKALASYON_HEDEFI}}  # KAPALI KÜME — hedef repo destek ekip yapısına göre kurulumda doldurulur
                                    # bu yüzey yoksa bu bloğu tümüyle SİL

# --- APPLICABILITY: "bu içerik KİME / NEREDE geçerli" ------------------------
# Rol · platform · sürüm · konfig-bayrağı · varyant → HEPSİ TEK problem sınıfı.
# Aynı resolver'ı hem ekran filtresi hem chatbot retrieval'ı okur (varsa); böylece tek
# kaynaktan iki farklı gerçek çıkmaz.
# ⚠️ Anahtarlar KAPALI KÜME — burada serbest bayrak adı uyduramazsın (lint FAIL, kuruluysa).
# ⚠️ İçerik GLOBAL ise bunu AÇIKÇA yaz (boş bırakma) — belirsizlik sessiz hata üretir.
# [E2 — hakem/insan doğrular, mekanik kapı DEĞİL]: kapı (kuruluysa) yalnız anahtarların KAPALI
# KÜME'den geldiğini denetler (sözdizimi). `roles`/`platform`/`min_version` gibi değerlerin
# GERÇEĞE UYGUN doldurulduğunu (yanlış rol/sürüm → yanlış firmaya/kullanıcıya yanlış cevap riski)
# hiçbir kapı göremez — bu içerik doğruluğu dokuman-hakem/insan denetimine kalır.
applies:
  scope: <global|conditional>       # global = her ortamda aynı. conditional = aşağıdakiler dolu.
  roles: []                         # hedef repo rol enum'undan — kurulumda ölçülerek doldurulur
                                    #   ⚠️ iş-takip aracı "doküman-kitlesi" alanıyla KARIŞTIRMA (o ayrı kavram)

  # --- 🔴 YÜZEY: panel / coverage / availability — ÜÇ AYRI EKSEN (varsa) -------
  # ⚠️ EKSEN BÖLÜNMESİ (enum genişletmesi DEĞİL): "aynı iş iki yüzeyde farklı" bir surface
  #    değeri değil, bir İLİŞKİ TİPİdir; ve "erişilebilir mi" ayrı bir sorudur. Tek `surface`
  #    alanına üç soruyu sıkıştırmak yanlış eşleşme üretir. Bu yüzden üçe ayrılır. Birden çok
  #    yüzey nesli (eski/yeni frontend, web/mobil) varsa doldur; TEK yüzeyli sistemde üçünü SİL.
  #
  #    Anahtarlar KAPALI KÜME — hedef repoya göre kurulumda ÖLÇÜLEREK doldurulur, uydurulmaz.
  #    (Domain adı kanonik DEĞİL, yalnız alias: yüzey-nesli-A ↔ app.example.io gibi — domain
  #    değişirse doküman enum'u kırılmasın.)
  panel: []                         # HANGİ YÜZEY? kapalı küme — örn. [yuzey-yeni] | [yuzey-eski] | [mobil-*]
                                    #   hedef repoda yüzey nesli ÇOKSA ölçülerek doldurulur; TEK ise bu blok SİL.
                                    #   ⚠️ RESOLVER (varsa) panel'i RUNTIME'da güvenilir kaynaktan alır (JWT/istemci-tipi,
                                    #      istemci-beyanı DEĞİL). Fragment'lar panel'e göre dallanır.
  coverage: <single|both_same|both_different>   # YÜZEYLER ARASI İLİŞKİ (bu makale açısından)
                                    #   single         → tek yüzey var/geçerli
                                    #   both_same      → iş her yüzeyde AYNI → gövde her panele döner
                                    #   both_different → ⚠️ EN TEHLİKELİ: iş yüzeyler arası FARKLI →
                                    #                    "şunu yaparsın" cümlesi panel BELİRTİLMEDEN yanlış olur;
                                    #                    kullanıcı yanlış panelin adımını okuduğunu ANLAMAZ.
                                    #                    → panel-özel adımlar fragment'a; ortak gövde both_same kalır.
                                    #   ⚠️ Bu istemci tipi / runtime paneli'den TÜRETİLEMEZ — EDİTORYAL karardır
                                    #      (runtime N panel bilir, coverage M ilişki-tipi der; kardinalite farkı).
  availability: <always|feature_gated|flag_gated>  # ERİŞİLEBİLİR Mİ?
                                    #   always        → her firma/kullanıcı erişir (koşulsuz)
                                    #   feature_gated → ücretli/opsiyonel özellik üyeliğine bağlı (requires_features dolu)
                                    #   flag_gated    → feature-flag'e bağlı (config_flags dolu)

  min_version: "{{MIN_SURUM}}"      # ÜRÜN sürümü — repo/varyant DEĞİL
  max_version: null
  variant: []                       # hedef repo varyant/motor ayrımı varsa (örn. [V1]/[V2]) — yoksa SİL
  environment: []                   # YAYIN YÜZEYİ: [] = global görünür · [staging] = QA/beta · [prod] = müşteri
                                    #   ⚠️ merge'de staging'e yayınla, müşteri-prod release-eşiğine kilitli (kuruluysa)
                                    #   Kod main'de ama deploy edilmediyse [staging] kalır → müşteri yanlış görmez.
  requires_features: []             # ⭐ availability: feature_gated'in DAYANAĞI — ücretli/opsiyonel üyelik
                                    #   ⚠️ "aktif" durumu şart. Pasifse firma/kullanıcı bu feature'a SAHİP DEĞİL.
  # ⭐ config_flags — availability: flag_gated'in DAYANAĞI (v0.20 konfig ekseni)
  #   🔴 `{}` BIRAKMA: "ölçtüm, koşul yok" ile "hiç bakmadım" ayrımı kaybolur. Ölçtüysen
  #      `paid_feature: null` yaz — BOŞ BIRAKMAK DA BİR CEVAPTIR, ama beyan edilmiş olmalı.
  #   🔴 Ölçüm reçetesi 6 adım (grep YETMEZ; işleyicinin ÇAĞIRDIĞI SERVİSE de bak):
  #      docs/FEATURE-DICTIONARY.md → "Nasıl ölçülür". Zorlayan: check-provenance --rule=config-flags
  #      (bu blok yalnız kanonik sözlük dosyası VARSA denetlenir — yoksa no-op).
  config_flags:
    paid_feature: null              # kanonik ad (SÖZLÜKTEKİ birebir yazım) · kapı yoksa `null`
    company_settings: []            # firma/kiracı ayarları. AYAR HER ZAMAN AÇIK/KAPALI DEĞİLDİR:
    #  ── (a) BOOLEAN ayar — kısayol biçim (v0.20.0'dan beri geçerli, DEĞİŞMEDİ):
    #  - field: <AyarAdi>           #   ayarın koddaki adı
    #    default: false             #   VARSAYILAN (kullanıcının fiilen yaşadığı hâl — kaynaktan oku)
    #    when_false: gorunurluk     #   ← cevabın TONU (kapalı küme aşağıda)
    #    etki: "kapalıysa ... "     #   kullanıcı dilinde SOMUT sonuç
    #  ── (b) DEĞERE bağlı ayar (sayı eşiği / seçim / metin) — v0.20.1:
    #  - field: MaxOrderAmount
    #    tip: sayi                  #   bool | sayi | secim | metin   ← ÖLÇÜLÜR (alanın gerçek tipi)
    #    default: 5000
    #    kosul: "talep tutarı bu değeri aşarsa"   # NE ZAMAN davranış değişir
    #    etki_sinifi: kisit         #   NE OLUR (aynı kapalı küme)
    #    etki: "..."
    #  🔴 `tip` bool DEĞİLKEN `when_false` YAZMA — "false" hâli yoktur, uydurma olur (kapı reddeder).
    #     Ölçüldü (2026-08-12): gerçek bir üründe ayar alanlarının yaklaşık üçte biri bool değildi.
    #
    #  KAPALI KÜME (etki_sinifi / when_false) — cevabın TONUNU bu belirler:
    #    engel       → hata/ret       "Yapamazsınız, yöneticinize başvurun"
    #    kisit       → doğrulama      "Şu alanı da doldurmalısınız"
    #    hesap       → sonuç değişir  "Şirketinizde şöyle hesaplanıyor"
    #    gorunurluk  → SESSİZ filtre  "Eksik veri görüyorsanız bu ayar kapalı olabilir"
    #    kapsam      → İŞLEM daralır  "İşlem yapıldı ama bağlı kayıtlara uygulanmadı"
    #  ⚠️ Son iki sınıf en tehlikelileri: kullanıcı HATA GÖRMEZ. `gorunurluk`ta eksik VERİ görür,
    #     `kapsam`da işlem eksik ÇALIŞIR (ölçülmüş vaka: özellik kapalıyken bağlı bölünmüş
    #     kayıtlar sessizce işleme girmiyordu). Hata fırlatanlar kendini belli eder, bunlar etmez.

# --- ANCHORS: provenance zinciri (kod → [T] → bu dosya) ---------------------
# Bu olmadan doküman "doğrulanabilir" değildir; chatbot (varsa) atıf VEREMEZ.
#
# 🔴 tech_doc ÇOĞUL (bilinen bulgu): bir [L0] görevi genelde BİRDEN ÇOK [T]'den beslenir
#    (örn. "şifremi unuttum" = ekran [T] + auth rotası [T] + e-posta servisi [T] + token [T]).
#    Tekil `tech_doc` alanı bu gerçeği taşıyamaz.
anchors:
  code: []                          # örn. [{{REPO_ADI}}:LoginCommandHandler]
  tech_docs: []                     # ⭐ ÇOĞUL — bu makaleyi besleyen TÜM [T]'ler
                                    #   KANONİK KAYNAK: registry[feature_id].tech_docs (registry kuruluysa)
                                    #   Buraya elle yazma — registry'den TÜRET (çift-yazım = drift).
  symbols: []                       # makalede ADI GEÇEN enum/alan/komut — sembol-varlık kapısı (kuruluysa) bunları sınar

# --- ⭐ COVERAGE: [L0] ÜRETİM KAPISI (bilinen bulgu) --------------------------
# 🔴 BULUNDU: registry'de "(bu rota — henüz yok)" gibi bir not, makaleyi besleyecek [T]'nin
#    EKSİK olduğunun SİNYALİYDİ. Makale yine de yazılırsa HALÜSİNASYON olur.
#
# KURAL (deterministik, kapı kuruluysa E0):
#   [L0] ancak registry[feature_id].tech_docs'un TAMAMI
#     (a) MEVCUT ve (b) verification: dogrulandi  ise ÜRETİLEBİLİR.
#   Eksik varsa → ÜRETME → coverage_gap doldur → kuyruğa yaz → önce eksik [T] üretilir.
coverage:
  status: <tam|eksik>               # eksik → bu makale ÜRETİLMEZ/YAYINLANMAZ
  missing: []                       # örn. ["bir rotanın [T]'si yok"]
                                    #   ⚠️ BOŞ DEĞİLSE: makale üretmek YANLIŞ BİLGİ üretmektir.

# --- 🔴 VERIFICATION: İKİ AYRI EKSEN (P6 — kanonik, tek satıra sıkıştırma) ----
# ⚠️ KÖK HATA: yayın durumu ("bu makale yayında mı") ile doğrulama durumu ("içeriği koda karşı
#    doğrulandı mı") FARKLI eksenlerdir. Tek `verification` satırında slash'le birleştirmek
#    (`yayinlandi / dogrulandi`) ikisini karıştırır — bir makale YAYINDA ama doğrulanmamış, ya da
#    doğrulanmış ama henüz taslak olabilir. İki eksen ayrı alan olur ([T] `verification` bloğuyla
#    AYNI şema: `status` = doğrulama ekseni). Chatbot abstain kararı `status`'a bağlı, yayın'a değil.
yayin_durumu: <taslak|inceleme|yayinlandi>   # YAYIN ekseni — makale müşteriye görünür mü
verification:
  status: <dogrulandi|dogrulanamadi|kontrol-bekliyor>   # DOĞRULAMA ekseni — [T] ile AYNI değer kümesi
  # ⚠️ İKİ YÜZEY, İKİ DAVRANIŞ (chatbot/destek yüzeyi varsa) — `status`'a bakar, `yayin_durumu`'na değil:
  #    Chatbot: `status: dogrulandi` değilse ATIF VERMEZ → "emin değilim, güncel makale: [link]".
  #    Ekran:   ham "dogrulanamadi" etiketi MÜŞTERİYE GÖSTERİLMEZ (güven kaybı) →
  #             sessizce "güncelleniyor". Dürüstlük İÇERİDE zorunlu, DIŞARIDA yumuşatılır.
last_reviewed: {{TARIH}}            # içerik-tazelik: en son ne zaman İNSAN gözden geçirdi.
                                    #   `verification` "doğru mu"yu, bu "bayat mı"yı der. Kod güncelken
                                    #   bile içerik eskiyebilir; tazelik-eşiği aşılınca kuyruğa düşer.

# --- CLAIM_PROVENANCE: cümle-düzeyi doğrulama (OPSİYONEL) --------------------
# ⚠️ `verification` tek-blok fazla kaba olabilir: aynı makalede bir cümle doğrulanmış, diğeri
#    sürüm-dışı olabilir. Chatbot (varsa) YALNIZ doğrulanmış cümleyi cite etmeli. Karışık-güven
#    makalelerde aç. OPSİYONEL — makale tümü tek anchor'a bağlıysa gerek yok (`verification` yeter).
claim_provenance: []                # örn. [{claim_id: c1, anchors: [{{REPO_ADI}}:X], verified: true}]

changelog:
  - {v: "1.0", not: "ilk yayın", at: {{TARIH}}}
---

# <Başlık — kullanıcının ARADIĞI kelimelerle, bizim jargonumuzla değil>

> **ZORUNLU 5 BÖLÜM.** Kapı (kuruluysa) denetler; eksikse yayın FAIL.
> Bu bir VARLIK kapısıdır — kalite kapısı değil. Kaliteyi (açıklayıcı mı,
> eksiksiz mi) Hakem + insan denetler; makineye bağlanamaz.

## Ne işe yarar {#ne-ise-yarar}

<Kullanıcı bunu neden umursasın? İş sonucu. Teknik değil.>

## Nasıl kullanılır {#nasil-kullanilir}

<Kullanıcının GÖRDÜĞÜ ve TIKLADIĞI şeyler. Adım adım.>

1. <adım>
2. <adım>

<!-- fragment applies: roles=[<rol>] -->
### <Sadece bu role görünen adım> {#nasil-kullanilir-<rol>}
<Fragment = atomik koşullu blok; resolver (varsa) çözer.
 Ortak çoğunluk tek gövdede — role/koşula özel azınlık fragment'ta.
 Ne "her cümle tüm rollere birden hitap etsin" (kirlilik), ne "segment başına ayrı dosya" (drift).>
<!-- /fragment -->

## Sistem ne yapar {#sistem-ne-yapar}

> ⭐ **BU BÖLÜM ATLANMAZ.** Yüzey-only doküman "ne"yi söyler ama kullanıcının
> "benim işlemim NEDEN reddedildi" sorusunu cevaplayamaz → destek bileti riski.
> Arka planda hangi kural hangi sırayla işler; ne zaman uyarır, ne zaman engeller.
> Kaynak: [T]'nin "Akış" bölümü.

<Anlatı — hâlâ iş dilinde, kod değil.>

## Kimler için {#kimler-icin}

<Hangi roller kullanır; hangi yetki gerekir.>

## Koşullar {#kosullar}

<Hangi ayar açık olmalı. Kullanıcı/firma bu özelliğe SAHİP DEĞİLSE ne olur — açıkça yaz.
 Bilmiyorsan UYDURMA: chatbot (varsa) burayı okuyup cevap üretecek.>

## Sık karşılaşılan sorunlar {#sorunlar}

> ⭐ OPSİYONEL ama YÜKSEK DEĞER. "Sistem ne yapar" arka-plan kuralı anlatır; BU bölüm
> kullanıcı HATA aldığında ne yapacağını verir. Destek biletlerinin çoğu genelde buradan
> önlenir. Her satır intake ajanına (varsa) "kullanıcı X diyorsa → Y kök-neden → Z eylem /
> şu ekibe yükselt" der. Kaynak: [T]'nin "Hata / durum sözlüğü". Bu bölüm YOKSA intake
> ajanı boş bilet açabilir.
> ⚠️ UYDURMA: kod-doğrulanmamış hata mesajı yazma — chatbot bunu müşteriye söyler.

| Kullanıcının gördüğü | Neden olur | Ne yapmalı | Çözemezse |
|---|---|---|---|
| <hata/durum metni> | <kök neden> | <net eylem> | <yükseltme hedefi> |

<!-- fragment applies: panel=[{{ESKI_YUZEY}}] -->
### <Sadece eski yüzeyde görülen adım/sorun>
<🔴 coverage: both_different olan içerik BURADA dallanır — panel applicability ile. Ortak gövde
 (both_same) yukarıda tek sefer yazılır; panele-özel azınlık bu fragment'ta. Yüzey ayrımı yoksa SİL.
 ⚠️ both_different'i gövdeye yazarsan kullanıcı yanlış panelin adımını okur ve fark etmez.>
<!-- /fragment -->
