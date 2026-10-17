// Doc-integrity ortak bağlam yardımcıları (G2/v0.30): künye okuma, registry bulma, "bu repo kim"
// kimliği ve aynı-repo sembol tanımı çözümü. Kapı DEĞİL — gates/lib/ altı paylaşılan modül.
// Hepsi SALT-OKUR ve fail-open (git/künye yoksa null/boş küme döner, kapı eski davranışa düşer).
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';

export const DEFAULT_REGISTRY_LOCATIONS = ['docs/registry.yaml', 'docs/registry.yml', 'registry.yaml', 'registry.yml', 'docs/tech/registry.yaml'];

// Registry dosyası (kapsam tanımı) var mı? Açık --registry= verilmişse onu, yoksa varsayılan konumları dener.
export function findRegistryFile(explicit = null) {
  if (explicit) return existsSync(explicit) ? explicit : null;
  return DEFAULT_REGISTRY_LOCATIONS.find(existsSync) || null;
}

// Kurulum künyesi (.agentic-repo-setup.json) — yalnız OKUNUR; yoksa/bozuksa null.
export function readKunye(path = '.agentic-repo-setup.json') {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

// toggles.muhatap.son_kullanici_dokumani → true | false | null (künye yok / alan yok / null = sorulmadı).
export function readSonKullaniciToggle(kunye = readKunye()) {
  const v = kunye && kunye.toggles && kunye.toggles.muhatap ? kunye.toggles.muhatap.son_kullanici_dokumani : undefined;
  return typeof v === 'boolean' ? v : null;
}

function sh(cmd) {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1024 * 1024 }).toString('utf8').trim(); }
  catch { return ''; }
}

// "Bu repo" adları (küçük harf, karşılaştırma büyük/küçük harf DUYARSIZ): git toplevel klasör adı ·
// künyedeki repo-adı alanı (repo|repo_name|repo_adi|project|name) · origin url son parçası (.git'siz).
export function ownRepoNames(kunye = readKunye()) {
  const names = new Set();
  const add = v => { if (typeof v === 'string' && v.trim()) names.add(v.trim().toLowerCase()); };
  const top = sh('git rev-parse --show-toplevel');
  if (top) add(basename(top));
  if (kunye) for (const k of ['repo', 'repo_name', 'repo_adi', 'project', 'name']) add(kunye[k]);
  const origin = sh('git config --get remote.origin.url');
  if (origin) add(origin.replace(/[\\/]+$/, '').replace(/\.git$/i, '').split(/[\\/:]/).pop());
  return names;
}

// anchors[].repo bu repoya mı ait? ("owner/name" biçiminde son parça da denenir.)
export function isOwnRepo(repo, names) {
  const r = String(repo || '').trim().toLowerCase().replace(/[\\/]+$/, '');
  if (!r) return false;
  return names.has(r) || names.has(r.split(/[\\/]/).pop());
}

// Tek geçişte izlenen KOD dosyalarındaki tanımlı adlar kümesi (önbellekli: süreç başına bir kez).
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|cs|java|kt|kts|py|go|rs|rb|php|swift|scala|dart|vue|svelte)$/i;
const DEF_RE = /(?<![\w$])(?:class|interface|record|struct|enum|function|def|const|let|var|type|func|trait|fn|object|namespace|protocol|impl)\s+(?=([A-Za-z_$][\w$]*))/g;
// Yöntem/üye TANIMLARI (C#/Java/Kotlin/TS): satır başında "[nitelikler] [değiştiriciler] Tür Ad(" ya da
// (JS/TS sınıf yöntemi) "[async|static|get|set] Ad(...) {". ÇAĞRI satırları (return/await/new/= ...) anahtar
// sözcük + atama dışlamasıyla elenir — aksi hâlde her çağrı "tanım" sayılıp kapı körleşirdi.
const METHOD_TYPED = /^[ \t]*(?:\[[^\]\n]*\][ \t]*)*(?:(?:public|private|protected|internal|static|async|override|virtual|abstract|sealed|extern|partial|export|readonly|unsafe|new)[ \t]+)*[A-Za-z_](?:[\w.<>?\[\]]|,[ \t]*)*[ \t]+([A-Za-z_]\w*)[ \t]*(?:<[^>\n]*>)?\(/gm;
// C# property (v0.30.5): "[mod+] Tür Ad { get|set|init" ya da "Ad =>" (en az bir değiştirici şart: çıplak lambda tanım sayılmaz).
const PROP_CS = /^[ \t]*(?:\[[^\]\n]*\][ \t]*)*(?:(?:public|private|protected|internal|static|override|virtual|abstract|sealed|required|readonly|new)[ \t]+)+[A-Za-z_](?:[\w.<>?\[\]]|,[ \t]*)*[ \t]+([A-Za-z_]\w*)[ \t]*(?:\{[ \t]*(?:get|set|init)\b|=>)/gm;
const METHOD_JS = /^[ \t]+(?:(?:public|private|protected|static|async|get|set|override)[ \t]+)*([A-Za-z_$][\w$]*)[ \t]*(?:<[^>\n]*>)?\([^)\n]*\)[^;=\n]*\{/gm;
const SKIP_NAMES = new Set(['class', 'struct', 'interface', 'enum', 'record', 'if', 'for', 'foreach', 'while', 'switch', 'catch', 'using', 'lock',
  'return', 'await', 'new', 'throw', 'else', 'yield', 'case', 'typeof', 'nameof', 'sizeof', 'function', 'fixed', 'when', 'in', 'is', 'as', 'out', 'ref']);
const SKIP_TYPES = new Set(['return', 'await', 'new', 'throw', 'else', 'yield', 'case', 'var', 'in', 'is', 'as', 'goto', 'using']);
let symbolCache = null;
export function definedSymbols(tracked) {
  if (symbolCache) return symbolCache;
  const set = new Set();
  for (const f of tracked) {
    if (!CODE_EXT.test(f)) continue;
    let text;
    try { if (statSync(f).size > 2 * 1024 * 1024) continue; text = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of text.matchAll(DEF_RE)) if (!SKIP_NAMES.has(m[1])) set.add(m[1]);
    for (const m of text.matchAll(METHOD_TYPED)) {
      const typeTok = m[0].trim().split(/\s+/).slice(-2)[0];   // "Tür" ya da değiştirici
      if (!SKIP_NAMES.has(m[1]) && !SKIP_TYPES.has(typeTok) && !m[0].includes('=')) set.add(m[1]);
    }
    for (const m of text.matchAll(PROP_CS)) if (!SKIP_NAMES.has(m[1])) set.add(m[1]);
    for (const m of text.matchAll(METHOD_JS)) if (!SKIP_NAMES.has(m[1])) set.add(m[1]);
  }
  symbolCache = set;
  return set;
}

// Sembol (Sinif.metot / Sinif::metot / Sinif#metot biçimleri dahil) tanımlı mı? Tam ad VEYA baş parça.
export function isSymbolDefined(symbol, defined) {
  const s = String(symbol || '').trim().replace(/^#/, '');
  if (!s) return false;
  if (defined.has(s)) return true;
  const parts = s.split(/[.:#/]+/).filter(Boolean);
  return parts.length > 1 && (defined.has(parts[0]) || defined.has(parts[parts.length - 1]));
}

// Doldurulmamış şablon alanı (`{{...}}`) argüman olarak geldiyse (ör. CI'da `{{CASCADE_BAYRAGI}}`) mesaj döner,
// yoksa null. Sessizce "dosya sayılıp atlanmak" yerine FAIL — CI/hook şablonu doldurulmamış demektir.
export function doldurulmamisSablonArgumani(argv) {
  const bad = argv.filter(a => /^\{\{|\}\}/.test(String(a)) || /\{\{.*\}\}/.test(String(a)));
  return bad.length ? `doldurulmamış şablon alanı argüman olarak geldi: ${bad.join(' ')} — CI/hook şablonunu doldur` : null;
}
