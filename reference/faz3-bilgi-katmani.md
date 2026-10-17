# FAZ 3 — Bilgi Katmanı: şablon → hedef eşlemesi ve toggle koşulları

> SKILL.md FAZ 3(un) agir detayi buraya tasindi (SKILL.md tavani ~300 satir; agir icerik
> reference/e). SKILL.md kisa isaretci ile buraya bakar.
> Her madde bir TOGGLE tasir: kapali toggle = o dosya KURULMAZ (kullanmayan odemez).
> Kardes dosya: `reference/faz2-kapi-katalogu.md` (kapilar), `reference/faz2-dokuman-katmani.md`.

## Taşma yasası — kanonik `reference/doctrine.md`

SKILL.md madde 1'in kaynağı. Rehber tavanını aşan içerik ATILMAZ, katman değiştirir (kural→rehberde
kısalt · ayrıntı→`reference/`/sözlük · ders→append-only günlük · mekanizma→kapı · format→şablon).
Tam tanım + tablo: `reference/doctrine.md` "Taşma yasası" bölümü.

## Kurulum maddeleri (3 … 3d) — sirayla uygula

3. [ORTA+] **Takip dosyaları — ÖNCE UZLAŞTIR:** mevcut karar/log/memory sistemi varsa
   (engineering-log, ADR/, memory/, NOTES) RAKİP DOSYA YARATMA — onu kanonik ilan et, şablon
   alanlarını ona uyarla. Hiçbiri yoksa `templates/trackers.template.md`'den DECISIONS.md +
   [toggle: takip.state — ADIM 0'da sorulur, varsayılan KAPALI] STATE.md kur (kapalıysa kurulmaz; saha: STATE 12 repodan yalnız 2'sinde canlı kaldı) (ilk DECISIONS girdisi = "bu sistem kuruldu, neden").
   [toggle: PM] PRODUCT_LOG.md · [daima] FRICTION_LOG.md (reference/multi-team.md formatından) ·
   [toggle: takip.yan_bug — varsayılan KAPALI, ADIM 0'da sorulur] `templates/side-bugs-log.template.md`'den `docs/SIDE-BUGS-LOG.md` (append-only; bu paketin
   kendi dogfood'u — CLAUDE.md "Yan-bug" kuralının mekanizması. Kapalıysa dosya kurulmaz; yan-bug çıkış raporunda bildirilir. `check-history --rule=append-only`'ye
   `APPEND_ONLY_EXTRA=docs/SIDE-BUGS-LOG.md` ile tanıt).
   [BÜYÜK] GARDEN_LOG.md (append-only): bahçıvan turu drift bulguları + atlanan-kontrol risk
   borcu — FRICTION_LOG'un kardeşi (o sistem-kuralını, bu kod-drift'ini izler). Gerçek dalga/
   paralellik yoksa KURMA; ORTA'da "5. dalgada aç" diye STATE'e not düş (kullanmayan ödemez).
   [toggle: iş-takip aracı (DEAK)] Fibery/Jira/Notion MCP'si ortamda BAĞLIYSA ve toggle açıksa:
   `templates/fibery-adapter.template.md`'den `docs/integrations/tracker.md` üret; açık alt-toggle'ları
   (niyet/rapor/senkron) doldur, kapalıları SİL. MCP bağlı değilse KURMA (ölü soru — kullanmayan ödemez).
   Senkron kısıtı (markdown kanonik, tek-yön): reference/external-integrations.md §2.
   [toggle: AST-indeks (DEAK)] AST-indeks aracı (codebase-memory-mcp/`cmm`) üç-kapılı envanteri YEŞİLSE
   (env `ARS_AST_ADAPTER` + `cmm` PATH'te + graf DB diskte) ve toggle açıksa: `templates/ast-index-adapter.template.md`'den
   `docs/integrations/ast-index.md` üret; symbol-ikinci-görüş bölümünü doldur, impact-adayı/index==kaynak
   TASARIM olarak işaretle. Envanter yeşil değilse KURMA (ölü soru). Kapı symbol-ikinci-görüş DALI (FAZ B kodu)
   fail-open: araç yoksa bugünkü `.includes()` davranışı. Sınır (graf kaynak değil) + K8 (git-watcher yok):
   reference/external-integrations.md §5.
3a. [ORTA+] **Context bütçesi (v0.6):** `templates/context-budget.template.md`'den
   `docs/CONTEXT_BUDGET.md` kur. Zorunlu bölümler: mod bütçeleri (hafif/normal/derin), okuma
   kara listesi, focus summary formatı, sıkıştırılamaz taahhütler, context hotspot'lar.
   [gözlem varsa] `docs/SKILL_CARDS.md` kur; gözlem yoksa STATE'e "tekrar eden iş ailesi görülünce aç"
   diye yaz. KÜÇÜK seviyede ayrı dosya kurma; CLAUDE.md okuma protokolüne kısa kural ekle.
3a2. [ORTA+] **Kod yazma disiplini:** `templates/kod-yazma-disiplini.template.md`'den
   docs/KOD-YAZMA-DISIPLINI.md kur (yol backtick'siz — hedefte üretilir, pakette yok) ve kök
   CLAUDE.md "Yerleşim kuralları"na TEK satırlık işaret ekle (yoksa dosya yetim kalır). Kapsam:
   kod yazma ANINDAKİ karar disiplini (yazmadan önce/yazarken/yazdıktan sonra + test disiplini).
   🔴 §5 "Stack kuralları" hedef reponun KENDİ konfigürasyonundan (linter/formatter/derleyici
   katılığı) ÖLÇÜLEREK doldurulur — ezberden dil kuralı yazmak yanlış-alarm üretir ve kapı
   kapatılır (`reference/pilot-dersleri.md` §3). Ölçülemiyorsa o bölüm TÜMÜYLE silinir.
   KÜÇÜK seviyede ayrı dosya kurma; CLAUDE.md süreç kurallarına 3-5 satır ek yeter.
3b. [ORTA+, FAZ 1 madde 10a UI-ağır sinyali verdiyse] **Tasarım-dili + akış sözleşmesi (v0.16):**
   ≥2 sinyal "dil MEVCUT" dediyse `templates/DESIGN.template.md`'den `DESIGN.md` üret — token'ları
   ÖLÇEREK doldur (tailwind.config/CSS custom properties/components envanterinden), hafızadan yazma.
   Sinyal yoksa kullanıcıya sor ("referans marka/stil?"); cevapsız varsayılan kurma — onaysız
   varsayılan süpervizöre çıkar (bkz. `reference/tasarim-dili-ve-akis.md`). Aynı adımda
   `templates/docs-flows.template.md` → `docs/flows.md`, sonra (akıştan türeterek)
   `templates/docs-screens.template.md` → `docs/screens.md`. UI-ağır sinyali yoksa bu maddeyi ATLA
   (kullanmayan ödemez). `DESIGN.md` kurulduysa `gates/check-self-registry.mjs --rule=design-tokens` FAZ 2 kapı
   listesine eklenir (Kademe 1, staged UI dosyası + DESIGN.md varsa çalışır, yoksa no-op).
Elle kullanılan (kurulumda otomatik kurulmaz) şablonlar: `templates/IR-manifest.template.yaml`,
`templates/eval-case.template.yaml`, `templates/site-config.template.yaml` — bunlar madde 3c'nin
ürettiği [L0]/registry katmanını TÜKETEN downstream araçlar (IR derleme, RAG eval, site config)
içindir; kurulum ajanı bunları KURMAZ, hedef repodaki ilgili ekip elle doldurur.

3c. [toggle: son-kullanıcı doküman AÇIK] **Registry + [L0] iskeleti (v0.18.3):** `coverage-gate`/
   `registry-join` kapıları (FAZ 2) `docs/registry.yaml` + `docs/user/*.md`'yi ZATEN denetliyor —
   ama üretmiyordu (denetleyeni vardı, kuranı yoktu). Bu adım onu kapatır:
   - `templates/registry.template.yaml` → `docs/registry.yaml` (registry-join'in DEFAULT aradığı
     ilk yol). BOŞ iskelet YETERLİ — `features:` altı hedef repodan ÖLÇÜLEREK dolar, tek satır bile
     uydurma. Registry-join registry yoksa no-op zaten (opt-in) — bu adım onu ölü-toggle'dan çıkarır.
   - `templates/L0-son-kullanici.template.md` → `docs/user/` dizinini AÇ (boş/`.gitkeep`).
     🔴 **İlk makale ŞİMDİ ÜRETİLMEZ** (kullanıcı kararı 2026-08-06): [L0] asenkron saatte yaşar
     (§4.1) — kurulum anında 40 makale üretmek [T] besleme-zincirini henüz doğrulanmamışken
     halüsinasyon riskidir. STATE.md'ye şu kural yazılır: "ilk [T] `verification: dogrulandi`
     olduğunda, o feature_id için registry'ye satır + ilk [L0] taslağı açılır — kod değişikliği
     olmadan [L0] üretilmez." `coverage-gate` `docs/user/*.md` boşken no-op'tur (tarama listesi boş).
   - Bu toggle KAPALIYSA (son-kullanıcı doküman yok) her iki dosya da HİÇ kurulmaz — `docs/registry.yaml`
     yoksa registry-join zaten no-op, ölü dizin AÇMA.
3d. [toggle: konfig ekseni AÇIK (v0.20)] **Kanonik sözlük:** `templates/feature-dictionary.template.md`
   → `docs/FEATURE-DICTIONARY.md`. `canonical_source` (kapıyı FİİLEN uygulayan repo) ve `features[]`
   ÖLÇÜLEREK doldurulur — enum'da olmak ≠ kapı uygulanmak, `checks: 0` meşru bir BULGUDUR, satırı silme.
   Ölçüm 6 adımdır ve şablonun içinde yaşar (grep YETMEZ: işleyicinin ÇAĞIRDIĞI SERVİSE de bak).
   Bu dosya kurulunca `check-provenance --rule=config-flags` uyanır — ölü-toggle'dan çıkar.
