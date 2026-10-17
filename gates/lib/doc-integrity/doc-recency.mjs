// RULE: doc-recency (v0.18.3'te İKİ KADEMELİ tazelik zincirine genişletildi, KULLANICI KARARI 2026-08-06:
// "teknik döküman koda çapalı olsun, son kullanıcı dökümanı da teknik dökümana çapalı olsun,
// birbirlerini tetiklesinler". Üç kaynak birleşir, BİRİ DİĞERİNİ EZMEZ:
//   (0) HTML `<!-- doc-anchor: yol -->` — v0.8.4'ten beri BİREBİR korunur (geriye-uyumluluk).
//   (1) KADEME 1 — kod → [T]: [T] frontmatter'ındaki anchors[].repo:symbol'ün çözüldüğü KOD
//       dosyası staged'de değişti ama [T] dokunulmadı.
//   (2) KADEME 2 — [T] → [L0]: [L0] frontmatter'ındaki anchors.tech_docs[] listesindeki [T]
//       dosyası staged'de değişti ama [L0] dokunulmadı (yol-tabanlı, sembol çözümü gerekmez).
// `--cascade` OPT-IN BAYRAĞI (v0.18.3 hakem turu B1 düzeltmesi, KULLANICI KARARI 2026-08-06):
// Kademe 1/2 YALNIZ bu bayrak verilirse çalışır. Ölçülen regresyon: [T] frontmatter'ı olan
// (`feature_ids:`+`anchors:`) ve HTML doc-anchor YOK bir hedef repo v0.18.2'de --strict altında
// exit 0 alıyordu, v0.18.3 ilk sürümünde (bayraksız kademe 1/2) aynı diff exit 1 verdi — "EKLEME
// sınıfı, kurulmamış repo yeni FAIL görmez" iddiası (madde 1-13 deseni) YANLIŞTI, çünkü "[T]
// olan repo" zaten "kurulmuş repo"dur. Bayrak yokken davranış v0.18.2 ile BİREBİR (yalnız kaynak 0
// HTML doc-anchor). `--cascade` verildiğinde kademe 1/2 devreye girer. Bu paketin KENDİ verify.mjs
// çağrısı `--cascade`'i AÇIK tutar (dogfood — CLAUDE.md "yazdığın her kuralın zorlayıcısı olmalı").
// NO-OP KURALI (kullanıcının "sonradan kurulur" tarifi, yalnız --cascade altında geçerli): [T]
// yoksa kademe-1 no-op, [L0] yoksa kademe-2 no-op, hiçbiri+hiçbir HTML-anchor yoksa eski
// "doc-anchor tanımlı doküman yok" mesajı.
// SINIF: VARLIK tripwire (mevcut doc-recency deseni AYNEN) — "dokunuldu mu" der, içerik
// doğruluğunu garanti ETMEZ (CONTRACT.md "Bilinen sınırlar").
import { execSync, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname as pdirname, join } from 'node:path';
import { extractObjectBodies, readField, findTAndL0Docs, findUnclassifiedAnchorDocs } from '../anchor-resolve.mjs';
import { findRegistryFile, readSonKullaniciToggle, doldurulmamisSablonArgumani } from './repo-context.mjs';
import { kunyeSurumuEnAz, ESKI_KUNYE_NOTU } from '../kunye-surum.mjs';

export function runDocRecency(argv) {
  const strict = argv.includes('--strict');
  const cascade = argv.includes('--cascade');
  // Doldurulmamış şablon alanı (ör. `{{CASCADE_BAYRAGI}}`, `--cascade}}`) bayrak ayrıştırmasından ÖNCE yakalanır: ayrı, daha açıklayıcı hata.
  const sablonHata = doldurulmamisSablonArgumani(argv);
  if (sablonHata) { console.error(`\nDOC-RECENCY FAIL — ${sablonHata}\n`); return 1; }

  // Argüman ayrıştırma (v0.30.4): değer-alan bayrak (`--base <ref>` / `--base=<ref>`) değeriyle birlikte tüketilir —
  // aksi halde `origin/dev` "diskte YOK dosya argümanı" sanılıyordu (saha: pilot-backend CI). Bilinmeyen `--x`
  // sessizce atlanmaz, dosya sanılmaz: açık hata ("bilinmeyen bayrak").
  // Kategori kapısının TANINAN bayrakları (CONTRACT bayrak sütunu) bu alt-kural için sessiz no-op'tur; yalnız gerçekten tanınmayan sorgulanır.
  const BOOL_FLAGS = new Set(['--strict', '--cascade', '--json', '--allow-empty']);
  const KNOWN_PREFIX = ['--ignore=', '--registry=', '--facts=', '--rule='];
  const VALUE_FLAGS = new Set(['--base']);
  const args = [];
  const bilinmeyen = [];
  let baseRef = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('-')) { args.push(a); continue; }
    if (BOOL_FLAGS.has(a) || KNOWN_PREFIX.some(k => a.startsWith(k))) continue;
    const eq = a.indexOf('=');
    const name = eq === -1 ? a : a.slice(0, eq);
    if (VALUE_FLAGS.has(name)) {
      const val = eq === -1 ? argv[++i] : a.slice(eq + 1);
      if (!val || val.startsWith('-')) { console.error(`\nDOC-RECENCY FAIL — ${name} bir değer ister (örn. ${name} origin/dev).\n`); return 1; }
      baseRef = val;
      continue;
    }
    bilinmeyen.push(a);
  }
  if (bilinmeyen.length) {
    // Sıkılık künye-sürümüne bağlı: künye VAR ve v0.30+ ise FAIL; künyesiz (paket) ya da eski künyede UYARI, exit kodu etkilenmez.
    const siki = existsSync('.agentic-repo-setup.json') && kunyeSurumuEnAz('.', '0.30.0');
    const msg = `bilinmeyen bayrak: ${bilinmeyen.join(', ')} (geçerli: --strict, --cascade, --base <ref>, --json, --allow-empty, --ignore=, --registry=, --facts=)`;
    if (siki) { console.error(`\nDOC-RECENCY FAIL — ${msg}\n`); return 1; }
    console.warn(`\nDOC-RECENCY UYARI — ${msg}. Bayrak yok sayıldı. ${ESKI_KUNYE_NOTU}\n`);
  }

  // Argüman sağlığı: doldurulmamış şablon alanı VEYA diskte olmayan açık dosya argümanı sessizce atlanmaz → FAIL.
  const yokArg = args.filter(a => !existsSync(a));
  if (yokArg.length) { console.error(`\nDOC-RECENCY FAIL — argüman olarak verilen dosya diskte YOK: ${yokArg.join(', ')}\n  "temiz" ile "hiç bakmadım" farklıdır.\n`); return 1; }

  const tracked = execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8').split('\n').filter(Boolean);

  const docs = (args.length ? args : tracked.filter(f => /\.md$/i.test(f)));

  // --- Kaynak 0: HTML doc-anchor (BİREBİR korunan eski davranış) ---
  const ANCHOR = /<!--\s*doc-anchor:\s*([^>]+?)\s*-->/gi;
  const anchorsByDoc = new Map();
  for (const doc of docs) {
    if (!existsSync(doc)) continue;
    const set = new Set();
    for (const m of readFileSync(doc, 'utf8').matchAll(ANCHOR)) {
      for (const p of m[1].split(',').map(s => s.trim().replace(/\\/g, '/').replace(/\/$/, '')).filter(Boolean))
        set.add(p);
    }
    if (set.size) anchorsByDoc.set(doc, set);
  }

  // --- Kaynak 1/2: [T]/[L0] frontmatter (yalnız argümansız/tracked-tüm-repo taramasında; args
  // verildiyse eski davranış gibi yalnız o dosyalara odaklanır ama [T]/[L0] taraması HER ZAMAN
  // tüm tracked ağaçtan yapılır — kademe zinciri tek dosyaya daraltılamaz, kod→[T]→[L0] ilişkisi
  // repo-geneli bir graf.) `--cascade` yokken bu taramanın SONUCU kullanılmaz (v0.18.2 BİREBİR
  // davranışı) ama sınıflanamayan-doküman NOT'u (B2) cascade'den BAĞIMSIZ her zaman raporlanır —
  // "typo yüzünden [T] hiç kurulmadı" sinyali kullanıcının cascade açıp açmamasından önce görünmeli.
  const { tDocs, l0Docs } = findTAndL0Docs(tracked);
  const unclassified = findUnclassifiedAnchorDocs(tracked);   // B2: dar sinyal, FP-ölçülü (bkz. anchor-resolve.mjs)

  // T3 (v0.30): anchor'ı olup [T]/[L0] SINIFLANAMAYAN doküman "NOT + OK" ile sessiz geçilemez — tazelik zinciri
  // bunları GÖRMÜYOR (saha-A: 59/59 teknik doküman feature_ids'siz). Görünür UYARI; --strict altında FAIL.
  // Künyede son_kullanici_dokumani AÇIKÇA false ise (katman bilinçli kapalı) eski NOT davranışı korunur.
  const toggle = readSonKullaniciToggle();
  const escalate = unclassified.length > 0 && toggle !== false;
  // K81: T3/T4 --strict FAIL'i yalnız künyesi v0.30+ (ya da künyesiz) repoda; eski künyede UYARI + yükseltme notu.
  const sikiKademe = kunyeSurumuEnAz('.', '0.30.0');
  const failUnclassified = strict && escalate && sikiKademe;
  const unclassifiedMsg = () => (escalate
    ? `\nDOC-RECENCY ${failUnclassified ? 'FAIL' : 'UYARI'}: ${unclassified.length} doküman [T] olarak tanınmadı (sınıflanamadı) — tazelik zinciri bunları GÖRMÜYOR (anchors/feature_ids alanı eksik/typo):\n`
    : `\nDOC-RECENCY NOT (${unclassified.length}, sınıflanamadı — [T]/[L0] alan adı eksik/typo olabilir):\n`)
    + unclassified.map(u => `  ${u.path}  →  ${u.reason}`).join('\n') + (escalate && strict && !sikiKademe ? `\n  ${ESKI_KUNYE_NOTU}` : '') + '\n';

  if (!anchorsByDoc.size && (!cascade || (!tDocs.length && !l0Docs.length))) {
    if (unclassified.length) (failUnclassified ? console.error : console.warn)(unclassifiedMsg());
    // T4 (v0.30): "no-op OK" sessiz değildir — doküman katmanı BOŞ. Registry dosyası VARSA (kapsam tanımlı)
    // ve hiç [T]/[L0]/doc-anchor yoksa --strict altında FAIL (kapsam var, doküman yok).
    const registryFile = (!tDocs.length && !l0Docs.length) ? findRegistryFile() : null;
    const boslukNotu = `Doküman katmanı boş — [T]/[L0]/doc-anchor yok${toggle === true ? ' ve künyede son_kullanici_dokumani AÇIK: bu bir BOŞLUKTUR' : ' (toggle açıksa bu bir boşluktur)'}.`;
    if (strict && registryFile && !sikiKademe) console.warn(`\nDOC-RECENCY UYARI — ${boslukNotu}\n  registry (${registryFile}) kapsamı TANIMLI ama hiçbir [T]/[L0] doküman yok. ${ESKI_KUNYE_NOTU}\n`);
    if (strict && registryFile && sikiKademe) {
      console.error(`\nDOC-RECENCY FAIL — ${boslukNotu}\n  registry (${registryFile}) kapsamı TANIMLI ama hiçbir [T]/[L0] doküman yok: kapsam var, doküman yok.\n(--strict: commit bloke edildi)\n`);
      return 1;
    }
    if (failUnclassified) { console.error('(--strict: commit bloke edildi)\n'); return 1; }
    console.log(`Doc-recency OK — doc-anchor tanımlı doküman yok (kapı opt-in; etki yok). ${boslukNotu}`);
    return 0;
  }

  // DEĞİŞEN-DOSYA KÜMESİ — iki kaynak (v0.30.4; saha yaması'dan genelleştirildi): pre-commit'te
  // `git diff --cached` (staging); CI'da staging YOKTUR (boş döner → kapı kör) → `--base <ref>` ile
  // `git diff <ref>...HEAD` (üç nokta = merge-base'e göre: PR'ın GERÇEKTEN getirdiği değişiklik; CI'da fetch-depth: 0).
  // ref git'e ARGÜMAN DİZİSİ olarak geçer (execFileSync) — kabuk enjeksiyonu yüzeyi yok.
  const diffArgs = baseRef
    ? ['diff', '--name-only', '--diff-filter=ACMR', baseRef + '...HEAD']
    : ['diff', '--cached', '--name-only', '--diff-filter=ACMR'];
  const diffCmd = 'git ' + diffArgs.join(' ');
  let degisenCikti;
  try {
    degisenCikti = execFileSync('git', diffArgs, { maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).toString('utf8');
  } catch (e) {
    // Base ref çözülemedi (sığ klon / yanlış ref) — fail-open DEĞİL: kapının kör kalacağı durum budur.
    console.error(`\nDOC-RECENCY FAIL — base ref çözülemedi: '${diffCmd}' başarısız.\n  CI'da 'fetch-depth: 0' gerekir (merge-base tarihçesi olmadan hesaplanamaz).\n  Hata: ${String(e.message).split('\n')[0]}\n`);
    return 1;
  }
  const staged = new Set(degisenCikti.split('\n').filter(Boolean).map(f => f.replace(/\\/g, '/')));
  if (baseRef && staged.size === 0)
    console.log(`Doc-recency: değişen dosya yok (base=${baseRef}) — yargılanacak şey yok.`);

  const anchorTouched = (anchorPath) => {
    for (const f of staged) {
      if (f === anchorPath) return true;
      if (f.startsWith(anchorPath + '/')) return true;
    }
    return false;
  };

  const findings = [];       // { doc, anchors: [str] } — HTML kaynağı (eski biçim)
  for (const [doc, anchors] of anchorsByDoc) {
    const docTouched = staged.has(doc.replace(/\\/g, '/'));
    if (docTouched) continue;
    const staleAnchors = [...anchors].filter(anchorTouched);
    if (staleAnchors.length)
      findings.push({ doc, anchors: staleAnchors });
  }

  const unresolved = [];   // "çözülemedi" raporu — sessiz atlama YAPMA (v0.18.2 dersi)
  if (cascade) {
    // --- KADEME 1: kod → [T] (YOL-TABANLI — bkz. CONTRACT.md MADDE 17/B3: sembol yalnız
    // raporlama metninde kullanılır, dosyada var mı diye AYRICA doğrulanmaz; sembol doğrulaması
    // `integrity` alt-kuralının işidir, burada TEKRAR edilmez) ---
    const pkgRoots = ['.', ...tracked.filter(f => /(^|\/)package\.json$/.test(f)).map(f => pdirname(f))];
    for (const t of tDocs) {
      const docTouched = staged.has(t.path.replace(/\\/g, '/'));
      if (docTouched) continue;
      const docDir = pdirname(t.path);
      const staleCodeAnchors = [];
      for (const b of extractObjectBodies(t.fm, 'anchors')) {
        if (!b.raw) continue;
        const repo = readField(b.raw, 'repo');
        const symbol = readField(b.raw, 'symbol');
        if (!repo || !symbol) continue;
        const clean = repo.trim().replace(/\/$/, '');
        const candidates = [clean, join(docDir, clean), ...pkgRoots.map(r => join(r, clean))];
        const hit = candidates.find(c => existsSync(c));
        if (!hit) { unresolved.push(`${t.path}  →  anchors[]: ${repo}:${symbol} (yol çözülemedi — çapraz-repo olabilir, DOĞRULANAMADI)`); continue; }
        const hitNorm = hit.replace(/\\/g, '/').replace(/^\.\//, '');
        if (anchorTouched(hitNorm) || staged.has(hitNorm))
          staleCodeAnchors.push(`${repo}:${symbol} (${hitNorm})`);
      }
      if (staleCodeAnchors.length)
        findings.push({ doc: t.path, anchors: staleCodeAnchors, kademe: 1 });
    }

    // --- KADEME 2: [T] → [L0] (yol-tabanlı, sembol çözümü GEREKMEZ) ---
    for (const l0 of l0Docs) {
      const docTouched = staged.has(l0.path.replace(/\\/g, '/'));
      if (docTouched) continue;
      const anchorsBlock = l0.fm.match(/^anchors:\s*\r?\n((?:[ \t]+\S.*\r?\n?|[ \t]*\r?\n?)+)/m);
      const anchorsFm = anchorsBlock ? anchorsBlock[1] : '';
      const staleTechDocs = [];
      for (const b of extractObjectBodies(anchorsFm, 'tech_docs')) {
        if (b.raw || !b.str) continue;
        const tPath = b.str.replace(/\\/g, '/');
        if (staged.has(tPath)) staleTechDocs.push(tPath);
      }
      if (staleTechDocs.length)
        findings.push({ doc: l0.path, anchors: staleTechDocs, kademe: 2 });
    }
  }

  if (unclassified.length) (failUnclassified ? console.error : console.warn)(unclassifiedMsg());

  if (unresolved.length)
    console.warn(`\nDOC-RECENCY NOT (${unresolved.length}, sayılmadı — çözülemedi):\n` + unresolved.map(u => `  ${u}`).join('\n') + '\n');

  if (findings.length) {
    const lines = findings.map(f => {
      const tag = f.kademe === 1 ? ' [KADEME 1: kod→T]' : f.kademe === 2 ? ' [KADEME 2: T→L0]' : '';
      return `  ${f.doc}  ←  anchor'lı yol değişti ama doküman dokunulmadı${tag}: ${f.anchors.join(', ')}`;
    });
    const msg = `\nDOC-RECENCY TRIPWIRE (${findings.length} doküman):\n` + lines.join('\n')
      + `\n\n  • İlgili doküman bölümü hâlâ güncel mi? Değiştiyse güncelle, doğruysa dokun (örn. son-doğrulama tarihi).`
      + `\n  • SINIF: bu bir VARLIK tripwire'ıdır — "dokunuldu mu" der, içerik doğruluğunu garanti ETMEZ.\n`;
    if (strict) { console.error(msg + '(--strict: commit bloke edildi)\n'); return 1; }
    console.warn(msg);
    return 0;
  }
  if (failUnclassified) { console.error('(--strict: commit bloke edildi — sınıflanamayan anchor\'lı doküman)\n'); return 1; }
  const scannedCount = anchorsByDoc.size + (cascade ? tDocs.length + l0Docs.length : 0);
  console.log(`Doc-recency OK — ${scannedCount} anchor'lı doküman; bayatlama tripwire'ı yok.`);
  return 0;
}
