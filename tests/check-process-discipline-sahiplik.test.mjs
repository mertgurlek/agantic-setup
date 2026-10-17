import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initRepo, write, cleanup, tmp } from './helpers.mjs';
import { liste } from '../gates/lib/sahiplik.mjs';

// check-process-discipline --rule=dosya-sahipligi (v0.31.0). Stdin alanları ÖLÇÜLDÜ (2026-10-06, claude -p probu).
// Varsayılan ENGELLE (exit 2 + stderr): uyarı modunda mesaj modele yazım BİTTİKTEN sonra ulaştı [ÖLÇÜLDÜ, e2e].
// --uyari: tek JSON additionalContext + exit 0 (düz stdout modele ULAŞMAZ).
const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'gates', 'check-process-discipline.mjs');

function hook(cwd, payload, ...flags) {
  const r = spawnSync(process.execPath, [GATE, '--rule=dosya-sahipligi', ...flags],
    { cwd, encoding: 'utf8', input: typeof payload === 'string' ? payload : JSON.stringify(payload) });
  return { status: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}
const pre = (cwd, session, yol, agent, tool = 'Edit') => ({
  hook_event_name: 'PreToolUse', tool_name: tool, session_id: session, cwd,
  ...(agent ? { agent_id: agent } : {}),
  tool_input: tool === 'NotebookEdit' ? { notebook_path: yol } : { file_path: yol },
});

test('K1: iki farklı oturum aynı dosya → varsayılan ENGEL (exit 2); --uyari → additionalContext JSON + exit 0', () => {
  const d = initRepo();
  try {
    write(d, 'a.txt', 'x');
    assert.equal(hook(d, pre(d, 'S-A', 'a.txt')).stdout, '');
    const s = hook(d, pre(d, 'S-B', 'a.txt'));
    assert.equal(s.status, 2);
    assert.match(s.stderr, /DOSYA SAHİPLİĞİ: a.txt .*ŞU AN ÇALIŞIYOR/);
    assert.equal(s.stdout, '');
    assert.equal(hook(d, pre(d, 'S-B', 'a.txt'), '--strict').status, 2); // geriye-uyum: --strict no-op
    const r = hook(d, pre(d, 'S-B', 'a.txt'), '--uyari');
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.equal(j.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.match(j.hookSpecificOutput.additionalContext, /DOSYA SAHİPLİĞİ/);
  } finally { cleanup(d); }
});

test('K1b: Stop (tur sonu) ana ajanın kayıtlarını bırakır, alt ajanınkine dokunmaz; sonra diğer oturum yazabilir', () => {
  const d = initRepo();
  try {
    hook(d, pre(d, 'S-A', 'a.txt'));
    hook(d, pre(d, 'S-A', 'b.txt', 'agent-1'));
    assert.equal(hook(d, pre(d, 'S-B', 'a.txt')).status, 2);
    const stop = hook(d, { hook_event_name: 'Stop', session_id: 'S-A', cwd: d, background_tasks: [] });
    assert.equal(stop.status, 0); // Stop'ta non-zero turu sürdürür → HER ZAMAN 0
    assert.deepEqual(liste({ cwd: d }).map(k => k.yol), ['b.txt']);
    assert.equal(hook(d, pre(d, 'S-B', 'a.txt')).status, 0);
  } finally { cleanup(d); }
});

test('K2: aynı oturum farklı alt ajan çakışır; ana ajan alt ajanın dosyasında geçer', () => {
  const d = initRepo();
  try {
    hook(d, pre(d, 'S-A', 'b.txt', 'agent-1'));
    const iki = hook(d, pre(d, 'S-A', 'b.txt', 'agent-2'));
    assert.equal(iki.status, 2);
    const ana = hook(d, pre(d, 'S-A', 'b.txt'));
    assert.equal(ana.status, 0);
    assert.equal(ana.stdout, ''); // oturum-içi yazım sessiz (delegasyon olağan)
  } finally { cleanup(d); }
});

test('K3: SubagentStop yalnız o ajanın, SessionEnd oturumun tüm kaydını siler', () => {
  const d = initRepo();
  try {
    hook(d, pre(d, 'S-A', 'c1.txt', 'agent-1'));
    hook(d, pre(d, 'S-A', 'c2.txt', 'agent-2'));
    hook(d, pre(d, 'S-A', 'c3.txt'));
    assert.equal(liste({ cwd: d }).length, 3);
    hook(d, { hook_event_name: 'SubagentStop', session_id: 'S-A', agent_id: 'agent-1', cwd: d });
    assert.deepEqual(liste({ cwd: d }).map(k => k.yol).sort(), ['c2.txt', 'c3.txt']);
    hook(d, { hook_event_name: 'SubagentStop', session_id: 'S-A', cwd: d }); // agent_id yok → no-op
    assert.equal(liste({ cwd: d }).length, 2);
    hook(d, { hook_event_name: 'SessionEnd', session_id: 'S-A', reason: 'other', cwd: d });
    assert.equal(liste({ cwd: d }).length, 0);
  } finally { cleanup(d); }
});

test('K4: NotebookEdit notebook_path kullanır; ilgisiz araç/olay no-op', () => {
  const d = initRepo();
  try {
    hook(d, pre(d, 'S-A', 'n.ipynb', null, 'NotebookEdit'));
    assert.equal(hook(d, pre(d, 'S-B', 'n.ipynb', null, 'NotebookEdit'), ).status, 2);
    assert.equal(hook(d, pre(d, 'S-B', 'x.txt', null, 'Read')).stdout, '');
    assert.equal(liste({ cwd: d }).length, 1);
  } finally { cleanup(d); }
});

test('K6: stdin yok / bozuk JSON / repo dışı yol → exit 0, çıktı JSON değil', () => {
  const d = initRepo();
  const dis = tmp();
  try {
    for (const girdi of ['', 'düz metin', JSON.stringify(pre(d, 'S-A', join(dis, 'z.txt')))]) {
      const r = hook(d, girdi, '--strict');
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stdout, '');
    }
    assert.equal(liste({ cwd: d }).length, 0);
  } finally { cleanup(d); cleanup(dis); }
});

test('argümansız koşu: stdin tek okunur, delege-kotasi tüketmez → dosya-sahipligi çakışmayı yine engeller', () => {
  const d = initRepo();
  try {
    hook(d, pre(d, 'S-A', 'a.txt'));
    const r = spawnSync(process.execPath, [GATE], { cwd: d, encoding: 'utf8', input: JSON.stringify(pre(d, 'S-B', 'a.txt')) });
    assert.match((r.stdout || '') + (r.stderr || ''), /DOSYA SAHİPLİĞİ/);
  } finally { cleanup(d); }
});
