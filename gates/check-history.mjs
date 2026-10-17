#!/usr/bin/env node
// History kategori kapısı. Alt-kurallar: aşağıdaki RULES[]; sözleşme: CONTRACT.md "Kapı kayıt tablosu".
// ORTAK EKSEN: staged-diff + tarihsel-bütünlük/tripwire — üçü de "geçmiş kayıt/beyan sessizce
// bayatladı mı" sorusuna bakar (append-only: satır silinemez; co-update: yüzey↔doküman driftı;
// stale-constants: rol dosyasına gömülü ölçüm sabitinin bayatlaması).
//
//
// Kullanım:
//   node check-history.mjs                              → argümansız: RULES[]'teki TÜM alt-kurallar koşar
//   node check-history.mjs --rule=append-only [...]      → yalnız o alt-kural (eski bayraklar/env korunur)
//   node check-history.mjs --rule=co-update [...]
//   node check-history.mjs --rule=stale-constants [...]
//   node check-history.mjs --rule=friction-repeat [--strict]
import { execSync, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const RULES = ['append-only', 'co-update', 'stale-constants', 'friction-repeat'];

// =====================================================================================
// RULE: append-only
// =====================================================================================
// v0.30.4 `--all` (saha: saha-D KOK-8a): CI/verify argümansız çağırınca staged diff BOŞ → kapı hiçbir şey denetlemeden OK
// dönüyordu. `--all` modunda `<taban>...HEAD` diff'i denetlenir (merge-base'e göre: PR'ın GERÇEKTEN getirdiği değişiklik).
// Taban: env APPEND_ONLY_TABAN (açık; çözülemezse TAHMİN ETMEZ) → origin/HEAD → origin/main → origin/master → main → master.
// Taban BULUNAMAZSA sessiz geçmez: "ATLANDI — karşılaştırma tabanı yok" ilan eder (exit 0; sığ klonda meşru). Yokluğu
// İLAN ETMEK, yok saymaktan farklıdır.
// Taban AÇIKÇA verilmişse (APPEND_ONLY_TABAN) ve çözülemiyorsa FAIL (doc-recency `--base` ile tutarlı: açık niyet sessiz atlanmaz).
// Ref git'e argüman dizisi olarak geçer (execFileSync) — kabuk enjeksiyonu yüzeyi yok; '-' ile başlayan ref reddedilir.
function refVar(ref) {
  if (ref.startsWith('-')) return false;
  try { execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { stdio: ['pipe', 'pipe', 'ignore'] }); return true; }
  catch { return false; }
}
function tabanBul() {
  const acik = (process.env.APPEND_ONLY_TABAN || '').trim();
  if (acik) return refVar(acik) ? acik : { acikCozulemedi: acik };
  for (const aday of ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']) if (refVar(aday)) return aday;
  return null;
}

function runAppendOnly(argv = []) {
  const APPEND_ONLY = ['docs/DECISIONS.md', 'docs/PRODUCT_LOG.md', 'docs/FRICTION_LOG.md',
    'docs/GARDEN_LOG.md',
    ...(process.env.APPEND_ONLY_EXTRA || '').split(',').map(s => s.trim()).filter(Boolean)];

  const all = argv.includes('--all');
  let taban = null;
  if (all) {
    taban = tabanBul();
    if (taban && taban.acikCozulemedi) {
      console.error(`\nAPPEND-ONLY KAPISI FAIL — APPEND_ONLY_TABAN="${taban.acikCozulemedi}" çözülemedi (açıkça verilen taban sessizce atlanmaz).\n  CI'da 'fetch-depth: 0' gerekir; ref adını da kontrol et.\n`);
      return 1;
    }
    if (!taban) {
      console.log('Append-only kapisi ATLANDI — karsilastirma tabani yok ' +
        '(origin/HEAD, origin/main, origin/master, main, master cozulemedi; APPEND_ONLY_TABAN ile acikca verilebilir; ' +
        "CI'da 'fetch-depth: 0' gerekir). 0 dosya denetlendi.");
      return 0;
    }
  }
  const listeArgs = all ? ['diff', '--name-only', '--diff-filter=ACMRD', `${taban}...HEAD`] : ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'];
  const staged = new Set(
    execFileSync('git', listeArgs, { maxBuffer: 16 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean));

  const violations = [];
  let denetlenen = 0;
  for (const f of APPEND_ONLY) {
    if (!staged.has(f)) continue;
    denetlenen++;
    let diff = '';
    const diffArgs = all ? ['diff', '-U0', `${taban}...HEAD`, '--', f] : ['diff', '--cached', '-U0', '--', f];
    try { diff = execFileSync('git', diffArgs, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8'); }
    catch { continue; }
    const removed = diff.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---'));
    if (removed.length)
      violations.push(`${f}: ${removed.length} satır silinmiş/değiştirilmiş (append-only — yalnızca EKLEME serbest).`);
  }

  if (violations.length) {
    console.error('\nAPPEND-ONLY KAPISI FAIL:\n' + violations.map(v => '  ' + v).join('\n'));
    console.error('\nBu dosyalar tarihsel kayittir: eski girdiler duzenlenmez/silinmez, sadece yeni girdi eklenir.');
    console.error('Bir karari revize etmen gerekiyorsa: eskiyi BIRAK, altina "su tarihte revize edildi: ..." diye YENI girdi ekle.\n');
    return 1;
  }
  console.log(all
    ? `Append-only kapisi OK — ${denetlenen} defter dosyasi denetlendi (kapsam: ${taban}...HEAD, ${APPEND_ONLY.length} defter izleniyor).`
    : 'Append-only kapisi OK.');
  return 0;
}

// =====================================================================================
// RULE: co-update
// =====================================================================================
function runCoUpdate(argv) {
  const SURFACE   = /(^|\/)(components|pages|screens|views|routes)\/|(^|\/)app\/(.*\/)?(page|layout|route)\.[tj]sx?$/i;
  const COMPANION = /^docs\/(flows|scenarios)\/|^docs\/PRODUCT_LOG\.md$|(^|\/)(FLOW|SCENARIOS)\.md$/i;

  const strict = argv.includes('--strict');
  const staged = execSync('git diff --cached --name-only --diff-filter=ACM', { maxBuffer: 16 * 1024 * 1024 })
    .toString('utf8').split('\n').filter(Boolean);

  const touchedSurface = staged.filter(f => SURFACE.test(f));

  const companionFiles = staged.filter(f => COMPANION.test(f));
  const anlamliDegisen = companionFiles.filter(f => {
    try {
      const diff = execSync(
        `git diff --cached -U0 -- "${f.replace(/"/g, '\\"')}"`,
        { maxBuffer: 16 * 1024 * 1024 },
      ).toString('utf8');
      return diff.split('\n')
        .filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l))
        .map(l => l.slice(1))
        .some(l => /\S/.test(l));
    } catch { return true; }
  });
  const touchedCompanion = anlamliDegisen.length > 0;

  const kozmetik = companionFiles.filter(f => !anlamliDegisen.includes(f));

  if (touchedSurface.length && !touchedCompanion) {
    const msg = `\nBİRLİKTE-GÜNCELLE TRIPWIRE: ${touchedSurface.length} UI/yüzey dosyası değişti, akış/senaryo dokümanına ANLAMLI güncelleme gelmedi:\n`
      + touchedSurface.map(f => '  ' + f).join('\n')
      + (kozmetik.length
          ? `\n\n  ⚠️ KOZMETİK DOKUNUŞ TESPİT EDİLDİ (boşluk/boş-satır dışı içerik değişmemiş):\n`
            + kozmetik.map(f => '     ' + f).join('\n')
            + `\n     → Dosyaya dokunmak GÜNCELLEMEK DEĞİLDİR. Kapı içeriğe bakar, dosya adına değil.`
          : '')
      + `\n\n  • Kullanıcı-görünür bir akış değiştiyse → ilgili docs/flows · docs/scenarios · docs/PRODUCT_LOG.md güncelle.`
      + `\n  • Sadece iç refactor ise → bu bir uyarıdır, görmezden gelebilirsin.\n`;
    if (strict) { console.error(msg + '(--strict: commit bloke edildi)\n'); return 1; }
    console.warn(msg);
  }
  return 0;
}

// =====================================================================================
// RULE: stale-constants
// =====================================================================================
const ROLE_FILE = /(^|\/)\.claude\/agents\/[^/]+\.md$/i;

const MEASURE = [
  ['hata sayısı',   /\b\d{2,}\s*(adet\s*)?(lint\s*|tip\s*|type\s*|typecheck\s*)?(hata|error|warning|uyar[ıi])\b/gi],
  ['test sayısı',   /\b\d{2,}\s*(adet\s*)?(birim\s*|unit\s*|e2e\s*)?(test|spec)\b(?!\s*(dosyas[ıi]n[ıi]|klas[öo]r))/gi],
  ['kapsam oranı',  /%\s*\d{1,3}([.,]\d+)?|\d{1,3}([.,]\d+)?\s*%/g],
  ['süre ölçümü',   /\b\d+([.,]\d+)?\s*(sn|saniye|dk|dakika|ms)\b(?!\s*(tavan|hedef|s[ıi]n[ıi]r|a[şs]ma))/gi],
];

const EXEMPT_LINE = [
  /❌|✅|(^|[.;]\s*|\s—\s)\s*(YASAK|MUAF)\b|yasa[ğg]ı\b|kar[şs][ıi]-[öo]rnek/,
  /telemetri\s*\(\d{4}-\d{2}-\d{2}|[öo]l[çc][üu]m\s*\(\d{4}-\d{2}-\d{2}|\(\d{4}-\d{2}-\d{2}\)|:\s*\d{4}-\d{2}-\d{2}\)/i,
  /^\s*[-*(]?\s*\(?(Kaynak|Source)\s*:|^\s*\(?(pilot|dış denetim|d[ıi][şs] denetim)\s+(geri\s*bildirim|bulgusu)/i,
  /^\s*[-*(]?\s*(madde|ad[ıi]m|§|bölüm|faz|k)\s*\d+/i,
  /^\s*[-*(#]*\s*v?\d+\.\d+(\.\d+)?(-\w+)?\b|\(v?\d+\.\d+(\.\d+)?(-\w+)?\)/i,
  /≤\s*\d+\s*sat[ıi]r|\bsat[ıi]r\s*tavan|tavan\s*[:=]/i,
  /\b\d+\s*-?\s*eksen\b/i,
  /(^|[\s(([])(örnek|ornek|ör\.|or\.|e\.g\.|i\.e\.)/i,
  /\{\{[^}]+\}\}/,
  /<[^>]*\.\.\.[^>]*>|<[a-zçğıöşü][^>]{2,}>/i,
];

function runStaleConstants(argv) {
  const strict = argv.includes('--strict');
  const fileArgs = argv.filter(a => !a.startsWith('-'));

  function targets() {
    if (fileArgs.length) return fileArgs;
    try {
      return execSync('git diff --cached --name-only --diff-filter=ACM', { maxBuffer: 16 * 1024 * 1024 })
        .toString('utf8').split('\n').filter(Boolean).filter(f => ROLE_FILE.test(f));
    } catch { return []; }
  }

  const files = fileArgs.length
    ? fileArgs.filter(f => existsSync(f))
    : targets().filter(f => ROLE_FILE.test(f) && existsSync(f));

  if (!files.length) {
    console.log(fileArgs.length
      ? `Stale-constants — verilen ${fileArgs.length} yolun hiçbiri okunamadı (dosya yok). TARAMA YAPILMADI.`
      : 'Stale-constants OK — staged rol dosyası yok (kapı bu commit\'te no-op).');
    return 0;
  }

  const findings = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.trim().startsWith('#') && /^#{1,6}\s/.test(line.trim())) return;
      if (EXEMPT_LINE.some(re => re.test(line))) return;
      for (const [label, re] of MEASURE) {
        re.lastIndex = 0;
        const m = re.exec(line);
        if (m) {
          findings.push({ file: f, line: i + 1, label, text: line.trim().slice(0, 110) });
          break;
        }
      }
    });
  }

  if (!findings.length) {
    console.log(`Stale-constants OK — ${files.length} rol dosyasında gömülü ölçüm sabiti yok.`);
    return 0;
  }

  const msg = `\nBAYAT-SABİT ${strict ? 'FAIL' : 'UYARI'} (${findings.length} gömülü ölçüm sabiti):\n` +
    findings.map(f => `  ${f.file}:${f.line}  [${f.label}]\n      ${f.text}`).join('\n') +
    `\n\n  • Kural: rol dosyası ÖLÇÜM sabitini (hata/test sayısı, kapsam, süre) GÖMEMEZ — ölçüm` +
    `\n    değişince rol dosyası sessizce YALAN söylemeye başlar (pilot: "120 hata" yazıyordu,` +
    `\n    gerçek 117'ye düştü, kimse fark etmedi).` +
    `\n  • Düzeltme: sayıyı SİL, kaynağa İŞARET ET —` +
    `\n      ❌ "120 hata sınırını aşma"` +
    `\n      ✅ "güncel sınırı BASELINE.md'den oku; üstüne çıkma"` +
    `\n  • Yapısal sabitler (madde no, sürüm, satır tavanı, eksen sayısı) MUAFTIR — bayatlamazlar.` +
    `\n  • Bu bir HEURİSTİK'tir: yanlış-pozitifse satırı örnek/muaf bağlamla yaz ya da sabiti kaynağa taşı.\n`;

  if (strict) { console.error(msg + '(--strict: commit/CI bloke edildi)\n'); return 1; }
  console.warn(msg);
  return 0;
}

// =====================================================================================
// Dispatch
// =====================================================================================
// =====================================================================================
// RULE: friction-repeat (v0.20 — pilot geri bildirimi 2026-08-11 §5.5)
// SINIF: staged-diff. Sürtünme günlüğünün TRİYAJ DİSİPLİNİNİ mekanikleştirir.
//
// KÖK NEDEN: "3+ tekrar → kural değişir" ve "her yeni girdi Mekanizma-adayı ile biter" kuralları
// `reference/multi-team.md` §3a + FRICTION_LOG "Triyaj disiplini"nde YAZILIYDI ama hiçbir kapı
// SAYMIYORDU — tetik bahçıvan turuna/insana bırakılmıştı. Sonuç sahada ölçüldü: 1489 satırlık bir
// günlükte "aynı ders tekrar" işareti 10 KEZ. Ders kaydedilmemiş değildi, OKUNMUYORDU. Aynı desen
// bu paketin KENDİ defterinde de var (eşiği aşmış, hâlâ "insan onayı bekliyor" girdileri).
// Bu, ALTIN KURAL ②'nin log tarafıdır: mekanizması olmayan kural gürültüdür.
//
// İKİ KONTROL:
//   (a) YAKALAMA — staged'de EKLENEN yeni satır `Mekanizma-adayı:` taşıyor mu (yoksa bulgu).
//       Yalnız EKLENEN satırlara bakar → eski girdiler geriye-dönük FAIL üretmez.
//   (b) NOT — tekrar sayacı ≥3 olan ve hâlâ AÇIK (onay bekleyen) girdiler listelenir.
//       Bu blok TEK BAŞINA asla FAIL vermez (`--strict`te bile): eşiği aşmış girdi bir KARAR
//       borcudur, commit'i bloke etmesi yanlış-pozitif olurdu — görünürlük yeterli mekanizmadır.
// =====================================================================================
const FRICTION_DOSYALARI = /(^|\/)(FRICTION_LOG|GARDEN_LOG)\.md$/i;
const MEKANIZMA_ADAYI_RE = /Mekanizma-aday[ıi]\s*:/i;
const TEKRAR_ESIGI = 3;

function runFrictionRepeat(argv) {
  const strict = argv.includes('--strict');
  const args = argv.filter(a => !a.startsWith('-'));

  let hedefler = args.filter(f => FRICTION_DOSYALARI.test(f));
  let stagedMod = !args.length;
  if (!args.length) {
    try {
      hedefler = execSync('git diff --cached --name-only --diff-filter=ACMR', { maxBuffer: 16 * 1024 * 1024 })
        .toString('utf8').split('\n').filter(Boolean).filter(f => FRICTION_DOSYALARI.test(f));
    } catch { hedefler = []; }
  }
  if (!hedefler.length) {
    console.log('Friction-repeat: staged sürtünme günlüğü yok → no-op (staged-diff sınıfı).');
    return 0;
  }

  const bulgular = [];
  const esikAsanlar = [];

  for (const f of hedefler) {
    // (a) EKLENEN satırlar — staged modda diff'ten, argüman modunda tüm tablo satırlarından.
    let eklenen = [];
    if (stagedMod) {
      try {
        eklenen = execSync(`git diff --cached -U0 -- "${f}"`, { maxBuffer: 16 * 1024 * 1024 })
          .toString('utf8').split('\n')
          .filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1));
      } catch { /* yeni dosya / git yok */ }
    } else if (existsSync(f)) {
      eklenen = readFileSync(f, 'utf8').split('\n');
    }

    for (const satir of eklenen) {
      if (!satir.trim().startsWith('|')) continue;
      const h = satir.split('|').map(s => s.trim());
      // Şema: | Tarih | Hangi kural/kapı | Ne engelledi/yanılttı | Tekrar mı | Onaylayan |
      if (h.length < 6) continue;
      if (/^[-: ]+$/.test(h[1]) || /^Tarih$/i.test(h[1])) continue;   // ayraç/başlık satırı
      if (!MEKANIZMA_ADAYI_RE.test(h[3])) {
        bulgular.push(`${f}: yeni girdi (${h[1] || '?'}) "Mekanizma-adayı:" taşımıyor — ` +
          `somut bir kapı/test/hook adayı YA DA dürüstçe "Mekanizma-adayı: YOK (E2)" yaz.`);
      }
    }

    // (b) eşik NOT'u — dosyanın TAMAMI okunur (tarihsel birikim burada yaşar).
    if (!existsSync(f)) continue;
    for (const satir of readFileSync(f, 'utf8').split('\n')) {
      if (!satir.trim().startsWith('|')) continue;
      const h = satir.split('|').map(s => s.trim());
      if (h.length < 6) continue;
      const m = h[4].match(/^(\d+)/);
      if (!m || parseInt(m[1], 10) < TEKRAR_ESIGI) continue;
      if (!/bekliyor|a[çc][ıi]k/i.test(h[5])) continue;              // kapanmışları listeleme
      esikAsanlar.push(`${f}: "${(h[2] || '').slice(0, 60)}…" → ${m[1]}. tekrar, durum: ${h[5]}`);
    }
  }

  if (esikAsanlar.length) {
    console.warn(`\nFRICTION-REPEAT NOT — eşiği (${TEKRAR_ESIGI}+ tekrar) aşmış ve hâlâ AÇIK ${esikAsanlar.length} girdi:\n` +
      esikAsanlar.map(x => '  • ' + x).join('\n') +
      `\n  → Terfi kuralı: 3+ bağımsız tekrar + süpervizör onayı + mekanizmanın GERÇEKTEN eklenmesi.` +
      `\n  → Bu NOT commit'i BLOKE ETMEZ (karar borcudur, ihlal değil) — ama görünmez kalmamalıdır.\n`);
  }

  if (bulgular.length) {
    const msg = `\nFRICTION-REPEAT ${strict ? 'FAIL' : 'UYARI'} (${bulgular.length} yeni girdi triyaj şemasına uymuyor):\n` +
      bulgular.map(v => '  ' + v).join('\n') +
      `\n  → Kaynak kural: FRICTION_LOG "Triyaj disiplini" (mekanizma-adayı zorunlu).\n`;
    if (strict) { console.error(msg + '(--strict: commit/CI bloke edildi)\n'); return 1; }
    console.warn(msg);
    return 0;
  }
  console.log(`Friction-repeat OK — ${hedefler.length} sürtünme günlüğünde yeni girdiler triyaj şemasına uygun.`);
  return 0;
}

const argv = process.argv.slice(2);
const ruleArg = argv.find(a => a.startsWith('--rule='));
const rest = argv.filter(a => a !== ruleArg);

const RUNNERS = {
  'append-only': (a) => runAppendOnly(a),
  'co-update': (a) => runCoUpdate(a),
  'stale-constants': (a) => runStaleConstants(a),
  'friction-repeat': (a) => runFrictionRepeat(a),
};

if (ruleArg) {
  const rule = ruleArg.slice('--rule='.length);
  if (!RUNNERS[rule]) {
    console.error(`check-history.mjs: bilinmeyen --rule="${rule}" (geçerli: ${RULES.join(', ')})`);
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
