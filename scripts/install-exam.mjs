#!/usr/bin/env node
// K3 ÇIKIŞ SINAVI (v0.10 YENİ) — SAVAŞTIĞI ENTROPİ: "kurulu ≠ çalışıyor" (pilot dersi,
// reference/pilot-dersleri.md §1). Başka bir projede kapılar BİR AYDIR kuruluydu ve
// doc-recency HİÇBİR ŞEY yapmıyordu — repoda doc-anchor sayısı SIFIRDI. Kapı vardı, yakıtı
// yoktu, sessizce NO-OP koşuyordu. Bu script kurulumun SONUNDA hedef repoya karşı koşulur ve
// "kuruldu" yerine "çalışıyor" iddiasını MAKİNEYLE kanıtlar.
//
// 🔴 TASARIM KURALI (archive/SKILL-V1-PLANI.md §4, Bulgu 3): VARLIK değil ETKİ ölçülür.
// rev.1'in 5 kontrolü (anchor>0, ateşleme>=1, "registry dolu", "CI dosyası var", model ping)
// hepsi VARLIK ölçüyordu — tek sahte anchor/kayıt yazan sınavı geçerdi. Bu sürümden itibaren
// her kontrol etki-ölçerdir; ölçemediği yerde UYDURMAZ, "[ÖLÇÜLEMEDİ: sebep]" yazar.
// (Kontrol sayısı SABİT YAZILMAZ — bayatlar; güncel liste = aşağıdaki koşum bloğu + CONTRACT.md.)
//
// Kullanım: node scripts/install-exam.mjs [--target=<dir>] [--json]
//   --target=<dir>  sınanacak HEDEF repo (varsayılan: cwd). Bu script PAKETİN kendi kapılarını
//                   (gates/*.mjs) hedef repo köküne karşı çalıştırır — kapılar hedefe kopyalanmış
//                   olabilir de olmasa da (kopya değilse paketin sürümüyle sınanır, STATE'e not düş).
//   --json          makine-okunur çıktı (CI/otomasyon için); varsayılan insan-okunur STATE satırı.
// Çıkış kodu: kontrollerin TÜMÜ geçerse 0, herhangi biri FAIL ise 1. ÖLÇÜLEMEDİ ayrı sınıftır —
//   tek başına sınavı düşürmez (ölçüm altyapısı eksik ≠ kurulum bozuk) ama STATE'e dürüstçe yazılır.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { astSecondOpinion } from '../gates/lib/anchor-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, '..');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const targetArg = argv.find(a => a.startsWith('--target='));
const TARGET = resolve(targetArg ? targetArg.slice('--target='.length) : process.cwd());

const isGitRepo = (dir) => {
  try { execSync('git rev-parse --is-inside-work-tree', { cwd: dir, stdio: 'pipe' }); return true; }
  catch { return false; }
};

const results = []; // { id, name, verdict: 'PASS'|'FAIL'|'ÖLÇÜLEMEDİ'|'UYGULANAMAZ', detail }

// --- v0.10 DEAK §5.1: AST-indeks ikinci-görüşü (OPSİYONEL, fail-open) ---
// astSecondOpinion() gates/lib/anchor-resolve.mjs'te yaşar (kapılarla paylaşılan tek kopya).
// BURADA FARK: çağıran repoRoot = TARGET verir (bu araç HEDEF repoya karşı koşar, cwd'ye değil).

// ============================================================================
// ① ANCHOR ÇÖZÜNÜRLÜĞÜ — VARLIK değil ETKİ: "anchor var mı" değil "anchor'ların
// ≥%90'ı GERÇEK sembole çözülüyor mu" (dosya VAR **ve** sembol o dosyanın İÇİNDE var).
// NEDEN bu eşik: pilotta doc-anchor sayısı sıfırdı (kapı hiç ateşlemiyordu) — ama "anchor>0"
// da yeterli değil: tek sahte/bozuk anchor yazıp geçmek mümkün. Çözünürlük oranı OYUNLANAMAZ:
// her anchor gerçekten var olan bir dosya/sembole işaret etmek ZORUNDA.
// ============================================================================
function checkAnchorResolution() {
  const id = '①'; const name = 'Anchor çözünürlüğü';
  if (!isGitRepo(TARGET)) return results.push({ id, name, verdict: 'ÖLÇÜLEMEDİ', detail: 'hedef bir git reposu değil' });

  let tracked = [];
  try {
    tracked = execSync('git ls-files', { cwd: TARGET, maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean);
  } catch { return results.push({ id, name, verdict: 'ÖLÇÜLEMEDİ', detail: 'git ls-files başarısız' }); }

  const mdFiles = tracked.filter(f => /\.md$/i.test(f));
  // `check-doc-integrity --rule=doc-recency` ile AYNI regex. Bu araç hedefin kapı dosyalarını import
  // etmez (hedefte kapı dizini farklı olabilir) → bilinçli kopya; değişirse ikisi birlikte güncellenir.
  const ANCHOR = /<!--\s*doc-anchor:\s*([^>]+?)\s*-->/gi;
  // looksPath — doc-truth alt-kuralındaki (gates/lib/doc-integrity/doc-truth.mjs) AYNI filtre (aynı
  // gerekçeyle bilinçli kopya). Bunsuz prose içinde SÖZDE-anchor (örn. CONTRACT.md'nin
  // kendi `<!-- doc-anchor: yol -->` SÖZ-DİZİMİNİ AÇIKLARKEN ürettiği literal eşleşme, "yol" kelimesi gibi
  // yol-GÖRÜNMEYEN token'lar) yanlış-FAIL üretir — doc-truth bunu zaten eler, install-exam da elemeli.
  // ⭐ İKİ anchor biçimi tanınır (dış denetim düzeltmesi, 2026-07-14):
  //   (a) düz yol           → `src/auth/LoginService.cs`  (module-claude kalıbı)
  //   (b) repo:symbol       → `pilot-backend:LoginCommandHandler`  (registry kalıbı)
  // ESKİ looksPath yalnız (a)'yı tanıyordu → `:` içeren HER anchor SESSİZCE ELENİYORDU.
  // Sonuç: registry-kalıbı anchor'lar sayılmıyor, sembol doğrulaması HİÇ ÇALIŞMIYORDU
  // (ve "hiç anchor yok" gibi YANLIŞ bir teşhis üretiliyordu).
  const isUrl = s => /^(https?|mailto|ftp):/i.test(s);
  const bad = s => s.includes('{{') || s.includes('*') || s.includes('<');
  const looksPlainPath = s => /^[\w.@-]+(\/[\w.()[\]@-]+)+\/?$/.test(s);
  // sol taraf: repo adı VEYA yol (`pilot-backend` | `src/auth` | `src/auth/Login.cs`)
  // sağ taraf: SEMBOL (`LoginService`, `AuthOptions#ResetTokenExpiryHours`)
  const looksRepoSymbol = s => /^[\w.@/-]+:[\w.#$-]+$/.test(s) && !isUrl(s);
  const looksPath = s => !bad(s) && !isUrl(s) && (looksPlainPath(s) || looksRepoSymbol(s));

  const anchors = []; // { doc, raw }
  for (const doc of mdFiles) {
    const p = join(TARGET, doc);
    if (!existsSync(p)) continue;
    let content;
    try { content = readFileSync(p, 'utf8'); } catch { continue; }
    for (const m of content.matchAll(ANCHOR)) {
      for (const raw of m[1].split(',')) {
        const tok = raw.trim();
        if (!tok || !looksPath(tok)) continue; // doldurulmamış placeholder / yol-görünmeyen token — sayılmaz
        anchors.push({ doc, tok });
      }
    }
  }

  // 🔴 ANCHOR YOKSA = FAIL (ÖLÇÜLEMEDİ DEĞİL) — dış denetim bulgusu (2026-07-14, GPT-5.6).
  // Eski hâli 'ÖLÇÜLEMEDİ' dönüyordu ve ÖLÇÜLEMEDİ çıkış kodunu BOZMUYOR → "yakıtsız kapı"
  // kurulum BAŞARISIZLIĞI sayılmıyordu. Ama bu, pilotun ta kendisi: kapı kurulu, anchor SIFIR,
  // doc-recency 1 AY no-op koştu. Ölçülemeyen bir şey değil bu — ÖLÇÜLDÜ ve SIFIR ÇIKTI.
  // "Yakıt yok" bir belirsizlik değil, bir BAŞARISIZLIKTIR.
  if (!anchors.length) {
    return results.push({ id, name, verdict: 'FAIL',
      detail: 'repoda HİÇ doc-anchor YOK → doc-recency kurulu olsa bile YAKITSIZ, NO-OP koşar. '
        + 'Bu, pilotun birebir tekrarıdır ("kurulu ≠ çalışıyor"). Kurulum "kapı kuruldu" DİYEMEZ — '
        + 'önce anchor EKİLMELİ (kapı kurmak yetmez).' });
  }

  let resolved = 0;
  const broken = [];
  for (const { doc, tok } of anchors) {
    const clean = tok.replace(/\/$/, '');
    // ⭐ repo:symbol → path VE SEMBOL ayrı ayrı doğrulanır (dış denetim bulgusu, 2026-07-14).
    // ESKİ HÂLİ: sembol kısmı ATILIYOR, yalnız existsSync(path) bakılıyordu → OYUNLANABİLİRDİ:
    //   `<!-- doc-anchor: src/gercek-dizin:UydurmaSembol -->` → dizin var → "çözüldü" sayılırdı.
    // Bu, sınavın kendisinin VARLIK ölçmesiydi (bu projenin ANA HASTALIĞI, üçüncü tekrarı).
    // ŞİMDİ: sembol varsa, o sembol dosyanın İÇİNDE GERÇEKTEN geçiyor mu diye BAKILIR.
    // İki biçim:
    //   (a) düz yol      `src/auth/Login.cs`     → yol VAR MI?
    //   (b) sol:sağ      `src/auth:LoginService` → yol VAR MI **VE** sembol dosyanın İÇİNDE Mİ?
    //                    (registry kalıbında sol=repo/dizin, sağ=SEMBOL — sağ tarafta '/' yok)
    const colonIdx = clean.indexOf(':');
    const hasColon = colonIdx > 0;
    const left = hasColon ? clean.slice(0, colonIdx) : clean;
    const right = hasColon ? clean.slice(colonIdx + 1) : null;
    // sağ taraf '/' içeriyorsa o da bir YOLDUR (sembol değil) → sembol doğrulaması yapılmaz
    const symbolName = right && !right.includes('/') ? right.replace(/^#/, '') : null;
    const searchPath = left;

    const candidates = [
      join(TARGET, searchPath),
      join(TARGET, dirname(doc), searchPath),
    ];
    const hit = candidates.find(c => existsSync(c));
    if (!hit) {
      // 🔴 `repo:Symbol` biçiminde sol taraf BAŞKA BİR REPO olabilir (pilot core-8 kalıbı:
      // `pilot-backend:LoginCommandHandler`). Bu repoda o yol YOKTUR — ama bu, anchor'ın
      // SAHTE olduğu anlamına gelmez, ÇAPRAZ-REPO olduğu anlamına gelir. Sessizce "çözüldü"
      // saymak YANLIŞ GÜVEN olurdu → ayrı sayılır ve DÜRÜSTÇE raporlanır.
      broken.push(`${doc} → ${tok}  (yol bu repoda YOK${symbolName ? ' — çapraz-repo anchor olabilir, DOĞRULANAMADI' : ''})`);
      continue;
    }

    // 🔴 SEMBOL DOĞRULAMASI — path var diye geçmez; sembol dosyanın İÇİNDE OLMALI.
    if (symbolName) {
      let found = false;
      try {
        const st = statSync(hit);
        if (st.isFile()) {
          found = readFileSync(hit, 'utf8').includes(symbolName);
        } else {
          // dizin → altındaki dosyalarda ara (1 seviye, ucuz)
          for (const f of readdirSync(hit)) {
            const fp = join(hit, f);
            try {
              if (statSync(fp).isFile() && readFileSync(fp, 'utf8').includes(symbolName)) { found = true; break; }
            } catch { /* okunamayan dosya - atla */ }
          }
        }
      } catch { found = false; }
      if (!found) {
        // v0.10 DEAK §5.1: yalnız BULUNAMADIĞINDA ikinci-görüş. Verdict DEĞİŞMEZ (sahte-anchor yine FAIL).
        const astHint = astSecondOpinion(symbolName, TARGET);
        broken.push(`${doc} → ${tok}  (yol VAR ama SEMBOL '${symbolName}' dosyada YOK — sahte anchor)${astHint ? ' ' + astHint : ''}`);
        continue;
      }
    }
    resolved++;
  }

  const pct = anchors.length ? (resolved / anchors.length) * 100 : 0;
  const verdict = pct >= 90 ? 'PASS' : 'FAIL';
  results.push({
    id, name, verdict,
    detail: `${resolved}/${anchors.length} anchor (%${pct.toFixed(0)}) GERÇEK SEMBOLE çözülüyor (yol VAR + sembol dosyanın İÇİNDE; eşik %90)`
      + (broken.length ? `; ÇÖZÜLEMEYEN: ${broken.slice(0, 5).join(' | ')}${broken.length > 5 ? ` (+${broken.length - 5} daha)` : ''}` : ''),
  });
}

// ============================================================================
// ② 🔴 KAPI NEGATİF KONTROLÜ — SINAVIN KALBİ. Ateşleyen ama bilerek bozulmuş bir DENEK
// dosyayı YAKALAMAYAN kapı, ateşlese bile ÇALIŞMIYORDUR. "Kapı kurulu" bir VARLIK iddiasıdır;
// "kapı gerçekten ihlali yakalıyor" bir ETKİ iddiasıdır — yalnız bunu koşarak kanıtlarız.
// Denek dosyalar GEÇİCİ (os temp dizini) — sınav sonunda SİLİNİR, hedef repoyu KİRLETMEZ.
// ============================================================================
// v0.20 — İKİ DÜZELTME (pilot geri bildirimi 2026-08-11 §5.3):
//
// 🔴 (A) SAHTE PASS DÜZELTİLDİ: bu kontrol v0.16 kapı konsolidasyonundan (20→6) beri BOŞLUĞA
//    koşuyordu. Çağırdığı `check-secrets.mjs`/`check-utf8.mjs`/`check-doc-truth.mjs` dosyaları
//    v0.16'da SİLİNMİŞTİ; `node <olmayan-dosya>` MODULE_NOT_FOUND ile exit 1 döndürüyor, kontrol
//    de "exit≠0 → kapı YAKALADI" diye okuyup **PASS** veriyordu. Yani "kurulu ≠ çalışıyor"
//    dersini zorlayan kontrolün KENDİSİ o hataya düşmüştü. Artık çöküş ile yakalama AYRI:
//    modül bulunamazsa/çalıştırılamazsa bu ÇALIŞTIRILAMADI'dır, yakalama DEĞİL.
//
// (B) ÇİFT YÖNLÜ ölçüm (doctrine v0.20 "iki-yönlü doğum"): tek yön yetmez.
//    • YAKALAMA kontrolü — bozuk denek → kapı exit≠0 vermeli (kapı ölü mü?)
//    • GEÇİRME kontrolü — MEŞRU denek → kapı exit 0 vermeli (kapı yanlış-pozitif üretiyor mu?)
//    İkincisi atlanırsa kapı sahada yanlış alarma boğulur ve ekip onu kapatır — sonuç, kapıyı
//    hiç yazmamakla aynıdır. İki yön de geçmeden bu kontrol PASS vermez.
function checkGateNegativeControl() {
  const id = '②'; const name = 'Kapı negatif kontrolü (çift yönlü)';

  // Hedef repoda kapılar hangi kanonik konumda? (SKILL.md FAZ 2 madde 3: scripts/gates/ default,
  // ya da mevcut hook/CI kök gates/'e bağlıysa o.) İkisi de yoksa PAKETİN kendi gates/'iyle sına.
  // 🔴 Arama KATEGORİ script'i üzerinden yapılır (v0.16 sonrası kanonik ad) — eski tekil adlar
  // aranırsa hiçbir kurulum bulunamaz ve sessizce fallback'e düşülür (A hatasının kaynağı).
  const candidateDirs = [join(TARGET, 'scripts', 'gates'), join(TARGET, 'gates')];
  const gatesDir = candidateDirs.find(d => existsSync(join(d, 'check-hygiene.mjs')));
  const usingPackageFallback = !gatesDir;
  const dir = gatesDir || join(PKG_ROOT, 'gates');

  // Kapıyı koş; çöküşü (modül yok / spawn hatası) yakalamadan AYIRT ET.
  const kosu = (script, args, cwd) => {
    const p = join(dir, script);
    if (!existsSync(p)) return { crashed: true, status: null, neden: `kapı dosyası YOK: ${script}` };
    const r = spawnSync('node', [p, ...args], { encoding: 'utf8', cwd });
    const out = ((r.stdout || '') + (r.stderr || ''));
    if (r.error) return { crashed: true, status: null, neden: `çalıştırılamadı: ${r.error.message}` };
    if (/Cannot find module|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/i.test(out))
      return { crashed: true, status: r.status, neden: 'modül çözülemedi' };
    if (/bilinmeyen --rule/i.test(out))
      return { crashed: true, status: r.status, neden: 'alt-kural bu sürümde YOK' };
    return { crashed: false, status: r.status, out };
  };

  const denekDir = mkdtempSync(join(tmpdir(), 'install-exam-denek-'));
  const findings = [];
  const ekle = (kapi, kirli, temiz) => findings.push({
    kapi,
    crashed: kirli.crashed || temiz.crashed,
    neden: kirli.neden || temiz.neden || null,
    yakaladi: !kirli.crashed && kirli.status !== 0,
    gecirdi: !temiz.crashed && temiz.status === 0,
    gercek: `kirli exit=${kirli.status}, temiz exit=${temiz.status}`,
  });

  try {
    // Denek 1 — secrets. KİRLİ: gerçek biçimli AWS anahtarı (HIGH_ALWAYS deseni, placeholder
    // filtresine takılmayacak şekilde — CONTRACT "Bilinen sınırlar" uyarısı). TEMİZ: sıradan env.
    {
      const kirliF = join(denekDir, 'secret-kirli.env');
      const temizF = join(denekDir, 'secret-temiz.env');
      writeFileSync(kirliF, 'AWS_KEY=AKIAABCDEFGHIJKLMNOP\n');
      writeFileSync(temizF, 'APP_NAME=demo\nPORT=3000\n');
      ekle('check-hygiene --rule=secrets',
        kosu('check-hygiene.mjs', ['--rule=secrets', '--all', kirliF]),
        kosu('check-hygiene.mjs', ['--rule=secrets', '--all', temizF]));
    }
    // Denek 2 — utf8. KİRLİ: BOM'lu dosya. TEMİZ: BOM'suz Türkçe karakterli geçerli UTF-8
    // (yalnız ASCII yazmak GEÇİRME kontrolünü zayıflatırdı — çok-baytlı diziyi de sınamalı).
    {
      const kirliF = join(denekDir, 'bom-kirli.txt');
      const temizF = join(denekDir, 'bom-temiz.txt');
      writeFileSync(kirliF, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('merhaba\n')]));
      writeFileSync(temizF, 'merhaba şğüıöç\n', 'utf8');
      ekle('check-hygiene --rule=utf8',
        kosu('check-hygiene.mjs', ['--rule=utf8', kirliF]),
        kosu('check-hygiene.mjs', ['--rule=utf8', temizF]));
    }
    // v0.27 — integration-cards (K75). K73'ün "nasıl ölür" uyarısı tam buydu: yeni alt-kural
    // install-exam ②'ye eklenmez ve sınav-dışı kalır. KİRLİ: dış SDK var, kart yok. TEMİZ: aynı
    // SDK + dolu kart. `--strict` ŞART (varsayılan UYARI = exit 0). Kapı çalışma dizinine göre
    // `docs/integrations/` arar → iki ayrı alt dizin, cwd ile ayrılır.
    {
      const pkgJson = JSON.stringify({ dependencies: { '@aws-sdk/client-sesv2': '^3' } });
      const kirliD = join(denekDir, 'kart-kirli');
      const temizD = join(denekDir, 'kart-temiz');
      mkdirSync(kirliD, { recursive: true });
      mkdirSync(join(temizD, 'docs', 'integrations'), { recursive: true });
      writeFileSync(join(kirliD, 'package.json'), pkgJson);
      writeFileSync(join(temizD, 'package.json'), pkgJson);
      writeFileSync(join(temizD, 'docs', 'integrations', 'aws-ses.md'), [
        '---', 'servis: AWS SES', 'paketler: ["@aws-sdk/*"]',
        'kaynak: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html',
        `dogrulandi: ${new Date().toISOString().slice(0, 10)}`, 'boyutlar: [bolge, ortam]',
        'prob: "aws sesv2 get-account --region <bolge>"', '---', '# AWS SES', '',
      ].join('\n'));
      ekle('check-provenance --rule=integration-cards',
        kosu('check-provenance.mjs', ['--rule=integration-cards', '--strict', 'package.json'], kirliD),
        kosu('check-provenance.mjs', ['--rule=integration-cards', '--strict', 'package.json'], temizD));
    }
    // Denek 3 — doc-truth. Kendi izole git reposu gerekir (kapı `git ls-files` çağırır) —
    // TARGET/PKG_ROOT kirletilmez. KİRLİ: ölü yol referansı. TEMİZ: GERÇEKTEN var olan yol.
    {
      const gitDenek = mkdtempSync(join(tmpdir(), 'install-exam-doctruth-'));
      try {
        // 🔴 stdio:'pipe' ZORUNLU — execSync varsayılanı stderr'i EBEVEYNE aktarır ve `--json`
        // modunda çıktıyı kirletir (Windows'ta `git add` "LF will be replaced by CRLF" uyarısı
        // basar → JSON.parse patlar). autocrlf=false uyarıyı ayrıca kaynağında keser.
        const g = (cmd) => execSync(cmd, { cwd: gitDenek, stdio: 'pipe' });
        g('git init -q');
        g('git config user.email denek@example.com');
        g('git config user.name denek');
        g('git config core.autocrlf false');
        mkdirSync(join(gitDenek, 'src'), { recursive: true });
        writeFileSync(join(gitDenek, 'src', 'var.ts'), 'export const x = 1;\n');
        writeFileSync(join(gitDenek, 'KIRLI.md'), 'Şuna bak: `src/olmayan-dosya-XYZ.ts`\n');
        writeFileSync(join(gitDenek, 'TEMIZ.md'), 'Şuna bak: `src/var.ts`\n');
        g('git add -A');
        ekle('check-doc-integrity --rule=doc-truth',
          kosu('check-doc-integrity.mjs', ['--rule=doc-truth', 'KIRLI.md'], gitDenek),
          kosu('check-doc-integrity.mjs', ['--rule=doc-truth', 'TEMIZ.md'], gitDenek));

        // v0.26 — FACTS: kapı ETKİ ediyor mu? Kirli = işaretli hücre ölçümle ÇELİŞİYOR (exit 1),
        // temiz = hücre ölçümle EŞİT (exit 0). Çift yönlü, çünkü tek yönlü sınav yanlış-alarma
        // boğulan bir kapıyı da "çalışıyor" sayar (ALTIN KURAL ②b: yakalama + geçirme).
        // NOT: `--strict` ŞART — kapının varsayılanı UYARI'dır (exit 0), sınav FAIL'i görmeli.
        writeFileSync(join(gitDenek, 'facts.json'), JSON.stringify({
          generated_by: 'install-exam', measurements: { test_count: { status: 'measured', value: 100 } },
        }, null, 2) + '\n');
        writeFileSync(join(gitDenek, 'FACTS-KIRLI.md'), 'Test: <!--fact:test_count-->99<!--/fact--> yeşil\n');
        writeFileSync(join(gitDenek, 'FACTS-TEMIZ.md'), 'Test: <!--fact:test_count-->100<!--/fact--> yeşil\n');
        g('git add -A');
        ekle('check-doc-integrity --rule=facts-drift',
          kosu('check-doc-integrity.mjs', ['--rule=facts-drift', '--strict', 'FACTS-KIRLI.md'], gitDenek),
          kosu('check-doc-integrity.mjs', ['--rule=facts-drift', '--strict', 'FACTS-TEMIZ.md'], gitDenek));
      } finally { rmSync(gitDenek, { recursive: true, force: true }); }
    }
  } finally {
    rmSync(denekDir, { recursive: true, force: true });
  }

  const bozuk = findings.filter(f => f.crashed || !f.yakaladi || !f.gecirdi);
  const verdict = bozuk.length === 0 ? 'PASS' : 'FAIL';
  results.push({
    id, name, verdict,
    detail: findings.map(f => {
      if (f.crashed) return `${f.kapi}: ⚠ ÇALIŞTIRILAMADI (${f.neden}) — bu YAKALAMA SAYILMAZ`;
      const y = f.yakaladi ? 'yakaladı' : '⚠ YAKALAMADI (kapı ölü)';
      const g = f.gecirdi ? 'meşruyu geçirdi' : '⚠ MEŞRUYU BLOKLADI (yanlış-pozitif)';
      return `${f.kapi}: ${y} + ${g} (${f.gercek})`;
    }).join(' | ')
      + (usingPackageFallback ? ` [NOT: hedefte kopya kapı bulunamadı, PAKETİN kendi gates/'i ile sınandı — kurulum sonrası bu script hedefe kopyalanan kapılarla YENİDEN koşulmalı]` : ''),
  });
}

// ============================================================================
// ③ CI FİİLEN KOŞTU MU — workflow dosyasının VARLIĞI yetmez. `gh` varsa run geçmişi
// sorgulanır; yoksa "ÖLÇÜLEMEDİ" (uydurma yok — SKILL-V1-PLANI.md §4.1 talimatı).
// ============================================================================
function checkCiRanForReal() {
  const id = '③'; const name = 'CI fiilen koştu mu';
  const workflowsDir = join(TARGET, '.github', 'workflows');
  if (!existsSync(workflowsDir)) {
    return results.push({ id, name, verdict: 'UYGULANAMAZ', detail: 'hedefte .github/workflows yok (CI toggle kapalı ya da başka platform)' });
  }

  const ghCheck = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  if (ghCheck.status !== 0) {
    return results.push({ id, name, verdict: 'ÖLÇÜLEMEDİ',
      detail: 'workflow dosyası VAR ama `gh` CLI ortamda yok — run geçmişi sorgulanamadı (dosya varlığı TEK BAŞINA "koştu" kanıtı sayılmaz, uydurulmadı)' });
  }

  const r = spawnSync('gh', ['run', 'list', '--limit', '5', '--json', 'status,conclusion,createdAt'],
    { cwd: TARGET, encoding: 'utf8' });
  if (r.status !== 0) {
    return results.push({ id, name, verdict: 'ÖLÇÜLEMEDİ',
      detail: `\`gh run list\` başarısız (auth/remote yok olabilir): ${(r.stderr || r.stdout || '').trim().slice(0, 200)}` });
  }
  let runs = [];
  try { runs = JSON.parse(r.stdout || '[]'); } catch { /* boş bırak */ }
  if (!runs.length) {
    return results.push({ id, name, verdict: 'FAIL', detail: 'workflow dosyası var ama hiç run geçmişi yok — CI henüz FİİLEN koşmadı (push/PR tetiklenmemiş)' });
  }
  // 🔴 "KOŞTU" ≠ "GEÇTİ" (dış denetim bulgusu, 2026-07-14, GPT-5.6).
  // ESKİ HÂLİ: run geçmişi varsa KOŞULSUZ PASS — tüm run'lar FAIL olsa bile. `succeeded`
  // yalnız metinde geçiyordu, verdict'i etkilemiyordu. Bu, "CI koşuyor" varlığını ölçüp
  // "CI güvence veriyor" etkisini ölçmemekti.
  const succeeded = runs.filter(x => x.conclusion === 'success').length;
  if (succeeded === 0) {
    return results.push({ id, name, verdict: 'FAIL',
      detail: `son ${runs.length} run'ın HİÇBİRİ başarılı değil — CI koşuyor ama GEÇMİYOR. `
        + 'Kırmızı CI = otorite YOK (ekip zaten bypass ediyordur).' });
  }

  // 🔴 PİLOT VAKASI (Mobile, ÖLÇÜLDÜ): CI VAR + run geçmişi VAR ama workflow'da
  // test ADIMI YOK → yeşil pipeline, SIFIR test güvencesi. Yukarıdaki kontroller
  // bunu YAKALAMAZ. Workflow İÇERİĞİNDE test adımı aranmalı.
  const TEST_ADIMI = /(npm|pnpm|yarn|bun)\s+(run\s+)?test|dotnet\s+test|flutter\s+test|pytest|go\s+test|cargo\s+test|node\s+--test|vitest|jest|playwright/i;
  let testliWorkflow = 0, toplamWorkflow = 0;
  try {
    for (const f of readdirSync(workflowsDir)) {
      if (!/\.ya?ml$/i.test(f)) continue;
      toplamWorkflow++;
      const raw = readFileSync(join(workflowsDir, f), 'utf8');
      // 🔴 WORKFLOW VAKASI (ÖLÇÜLDÜ): terraform.yml içeriği TAMAMEN YORUM SATIRINDA →
      // dosya VAR ama pipeline DEVRE DIŞI. Yorumları AT, sonra bak.
      const kod = raw.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
      if (TEST_ADIMI.test(kod)) testliWorkflow++;
    }
  } catch { /* okunamadı */ }

  if (toplamWorkflow > 0 && testliWorkflow === 0) {
    return results.push({ id, name, verdict: 'FAIL',
      detail: `CI koşuyor (${succeeded}/${runs.length} başarılı) AMA ${toplamWorkflow} workflow'un HİÇBİRİNDE `
        + 'test adımı YOK (yorum satırları hariç tutuldu). Yeşil pipeline + sıfır test güvencesi = '
        + 'YANLIŞ GÜVEN. (Gerçek vaka: bir mobil pilot reposu — CI var, test adımı yok.)' });
  }

  results.push({ id, name, verdict: 'PASS',
    detail: `son ${runs.length} run'ın ${succeeded}'i BAŞARILI + ${testliWorkflow}/${toplamWorkflow} workflow'da test adımı VAR — CI fiilen koşuyor VE güvence veriyor` });
}

// ============================================================================
// ④ REGISTRY ÇÖZÜNÜRLÜĞÜ — feature_id'lerin ≥%90'ı ≥1 [T]'ye çözülüyor + yetim [T] <%10.
// Registry OPT-IN'dir (`check-provenance --rule=registry-join` ile aynı ilke) — hedefte registry
// yoksa FAIL DEĞİL, "uygulanamaz".
// ============================================================================
function checkRegistryResolution() {
  const id = '④'; const name = 'Registry çözünürlüğü';
  const candidates = [
    join(TARGET, 'registry.yaml'), join(TARGET, 'registry.yml'),
    join(TARGET, 'docs', 'registry.yaml'), join(TARGET, 'docs', 'registry.yml'),
  ];
  const registryFile = candidates.find(existsSync);
  if (!registryFile) {
    return results.push({ id, name, verdict: 'UYGULANAMAZ',
      detail: 'hedefte registry.yaml yok — registry opt-in; yoksa FAIL sayılmaz' });
  }

  // Minimal, savunmacı bir YAML okuması: "id:" satırları ve her [T] dosyasının "feature_ids:" alanı.
  // ⚠ registry-join alt-kuralının ayrıştırıcısından (mini-yaml parseRegistry) AYRI bir okuyucudur —
  // hedefte kapı dizini farklı olabileceği için import edilmez; bilinen kopya.
  let raw;
  try { raw = readFileSync(registryFile, 'utf8'); }
  catch { return results.push({ id, name, verdict: 'ÖLÇÜLEMEDİ', detail: `${registryFile} okunamadı` }); }

  const featureIds = new Set([...raw.matchAll(/^\s*-?\s*id:\s*["']?([\w.-]+)["']?\s*$/gm)].map(m => m[1]));
  if (!featureIds.size) {
    return results.push({ id, name, verdict: 'ÖLÇÜLEMEDİ', detail: `${registryFile} bulundu ama feature id deseni tanınamadı (şema henüz kod-genelinde sabitlenmedi)` });
  }

  let tDocs = [];
  try {
    tDocs = execSync('git ls-files', { cwd: TARGET, maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean)
      .filter(f => /\.(md|yaml|yml)$/i.test(f) && /(^|\/)(docs\/)?tech[-_]?docs?\//i.test(f));
  } catch { /* git yoksa boş bırak */ }

  if (!tDocs.length) {
    return results.push({ id, name, verdict: 'ÖLÇÜLEMEDİ', detail: 'registry var ama [T] doküman dizini bulunamadı — çözünürlük hesaplanamadı' });
  }

  let resolvedFeatures = 0;
  let orphanT = 0;
  const referenced = new Set();
  for (const t of tDocs) {
    const p = join(TARGET, t);
    if (!existsSync(p)) continue;
    let content = '';
    try { content = readFileSync(p, 'utf8'); } catch { continue; }
    const ids = [...content.matchAll(/feature_ids?:\s*\[?([^\]\n]+)\]?/g)]
      .flatMap(m => m[1].split(',').map(s => s.trim().replace(/["'\s]/g, '')).filter(Boolean));
    if (!ids.length) { orphanT++; continue; }
    for (const fid of ids) if (featureIds.has(fid)) referenced.add(fid);
  }
  resolvedFeatures = referenced.size;
  const featurePct = featureIds.size ? (resolvedFeatures / featureIds.size) * 100 : 0;
  const orphanPct = tDocs.length ? (orphanT / tDocs.length) * 100 : 0;
  const verdict = (featurePct >= 90 && orphanPct < 10) ? 'PASS' : 'FAIL';
  results.push({
    id, name, verdict,
    detail: `feature_id çözünürlüğü %${featurePct.toFixed(0)} (eşik ≥%90, ${resolvedFeatures}/${featureIds.size}) · `
      + `yetim [T] oranı %${orphanPct.toFixed(0)} (eşik <%10, ${orphanT}/${tDocs.length})`,
  });
}

// ============================================================================
// ⑤ DOĞRULUK KAPISI — pre-commit hijyenle yetiniyor mu? (v0.12, pilot bulgusu #3)
// GERÇEK PİLOT VAKASI: hedef repoda pre-commit YALNIZ metinsel kapılar koşuyordu (secret,
// encoding, boyut, placeholder) — hiçbiri "bu kod DERLENİYOR mu" sormuyordu. Tip hatası
// commit'lenip DAKİKALAR sonra CI'da yakalanıyordu (zarfa bakıp içine bakmamak).
// ÖLÇÜLEN: tipli bir stack VAR MI + pre-commit'te tip kontrolü VAR MI. İkisi de VARLIK değil
// KONFIGÜRASYON ölçümüdür; "tip kontrolü gerçekten hata yakalıyor mu" E2'dir (kurulum
// negatif kontrolü SKILL.md'de talimat olarak durur — burada koşulmaz, hedef derleyici gerekir).
// 🔴 DÜRÜSTLÜK: tipsiz stack (saf JS/Python vb.) → UYGULANAMAZ, FAIL DEĞİL. Tip kontrolü
// BİLİNÇLE dışarıda bırakılmışsa (BASELINE'a yazılmışsa) → PASS: karar belgelenmiş demektir.
// Yakalanan tek şey SESSİZ boşluktur: tipli stack + pre-commit'te yok + hiçbir yerde yazılı değil.
// ============================================================================
function checkTypeGate() {
  const id = '⑤'; const name = 'Doğruluk kapısı (tip kontrolü)';

  // Tipli stack tespiti — manifest'e BAK, varsayma (SKILL.md v0.8.2 ilkesi).
  const TYPED = [
    ['TypeScript', () => existsSync(join(TARGET, 'tsconfig.json'))],
    ['.NET', () => readdirSync(TARGET).some(f => /\.(csproj|sln|fsproj)$/i.test(f))],
    ['Flutter/Dart', () => existsSync(join(TARGET, 'pubspec.yaml'))],
    ['Go', () => existsSync(join(TARGET, 'go.mod'))],
    ['Rust', () => existsSync(join(TARGET, 'Cargo.toml'))],
    ['Kotlin/Java', () => ['build.gradle', 'build.gradle.kts', 'pom.xml'].some(f => existsSync(join(TARGET, f)))],
  ];
  let stack = null;
  try { stack = (TYPED.find(([, probe]) => { try { return probe(); } catch { return false; } }) || [null])[0]; }
  catch { /* okunamadı */ }

  if (!stack) {
    return results.push({ id, name, verdict: 'UYGULANAMAZ',
      detail: 'hedefte tipli bir stack manifesti bulunamadı (tsconfig/csproj/pubspec/go.mod/Cargo.toml/gradle) — tip kontrolü UYGULANAMAZ, eksikliği FAIL sayılmaz' });
  }

  // Pre-commit hook'unda (ya da onun çağırdığı script'te) tip kontrolü aranır.
  const TYPECHECK = /tsc\b|--noEmit|\btypecheck\b|type-check|dotnet\s+build|flutter\s+analyze|\bgo\s+(build|vet)\b|cargo\s+check|gradlew?\s+(compile|build)/i;
  const hookCandidates = [
    join(TARGET, '.git', 'hooks', 'pre-commit'),
    join(TARGET, '.husky', 'pre-commit'),
    join(TARGET, 'scripts', 'pre-commit.mjs'),
    join(TARGET, 'scripts', 'self-pre-commit.mjs'),
  ];
  let hookFound = false, typecheckInHook = false, hookPath = null;
  for (const h of hookCandidates) {
    if (!existsSync(h)) continue;
    hookFound = true; hookPath = h;
    let raw = '';
    try { raw = readFileSync(h, 'utf8'); } catch { continue; }
    // Yorum satırlarını AT (③'teki terraform.yml dersi: yorumdaki kod ÇALIŞMAZ).
    const kod = raw.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
    if (TYPECHECK.test(kod)) { typecheckInHook = true; break; }
    // Hook başka bir script çağırıyorsa (shim kalıbı) onu da tara — 1 seviye.
    for (const m of kod.matchAll(/(?:node|npx|sh|bash)\s+["']?([\w./-]+\.(?:mjs|cjs|js|sh))["']?/g)) {
      const inner = resolve(TARGET, m[1].replace(/^\$?\{?CLAUDE_PROJECT_DIR\}?\//, ''));
      if (!existsSync(inner)) continue;
      try { if (TYPECHECK.test(readFileSync(inner, 'utf8'))) { typecheckInHook = true; break; } } catch { /* atla */ }
    }
    if (typecheckInHook) break;
  }

  if (typecheckInHook) {
    return results.push({ id, name, verdict: 'PASS',
      detail: `${stack} stack'i + pre-commit'te tip kontrolü VAR (${hookPath}) — hatalı kod commit anında durur, CI'a kalmaz` });
  }

  // Tip kontrolü hook'ta YOK → BİLİNÇLİ bir karar mı, sessiz boşluk mu? BASELINE'da yazılı mı?
  const baselineCandidates = ['BASELINE.md', 'docs/BASELINE.md', 'docs/STATE.md', 'STATE.md', 'CLAUDE.md'];
  let documented = null;
  for (const b of baselineCandidates) {
    const p = join(TARGET, b);
    if (!existsSync(p)) continue;
    let raw = '';
    try { raw = readFileSync(p, 'utf8'); } catch { continue; }
    // "pre-commit'te tip kontrolü YOK" gibi AÇIK bir beyan aranır (süre gerekçesiyle birlikte).
    if (/tip\s*kontrol[üu]?\s*(pre-?commit'?te)?\s*(YOK|yok|devre\s*d[ıi][şs][ıi])|typecheck\s*(is\s*)?(not\s*in|excluded|yok)/i.test(raw)) {
      documented = b; break;
    }
  }

  if (documented) {
    return results.push({ id, name, verdict: 'PASS',
      detail: `${stack} stack'i + pre-commit'te tip kontrolü YOK ama bu BİLİNÇLİ ve ${documented}'de YAZILI — karar belgelenmiş (sessiz boşluk değil)` });
  }

  results.push({ id, name, verdict: 'FAIL',
    detail: `${stack} stack'i var ama pre-commit'te tip kontrolü YOK${hookFound ? '' : ' (pre-commit hook\'u da bulunamadı)'} ve hiçbir baseline dosyasında `
      + 'bu eksiklik YAZILI DEĞİL → SESSİZ BOŞLUK. Hatalı kod commit\'lenip dakikalar sonra CI\'da yakalanır. '
      + 'Düzeltme: staged-typecheck\'i pre-commit\'e ekle (süreyi ÖLÇ, ≤15 sn ise al), ya da alamıyorsan '
      + 'BASELINE\'a "pre-commit\'te tip kontrolü YOK — süre X sn, CI\'a bırakıldı" diye YAZ (SKILL.md FAZ 2 madde 4).' });
}

// ============================================================================
// ⑥ SIZE-BASELINE KALİBRASYONU — dosya-boyu kapısı bu repoya göre AYARLANDI MI? (v0.12)
// GERÇEK PİLOT VAKASI (bulgu #7): "dosya 1000 satırı geçmesin" kuralı GEÇERLİ bir bug
// düzeltmesini engelledi — dosya ZATEN 1353 satırdı, düzeltme 16 satır ekliyordu. Sorun
// kapının sınırı DEĞİL, kurulumda `size-baseline.json`ın ÜRETİLMEMİŞ olmasıydı (SKILL.md
// FAZ 2 zaten emrediyor: "size baseline'ını script'in KENDİ sayımıyla üret" — adım ATLANMIŞTI).
// Bu kontrol o atlamayı yakalar: tavanı AŞAN dosya VAR ama muafiyet listesi YOK/EKSİK ise,
// kapı ilk gerçek işte yanlış-alarm verip REDDEDİLECEK demektir.
// 🔴 Muafiyet = AF DEĞİL DONDURMA: baseline'a yazılan dosya küçülebilir, BÜYÜYEMEZ.
// ============================================================================
function checkSizeBaselineCalibrated() {
  const id = '⑥'; const name = 'Size-baseline kalibrasyonu';

  // v0.28.1: kapı v0.16'dan beri `check-hygiene.mjs --rule=file-size`. Bu liste yalnız eski
  // `check-file-size.mjs` adını arıyordu → v0.16 sonrası HER kurulumda kontrol sessizce
  // UYGULANAMAZ dönüyordu (② kontrolünün v0.20'de düzeltilen hatasının aynısı). Eski ad, v0.16
  // öncesi kurulumlar için yedek olarak kalır.
  const gateCandidates = [
    join(TARGET, 'scripts', 'gates', 'check-hygiene.mjs'),
    join(TARGET, 'gates', 'check-hygiene.mjs'),
    join(TARGET, 'scripts', 'gates', 'check-file-size.mjs'),
    join(TARGET, 'gates', 'check-file-size.mjs'),
  ];
  const gatePath = gateCandidates.find(existsSync);
  if (!gatePath) {
    return results.push({ id, name, verdict: 'UYGULANAMAZ', detail: 'hedefte check-hygiene.mjs (file-size alt-kuralı) yok (kapı kurulmamış) — kalibrasyon UYGULANAMAZ' });
  }

  // Kapının KENDİ tavanını oku (sabit varsayma — kurulumda değiştirilmiş olabilir).
  let failCap = 1000;
  try {
    const m = readFileSync(gatePath, 'utf8').match(/CODE_FAIL\s*=\s*(\d+)/);
    if (m) failCap = Number(m[1]);
  } catch { /* varsayılanla devam */ }

  if (!isGitRepo(TARGET)) return results.push({ id, name, verdict: 'ÖLÇÜLEMEDİ', detail: 'hedef bir git reposu değil — dosya sayımı yapılamadı' });

  const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|cs|dart|kt|kts|fs|scala|swift)$/i;
  let oversized = [];
  try {
    const tracked = execSync('git ls-files', { cwd: TARGET, maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean).filter(f => CODE_EXT.test(f));
    for (const f of tracked) {
      const p = join(TARGET, f);
      if (!existsSync(p)) continue;
      try {
        const lines = readFileSync(p, 'utf8').split('\n').length;
        if (lines > failCap) oversized.push({ f, lines });
      } catch { /* okunamayan dosya - atla */ }
    }
  } catch { return results.push({ id, name, verdict: 'ÖLÇÜLEMEDİ', detail: 'git ls-files başarısız' }); }

  if (!oversized.length) {
    return results.push({ id, name, verdict: 'PASS',
      detail: `tavanı (${failCap} satır) aşan kod dosyası YOK — baseline muafiyetine gerek yok, kapı ilk günden temiz koşar` });
  }

  // Tavanı aşan dosya VAR → baseline üretilmiş olmalı ve HEPSİNİ kapsamalı.
  const baselinePath = join(TARGET, 'scripts', 'size-baseline.json');
  if (!existsSync(baselinePath)) {
    const örnek = oversized.slice(0, 3).map(o => `${o.f} (${o.lines})`).join(', ');
    return results.push({ id, name, verdict: 'FAIL',
      detail: `tavanı (${failCap}) aşan ${oversized.length} kod dosyası VAR ama scripts/size-baseline.json YOK → kapı İLK gerçek işte `
        + `yanlış-alarm verip REDDEDİLECEK (pilot vakası: geçerli bir bug düzeltmesi bloke oldu). `
        + `Örnek: ${örnek}. Düzeltme: baseline'ı kapının KENDİ sayımıyla üret (SKILL.md FAZ 2) — `
        + `muafiyet AF DEĞİL DONDURMA: muaf dosya küçülebilir, BÜYÜYEMEZ.` });
  }

  let baseline = {};
  try { baseline = JSON.parse(readFileSync(baselinePath, 'utf8')); }
  catch { return results.push({ id, name, verdict: 'FAIL', detail: `${baselinePath} var ama JSON parse edilemedi — muafiyetler etkisiz, kapı yanlış-alarm verecek` }); }

  const norm = p => p.replace(/\\/g, '/');
  const uncovered = oversized.filter(o => baseline[norm(o.f)] === undefined);
  if (uncovered.length) {
    const örnek = uncovered.slice(0, 3).map(o => `${o.f} (${o.lines})`).join(', ');
    return results.push({ id, name, verdict: 'FAIL',
      detail: `size-baseline.json VAR ama tavanı aşan ${oversized.length} dosyanın ${uncovered.length}'i listede YOK → o dosyalara dokunan her iş `
        + `bloke olur. Kapsanmayan: ${örnek}. Baseline'ı YENİDEN üret (elle eklemek yerine kapının kendi sayımını kullan).` });
  }

  results.push({ id, name, verdict: 'PASS',
    detail: `tavanı (${failCap}) aşan ${oversized.length} dosyanın TÜMÜ size-baseline.json'da muaf (dondurma: küçülebilir, büyüyemez) — kapı kalibre edilmiş` });
}

// ============================================================================
// ⑦ Bilimsel-çalışma bölümü kuruldu mu? (v0.14 — K23; K20 doktrinlerinin kurulum-anı izi)
// v0.13+ kurulumu hedef CLAUDE.md'ye "Bilimsel çalışma disiplini" bölümünü üretir (dalkavukluk
// yasağı + sürüm-gerçeği + devir). K18-⑤ ekseninin aynısı: bölüm YOK + hiçbir beyan dosyasında
// bilinçli-ret YAZILI DEĞİL = sessiz boşluk → FAIL; bilinçli ve YAZILI ise PASS (atlamak
// serbest, SESSİZ atlamak yasak). CLAUDE.md hiç yoksa kurulum yapılmamış → UYGULANAMAZ.
// DÜRÜST SINIR: bölümün VARLIĞI ölçülür, ajanın ona UYDUĞU değil (o E2/Hakem — K20 aynı sınırı
// paketin kendi tarafında check-rule-contracts ile çizer).
// ============================================================================
function checkDoctrineInstalled() {
  const id = '⑦', name = 'Bilimsel-çalışma bölümü';
  const claudePath = join(TARGET, 'CLAUDE.md');
  if (!existsSync(claudePath)) {
    results.push({ id, name, verdict: 'UYGULANAMAZ',
      detail: 'hedefte CLAUDE.md yok — kurulum yapılmamış görünüyor (önce FAZ 3)' });
    return;
  }
  const txt = readFileSync(claudePath, 'utf8');
  if (/##\s*Bilimsel çalışma disiplini/.test(txt) || /[Dd]alkavukluk yasak/.test(txt)) {
    results.push({ id, name, verdict: 'PASS',
      detail: 'CLAUDE.md bilimsel-çalışma bölümünü/dalkavukluk-yasağı satırını taşıyor' });
    return;
  }
  const beyanDosyalari = ['docs/STATE.md', 'STATE.md', 'BASELINE.md']
    .map(p => join(TARGET, p)).filter(existsSync);
  const bilinçliRet = beyanDosyalari.some(p => /bilimsel çalışma|dalkavukluk/i.test(readFileSync(p, 'utf8')));
  results.push(bilinçliRet
    ? { id, name, verdict: 'PASS',
        detail: 'bölüm yok ama karar beyan dosyasında YAZILI (bilinçli ret — sessiz boşluk değil)' }
    : { id, name, verdict: 'FAIL',
        detail: 'CLAUDE.md var ama bilimsel-çalışma bölümü yok VE STATE/BASELINE\'da bilinçli-ret yazılı değil — sessiz boşluk. v0.13+ CLAUDE şablonundaki bölümü ekle ya da ret kararını STATE\'e yaz.' });
}

// ============================================================================
// ⑧ Kurulum soruları sorulmuş mu? (v0.30 — G4/T1) muhatap + takip toggle'ları ÜÇ DURUMLU:
// true/false = cevaplandı · null = SORULMADI. "Sorulmadı" ≠ "hayır": kurulum ajanı ADIM 0 sorusunu
// sormadan false yazamaz (v0.30 öncesi şablon sabit false taşıyordu → sessiz atlama). null → FAIL.
// Künye yoksa UYGULANAMAZ; skill_version < 0.30.0 künye bu soruları HİÇ taşımaz → UYGULANAMAZ
// (eski kurulumlara yeni FAIL dayatılmaz; doctor onlara UYARI verir).
// ============================================================================
function checkInstallQuestionsAsked() {
  const id = '⑧', name = 'Kurulum soruları (muhatap/takip toggle)';
  const mp = join(TARGET, '.agentic-repo-setup.json');
  if (!existsSync(mp)) return results.push({ id, name, verdict: 'UYGULANAMAZ', detail: 'hedefte kurulum künyesi (.agentic-repo-setup.json) yok' });
  let m;
  try { m = JSON.parse(readFileSync(mp, 'utf8')); }
  catch (e) { return results.push({ id, name, verdict: 'FAIL', detail: `künye VAR ama parse edilemiyor: ${e.message}` }); }
  const v = String(m.skill_version || '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!v) return results.push({ id, name, verdict: 'UYGULANAMAZ', detail: 'künyede skill_version yok — sürüm bilinmiyor, v0.30 soruları uygulanamaz' });
  if (Number(v[1]) === 0 && Number(v[2]) < 30)
    return results.push({ id, name, verdict: 'UYGULANAMAZ', detail: `künye skill_version ${m.skill_version} < 0.30.0 — bu sorular o sürümde yoktu (doctor UYARI verir)` });
  const ad = [];
  for (const k of ['pm_urun', 'qa_senaryo', 'son_kullanici_dokumani', 'test_koprusu'])
    if (typeof m.toggles?.muhatap?.[k] !== 'boolean') ad.push('muhatap.' + k);
  for (const k of ['state', 'yan_bug'])
    if (typeof m.toggles?.takip?.[k] !== 'boolean') ad.push('takip.' + k);
  results.push(ad.length
    ? { id, name, verdict: 'FAIL', detail: `kurulum sorusu sorulmadı (null/eksik): ${ad.join(', ')} — ADIM 0'da sor, cevabı true/false yaz (varsayılan false YAZMA).` }
    : { id, name, verdict: 'PASS', detail: 'muhatap + takip toggle alanlarının hepsi cevaplı (true/false)' });
}

// ============================================================================
// ⑨ doc-recency --cascade bağlı mı? (v0.30) son_kullanici_dokumani AÇIKSA hook VE (GitHub ise) CI
// `--rule=doc-recency ... --cascade` taşımalı; yoksa doküman zinciri kurulu ama zorlanmıyor.
// Hook: `git config core.hooksPath` varsa o dizinin pre-commit'i, yoksa .git/hooks/pre-commit.
// Künye yok / skill_version < 0.30.0 / toggle ≠ true → UYGULANAMAZ. CI'da doldurulmamış
// {{CASCADE_BAYRAGI}} kalmışsa FAIL. DÜRÜST SINIR: metinde BAĞLANTININ varlığı ölçülür, koşup
// etkili olduğu değil (o ①-②'nin işi).
// ============================================================================
function checkCascadeWired() {
  const id = '⑨', name = 'doc-recency --cascade bağlı mı';
  const mp = join(TARGET, '.agentic-repo-setup.json');
  if (!existsSync(mp)) return results.push({ id, name, verdict: 'UYGULANAMAZ', detail: 'hedefte kurulum künyesi yok' });
  let m;
  try { m = JSON.parse(readFileSync(mp, 'utf8')); }
  catch (e) { return results.push({ id, name, verdict: 'FAIL', detail: `künye parse edilemiyor: ${e.message}` }); }
  const v = String(m.skill_version || '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!v) return results.push({ id, name, verdict: 'UYGULANAMAZ', detail: 'künyede skill_version yok — sürüm bilinmiyor' });
  if (Number(v[1]) === 0 && Number(v[2]) < 30)
    return results.push({ id, name, verdict: 'UYGULANAMAZ', detail: `künye skill_version ${m.skill_version} < 0.30.0` });
  if (m.toggles?.muhatap?.son_kullanici_dokumani !== true)
    return results.push({ id, name, verdict: 'UYGULANAMAZ', detail: 'muhatap.son_kullanici_dokumani true değil' });
  const RE = /--rule=doc-recency[^\n]*--cascade/;
  const eksik = [];
  let hooksPath = '';
  hooksPath = (spawnSync('git', ['-C', TARGET, 'config', 'core.hooksPath'], { encoding: 'utf8' }).stdout || '').trim();
  const hookDosya = hooksPath ? resolve(TARGET, hooksPath, 'pre-commit') : join(TARGET, '.git', 'hooks', 'pre-commit');
  let hookTxt = '';
  try { hookTxt = readFileSync(hookDosya, 'utf8'); } catch { /* yok */ }
  if (!RE.test(hookTxt)) eksik.push(`hook (${hookDosya}) --rule=doc-recency ... --cascade taşımıyor`);
  let ciNot = 'CI UYGULANAMAZ (platform github değil)';
  if (/github/i.test(String(m.toggles?.dis_entegrasyon?.ci_platformu || ''))) {
    const wd = join(TARGET, '.github', 'workflows');
    let txt = '';
    try { for (const f of readdirSync(wd)) if (/\.ya?ml$/i.test(f)) txt += readFileSync(join(wd, f), 'utf8') + '\n'; } catch { /* yok */ }
    if (txt.includes('{{CASCADE_BAYRAGI}}')) eksik.push('CI workflow\'unda doldurulmamış {{CASCADE_BAYRAGI}} kaldı');
    else if (!RE.test(txt)) eksik.push('CI workflow\'u --rule=doc-recency ... --cascade taşımıyor');
    ciNot = 'CI de bağlı';
  }
  results.push(eksik.length
    ? { id, name, verdict: 'FAIL', detail: eksik.join(' · ') }
    : { id, name, verdict: 'PASS', detail: `hook bağlı; ${ciNot}` });
}

// ============================================================================
// Koşum + rapor
// ============================================================================
checkAnchorResolution();
checkGateNegativeControl();
checkCiRanForReal();
checkRegistryResolution();
checkTypeGate();
checkSizeBaselineCalibrated();
checkDoctrineInstalled();
checkInstallQuestionsAsked();
checkCascadeWired();

const hardFails = results.filter(r => r.verdict === 'FAIL');
const unmeasured = results.filter(r => r.verdict === 'ÖLÇÜLEMEDİ');
const notApplicable = results.filter(r => r.verdict === 'UYGULANAMAZ');
const passed = results.filter(r => r.verdict === 'PASS');

// STATE.md'ye yazılabilir tek blok (talimat: "sonucu STATE.md'ye yazılabilir formatta bas").
const stateBlock = [
  `## K3 çıkış sınavı — install-exam (${new Date().toISOString().slice(0, 10)})`,
  ...results.map(r => `- ${r.id} ${r.name}: **${r.verdict}** — ${r.detail}`),
  `- Toplam: ${passed.length} PASS · ${hardFails.length} FAIL · ${unmeasured.length} ÖLÇÜLEMEDİ · ${notApplicable.length} UYGULANAMAZ`,
  `- [ERTELENMİŞ-ÖLÇÜM: gate-effect → pilot dalgası] — kurulum-anı sürümü bilinçle KURULMADI (gün-1 paradoksu: yeni repoda commit geçmişi yok, ölçüm hep boş döner). Ölçüm FAZ 5 pilot dalgasına ertelenir; taban değeri bu sınavın ① sonucu (anchor sayısı) sağlar.`,
].join('\n');

if (asJson) {
  console.log(JSON.stringify({ target: TARGET, results, pass: hardFails.length === 0 }, null, 2));
} else {
  console.log('K3 ÇIKIŞ SINAVI — install-exam (varlık değil ETKİ ölçer)\n');
  console.log(`Hedef: ${TARGET}\n`);
  for (const r of results) {
    const mark = r.verdict === 'PASS' ? 'OK  ' : r.verdict === 'FAIL' ? 'FAIL' : r.verdict === 'ÖLÇÜLEMEDİ' ? 'ÖLÇ?' : 'N/A ';
    console.log(`  ${mark} ${r.id} ${r.name}`);
    console.log(`       ${r.detail}`);
  }
  console.log('\n--- STATE.md bloğu (kopyala-yapıştır) ---\n');
  console.log(stateBlock);
  console.log();
}

if (hardFails.length) {
  if (!asJson) console.error(`SINAV BAŞARISIZ — ${hardFails.length} kontrol FAIL. Yeşil rapor VERİLMEZ (SKILL-V1-PLANI.md §4.1).`);
  process.exit(1);
}
if (!asJson) console.log(`SINAV TAMAM — ${passed.length}/${results.length} kontrol PASS (kalan: ÖLÇÜLEMEDİ/UYGULANAMAZ, FAIL yok).`);
process.exit(0);
