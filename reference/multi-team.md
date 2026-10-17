# Çok-Ekip Katmanı (reference/multi-team.md)

> İçerik v0.5'te eklendi (PM/QA/sürtünme katmanları); §4a çok-repo eklentisi v0.20'de geldi.

Bu dosya **lazy yüklenir** (E1): yalnızca ADIM 0'da ilgili muhatap toggle'ı AÇIK ise okunur.
Toggle kapalıysa buradaki tek satır bile kurulmaz — çekirdek (SKILL.md, kök CLAUDE.md) bu
içerikle ŞİŞMEZ. Bütün bu katman "kullanmayan ödemez" yasasına tabidir.

Dört bağımsız parça: **PM/Ürün** (toggle: ürün ekibi var mı?) · **QA/Test** (toggle: kullanıcı-
görünür UI + senaryo yazan biri var mı?) · **Sürtünme** (toggle'sız — daima kurulur) · **Son-Kullanıcı
Dokümanı** (toggle: müşteriye doküman/chatbot sunan biri var mı? — §4, Faz 2 önceliği).

---

## 1. PM / Ürün katmanı  [toggle: ürün ekibi var mı?]

### 1a. PRODUCT_LOG.md (append-only, TAKİP sınıfı)
Git changelog'undan FARKLI: git "kod ne değişti"yi tutar, PRODUCT_LOG "ürün NEDEN değişti,
kim onayladı"yı tutar. Append-only (`check-history --rule=append-only` zorlar). Şablonu trackers.template.md'de.
Her girdi 3-6 satır: tarih · ne değişti (kullanıcı-görünür) · neden / hangi problem · onaylayan.
Kural: ürünü etkileyen her kullanıcı-görünür değişiklik buraya bir satır düşürür; aksi halde
"sessiz ürün kayması" olur (PM ne olduğunu git diff'ten arkeoloji yapmadan bilemez).

### 1b. pm-sorgu rolü (salt-okunur — roles.template.md'de tam metni)
PM'in koda dokunmadan ürün durumunu sorgulamasını sağlar. Edit/Write YOK; Bash sadece okuma.
Çıktısı: hangi feature hangi durumda, hangi kabul ölçütü karşılandı, son N PRODUCT_LOG girdisi.
Çıkar çatışması ilkesi: ürünü SORAN ≠ kodu YAZAN; pm-sorgu raporlar, karar vermez.

### 1c. Ürün-karar eskalasyon kademesi (E3 — insan)
Teknik-karardan AYRI bir kademe. Mekanizma: AI seçenek üretir + öneri yazar, **İNSAN karar
verir + PRODUCT_LOG'a yazar.** Tetikleyiciler (kök CLAUDE.md süpervizör matrisine eklenir):
kullanıcı-görünür davranış değişikliği · fiyat/paket etkisi · kapsam genişlemesi · persona/
hedef-kitle değişimi. Bunlar OTOMATİK ateşlenemez (yargı gerektirir) → insana çıkar.
Dürüst sınır: "stratejik mi?" gibi öznel tetiği makineye gömme; eskalasyonu insana bırak.

---

## 2. QA / Test katmanı  [toggle: kullanıcı-görünür UI + senaryo yazan biri var mı?]

### 2a. 3-eksen senaryo (en sık hata: veri-durumu körlüğü)
Hataların çoğu kod değil **veri-durumu** hatasıdır. Senaryo üç eksende düşünülür:
- **veri-durumu:** sıfır-veri (ilk kullanıcı) · tek kayıt · aşırı dolu · bozuk/eksik kayıt
- **persona:** yetkili · yetkisiz · yarı-yetkili · yeni · güç-kullanıcı
- **akış-kesintisi:** geri tuşu · çift tıklama · sayfa yenileme · yarıda bırakıp dönme · ağ kopması

Senaryo dosyası iki biçimde tutulabilir (toggle alt-seçimi):
- **Anlatı (md):** docs/scenarios/<akis>.md — qa-gezgini'nin "gezi raporu" için (assert değil, yaşa).
- **Makine (json):** docs/scenarios/<akis>.scenario.json — E2E'ye beslenir; alanlar:
  `id` · `flow` · `data_state` · `persona` · `steps[]` · `expected[]`. (Bu JSON, acceptance.json
  ile aynı felsefe: makine-okunur, ajan tahrif edemez.)

### 2b. co-update bağlantısı (KONTROL — `check-history --rule=co-update`)
UI yüzeyi değiştiğinde ilgili akış/senaryo dokümanı dokunulmadıysa kapı UYARIR. **VARLIK kapısıdır**
(doküman güncellendi mi — içeriği doğru mu DEĞİL); dürüstçe öyle etiketlenir. Davranışsal doğruluk
metinde değil E2E testinde yaşar; co-update yalnız "doküman driftini" sezer.

### 2c. qa rolü çıkış kapısına ek (roles.template.md'de)
Uygulayıcının çıkış raporuna QA toggle'ı açıkken eklenir: dokunulan akışın 3 ekseninde en az
"sıfır-veri + yetkisiz + bir akış-kesintisi" denendi mi? Denenmeyen eksen "atlanan kontrol" diye yazılır.

---

## 3. Sürtünme katmanı  [toggle YOK — daima kurulur]

Gerekçe kanonik: `reference/doctrine.md` "Sürtünme yasası". Burada yalnız KURULUM: `templates/
trackers.template.md`'den FRICTION_LOG.md (append-only) kur. Her girdi: tarih · hangi kural/kapı ·
ne engelledi/yanılttı · failure sınıfı (**sistem-kuralı** — kök CLAUDE.md çıkış raporu taksonomisine
ek) · tekrar mı (kaçıncı). Kaydı ajan değil Hakem/insan onaylar; kural ancak 3+ tekrarla değişir.

---

## 4. Son-Kullanıcı Dokümanı Katmanı  [toggle: müşteriye doküman/chatbot sunan biri var mı?]

> **Faz 2 önceliği — TASARIM.** Bu bölüm "ne kurulacağını" tarif eder (skill bir KURULUM sürecidir).
> Kapı KODU gerçek-repo pilotunda kalibre edilir; aşağıdaki §4.2-C-Katman2 / §4.4 / §4.5 KOD olarak
> bu turda kurulmaz — gerçek pilot reposunda ÖLÇÜLMEDEN değil (doctrine: önce tek pilot; A+B
> yetmezliği ölçülmeden LLM kurulmaz; kalibre olmayan kapı güveni eritir). Toggle kapalıysa tek satır kurulmaz.

### 4.1 — Kimlik sınırı + temel disiplin
Bu katman iç-ekip dokümanından (CLAUDE.md/modül dosyaları) FARKLI bir hayvandır: okuyucu kodu
bilmeyen müşteridir, hata maliyeti yüksektir (yanlış bilgi → destek bileti → güven kaybı), ve
"gerçek" yalnız kod değil — kod + ürün niyeti + firmanın aktif konfigürasyonudur.
- **Skill ne YAPAR:** repoyu kullanıcı-dokümanı + chatbot ÜRETMEYE hazırlar (kapı/anchor/üreteç/
  şablon kurar). **Ne YAPMAZ:** chatbot'u barındırmaz, RAG-index'lemez, sorguları yanıtlamaz — o,
  skill'in KURDUĞU ürünün işidir (kimlik: kurulum süreci ≠ runtime motoru).
- **Çıktı:** versiyonlanabilir markdown, hedef repoda kullanıcı-doküman dizini altında. RAG chatbot
  bu markdown'ı kaynak alır (doğrulanabilir paragraf → atıf zorunlu; "bilmiyorum" diyebilmeli).
- **Otonomi (öner+onayla):** ajan kullanıcı dokümanını DEĞİŞTİRMEZ, yalnız ÖNERİR; yayına insan
  onayı girer. Müşteri-görür içerikte doğrulanmamış değişiklik = yüksek hasar.
- **Güncelle vs iyileştir (ayrı ritim):** "güncelle" (doğru tut) her kullanıcı-görür değişiklikte
  zorunlu; "iyileştir" (daha iyi anlat) periyodik bahçıvan turu (GARDEN_LOG ruhu).

### 4.2 — Üç kapsam-ekseni (bir değişiklik dokümanı etkilediğinde sorulacak)
Hangi dokümanı / hangi segmenti / ne öncelikle güncellenir? Üç deterministik (çoğu E0) eksen:
- **(A) Global mi / flag-firma mı?** Değişen satır bir feature-gate'in İÇİNDE mi DIŞINDA mı?
  (Hedef-stack deyimiyle: bir feature-flag ya da firma-ayarı kontrolünün gövdesinde mi.) İçindeyse →
  yalnız o flag'i açık firmaların dokümanı etkilenir; dışındaysa → tüm firmalar. Kaynak: KOD (gate'in
  kendisi). E0, deterministik. (pilot deseni: her özelleştirme bir feature-kontrolünden geçer.)
- **(B) Hangi segment?** (A)'daki flag → ROL (örn. muhasebe / admin / son-kullanıcı — permission
  engine'in rol×mod×statü çözümlemesinden) + FİRMA eşlemesi. Kaynak: flag→segment üreteci (§4.4). E0.
- **(C) Son-kullanıcı AKIŞINI değiştiriyor mu?** = en değerli eksen; gürültü/sinyal filtresi. Her kod
  değişikliği dokümanı tetiklemez — yalnız akışı değiştiren. KATMANLI (dört-halka deseni):
  - **Katman 1 (E0 proxy):** değişen dosya kullanıcı-görür YÜZEY mi? (API endpoint / komut-handler /
    response sözleşmesi / kullanıcıya dönen çıktı-türü enum'u). Değilse (internal helper/refactor,
    örn. saf bir karşılaştırma yardımcısının null-check'i) → akış-riski YOK, doküman tetiklenmez. Ucuz eler.
  - **Katman 2 (E2 LLM):** Katman 1'den geçen AZ sayıda değişiklik için "bu gerçekten kullanıcı akışını
    değiştiriyor mu" yargısı. doc-guardian-Faz2'nin akış-odaklı çekirdeği. MAST: LLM yüzeysel olabilir
    → insan onayı şart, "doğrulanamadı" diyebilmeli (K7-düzeltme: test yoksa "güncel" deme).

### 4.3 — Backend / Frontend eşik ayrımı (Katman-1 proxy'sinin kalibrasyonu)
Akış-etkisi proxy'si katmana göre farklı EŞİK kullanır. **Karar: doküman BÖLÜNMEZ** — kullanıcı bir
özelliği bütün yaşar (frontend buton + backend akış tek deneyimdir); kaynak-katmanına göre bölmek
"en hızlı çürüyen doküman" üretir (ikiz/drift). Bölünen kapı EŞİĞİdir, doküman değil:
- **Frontend** (web/UI repoları): "en ufak değişiklik bile kullanıcıya iş yaptırabilir" → HASSAS eşik;
  çoğu değişiklik kullanıcı-görür kabul edilir → varsayılan: dokümanı kontrol ettir.
- **Backend** (servis/API repoları): SEÇİCİ eşik; yalnız kullanıcı-görür yüzeye (komut-handler /
  controller / response sözleşmesi / feature-enum) dokunulunca tetikle; internal değişikliği geçir.
- Katman tespiti: repo kökü manifest'i (örn. Next.js/web manifesti → frontend; backend proje
  dosyası → backend) ya da kurulum-zamanı insan işareti. (pilot repoları zaten katmana ayrık.)

### 4.4 — flag-anchor + üreteç (TASARIM; KOD pilotta)
Kullanıcı-doküman bölümü, bir flag'i makine-okunur biçimde SAHİPLENİR (anchor mekanizmasının
flag-varyantı). flag→bölüm eşlemesi **ELLE statik JSON OLAMAZ** (denormalizasyon → drift, doctrine
ret listesi); firmanın ayar/feature tanımlarından **ÜRETİLİR** + bir "index==kaynak" kapısı
"üretilen eşleme == kaynak kod" doğrular (flag tanımdan silinince eşleme bayatsa FAIL). Doctrine'in
statik-index'e izin verdiği TEK yol budur. Pilot girdisi: bir modülün flag→davranış haritası.

### 4.5 — Sürdürme zinciri (ÖLÇÜLDÜKTEN sonra kurulur)
İki halka, her ikisi de VARLIK kapısı (dokunuldu mu; içerik doğruluğu E2/insan):
- **co-update Faz-2 profili:** yüzey = modül kod dizini + flag tanımları, companion = kullanıcı-doküman.
  Skill-BAĞIMSIZ (CI'da koşar) → elle kod yazıp skill'i atlayan değişikliği de yakalar (insan-yazımı
  kod kör noktası). Varsayılan UYARI; CI'da strict. Backend/frontend eşiği §4.3'ten gelir.
- **onay-işareti:** acceptance.json deseni (approved / approved_by / reviewed_against). "Onaysız
  kullanıcı dokümanı release'e giremez" — yapısal işaret, "öner+onayla"yı kapı düzeyinde zorlar.
  Dürüst sınır: onayın VARLIĞINI zorlar, onayın doğruluğunu değil (insan/Hakem işi).

### 4.6 — Konfig ekseni: "bu özellik BU şirkette açık mı?"  [toggle: çok-kiracılı ürün]

**Sorun (pilotta ÖLÇÜLDÜ, 2026-08-11):** doküman katmanı "kullanıcı ne yapabilir" sorusunu
cevaplıyordu ama "**bu kullanıcı bunu yapabilir Mİ**" sorusunu hiç sormuyordu. Çok-kiracılı bir
üründe aynı ekran iki firmada FARKLI davranır — lisans paketi, firma ayarı, rol. Tipik belirti: makalelerin çoğu konfig alanını boş bırakır ve hiçbir makale "paketinizde olmayabilir"
uyarısı taşımaz;
doküman ile koddaki lisans koşulları birbirinden habersiz
yaşar. Kök neden **şema vardı, mekanizma yoktu** (bkz. `reference/doctrine.md` taşma/zamanlama
yasaları: kendi şema alanının kapısı AYNI commit'te doğar).

**Toggle sorusu (ADIM 0):** *"Aynı kod farklı müşterilerde farklı mı davranıyor (paket/lisans/firma
ayarı)?"* Hayırsa **tek satır kurulmaz.** Evetse üç şey kurulur:
1. `templates/feature-dictionary.template.md` → `docs/FEATURE-DICTIONARY.md` (kanonik sözlük +
   6-adımlı ölçüm reçetesi + dört sınıf tanımı — ayrıntı ORADA yaşar, burada değil).
2. `[L0]` frontmatter'ında `availability` + `requires_features` + `config_flags` blokları doldurulur.
3. `gates/check-provenance.mjs --rule=config-flags` verify/CI reçetesine girer.

**Bu katmanın TEK kuralı:** *soru CEVAPLANIR; cevap "koşul yok" OLABİLİR ama BEYAN EDİLMİŞ olmalı.*
`config_flags: {}` bırakmak "ölçtüm, kapı yok" ile "hiç bakmadım"ı aynı hâle düşürür — ölçtüysen
`paid_feature: null` yaz. **Boş bırakmak da bir cevaptır, sessiz kalmak değildir.**

⚠️ **Ölçüm tuzağı (doctrine "türetilmiş katman kanıt değildir"):** ayarı işleyicinin GÖVDESİNDE
arama — çağırdığı SERVİSTE okunuyor olabilir. Pilotta 6 handler tam olarak böyleydi ve üst katman
altısına da "okumuyor" diyordu. Ayrıca **enum'da olmak ≠ kapı uygulanmak**: bir özellik adının
tanımlı olması, kodda kontrol edildiği anlamına gelmez — say, varsayma.

**Dört sınıf cevabın TONUNU belirler** (`engel` · `kisit` · `hesap` · `gorunurluk`). En kritiği
`gorunurluk`: sessiz filtre, kullanıcı **hata görmez**, yalnız eksik veri görür — destek kaydına
"sistem bozuk" diye düşer. Bu sınıf sahada sanıldığından sık görülür.

---

## 4a. Çok-REPO sözleşme drift'i  [toggle: aynı sözleşmeyi ≥2 repo taşıyor]

§1-4 çok-**EKİP**'i kapsar; bu bölüm çok-**REPO**'yu (aynı gerçeği kaç yerde tekrar ediyoruz).
Ölçülmüş vaka: aynı özellik listesi üç repoda üç farklı değer taşıyordu, kanonik kapı türev repoda
HİÇ yoktu — paylaşılan tanım paket olarak yayınlanmıyordu (yalnız derleme-zamanı alias).

Kanonik kalıp (dört kural: kaynak = kapıyı fiilen uygulayan repo · kapı kopyalanmaz · denetlenen
doküman atfıdır kod adı değil · dürüst sınır: kapı drift'i görür, paylaşım mekanizmasını kuramaz) —
tam tanım: `templates/feature-dictionary.template.md` "Çok-repo drift'i" bölümü.

---

## 5. Çok-ekip kapıları — kanonik katalog

Bu bölümün taşıdığı kapı listesi (hangisi hangi toggle'la, hangi sınıf) `reference/faz2-kapi-katalogu.md`
ile aynı bilgiyi ikinci kez tutuyordu ve eski tekil kapı adlarıyla bayatlamıştı. Kanonik: `reference/faz2-kapi-katalogu.md`.
Varlık kapılarını "kalite garantisi" diye SATMA.

---

## 6. Claude Code hook halkası (K4 — döngü-içi 4. zorlama)

Örnek dosya: `examples/settings.json` (hedef repoda `.claude/settings.json` olur). PreToolUse
Edit/Write öncesi placeholder/secret/append-only kontrolü koşar (exit 2 → reddi Claude'a geri
besler, ajan yazarken durur); Stop oturum sonu verify koşar. Script yolları `$CLAUDE_PROJECT_DIR`
ile köke göre çözülür. Bu halka git pre-commit'ten ÖNCE, en erken+ucuz savunmadır — ama hook
yavaşsa bypass edilir, hızlı tut (smoke-testte ölç). Otorite hâlâ CI'dır; hook hijyendir.

Acceptance "done" oracle'ı için örnek: `examples/acceptance.json` (hedefte
docs/features/<ID>.acceptance.json olur). `check-provenance --rule=acceptance` bunu denetler.
