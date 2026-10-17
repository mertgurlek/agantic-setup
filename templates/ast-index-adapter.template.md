<!--
ÜRETİM TALİMATI (v0.10 — DEAK AST-indeks adaptörü): Bu, bir AST-indeks aracının (ör.
codebase-memory-mcp, `cmm` CLI: tree-sitter → SQLite bilgi grafiği) kapı-besleme KONFİGÜRASYON
iskeletidir. Kurulum ajanı YALNIZ üç-kapılı envanter yeşilse VE kullanıcı toggle'ı AÇTIYSA üretir
(kullanmayan ödemez): (1) env ARS_AST_ADAPTER set, (2) `cmm` CLI PATH'te, (3) graf DB diskte.
Herhangi biri yoksa bu dosya ÜRETİLMEZ (ölü soru). Hedef konum: docs/integrations/ast-index.md.
Toggle'lar BAĞIMSIZ: kapalı bölümü SİL (yorum bırakma).
İLKE (K8): skill HAZIRLAR, BARINDIRMAZ — graf bir kez ürettirilir, git-watcher KOŞMAZ; kapı salt-okur.
DEĞİŞMEZ SINIR: graf hiçbir kapıda doğruluğun KAYNAĞI değildir; yalnız `!found` iken ikinci-görüş.
Detay/gerekçe: reference/external-integrations.md §5.
-->

# Kod-Grafiği Entegrasyonu (DEAK — AST-indeks adaptörü)

**Araç:** {{AST_ARAC_ADI}}  ·  **CLI:** {{CLI_ADI}} (statik binary, senkron)  ·  **Graf DB:** {{GRAF_DB_YOLU}}

> Açık toggle'lar: {{ACIK_TOGGLELAR}}. Kapalı toggle = bu repoda kurulmadı (no-op → status quo).
> **Fail-open:** araç bağlı değilse/hata verirse kapı bugünkü `.includes()` davranışına düşer — yanlış-geçiş DEĞİL.

<!-- ===== [toggle: symbol-ikinci-görüş] — OKUMA (en güvenli, KOD v0.10) ===== -->
## Symbol ikinci-görüş (okuma)

Kapı bir `[T]` doküman anchor'ının symbol'ünü doğrularken (`readFileSync().includes(symbolName)`)
`found=false` bulursa, graf'a "ikinci görüş" sorulur. Verdict DEĞİŞMEZ — yalnız mesaj zenginleşir:
- **Çağıran kapılar:** `check-doc-integrity --rule=doc-truth` `resolveRepoSymbol`, `check-doc-integrity --rule=integrity` `resolveAnchor`,
  install-exam `checkAnchorResolution` (bu sonuncusu hedef repoya `cwd:TARGET` ile bakar).
- **Çağrı mekaniği:** `{{CLI_ADI}} cli search_graph --project {{PROJE_ADI}} --name-pattern <symbol> --limit 5`
  (`execSync`, senkron, `maxBuffer`+`timeout`, try/catch fail-open). Yanıt: `{"total":N,"results":[{"file_path":…}]}`;
  stdout'ta log satırları olabilir → ilk parse-edilebilir `{`-satırı alınır. Env: `ARS_AST_ADAPTER`=proje adı.
- **Sonuç:** `available && graf-görmüyor` → "(AST de görmüyor — muhtemelen gerçekten ölü)"; `graf-görüyor` →
  "(AST '{{ORNEK_DOSYA}}'de görüyor — anchor yolu yanlış olabilir)". Bulgu `soft[]`'a gider (UYARI; `--strict`
  bloke), `dead[]`'e ASLA — "yeni-kapı yanlış-alarm öldürür".
- **Sınır:** graf `found`'u false→true çeviremez. Nihai doğruluk repo dosya-sisteminden gelir.

<!-- ===== [toggle: impact-adayı] — co-update (TASARIM, pilot-bağlı) ===== -->
## Impact-adayı (co-update besleme) — TASARIM

`check-history --rule=co-update` bugün path/pattern-tabanlıdır (symbol farkındalığı yok). Tasarım: değişen sembolden
`{{CLI_ADI}} trace-path` ile çağıranları izle → hangi `[T]` dokümanının yeniden doğrulanması gerektiğini
ADAY üret. **KODLANMADI** (doctrine "önce pilot": kalibresiz call-graph co-update'in doğal FP'sini patlatır).
Toggle açıksa yalnız tarif kurulur; STATE'e "impact-adayı TASARIM, elle denetlenir" yazılır.

<!-- ===== [toggle: index==kaynak] — uzlaştırma (TASARIM, pilot-bağlı) ===== -->
## index==kaynak uzlaştırma — TASARIM

Graf DB = repo dosya-sisteminin denormalize aynası = ikinci "gerçek" (drift kaynağı, reference/doctrine.md).
Uzlaştırma kapısı ("graf DB == repo AST'si; sapma FAIL") gerçek `{{CLI_ADI}}` DB şeması + tazeleme mekaniği
bir pilotta ölçülünce kalibre edilir. **KODLANMADI.** Fail-open semantiği bunu şimdilik gereksiz kılar: graf
bayatsa en kötü ihtimalle ipucu yararsız olur, karar hiç değişmediği için yanlış-güven üretmez.

---
**STATE notu (zorunlu):** kurulan toggle'lar + `{{CLI_ADI}}` yolu/sürümü + graf DB yolu + KODLANMAYAN tasarım
parçaları (impact-adayı, index==kaynak, `cmm`-şemasına-bağlı iç-parse) açıkça STATE.md'ye yazılır — "kuruldu"
diye satılmaz (DEAK dürüstlük sınırı). git-watcher'ın KAPALI olduğu da not edilir (K8: skill barındırmaz).
