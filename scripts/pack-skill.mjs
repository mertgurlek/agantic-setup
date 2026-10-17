#!/usr/bin/env node
// pack-skill.mjs (v0.9) — agentic-repo-setup'ı dağıtılabilir skill bundle'ına paketler.
// DAĞITIM KURALI (herkese paylaşım): HER sürüm İKİ biçimde, SÜRÜMLÜ adla üretilir —
//   .skill (Claude.ai/masaüstü app "Upload skill" akışı) + .zip (elle açan / Claude Code).
//   İkisi byte-aynı zip; uzantı yalnız hedef/kolaylık ayrımı. Sürüm package.json'dan gelir.
// FELSEFE: paketleme öz-doğrulamayı ATLAMAZ. Temiz ağaç + verify + testler yeşil DEĞİLSE paket
// üretmeyi REDDEDER (doctrine: "öz-doğrulama atlanmaz" + "8 kapının 3'ünü koşma" panzehiri — MEKANİZMA).
// Sıfır yeni bağımlılık: yalnız git + node. Üst klasör `agentic-repo-setup/`; pilot-proje/pilot-sim/ ve .claude/
// .gitattributes export-ignore ile HARİÇ. Kullanım: node scripts/pack-skill.mjs (npm run pack:skill).
import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, statSync, readFileSync, copyFileSync, writeFileSync, rmSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const PREFIX = 'agentic-repo-setup/';
const VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version;
const OUTDIR = 'public';   // committed paylaşim klasoru (bundle'a export-ignore ile GIRMEZ)
const SKILL_OUT = `${OUTDIR}/agentic-repo-setup-v${VERSION}.skill`;   // Claude.ai/app: Upload skill
const ZIP_OUT   = `${OUTDIR}/agentic-repo-setup-v${VERSION}.zip`;     // elle açma / Claude Code
const die = (msg) => { console.error('\nPACK REDDEDİLDİ — ' + msg + '\n'); process.exit(1); };
const run = (argv) => spawnSync(argv[0], argv.slice(1), { encoding: 'utf8' });
// SB-9: yalnız tests/ koşar; açık dosya listesi (Node 20'de --test glob'u açmaz, spawnSync'te kabuk yok).
const testDosyalari = (kok) => readdirSync(join(kok, 'tests')).filter(f => /\.test\.mjs$/.test(f)).sort().map(f => join('tests', f));

// 1) TEMİZ-AĞAÇ GUARD: git archive yalnız COMMIT'li içeriği paketler → kirli ağaç = eksik/yanlış bundle.
const porcelain = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (porcelain) die('çalışma ağacı kirli. git archive yalnız COMMIT\'li içeriği paketler;\n'
  + '  commit\'lenmemiş değişiklikler bundle\'a GİRMEZ. Önce commit\'le, sonra paketle.\n'
  + '  Kirli:\n' + porcelain.split('\n').map(l => '    ' + l).join('\n'));

// 2) ÖZ-DOĞRULAMA: kapılar + testler yeşil olmadan paket ÜRETİLMEZ.
console.log('pack-skill — öz-doğrulama koşuluyor (paket yeşil olmadan üretilmez)...\n');
for (const [name, argv] of [['verify', ['node', 'verify.mjs']], ['test', ['node', '--test', ...testDosyalari('.')]]]) {
  const r = run(argv);
  if (r.status !== 0) { console.error((r.stdout || '') + (r.stderr || '')); die(name + ' KIRMIZI — düzelt, tekrar koş.'); }
  console.log('  OK   ' + name);
}

// 3) ÜRET: dist/ + git archive zip (prefix = üst klasör; export-ignore .gitattributes'tan uygulanır).
mkdirSync(OUTDIR, { recursive: true });
const ar = run(['git', 'archive', '--format=zip', '--prefix=' + PREFIX, '-o', SKILL_OUT, 'HEAD']);
if (ar.status !== 0) { console.error(ar.stderr); die('git archive başarısız.'); }
copyFileSync(SKILL_OUT, ZIP_OUT);   // her iki yöntem: aynı zip, .skill + .zip uzantısıyla

// 4) BUNDLE İÇERİK DOĞRULAMASI (varlık≠kalite): zip'i değil, AYNI HEAD seçimini tar olarak parse et
//    (taşınabilir — tar binary'sine gerek yok; 512-bayt ustar başlıklarını JS'te oku).
const tar = execSync('git archive --format=tar --prefix=' + PREFIX + ' HEAD', { maxBuffer: 256 * 1024 * 1024 });
const files = [];
for (let off = 0; off + 512 <= tar.length;) {
  const name = tar.toString('utf8', off, off + 100).replace(/\0.*$/, '');
  if (!name) break;                                   // iki sıfır blok = arşiv sonu
  const size = parseInt(tar.toString('ascii', off + 124, off + 136).replace(/\0.*$/, '').trim() || '0', 8);
  if (!name.endsWith('/') && !name.includes('PaxHeader') && name !== 'pax_global_header') files.push(name);
  off += 512 + Math.ceil(size / 512) * 512;
}

const rel = files.map(f => f.startsWith(PREFIX) ? f.slice(PREFIX.length) : f);
const must = ['SKILL.md', 'gates/check-doc-integrity.mjs', 'examples/acceptance.json', 'verify.mjs',
  'package.json', 'reference/external-integrations.md', 'templates/ci-workflow.template.yml',
  // v0.14: makbuz+doctor — SKILL FAZ 5 mühür adımı buna atıf verir; düşerse akış sessizce kırılır.
  'scripts/install-doctor.mjs', 'templates/install-manifest.template.json',
  'scripts/upgrade.mjs',   // v0.15: SKILL FAZ 5 yükseltme adımı buna atıf verir
  // v0.11+: plugin kimliği (marketplace dağıtımı). Bundle'dan düşerse /plugin kurulumu sessizce
  // bozulur — bu yüzden çekirdek listede. NOT: '.claude/' banned'dır, '.claude-plugin/' DEĞİL (prefix ayrı).
  '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json'];
const banned = ['pilot-proje/', 'pilot-sim/', '.claude/', '.hakem/', 'dist/', 'public/', 'bench/'];   // pilot alanlari + ikincil skill + verdict kanitlari + cikti klasorleri → bundle'a girmez
// NOT: 'case-studies/' v0.17'de silindi (üç-alan reorg → pilot-proje/+pilot-sim/; bkz. .gitattributes
// yorum satırı), buradan da düşürüldü — .gitattributes zaten aynı adımda düşürmüştü, iki liste burada
// yeniden hizalandı. Dizin geri gelirse (regresyon) bu kapı O ZAMAN yeniden eklenerek yakalar; ölü girdi
// tutmak "sızıntı savunması" değil gürültüdür (CLAUDE.md dogfood yasası).
const missing = must.filter(m => !rel.includes(m));
const leaked = rel.filter(f => banned.some(b => f.startsWith(b)));
const unprefixed = files.filter(f => !f.startsWith(PREFIX));

if (unprefixed.length) die('bazı girdiler "' + PREFIX + '" ön-ekiyle başlamıyor: ' + unprefixed.slice(0, 3).join(', '));
if (missing.length) die('çekirdek dosya bundle\'da YOK: ' + missing.join(', '));
if (leaked.length) die('hariç tutulması gereken dosya SIZDI: ' + leaked.slice(0, 5).join(', '));

// 5) BUNDLE SMOKE (v0.13.1 — hakem bulgusu + FRICTION kaydı: repo kökünde yeşil geçen doğrulama
//    bundle-BAĞLAMI kırılmalarını GÖREMEZ; v0.13.0 bunu canlı yaşadı — bundle CLAUDE.md'si CRLF
//    çevrimi yüzünden rule-contracts'tan kalıyordu ve pack yeşil demişti). Elimizdeki tar
//    seçimini geçici dizine AÇ ve bundle-bağlamında ANLAMLI doğrulamayı İÇİNDE koş:
//      • node --test (tüm kapı birim testleri; iki dogfood testi bundle kökünde de koşar)
//      • check-self-registry --rule=rule-contracts --strict + --rule=orphan-gates --strict (git'siz, saf-fs kapılar)
//    TAM verify BİLİNÇLE koşulmaz (dürüst sınır): repo-içi dokümanlar meşru olarak repo-özel
//    yollara (.git/hooks/, .claude/) atıf verir; bundle'da bunlar YOKTUR → doc-truth yapısal
//    yanlış-FAIL üretirdi. Smoke'un sorusu dar ve nettir: bundle kendi kendini doğrulayabiliyor mu?
const smokeDir = mkdtempSync(join(tmpdir(), 'ars-smoke-'));
let smokeFail = null;
try {
  for (let off = 0; off + 512 <= tar.length;) {
    const name = tar.toString('utf8', off, off + 100).replace(/\0.*$/, '');
    if (!name) break;
    const size = parseInt(tar.toString('ascii', off + 124, off + 136).replace(/\0.*$/, '').trim() || '0', 8);
    if (!name.endsWith('/') && !name.includes('PaxHeader') && name !== 'pax_global_header') {
      const p = join(smokeDir, name);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, tar.subarray(off + 512, off + 512 + size));
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  const bundleRoot = join(smokeDir, PREFIX);
  console.log('\npack-skill — bundle smoke (zip içeriği geçici dizinde kendi kendini doğruluyor)...\n');
  for (const [name, argv] of [
    ['smoke:test',           ['node', '--test', ...testDosyalari(bundleRoot)]],
    ['smoke:rule-contracts', ['node', 'gates/check-self-registry.mjs', '--rule=rule-contracts', '--strict']],
    ['smoke:orphan-gates',   ['node', 'gates/check-self-registry.mjs', '--rule=orphan-gates', '--strict']],
  ]) {
    const r = spawnSync(argv[0], argv.slice(1), { cwd: bundleRoot, encoding: 'utf8' });
    if (r.status !== 0) {
      console.error(((r.stdout || '') + (r.stderr || '')).split('\n').slice(-40).join('\n'));
      smokeFail = name + ' BUNDLE İÇİNDE KIRMIZI — repo kökünde yeşil olsa bile dağıtılan paket kendi\n'
        + '  doğrulamasını geçemiyor (B1 sınıfı: bundle-bağlamı kırılması). Yukarıdaki çıktıya bak.';
      break;
    }
    console.log('  OK   ' + name);
  }
} finally { try { rmSync(smokeDir, { recursive: true, force: true }); } catch { /* yoksay */ } }
if (smokeFail) die(smokeFail);

const kb = (statSync(SKILL_OUT).size / 1024).toFixed(0);
console.log('\nPACK OK — v' + VERSION + ', iki biçim (' + rel.length + ' dosya · ' + kb + ' KB):');
console.log('  ' + SKILL_OUT + '   → Claude.ai/app: Settings → Capabilities → Skills → Upload skill');
console.log('  ' + ZIP_OUT + '   → elle: unzip / Expand-Archive → ~/.claude/skills/ (Claude Code)');
console.log('  doğrulandı: çekirdek VAR · pilot-proje//.claude/ YOK · tümü "' + PREFIX + '" ön-ekli.');
console.log('  kurulum ayrıntısı: INSTALL.md.');
