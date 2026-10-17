# Dış Entegrasyon Adaptör Katmanı (DEAK) — v0.9

> Kuran ajanın el kitabı (E1-lazy: yalnız dış-entegrasyon toggle'ı açıkken okunur).
> **Taşıyıcı fikir:** dış sistem adımları (CI platformu, iş-takip aracı) skill'in ÇEKİRDEĞİNE
> gömülü DEĞİLDİR — repodan repoya değişir. Bu katman onları kurulum-zamanı **kalibre edilen,
> toggle'lı ADAPTÖR**e çevirir. Yasa değişmedi, sadece üçüncü bir eksene uygulandı:
> **kullanmayan ödemez** (`reference/doctrine.md` — iki dik eksen + toggle).

---

## 0. Neden adaptör, sabit kod değil

- **Tespit edilen açık:** zorlama halkası 3 (CI) tek bir platforma sabitti — paket `.github/workflows/verify.yml`'i
  örnek olarak taşır, ama kurulan repo GitHub Actions kullanmayabilir. .NET-ağırlıklı bir ekosistemde
  gerçek CI çoğu zaman Azure DevOps'tur; GitLab/Jenkins de yaygın.
  Tek-platform varsayımı = "test yok derken 1504 test vardı" hatasının altyapı sürümü.
- **Aynı yapısal açığın ikinci yüzü:** iş-takip aracı (Fibery/Jira/Notion). Faz 2 son-kullanıcı dokümanı
  "ne yapıldığını" değil "neden/nasıl"ı anlatır → **niyet kaynağı** koddan daha değerlidir, ve bu kaynak
  repoya göre değişen bir DIŞ sistemdir.
- **Doktrin bağı:** boyut × muhatap iki dik eksendi; DEAK üçüncü dik ekseni ekler — **dış-entegrasyon
  ekseni.** Üçü de toggle: dış sistem yoksa tek satır kurulmaz, çekirdek (SKILL/CLAUDE) şişmez.
- **Kimlik kırmızı çizgisi (K8 — değişmedi):** skill dış sistemi **HAZIRLAR** (üreteç/şablon/anchor/rapor-adaptörü
  kurar), **BARINDIRMAZ/çalıştırmaz.** Workflow'u CI motoru koşar; Fibery'yi Fibery koşar; RAG'ı kurulan ürün
  koşar. Skill bir kurulum sürecidir, runtime motoru değil.

---

## 1. CI Adaptörü (zorlama halkası 3'ün soyutlaması)

### 1.1 verify-reçetesi soyutlaması — platformdan BAĞIMSIZ çekirdek

Stack-tespitli verify komut listesi (manifest'e bakarak: `package.json`→npm/pnpm test, csproj→dotnet test,
pubspec→flutter test, *.tf→terraform validate — tam liste `SKILL.md` FAZ 2 reçetesinde) **platformdan
bağımsızdır.** CI platformu yalnız bu reçeteyi SARAR. Bu yüzden çekirdek = reçete; değişen = sarmalayıcı.

### 1.2 GitHub Actions üreteci — **KOD (bu sürümde)**

`templates/ci-workflow.template.yml` bir GHA workflow iskeletidir; kurulum ajanı stack-tespitli verify
reçetesiyle doldurur ve hedef reponun `.github/workflows/` altına repo-özgü dosya üretir. Paketin kendi
`.github/workflows/verify.yml`'i bunun **referans/dogfood örneğidir** (öz-doğrulama + kapı testleri iki bacağı).

### 1.3 Açık başlık: Azure DevOps / GitLab üreteci — **TASARIM (bilinçle ertelendi)**

Üreteç DEĞİL, **reçete taşınır:** aynı verify komut listesi `azure-pipelines.yml` veya `.gitlab-ci.yml`
sözdizimine dökülür. Bu sürümde KODLANMADI çünkü doctrine "önce pilot": gerçek bir .NET/Azure reposunda
kalibre edilmeden üretilen pipeline güveni eritir (yanlış cache anahtarı, yanlış agent havuzu, yanlış
trigger). Kurulum ajanı Azure/GitLab repoda GHA üreticini KULLANMAZ — verify reçetesini ELLE platforma
döker ve durumu STATE'e "platform-üreteci tasarım, elle kuruldu" diye yazar.

---

## 2. Takip/Tracker Adaptörü — Fibery (3 bağımsız toggle)

Her toggle ayrı sorulur, ayrı kurulur. Konfigürasyon iskeleti: `templates/fibery-adapter.template.md`.
Üçü de KAPALIYKEN paket hiçbir Fibery dosyası üretmez.

### 2.1 toggle: **niyet** (OKUMA) — en güvenli, K8'e en yakın

Fibery ticket'ın Description/comment alanı → "bu değişiklik NEDEN yapıldı" niyetini taşır. Kurulum, bir
doc-anchor'ın yanına ticket-kimliği bağı kurar (Faz 2 son-kullanıcı dokümanını besler). Yalnız okuma →
gizli kod sızmaz, dış sisteme yazılmaz. Risk: kaynak-çelişkisi (kod≠ticket) — bu durumda "doğrulanamadı"
etiketi (K7 disiplini), uydurma değil.

### 2.2 toggle: **rapor** (YAZMA-rapor)

Kapı/drift sonuçları (doc-recency tripwire, bahçıvan turu bulguları, kabul durumu) → Fibery'ye rapor.
Pilot e2e-testlerindeki reporter-adaptör deseni genelleştirilir. **Gizlilik kuralı:** rapor ham secret
TAŞIMAZ (`check-hygiene --rule=secrets` maskelemesi raporlamadan ÖNCE uygulanır); yalnız "N ölü referans / M tripwire" gibi
sayısal/yol-düzeyi özet gider.

### 2.3 toggle: **senkron** (iki-yön) — **DİKKAT: doctrine kısıtı**

İki-yönlü kör senkron `reference/doctrine.md`'deki **denormalizasyon→drift reddine** çarpar (statik index =
iki "gerçek" → drift). Aynı satırın izin verdiği TEK yol:
- **Markdown KANONİK, Fibery AYNA.** Tek-kaynak-doğruluğu repo-içi versiyonlu markdown'dadır.
- Senkron **TEK-YÖN** (repo → Fibery) + bir **"index==kaynak" uzlaştırma kapısı** (üretilen ayna == kaynak
  markdown; sapma FAIL). Bu, flag→bölüm üretecindeki (K9) disiplinin aynısıdır.
- Bu uzlaştırma kapısı **TASARIM/pilot-bağlı** — bu sürümde KODLANMADI (kalibre edilmemiş senkron kapısı
  yanlış-pozitifle güveni eritir; önce gerçek Fibery şeması ölçülür). Toggle açılırsa ajan tek-yön ayna
  kurar ve "uzlaştırma kapısı tasarım, elle denetlenir" diye STATE'e yazar.

---

## 3. Kalibrasyon (ölç → sor → kur)

ADIM 0 mini-denetiminde dış-entegrasyon ekseni de ÖLÇÜLÜR (sorma, bak):
1. **CI platformu tespiti:** `.github/workflows/` mı, `azure-pipelines.yml` mı, `.gitlab-ci.yml` mi var?
   Hiçbiri yoksa "CI yok" → reçete + (toggle açıksa) GHA üreteci öner.
2. **MCP/araç envanteri:** ortamda Fibery (ya da Jira/Notion) MCP'si bağlı mı? Bağlı değilse niyet/rapor/senkron
   toggle'ları **sorulmaz bile** (kullanmayan ödemez — bağlı olmayan aracın toggle'ı ölü sorudur).
3. **Kullanıcıya sor:** yalnız ortamda KANITI olan entegrasyonlar için. Açılan toggle üretilir; kapalı = no-op.

Bu, MODEL & MCP envanterinin (v0.7) dış-sistem kardeşidir: erişilemeyen sisteme işaret eden adaptör =
ölü dosya yolu (sessiz kırılma).

---

## 5. AST-İndeks Adaptörü — kod-grafiği besleme (v0.10)

Bir AST-indeks aracı (ör. codebase-memory-mcp: tree-sitter → SQLite bilgi grafiği, `cmm` CLI) kapıların
**symbol doğrulamasını** besler. Bugün doğrulama ham metindir: `readFileSync(hit).includes(symbolName)`
(`check-doc-integrity --rule=doc-truth` `resolveRepoSymbol`, `check-doc-integrity --rule=integrity` `resolveAnchor`, install-exam `checkAnchorResolution`) —
yorum satırındaki ismi, başka symbol'ün parçasını (`authenticateLegacy`) ve ölü kodu yanlış GEÇİRİR. AST
grafiği bunu yapısal olarak ayırt eder. Konfigürasyon iskeleti: `templates/ast-index-adapter.template.md`.
Toggle'lar KAPALIYKEN paket hiçbir AST dosyası üretmez, hiçbir kapı davranışı değişmez.

**Değişmez sınır (5-model uzlaşısı + doctrine):** graf **hiçbir kapıda doğruluğun KAYNAĞI değildir** — yalnız
kapının kendi `.includes()` kontrolü `found=false` döndüğünde "nereye bak" ikinci-görüşü üretir. Nihai verdict
her zaman dosya-sistemi kontrolünden gelir; graf `found`'u `false`'tan `true`'ya ASLA çeviremez. Adaptör
bağlı değilse davranış bugünküyle **birebir aynı** (fail-open status quo). Bu, senkron toggle'ının (§2.3)
kardeşidir: statik index `reference/doctrine.md`'nin denormalizasyon→drift reddine tabidir, ama burada graf
kanonik-olmadığı ve karar hiç değişmediği için drift bir FAIL değil yalnız ipucu-kalitesi düşüklüğüdür.

### 5.1 toggle: **symbol-ikinci-görüş** (OKUMA) — en güvenli, K8'e en yakın

Kapı `sembol-yok` verdiğinde graf'a sorulur: graf-görmüyor → "(AST de görmüyor — muhtemelen gerçekten
ölü)"; graf-görüyor → "(AST şurada görüyor: X — anchor yolu yanlış olabilir)". Bulgu yine `soft[]`'a
gider (dead[]'e ASLA — "yeni-kapı yanlış-alarm öldürür"), verdict değişmez. **KOD, fail-open.**

**Çağrı sözleşmesi (v0.11 pilotunda codebase-memory-mcp 0.9.0'a karşı ÖLÇÜLDÜ — varsayım değil):**
`<cli> cli search_graph --project <proje-adı> --name-pattern <symbol> --limit 5` → gövde
`{"total":N,"results":[{"file_path":...}]}`; stdout'ta önce `level=info` log satırları gelir, JSON
tek satırdır (ilk parse-edilebilir `{`-satırı alınır). Env: **`ARS_AST_ADAPTER` = indekslenmiş PROJE ADI**
(boolean değil), `ARS_AST_CLI` = binary yolu (boşluklu yol otomatik tırnaklanır). Graf bir kez
`cli index_repository --repo-path . --mode fast` ile üretilir.

### 5.2 toggle: **impact-adayı** (co-update) — **TASARIM (pilot-bağlı)**

`check-history --rule=co-update` bugün tamamen path/pattern-tabanlıdır (SURFACE/COMPANION regex); symbol/çağrı farkındalığı
yoktur. Tasarım: değişen sembolden `cmm trace-path` ile çağıranları izle → hangi `[T]` dokümanının yeniden
doğrulanması gerektiğini aday olarak üret. Bu yeni bir yetenek sınıfıdır → doctrine "önce pilot": kalibresiz
call-graph co-update'in doğal yanlış-pozitifini patlatır. Bu sürümde KODLANMADI; tarif olarak yazılır, STATE'e
"impact-adayı toggle TASARIM" düşülür.

### 5.3 toggle: **index==kaynak** uzlaştırma — **TASARIM (pilot-bağlı)**

Graf DB, repo dosya-sisteminin denormalize aynasıdır = ikinci "gerçek" = drift kaynağı. §2.3'ün birebir
kardeşi: "graf DB == repo AST'si; sapma FAIL" kapısı ancak gerçek `cmm` DB şeması + tazeleme mekaniği bir
pilotta ölçülünce kalibre edilebilir; kalibresiz yazmak "kalibre edilmemiş kapı kodu = ihlal". Bu sürümde
KODLANMADI. Fail-open semantiği bunu şimdilik **gereksiz** kılar: graf bayatsa en kötü ihtimalle ipucu
yararsız olur, karar hiç değişmediği için yanlış-güven üretmez — bayatlık FAIL değil, ipucu-kalitesi sorunudur.

**Envanter (ADIM 0'a ek):** AST aracı bağlı mı — üç-kapılı, üçü de gerekli, aksi halde ölü-toggle: (1) env
`ARS_AST_ADAPTER` (proje adı) set mi, (2) CLI çalışıyor mu, (3) proje indekslenmiş mi. Kapı runtime'ı **CLI**
çağırır (`execSync`, senkron, fail-open), **MCP'ye BAĞLANMAZ** (sürekli-server = K8 ihlali). Graf bir kez
ürettirilir, git-watcher KOŞMAZ (skill barındırmaz) → CI'da graf yoksa adaptör sessizce ölü kalır.

---

## 6. Dürüstlük sınırı (ne KOD, ne TASARIM — bu sürümde)

| Bileşen | Durum | Mekanizma |
|---|---|---|
| verify-reçetesi soyutlaması | **tarif** (SKILL FAZ 2) | kurulum ajanı manifest'ten üretir |
| GitHub Actions üreteci | **KOD** | `templates/ci-workflow.template.yml` |
| Azure DevOps / GitLab üreteci | **TASARIM, ertelendi** | reçete elle dökülür + STATE notu |
| Fibery niyet (okuma) | **tarif + adaptör şablonu** | `templates/fibery-adapter.template.md` |
| Fibery rapor (yazma) | **tarif + adaptör şablonu** | reporter deseni, secret-maskeli |
| Fibery senkron + "index==kaynak" kapısı | **TASARIM, pilot-bağlı** | tek-yön ayna; kapı kodu pilotta |
| AST symbol-ikinci-görüş (§5.1) | **KOD (fail-open)** | 3 kapıda `!found` iken CLI ikinci-görüş → soft[] |
| AST CLI çağrısı + JSON-parse | **KOD** (pilotta kalibre — v0.11) | `cli search_graph --project <ad> --name-pattern <sym>`; `results[].file_path` |
| AST impact-adayı (§5.2) + index==kaynak (§5.3) | **TASARIM, pilot-bağlı** | co-update call-graph + uzlaştırma kapısı pilotta |
| Entegrasyon kartı (§7) | **KOD (varlık) + tarif (ölçüm)** | `check-provenance --rule=integration-cards`; prob'u ajan koşar |
| Jev karar yardımcısı (§8) | **KOD (opt-in, fail-open, danışman)** | `scripts/jev-karar.mjs`; kapılara BAĞLANMAZ |

> **Neden bu kadar "tasarım"?** Doctrine "Skill'e eklemek = tarifi gömmek meşru; kalibre edilmemiş kapı
> kodu gömmek ihlal (önce pilot)" (v0.7/v0.8 dersi). DEAK'in tarif/şablon katmanı bugün kurulur; platform-üreteci,
> senkron-kapısı ve AST'nin `cmm`-şemasına-bağlı iç-parse'ı gerçek-repo pilotunda kalibre edilir. Bu sınır
> dürüstçe STATE'e yazılır, "kuruldu" diye satılmaz. AST symbol-ikinci-görüş DALI bugün KOD'dur ama fail-open:
> adaptör bağlı değilse davranış birebir status quo, o yüzden "kalibresiz kapı" riskini taşımaz.

---

## 7. Dış SERVİS yapısı — entegrasyon kartı (v0.27)

> §1-§5 skill'in KENDİ bağlandığı dış sistemlerdi (CI, Fibery, AST). Bu bölüm hedef reponun
> ÜRÜNÜNÜN konuştuğu dış servislerdir (AWS, Stripe, Twilio, OpenAI…). Doktrin: D-33.

**Açık (saha vakası 2026-09-26):** AWS SES iki bölgede kuruluydu — biri sandbox, biri production.
Ajan servisin bölge başına bölündüğünü bilmiyordu, ölçmeden "sandbox'tasın" dedi ve kullanıcı canlı
bilgileri verdiği hâlde ~1 saat ısrar etti. Bilgi eksikliği değil, **yöntem** eksikliğiydi: ne
resmî belge okundu ne de bir salt-okur sorgu koşuldu.

**Kurulum (FAZ 1 envanterinde dış SDK görülürse):**
1. Manifestten dış servis SDK'larını çıkar (`check-provenance --rule=integration-cards` listeyi verir).
2. Her servis için `docs/integrations/<servis>.md` aç — şablon `templates/entegrasyon-karti.template.md`.
3. Kartı ÖLÇEREK doldur: resmî belge (`web-kasif` rolü) → bölünme biçimi → her boyut değeri için
   salt-okur prob → ölçülen tablo. Kurulum ajanının kimlik bilgisi yoksa kartı `[ÇIKARIM]`
   etiketiyle aç ve STATE'e "prob insan tarafından koşulacak" yaz — ölçülmüş gibi doldurma.
4. Kapıyı pre-commit'e UYARI, CI'a `--strict` olarak bağla (`config-flags` deseni).

**Prob örnekleri (salt-okur, hiçbir şey göndermez/yazmaz — komut adları ÖRNEKTİR, D-33 gereği
hedefteki CLI sürümünün belgesinden doğrula):**

| Servis | Boyut | Prob |
|---|---|---|
| AWS SES | bölge · ortam | `aws sesv2 get-account --region <bolge>` → `ProductionAccessEnabled` |
| Stripe | ortam (test/live) · hesap | anahtar öneki (`sk_test_`/`sk_live_`) + `stripe balance retrieve` |
| Twilio | hesap (trial/full) | `twilio api:core:accounts:fetch --sid <sid>` → `type` |

**Kapı ne yapar, ne yapamaz:** SDK'sı olup kartı olmayan paketi ve kartın boş alanlarını bildirir;
`dogrulandi` 90 günden eskiyse NOT düşer (bloke etmez). Kartın DOĞRU olduğunu ve ajanın iddiadan
önce prob koştuğunu göremez — o davranış rol dosyasındaki "Dış sistem kartı [E2]" satırıyla
hakem tarafından denetlenir.

---

## 8. Dış karar yardımcısı — Jev (v0.29, OPSİYONEL, varsayılan KAPALI)

> §1-§5 gibi skill'in KENDİ bağlandığı bir dış sistemdir; farkı, kurulan repoya değil **ajanın iş
> akışına** bağlanmasıdır. Kod: `scripts/jev-karar.mjs` · test: `tests/jev-karar.test.mjs` · karar: K80.

**Ne:** TypeSafe Jev bir "System One" modelidir — metin üretmez; bir duruma tipli sorular (evet/hayır ·
seçim · 0-4 puan) sorulur, olasılıklı cevap döner. Bu repoda iki yerde kullanılır:

| Mod | Ne zaman | Jev neyi PUANLAR | Öneriyi KİM verir |
|---|---|---|---|
| `baslangic` | iş başında (elle ya da UserPromptSubmit hook'u) | kilitli alan · iş türü · zorluk · sürüm/sözleşme/kimlik/bağımlılık/model bayrakları · hafif/tam | script'teki sabit kural tablosu → sınıf (`claude`/`kesif`/`ucuz`/`varsayilan`/`kod`/`guclu`) + "süpervizöre sor" |
| `bitis` | çıkış raporunda (elle) | hata sınıfı (baseline/benim/ortam/flaky/engel/sistem-kurali) · karar defteri gerekir mi | aynı tablo |

**Kırmızı çizgiler (kodda sabit, testle kilitli):**
- **Kapı DEĞİL, danışman.** Hiçbir şeyi bloke etmez; anahtar yok / ağ hatası / 3 sn zaman aşımı / şema
  kayması (beklenen alan sayı/metin değil) → sessiz düşer, çıkış daima 0 (CLI dahil, testle kilitli). `gates/`, `verify.mjs`, pre-commit'e BAĞLANMAZ — kapılar ağsız
  ve deterministik kalır (§6 ilkesi: kalibresiz yargı kapıya gömülmez).
- **Jev model adı SEÇMEZ.** Sınıf adları geneldir; hangi sınıfın hangi modele gittiğini kurulan ortamın
  rehberi söyler. Böylece yasaklı/pahalı bir model sınıflandırıcıdan asla çıkamaz.
- **Kilitli alan tek yönlüdür:** kilit puanı ≥ 0,5 → daima `claude`. "Kilitli değil" demesi işin dış
  modele verilebileceği anlamına GELMEZ.
- **Göndermeden süzgeç:** gizli-değer benzeri metin ve `JEV_ENGEL_YOLLARI`'ndaki yollar Jev'e hiç
  gitmez; özetleri yerel kayda da yazılmaz. Süzgeç kasıtlı olarak kaba ve eksiktir (yanlış-pozitif =
  göndermemek, güvenli taraf) — gizli bilgi savunmasının yerine GEÇMEZ.
- **Veri dışarı çıkar.** Hook modunda 40 karakter ve üstü her mesaj (`/` ile başlayan komutlar hariç) TypeSafe'e gider. Bu, kuran
  kişinin bilinçli tercihidir; müşteri/pilot içeriği olan repolarda `JEV_ENGEL_YOLLARI` ya da `JEV_KAPALI=1`.

**Kurulum (yalnız istenirse):** anahtar `TYPESAFE_API_KEY` (`~/.claude/.env` veya repo `.env.local`) →
elle: `node scripts/jev-karar.mjs baslangic "<iş>"` → otomatik: Claude Code `UserPromptSubmit` hook'u
`node <yol>/jev-karar.mjs --hook` (stdout bağlama tek satır olarak eklenir). Her öneri
`~/.claude/jev-defter/kararlar.jsonl`'e yazılır (`JEV_DEFTER=0` kapatır) — isabeti gerçek işte ölçmenin tek yolu budur.

**Ölçüm [ÖLÇÜLDÜ 2026-10-01, jev-1.13.0; setler repoda DEĞİL — beyan düzeyi] — dürüst etiket:** setler YAZILMIŞ örneklerdir, gerçek iş değil.
Yönlendirme/iş-tipi setini ana ajan, diğerlerini soruları görmeyen ayrı bir ajan yazdı (üçte biri kasıtlı zor).
Araç üzerinden (9 soru tek çağrıda) son koşu:

| Alan | İsabet | Not |
|---|---|---|
| süpervizöre sor | 12/12 | geriye-uyumlu opt-in kapı ≠ sözleşme kırılması ayrımını yakaladı |
| hata sınıfı (6 sınıf) | 14/14 | |
| yönlendirme | 15-16/16 (bir örnek koşudan koşuya değişti) | ilk tasarımda doğrudan "hangi model?" sorusu migration'da güven 0,39 verdi → özellik+tablo tasarımı seçildi (kilit puanı 0,94-0,98 vs ≤0,36) |
| hafif/tam | 12/12 | "süpervizör bayrağı → tam dalga" kuralı eklendikten sonra |
| karar defteri | 11/12 | "sızıntı savunmasına dizin eklemek" yapısal sayılmadı |

**Kurulmayanlar (ölçüm yetmedi):** okur kaydı (puan saatler içinde 0,38→0,52 oynadı; eşik 0,8 gerekir) ·
amaç kayması (en ince örneği kaçırdı; gerçek vaka n=2) · pilot-içerik sızıntısı ve yan-bug (bağlamsız
7/12 ve 8/12; repo bağlamı verilince 11/12 — ama o bağlamın bayatlamaması için mekanizma yok).

**Nasıl ölür:** Jev erken-erişim bir servistir — API/fiyat değişir ya da kapanır. Erken uyarı: kayıtta
`atla: http-4xx` ya da `atla: sema-sapmasi:<alan>` oranının artması. Gizli varsayım: puanlar zamanla kararlı — okur kaydında çürüdü, diğer
alanlarda da oynayabilir; kayıttaki puan dağılımı izlenir.
