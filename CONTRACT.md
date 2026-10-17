# Kapı Sözleşmesi (gates_contract_version: 2)

> Bu dosya, paketteki kapı script'lerinin **kararlı arayüzünü** (CLI sözleşmesi) sabitler.
> Amaç CodexQB'den ödünç: bir hedef repo bu kapıları `scripts/` altına kopyaladığında
> argüman/çıkış-kodu/etiket davranışının sürümler arası tahmin edilebilir kalması.
> Sözleşmeyi **çalıştırılabilir kanıt** koruyor: her kapının `tests/` altında birim testi var
> (`node --test`), ve `verify.mjs` paketin kendi kapılarından geçtiğini doğrular.
>
> **Sürümleme kuralı:** geriye-uyumsuz bir değişiklik (argüman adı, çıkış-kodu anlamı, JSON
> şeması) `gates_contract_version`'ı artırır ve karar defterine gerekçe yazılır.

## Ortak sözleşme

- **Çıkış kodu:** `0` = temiz/geçti, `1` = ihlal (commit/CI bloke). İstisnalar aşağıda işaretli.
- **Argüman yokken:** çoğu kapı `git ls-files` ya da `git diff --cached` ile hedef seti kendi bulur.
- **Argümanla:** verilen dosya yolları doğrudan denetlenir (test ve nokta-atışı kullanım için).
- **Secret kapısı eşleşmenin tamamını ASLA yazdırmaz** (maskeli rapor).
- **Env genişletmeleri geriye-uyumludur** (sürüm ARTIRMAZ): `APPEND_ONLY_EXTRA=yol1,yol2` sabit
  listeye ek append-only dosya tanımlar; env yokken davranış birebir aynıdır. Paketin kendi karar
  defterlerini dogfood'lamak için kullanılır (`scripts/self-pre-commit.mjs`).
- **`--allow-empty` geriye-uyumludur** (sürüm ARTIRMAZ, MADDE 15): şüpheli-sınıf alt-kurallarda
  (`utf8`, `secrets --all`, `placeholders`, `doc-truth`) GERÇEKTEN işlenen dosya sayısı (`scanned`)
  0 ise varsayılan artık FAIL'dir ("temiz" ile "hiç bakmadım" ayrımı — pilot bulgusu A). Bayrak
  VARKEN bilinçli boş küme kabul edilir, exit 0. Çıktı ayrıca `[taranan=N]` etiketi taşır; argümanla
  verilip diskte OLMAYAN dosya (missing) ayrıca FAIL'dir — sessizce yutulmaz (bu, muaf alt-kurallarda
  da geçerlidir).
  🔴 **MUAF sınıf — "0 dosya DOĞALDIR" olan iki desen** (buraya FAIL koymak yanlış-alarm üretir,
  kapıyı öldürür): ① **staged-diff** tabanlılar (`append-only`, `co-update`, `secrets` varsayılan
  modu, `file-size`) — commit dışında staged dosya olmaması doğaldır. ② **opt-in artefakt**
  tabanlılar (`acceptance`, `brief-provenance`) — tetikleyici dosya (`*.acceptance.json`,
  `docs/test-briefs/`) iş yapıldıkça DOĞAR; henüz yazmamış repo "kullanmayan repo"dur ve madde
  1-13 sözleşmesi gereği yeni FAIL GÖRMEZ. ②'yi hakem turu ölçtü (2026-08-06): ana ajanın ilk
  kapsam kararı `acceptance`'ı yanlışlıkla şüpheli-sınıfa koymuştu, kurulumun ilk günü CI kırmızıya
  düşüyordu → çürütüldü ve kapsam dışına alındı.
Aşağıdaki maddeler append-only bir gerekçe-günlüğüdür: her satır KALIR, gövde artık kısa tutulur —
**ne eklendi/değişti · sınıf · varsayılan davranış · sözleşme etkisi · gerekçe atfı**. Uzun
anekdot/ölçüm tarihçesi karar defterlerinde yaşar (K-no ile atıf edilir, kökteki en güncel karar
defterinde ya da `archive/` altında); tekrar YAZILMAZ. Dürüst sınırlar tekilleştirildi: **"Bilinen sınırlar"** bölümü kanonik kaynaktır —
madde gövdesi oraya atıf verir, sınırı ikinci kez anlatmaz. Ortak desen (v0.8.1–v0.13, MADDE 1-13):
**yeni opt-in kapı/dal/bayrak eklemek sürüm ARTIRMAZ** çünkü mevcut kapıların CLI arayüzü
(argüman/çıkış-kodu/JSON şeması) değişmez. Tam tarihçe: `git log -p -- CONTRACT.md`
(v0.16.0-öncesi hâl) + ilgili karar defteri (kökteki en güncel karar defteri ya da `archive/`).

1. `docs/GARDEN_LOG.md` append-only listesine eklendi (v0.8.1). Sınıf: değişmedi. FAIL koşulu etkilenmedi.
2. Secret/komut desen genişletmesi (v0.8.2): Stripe/.NET/Azure/MongoDB + dotnet/flutter/terraform
   sözlükleri. Sınıf: KALİTE. `VALUE_PH` placeholder filtresi FP'yi eler; `sk_test_` bilinçle YAKALANIR.
3. `check-doc-recency.mjs` eklendi (v0.8.4). Sınıf: OPT-IN/VARLIK-tripwire.
4. `check-placeholders` ikinci desen (v0.11): doldurulmamış `model:`/`effort:` satırları da yakalanır.
   Sınıf: KALİTE.
5. `check-brief-provenance.mjs` eklendi (v0.11) — [T]→test-case köprüsü provenance. Sınıf: OPT-IN/VARLIK.
6. Ölü-anchor denetimi doc-truth'a eklendi (v0.8.5): `<!-- doc-anchor: yol -->` de taranır.
7. `verify.mjs --install-exam` eklendi (v0.10, K3): kurulum-sonrası etki sınavı (`scripts/install-exam.mjs`,
   CLI sözleşmesi kapsamı dışı).
8. `verify.mjs --doctor` eklendi (v0.14, K23): kurulum makbuzu mutabakatı (`--seal`).
9. `verify.mjs --upgrade` eklendi (v0.15, K24): dry-run varsayılan yükseltme/onarım aracı;
   `gates_contract_version` uyuşmazlığında BLOKE olur, kaçış yok.
9b. `verify.mjs --sure` eklendi (v0.21, K50): adım-başına süre kırılımı. GÖZLEM-ONLY — kapı DEĞİL,
   çıkış kodunu etkilemez, dosyaya yazmaz. `gates_contract_version` ARTMAZ (opt-in gözlem).
10. DEAK dış-entegrasyon şablonları (v0.9) — kodlu kapı yok, `reference/external-integrations.md` §4.
11. AST-indeks adaptörü (v0.10) — opt-in fail-open dal, `reference/external-integrations.md` §5.
12. 6 Katman-A kapısı sözleşmeye kaydedildi (v0.11, kayıt drift'i kapatıldı). Sınıf: OPT-IN/VARLIK
    ya da KALİTE (integrity, mode-escalation).
13. İki öz-bakım kapısı eklendi (v0.13): `check-rule-contracts` + `check-orphan-gates`. Sınıf: VARLIK, OPT-IN.
14. **MADDE 14 — kapı BİRLEŞTİRME/YENİDEN-ADLANDIRMA** (v0.16, K27): 20 eski `gates/check-*.mjs`
    dosyası silinip 6 kategoriye birleşti. `gates_contract_version` **1 → 2 ARTAR** — bu ilk
    KALDIRMA/YENİDEN-ADLANDIRMADIR (madde 1-13 yalnız EKLEME idi). Eski adla çağıran script/CI/hook
    `Cannot find module` ile kırılır — geriye-uyumsuzluğun TANIMI budur. Gerekçe: 6 dış-model
    konsensüsü "aşırı parçalanmış" dedi (v0.16 karar defteri K27 — geliştirme reposunda). Migrasyon: `npm run
    upgrade` sürüm uyuşmazlığında BLOKE olur; yeni çağrı `node gates/check-<kategori>.mjs
    --rule=<eski-kapı-adı> [eski-bayraklar]`.
15. **MADDE 15 — `--allow-empty` bayrağı + orphan-gates 4. kontrol** (v0.18.2, K-pilot A+B).
    Sınıf: EKLEME (madde 1-13 deseni), `gates_contract_version` ARTMAZ. (A) Şüpheli-sınıf
    alt-kurallarda (`utf8`, `secrets --all`, `placeholders`, `doc-truth`) gerçekten işlenen dosya
    sayısı (`scanned`) 0 ise varsayılan FAIL + `[taranan=N]` etiketi; `--allow-empty` bilinçli boş
    küme için kaçış yolu. Argümanla verilip diskte olmayan dosya da FAIL'dir (sessizce yutulmaz).
    (B) `orphan-gates` alt-kuralı: test dosyasının VARLIĞI yetmez, İÇİNDE negatif-deney (exit≠0
    bekleyen assertion) olması da aranır. Sınırlar: "Bilinen sınırlar" §check-self-registry
    orphan-gates negatif-deney kontrolü. Muaf sınıflar (staged-diff/opt-in-artefakt) Ortak
    sözleşme'nin 🔴 bloğunda tanımlıdır; `acceptance` bu turda opt-in-artefakt'a düzeltildi (aday
    listesi: Alt-kural sınıf beyanı tablosu).
16. **MADDE 16 — orphan-gates 5. kontrol: alt-kural SINIF BEYANI zorunlu** (v0.18.2, K-pilot,
    `docs/FRICTION_LOG.md` 2026-08-06). Sınıf: EKLEME, `gates_contract_version` ARTMAZ. Aşağıdaki
    **Alt-kural sınıf beyanı** tablosu her `kategori:alt-kural` çiftinin sınıfını
    (`staged-diff`/`opt-in-artefakt`/`auto-discovery`) beyan eder — TEK KAYNAK burasıdır.
    `check-self-registry --rule=orphan-gates` bu tabloda karşılığı var mı diye sorar.
    Geriye-uyumluluk: beyanı olmayan alt-kural `--strict` dışında yalnız UYARI verir. Sınır:
    "Bilinen sınırlar" §check-self-registry orphan-gates alt-kural sınıf beyanı kontrolü.
17. **MADDE 17 — `doc-recency` `--cascade` opt-in bayrağı: iki kademeli tazelik zinciri
    kod→[T]→[L0]** (v0.18.3, kullanıcı kararı 2026-08-06 + hakem düzeltmesi B1).
    `gates_contract_version` ARTMAZ; bu madde bir **geriye-uyumsuz-iddia düzeltmesi**dir — kademe
    1/2 ilk taslakta bayraksız çalışıyordu ve MADDE 15'in `acceptance` yanlış-sınıflama hatasını
    tekrarlıyordu, düzeltme kademe 1/2'yi `--cascade`'e bağladı (bayraksız çağrı v0.18.2 ile
    birebir aynı kalır). Bu paketin kendi `verify.mjs` çağrısı `--cascade`'i açık tutar (dogfood).
    KADEME 1 (kod→[T]): `anchors[].repo` yol-tabanlı çözülür, `symbol` yalnız rapor metninde
    görünür (doğrulaması `integrity`'nin işi). KADEME 2 ([T]→[L0]): `anchors.tech_docs[]` dosya
    yolu tabanlı karşılaştırılır. Eski HTML `<!-- doc-anchor -->` (kademe 0) BİREBİR korunur,
    bayraksız da çalışır. Aynı dalgada `check-hygiene --rule=placeholders` deseni `docs/user`
    dizinini de kapsayacak genişledi. "Sınıflanamadı" NOT'u (hakem turu B2): `classifyDoc()`
    dört-alan katılığı bir typo'da dokümanı sessizce sınıfsız bırakmasın diye eklendi, `--cascade`'den
    BAĞIMSIZ her zaman çalışır. Sınıf: opt-in-artefakt, VARSAYILAN UYARI + `--strict` FAIL. Sınırlar:
    "Bilinen sınırlar" §doc-recency KADEME 1/2 (üç madde: içerik-doğruluğu, granülarite, `--cascade`
    no-op).
18. **MADDE 18 — `doc-truth`'a `node <yol>` komut denetimi** (v0.18.4, dogfood bulgusu SB-17).
    Sınıf: EKLEME, `gates_contract_version` ARTMAZ. `doc-truth` npm/pnpm/yarn/bun/dotnet/flutter/
    terraform komut ailelerini tanıyordu ama `node <yol>` biçimini hiç tanımıyordu — bir rol dosyası
    üç ay var-olmayan kapı adını çıkış kapısı diye yazdı, yakalanmadı. Çözüm: çok-segment yol
    (`node gates/check-hygiene.mjs`) ve uzantılı tek-segment script (`node verify.mjs` gibi,
    js/mjs/cjs/ts uzantısı zorunlu) tanınır; mevcut placeholder/`--ignore=` filtresi burada da
    uygulanır. Sınır: "Bilinen sınırlar" §doc-truth `node <yol>` denetimi.
19. **MADDE 19 — `check-hygiene`'e `report-schema` + `message-clarity`** (v0.18.6, panel kararı).
    Sınıf: EKLEME, `gates_contract_version` ARTMAZ. İki katman: **YAPISAL ihlal → BLOKE**, **ÜSLUP
    ihlali → UYARI**. `report-schema` (exit 1 her modda): `OLGU`+`KANIT_REFERANSI` şemasını beyan
    eden bir `.md` içinde `ÖNERİ`/`TAVSİYE`/`KARAR`/`SONRAKİ ADIM`/`NE YAPILMALI` başlığı olamaz;
    `.template.md` muaf. `message-clarity` (varsayılan exit 0 + bulgu, `--strict` exit 1):
    `gates/`+`scripts/*.mjs` kullanıcıya-yazan `console.error`/`console.warn` satırlarında eylem
    oku (`→`) yoksa ya da çıplak `[kebab-case]` kod-adı geçiyorsa bulgu üretir; `JSON.stringify`/
    `JSON_OUT` satırları muaf. `message-clarity` `verify.mjs` `steps[]`e BAĞLANMADI (varsayılan-uyarı
    kural release'i bloke etmemeli) — CONTRACT satırı + test + `RULES[]` kaydı ORPHAN üçlüsünü
    karşılar, "(hedef repo)" muafiyeti gerekmez. Sınır: bu ikisi üslup KALİTESİNİ yargılayamaz,
    yalnız yapısal/mekanik ihlali görür (`reference/anlatim-disiplini.md` + hakem işi).

20. **MADDE 20 — konfig ekseni: `check-provenance`'a `config-flags`** (v0.20, pilot geri bildirimi
    §5.1). Sınıf: EKLEME, `gates_contract_version` ARTMAZ. Kök neden: `[L0]` şablonunun
    `config_flags: {}` alanı şema olarak vardı, kapısı yoktu (sahada %82 boş, %66 kontrolsüz kalmıştı
    — `reference/doctrine.md` "zaman ekseni"). Tetikleyici = kanonik sözlük dosyası
    (`docs/FEATURE-DICTIONARY.md`, `--dictionary=` override); dosya yoksa alt-kural tümüyle NO-OP.
    Sınıf: opt-in-artefakt, VARSAYILAN UYARI + `--strict` FAIL. Ne zorlar: `availability` beyanı ·
    beyan↔dayanak tutarlılığı · `config_flags: {}` yasağı (`declared`/`answered`/`gated` üç durumu,
    `paid_feature: null` MEŞRU) · `company_settings[]` dört zorunlu alan · `when_false` kapalı
    kümesi · kanonik sözlükte ad drift'i (case-insensitive normalize KASITLI yapılmaz) · sözlüğün
    kendi biçimi. Sınır: kapı ÖLÇÜMÜN DOĞRULUĞUNU göremez, yalnız "soru CEVAPLANDI mı" der;
    `checks:`/`enforced_in` alanları denetlenmez.

21. **MADDE 21 — sürtünme triyajı: `check-history`'ye `friction-repeat`** (v0.20, pilot geri
    bildirimi §5.5). Sınıf: EKLEME, `gates_contract_version` ARTMAZ. Kök neden: "3+ tekrar → kural
    değişir" kuralı `reference/multi-team.md` §3a'da yazılıydı, hiçbir kapı saymıyordu. Sınıf:
    staged-diff, VARSAYILAN UYARI + `--strict` FAIL. İki kontrol: ① yakalama — staged'de EKLENEN
    tablo satırı `Mekanizma-adayı:` taşıyor mu (yalnız yeni satır) · ② NOT — tekrar sayacı ≥3 olan
    AÇIK girdiler listelenir, bu blok **`--strict`te DAHİ FAIL VERMEZ** (karar borcu, ihlal değil).
    Koşucu bağı `scripts/self-pre-commit.mjs`, bilinçle `--strict`SİZ. Sınır: kapı etiketin
    VARLIĞINI görür, önerinin ANLAMLI olduğunu değil. Argüman modunda (dosya verilerek) tüm tablo
    taranır, hook yolunda kullanılmaz.

22. **MADDE 22 — `config-flags` boolean varsayımından çıkış + `[T]` çapraz kontrolü** (v0.20.1).
    Sınıf: EKLEME, `gates_contract_version` ARTMAZ (CLI arayüzü aynı). Kök neden: MADDE 20'nin
    `default`+`when_false` şeması alanın boolean olduğunu varsayıyordu; sahada ölçülen alanların
    ~üçte biri boolean değildi (enum/sayı/metin), `when_false` o alanlarda anlamsızdı ve kapı yine
    onaylıyordu. Değişiklik EKLEME'dir, yeniden adlandırma değil (sahada `when_false` dolu dosyalar
    vardı, rename migrasyon borcu yaratırdı): opsiyonel `tip: bool|sayi|secim|metin` (yazılmazsa
    bool varsayılır, v0.20.0 biçimi birebir çalışır) · bool-olmayanlarda `kosul`+`etki_sinifi`
    zorunlu, `when_false` yasak · beşinci sınıf `kapsam` (erken çıkış ama bağlı kayıtlara
    uygulanmıyor) · `[T].flags` yapısal hâle geldi · [L0]↔[T] çelişki kontrolü (`flags: []`
    diyen [T] besliyorken [L0] gerçek koşul beyan ederse FAIL). İki aday sınıf (`giris-yok`, `akis`)
    kanıtsız/ölçülmemiş olduğu için reddedildi. Sınır: kapı `kosul`/`etki` metninin doğruluğunu
    göremez, yalnız biçimsel varlık ve kapalı-küme uyumunu; iki taraf da dolu ama içerik olarak
    çelişiyorsa göremez.

## Alt-kural sınıf beyanı (v0.18.2, MADDE 16 — TEK KAYNAK)

> Üç sınıf: **staged-diff** (`git diff --cached` tabanlı, 0 dosya DOĞAL — commit dışında staged
> yok) · **opt-in-artefakt** (tetikleyici dosya iş yapıldıkça DOĞAR, 0 dosya DOĞAL — henüz
> kullanmayan repo "kullanmayan repo"dur) · **auto-discovery** (`git ls-files`/açık dosya listesi,
> 0 dosya ŞÜPHELİ — boş-küme körlüğü riski, MADDE 15'in `--allow-empty` FAIL'i buraya uygulanır).

| `kategori:alt-kural` | Sınıf |
|---|---|
| `check-hygiene:utf8` | auto-discovery |
| `check-hygiene:secrets` | staged-diff |
| `check-hygiene:placeholders` | auto-discovery |
| `check-hygiene:file-size` | staged-diff |
| `check-hygiene:report-schema` | auto-discovery |
| `check-hygiene:message-clarity` | auto-discovery |
| `check-hygiene:surface-residue` | auto-discovery |
| `check-doc-integrity:doc-truth` | auto-discovery |
| `check-doc-integrity:doc-recency` | opt-in-artefakt |
| `check-doc-integrity:integrity` | opt-in-artefakt |
| `check-doc-integrity:facts-drift` | opt-in-artefakt |
| `check-provenance:acceptance` | opt-in-artefakt |
| `check-provenance:brief-provenance` | opt-in-artefakt |
| `check-provenance:coverage-gate` | opt-in-artefakt |
| `check-provenance:registry-join` | opt-in-artefakt |
| `check-provenance:config-flags` | opt-in-artefakt |
| `check-provenance:integration-cards` | opt-in-artefakt |
| `check-process-discipline:hakem-verdict` | opt-in-artefakt |
| `check-process-discipline:plan-exists` | opt-in-artefakt |
| `check-process-discipline:mode-escalation` | staged-diff |
| `check-process-discipline:spec-receipt` | staged-diff |
| `check-process-discipline:delege-kotasi` | opt-in-artefakt |
| `check-process-discipline:dosya-sahipligi` | opt-in-artefakt |
| `check-history:append-only` | staged-diff |
| `check-history:co-update` | staged-diff |
| `check-history:stale-constants` | staged-diff |
| `check-history:friction-repeat` | staged-diff |
| `check-self-registry:rule-contracts` | auto-discovery |
| `check-self-registry:orphan-gates` | auto-discovery |
| `check-self-registry:design-tokens` | staged-diff |
| `check-self-registry:install-version` | opt-in-artefakt |

## Kapı kayıt tablosu (v0.16 — 20→6 kategori script'i konsolidasyonu)

Her kategori script'i argümansız TÜM alt-kuralları koşturur; `--rule=<ad>` ile tek alt-kural
seçilir (eski kapının kendi bayrakları `--rule=` sonrasına aynen eklenir — geriye-uyumlu argüman
seti, yalnız ÇAĞRI ŞEKLİ değişti). `gates/lib/*.mjs` paylaşılan yardımcı modüldür, KAPI DEĞİLDİR —
ikinci bir kapı dizini sayılmaz (CLAUDE.md "Yerleşim kuralları" netleştirmesi).

**Halkalar:** ① Claude Code PreToolUse (`.claude/settings.json`, döngü-içi, exit 2 → Edit reddedilir)
② git pre-commit (`.git/hooks/pre-commit` → `scripts/self-pre-commit.mjs`) ③ CI
(`.github/workflows/verify.yml`) ④ Hakem (LLM, salt-okur). Otorite CI'dır; hook hijyendir.
**"(hedef repo)" ne demek:** o alt-kural bu pakette ÜRETİLİR ve birim testi vardır, ama koşacağı
yer kurulum yaptığı HEDEF repodur (burada tetikleyecek [T]/registry/verdict artefaktı yok → no-op).

| Kategori script'i | Sınıf | Alt-kurallar (`--rule=`) | Halka | Argümansız hedef | FAIL koşulu / savaştığı entropi | Bayraklar |
|---|---|---|---|---|---|---|
| `gates/check-hygiene.mjs` | KALİTE (report-schema=YAPISAL/bloke, message-clarity=ÜSLUP/uyarı-varsayılan) | utf8 · secrets · placeholders · file-size · report-schema · message-clarity · surface-residue | ①(-) ② ③ | tüm tracked/staged metin dosyaları | geçersiz UTF-8 · BOM (v0.30: .NET ailesi — .cs/.csproj/.sln/.props/.targets/.vb/.fs/.fsproj/.vbproj/.resx — MUAF) · sızmış anahtar/şifre (maskeli; v0.8.2 Stripe/.NET/Azure/MongoDB; v0.30: parola alanının TİP bildirimi (string/boolean vb.) ya da küçültülmüş boolean değeri sır SAYILMAZ) · doldurulmamış `{{...}}`/`model:`/`effort:` alanı · dosya >1000(kod)/300(rehber)/1200(append-only DEFTER, v0.30 — uyarı 400) satır · keşif raporu şemasına (OLGU/KANIT_REFERANSI) karar/öneri başlığı sızması (v0.18.6, bloke) · uyarı/hata mesajında eylem oku yok / çıplak kod-adı (v0.18.6, varsayılan uyarı) · **kalıcı belgede süreç artığı** (v0.23.0: üstü-çizili madde, geçmiş hatayı itiraf eden cümle, "düzeltme" başlığı, güncelleme-tarih damgası — imzalar kapı kodunda — 158 vakadan kalibre; tarihsel-kayıt/arşiv ve "yol haritası/sürüm notu" bölümleri MUAF) | `--rule=`, `--all`, `--include-tests`, `--strict` (yalnız message-clarity), `--allow-empty` |
| `gates/check-doc-integrity.mjs` | KALİTE | doc-truth · doc-recency · integrity · facts-drift | ③ | tracked rehber/.md + staged [T]/[L0]/registry | ölü yol/komut referansı (npm/pnpm/yarn/bun/make/just/dotnet/flutter/terraform/`node <yol>` v0.18.4) · anchor'lı kod değişti, doküman dokunulmadı (v0.18.3: İKİ KADEME — kod→[T] sembol-çözümlü, [T]→[L0] yol-tabanlı, HTML `doc-anchor` BİREBİR korunur) · "tamamlandı" iddiası ↔ stub/çakışma/yetim ayrışması (4 sınıf, E0); v0.11+: sahte anchor'da opsiyonel AST ikinci-görüş (DEAK §5.1, verdict DEĞİŞMEZ) · **işaretli hücredeki ÖLÇÜM iddiası ≠ facts.json ölçümü** (v0.26: `<!--fact:KEY-->DEĞER<!--/fact-->`; mesaj DELTA "iddia 547 · ölçüm 550 (Δ+3)" — yaş DEĞİL; `facts.json` yoksa ya da işaret yoksa NO-OP; unknown fact sapma SAYILMAZ, ayrı NOT bloğunda görünür) | `--rule=`, `--strict`, `--ignore=`, `--registry=`, `--facts=` |
| `gates/check-provenance.mjs` | VARLIK | acceptance · brief-provenance · coverage-gate · registry-join · config-flags · integration-cards | ③ / (hedef repo) | tracked `*.acceptance.json` + opt-in [L0]/test-brief/registry/sözlük | "tamamlandı" denen işin kriteri boş/kanıtsız · test-brief kaynağı/anchor'ı boş · [L0] besleme zinciri eksik/doğrulanmamış · [T]↔registry join kopukluğu · [L0] erişim beyanı ↔ dayanak tutarsızlığı + `config_flags: {}` cevapsızlığı + kanonik sözlük ad drift'i (v0.20, MADDE 20 — sözlük yoksa no-op) · manifestteki dış servis SDK'sının entegrasyon kartı yok / kartta kaynak-boyut-prob-tarih boş (v0.27, MADDE 25 — SDK yoksa no-op; bayat kart NOT) | `--rule=`, `--strict`, `--release`, `--ignore-t=`, `--dictionary=`, `--cards=`, `--bayat-gun=` |
| `gates/check-process-discipline.mjs` | VARLIK/KALİTE karışık (bkz. alt-kural) | hakem-verdict (YARI-MEKANİK) · plan-exists (VARLIK + warn-only plan metadata) · mode-escalation (KALİTE) · spec-receipt (KALİTE, warn-only varsayılan) · delege-kotasi (KALİTE, PreToolUse stdin okur) · dosya-sahipligi (VARLIK, v0.31: PreToolUse/Stop/SubagentStop/SessionEnd stdin okur) | (hedef repo) | staged (kod diff/plan/ağır-sinyal bağlamında) | hakem çağrısı kanıtsız (uygulayan==doğrulayan; v0.12 `dis_model` sessiz atlama) · plansız/dolgu-planla koda geçiş · goal/expected-outcome/proof/write_set metadata eksikliği (şimdilik yalnız UYARI) · "hafif mod" beyanı ağır API/DTO/migration'ı gizliyor · **staged yazım plan `write_set` vaadinin DIŞINDA** (v0.23.0 ters-spec: modele SORULMAZ, diff↔vaat set-farkı; TEK YÖN — "vaat var diff yok" MEŞRU/sessiz; plan >3 commit bayatsa no-op) · **tur-içi ham keşif kotası aşıldı** (v0.23.0: PreToolUse stdin'inden `prompt_id`+`tool_name` okur — şema ÖLÇÜLDÜ; Read/Grep/Glob sayılır, Bash SAYILMAZ (bileşik komut ayrıştırılamaz); eşik 15 kalibre, `--strict` → exit 2) · **aynı dosyaya iki farklı oturum/alt ajan yazıyor** (v0.31: dosya-sahipligi; Edit/Write/MultiEdit/NotebookEdit'te sahiplik kaydı alır; sahiplik yalnız çalışırken tutulur (Stop/SubagentStop/SessionEnd bırakır); çakışmada varsayılan exit 2 (uyarı yazımı ÖNLEMEZ — e2e ÖLÇÜLDÜ); `--uyari` → `additionalContext` JSON + exit 0 (düz stdout modele ULAŞMAZ); Stop'ta HER ZAMAN exit 0; hook hatası yutulur, exit 0) | `--rule=`, `--strict`, `--dir=`, `--branch=`, `--kota=` |
| `gates/check-history.mjs` | KALİTE | append-only · co-update · stale-constants · friction-repeat | ① ② ③ (append-only/stale-constants/friction-repeat bu repoda aktif) | staged (append-only dosyaları, UI/senaryo yüzeyi, rol dosyaları, sürtünme günlükleri) | tarihsel kayıtta satır silme/değiştirme · yüzey↔akış dokümanı driftı (kozmetik dokunuş tespit edilir) · rol dosyasına gömülü ölçüm sabitinin bayatlaması (pilot: "120 hata" → 117) · sürtünme girdisinde `Mekanizma-adayı:` eksikliği + eşiği aşmış AÇIK tekrar NOT'u (v0.20, MADDE 21 — NOT bloke ETMEZ) | `--rule=`, env `APPEND_ONLY_EXTRA`, `--strict`, `[dosya...]` |
| `gates/check-self-registry.mjs` | VARLIK/sağlık | rule-contracts · orphan-gates · design-tokens · install-version | ③ (bu repo) + ② (design-tokens, no-op — DESIGN.md yok; install-version hedef hook'unda warn-only, çıkış kodu DAİMA 0) | gömülü sözleşme tablosu + `gates/check-*.mjs` envanteri + staged UI dosyası | kimlik/doktrin cümlesi sessizce silinmiş/yumuşatılmış · kurulu-ama-kayıtsız kapı (ORPHAN, 5 kontrol — CONTRACT kaydı + test VARLIĞI + test İÇİNDE negatif-deney (MADDE 15) + koşucu bağlılığı + alt-kural sınıf beyanı (MADDE 16)) · UI'da hardcoded renk/inline-style (DESIGN.md sapması) | `--rule=`, `--strict`, `--table=`, `--dir=` (v0.30), `[dosya...]` |

> **Sınıf dürüstlüğü:** VARLIK kapısı bir alanın DOLU/dokunulmuş olmasını zorlar, kaliteyi
> garanti ETMEZ; KALİTE kapısı git diff/parse ile somut ihlali yakalar. (Ayrıntı: `reference/doctrine.md`.)
> `check-process-discipline --rule=hakem-verdict` **YARI-MEKANİK** olarak tek sınıf etiketiyle
> anılır (v0.16 — eski CONTRACT/GUARDS ayrışması SB-4'te kaydedilmişti, burada ÇÖZÜLDÜ): ÇAĞRI
> mekanik zorlanır (E0, verdict artefaktı yoksa FAIL), ama VERDICT İÇERİĞİ (onay/red/kosullu)
> kapının yargı alanı DEĞİLDİR — disiplinde (insan/hakem) kalır. Ne saf VARLIK ne saf KALİTE.

## Bilinen sınırlar (dürüstlük kaydı — eski docs/GUARDS.md'den taşındı, v0.16)

- **doc-integrity v0.30 genişlemeleri:** doc-truth bir belirteci yalnız bilinen uzantıyla bitiyorsa YA DA ilk segmenti gerçek/geçmişte-var dizinse yol sayar (`org/model`, `137/140` sayılmaz) — bedeli: uzantısız ve hiç var olmamış dizinli uydurma yol yakalanmaz; kısaltılmış yol TEK izlenen dosyaya denk geliyorsa yaşıyor sayılır (yanlış dosyaya bağlanma riski). Append-only defterlerde (`*KARAR-DEFTERI.md`, DECISIONS, PRODUCT_LOG, FRICTION_LOG, GARDEN_LOG, SIDE-BUGS-LOG) git geçmişinde izi olan yol TARİHSEL sayılır; canlı rehberde hata sürer. `--ignore` tüm komut ailelerine uygulanır. integrity: aynı-repo `repo:symbol` anchor'ı izlenen koddaki TANIMDAN çözülür (sezgisel regex — property/alan anchor'ı "tanımlı değil" çıkabilir); başka repo adı yumuşak not kalır. `--strict` altında YENİ FAIL: anchor'lı ama [T]/[L0] sınıflanamayan doküman (doc-recency), registry var + hiç [T]/[L0] yok (integrity, doc-recency), aynı-repo "sembol tanımlı değil" (integrity) ve coverage-gate'in `eksik` ile artık susturulamayan bulguları — YALNIZ künyesi v0.30.0+ olan ya da künyesiz repoda; skill_version < 0.30.0 ya da okunamayan künyede aynı bulgular `--strict`'te bile UYARI + yükseltme notudur (`gates/lib/kunye-surum.mjs`). doc-recency ve integrity `{{…}}` içeren argümanda (doldurulmamış CI/hook şablonu) FAIL; doc-recency diskte olmayan dosya argümanında FAIL. Bayraksız çağrı yalnız daha görünür satır basar.
- **v0.30.4 saha yamaları (SB-29…32 + saha-C/saha-D/saha-B upstream):**
  · integrity çakışma anahtarı `repo:path:symbol` (yoksa `repo:symbol`); frontmatter listesi kardeş anahtarda biter (blok-taşması). Sınır: biri `path`li biri `path`siz iki anchor ayrı anahtar alır, gerçek çakışma kaçabilir.
  · doc-recency `--base <ref>` / `--base=<ref>`: değişen küme `git diff <ref>...HEAD` (PR aralığı); ref çözülmezse FAIL; CI'da `fetch-depth: 0` gerekir. Bilinmeyen bayrak: künyesi v0.30+ repoda FAIL, eski/künyesiz repoda UYARI (exit etkilenmez). Kategori bayrakları (`--json`, `--allow-empty`, `--ignore=`, `--registry=`, `--facts=`) tanınır.
  · `--all` modu: file-size `git ls-files` (tüm izlenen, untracked YOK); append-only `<taban>...HEAD` (`APPEND_ONLY_TABAN` ya da origin/HEAD) — taban hiç yoksa görünür ATLANDI + exit 0, AÇIKÇA verilip çözülemezse FAIL. Bu modda sınıf fiilen auto-discovery/taban-diff'tir; tablodaki staged-diff beyanı argümansız (hook) davranışı anlatır.
  · doc-truth: var olmayan ama `.gitignore`'lı yol ölü SAYILMAZ (taze checkout'ta yok, yerel artefakt) — sayı + ilk 5 yol NOT olarak basılır; git çalışmazsa güvenli tarafta ölü sayılır + uyarı. Sınır: geniş ignore deseni (`docs/`) gerçek ölü referansı NOT'a düşürür.
  · secrets: TS/JS'te `:` + tırnaksız tanımlayıcı/özellik zinciri (nesne alanına başka bir değişkenin/özelliğin atanması) sır sayılmaz — arkasında ≥6 karakterlik tırnaklı fallback/birleştirme varsa sayılır; tırnaklı anahtar biçimi (JSON) artık yakalanır; dil dosyası (locales/i18n/…, `xx.json`) ya da değeri anahtar sözcüğün kendisi (Password/Parola/Şifre) olan etiket sır sayılmaz. Sınır: TS'te tırnaksız ve tanımlayıcı biçimli gerçek bir değer yakalanmaz (değer bir değişken adı gibi yazılmışsa ayırt edilemez).
  · STATE araması: kök → docs/ → docs/<alt>/ (archive/arsiv/nokta dizinleri atlanır), çoklu adayda kök öncelikli. `--fork` künyede kayıtsız ama hedefte var olan dosyayı fork'lu girdi olarak ekler (skill kopyası mührü yok — drift'in neyden saptığı ölçülemez).
- **v0.30.5 (SB-33/34 + saha-C):** doc-truth açık dosya argümanlarını `.md/.mdx` ile süzer (hook'un verdiği künye/yml/kod rehber sayılmaz); hepsi kapsam dışıysa "0 rehber (N argüman kapsam dışı)" + exit 0 — boş-küme FAIL'i yalnız argümansız modda. Aynı-repo sembol çözümü C# property (`{ get; set; }`, `=>`) ve virgül-sonrası boşluklu generic dönüş tipini tanır. secrets: fonksiyon parametresi tip bildirimi ve şema/ortam kaynağıyla BAŞLAYAN tırnaksız değer (z./yup./Joi./process.env/import.meta.env) sır sayılmaz; `||`/`??` ile gelen tırnaklı sabit fallback yakalanmaya devam eder.
- **`--upgrade` tazeleme kümesi (v0.30.2, SB-28):** upgrade yalnız paketin `gates/**` ağacını ve üç yaşam döngüsü aracını (`scripts/install-exam.mjs`, `scripts/install-doctor.mjs`, `scripts/upgrade.mjs`) tazeler — tek liste `gates/lib/tazelenebilir.mjs`. Künyede generic görünen ama bu kümenin dışında kalan girdiler (şablondan üretilmiş yaşayan dosyalar: `docs/SIDE-BUGS-LOG.md`, CI workflow; yerel reçeteler: hedefin `verify.mjs`'i) BİLGİ olarak raporlanır, tazelenmez, drift FAIL'i üretmez, yükseltmeyi KISMİ yapmaz; `--upgrade --sahiplen=<yol>` ile `repo_owned_files`'a taşınır. Sınır: fork edilip yeniden adlandırılmış yerel kapı kaynaksız sayılır.
- **`--upgrade` bağımlılık kapanışı (v0.30):** tazelenen dosyanın göreli import kapanışı çözülür: hedefte eksik bağımlılık oluşturulup künyeye mühürlenir; fork'lu/drift'li bağımlılık varsa o dosya hiç tazelenmez (yarım tazeleme = kırık kapı); `--apply` sonrası yüklenemeyen dosya geri alınır (exit 1). Bare-spec (paket) importları kapanışta izlenmez, yalnız yükleme denemesi yakalar.
- **secrets minified boolean muafiyeti (v0.30):** `password:!0` / `!1` ardından ayraç gelirse sır sayılmaz — bedeli: `password: !0,Gerçek…` gibi ünlem-sıfır-virgülle başlayan bir parola kaçar (gerçekte olası değil, bilinçli tercih).
- **check-self-registry hedef düzeni (v0.30):** `orphan-gates` kapı dizinini kendisi bulur (`gates/` ve `scripts/gates/`, `--dir=` override); OTOMATİK bulunan `scripts/gates/` düzeninde bulgular `--strict` verilse bile UYARI kalır (sahada 30-35 bulgu — eski kurulumlara sessiz yeni FAIL dayatılmaz); FAIL için `--dir=` açıkça verilir. `rule-contracts` hedef repoda (SKILL.md yok, `--table=` yok) dürüst no-op. `check-hygiene --rule=file-size` varsayılan kapsamı STAGED'dir (eski hook'larda `GATES_RING` yok; commit'e girmeyen dosya commit'i bloke ETMEZ). Çalışma ağacı (staged ∪ unstaged ∪ untracked) yalnız açık istekle: `--worktree` ya da `GATES_RING=elle`; argümansız koşuda staged boşsa "0 dosya tarandi (kapsam: staged) … --worktree" satırı basılır (exit 0) — elle koşuda sessiz OK yok. `install-version` yalnız makinedeki kurulu skill ile künyeyi karşılaştırır (`AGENTIC_SKILL_DIR` ya da `~/.claude/skills/agentic-repo-setup`); kurulu skill de bayatsa bunu bilemez.

- **check-hygiene --rule=secrets placeholder filtresi:** değerinde `example|sample|dummy|test-secret|xxx`
  geçen dizeler KASITLI olarak temiz sayılır (FP azaltma). Sonuç: `...EXAMPLEKEY` içeren gerçek-görünümlü
  bir anahtar YAKALANMAZ. Smoke-test yaparken bunu bil — negatif deneyi `AKIA` + rastgele 16 karakterle kur.
- **check-history --rule=append-only** yalnız `APPEND_ONLY_EXTRA` ile bildirilen defterleri korur. Yeni defter
  eklerken İKİ yeri birden güncelle: `scripts/self-pre-commit.mjs` `KARAR_DEFTERLERI` ve
  `.claude/settings.json` PreToolUse komutu. (Hook JSON'ı script'i import edemez — bilinçli drift riski.)
- **health-check kapı DEĞİL**, ritüeldir: varsayılan uyarır, bloke etmez (`--strict` release'te).
  Gerekçe: entropi commit'ler ARASINDA birikir ve neyin budanacağı ÖZNEL karardır.
- **`scripts/brainstorm.mjs` kapı DEĞİL, ORKESTRATÖRDÜR** (v0.19): insan çağırır, hiçbir koşucuya
  bağlı değildir, commit'i bloke etmez → ORPHAN sayılmaz (kapı olmadığı için kapı-kaydı şartı da
  yoktur). Protokol: `reference/coklu-model-beyin-firtinasi.md`. Çıkış kodları: `0` koşu tamam ·
  `1` ihlal (aile çakışması / brief yok) · **`2` = `BRIEF_BOZUK`** — hata DEĞİL BULGU (tur 1'de tam
  yakınsama = brief anchor'lıyor; panel yeniden koşulmaz, brief revize edilir). 🔴 Script **LLM
  yorumu YAPMAZ** (sentez için model çağırmaz) — sentezi modele yaptırmak, protokolün kaldırdığı
  moderatör biasını koda GÖMERDİ; yalnız çağırır, etiket sayar, substring doğrular. Saf mantığı
  `tests/brainstorm.test.mjs` ile test edilir (17 test, 2 negatif deney: aile çakışması + uydurma
  alıntı); dış çağrı test EDİLMEZ (ağ + para). Koşu çıktısı `runs/` → gitignore (ham cevaplar repo
  içeriği değildir).
- **`scripts/state-sync.mjs` kapı DEĞİL, RAPORLAYICIDIR** (v0.20.3): proje durumunu git'ten TÜRETİR,
  hiçbir dosyayı DEĞİŞTİRMEZ, insan çağırır (`npm run state`). NEDEN: ölçüm (2026-08-12) `docs/STATE.md`'nin
  31 dalgada 9 kez güncellendiğini (%29) ve son güncellemeden sonra 5 commit + 4 sürüm geldiğini gösterdi —
  "aktif iş" tablosu commit'lenmiş işleri "bekliyor" diye listeliyordu. **Elle yazılan HESAPLANABİLİR dosya
  tanım gereği bayatlar; disiplin sorunu değil TASARIM hatasıdır.** Teşhis üç bağımsız dış-model panelinin
  (Codex · GLM-5.2 · Claude/hakem) 3/3 mutabık bulgusu: *"bir kural, ihlal edildiğinde bir sonraki zorunlu
  geçişi bozmuyorsa kural değildir."* 🔴 **KAPSAM SINIRI:** yalnız TÜRETİLEBİLİR durum. İnsan/model yargısı
  taşıyan defterler (karar defteri · `FRICTION_LOG` · `SIDE-BUGS-LOG`) kapsam DIŞIDIR ve SİLİNMEZ — git'ten
  hesaplanamazlar; onlar append-only + kapı ile korunur. Çıkış kodları: `0` rapor üretildi ·
  **`1` (yalnız `--check`)** = STATE bayat (≥3 commit geride) VEYA sürüm üçlüsü senkron değil.
  🔴 `gecikmis` (1-2 commit) BLOKE ETMEZ — her commit'te STATE güncellemesi istemek, modelin kapıyı geçmek
  için içeriksiz satır yazmasına yol açar (Goodhart tuzağı; panel teşhisinde açıkça uyarıldı).
  Saf mantığı `tests/state-sync.test.mjs` ile test edilir (7 test, 2 regresyon kilidi: bundle-geride
  vakası + sayısal sürüm sıralaması).
- **`scripts/rol-bench.mjs` kapı DEĞİL, ORKESTRATÖRDÜR** (brainstorm ile aynı sınıf: insan çağırır,
  para harcar, hiçbir koşucuya bağlı değil → ORPHAN sayılmaz). Ölçtüğü: rol sistem-promptunun bir
  kuralı modeli GERÇEKTEN bağlıyor mu. İki kol (çıplak vs rol) + 4-değerli verdict
  (`GEREKSİZ`→buda/`KAZANIYOR`→tut/`PROMPT-YETMİYOR`→mekanizmaya çevir/`ZARARLI`→yeniden yaz).
  🔴 Rol promptu `.claude/agents/*.md`'den **çalışma anında okunur** (kopyalanmaz) — prompt değişince
  ölçüm otomatik yeni promptu hedefler, bayat kopya ölçme riski yok. 🔴 Script **LLM yorumu YAPMAZ**:
  skorlama %100 regex+eşik; "hangi cevap daha iyi" için model çağırmak hakem biasını skora gömerdi.
  🔴 `openrouter-run.mjs` KULLANILMAZ (kendi çağırıcısını taşır): o wrapper her isteğe kendi sistem
  promptunu enjekte eder → prompt deneyinde CONFOUND. Çıkış kodları: `0` koştu · `1` kurulum/ihlal ·
  **`3` = NEGATİF KONTROL DÜŞTÜ** — ihlali EMREDEN sabotaj promptu bile yakalanmadıysa skorlayıcı
  bozuktur ve sonuç tablosu kanıt değildir. Vaka seti bench/vakalar.json (geliştirme reposunda) (her vaka bir rol-dosyası
  satırını hedefler; `kaynak` alanı rol-bench testiyle MEKANİK zorunlu — Goodhart
  savunması). `bench/` pakete GİRMEZ (`.gitattributes` + pack-skill `banned[]`); koşular
  `bench/runs/` → gitignore.
- **check-history --rule=stale-constants** SON GERÇEK YAKALAMA (2026-07-24, kurulduğu gün, BU repoda):
  `.claude/agents/hakem.md:15` + `uygulayici.md:20` "verify 7/7 + 213 test" diyordu — gerçek 8 adım /
  260 test. İki canlı rol dosyası bayat sayı taşıyordu, kimse fark etmemişti.
- **check-self-registry --rule=orphan-gates negatif-deney kontrolü (v0.18.2, MADDE 15) SADECE
  VARLIĞI görür, İÇERİĞİN anlamlı olduğunu değil.** Sıfır-olmayan çıkış beklentisi regex ile aranır
  — bu satır tesadüfen/anlamsızca da yazılmış olsa (ör. yanlış fixture'la, hiçbir gerçek kirli
  girdiyi test etmeden) kapı yine "negatif deney VAR" der. Kalitesi Hakem/E2 işidir.
  **Kapsam (hakem turunda ölçülüp GENİŞLETİLDİ, 10 biçim sınandı):** `assert.equal/strictEqual/
  notEqual` · `assert.ok(x === 1)` / `(x !== 0)` · `expect(x).toBe(n)` (jest/vitest) · alan adı
  `status`/`code`/`exitCode` · exit 2 dahil (PreToolUse hook sözleşmesi exit 2 döndürür).
  **Bilinen kaçak:** YORUM satırındaki negatif test de sayılır (`// assert.equal(r.status, 1)`).
  Kapatılmadı çünkü tehdit modeli KAZARA eksiklik, kasıtlı atlatma değil (SB-5 emsali) — kasıtlı
  atlatmanın savunması Hakem'dir (E2). Bu kapı hedef repoda başka test stilleri (chai `to.equal`,
  pytest) kullanılırsa yine yanlış ateşleyebilir; ilk FP raporunda kapsam yeniden ölçülmelidir.
- **check-self-registry --rule=orphan-gates alt-kural sınıf beyanı kontrolü (v0.18.2, MADDE 16)
  SADECE BEYANIN VARLIĞINI görür, DOĞRULUĞUNU değil.** "Alt-kural sınıf beyanı" tablosunda satırı
  olan her `kategori:alt-kural` geçer — beyan edilen sınıf (`staged-diff`/`opt-in-artefakt`/
  `auto-discovery`) fiilen YANLIŞ olsa bile (ör. gerçekte auto-discovery olan bir alt-kural
  staged-diff diye yazılsa) bu kapı yakalamaz. Doğruluk denetimi Hakem/E2 işidir — MADDE 15'in
  `acceptance` yanlış-sınıflama vakası bunun somut örneğidir (kapı o zaman yoktu, hakem yakaladı).
  Beyanı OLMAYAN alt-kural `--strict` dışında yalnız UYARI verir (geriye-uyumluluk: mevcut kurulu
  kapılar kırılmaz), `--strict`'te FAIL'dir.
- **check-doc-integrity --rule=doc-recency KADEME 1/2 (v0.18.3, MADDE 17, `--cascade` opt-in)
  "dokunuldu mu" der, DOKUNUŞUN İÇERİK OLARAK DOĞRU olduğunu garanti ETMEZ** (kademe-0/HTML anchor
  ile aynı sınır — kozmetik bir satır eklemek tripwire'ı susturur). **Sembol-doğrulaması burada
  YAPILMAZ (kasıtlı, hakem turu B3 düzeltmesi):** KADEME 1 YOL-TABANLIDIR — `repo` alanı çözülür,
  ama `symbol` alanının o dosyada GERÇEKTEN var olup olmadığı bu alt-kuralda doğrulanmaz, yalnız
  rapor metnine yazılır. Sembol doğrulaması `integrity` alt-kuralının işidir (kendi yerel
  `resolveAnchor`'ı `String.includes` ile arar, AST-indeks adaptörü kapalıyken ipucu düşer) — iki
  alt-kuralın AYNI işi TEKRAR etmesi yerine bilinçli olarak buraya bırakılmıştır. Sonuç: kod
  dosyası VAR ama `symbol` o dosyada YOK olsa bile KADEME 1 yine "yol değişti" tripwire'ı verir
  (yanlış-pozitif değil, kapsam dışı — DANGLING ANCHOR ayrımı `integrity`'nin işi). Yol hiç
  çözülemezse (çapraz-repo) SESSİZCE ATLANMAZ, "çözülemedi" NOT bloğunda raporlanır (ana bulgular
  listesine girmez).
- **check-doc-integrity --rule=doc-recency "sınıflanamadı" NOT'u (v0.18.3, MADDE 17, B2) DAR bir
  sinyal kullanır** (`anchors:`/`tech_docs:`/`feature_id`-ailesi alanlarından en az biri) — bu
  sinyal alanlarını HİÇ taşımayan generic frontmatter'lı `.md` dosyaları (blog/jekyll tarzı) bu
  NOT'a düşmez, ölçülmüştür. Kalan FP riski: sinyal alanı taşıyan ama kasıtlı olarak [T]/[L0]
  OLMAYAN bir `.md` (ör. örnek/şablon amaçlı) — bu durumda NOT basılır ama FAIL üretmez (yalnız
  bilgi amaçlı, `--strict`'te dahi commit'i bloke ETMEZ).
- **check-doc-integrity --rule=doc-recency `--cascade` bayrağı olmadan KADEME 1/2 tamamen NO-OP'tur**
  — geriye-uyumluluk garantisi budur (bkz. MADDE 17). "Sınıflanamadı" NOT'u istisna: bayraktan
  BAĞIMSIZ her zaman çalışır (typo tespiti kullanıcının cascade açıp açmamasına bağlı olmamalı).
- **KADEME 1'in iki granülarite sınırı (v0.18.3 hakem turu U1/U2 — ÖLÇÜLDÜ, kapatılmadı):**
  ① **Dizin-anchor FP:** `{repo: src/mod}` gibi DİZİN'e çapalı bir [T], o dizindeki HERHANGİ bir
  dosya değişiminde ateşler (sembol filtresi yok — bkz. yukarıdaki "sembol doğrulaması YAPILMAZ").
  Panzehir: anchor'ı dosyaya çapala, dizine değil. ② **Monorepo yanlış-bağlanma (yanlış-NEGATİF):**
  iki pakette aynı göreli yol varsa (packages/a ve packages/b altında AYNI src/pay.ts) çözüm İLK
  eşleşene bağlanır; ikinci paketteki gerçek değişiklik SESSİZ kalır. İkisi de `--cascade` opt-in
  olduğu için varsayılan kurulumu etkilemez; monorepo'da açarken anchor'ları paket-köküne göre
  MUTLAK yaz. Kapatılmama gerekçesi: her ikisi de kalibrasyon ister (K29 emsali — ölçmeden
  daraltmak FP üretir), saha verisi yok.
- **check-doc-integrity --rule=doc-truth `node <yol>` denetimi (v0.18.4, MADDE 18) yalnız İKİ
  biçimi görür:** çok-segment yol (`node gates/check-hygiene.mjs` gibi) ve uzantılı tek-segment
  script (`node verify.mjs`, `.js`/`.mjs`/`.cjs`/`.ts` zorunlu). **Görmediği biçimler (dürüstlük kaydı):**
  uzantısız çağrı (`node app`, Node'un varsayılan `.js` çözümlemesi) · dinamik/değişken argüman
  (`node "$FILE"`, `node ${SCRIPT}`) · shebang/`npx node`/`node -e "..."` inline kod. Bu kaçaklar
  KAZARA eksiklik olarak bırakıldı (SB-5 emsali, kasıtlı atlatma değil) — ilk FP/FN raporunda
  kapsam yeniden ölçülmelidir.

23. **MADDE 23 — kanıt-bağı alanı: `hakem-verdict`'e `dayanak` + `dayanak_durumu`** (v0.24, K64/K65).
    Sınıf: EKLEME, `gates_contract_version` ARTMAZ (CLI arayüzü aynı, geriye uyumlu — alan hiç
    yoksa kapı sessiz). Kaynak desen: bir çıkarımı kaynağa bağlayamıyorsan sessizce kabul etme,
    İŞARETLE. Sözleşme: `dayanak` varsa `dayanak_durumu` zorunlu ve `cozuldu|COZULMEDI` olmalı;
    `COZULMEDI` hata değil dürüst bir beyandır ama `--strict` bloke eder, kararı insan verir.
    Çözünürlük denetimi bilinçli KODLANMADI: aday imza sınıfı K62 REPLAY ölçümünde 19/19
    yanlış-alarm verdi, kalibre edilmeden eklenmedi. Sınır: kapı çapanın GERÇEKTEN çözülüp
    çözülmediğini denetlemez, yalnız beyanın dolu/geçerli olduğunu görür (VARLIK kapısı).

24. **MADDE 24 — `file-size` kapsamına `SKILL.md` + cırcır muafiyeti** (v0.25, dogfood bulgusu).
    Sınıf: EKLEME, `gates_contract_version` ARTMAZ (CLI arayüzü aynı). Kök neden: `SKILL.md`
    tavanı (~300 satır) yalnız nesirde vardı, `GUIDE_FILE` deseninde `SKILL` yoktu — hiçbir kapı
    bakmıyordu, dosya tavanın çok üstüne çıkmıştı. Değişiklik: `SKILL` desene eklendi;
    `scripts/size-baseline.json` cırcır olarak devreye alındı (mevcut boyut tavan olarak
    dondurulur, muaf dosya küçülebilir ama büyüyemez) — ihlal görünür olur ve büyümesi durur, ama
    release bloke edilmez. Asıl küçültme ayrı bir iştir. Sınır: kapı yalnız satır sayar; "içerik
    doğru yerde mi" bir yargıdır (E2), kapı veremez.

25. **MADDE 25 — dış-sistem ekseni: `check-provenance`'a `integration-cards`** (v0.27, saha
    vakası). Sınıf: EKLEME, `gates_contract_version` ARTMAZ (yeni alt-kural, mevcutların arayüzü
    aynı). Kök neden: bölgeye göre bölünmüş bir dış servisin (AWS SES) yapısını ajan bilmeden
    iddia etti — servisin hesap/bölge/ortam yapısı hiçbir kuralın kapsamında değildi (`D-23
    sürüm-gerçeği` yalnız kütüphane sürümünü kapsıyordu). Tetikleyici = manifestte bilinen dış
    servis SDK'sı (kapalı desen listesi — bulut/ödeme/mesajlaşma/AI); SDK yoksa alt-kural tümüyle
    NO-OP. Sınıf: opt-in-artefakt, VARSAYILAN UYARI + `--strict` FAIL. Sözleşme: her dış SDK
    paketi `docs/integrations/*.md` altında bir kartın `paketler` listesinde geçer; kartta
    `servis · kaynak (URL) · dogrulandi (tarih) · boyutlar · prob` dolu olur. `dogrulandi`
    `--bayat-gun`den eskiyse NOT — `--strict`'te bile bloke ETMEZ (tarih yalnız sinyal, K71 "yaş ≠
    kanıt"). Hakem turu (K75) ilk sürümü kaldı etti: şablon yer tutucusu (`{{…}}`) bırakılan kart
    `--strict`'te geçiyordu, liste "dolu" sayılıp öğeleri denetlenmiyordu — düzeltildi, regresyon
    testi gerçek şablondan türetilir. Sınır: kapı kartın DOĞRU olduğunu ve prob'un gerçekten
    koşulduğunu göremez, yalnız sorunun cevaplanmış olduğunu zorlar (davranış D-33 hakem işi).
    Desen listesi kalibre edilmemiş hedef repoda eksik kalabilir — listede olmayan SDK sessizce
    geçer (bilinçli tercih: yanlış-alarm yerine eksik-yakalama).
26. **MADDE 26 — v0.30 saha denetimi düzeltmeleri** (v0.30, 2026-10-03 saha denetimi: 20 kurulum /
    12 repo + 6 aileli konsey). Sınıf: EKLEME + davranış daraltma, `gates_contract_version` ARTMAZ —
    hiçbir alt-kural kaldırılmadı/yeniden adlandırılmadı, yeni bayraklar opt-in, yeni sıkı davranışlar
    ya UYARI ya `--strict` altında ya da yalnız v0.30+ künyede (eski kurulumlara sessiz yeni FAIL yok).
    (a) `check-hygiene`: append-only DEFTER sınıfı (uyarı 400 / FAIL 1200); file-size varsayılan STAGED,
    çalışma ağacı yalnız `--worktree`/`GATES_RING=elle` ile; .NET ailesinde BOM muaf; parola alanının tip bildirimi sır değil.
    (b) `check-doc-integrity`: doc-truth yol ölçütü daraltıldı + tarihsel yol istisnası + `--ignore`
    tüm komut ailelerine; integrity aynı-repo sembol çözümü; `--strict` altında sınıflanamayan
    doküman ve registry-var/doküman-yok FAIL. (c) `check-provenance:coverage-gate`: yapısal hata
    `eksik` ile SUSTURULAMAZ (varsayılan UYARI, `--strict` FAIL; b ve c'nin yeni FAIL'leri yalnız
    v0.30+ künyede — eski künyede UYARI). (d)
    `check-process-discipline:mode-escalation`: STATE kök + `docs/`. (e) `check-self-registry`:
    `--dir=` + kapı dizini otomatik bulma; yeni warn-only `install-version` (çıkış DAİMA 0).
    (f) Yaşam döngüsü araçları (CLI sözleşmesi kapsamı dışı, madde 7-9 deseni): künye toggle'ları
    üç-durumlu (null = sorulmadı; install-exam ⑧ v0.30+ künyede null'a FAIL); doctor ⑥-⑩ yeni
    UYARI/BİLGİ kontrolleri (toggle belirsizliği, fork, varsayılan dal, STATE bayatlığı, doküman
    dokunuşu) + `--fork=<yol> --neden=` makine yazımlı fork beyanı; upgrade fork'lu dosyayı ATLAR,
    sözleşme uyuşmazlığında GÖÇ RAPORU basar ama çıkış kodu eskisi gibi 1 (otomatik göç YOK),
    `--toggle=<ad>=<true|false>` yalnız künyeyi günceller.
27. **MADDE 27 — dosya sahipliği: `check-process-discipline:dosya-sahipligi`** (v0.31, K87). Sınıf:
    EKLEME (opt-in alt-kural + CLI), `gates_contract_version` ARTMAZ — hiçbir alt-kural kaldırılmadı,
    hook bağlanmadıkça hiçbir şey koşmaz. Girdi: hook stdin'i (PreToolUse · Stop · SubagentStop ·
    SessionEnd; alanlar ÖLÇÜLDÜ 2026-10-06). Çıkış: PreToolUse çakışmasında 2 (yazım REDDEDİLİR),
    `--uyari` ile 0 + `additionalContext` JSON; diğer her durumda (Stop dahil, stdin yok/bozuk, hata) 0.
    Kayıt `<git-common-dir>/ajan-sahiplik/` (dosya başına `wx`; TTL 10 dk, `SAHIPLIK_TTL_DK`; 5 sn'den
    eski bozuk kayıt çöp). Yaşam döngüsü aracı `scripts/sahiplik.mjs` (CLI sözleşmesi kapsamı dışı,
    madde 7-9 deseni; çıkış 0 temiz · 1 çakışma/beyan dışı · 2 kullanım hatası) hedefe upgrade ile gider.

## Doğrulama

> `verify.mjs` paketin KENDİ üzerinde, pakette anlamlı olan statik kapıları koşar; adım listesi
> `verify.mjs` `steps[]`'tir ve sayıyı koşu kendisi basar (elle yazılmaz). `doc-truth` iki kez koşar
> (rehber dosyaları + paketin kendi dokümanları, ikincisi `IGNORE` listesi olmadan, daha katı).
> Kayıt tablosundaki diğer alt-kurallar öz-doğrulamaya GİRMEZ çünkü hedefe/bağlama özgüdür:
> `check-history --rule=append-only` + `--rule=co-update` *staged-diff* (yalnız commit anında),
> `check-provenance --rule=brief-provenance` *opt-in* (`docs/test-briefs/` yoksa no-op). Bunlar
> hedef repoda koşar; birim testleri (`tests/`) hepsinin davranışını ayrıca kanıtlar.

```
node verify.mjs        # öz-doğrulama: paket kendi statik kapılarından geçiyor mu (staged-diff + opt-in kapılar hedefte koşar)
node --test tests/*.test.mjs   # her kapının birim testleri (kötü girdi → exit 1, temiz → exit 0)
```

Örnek girdi biçimleri: `examples/acceptance.json` (acceptance), `examples/settings.json` (hook).
CI bu iki bacağı her push/PR'da koşar: `.github/workflows/verify.yml`.
