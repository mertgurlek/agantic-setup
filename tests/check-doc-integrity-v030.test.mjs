import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basename } from 'node:path';
import { initRepo, write, run, git, cleanup } from './helpers.mjs';

// v0.30 G2 — doc-integrity: B5a (model kimliği/kesir), B5b (Türkçe harf kırpması), B5c (append-only
// tarihsel yol), B5d (--ignore komut aileleri), B7 (aynı-repo sembol çözümü), T3 (sınıflanamayan
// anchor'lı doküman), T4 (boş doküman katmanı). Her davranış: kirli → sıfır-olmayan, temiz → 0.

const dt = (d, docs, extra = []) => run('check-doc-integrity.mjs', ['--rule=doc-truth', ...extra, ...docs], d);

// ── B5a ──────────────────────────────────────────────────────────────────────
test('B5a: model kimlikleri ve kesirler yol sayılmaz (exit 0)', () => {
  const d = initRepo();
  write(d, 'package.json', '{"scripts":{}}');
  write(d, 'CLAUDE.md', 'Model: `z-ai/glm-5.2`, `anthropic/claude-opus-5`, `openai/gpt-6.1-sol`; 137/140 test, `137/140` ve `1/3`.\n');
  const r = dt(d, ['CLAUDE.md']);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('B5a: gerçek ölü yol (uzantılı ya da var olan dizin altında) HÂLÂ fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'gates/var.mjs', 'export {};\n');
  write(d, 'CLAUDE.md', '`src/olmayan.ts` ve `gates/olmayan-uzantisiz`\n');
  git(d, 'add', '-A');
  const r = dt(d, ['CLAUDE.md']);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /src\/olmayan\.ts/);
  assert.match(r.out, /gates\/olmayan-uzantisiz/);
});

test('B5a: izlenen TEK dosyaya kısaltılmış yol (suffix) geçer; birden fazla eşleşme fail', () => {
  const d = initRepo();
  write(d, 'cap/mail/parsers/a.py', 'x = 1\n');
  write(d, 'cap/x/dup/b.py', 'x = 1\n');
  write(d, 'cap/y/dup/b.py', 'x = 1\n');
  write(d, 'ok.md', '`parsers/a.py`\n');
  write(d, 'kotu.md', '`dup/b.py`\n');
  git(d, 'add', '-A');
  const ok = dt(d, ['ok.md']);
  const kotu = dt(d, ['kotu.md']);
  cleanup(d);
  assert.equal(ok.status, 0, ok.out);
  assert.equal(kotu.status, 1, kotu.out);
});

// ── B5b ──────────────────────────────────────────────────────────────────────
test('B5b: Türkçe harf kırpması sahte komut üretmez — "npm bağımlılığı ... bağlanılır" (exit 0)', () => {
  const d = initRepo();
  write(d, 'package.json', '{"scripts":{"build":"tsc"}}');
  write(d, 'CLAUDE.md', 'npm bağımlılığı olmadan bağlanılır; make çağrısı yok. just şöyle: node öğrenir.\n');
  const r = dt(d, ['CLAUDE.md']);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('B5b: gerçek olmayan script HÂLÂ fail (tespit gücü korunur, exit 1)', () => {
  const d = initRepo();
  write(d, 'package.json', '{"scripts":{"build":"tsc"}}');
  write(d, 'CLAUDE.md', 'Çalıştır: `npm run kesinlikle-olmayan-script` sonra npm bağımlılığı bağlanılır\n');
  const r = dt(d, ['CLAUDE.md']);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /kesinlikle-olmayan-script/);
  assert.doesNotMatch(r.out, /script yok \(package\.json\): ba\b/);
});

// ── B5c ──────────────────────────────────────────────────────────────────────
function repoWithDeletedFile() {
  const d = initRepo();
  write(d, 'src/eski.ts', 'export {};\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'ekle');
  git(d, 'rm', '-q', 'src/eski.ts'); git(d, 'commit', '-q', '-m', 'sil');
  return d;
}

test('B5c: append-only defterde silinmiş (git izi olan) yol tarihsel sayılır (exit 0)', () => {
  const d = repoWithDeletedFile();
  write(d, 'docs/PRODUCT_LOG.md', 'src/eski.ts silindi: `src/eski.ts`\n');
  const r = dt(d, ['docs/PRODUCT_LOG.md']);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('B5c: aynı yol CANLI rehberde (CLAUDE.md) hata sürer; defterde bile git izi OLMAYAN uydurma yol fail (exit 1)', () => {
  const d = repoWithDeletedFile();
  write(d, 'CLAUDE.md', '`src/eski.ts`\n');
  write(d, 'docs/FRICTION_LOG.md', '`src/hic-olmadi.ts`\n');
  const canli = dt(d, ['CLAUDE.md']);
  const uydurma = dt(d, ['docs/FRICTION_LOG.md']);
  cleanup(d);
  assert.equal(canli.status, 1, canli.out);
  assert.equal(uydurma.status, 1, uydurma.out);
});

test('B5c: v0.30 karar defteri de append-only sayılır (silinmiş yol → exit 0)', () => {
  const d = repoWithDeletedFile();
  write(d, 'v0.30-KARAR-DEFTERI.md', 'K1: `src/eski.ts` kaldırıldı\n');
  const r = dt(d, ['v0.30-KARAR-DEFTERI.md']);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ── B5d ──────────────────────────────────────────────────────────────────────
test('B5d: --ignore= komut ailelerine de uygulanır; ignore YOKSA aynı satır fail', () => {
  const d = initRepo();
  write(d, 'package.json', '{"scripts":{}}');
  write(d, 'CLAUDE.md', 'Örnek komut: bun orneksiz-script\n');
  const kirli = dt(d, ['CLAUDE.md']);
  const temiz = dt(d, ['CLAUDE.md'], ['--ignore=orneksiz']);
  const temiz2 = dt(d, ['CLAUDE.md'], ['--ignore=bun']);
  cleanup(d);
  assert.equal(kirli.status, 1, kirli.out);
  assert.equal(temiz.status, 0, temiz.out);
  assert.equal(temiz2.status, 0, temiz2.out);
});

// ── B7 ───────────────────────────────────────────────────────────────────────
const tFm = (repo, symbol) => `---
id: TECH-X-001
feature_ids: [x]
anchors:
  - {repo: ${repo}, symbol: ${symbol}, kind: service, primary: true}
---
# TECH-X-001

## Ne yapar

Gövde on satırdan uzun olmalı ki stub sayılmasın; satır satır dolduruyoruz burada.
1. adım bir
2. adım iki
3. adım üç
4. adım dört
5. adım beş
`;

function sameRepo(symbolInCode, anchorRepo, anchorSymbol, kunye) {
  const d = initRepo();
  write(d, 'src/Handlers/Add.cs', `namespace X;\npublic class ${symbolInCode}\n{\n    public int Ping(int a)\n    {\n        return a;\n    }\n}\n`);
  write(d, 'docs/tech/x.md', tFm(anchorRepo(d), anchorSymbol));
  if (kunye) write(d, '.agentic-repo-setup.json', JSON.stringify(kunye));
  git(d, 'add', '-A');
  return d;
}

test('B7: aynı-repo adı + sembol kodda TANIMLI → çözülür, sert bulgu yok (--strict exit 0)', () => {
  const d = sameRepo('AddHandler', dd => basename(dd), 'AddHandler');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /1 aynı-repo anchor tanımdan çözüldü/);
  assert.doesNotMatch(r.out, /çapraz-repo/);
});

test('B7: repo adı karşılaştırması büyük/küçük harf duyarsız + yöntem (Ping) tanımı çözülür', () => {
  const d = sameRepo('AddHandler', dd => basename(dd).toUpperCase(), 'Ping');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('B7: aynı-repo adı ama sembol TANIMLI DEĞİL → sert bulgu: --strict exit 1, bayraksız uyarı exit 0', () => {
  const d = sameRepo('AddHandler', dd => basename(dd), 'OlmayanSinif');
  const strict = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  const soft = run('check-doc-integrity.mjs', ['--rule=integrity'], d);
  cleanup(d);
  assert.equal(strict.status, 1, strict.out);
  assert.match(strict.out, /bu repoda tanımlı değil/);
  assert.equal(soft.status, 0, soft.out);
});

test('B7: BAŞKA repo adı → eski yumuşak not (çapraz-repo, sayılmadı), --strict exit 0', () => {
  const d = sameRepo('AddHandler', () => 'baska-repo-adi', 'OlmayanSinif');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /çapraz-repo/);
});

test('B7: künyedeki repo adı alanı da "bu repo" sayılır', () => {
  const d = sameRepo('AddHandler', () => 'Kunye-Adi', 'AddHandler', { repo: 'kunye-adi' });
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /aynı-repo anchor tanımdan çözüldü/);
});

// ── T3 ───────────────────────────────────────────────────────────────────────
function unclassifiedRepo(kunye) {
  const d = initRepo();
  write(d, 'src/a.ts', 'export class A {}\n');
  // anchors: var, feature_ids: yok → [T] sınıflanamaz
  write(d, 'docs/knowledge/tech/a.md', '---\nid: K-A\nanchors:\n  - {repo: src/a.ts, symbol: A}\n---\n# A\n\nGövde.\n');
  if (kunye) write(d, '.agentic-repo-setup.json', JSON.stringify(kunye));
  git(d, 'add', '-A');
  return d;
}

test('T3: sınıflanamayan anchor\'lı doküman görünür UYARI (exit 0); --strict FAIL (exit 1)', () => {
  const d = unclassifiedRepo();
  const warn = run('check-doc-integrity.mjs', ['--rule=doc-recency'], d);
  const strict = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(warn.status, 0, warn.out);
  assert.match(warn.out, /UYARI: 1 doküman \[T\] olarak tanınmadı \(sınıflanamadı\) — tazelik zinciri bunları GÖRMÜYOR/);
  assert.equal(strict.status, 1, strict.out);
  assert.match(strict.out, /FAIL: 1 doküman \[T\] olarak tanınmadı/);
});

test('T3: künyede son_kullanici_dokumani açıkça false ise eski NOT (strict bile exit 0)', () => {
  const d = unclassifiedRepo({ toggles: { muhatap: { son_kullanici_dokumani: false } } });
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /NOT \(1, sınıflanamadı/);
});

test('T3: sınıflanabilir [T] varsa tanınmadı uyarısı yok (temiz, exit 0)', () => {
  const d = initRepo();
  write(d, 'src/a.ts', 'export class A {}\n');
  write(d, 'docs/tech/a.md', tFm('src/a.ts', 'A'));
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', '--cascade'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /tanınmadı/);
});

// ── T4 ───────────────────────────────────────────────────────────────────────
test('T4: [T]/[L0] yok + registry YOK → görünür "doküman katmanı boş" satırı, exit 0 (strict bile)', () => {
  const d = initRepo();
  write(d, 'README.md', '# x\n');
  git(d, 'add', '-A');
  const i = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  const rc = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(i.status, 0, i.out);
  assert.match(i.out, /Doküman katmanı boş/);
  assert.match(i.out, /no-op/);
  assert.equal(rc.status, 0, rc.out);
  assert.match(rc.out, /Doküman katmanı boş/);
});

test('T4: künyede toggle AÇIK ise satır "BOŞLUKTUR" der', () => {
  const d = initRepo();
  write(d, 'README.md', '# x\n');
  write(d, '.agentic-repo-setup.json', JSON.stringify({ toggles: { muhatap: { son_kullanici_dokumani: true } } }));
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /BOŞLUKTUR/);
});

test('T4: registry dosyası VAR + hiç [T]/[L0] yok → --strict FAIL (exit 1), bayraksız exit 0', () => {
  const d = initRepo();
  write(d, 'README.md', '# x\n');
  write(d, 'docs/registry.yaml', 'features:\n');
  git(d, 'add', '-A');
  const i = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  const iSoft = run('check-doc-integrity.mjs', ['--rule=integrity'], d);
  const rc = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(i.status, 1, i.out);
  assert.match(i.out, /kapsam var, doküman yok/);
  assert.equal(iSoft.status, 0, iSoft.out);
  assert.equal(rc.status, 1, rc.out);
});

// ── v0.30.4: doc-truth gitignore muafiyeti (saha: saha-B F-021 `data/app.db`; saha-A test-outputs) ──
test('v0.30.4 doc-truth: .gitignore\'daki var-olmayan yol ölü referans SAYILMAZ (exit 0)', () => {
  const d = initRepo();
  write(d, '.gitignore', 'data/*.db\ntest-outputs/\n');
  write(d, 'CLAUDE.md', 'İlk koşumda `data/app.db` yaratılır; çıktılar `test-outputs/rapor.txt` altında.\n');
  git(d, 'add', '-A');
  const r = dt(d, ['CLAUDE.md']);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('v0.30.4 doc-truth: var olmayan VE ignore EDİLMEYEN yol HÂLÂ FAIL; ignore\'luyla karışık listede yalnız o raporlanır', () => {
  const d = initRepo();
  write(d, '.gitignore', 'data/*.db\n');
  write(d, 'CLAUDE.md', '`data/app.db` ve `src/olmayan.ts`\n');
  git(d, 'add', '-A');
  const r = dt(d, ['CLAUDE.md']);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /src\/olmayan\.ts/);
  assert.doesNotMatch(r.out, /yol yok: data\/saha-B/);
});

test('v0.30.4 hakem: doc-truth gitignore muafiyeti GÖRÜNÜR — "N yol .gitignore\'lı — ölü sayılmadı: <ilk 5>" notu, exit 0', () => {
  const d = initRepo();
  write(d, '.gitignore', 'out/\n');
  write(d, 'CLAUDE.md', '`out/a.txt` `out/b.txt` `out/c.txt` `out/d.txt` `out/e.txt` `out/f.txt`\n');
  git(d, 'add', '-A');
  const r = dt(d, ['CLAUDE.md']);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /6 yol \.gitignore'lı — ölü sayılmadı: out\/a\.txt/);
  assert.match(r.out, /…/);
});

// ── v0.30.5 (saha: pilot-backend) ───────────────────────────────────────────
// B7-ek: C# property + virgül-sonrası-boşluklu generic dönüş tipi tanım sayılır; OLMAYAN ad yine sert bulgu.
const CS_BODY = `namespace X;
public class Cfg
{
    public string[] ExemptEmails { get; set; }
    public List<Item> Items { get; init; }
    public int Total => 5;
    public async Task<Dictionary<string, string>> GetStaticValuesForCustomerAsync(int id)
    {
        return null;
    }
}
`;
function csRepo(sym) {
  const d = initRepo();
  write(d, 'src/Cfg.cs', CS_BODY);
  write(d, 'docs/tech/x.md', tFm(basename(d), sym));
  git(d, 'add', '-A');
  return d;
}
for (const sym of ['ExemptEmails', 'Items', 'Total', 'GetStaticValuesForCustomerAsync']) {
  test(`B7-ek: C# property/generic-dönüş '${sym}' tanımlı sayılır (--strict exit 0)`, () => {
    const d = csRepo(sym);
    const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
    cleanup(d);
    assert.equal(r.status, 0, r.out);
  });
}
test('B7-ek NEGATİF: genişleyen regex olmayan sembolü tanımlı SAYMAZ (çağrı/lambda/atama; --strict exit 1)', () => {
  for (const sym of ["Missing", "Dict", "Foo", "Lam"]) {
    const d = initRepo();
    write(d, 'src/Cfg.cs', `namespace X;\npublic class Cfg\n{\n    void Run()\n    {\n        Missing(a, b);
        var q = list.Select(Lam => Lam.Id);\n        Dict.Add(a, b);\n        Foo(a, b);\n        return Other, Dict;\n    }\n}\n`);
    write(d, 'docs/tech/x.md', tFm(basename(d), sym));
    git(d, 'add', '-A');
    const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
    cleanup(d);
    assert.equal(r.status, 1, `${sym}: ${r.out}`);
    assert.match(r.out, /bu repoda tanımlı değil/);
  }
});

// doc-truth kapsam filtresi: açık argümanlar yalnız rehber (.md) ise taranır.
test('v0.30.5: açık argümanda künye/yml/kod rehber SANILMAZ (ölü yol FAIL üretmez, exit 0)', () => {
  const d = initRepo();
  write(d, 'package.json', '{"scripts":{}}');
  write(d, 'CLAUDE.md', 'Temiz.\n');
  write(d, '.agentic-repo-setup.json', '{"x":"`src/yok/olmayan.ts`"}');
  write(d, '.github/ci.yml', 'run: `src/yok/olmayan.ts`\n');
  write(d, 'gates/k.mjs', '// `src/yok/olmayan.ts`\n');
  git(d, 'add', '-A');
  const r = dt(d, ['CLAUDE.md', '.agentic-repo-setup.json', '.github/ci.yml', 'gates/k.mjs']);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /\[taranan=1\]/);
});

test('v0.30.5: argümanların HEPSİ kapsam dışı → "0 rehber (N argüman kapsam dışı)" exit 0', () => {
  const d = initRepo();
  write(d, 'a.json', '{}');
  write(d, 'b.yml', 'a: 1\n');
  git(d, 'add', '-A');
  const r = dt(d, ['a.json', 'b.yml']);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /0 rehber \(2 argüman kapsam dışı\)/);
});

test('v0.30.5: kapsam içi rehberdeki ölü yol HÂLÂ fail; argümansız + boş repo eski boş-küme FAIL korunur', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '`src/yok/olmayan.ts`\n');
  git(d, 'add', '-A');
  const bad = dt(d, ['CLAUDE.md', 'x.json']);
  cleanup(d);
  assert.equal(bad.status, 1, bad.out);
  const e = initRepo();
  const empty = dt(e, []);
  cleanup(e);
  assert.equal(empty.status, 1, empty.out);
});
