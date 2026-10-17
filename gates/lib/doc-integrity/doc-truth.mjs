// RULE: doc-truth — rehberdeki backtick'li yol ve komut referansları gerçekten var mı.
import { execSync, execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { astSecondOpinion } from '../anchor-resolve.mjs';

export function runDocTruth(argvAll) {
  const strict = argvAll.includes('--strict');
  const allowEmpty = argvAll.includes('--allow-empty');
  const args = argvAll.filter(a => !a.startsWith('-'));
  const ignore = (argvAll.find(a => a.startsWith('--ignore=')) || '')
    .replace('--ignore=', '').split(',').map(s => s.trim()).filter(Boolean);
  const tracked = execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8').split('\n').filter(Boolean);

  // ÜRETİLEN YOL MUAFİYETİ (v0.26.3) — ORTAM-BAĞIMLI SAHTE-YEŞİL panzehiri.
  // NEDEN [ÖLÇÜLDÜ 2026-09-06]: kapı `existsSync` ile "dosya sisteminde var mı" soruyordu.
  // Geliştiricinin makinesinde `.git/hooks/pre-commit` (hook:install koşmuş) ve `bench/runs/`
  // (koşu çıktısı, gitignore'da) VARDI → yerel YEŞİL; CI'ın temiz checkout'unda YOKTU → CI
  // KIRMIZI. Aynı commit, iki farklı verdict: kapının kendisi ortam-bağımlıydı. Bu, paketin
  // "install-exam ③ CI fiilen koştu mu → FAIL" bulgusunun KÖK NEDENİYDİ (v0.24'ten beri kırmızı).
  // Çözüm: bu yollar TASARIM GEREĞİ izlenmez (biri .git/ altında, biri gitignore'lu) — varlıkları
  // makineye göre değişir, dolayısıyla "ölü referans" kanıtı olamazlar. Muafiyet DAR tutulur:
  // yalnız git'in yapısal olarak dışladığı iki önek. Yeni bir üretilen dizin eklenirse buraya da
  // eklenir — yoksa aynı sahte-yeşil geri gelir.
  // 🔴 Sondaki '/' YOK: kapı token'ı `.replace(/\/$/, '')` ile kırpar, bu yüzden `bench/runs/`
  // yazan bir referans buraya `bench/runs` olarak gelir. Önek eşleşmesi hem dizinin kendisini
  // hem altındakileri (`bench/runs/2026-01.json`) kapsar. (Ölçüldü: slash'lı liste ilk sürümde
  // `bench/runs` referansını KAÇIRDI — temiz klonda 1 fail kaldı.)
  const URETILEN = ['.git/', 'bench/runs'];
  // v0.30.5 KAPSAM FİLTRESİ (saha: pilot-backend): hook TÜM staged dosyaları argüman verince künye (.json), CI
  // yml'leri ve kapı kodu (.mjs/.cs) "rehber" sanılıp 7 sahte ölü referans üretti. Açık argüman yalnız REHBER
  // (.md/.mdx) ise taranır; append-only defterler (.md) argümansız moddaki gibi aynı kurallarla (isHistoricalPath) işlenir.
  // Bilinçli sapma: argümansız moddaki dar liste (CLAUDE/AGENTS/...) açık argümana UYGULANMAZ — verify.mjs README/SKILL/
  // reference/*.md'yi açıkça verir ve hâlâ taranmalı.
  const IN_SCOPE = f => /\.mdx?$/i.test(f);
  let docs = args.filter(IN_SCOPE);
  const kapsamDisiArg = args.length - docs.length;
  if (!args.length) {
    docs = tracked.filter(f =>
      /(^|\/)(CLAUDE|AGENTS)\.md$/i.test(f) || /^\.claude\/agents\/[^/]+\.md$/i.test(f) ||
      /^docs\/(PRODUCT_LOG|PRODUCT|CONTEXT_BUDGET|SKILL_CARDS)\.md$/i.test(f) || /^docs\/(flows|scenarios)\//i.test(f));
  }

  const hasPkg = existsSync('package.json');
  let npmScripts = {};
  try { npmScripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts ?? {}; } catch {}
  const PM_BUILTINS = new Set(['install','i','ci','add','remove','rm','run','run-script','dlx',
    'exec','x','create','up','update','upgrade','outdated','why','audit','publish','pack','init',
    'link','unlink','store','prune','dedupe','patch','config','import','fetch','node','tsx']);
  const readTargets = (paths, re) => {
    const set = new Set();
    for (const p of paths) if (existsSync(p))
      for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(re); if (m) set.add(m[1]); }
    return set;
  };
  const makeTargets = readTargets(['Makefile', 'makefile', 'GNUmakefile'], /^([A-Za-z0-9_.-]+):(?!=)/);
  const justTargets = readTargets(['justfile', 'Justfile', '.justfile'], /^@?([A-Za-z0-9_-]+)(?:\s+[\w$]+)*\s*:/);

  const DOTNET_CMDS = new Set(['run','test','build','format','restore','publish','pack','clean','watch',
    'add','remove','new','tool','ef','nuget','sln','dev-certs','user-secrets','list','msbuild','vstest','store']);
  const FLUTTER_CMDS = new Set(['run','test','build','pub','analyze','format','clean','doctor','create','gen-l10n','devices','upgrade','precache']);
  const TERRAFORM_CMDS = new Set(['init','plan','apply','destroy','validate','fmt','import','output','state','workspace','refresh','show','providers','console','graph','taint','untaint']);
  let untracked = [];
  try { untracked = execSync('git ls-files -o --exclude-standard', { maxBuffer: 16 * 1024 * 1024 })
    .toString('utf8').split('\n').filter(Boolean); } catch { /* git yoksa boş */ }
  const manifests = [...tracked, ...untracked];
  const hasDotnet = manifests.some(f => /\.(csproj|sln|fsproj|vbproj)$/i.test(f));
  const hasFlutter = manifests.some(f => /(^|\/)pubspec\.yaml$/i.test(f));
  const hasTerraform = manifests.some(f => /\.tf$/i.test(f));

  const pkgRoots = ['.', ...tracked.filter(f => /(^|\/)package\.json$/.test(f)).map(dirname)];

  const BACKTICK = /`([^`\n]{4,160})`/g;
  const ANCHOR = /<!--\s*doc-anchor:\s*([^>]+?)\s*-->/gi;

  // ── git geçmişi izi (B5a/B5c) — TEK yerde önbellekli ────────────────────────────────────
  // `git log --all -- <yol>` pahalıdır (süreç başlatır); aynı yol/segment için bir kez sorulur.
  const historyCache = new Map();
  const existedInHistory = (tok) => {
    if (historyCache.has(tok)) return historyCache.get(tok);
    let seen = false;
    try {
      seen = execFileSync('git', ['log', '--all', '--oneline', '--max-count=1', '--', tok],
        { maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim().length > 0;
    } catch { seen = false; }
    historyCache.set(tok, seen);
    return seen;
  };

  // B5a — model kimliği (z-ai/glm-5.2, anthropic/claude-opus-5) ve kesir (137/140, 1/3) yol
  // SANILMAZ. Ölçüt (saha yaması saha-G'nin GENERIC hâli — onun sabit dizin listesi
  // repoya özgüydü): bir token yol sayılması için YA bilinen dosya uzantısıyla bitmeli YA İLK
  // SEGMENTİ gerçek bir dizin olmalı (diskte var / izlenen üst dizin / git geçmişinde izi var).
  // z-ai, openai, 137 bu repoda hiç dizin olmadı → yol değil. Bilinçli ödünleşim: uzantısız VE
  // hiç var olmamış üst dizinli uydurma yol artık yakalanmaz; uzantılı olanlar ve var olan/silinmiş
  // dizin altındakiler yakalanmaya devam eder.
  const KNOWN_EXT = /\.(py|mjs|js|cjs|json|md|txt|ts|tsx|jsx|html|css|yml|yaml|sh|ps1|vbs|toml|ini|cfg|sql|csv|log|pdf|db|sqlite|exe|cs|csproj|sln|java|kt|go|rs|rb|php|xml|gradle|tf|vue|svelte|prisma|env|lock)$/i;
  const topDirs = new Set(tracked.filter(f => f.includes('/')).map(f => f.split('/')[0]));
  const firstSegIsRealDir = (tok, docDir) => {
    const first = tok.split('/')[0];
    if (first === '.' || first === '..') return true;
    return topDirs.has(first) || existsSync(first) || existsSync(join(docDir, first)) ||
      pkgRoots.some(r => existsSync(join(r, first))) || existedInHistory(first);
  };
  const looksPath = (s, docDir = '.') => {
    if (!(/^[\w.@-]+(\/[\w.()\[\]@-]+)+\/?$/.test(s) &&
      !s.includes('{{') && !s.includes('*') && !s.includes('<') &&
      !/^(https?|mailto):/.test(s))) return false;
    if (/^[\d.]+(\/[\d.]+)+\/?$/.test(s)) return false;   // kesir / sürüm aralığı
    return KNOWN_EXT.test(s.replace(/\/$/, '')) || firstSegIsRealDir(s, docDir);
  };

  // SUFFIX-MATCH (saha yaması saha-G): rehber dosyayı KISALTILMIŞ yolla anabilir
  // (parsers/x.py ↔ capabilities/mail/parsers/x.py). İzlenen TEK dosya /<tok> ile bitiyorsa
  // yaşıyor say; birden fazlaysa BELİRSİZ → FAIL sürer (yanlış dosyaya sessiz bağlanmaz).
  function suffixMatchTekAnlamli(tok) {
    if (tok.startsWith('/') || tok.startsWith('.')) return false;
    const suffix = '/' + tok;
    return tracked.filter(f => f === tok || f.endsWith(suffix)).length === 1;
  }

  // B5c — append-only defterlerde TARİHSEL yol istisnası (saha yaması saha-A): bu
  // defterler eski satırın değiştirilmesini yasaklar (check-history), kapı ise her yolun diskte
  // olmasını ister → bir dosya silinince "hiçbir dosya silinemez" kilidi. Ayrım: uydurma yol
  // (git'te HİÇ izi yok → FAIL) ≠ tarihsel yol (vardı, silindi → geçmiş kaydı). Kapsam DAR: yalnız
  // defterler; canlı rehberde (CLAUDE.md, agents/, flows/) silinmiş dosyaya atıf HÂLÂ hatadır.
  const APPEND_ONLY = /(^|\/)(PRODUCT_LOG|DECISIONS|FRICTION_LOG|GARDEN_LOG|SIDE-BUGS-LOG)\.md$|(^|\/)v?[\d.]*-?KARAR-DEFTERI\.md$/i;
  const isHistoricalPath = (doc, tok) =>
    APPEND_ONLY.test(doc.split('\\').join('/')) && existedInHistory(tok);

  // Komut-adı regex'leri Unicode-farkında (B5b). \w ASCII'dir → "bağlanılır" içinde ba yakalanıp
  // ba adlı sahte komut aranıyordu (saha-B FRICTION_LOG). Yakalanan parçanın hemen ardında
  // HERHANGİ bir dilde harf/rakam gelirse eşleşme reddedilir; önünde harf varsa da (xnpm).
  const L = String.raw`(?![\p{L}\p{N}_])`;
  const B = String.raw`(?<![\p{L}\p{N}_])`;
  const RUN  = new RegExp(B + String.raw`(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([\w:.-]+)` + L, 'gu');
  const MAKE = new RegExp(B + String.raw`make\s+([\w.-]+)` + L, 'gu');
  const JUST = new RegExp(B + String.raw`just\s+([\w-]+)` + L, 'gu');
  const DOTNET = new RegExp(B + String.raw`dotnet\s+([\w-]+)` + L, 'gu');
  const FLUTTER = new RegExp(B + String.raw`flutter\s+([\w-]+)` + L, 'gu');
  const TERRAFORM = new RegExp(B + String.raw`(?:terraform|tofu)\s+([\w-]+)` + L, 'gu');
  // B5d: --ignore= komut ailelerine de uygulanır (saha-E2 FRICTION_LOG: bun <script> örneği RUN'da
  // susturulamıyordu). Token'ın kendisi VEYA tüm eşleşme (bun run x) önekle eşleşirse atlanır.
  const cmdIgnored = (name, full) => ignore.some(p => name.startsWith(p) || full.startsWith(p));
  // NODE: node <yol> biçimi (v0.18.4) — en sık yazılan node gates/check-x.mjs biçimini yakalar.
  // İki biçim: çok-segment yol VE tek-segment script (node x.mjs; uzantı zorunlu — uzantısız tek
  // kelime FP riski). Placeholder'lar elenir.
  const NODE = new RegExp(B + String.raw`node\s+(?:\.\/)?([\w.-]+(?:\/[\w.()\[\]-]+)*\.(?:m|c)?[jt]s)` + L, 'gu');

  function resolveRepoSymbol(token, docDir) {
    const clean = token.trim().replace(/\/$/, '');
    const colonIdx = clean.indexOf(':');
    const hasColon = colonIdx > 0;
    const left = hasColon ? clean.slice(0, colonIdx) : clean;
    const right = hasColon ? clean.slice(colonIdx + 1) : null;
    const symbolName = right && !right.includes('/') ? right.replace(/^#/, '') : null;

    const candidates = [left, join(docDir, left), ...pkgRoots.map(r => join(r, left))];
    const hit = candidates.find(c => existsSync(c));
    if (!hit) return { status: 'path-yok', symbolName };

    if (!symbolName) return { status: 'ok', symbolName };

    let found = false;
    try {
      const st = statSync(hit);
      if (st.isFile()) {
        found = readFileSync(hit, 'utf8').includes(symbolName);
      } else {
        for (const f of readdirSync(hit)) {
          const fp = join(hit, f);
          try { if (statSync(fp).isFile() && readFileSync(fp, 'utf8').includes(symbolName)) { found = true; break; } }
          catch { /* okunamayan dosya - atla */ }
        }
      }
    } catch { found = false; }
    const astHint = found ? null : astSecondOpinion(symbolName, process.cwd());
    return { status: found ? 'ok' : 'sembol-yok', symbolName, astHint };
  }

  function frontmatter(text) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return m ? m[1] : '';
  }

  const LIST_BLOCK_BODY = /(?:[ \t]+\S.*(?:\r?\n|$)|[ \t]*(?:\r?\n|$))+/.source;
  function extractObjectBodies(fm, field) {
    const bodies = [];
    const inlineM = fm.match(new RegExp('^' + field + ':[ \\t]*\\[([\\s\\S]*?)\\]', 'm'));
    if (inlineM && inlineM[1].trim()) {
      for (const b of inlineM[1].match(/\{[^{}]*\}/g) || []) bodies.push({ raw: b.slice(1, -1), inline: true });
      if (!/\{/.test(inlineM[1])) {
        for (const s of inlineM[1].match(/["']([^"']+)["']/g) || []) bodies.push({ raw: null, str: s.replace(/["']/g, ''), inline: true });
      }
      return bodies;
    }
    const block = fm.match(new RegExp('^' + field + ':[ \\t]*\\r?\\n(' + LIST_BLOCK_BODY + ')', 'm'));
    if (block) {
      // v0.30.4: liste kardeş anahtara TAŞMAZ (bkz. anchor-resolve.mjs extractObjectBodies).
      let itemIndent = -1;
      for (const line of block[1].split('\n')) {
        if (!line.trim() || /^\s*#/.test(line)) continue;   // boş/yorum satırı listeyi bölmez
        const ind = line.match(/^[ \t]*/)[0].length;
        const isItem = /^\s+-(\s|$)/.test(line);
        if (itemIndent < 0) { if (isItem) itemIndent = ind; else continue; }
        else if (isItem ? ind < itemIndent : ind <= itemIndent) break;
        const objM = line.match(/^\s+-\s+\{(.+)\}\s*$/);
        if (objM) { bodies.push({ raw: objM[1], inline: false }); continue; }
        const strM = line.match(/^\s+-\s+["']?(.+?)["']?\s*$/);
        if (strM) bodies.push({ raw: null, str: strM[1].trim(), inline: false });
      }
    }
    return bodies;
  }

  function readConstants(fm) {
    const items = [];
    for (const b of extractObjectBodies(fm, 'constants')) {
      if (b.raw == null) { items.push({ name: b.str || '(isimsiz)', anchor: null }); continue; }
      const anchorM = b.raw.match(/anchor:\s*["']?([^,"'}]+)["']?/);
      const nameM = b.raw.match(/name:\s*["']?([^,"'}]+)["']?/);
      items.push({ name: nameM ? nameM[1].trim() : '(isimsiz)', anchor: anchorM ? anchorM[1].trim() : null });
    }
    return items;
  }

  function readVerifiedAbsences(fm) {
    const items = [];
    for (const b of extractObjectBodies(fm, 'verified_absences')) {
      if (b.raw == null) {
        items.push({ claim: b.str || '(iddia yazılmamış)', hasEvidence: false });
        continue;
      }
      const claimM = b.raw.match(/claim:\s*"([^"]*)"/) || b.raw.match(/claim:\s*'([^']*)'/);
      const evidenceM = b.raw.match(/evidence:\s*"([^"]*)"/) || b.raw.match(/evidence:\s*'([^']*)'/);
      const anchorM = b.raw.match(/anchor:\s*["']?([^,"'}]+)["']?/);
      items.push({
        claim: claimM ? claimM[1].trim() : '(iddia yazılmamış)',
        hasEvidence: !!(evidenceM && evidenceM[1].trim()) || !!anchorM,
      });
    }
    return items;
  }

  function readAnchorsField(fm) {
    const items = [];
    for (const b of extractObjectBodies(fm, 'anchors')) {
      if (b.raw == null) continue;
      const repoM = b.raw.match(/repo:\s*["']?([^,"'}]+)["']?/);
      const symbolM = b.raw.match(/symbol:\s*["']?([^,"'}]+)["']?/);
      if (repoM && symbolM) items.push({ repo: repoM[1].trim(), symbol: symbolM[1].trim() });
    }
    return items;
  }

  const dead = [];
  // v0.30.4 GITIGNORE MUAFİYETİ (saha: saha-B F-021, saha-A PRODUCT_LOG:54): rehberdeki backtick'li yol .gitignore'daysa
  // taze checkout'ta YOKTUR ama ölü referans DEĞİLDİR (yerel/üretilen artefakt, ör. `data/app.db`). Yalnız var olmayan VE
  // ignore EDİLMEYEN yol FAIL. Ölü adaylar toplanır, döngü sonunda TEK `git check-ignore -z --stdin` çağrısıyla (toplu; aday
  // kümesi tekilleştirilmiş = önbellekli) sınanır. git çalışmazsa (exit 128 / git yok) "ignore değil" SESSİZCE varsayılmaz:
  // güvenli taraf (ölü say) + görünür uyarı. exit 1 = git'in kesin cevabı "hiçbiri ignore değil".
  const oluAdayi = (msg, tok) => dead.push({ msg, tok });
  const soft = [];
  const missing = [];   // argümanla verildi ama diskte yok — ŞÜPHELİ (ana ajan ölçtü: 2026-08-06)
  let checked = 0;
  let scanned = 0;   // GERÇEKTEN okunan doküman sayısı — docs.length NİYET EDİLENİ sayar, bunu değil
  for (const doc of docs) {
    if (!existsSync(doc)) { if (args.length) missing.push(doc); continue; }
    scanned++;
    const docDir = dirname(doc);
    readFileSync(doc, 'utf8').split('\n').forEach((line, i) => {
      const loc = `${doc}:${i + 1}`;
      for (const m of line.matchAll(BACKTICK)) {
        const tok = m[1].replace(/\/$/, '');
        if (!looksPath(tok, docDir)) continue;
        if (ignore.some(p => tok.startsWith(p))) continue;
        if (URETILEN.some(p => tok.startsWith(p))) continue;   // üretilen/izlenmeyen yol → ortam-bağımsız muafiyet
        checked++;
        const alive = existsSync(tok) || existsSync(join(docDir, tok)) ||
          pkgRoots.some(r => existsSync(join(r, tok))) || suffixMatchTekAnlamli(tok);
        if (!alive && !isHistoricalPath(doc, tok)) oluAdayi(`${loc}  →  yol yok: ${tok}`, tok);
      }
      for (const m of line.matchAll(ANCHOR)) {
        for (const raw of m[1].split(',')) {
          const tok = raw.trim().replace(/\/$/, '');
          if (!looksPath(tok, docDir)) continue;
          if (ignore.some(p => tok.startsWith(p))) continue;
          if (URETILEN.some(p => tok.startsWith(p))) continue;   // üretilen/izlenmeyen yol → ortam-bağımsız muafiyet
          checked++;
          const alive = existsSync(tok) || existsSync(join(docDir, tok)) ||
            pkgRoots.some(r => existsSync(join(r, tok))) || suffixMatchTekAnlamli(tok);
          if (!alive && !isHistoricalPath(doc, tok)) oluAdayi(`${loc}  →  ölü anchor yolu: ${tok}`, tok);
        }
      }
      if (hasPkg) for (const m of line.matchAll(RUN)) {
        const name = m[1];
        if (PM_BUILTINS.has(name) || cmdIgnored(name, m[0])) continue;
        checked++;
        if (!(name in npmScripts)) dead.push(`${loc}  →  script yok (package.json): ${name}`);
      }
      for (const m of line.matchAll(MAKE)) { if (!makeTargets.size || cmdIgnored(m[1], m[0])) continue; checked++;
        if (!makeTargets.has(m[1])) dead.push(`${loc}  →  make target yok: ${m[1]}`); }
      for (const m of line.matchAll(JUST)) { if (!justTargets.size || cmdIgnored(m[1], m[0])) continue; checked++;
        if (!justTargets.has(m[1])) dead.push(`${loc}  →  just recipe yok: ${m[1]}`); }
      if (hasDotnet) for (const m of line.matchAll(DOTNET)) { if (cmdIgnored(m[1], m[0])) continue; checked++;
        if (!DOTNET_CMDS.has(m[1])) dead.push(`${loc}  →  dotnet alt-komutu yok: ${m[1]}`); }
      if (hasFlutter) for (const m of line.matchAll(FLUTTER)) { if (cmdIgnored(m[1], m[0])) continue; checked++;
        if (!FLUTTER_CMDS.has(m[1])) dead.push(`${loc}  →  flutter alt-komutu yok: ${m[1]}`); }
      if (hasTerraform) for (const m of line.matchAll(TERRAFORM)) { if (cmdIgnored(m[1], m[0])) continue; checked++;
        if (!TERRAFORM_CMDS.has(m[1])) dead.push(`${loc}  →  terraform alt-komutu yok: ${m[1]}`); }
      for (const m of line.matchAll(NODE)) {
        const tok = m[1];
        if (tok.includes('{{') || tok.includes('*') || tok.includes('<')) continue;
        if (ignore.some(p => tok.startsWith(p))) continue;
        if (URETILEN.some(p => tok.startsWith(p))) continue;   // üretilen/izlenmeyen yol → ortam-bağımsız muafiyet
        checked++;
        const alive = existsSync(tok) || existsSync(join(docDir, tok)) ||
          pkgRoots.some(r => existsSync(join(r, tok))) || suffixMatchTekAnlamli(tok);
        if (!alive && !isHistoricalPath(doc, tok)) oluAdayi(`${loc}  →  yol yok (node): ${tok}`, tok);
      }
    });

    const fullText = readFileSync(doc, 'utf8');
    const fm = frontmatter(fullText);
    if (fm) {
      for (const c of readConstants(fm)) {
        checked++;
        if (!c.anchor) {
          soft.push(`${doc}  →  constant '${c.name}' ANCHOR'SIZ — uydurma sayı riski (anchor: repo:symbol ekle)`);
          continue;
        }
        const r = resolveRepoSymbol(c.anchor, docDir);
        if (r.status === 'path-yok') soft.push(`${doc}  →  constant '${c.name}' anchor'ı ÖLÜ: ${c.anchor} (yol yok)`);
        else if (r.status === 'sembol-yok') soft.push(`${doc}  →  constant '${c.name}' anchor'ı SAHTE: ${c.anchor} (yol var, sembol '${r.symbolName}' dosyada YOK)${r.astHint ? ' ' + r.astHint : ''}`);
      }

      for (const a of readVerifiedAbsences(fm)) {
        checked++;
        if (!a.hasEvidence) {
          soft.push(`${doc}  →  verified_absence KANITSIZ: "${a.claim}" (anchor veya evidence yok — [L0] bu yokluğu YANLIŞ ima edebilir)`);
        }
      }

      for (const a of readAnchorsField(fm)) {
        checked++;
        const r = resolveRepoSymbol(`${a.repo}:${a.symbol}`, docDir);
        if (r.status === 'path-yok') soft.push(`${doc}  →  anchors[] ölü: ${a.repo}:${a.symbol} (yol yok — çapraz-repo anchor olabilir, DOĞRULANAMADI)`);
        else if (r.status === 'sembol-yok') soft.push(`${doc}  →  anchors[] sahte: ${a.repo}:${a.symbol} (yol var, sembol dosyada YOK)${r.astHint ? ' ' + r.astHint : ''}`);
      }
    }
  }

  {
    const adaylar = [...new Set(dead.filter(d => typeof d === 'object').map(d => d.tok))];
    if (adaylar.length) {
      const r = spawnSync('git', ['check-ignore', '-z', '--stdin'], { input: adaylar.join('\0') + '\0', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      const bilinmiyor = r.error || (r.status !== 0 && r.status !== 1);
      const ignored = new Set(bilinmiyor ? [] : String(r.stdout || '').split('\0').filter(Boolean));
      if (bilinmiyor) console.error(`\nDOC-TRUTH UYARI — git check-ignore çalışamadı (${r.error ? r.error.code || 'hata' : 'exit ' + r.status}): ${adaylar.length} yolun .gitignore durumu DOĞRULANAMADI, güvenli tarafta (ölü referans) sayıldı.\n`);
      // Görünürlük: muafiyet sessiz değil — kaç yol .gitignore'lı sayılıp ölü sayılmadı, ilk 5'i (exit kodu etkilenmez).
      if (ignored.size) { const l = [...ignored]; console.warn(`\nDOC-TRUTH NOT — ${l.length} yol .gitignore'lı — ölü sayılmadı: ${l.slice(0, 5).join(', ')}${l.length > 5 ? ', …' : ''}\n`); }
      for (let i = dead.length - 1; i >= 0; i--) {
        if (typeof dead[i] !== 'object') continue;
        if (ignored.has(dead[i].tok)) dead.splice(i, 1); else dead[i] = dead[i].msg;
      }
    }
  }

  if (dead.length) {
    console.error(`\nDOC-TRUTH FAIL (${dead.length} ölü referans):\n` + dead.map(d => '  ' + d).join('\n'));
    console.error('\nYapilacak: ya referansi gercege gore duzelt, ya tasinan dosyanin/komutun yeni adini yaz.');
    console.error('Rehber gercegi yansitmak zorunda — "test yok derken 1504 test vardi" felaketinin panzehiri budur.\n');
    return 1;
  }

  if (soft.length) {
    const label = strict ? 'DOC-TRUTH FAIL' : 'DOC-TRUTH UYARI';
    console.error(`\n${label} (${soft.length} [T] frontmatter bulgusu):\n` + soft.map(d => '  ' + d).join('\n'));
    console.error('\nBunlar [T] şablonunun (templates/T-teknik-dokuman.template.md) ANCHOR/KANIT');
    console.error('zorunluluklarını çiğniyor — kural nesirde vardı, kod ZORLAMIYORDU (dış denetim 2026-07-14/15).');
    console.error('DÜRÜST SINIR: bu kapı verified_absences maddesinin DOĞRU olduğunu KANITLAYAMAZ (o E2/hakem işi);');
    console.error('yalnız KANITSIZ bırakıldığını yakalar. constants/anchors için yol+sembol varlığı deterministiktir (E0).');
    if (strict) { console.error('(--strict: commit/CI bloke edildi)\n'); return 1; }
    console.error('(--strict ile bu bulgular commit/CI\'ı bloke eder; şimdilik uyarı.)\n');
  }

  if (missing.length) {
    console.error(`\nDOC-TRUTH FAIL — ${missing.length} verilen dosya diskte YOK:\n` +
      missing.map(f => `  ${f}`).join('\n'));
    console.error('\n  "temiz" ile "hiç bakmadım" farklıdır: argümanla verilen dosya okunamadıysa kayıptır,');
    console.error('  atlanmış "iş yapıldı" sayılamaz (verify.mjs:70 itirafıyla aynı sınıf).\n');
    return 1;
  }

  // Boş-küme körlüğü (v0.18.2, pilot bulgusu A): GERÇEKTEN okunan (scanned) 0 demek "hiç bakılmadı"
  // demektir, "temiz" değil — liste `.filter(existsSync)` ile boşalmış olabilir (verify.mjs:70
  // itirafı). Ana ajan ölçtü (2026-08-06): docs.length NİYET EDİLENİ sayardı, scanned GERÇEĞİ sayar.
  // --allow-empty YOKSA bu FAIL'dir; VARSA bilinçli boş küme olarak geçilir.
  // v0.30.5: açık argümanların HEPSİ kapsam dışıysa bu "hiç bakmadım" değil, kapsam kararıdır → boş-küme FAIL'i uygulanmaz.
  if (scanned === 0 && args.length > 0 && docs.length === 0) {
    console.log(`Doc-truth OK — 0 rehber (${kapsamDisiArg} argüman kapsam dışı) [taranan=0]`);
    return 0;
  }
  if (scanned === 0 && !allowEmpty) {
    console.error('\nDOC-TRUTH FAIL — taranan dosya sayısı 0.');
    console.error('  "temiz" ile "hiç bakmadım" farklıdır: verilen/bulunan dosya listesi boş kaldı.');
    console.error('  Liste nasıl üretildiyse orayı kontrol et (git ls-files filtresi, argüman, .filter(existsSync)).');
    console.error('  Bilinçli boş küme ise --allow-empty ile geçirilebilir.\n');
    return 1;
  }
  console.log(`Doc-truth OK — ${scanned} rehber dosyada ${checked} referans doğrulandı.${scanned === 0 ? ' (--allow-empty: boş küme bilinçli)' : ''} [taranan=${scanned}]`);
  return 0;
}
