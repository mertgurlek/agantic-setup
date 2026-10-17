// Test yardımcıları (v0.8) — sıfır bağımlılık (node:test + node:assert).
// Her kapıyı geçici bir dizinde gerçek fixture'larla koşar: kötü girdi → exit 1, temiz → exit 0.
// NEDEN: CodexQB'nin en güçlü yanı test+CI olgunluğuydu; bizim kapılarımızın 0 testi vardı.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATES = join(HERE, '..', 'gates');
const SCRIPTS = join(HERE, '..', 'scripts');

// Geçici çalışma dizini (her test izole).
export function tmp() {
  return mkdtempSync(join(tmpdir(), 'ars-test-'));
}

// Dosya yaz (alt dizinler dahil) ve KULLANILAN GÖRELİ yolu döndür (kapıya argüman olur).
export function write(dir, rel, content) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return rel;
}

// Kapıyı koş; { status, out } döndür (out = stdout+stderr, trimli).
// v0.10: opsiyonel `env` (AST-adaptörü gibi env-toggle'lı dallar için) — verilmezse davranış AYNI.
export function run(gateFile, args = [], cwd, env) {
  const opts = { cwd, encoding: 'utf8' };
  if (env) opts.env = { ...process.env, ...env };
  const r = spawnSync(process.execPath, [join(GATES, gateFile), ...args], opts);
  return { status: r.status, out: ((r.stdout || '') + (r.stderr || '')).trim() };
}

// scripts/ altındaki (paket-içi araç, hedef-repoya kopyalanmayan) bir script'i koş.
export function runScript(scriptFile, args = [], cwd, env) {
  const opts = { cwd, encoding: 'utf8' };
  if (env) opts.env = { ...process.env, ...env };
  const r = spawnSync(process.execPath, [join(SCRIPTS, scriptFile), ...args], opts);
  return { status: r.status, out: ((r.stdout || '') + (r.stderr || '')).trim() };
}

// Geçici dizinde git komutu (staged/commit gerektiren kapılar için).
export function git(dir, ...args) {
  return spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
}

// İzole git reposu kur (yerel user config — global config gerektirmez, CI'da da çalışır).
export function initRepo() {
  const dir = tmp();
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'ars-test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  return dir;
}

export function cleanup(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* yoksay */ }
}
