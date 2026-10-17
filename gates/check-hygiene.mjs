#!/usr/bin/env node
// Hygiene kategori kapısı. Alt-kurallar: aşağıdaki RULES[]; sözleşme: CONTRACT.md "Kapı kayıt tablosu".
// ORTAK EKSEN: statik tarama, `verify.mjs` `steps[]`'te 4/4 aktif — her biri git-tracked/staged
// dosya kümesini deterministik regex/decode ile tarar (LLM yok, E0).
//
//
// Kullanım:
//   node check-hygiene.mjs                          → argümansız: RULES[]'teki TÜM alt-kurallar koşar
//   node check-hygiene.mjs --rule=utf8 [dosya...]
//   node check-hygiene.mjs --rule=secrets [--all] [--include-tests] [dosya...]
//   node check-hygiene.mjs --rule=placeholders [dosya...]
//   node check-hygiene.mjs --rule=file-size [dosya...]
//   node check-hygiene.mjs --rule=report-schema [dosya...]
//   node check-hygiene.mjs --rule=message-clarity [--strict] [dosya...]
//   node check-hygiene.mjs --rule=surface-residue [dosya...]
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const RULES = ['utf8', 'secrets', 'placeholders', 'file-size', 'report-schema', 'message-clarity', 'surface-residue'];

// =====================================================================================
// RULE: utf8
// =====================================================================================
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|scss|html|yml|yaml|prisma|sql|txt|svg|py|go|rs|java|cs|rb|php|toml|ini|sh|ps1|dart|tf|tfvars|hcl|kt|kts|fs|xaml|csx|props|targets|gradle|csproj|fsproj|vbproj|vb|sln|resx)$/i;
// B9b (saha: pilot-backend — binlerce .cs dosyasının kabaca yarısı BOM'lu, yarısı BOM'suz; .NET
// ailesinde BOM ne hata ne kural). BOM yalnız bu uzantılarda KABUL; diğerlerinde FAIL sürer.
// Geçersiz UTF-8 her yerde FAIL — BOM'lu dosyada da gövde ayrıca çözümlenir (kabul bozulmayı gizlemez).
const DOTNET_BOM_OK = /\.(cs|csproj|sln|props|targets|vb|fs|fsproj|vbproj|resx)$/i;

function runUtf8(argv) {
  const allowEmpty = argv.includes('--allow-empty');
  const args = argv.filter(a => !a.startsWith('-'));
  const files = args.length
    ? args
    : execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
        .toString('utf8').split('\n').filter(Boolean);

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const bad = [];
  let scanned = 0, bomOk = 0;

  for (const f of files) {
    if (!TEXT_EXT.test(f)) continue;
    let buf;
    try { buf = readFileSync(f); } catch { continue; }
    scanned++;
    const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
    if (hasBom) {
      if (DOTNET_BOM_OK.test(f)) bomOk++;
      else { bad.push(`${f}  →  BOM var (UTF-8 without BOM olmali; yalniz .NET ailesinde kabul)`); continue; }
    }
    try { decoder.decode(hasBom ? buf.subarray(3) : buf); }
    catch { bad.push(`${f}  →  gecersiz UTF-8 dizisi`); }
  }

  if (bad.length) {
    console.error(`\nUTF-8 KAPISI FAIL (${bad.length} dosya):\n` + bad.map(b => '  ' + b).join('\n'));
    console.error('\nDuzeltme: dosyayi UTF-8 (BOM\'suz) olarak yeniden kaydet.\n');
    return 1;
  }

  // Boş-küme körlüğü (v0.18.2, pilot bulgusu A): AUTO-DISCOVERY (argümansız, `git ls-files`) modunda
  // 0 dosya ŞÜPHELİDİR — liste üretimi (ls-files/filtre) boşa dönmüş olabilir. Açık argüman
  // verildiğinde (args.length>0) çağıran zaten hedefi BİLEREK daralttı — uzantı filtresiyle 0'a
  // düşmesi (ör. tek bir .png verilmesi) "hiç bakmadım" değil "bilinçli hedef, taramaya uygun
  // değil" demektir; bu yola dokunmak mevcut baseline testini (v0.8) kırardı.
  if (!args.length && scanned === 0 && !allowEmpty) {
    console.error('\nUTF-8 KAPISI FAIL — taranan dosya sayısı 0.');
    console.error('  "temiz" ile "hiç bakmadım" farklıdır: verilen/bulunan dosya listesi boş kaldı.');
    console.error('  Liste nasıl üretildiyse orayı kontrol et (git ls-files filtresi, argüman, uzantı filtresi).');
    console.error('  Bilinçli boş küme ise --allow-empty ile geçirilebilir.\n');
    return 1;
  }
  if (bomOk) console.log(`UTF-8: ${bomOk} .NET dosyasinda BOM var — kabul edildi.`);
  console.log(`UTF-8 kapisi OK — ${scanned} dosya tarandi.${scanned === 0 ? ' (--allow-empty: boş küme bilinçli)' : ''} [taranan=${scanned}]`);
  return 0;
}

// =====================================================================================
// RULE: secrets
// =====================================================================================
const HIGH_ALWAYS = [
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/-----BEGIN[ A-Z]*PRIVATE KEY-----/, 'Ozel anahtar (private key)'],
  [/\bghp_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/\bgho_[A-Za-z0-9]{30,}/, 'GitHub OAuth token'],
];
const HIGH_NORMAL = [
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'API anahtari (sk-...)'],
  [/\bsk_(live|test)_[A-Za-z0-9]{16,}/, 'Stripe anahtari (sk_live/test_)'],
  [/\b(pk_live|rk_live)_[A-Za-z0-9]{16,}/, 'Stripe canli anahtar (pk/rk_live_)'],
  [/\bAIza[A-Za-z0-9_-]{30,}/, 'Google API anahtari'],
  [/\bre_[A-Za-z0-9]{20,}/, 'Resend anahtari'],
  [/\bwhsec_[A-Za-z0-9]{20,}/, 'Webhook secret'],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'JWT token'],
  [/postgres(ql)?:\/\/[^\s'"`]+:[^\s'"`@]{4,}@/i, 'DB baglanti dizesi (sifre)'],
  [/mongodb(\+srv)?:\/\/[^\s'"`]+:[^\s'"`@]{4,}@/i, 'MongoDB baglanti dizesi (sifre)'],
  // `["']?` anahtardan sonra: JSON/tırnaklı anahtar (`"password": "Gizli123!"`) da yakalanır (v0.30.4 hakem — HEAD'de kördü).
  [/\b(?:password|pwd)["']?\s*([=:])\s*(["']?)([^;"'\s]{6,})/i, 'Sifre atamasi (password=)'],
  [/\bAccountKey\s*=\s*([A-Za-z0-9+/=]{20,})/, 'Azure storage AccountKey'],
  [/\bSharedAccessKey\s*=\s*([A-Za-z0-9+/=]{20,})/, 'Azure SAS SharedAccessKey'],
];
const ASSIGN = [
  [/\b(JWT_SECRET|NEXTAUTH_SECRET|SECRET_KEY|API_SECRET|CRON_SECRET|AUTH_SECRET|(?:DB|DATABASE)_PASSWORD|ENCRYPTION_KEY)\b`?\s*[=:|]\s*[`"']?([A-Za-z0-9!@#$%^&*_+.\/-]{10,})/i, 'Secret atamasi'],
  [/"(JwtSecret|Secret|ApiKey|Api_?Key|ClientSecret|AccessKey|PrivateKey|EncryptionKey|ConnectionString)"\s*:\s*"([^"]{12,})"/i, 'Config JSON gizli alani'],
];

const VALUE_PH = /(xxx+|\.\.\.|\byour[-_ ][\w-]*?(key|secret|token|password|pass|pwd|db|connection)\b|your[-_ ]?(api[-_ ]?)?(key|secret|token|password|pass|pwd|db|connection)|[-_ ]?here\b|here[-_ ]?$|\bchange[-_ ]?(me|this|it)\b|placeholder|example|sample|dummy|redacted|replace[-_ ]?me|test[-_ ]?secret|dev[-_ ]?secret|random[- ]?string|min-\d+|s(ı|i)f(ı|i)rla|degistir|<[^>]{1,40}>)/i;
// B6 (saha: saha-C 29 FP TS tipi; saha-E `password: string;`; saha-F minified `password:!0`):
// `password: string` / `password?: string` / `readonly password: string | null` / `password: boolean` /
// `password:!0` bir TİP ya da boolean-literal'dir, sır değil. Gerçek atama (`password: "x..."`,
// `password = 'x...'`, `PASSWORD=abc123`) hâlâ yakalanır: yalnız değer tamamen tip sözcüğü /
// boolean literal ise susar; arkasından `= "değer"` geliyorsa (`password: string = "x"`) susmaz.
const TYPE_WORD = /^(string|number|boolean|bool|any|unknown|undefined|null|void|never|object|true|false|String|Number|Boolean)$/;
function isTypeOrBoolLiteral(value, rest) {
  if (/^\s*=\s*["'`]?[^\s"'`]{4,}/.test(rest)) return false;   // `password: string = "gercek"` — atama var
  if (/^![01](?=[,;})\]\s]|$)/.test(value)) return true;           // minified boolean TAM değer: yalnız `!0` / `!1` (çıplak 0/1 ve `1!Secr3t` muaf DEĞİL)
  // v0.30.5 (saha-C): imza kuyruğu da soyulur — `(password: string): Promise<string> {` değeri `string):` olarak yakalanır.
  const parts = value.replace(/(\[\])+(?=[,;)}>:{]*$)/, '').replace(/[,;)}>:{]+$/, '').split(/[|&]/).filter(Boolean);
  return parts.length > 0 && parts.every(p => TYPE_WORD.test(p));
}
// v0.30.4 (saha: saha-C 20 FP — `password: user.password`, `password: hashed`): TS/JS KAYNAĞINDA `:` ayırıcılı, TIRNAKSIZ
// ve geçerli JS tanımlayıcı/özellik zinciri olan değer bir NESNE ALANI/ATIF'tır, gömülü sabit değil. Yakalanmaya DEVAM eder:
// tırnaklı string, `=` ataması, .env/.json/.yml/.py vb. (TS_SRC dışı), tanımlayıcı olmayan değer (`1!Secr3tPass`).
const TS_SRC = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const JS_IDENT_CHAIN = /^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*$/;
function isTsRefForm(file, sep, quote, value, rest) {
  if (/^\s*=/.test(rest)) return false;   // `password: hashed = "gercek"` — arkasında atama var
  if (!TS_SRC.test(file) || sep !== ':' || quote) return false;
  const bare = value.replace(/[,;)}\]]+$/, '');
  if (!JS_IDENT_CHAIN.test(bare)) return false;
  // Hakem düzeltmesi: değeri izleyen ifade parçasında (ilk , ; } ) ya da satır sonuna kadar) >=6 karakterlik TIRNAKLI string
  // varsa (`x || "gizli123"`, `a ?? "..."`, `v + "..."`) bu bir fallback/birleştirmedir → gerçek parola taşıyabilir, muafiyet YOK.
  const tail = bare === value ? rest.split(/[,;})]/)[0] : '';
  return !/(["'`])[^"'`]{6,}\1/.test(tail);
}
// v0.30.4 hakem turu 2: tırnaklı-anahtar desteği (`"password": "..."`, JSON açığı) dil dosyalarında yeni FP sınıfı açtı —
// `{ "password": "Password" }`, `{ "password": "Parola giriniz" }` bir ARAYÜZ ETİKETİdir. Dil/çeviri dosyası yolu ya da
// değerin kendisi anahtar sözcük (password/parola/şifre...) ise sır sayılmaz. Gerçek değer (`"Gizli123!"`) dil dosyası
// dışındaki JSON'da yakalanmaya DEVAM eder.
const LOCALE_FILE = /(^|\/)(locales?|i18n|langs?|translations?|messages)\/|(^|\/)[a-z]{2}(-[A-Za-z]{2})?\.json$/i;
const LABEL_WORD = /^(password|passwd|pass|pwd|parola|şifre|sifre|kennwort|contraseña|mot de passe)$/i;
function isLocaleLabel(file, value) {
  if (LOCALE_FILE.test(file)) return true;
  return LABEL_WORD.test((value || '').replace(/["'`,;)}\]]+$/, ''));
}
// v0.30.5 (saha-C): TIRNAKSIZ değer bir şema/ortam KAYNAĞIYLA başlıyorsa (z.string().min(8, 'mesaj'), process.env.X) çağrı
// argümanındaki tırnaklı mesaj sır değildir. `||`/`??` ile gelen tırnaklı SABİT (fallback) muafiyeti bozar → yakalanmaya devam.
const SCHEMA_SRC_START = /^(z\.|yup\.|Joi\.|process\.env\b|import\.meta\.env\b)/;
function isSchemaOrEnvSource(quote, value, rest) {
  if (quote || !SCHEMA_SRC_START.test(value)) return false;
  return !/(\|\||\?\?)\s*(["'`])[^"'`]{6,}\2/.test(rest);
}
const SOURCE_PH =/(process\.env|import\.meta|env\(|getenv|z\.string|USER:PASSWORD|user:pass(?:word)?@)/i;

const SKIP_FILE = /(^|\/)(\.env\.example|.*\.lock|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|check-secrets\.mjs|check-hygiene\.mjs|install-exam\.mjs)$|\.(png|jpe?g|webp|gif|ico|woff2?|ttf|pdf|zip|map)$/i;
const TEXTISH = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|toml|env|txt|sh|ps1|prisma|sql|html|cfg|ini|py|go|rs|java|cs|rb|php|dart|tf|tfvars|hcl|kt|kts|fs|xaml|config|properties)$|(^|\/)\.env[^/]*$|(^|\/)appsettings[^/]*\.json$/i;
const TEST_PATH = /(^|\/)(tests?|__tests__|__mocks__|fixtures|\.storybook)\//i;

function runSecrets(argv) {
  const all = argv.includes('--all');
  const allowEmpty = argv.includes('--allow-empty');
  const includeTests = argv.includes('--include-tests');
  const args = argv.filter(a => !a.startsWith('-'));
  const staged = !all && !args.length;
  const cmd = all ? 'git ls-files' : 'git diff --cached --name-only --diff-filter=ACM';
  const files = args.length
    ? args
    : execSync(cmd, { maxBuffer: 64 * 1024 * 1024 }).toString('utf8').split('\n').filter(Boolean);

  function read(f) {
    if (staged && /^[\w./@-]+$/.test(f)) {
      try { return execSync(`git show :${f}`, { maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] }).toString('utf8'); }
      catch { /* yeni/silinmis/binary: diske düş */ }
    }
    try { return readFileSync(f, 'utf8'); } catch { return null; }
  }

  // Ana ajan ölçtü (2026-08-06, placeholders'ta bulunan aynı sınıf hata): `files.length` NİYET
  // EDİLENİ sayar, GERÇEKTEN İŞLENENİ değil — SKIP_FILE/!TEXTISH/text==null ile atlanan dosyalar
  // hâlâ sayılıyordu. `scanned` yalnız GERÇEKTEN okunup satır-satır taranan dosyada artar.
  // `missing` yalnız EXPLICIT argüman modunda anlamlıdır (git ls-files/diff zaten var-olan dosya
  // döndürür) — argümanla verilip diskte olmayan dosya ŞÜPHELİDİR, sessizce yutulmaz.
  const hits = [];
  const missing = [];
  let scanned = 0;
  for (const f of files) {
    if (SKIP_FILE.test(f) || !TEXTISH.test(f)) continue;
    const isTest = TEST_PATH.test(f) && !includeTests;
    const patterns = isTest ? HIGH_ALWAYS : [...HIGH_ALWAYS, ...HIGH_NORMAL, ...ASSIGN];
    const text = read(f);
    if (text == null) { if (args.length) missing.push(f); continue; }
    scanned++;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const [re, label] of patterns) {
        // matchAll: satırdaki İKİNCİ eşleşme de denenir (`{ password: u.password, admin: { password: "Gercek1" } }`).
        // Desen başına satırda en çok BİR bulgu raporlanır (sayım davranışı korunur).
        const gre = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
        for (const m of line.matchAll(gre)) {
          const val = (m[m.length - 1] && /^[A-Za-z0-9]/.test(m[m.length - 1])) ? m[m.length - 1] : m[0];
          if (VALUE_PH.test(m[0]) || VALUE_PH.test(val)) continue;
          if (label === 'Secret atamasi' && SOURCE_PH.test(line)) continue;
          const rest = line.slice(m.index + m[0].length);
          if (label === 'Sifre atamasi (password=)' && (isTypeOrBoolLiteral(m[3], rest) || isTsRefForm(f, m[1], m[2], m[3], rest) || isLocaleLabel(f, m[3]) || isSchemaOrEnvSource(m[2], m[3], rest))) continue;
          const masked = m[0].slice(0, 8) + '…(' + m[0].length + ' kr)';
          hits.push(`${f}:${i + 1}  →  ${label}  [${masked}]`);
          break;
        }
      }
    }
  }

  if (hits.length) {
    console.error(`\nSECRET KAPISI FAIL (${hits.length} bulgu):\n` + hits.map(h => '  ' + h).join('\n'));
    console.error('\nYapilacak: degeri env degiskenine tasi; deger gercekse ROTASYONA SOK (commit edilmis secret yanmis sayilir, dosyadan silmek yetmez — git gecmisinde durur).\n');
    return 1;
  }

  if (missing.length) {
    console.error(`\nSECRET KAPISI FAIL — ${missing.length} verilen dosya diskte/index'te YOK:\n` +
      missing.map(f => `  ${f}`).join('\n'));
    console.error('\n  "temiz" ile "hiç bakmadım" farklıdır: argümanla verilen dosya okunamadıysa kayıptır.\n');
    return 1;
  }

  // Boş-küme körlüğü (v0.18.2, pilot bulgusu A): staged-diff modu (varsayılan) 0 DOĞALDIR (commit
  // dışında staged dosya yoktur) — FP olmasın diye buraya DOKUNULMAZ. `--all` (git ls-files tabanlı)
  // ise ŞÜPHELİ sınıf: 0 dosya "temiz" değil "hiç bakmadım" demektir. GERÇEK sayaç (scanned) kullanılır.
  if (all && scanned === 0 && !allowEmpty) {
    console.error('\nSECRET KAPISI FAIL — taranan dosya sayısı 0 (--all).');
    console.error('  "temiz" ile "hiç bakmadım" farklıdır: git ls-files listesi boş kaldı.');
    console.error('  Liste nasıl üretildiyse orayı kontrol et.');
    console.error('  Bilinçli boş küme ise --allow-empty ile geçirilebilir.\n');
    return 1;
  }
  console.log(`Secret kapisi OK — ${scanned} dosya tarandi${staged ? ' (index içeriği)' : ''}.${all && scanned === 0 ? ' (--allow-empty: boş küme bilinçli)' : ''}${all ? ` [taranan=${scanned}]` : ''}`);
  return 0;
}

// =====================================================================================
// =====================================================================================
// RULE: surface-residue (v0.23.0, K55 ①) — KALICI belgeye SÜREÇ ARTIĞI yazılmasını engeller.
//
// ÖLÇÜM (2026-08-27, 137 oturum / 2457 insan turn'ü, iki bağımsız model + grep doğrulaması):
// 158 doğrulanmış vaka. 🔴 REPLAY ÖLÇÜMÜ (K62): bu dört imza o 158'in yalnız **29'unu** (%18)
// yakalar — kalan 129 serbest nesir/süreç anlatısıdır. Aday imzalar (dış-model atfı, "hakem turu",
// "N-model konsensüs") DENENDİ ve REDDEDİLDİ: çekirdekte 19 isabetin HEPSİ yanlış-alarmdı
// (bu repoda o kelimeler artık değil, KONUdur). Kapı %18'i kapar — kalanı E2'dir.
// Kalıcı belgeye "önceki YANLIŞTI", "~~eski~~ → yeni", "GÜNCELLEME <tarih>"
// gibi SÜREÇ anlatısı yazılmış. Medyan gecikme 0 turn (insan anında düzeltiyor → turn maliyeti
// düşük) AMA %27'si DIŞ yüzeyde (müşteri sunumu, son-kullanıcı belgesi, teslim raporu) — orada
// bedeli yazan değil, OKUYAN öder. Ortak imza: belge "ne doğru" demek yerine "nasıl düzelttim" anlatıyor.
//
// SINIF: auto-discovery (git ls-files tabanlı, açık liste) → 0 dosya ŞÜPHELİDİR, boş-küme körlüğü
// koruması `scanned` sayacıyla zorunlu (placeholders deseni BİREBİR kopyalandı).
//
// MUAFİYET ÖLÇÜLEREK kalibre edildi (kapı "iki kontrolle doğar": yakalama + GEÇİRME):
//   ① Tarihsel kayıt dosyaları — orada süreç artığı İÇERİKTİR, kusur değil:
//      karar defteri · changelog · SIDE-BUGS · FRICTION · GARDEN · *-LOG · devir
//   ② archive/ + pilot alanları (pilot-proje/, pilot-sim/, */arsiv/) — dondurulmuş tarih.
//      Ölçüm: muafiyet olmadan 11 isabetin 10'u buradan geliyordu (hepsi yanlış-alarm).
//   ③ "yol haritası / sürüm notu" bölümleri — kapanan maddeyi ÜSTÜ ÇİZİLİ göstermek o bölümün
//      İŞLEVİDİR. Ölçüm: çekirdekteki TEK kalan isabet (README.md:294) tam olarak buydu.
// Muafiyetsiz naif regex bu repoda %100 yanlış-alarm üretiyordu — kapı kapatılırdı (altın kural ②b).
// =====================================================================================
const RESIDUE_SIGS = [
  ['üstü-çizili düzeltme', /~~[^~\n]{3,}~~/],
  // 🔴 TÜRKÇE KATLAMA TUZAĞI (testte yakalandı): JS `/i` Türkçe'ye göre katlamaz —
  // 'YANLIŞTI'.toLowerCase() === 'yanlişti' (noktasız I → noktalı i DEĞİL), yani /yanlış/i EŞLEŞMEZ.
  // Çözüm: büyük/küçük varyantları harf SINIFIYLA yaz, /i'ye güvenme.
  ['önceki-yanlıştı itirafı', /[Öö]ncek[iİ][^.\n]{0,40}([Yy][Aa][Nn][Ll][Iı][ŞşSs][Tt][Iı]|yanlış|[Hh]atalıyd|[Bb]ayatt)/],
  ['düzeltildi başlığı', /^#{1,6} .*(düzeltildi|revize edildi|sonrası düzelt)/m],
  ['güncelleme damgası', /^\*{0,2}GÜNCELLEME \d{4}-\d{2}-\d{2}/m],
];
// Tarihsel kayıt + dondurulmuş arşiv: süreç artığı burada MEŞRU İÇERİKTİR.
const RESIDUE_EXEMPT_PATH = /(KARAR-DEFTERI|DECISIONS|CHANGELOG|SIDE-BUGS|FRICTION_LOG|GARDEN_LOG|[-_]LOG\.md$|devir|^archive\/|^pilot-proje\/|^pilot-sim\/|(^|\/)arsiv\/)/i;
// Bölüm muafiyeti: yol haritası/sürüm notu KAPANAN maddeyi göstermek için üstü çizili kullanır.
const RESIDUE_EXEMPT_SECTION = /^#{1,4} .*(yol haritası|sürüm notu|roadmap|changelog|geçmiş|arşiv)/im;

function runSurfaceResidue(argv) {
  const allowEmpty = argv.includes('--allow-empty');
  const args = argv.filter(a => !a.startsWith('-'));
  let files = args;
  if (!files.length) {
    const tracked = execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean);
    files = tracked.filter(f => /\.(md|html)$/i.test(f) && !/\.template\.(md|html)$/i.test(f)
      && !RESIDUE_EXEMPT_PATH.test(f));
  }

  const hits = [];
  const missing = [];          // argümanla verildi ama diskte yok — ŞÜPHELİ (placeholders deseni)
  const exemptSkipped = [];    // tarihsel kayıt / arşiv — MEŞRU muafiyet, kayıp değil
  let scanned = 0;
  for (const f of files) {
    if (RESIDUE_EXEMPT_PATH.test(f)) { exemptSkipped.push(f); continue; }
    if (!existsSync(f)) { missing.push(f); continue; }
    let txt;
    try { txt = readFileSync(f, 'utf8'); } catch { missing.push(f); continue; }
    scanned++;
    // Bölüm muafiyeti: dosyada yol haritası/sürüm notu başlığı varsa o BÖLÜMÜN satırları atlanır.
    const lines = txt.split('\n');
    let inExempt = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^#{1,4} /.test(line)) inExempt = RESIDUE_EXEMPT_SECTION.test(line);
      if (inExempt) continue;
      for (const [ad, re] of RESIDUE_SIGS) {
        // çok-satırlı imzalar (^ bağlı) tek satırda sınanır — satır bazlı tarama bilinçli
        const single = new RegExp(re.source, re.flags.replace('m', ''));
        const m = line.match(single);
        if (m) hits.push(`${f}:${i + 1}  [${ad}]  ${m[0].slice(0, 80).trim()}`);
      }
    }
  }

  if (hits.length) {
    console.error(`\nYUZEY-ARTIGI KAPISI FAIL (${hits.length} surec artigi):\n` + hits.map(h => '  ' + h).join('\n'));
    console.error('\nYapilacak: kalici belge "ne DOGRU" der; "nasil duzelttim" ANLATMAZ.');
    console.error('  Surec gecmisi -> karar defteri / CHANGELOG / FRICTION_LOG (orada icerik, burada artik).');
    console.error('  Ustu cizili madde -> ya SIL (git gecmisi zaten tutar) ya da yol haritasi bolumune tasi.');
    console.error('  Olculdu (2026-08-27): 158 S2 vakasinin %27\'si DIS yuzeyde (musteri sunumu, son-kullanici');
    console.error('  belgesi) — bedelini yazan degil OKUYAN oder. Bu kapi o 158\'in ~%18\'ini yakalar (K62 replay).\n');
    return 1;
  }
  if (missing.length) {
    console.error(`\nYUZEY-ARTIGI KAPISI FAIL — ${missing.length} verilen dosya diskte YOK:\n` +
      missing.map(f => `  ${f}`).join('\n'));
    console.error('\n  "temiz" ile "hic bakmadim" farklidir: argumanla verilen dosya okunamadiysa bu kayiptir.\n');
    return 1;
  }
  // Boş-küme körlüğü — AMA muafiyet "bakmadım" DEĞİL "bakmaya gerek yok"tur (ölçülmüş ayrım):
  // verilen dosyaların TAMAMI tarihsel-kayıt/arşiv ise küme bilinçli olarak boştur, şüpheli değil.
  // Bu ayrım olmadan `--rule=surface-residue archive/x.md` FAIL veriyordu (testte yakalandı).
  if (scanned === 0 && !allowEmpty && exemptSkipped.length === 0) {
    console.error('\nYUZEY-ARTIGI KAPISI FAIL — taranan dosya sayisi 0.');
    console.error('  "temiz" ile "hic bakmadim" farklidir: verilen/bulunan dosya listesi bos kaldi.');
    console.error('  Bilincli bos kume ise --allow-empty ile gecirilebilir.\n');
    return 1;
  }
  const skipNote = exemptSkipped.length ? ` [muaf=${exemptSkipped.length} tarihsel-kayit/arsiv]` : '';
  console.log(`Yuzey-artigi kapisi OK — ${scanned} dosya temiz (kalici belgede surec artigi yok).${scanned === 0 ? ' (--allow-empty: bos kume bilincli)' : ''} [taranan=${scanned}]${skipNote}`);
  return 0;
}

// =====================================================================================
// RULE: placeholders
// =====================================================================================
const PLACEHOLDER = /\{\{([^}\n]*)\}\}/g;
const isRealField = inner => inner.trim().length > 0 && !/^[.\s…]+$/.test(inner);
const COST_AXIS = /^\s*#?\s*(model|effort):\s*<([^>\n]*)>\s*(?:[-—#].*)?$/;

function runPlaceholders(argv) {
  const allowEmpty = argv.includes('--allow-empty');
  const args = argv.filter(a => !a.startsWith('-'));
  let files = args;
  if (!files.length) {
    const tracked = execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean);
    files = tracked.filter(f =>
      (/(^|\/)(CLAUDE|AGENTS)\.md$/i.test(f) ||
       /^\.claude\/agents\/[^/]+\.md$/i.test(f) ||
       /^docs\/(STATE|DECISIONS|TECH_DEBT|BASELINE|GUARDS|PRODUCT_LOG|PRODUCT|FRICTION_LOG|GARDEN_LOG|CONTEXT_BUDGET|SKILL_CARDS)\.md$/i.test(f) ||
       /^docs\/(flows|scenarios|user)\//i.test(f))
      && !/\.template\.md$/i.test(f));
  }

  // Ana ajan ölçtü (2026-08-06): `files.length` NİYET EDİLENİ sayar, GERÇEKTEN İŞLENENİ değil —
  // `node gates/check-hygiene.mjs --rule=placeholders YOK-BOYLE-DOSYA.md` "taranan=1" deyip exit 0
  // veriyordu (dosya hiç okunmadı). Düzeltme: utf8'deki `scanned` deseni KOPYALANDI — sayaç yalnız
  // GERÇEKTEN readFileSync edilen dosyada artar; atlanan (dosya yok / şablon muafiyeti) ayrı ayrı
  // görünür raporlanır (registry üretecinin "saymadığı dosyayı sessizce yutması" vakasının panzehiri).
  const hits = [];
  const missing = [];   // argümanla verildi ama diskte yok — ŞÜPHELİ (verify.mjs:70 itirafıyla aynı sınıf)
  const templateSkipped = [];   // .template.md — MEŞRU muafiyet, kayıp değil
  let scanned = 0;
  for (const f of files) {
    if (/\.template\.md$/i.test(f)) { templateSkipped.push(f); continue; }
    if (!existsSync(f)) { missing.push(f); continue; }
    scanned++;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(PLACEHOLDER))
        if (isRealField(m[1]))
          hits.push(`${f}:${i + 1}  →  doldurulmamış alan: ${m[0]}`);
      const mt = line.match(COST_AXIS);
      if (mt && isRealField(mt[2]))
        hits.push(`${f}:${i + 1}  →  doldurulmamış ${mt[1]}: ${line.trim()}`);
    });
  }

  if (hits.length) {
    console.error(`\nPLACEHOLDER KAPISI FAIL (${hits.length} doldurulmamış alan):\n` + hits.map(h => '  ' + h).join('\n'));
    console.error('\nYapilacak: her {{...}} alanini FAZ 1 denetiminde OLCULMUS gercek degerle doldur.');
    console.error('Bu alan doldurulmadan rehber yalan soyler — sistemin 1 numarali hatasi tam olarak budur.');
    console.error('model:/effort: satirlari icin: ADIM 0 envanterinden GERCEK deger yaz, ya da TUM satiri sil.');
    console.error('Yarim birakilan model:/effort: satiri = rol sessizce en pahali varsayilana duser.');
    console.error('  model : sonnet|opus|haiku|fable|<tam-id>|inherit   effort: low|medium|high|xhigh|max\n');
    return 1;
  }

  // Kayıp dosya (argümanla verildi ama diskte yok): argüman modunda her zaman FAIL — bu ŞÜPHELİDİR,
  // sessizce yutulamaz. Argümansız/git-tabanlı modda `files` zaten yalnız var-olan tracked dosyalardan
  // geldiği için `missing` burada boş kalır (FP riski yok, staged/ls-files ayrımı bozulmaz).
  if (missing.length) {
    console.error(`\nPLACEHOLDER KAPISI FAIL — ${missing.length} verilen dosya diskte YOK:\n` +
      missing.map(f => `  ${f}`).join('\n'));
    console.error('\n  "temiz" ile "hiç bakmadım" farklıdır: argümanla verilen dosya okunamadıysa');
    console.error('  bu kayıptır, atlanmış "iş yapıldı" sayılamaz (verify.mjs:70 itirafıyla aynı sınıf).\n');
    return 1;
  }

  // Boş-küme körlüğü (v0.18.2, pilot bulgusu A): pilotta placeholder kapısı boş küme tarayıp
  // "temiz" demişti — GERÇEKTEN işlenen (scanned) 0 ise "hiç bakmadım" demektir, "temiz" değil.
  if (scanned === 0 && !allowEmpty) {
    console.error('\nPLACEHOLDER KAPISI FAIL — taranan dosya sayısı 0.');
    console.error('  "temiz" ile "hiç bakmadım" farklıdır: verilen/bulunan dosya listesi boş kaldı.');
    console.error('  Liste nasıl üretildiyse orayı kontrol et (git ls-files filtresi, argüman, .filter(existsSync)).');
    console.error('  Bilinçli boş küme ise --allow-empty ile geçirilebilir.\n');
    return 1;
  }
  const skipNote = templateSkipped.length ? ` [atlanan=${templateSkipped.length}: ${templateSkipped.join(', ')}]` : '';
  console.log(`Placeholder kapisi OK — ${scanned} dosya temiz (doldurulmamis alan yok).${scanned === 0 ? ' (--allow-empty: boş küme bilinçli)' : ''} [taranan=${scanned}]${skipNote}`);
  return 0;
}

// =====================================================================================
// RULE: file-size
// =====================================================================================
const CODE_WARN = 500, CODE_FAIL = 1000;
const GUIDE_WARN = 150, GUIDE_FAIL = 300;
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|cs|dart|kt|kts|fs|scala|swift)$/i;
// B1 — APPEND-ONLY DEFTER sınıfı. Saha (saha-A, 2 kez; FRICTION_LOG): defterler
// hem "rehber" (300'de FAIL) hem append-only (check-history satır silmeyi yasaklar) sayılınca kural
// kilitleniyordu — "arşive taşı" önerisi de yasaktı (taşımak silmektir); sonuç: her yeni karar kaydı
// kuralı geçmek için KISALTILIYORDU. Defter kendi tavanına sahip: hâlâ sınırlı (sonsuz büyüme
// yakalanır) ama büyümesi beklenen kayıtlara uygun. CLAUDE/AGENTS/SKILL/STATE/rol dosyaları REHBER kalır.
const LEDGER_WARN = 400, LEDGER_FAIL = 1200;
const GUIDE_FILE = /(^|\/)(CLAUDE|AGENTS|SKILL|STATE|GUARDS|BASELINE|TECH_DEBT|CONTEXT_BUDGET|SKILL_CARDS)\.md$|^\.claude\/agents\/[^/]+\.md$/i;
const LEDGER_FILE = /(^|\/)(DECISIONS|PRODUCT_LOG|FRICTION_LOG|GARDEN_LOG|SIDE-BUGS-LOG)\.md$|KARAR-DEFTERI[^/]*\.md$|[-_]LOG\.md$/i;
const BASELINE_PATH = 'scripts/size-baseline.json';

// B2 — KAPSAM (saha: saha-G: elle koşuda staged boşken kapı sessiz "OK" dönüyordu).
// v0.30 düzeltmesi (hakem + K81): VARSAYILAN = STAGED (eski hook'larda GATES_RING yok; commit'e girmeyen
// untracked dosya commit'i bloke etmemeli). Geniş kapsam (staged ∪ unstaged ∪ untracked) YALNIZ açık istekle:
//   --worktree bayrağı VEYA env GATES_RING=elle.   GATES_RING=pre-commit = staged (değişmez).
// Açık dosya argümanı HER ZAMAN kazanır. Argümansız + staged boş → "0 dosya tarandi" satırı görünür (exit 0).
// NOT: yalnız file-size'a uygulandı — secrets/placeholders/utf8 kendi kapsamını kullanıyor.
// v0.30.4 `--all` (saha: saha-D KOK-8a — CI/verify argümansız çağırınca staged BOŞ → 0 dosya tarayıp OK): git ls-files
// ile TÜM izlenen dosyalar (untracked YOK — `--worktree`'den farkı). Çıktı "N dosya denetlendi" der.
function resolveScopeFiles(explicitArgs, worktree = false, all = false) {
  if (explicitArgs.length) return { files: explicitArgs, scope: 'argüman' };
  const git = cmd => execSync(cmd, { maxBuffer: 64 * 1024 * 1024 }).toString('utf8').split('\n').filter(Boolean);
  if (all) return { files: git('git ls-files'), scope: 'git ls-files (--all)' };
  const staged = git('git diff --cached --name-only --diff-filter=ACM');
  if (!(worktree || process.env.GATES_RING === 'elle')) return { files: staged, scope: 'staged' };
  const unstaged = git('git diff --name-only --diff-filter=ACM');
  const untracked = git('git ls-files --others --exclude-standard');
  return { files: [...new Set([...staged, ...unstaged, ...untracked])], scope: 'staged ∪ unstaged ∪ untracked' };
}

function runFileSize(argv) {
  let baseline = {};
  if (existsSync(BASELINE_PATH)) {
    try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); }
    catch { console.error(`UYARI: ${BASELINE_PATH} okunamadi, muafiyetler yok sayiliyor.`); }
  }
  const norm = p => p.replace(/\\/g, '/');

  const args = argv.filter(a => !a.startsWith('-'));
  const { files, scope } = resolveScopeFiles(args, argv.includes('--worktree'), argv.includes('--all'));

  let failed = false;
  let scanned = 0;
  for (const f of files) {
    const isLedger = LEDGER_FILE.test(norm(f));
    const isGuide = !isLedger && GUIDE_FILE.test(f);
    const isCode = CODE_EXT.test(f);
    if ((!isLedger && !isGuide && !isCode) || !existsSync(f)) continue;
    scanned++;
    const [WARN, FAIL, kind] = isLedger ? [LEDGER_WARN, LEDGER_FAIL, 'DEFTER (append-only)']
      : isGuide ? [GUIDE_WARN, GUIDE_FAIL, 'REHBER'] : [CODE_WARN, CODE_FAIL, 'kod'];
    const lines = readFileSync(f, 'utf8').split('\n').length;
    const cap = baseline[norm(f)];
    if (cap !== undefined) {
      if (lines > cap) {
        console.error(`FAIL  ${f}: ${lines} satir — muaf-listede ama buyumus (tavan: ${cap}).`);
        console.error(`      Kural: muaf dosya kucultulebilir, BUYUYEMEZ. Eklemeyi ayri modula tasi.`);
        failed = true;
      }
      continue;
    }
    if (lines > FAIL) {
      const fix = isLedger
        ? 'Defter buyumesi beklenir; 1200 ustu = dizin/ozet katmani ekle veya yeni surum defteri ac (eski satir silinmez/tasinmaz — append-only).'
        : isGuide
        ? 'Eski karar/durumu arsive (docs/archive) veya STATE/DECISIONS\'a tasi; rehber kisa kalmali.'
        : 'Mantikli parcalara bol.';
      console.error(`FAIL  ${f}: ${lines} satir (> ${FAIL}, ${kind}). ${fix}`);
      failed = true;
    } else if (lines > WARN) {
      console.warn(`UYARI ${f}: ${lines} satir (> ${WARN}, ${kind}). ${isLedger ? 'Defter buyuyor — dizin/ozet katmani dusun (bolunemez, append-only).' : isGuide ? 'Rehber sismeye basladi.' : 'Bolmeyi dusun.'}`);
    }
  }
  // "hiç bakmadım" ≠ "temiz": taranan 0 ise açıkça söyle (kapsamla). Argümansız koşuda sayı hep görünür.
  if (scanned === 0) console.log(`file-size: 0 dosya tarandi (kapsam: ${scope})${process.env.GATES_RING === 'pre-commit' ? ' — hook halkasinda bos staged mesru.' : ' — hic bakilmadi, "temiz" degil. Calisma agaci icin --worktree'}`);
  else if (argv.includes('--all') && !args.length) console.log(`file-size: ${scanned} dosya denetlendi (${files.length} aday, kapsam: ${scope}).`);
  else if (!args.length) console.log(`file-size: ${scanned} dosya tarandi (kapsam: ${scope}).`);
  return failed ? 1 : 0;
}

// =====================================================================================
// RULE: report-schema (v0.18.6, panel kararı 2026-08-06 — 7 aile/3 tur)
// YAPISAL, BLOKE eder (exit 1). Gerekçe (panel 5/5): keşif raporu şeması `templates/rapor.template.md`
// (a)'da OLGU/KANIT_REFERANSI ile tanımlıdır — yalnız gözlem taşır, tavsiye/karar alanı YOKTUR.
// Nesnel, düşük yanlış-pozitif, mekanik düzeltilebilir (başlığı sil/yeniden adlandır) — ve yanlış
// anchor aşağı akışta çoğalır ("downstream zehirlenmesi", ana ajan hangi OLGU'nun karar taşıdığını
// ayıramaz). Bu yüzden ÜSLUP değil YAPI ihlali: bloke eder.
// =====================================================================================
const DISCOVERY_MARK = /\bOLGU\b/;
const DISCOVERY_MARK2 = /\bKANIT_REFERANSI\b/;
// NOT: JS regex `i` bayrağı Türkçe İ/I/ı/i büyük-küçük eşlemesini doğru yapmaz (basit Unicode
// case-folding kullanır) — [İIıi] karakter sınıfıyla dört varyant açıkça kapsanır. `\b` de İ
// (U+0130) sonrasında YANLIŞ sonuç verir (word-boundary `\w` tanımı bu karakteri kapsamıyor) —
// bunun yerine harf-devamı olmayan negatif lookahead kullanılır.
const NOT_LETTER_AHEAD = '(?![A-Za-zÇĞİÖŞÜçğıöşü])';
const BANNED_HEADING = new RegExp(
  '^(#{1,6}\\s*|\\*\\*)\\s*(Ö[Nn][Ee][Rr][İIıi]|ONER[İIıi]|TAVS[İIıi]YE|TAVSIYE|KARAR|SONRAK[İIıi]\\s+ADIM|SONRAKI\\s+ADIM|NE\\s+YAPILMALI)' + NOT_LETTER_AHEAD,
  'i'
);

function runReportSchema(argv) {
  const args = argv.filter(a => !a.startsWith('-'));
  let files = args;
  if (!files.length) {
    files = execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean).filter(f => /\.md$/i.test(f));
  }

  const hits = [];
  const missing = [];
  const templateSkipped = [];
  let scanned = 0;
  for (const f of files) {
    if (!/\.md$/i.test(f)) continue;
    if (/\.template\.md$/i.test(f)) { templateSkipped.push(f); continue; }
    if (!existsSync(f)) { missing.push(f); continue; }
    const text = readFileSync(f, 'utf8');
    scanned++;
    if (!DISCOVERY_MARK.test(text) || !DISCOVERY_MARK2.test(text)) continue; // keşif raporu şeması yok — konu dışı
    text.split('\n').forEach((line, i) => {
      const m = line.match(BANNED_HEADING);
      if (m) hits.push(`${f}:${i + 1}  →  keşif raporunda YASAK başlık: "${m[0].trim()}" (karar/öneri alanı OLGU şemasına sızdı)`);
    });
  }

  if (hits.length) {
    console.error(`\nREPORT-SCHEMA KAPISI FAIL (${hits.length} bulgu):\n` + hits.map(h => '  ' + h).join('\n'));
    console.error('\nKeşif raporu (OLGU/KANIT_REFERANSI şeması) yalnız gözlem taşır — ÖNERİ/TAVSİYE/KARAR/');
    console.error('SONRAKİ ADIM/NE YAPILMALI başlığı YOK sayılır, boş bırakılmaz. Başlığı ve altındaki');
    console.error('yorum/tahmini metinden çıkar; gerekiyorsa AÇIK_SORU sütununa NÖTR biçimde taşı.\n');
    return 1;
  }

  if (missing.length) {
    console.error(`\nREPORT-SCHEMA KAPISI FAIL — ${missing.length} verilen dosya diskte YOK:\n` +
      missing.map(f => `  ${f}`).join('\n'));
    return 1;
  }

  const skipNote = templateSkipped.length ? ` [atlanan=${templateSkipped.length}: ${templateSkipped.join(', ')}]` : '';
  console.log(`Report-schema kapisi OK — ${scanned} dosya tarandi.${skipNote}`);
  return 0;
}

// =====================================================================================
// RULE: message-clarity (v0.18.6, panel kararı 2026-08-06 — 7 aile/3 tur)
// ÜSLUP, yalnız UYARI (exit 0 varsayılan; --strict verilirse exit 1 — health-check --strict
// deseninin aynısı). Gerekçe (panel): yanlış-pozitif oranı yüksek, insan zaten filtredir; bu kural
// üslup KALİTESİNİ yargılayamaz — yalnız yapısal/mekanik ihlali görür ("bu cümle anlaşılır mı"
// sorusuna bir kapı cevap veremez, o reference/anlatim-disiplini.md + hakem işidir).
// Sertleştirme kriteri ZAMAN değil ÖLÇÜM: FP oranı eşik altına inene kadar varsayılan UYARI kalır.
//
// MUAFİYET (kritik): --json/makine-okur çıktı yolları taranmaz — "insana giden metin" ile "araca
// giden veri" ayrımı buradadır; JSON.stringify içeren satır ve JSON_OUT koşullu blok atlanır.
// =====================================================================================
const USER_MSG_LINE = /console\.(error|warn)\(\s*(`|'|")/;
const HAS_ARROW = /→/;
const CODE_NAME_BRACKET = /\[([a-z0-9]+(?:-[a-z0-9]+)+)\]/;   // [kebab-case] köşeli parantez
const JSON_ESCAPE_HATCH = /JSON\.stringify|JSON_OUT/;

function runMessageClarity(argv) {
  const strict = argv.includes('--strict');
  const args = argv.filter(a => !a.startsWith('-'));
  let files = args;
  if (!files.length) {
    files = execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean)
      .filter(f => /^(gates|scripts)\/.*\.mjs$/i.test(f));
  }

  const hits = [];
  const missing = [];
  let scanned = 0;
  for (const f of files) {
    if (!/\.mjs$/i.test(f)) continue;
    if (!existsSync(f)) { missing.push(f); continue; }
    const lines = readFileSync(f, 'utf8').split('\n');
    scanned++;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (JSON_ESCAPE_HATCH.test(line)) continue;   // makine-okur yol — muaf
      if (!USER_MSG_LINE.test(line)) continue;
      const bracketed = line.match(CODE_NAME_BRACKET);
      if (bracketed) {
        // kod-adı köşeli parantezde ama düz açıklama da yoksa (parantez dışında en az bir Türkçe/
        // İngilizce kelime öbeği) → üslup ihlali. Kaba ölçüt: parantez hariç satırda 3+ harften
        // oluşan kelime var mı.
        const withoutBracket = line.replace(CODE_NAME_BRACKET, '');
        const hasProse = /[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(withoutBracket.replace(/console\.(error|warn)\(/, ''));
        if (!hasProse) hits.push(`${f}:${i + 1}  →  mesajda çıplak kod-adı [${bracketed[1]}] var ama düz açıklama yok`);
      }
      if (!HAS_ARROW.test(line)) {
        hits.push(`${f}:${i + 1}  →  UYARI/HATA mesajında eylem satırı (→) yok`);
      }
    }
  }

  if (missing.length) {
    console.error(`\nMESSAGE-CLARITY KAPISI FAIL — ${missing.length} verilen dosya diskte YOK:\n` +
      missing.map(f => `  ${f}`).join('\n'));
    return 1;
  }

  if (hits.length) {
    const label = strict ? 'FAIL' : 'UYARI';
    const stream = strict ? console.error : console.warn;
    stream(`\nMESSAGE-CLARITY KAPISI ${label} (${hits.length} bulgu):\n` + hits.map(h => '  ' + h).join('\n'));
    stream('\nBu kural üslup KALİTESİNİ yargılayamaz — yalnız yapısal/mekanik ihlali görür.');
    stream('Düzeltme: kullanıcıya giden UYARI/HATA satırına bir → eylem satırı ekle; çıplak');
    stream('[kod-adı] varsa yanına düz açıklama yaz. --json/JSON_OUT yolları bu taramadan MUAFTIR.\n');
    return strict ? 1 : 0;
  }

  console.log(`Message-clarity kapisi OK — ${scanned} dosya tarandi. [taranan=${scanned}]`);
  return 0;
}

// =====================================================================================
// Dispatch
// =====================================================================================
const argv = process.argv.slice(2);
const ruleArg = argv.find(a => a.startsWith('--rule='));
const rest = argv.filter(a => a !== ruleArg);

const RUNNERS = {
  'utf8': runUtf8,
  'secrets': runSecrets,
  'placeholders': runPlaceholders,
  'surface-residue': runSurfaceResidue,
  'file-size': runFileSize,
  'report-schema': runReportSchema,
  'message-clarity': runMessageClarity,
};

if (ruleArg) {
  const rule = ruleArg.slice('--rule='.length);
  if (!RUNNERS[rule]) {
    console.error(`check-hygiene.mjs: bilinmeyen --rule="${rule}" (geçerli: ${RULES.join(', ')})`);
    process.exit(1);
  }
  process.exit(RUNNERS[rule](rest));
}

let worst = 0;
for (const name of RULES) {
  const code = RUNNERS[name]([]);
  if (code !== 0) worst = code;
}
process.exit(worst);
