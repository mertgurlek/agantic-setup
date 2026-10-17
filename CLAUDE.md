# agentic-repo-setup — Proje Kuralları

Bu dosya kanoniktir. Ajanlar işe başlamadan okur; çelişki durumunda öncelik sırası:
kullanıcı talebi > aktif plan dosyası > bu dosya > aktif karar defteri (bu repoda kökteki
`v0.31-KARAR-DEFTERI.md`; hedef repolarda genelde docs/DECISIONS.md — o yol BU repoda yok,
bu yüzden backtick'siz: doc-truth yalnız backtick'li yolu denetler) >
rol dosyası > diğer dokümanlar. Çatışmada dur ve süpervizöre çıkar.

**Bu repo ne ÜRETİR:** `agentic-repo-setup` — bir repoyu çok-ajanlı AI geliştirmeye hazırlayan
Claude Code **skill'i**. Yani burada yazdığın kod, BAŞKA repolarda koşacak süreçtir.
Kimlik (v0.18.0): **360° repo zekâsı** — kur · kanıtla · güncel tut · yükselt · iyileştir.
Runtime motoru/daemon DEĞİL: bakım komutlarını (`--doctor`/`--upgrade`) İNSAN çağırır,
kendi kendine koşan hiçbir şey yoktur (SKILL.md giriş bloğu, beş-vaat tablosu).

## Üç alan — GÖRÜNÜR sınır (en sık ihlal edilen kural)

| Alan | Konum | Nedir | Pakete girer mi |
|------|-------|-------|-----------------|
| 1 | kök (`SKILL.md`, `gates/`, `templates/`, `reference/`, `scripts/`, `tests/`) | paylaşılabilir generic skill | **EVET** |
| 2 | `pilot-proje/` | pilot angajman: plan/kanıt/devir-paketi/sunumlar | hayır |
| 3 | `pilot-sim/` | çalışan simülasyon (S0/S1/S3) | hayır |

Alan 2/3 İÇERİĞİ (dosya/dizin) köke SIZDIRILMAZ; pilot ADINA kaynak-atfı (provenance) serbesttir
(kelime-yasağı kapısı yanlış-alarma boğulurdu; SB-8-rev). Sızıntı savunması ÇİFT:
`.gitattributes` export-ignore **ve** `scripts/pack-skill.mjs` içindeki `banned[]`. Yeni bir üst-dizin
eklersen ikisini de güncelle — biri eksikse sızıntı sessizdir.

## Çalıştırma & Doğrulama

| Komut | Ne yapar | Ölçülen süre |
|-------|----------|--------------|
| `node verify.mjs` | öz-doğrulama: 11 statik kapı adımı pakete koşar (biri dogfood rehberleri, biri facts-drift) | ~1 sn |
| `npm test` | kapı birim testleri (yalnız `tests/`) | ~48 sn |
| `npm run check` | verify + test (commit öncesi tam kapı) | ~49 sn |
| `npm run health` | entropi taraması (bahçıvan ritüeli — uyarır, bloke ETMEZ); `health:fix` envanter/baseline sayılarını ölçümle yazar | 0,2 sn |
| `npm run facts` | ölçümü koşup `facts.json`'a yazar (türetilebilir değer elle yazılmaz); `facts:check` yazmadan sapmayı raporlar | ~26 sn |
| `npm run pack:skill` | `public/` release bundle üretir (temiz ağaç + verify + test yeşil ŞARTI) | — |
| `npm run release` | **tek dokunuş: en güncel skilli üret + makineye kur + kanıtla** = pack:skill + install:local (~/.claude/skills, eski yedeklenir) + health-check `--strict` | — |
| `npm run hook:install` | git pre-commit shim'ini `.git/hooks/`e kurar (idempotent) | — |

**Baseline manifestosu (failure yeni mi eski mi ayrımı):** `verify.mjs` 11/11 temiz · `npm test`
**<!--fact:test_count-->797<!--/fact--> test yeşil** (0 fail) · `npm run health` TEMİZ (0 uyarı) ·
`gates/` **<!--fact:gate_count-->6<!--/fact--> kategori script'i**
(alt-kural `--rule=` ile seçilir). Bundan sapma = SENİN değişikliğin.
🔴 Bu manifest ölçüm sabitinin YAŞADIĞI TEK YERDİR — rol dosyalarına/README'ye kopyalama
(`check-history --rule=stale-constants` rol dosyalarında bunu zorlar; README'yi `npm run health` denetler).
`examples/acceptance.json` içindeki AC-3 `passes:false` KASITLI (acceptance kapısının negatif deneği).

## Bu repoda "merkezi altyapı" — YENİDEN YAZMA

| İş | Kullan | Konum |
|----|--------|-------|
| Kapı CLI sözleşmesi (argüman/çıkış kodu) | `CONTRACT.md` | kök |
| Öz-doğrulama koşucusu | `verify.mjs` `steps[]` | kök |
| Kurulum-sonrası hedef sınavı | `scripts/install-exam.mjs` | `verify.mjs --install-exam` |
| Paketin kendi pre-commit'i | `scripts/self-pre-commit.mjs` | `.git/hooks/pre-commit` shim'i çağırır |
| Entropi dedektörü | `scripts/health-check.mjs` | `npm run health` |
| Release paketleyici + sızıntı yasağı | `scripts/pack-skill.mjs` (`banned[]`) | `public/` |
| Sunum/aktarım anlatım disiplini | `reference/anlatim-disiplini.md` + `.claude/agents/sunum-yazari.md` | devir/rapor/sunum üretirken |

## Yerleşim kuralları (yeni kod nereye)

- **Yeni kapı** → `gates/check-*.mjs` (TEK kanonik konum; `gates/lib/` paylaşılan yardımcı
  modüldür, kapı DEĞİLDİR, ikinci kapı dizini sayılmaz) + `CONTRACT.md`'ye satır + `tests/`e birim
  test (içinde en az bir kirli-girdi → sıfır-olmayan-çıkış beklentisi) + bir koşucuya bağlılık
  (`verify.mjs`/`self-pre-commit.mjs`/`.claude/settings.json`) YA DA CONTRACT satırında "(hedef repo)"
  muafiyeti + her alt-kural için CONTRACT "Alt-kural sınıf beyanı" satırı. **Bu beşi olmadan kapı
  ORPHAN'dır** (kurulu ama koşmaz) —
  `gates/check-self-registry.mjs --rule=orphan-gates` zorlar; ayrıntı `CONTRACT.md` "Kapı kayıt tablosu" başlığında.
- **Yeni şablon** → `templates/*.template.md|yaml|yml`. Şablonlar doldurulmamış alan taşır ve
  `check-hygiene --rule=placeholders` taramasından `\.template\.md$` ile MUAFTIR — muafiyete güvenip gerçek
  rehberde doldurulmamış alan bırakma.
- **Ağır gerekçe/anlatı** → `reference/*.md` (SKILL.md'ye DEĞİL; SKILL.md tavanı ~300 satır).
- **Kararlar** → aktif defter = kökteki EN GÜNCEL `vX.Y-KARAR-DEFTERI.md` (bugün
  `v0.31-KARAR-DEFTERI.md`); eskiler `archive/`. Sürüm bump'ında yeni defter AÇILIR (D-A ③) —
  bu satırdaki adı da güncelle, yoksa bayatlar.
  Yeni defter İKİ yere kaydedilir: `scripts/self-pre-commit.mjs` `KARAR_DEFTERLERI` **ve**
  `.claude/settings.json` `APPEND_ONLY_EXTRA` — biri eksikse append-only kapısı defteri KORUMAZ.

## Okuma protokolü (token disiplini)

- ASLA tam okuma: `public/*.zip|*.skill` (binary), `pilot-proje/kanit/*.pdf`,
  `pilot-proje/sunumlar/*.html` (68-76 KB) — büyük ve karar taşımaz.
- `pilot-proje/` ve `pilot-sim/` altını generic skill işi yaparken AÇMA (alan sınırı + context).
- Önce grep, sonra dosya aç. Kapı davranışını öğrenmek için önce `tests/`teki ilgili testi oku —
  niyeti en ucuz oradan anlarsın.
- Uzun keşif sonrası ham geçmişi taşıma: focus summary yaz. Detay: `docs/CONTEXT_BUDGET.md`.
- Sıkıştırılamaz taahhütler DÜŞMEZ: kullanıcı kararı · kabul kriteri · baseline · secret/prod riski ·
  aktif kilitler.

## Süreç kuralları

- 🔴 **Okur kaydı — yazmadan ÖNCE seç:** jargon seviyesi kullanıcının değil ÇIKTININ özelliği.
  kod·diff·kapı·şema → **teknik** · plan·rapor·özet·açıklama → **sade** (terim ya yok ya ilk
  geçişte tek cümle tanım; önce sonuç, sonra ayrıntı). "Teknik anlat" override YALNIZ o iş için.
  Ölçüm (2026-08-27): 13 vakada seviye çıktıdan SONRA düzeltildi, hepsi sadeleştirme talebiydi.
  **Kapı DEĞİL** — "çok teknik" E2'dir (kelime-listesi bu repoda 19/19 yanlış-alarm verdi).
- **İş tipini ÖNCE belirle:** tek dosya + davranış değişmez + baseline'da iz yok → **hafif mod**
  (tek ajan + `npm run check` + kısa rapor). Kapı davranışı / CLI sözleşmesi / SKILL.md kimliği /
  sürüm işi → **tam dalga** (kâşif → plan → onay → uygulama → hakem). Belirsizse tam dalga.
- **D-A sürüm boru hattı (ZORUNLU sıra — kaynak `reference/surum-ve-karar-disiplini.md`):**
  ① değiştir → ② SemVer'i ÜÇ yerde birden bump et (`package.json` ≡ `SKILL.md` başlığı ≡ `public/`
  bundle adı) → ③ karar defterine girdi → ④ commit → ⑤ **`npm run release`** (= pack:skill +
  makineye kurulum + health `--strict`; kurulu skill kaynaktan eskiyse `kurulu-skill-bayat` release'i bloke eder; ④-⑤'i tek komutta kanıtlar). Repo bir kez kaynak 0.10.0-alpha iken bundle
  v0.9.0'da dondu — bu boru hattı onun panzehiri. **Sürüm bump etmeden içerik eklersen** etiket aynı
  kalır ama bundle bayatlar → health-check `bundle-icerik-bayat` (etiket değil, HEAD-tazeliği) yakalar.
  `gates_contract_version` AYRI eksen: geriye-uyumlu opt-in kapı eklemek onu ARTIRMAZ.
- **D-B karar = doküman:** her yapısal karar append-only deftere sabit şablonla
  (`karar · neden · alternatifler · sonuç/etki · geri-alınabilir mi · **nasıl ölür** · tarih`;
  nasıl-ölür = en olası ölüm + gizli varsayım + **gözlenebilir erken uyarı sinyali**). Defterler
  append-only kapısıyla KORUNUR (hem pre-commit hem PreToolUse hook'unda) — eski satırı düzenleme,
  altına "revize edildi" girdisi ekle.
- **Sahiplik kilitleri** (dalga başına tek ajan dokunur): `CONTRACT.md` · `verify.mjs` ·
  `package.json` sürümü · `scripts/pack-skill.mjs`.
- **Çıkış raporu** (her iş sonu): değişen dosyalar + koşulan komutlar + failure sınıfı
  (baseline/benim/ortam/flaky/engel/**sistem-kuralı**) + atlanan kontroller.
  "sistem-kuralı" = sistemin KENDİ kuralının yarattığı sürtünme → `docs/FRICTION_LOG.md`.
- **Süpervizöre çıkar:** sürüm bump · `CONTRACT.md`'de geriye-uyumsuz değişiklik · SKILL.md
  kimliğini genişletme ("runtime motoru kurma" reddi) · yeni bağımlılık · model/effort değişikliği.
- **Yan-bug:** iş sırasında görülen plan-dışı kusuru sessizce DÜZELTME → `docs/SIDE-BUGS-LOG.md`'ye
  satır, ya da aynı dosya+yüksek güven+küçük düzeltme ise süpervizöre SOR.
- **Bilimsel çalışma disiplini (v0.13):** dalkavukluk yasak — iddia sahibine bakılmaksızın
  (kullanıcı dahil) kanıtla sınanır; kanıt aksini gösteriyorsa açık söyle, emin değilsen
  "bilmiyorum" de · sürüm-gerçeği: local güncel olmayabilir, hedef sürümü ÖLÇ (hafızadan
  sürüm yazma; dış servisin bölge/ortam YAPISI da ölçülür — D-33) · **türetilmiş katman**
  (özet/registry/mevcut doküman) KANIT DEĞİLDİR — kanıt kaynak VE çağırdığı bir seviye alttır ("gövdesinde yok" ≠ "yapmıyor") · **ölçüm talimatı
  yener**: ölçüm brif/plan/üst-katman dokümanıyla çelişirse ölçüm kazanır, çelişkiyi RAPORLA ·
  çok-repo/uzun iş bacak sonunda devir dosyası doldurur
  (`templates/devir.template.md`). Gerekçe: `reference/doctrine.md`; zorlayan (VARLIK):
  `gates/check-self-registry.mjs --rule=rule-contracts`.

## Meta-kurallar

- Global kural SADECE bu dosyada; rol dosyaları bunun DELTASIDIR, tekrar etmez.
- Satır tavanları: bu dosya ≤150 · SKILL.md ~300 · rol dosyası ~40. `check-hygiene --rule=file-size`
  rehberlerde (rol dosyaları dahil) 150'de UYARI, 300'de FAIL verir; 40 hedefinin kapısı yok —
  aşımı hakem sorar. Ağır içerik `reference/`e.
- **Dogfood yasası:** bu paket kendi doktrinine tabidir. Bir kural yazıyorsan, onu bu repoda
  zorlayan mekanizmayı da göster (kapı/hook/CI/test) — yoksa yazma. "Mekanizması olmayan kural
  gürültüdür" burada da geçerli, özellikle burada.
- Elle changelog yok (git + karar defteri yeterli). Anlık durum → `docs/STATE.md`.
