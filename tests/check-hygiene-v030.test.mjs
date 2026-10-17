import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmp, write, run, cleanup, initRepo, git } from './helpers.mjs';

// v0.30 G1 — check-hygiene saha yamaları: B1 defter sınıfı · B2 halka-duyarlı file-size kapsamı ·
// B6 secrets tip/boolean FP · B9b .NET BOM. Kaynak: saha-A, saha-G,
// pilot-backend, saha-C/saha-E/saha-F secrets vakaları.
const lines = (n) => Array.from({ length: n }, (_, i) => `satır ${i + 1}`).join('\n') + '\n';
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

// ── B1: defter sınıfı ──
test('B1 file-size: defter 350 satır geçer (rehber olsaydı FAIL) — DECISIONS.md', () => {
  const d = tmp();
  write(d, 'DECISIONS.md', lines(350));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'DECISIONS.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('B1 file-size: defter 500 satır UYARI + exit 0, mesaj arşive taşı DEMEZ', () => {
  const d = tmp();
  write(d, 'docs/FRICTION_LOG.md', lines(500));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'docs/FRICTION_LOG.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /DEFTER/);
  assert.doesNotMatch(r.out, /arsive tasi/i);
});

test('B1 file-size: defter 1300 satır FAIL, mesaj append-only gerçeğine uygun', () => {
  const d = tmp();
  write(d, 'v0.29-KARAR-DEFTERI.md', lines(1300));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'v0.29-KARAR-DEFTERI.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /DEFTER/);
  assert.match(r.out, /yeni surum defteri/);
  assert.doesNotMatch(r.out, /arsive \(docs\/archive\)/);
});

test('B1 file-size: SIDE-BUGS-LOG ve genel X_LOG.md defter sınıfında (350 satır geçer)', () => {
  const d = tmp();
  write(d, 'docs/SIDE-BUGS-LOG.md', lines(350));
  write(d, 'docs/engineering_LOG.md', lines(350));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'docs/SIDE-BUGS-LOG.md', 'docs/engineering_LOG.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('B1 file-size: STATE.md REHBER kalır — 350 satır hâlâ FAIL (koruma korundu)', () => {
  const d = tmp();
  write(d, 'STATE.md', lines(350));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'STATE.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /REHBER/);
});

// ── B2: kapsam — varsayılan STAGED; geniş kapsam yalnız --worktree / GATES_RING=elle ──
test('B2 file-size: varsayılan (bayraksız) — untracked kirli rehber commit bloke ETMEZ (exit 0, 0 dosya)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', lines(320));          // git add YOK → untracked
  const r = run('check-hygiene.mjs', ['--rule=file-size'], d, { GATES_RING: '' });
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /0 dosya tarandi \(kapsam: staged\)/);
  assert.match(r.out, /--worktree/);
});

test('B2 file-size: --worktree — untracked kirli rehber YAKALANIR', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', lines(320));
  const r = run('check-hygiene.mjs', ['--rule=file-size', '--worktree'], d, { GATES_RING: '' });
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /REHBER/);
});

test('B2 file-size: GATES_RING=elle — unstaged değişiklik yakalanır', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', lines(50));
  git(d, 'add', '-A'); git(d, 'commit', '-qm', 'i');
  write(d, 'CLAUDE.md', lines(320));          // commit sonrası unstaged büyüme
  const r = run('check-hygiene.mjs', ['--rule=file-size'], d, { GATES_RING: 'elle' });
  const r2 = run('check-hygiene.mjs', ['--rule=file-size'], d, { GATES_RING: '' });
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.equal(r2.status, 0, r2.out);         // varsayılan staged: unstaged görülmez
});

test('B2 file-size: GATES_RING=pre-commit — yalnız staged; untracked kirli dosya görülmez (exit 0)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', lines(320));
  const r = run('check-hygiene.mjs', ['--rule=file-size'], d, { GATES_RING: 'pre-commit' });
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /0 dosya tarandi \(kapsam: staged/);
});

test('B2 file-size: staged kirli dosya → FAIL (halkasız ve pre-commit halkasında)', () => {
  for (const ring of ['', 'pre-commit']) {
    const d = initRepo();
    write(d, 'CLAUDE.md', lines(320));
    git(d, 'add', 'CLAUDE.md');
    const r = run('check-hygiene.mjs', ['--rule=file-size'], d, { GATES_RING: ring });
    cleanup(d);
    assert.equal(r.status, 1, `${ring}: ${r.out}`);
  }
});

test('B2 file-size: --worktree, hiçbir şey yok → "0 dosya tarandi (kapsam: …)" görünür, exit 0', () => {
  const d = initRepo();
  const r = run('check-hygiene.mjs', ['--rule=file-size', '--worktree'], d, { GATES_RING: '' });
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /0 dosya tarandi \(kapsam: staged ∪ unstaged ∪ untracked\)/);
});

test('B2 file-size: --worktree — temiz untracked rehber geçer, sayı raporlanır', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', lines(40));
  const r = run('check-hygiene.mjs', ['--rule=file-size', '--worktree'], d, { GATES_RING: '' });
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /1 dosya tarandi/);
});

test('B2 file-size: hakem deneyi — 1101 satırlık untracked .ts varsayılanda exit 0, --worktree exit 1', () => {
  const d = initRepo();
  write(d, 'big.ts', lines(1101));
  const r = run('check-hygiene.mjs', ['--rule=file-size'], d, { GATES_RING: '' });
  const r2 = run('check-hygiene.mjs', ['--rule=file-size', '--worktree'], d, { GATES_RING: '' });
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.equal(r2.status, 1, r2.out);
});

// ── B6: secrets tip/boolean FP ──
const secretsOn = (content, name = 'x.ts') => {
  const d = tmp();
  const f = write(d, name, content);
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  return r;
};

test('B6 secrets: TS tip / boolean-literal biçimleri sır sayılmaz (exit 0)', () => {
  for (const line of [
    'password: string;', 'password?: string;', 'password: string | null;',
    'readonly password: string;', 'password: boolean;', 'password: string[];',
    'const o={password:!0,user:"a"};', 'x={password:!1}', 'pwd: number,',
    'f(password:!0)', 'password: !1;',
  ]) {
    const r = secretsOn(line + '\n');
    assert.equal(r.status, 0, `${line} → ${r.out}`);
  }
});

test('B6 secrets: gerçek atamalar hâlâ yakalanır (exit 1)', () => {
  const real = 'Zq8' + 'xK2mPw9';
  for (const [line, name] of [
    [`password: "${real}"`, 'x.ts'],
    [`const password = '${real}';`, 'x.ts'],
    [`PASSWORD=${real}`, 'x.env'],
    [`password: string = "${real}";`, 'x.ts'],
    ['password: 1!Secr3tPass', 'x.ts'],
    ['password: "1!Secr3tPass"', 'x.ts'],
    ['password: 0$ecretPassw0rd', 'x.ts'],
    ['PASSWORD=1-hunter2-xyz', 'x.env'],
    ['password: !0abcdefg', 'x.ts'],
  ]) {
    const r = secretsOn(line + '\n', name);
    assert.equal(r.status, 1, `${line} → ${r.out}`);
  }
});

// ── v0.30.4: TS/JS tırnaksız tanımlayıcı/özellik referansı sır değil (saha: saha-C 20 FP) ──
test('v0.30.4 secrets: TS/JS `password: someVar|user.password|hashed|a?.b` referansı sır sayılmaz (exit 0)', () => {
  for (const [line, name] of [
    ['password: someVar,', 'a.ts'], ['password: user.password,', 'lib/user-service.ts'],
    ['  password: hashed', 'auth.tsx'], ['password: formData.password }', 'AuthForm.tsx'],
    ['password: input?.password,', 'x.mjs'], ['const o = { password: hashedPassword };', 'x.js'],
    ['"your-super-secret-key-change-this-in-production"', 'x.ts'],
  ]) {
    const r = secretsOn(line + '\n', name);
    assert.equal(r.status, 0, `${line} → ${r.out}`);
  }
});

test('v0.30.4 secrets: tırnaklı, `=` atamalı, .env/.yml ve atama-takipli referans HÂLÂ yakalanır (exit 1)', () => {
  const real = 'Zq8' + 'xK2mPw9';
  for (const [line, name] of [
    [`password: "${real}"`, 'a.ts'],
    [`password = ${real}`, 'a.ts'],
    [`const password = someVar${real}`, 'a.ts'],
    [`password: ${real}`, 'a.yml'],
    [`PASSWORD=${real}`, 'a.env'],
    [`password: hashed = "${real}";`, 'a.ts'],
    ['password: 1!Secr3tPass', 'a.ts'],
  ]) {
    const r = secretsOn(line + '\n', name);
    assert.equal(r.status, 1, `${line} → ${r.out}`);
  }
});

test('v0.30.4 hakem: TS muafiyeti fallback/birleştirme/ikinci-eşleşmedeki GERÇEK parolayı kaçırmaz (exit 1)', () => {
  for (const line of [
    '{ password: process.env.DB_PASS || "fallback-secret-123" }',
    '{ password: user.password, admin: { password: "Hunter22Real" } }',
    '{ password: cfg.pwd ?? "Hunter22Real" }',
    '{ pwd: someValue + "SuffixSecret99" }',
  ]) {
    const r = secretsOn(line + '\n', 'a.ts');
    assert.equal(r.status, 1, `${line} → ${r.out}`);
  }
});

test('v0.30.4 hakem: JSON/tırnaklı anahtar `"password": "Gizli123!"` yakalanır (exit 1); tip kelimesi/placeholder yakalanmaz (exit 0)', () => {
  assert.equal(secretsOn('{"password": "Gizli123!"}\n', 'a.json').status, 1);
  assert.equal(secretsOn("{'pwd': 'Gizli123!'}\n", 'a.js').status, 1);
  assert.equal(secretsOn('{"password": "string"}\n', 'a.json').status, 0);
  assert.equal(secretsOn('{"password": "your-db-password"}\n', 'a.json').status, 0);
});

test('v0.30.4 hakem: VALUE_PH kelime sınırı — gömülü "changeit" sahte-muafiyet vermez (exit 1); gerçek şablon değeri muaf (exit 0)', () => {
  const real = 'Zq8' + 'xK2mPw9';
  assert.equal(secretsOn(`password = ${real}exchangeit\n`, 'a.env').status, 1);
  assert.equal(secretsOn('password = change-this-now\n', 'a.env').status, 0);
});

// ── B9b: .NET BOM ──
test('B9b utf8: .cs/.csproj/.sln/.resx/.vb/.fsproj/.props BOM kabul (exit 0)', () => {
  const d = tmp();
  const names = ['A.cs', 'A.csproj', 'A.sln', 'A.resx', 'A.vb', 'A.fsproj', 'A.props'];
  for (const n of names) writeFileSync(join(d, n), Buffer.concat([BOM, Buffer.from('<x/>\n')]));
  const r = run('check-hygiene.mjs', ['--rule=utf8', ...names], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /7 \.NET dosyasinda BOM/);
});

test('B9b utf8: BOM .NET dışında (.ts) hâlâ FAIL', () => {
  const d = tmp();
  writeFileSync(join(d, 'a.ts'), Buffer.concat([BOM, Buffer.from('let a=1\n')]));
  const r = run('check-hygiene.mjs', ['--rule=utf8', 'a.ts'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /BOM/);
});

test('B9b utf8: BOMlu .cs içinde geçersiz bayt → FAIL (kabul bozulmayı gizlemez)', () => {
  const d = tmp();
  writeFileSync(join(d, 'B.cs'), Buffer.concat([BOM, Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a])]));
  const r = run('check-hygiene.mjs', ['--rule=utf8', 'B.cs'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /gecersiz UTF-8/);
});

test('B9b utf8: BOMsuz geçersiz bayt .csproj → FAIL', () => {
  const d = tmp();
  writeFileSync(join(d, 'C.csproj'), Buffer.from([0x3c, 0xff, 0xfe, 0x0a]));
  const r = run('check-hygiene.mjs', ['--rule=utf8', 'C.csproj'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

// ── v0.30.4: file-size --all (git ls-files; saha saha-D KOK-8a) ──
test('v0.30.4 file-size --all: izlenen kirli rehber (staged boş) YAKALANIR (exit 1); untracked taranmaz', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', lines(320));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'AGENTS.md', lines(320));                  // untracked → --all görmez
  const r = run('check-hygiene.mjs', ['--rule=file-size', '--all'], d, { GATES_RING: '' });
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /CLAUDE\.md/);
  assert.doesNotMatch(r.out, /AGENTS\.md/);
});

test('v0.30.4 file-size --all: temiz repoda "N dosya denetlendi" sayısı görünür, exit 0', () => {
  const d = initRepo();
  write(d, 'a.js', 'x\n'); write(d, 'CLAUDE.md', lines(5));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = run('check-hygiene.mjs', ['--rule=file-size', '--all'], d, { GATES_RING: '' });
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /2 dosya denetlendi/);
});

test('B6 secrets: dil dosyası / arayüz etiketi sır sayılmaz; dil dışı JSON gerçek değer YAKALANIR (hakem turu 2)', () => {
  for (const [line, name] of [
    ['{ "password": "Password" }', 'en.json'],
    ['{ "login": { "password": "Parola giriniz" } }', 'locales/tr.json'],
    ['{ "password": "Parola" }', 'ui.json'],
    ['{ "password": "Şifre" }', 'src/i18n/strings.json'],
  ]) {
    const r = secretsOn(line + '\n', name);
    assert.equal(r.status, 0, `${name}: ${line} → ${r.out}`);
  }
  const r = secretsOn('{ "password": "Gizli123!" }\n', 'config.json');
  assert.equal(r.status, 1, r.out);
});

// v0.30.5 (saha: saha-C)
test('v0.30.5 secrets: TS fonksiyon imzası ve Zod/şema tanımı sır sayılmaz', () => {
  for (const line of [
    'export async function hashPassword(password: string): Promise<string> {',
    'function validatePassword(password: string): PasswordValidationResult {',
    "  password: z.string().min(8, 'En az 8 karakter olmalı'),",
    "  password: yup.string().required('Parola zorunlu alan'),",
    '  password: process.env.DB_PASS,',
  ]) {
    const r = secretsOn(line + '\n');
    assert.equal(r.status, 0, `${line} → ${r.out}`);
  }
});

test('v0.30.5 secrets NEGATİF: atamalı tip, fallback sabiti ve JSON/md gerçek değer YAKALANIR', () => {
  for (const [line, name] of [
    ['function f(password: string = "Gercek123") {', 'x.ts'],
    ['const o = { password: process.env.X || "fallback-secret-123" };', 'x.ts'],
    ['const o = { password: process.env.X ?? "fallback-secret-123" };', 'x.ts'],
    ['{ "password": "Gercek123!" }', 'docs/TESTING.md'],
  ]) {
    const r = secretsOn(line + '\n', name);
    assert.equal(r.status, 1, `${line} → ${r.out}`);
  }
});
