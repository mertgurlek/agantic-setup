// Paylaşılan minimal-YAML/frontmatter okuyucuları — sıfır bağımlılık; tam YAML parser DEĞİL,
// girinti-tabanlı durum makinesi / hedefli regex (her okuyucu kendi şemasının düz şekline hedefli).
//
// Üç parser BİRBİRİNDEN FARKLI şemalar için özelleşmiştir (registry.yaml ağacı, test-brief.yaml
// ağacı, [T]/[L0] frontmatter'ı) — ortak bir "genel YAML parser" YAPILMAZ (o iddia mevcut hiçbir
// çağıranın ihtiyacı değil, gereksiz genelleme yeni bug yüzeyi açar). Ortak olan yalnız İKİ küçük
// yardımcı (`scalar`, `filled`) ve "satır satır, girinti-tabanlı, CRLF-toleranslı" YAKLAŞIM.

// --- ortak skaler yardımcılar (brief-provenance kaynaklı, registry-join'in ihtiyacı yok ama
//     zararsız/paylaşılabilir) ---------------------------------------------------------------
export function scalar(v) {
  // "{{...}}" placeholder'ları ve tırnakları temizle, yorum kuyruğunu at.
  return String(v).replace(/#.*$/, '').trim().replace(/^['"]|['"]$/g, '');
}
// Bir değerin "dolu ve gerçek" olup olmadığı: boş / placeholder / UNKNOWN/TBD DEĞİL.
export function filled(v) {
  if (v === undefined || v === null) return false;
  const s = scalar(v);
  if (!s) return false;
  if (/^\{\{.*\}\}$/.test(s)) return false;       // {{FEATURE_ID}} gibi doldurulmamış placeholder
  if (/^(UNKNOWN|TBD)$/i.test(s)) return false;    // fail-closed işareti
  return true;
}

// --- registry.yaml okuyucu (registry-join alt-kuralı) ------------------------------------
// Beklenen şekil:
//   features:
//     <feature-id>:
//       tech_docs:
//         - <yol>
//         - <yol>
export function parseRegistry(text) {
  const features = new Map(); // id -> Set<tech_doc path>
  let inFeatures = false;
  let currentId = null;
  let inTechDocs = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').replace(/\r$/, '');
    if (!line.trim()) continue;
    const indent = line.match(/^ */)[0].length;
    const trimmed = line.trim();
    if (/^features:\s*$/.test(trimmed) && indent === 0) { inFeatures = true; currentId = null; inTechDocs = false; continue; }
    if (!inFeatures) continue;
    const idMatch = trimmed.match(/^([\w.\-\/]+):\s*$/);
    if (indent === 2 && idMatch) { currentId = idMatch[1]; features.set(currentId, new Set()); inTechDocs = false; continue; }
    if (indent === 4 && /^tech_docs:\s*$/.test(trimmed)) { inTechDocs = true; continue; }
    if (indent >= 6 && inTechDocs && trimmed.startsWith('- ')) {
      const path = trimmed.slice(2).trim().replace(/^['"]|['"]$/g, '');
      if (currentId && path) features.get(currentId).add(path);
      continue;
    }
    if (indent <= 4 && inTechDocs && !trimmed.startsWith('- ')) inTechDocs = false;
  }
  return features;
}

// [T] dosyası frontmatter'ından feature_ids: [...] bloğunu çıkar (akış-listesi VEYA çok-satır).
// (CRLF normalize dahil.)
export function extractFeatureIds(content) {
  const norm = content.replace(/\r\n/g, '\n');
  const fmMatch = norm.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null; // frontmatter yok → [T] adayı değil
  const fm = fmMatch[1];
  const lineMatch = fm.match(/^feature_ids:[ \t]*(.*)$/m);
  if (!lineMatch) return null; // feature_ids alanı yok → [T] şablonu değil, atla
  const rest = lineMatch[1].trim();
  if (rest.startsWith('[')) {
    const inner = rest.replace(/^\[/, '').replace(/\]\s*(#.*)?$/, '');
    return inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }
  if (rest === '' || rest.startsWith('#')) {
    const lines = fm.slice(fm.indexOf(lineMatch[0]) + lineMatch[0].length).split('\n');
    const ids = [];
    for (const l of lines) {
      const m = l.match(/^\s*-\s*(.+?)\s*(#.*)?$/);
      if (m) ids.push(m[1].trim().replace(/^['"]|['"]$/g, ''));
      else if (l.trim() && !l.startsWith(' ')) break;
    }
    return ids;
  }
  return [];
}

// --- test-brief.yaml okuyucu (brief-provenance alt-kuralı) -----------------------------------
// Döndürdüğü nesne:
//   { source_commit, source:{feature_id,tech_doc}, status,
//     fibery:{module,client}, crosscheck_status,
//     steps:[{derived_from}], edges:[{derived_from}],
//     unknown_fields:[..], needs_review:[..] }
export function parseBrief(text) {
  const norm = text.replace(/\r\n/g, '\n');
  const out = {
    source_commit: null,
    source: { feature_id: null, tech_doc: null },
    status: null,
    fibery: { module: null, client: null },
    crosscheck_status: null,
    steps: [],
    edges: [],
    unknown_fields: [],
    needs_review: [],
  };
  const lines = norm.split('\n');

  let block = null;        // 'source' | 'fibery' | 'crosscheck' | 'unresolved' | 'steps' | 'edges' | null
  let unresolvedKey = null; // unresolved altında 'unknown_fields' | 'needs_review'
  let curItem = null;      // aktif steps/edges kaydı
  let itemIndent = null;   // aktif öğenin "-" girinti seviyesi

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim()) continue;
    const indent = line.match(/^ */)[0].length;
    const t = line.replace(/#.*$/, '').trim();
    if (!t) continue;

    if (indent === 0) {
      block = null; unresolvedKey = null; curItem = null; itemIndent = null;
      const m = t.match(/^([\w.\-]+):\s*(.*)$/);
      if (!m) continue;
      const key = m[1], val = m[2];
      if (key === 'source_commit') out.source_commit = val;
      else if (key === 'status') out.status = scalar(val);
      else if (key === 'source') block = 'source';
      else if (key === 'fibery_fields') block = 'fibery';
      else if (key === 'assertion_crosscheck') block = 'crosscheck';
      else if (key === 'unresolved') block = 'unresolved';
      else if (key === 'steps') { block = 'steps'; }
      else if (key === 'edge_cases') block = 'edges';
      continue;
    }

    if (block === 'source') {
      const m = t.match(/^([\w.\-]+):\s*(.*)$/);
      if (m) {
        if (m[1] === 'feature_id') out.source.feature_id = m[2];
        else if (m[1] === 'tech_doc') out.source.tech_doc = m[2];
      }
      continue;
    }
    if (block === 'fibery') {
      const m = t.match(/^([\w.\-]+):\s*(.*)$/);
      if (m) {
        if (m[1] === 'module') out.fibery.module = m[2];
        else if (m[1] === 'client') out.fibery.client = m[2];
      }
      continue;
    }
    if (block === 'crosscheck') {
      const m = t.match(/^status:\s*(.*)$/);
      if (m) out.crosscheck_status = scalar(m[1]);
      continue;
    }
    if (block === 'unresolved') {
      const kmatch = t.match(/^(unknown_fields|needs_review):\s*(.*)$/);
      if (kmatch) {
        unresolvedKey = kmatch[1];
        const inline = kmatch[2].trim();
        if (inline && inline !== '[]') {
          const inner = inline.replace(/^\[/, '').replace(/\]$/, '');
          for (const it of inner.split(',').map(s => scalar(s)).filter(Boolean)) out[unresolvedKey].push(it);
          unresolvedKey = null;
        }
        continue;
      }
      const li = t.match(/^-\s*(.+)$/);
      if (li && unresolvedKey) { out[unresolvedKey].push(scalar(li[1])); continue; }
      continue;
    }
    if (block === 'steps' || block === 'edges') {
      const bucket = block === 'steps' ? out.steps : out.edges;
      const li = t.match(/^-\s*(.*)$/);
      if (li) {
        if (curItem !== null && itemIndent !== null && indent > itemIndent) {
          continue;  // öğe-içi liste maddesi (expected_results vb.) — atla, öğeyi bozma.
        }
        itemIndent = indent;
        curItem = { derived_from: null };
        bucket.push(curItem);
        const rest = li[1];
        const df = rest.match(/derived_from:\s*([^,}]+)/);
        if (df) curItem.derived_from = df[1].trim();
        continue;
      }
      const df = t.match(/^derived_from:\s*(.*)$/);
      if (df && curItem) { curItem.derived_from = df[1]; continue; }
      continue;
    }
  }
  return out;
}

// --- [T]/[L0] frontmatter okuyucuları (coverage-gate alt-kuralı) -------------------------------
export function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}

export function readTechDocs(fm) {
  const inline = fm.match(/tech_docs:\s*\[([^\]]*)\]/);
  if (inline) {
    return inline[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }
  const blockStart = fm.match(/tech_docs:\s*\r?\n((?:\s+-\s+.+\r?\n?)+)/);
  if (blockStart) {
    return blockStart[1].split('\n')
      .map(l => l.match(/^\s+-\s+(.+)\s*$/))
      .filter(Boolean)
      .map(m2 => m2[1].trim().replace(/^['"]|['"]$/g, ''));
  }
  return [];
}

export function readCoverageStatus(fm) {
  const m = fm.match(/coverage:\s*\r?\n(?:.*\r?\n)*?\s*status:\s*([^\s#]+)/);
  return m ? m[1].trim() : null;
}

// [L0].coverage.missing — inline ('missing: []' / 'missing: [a, b]') ya da blok liste.
// CRLF güvenli (saha dersi: CR kırpılmazsa dolu missing[] boş okunur).
export function readCoverageMissing(fm) {
  const cov = fm.match(/^coverage:\s*\r?\n((?:[ \t]+.*\r?\n?)*)/m);
  if (!cov) return [];
  const block = cov[1];
  const clean = (x) => x.trim().replace(/^['"]|['"]$/g, '');
  const inline = block.match(/^[ \t]+missing:[ \t]*\[([^\]]*)\]/m);
  if (inline) return inline[1].split(',').map(clean).filter(Boolean);
  const list = block.match(/^[ \t]+missing:[ \t]*\r?\n((?:[ \t]+-[ \t]+.+\r?\n?)+)/m);
  if (list) {
    return list[1].split(/\r?\n/)
      .map(l => l.match(/^[ \t]+-[ \t]+(.+?)[ \t]*$/))
      .filter(Boolean).map(m => clean(m[1])).filter(Boolean);
  }
  return [];
}

export function readVerificationStatus(fm) {
  const block = fm.match(/verification:\s*\r?\n((?:\s+.+\r?\n?)+)/);
  if (block) {
    const m = block[1].match(/status:\s*([^\s#]+)/);
    if (m) return m[1].trim();
  }
  const inline = fm.match(/^verification:\s*(.+)$/m);
  if (inline && !/^\s*$/.test(inline[1]) && !inline[1].includes('#')) {
    const parts = inline[1].split('/');
    if (parts.length > 1) return parts[1].trim();
  }
  return null;
}

export function readMockGuardedCount(fm) {
  const m = fm.match(/mock_guarded_count:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export function readRiskSinifi(fm) {
  const m = fm.match(/^risk_sinifi:\s*([^\s#]+)/m);
  return m ? m[1].trim() : null;
}

export function readKanitTipi(fm) {
  const block = fm.match(/verification:\s*\r?\n((?:\s+.+\r?\n?)+)/);
  if (!block) return null;
  const m = block[1].match(/kanit_tipi:\s*([^\s#]+)/);
  return m ? m[1].trim() : null;
}

export function countMockGuardedAnchors(fm) {
  return (fm.match(/mock_depth:\s*["']?mock-guarded["']?/g) || []).length;
}

export function hasTestAnchors(fm) {
  if (!/^test_anchors:/m.test(fm)) return false;
  if (/^test_anchors:\s*\[\s*\]\s*$/m.test(fm)) return false;
  return /^test_anchors:\s*\[.*\S.*\]/m.test(fm)
    || /^test_anchors:[ \t]*$\n(\s*#.*\n)*\s+-\s+\S/m.test(fm);
}

// --- konfig ekseni okuyucuları (v0.20, `check-provenance --rule=config-flags`) ---------------
// AYNI İLKE: tam YAML parser DEĞİL — girinti-tabanlı, CRLF-toleranslı, BU şemaya hedefli.
// Şema: availability + requires_features + config_flags{paid_feature, company_settings[]}.

function escKey(key) { return key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Bir anahtarın altındaki GİRİNTİLİ bloğu ham satırlar olarak döndürür.
// Dönüş: null (anahtar YOK) | { inline: '<satır içi değer>', body: [satırlar] }
export function readIndentedBlock(text, key) {
  const lines = String(text).split(/\r?\n/);
  const startRe = new RegExp(`^([ \\t]*)${escKey(key)}:[ \\t]*(.*)$`);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(startRe);
    if (!m) continue;
    const baseIndent = m[1].length;
    const inline = (m[2] || '').replace(/\s+#.*$/, '').trim();
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (/^[ \t]*$/.test(line)) { body.push(line); continue; }
      if (line.match(/^[ \t]*/)[0].length <= baseIndent) break;
      body.push(line);
    }
    return { inline, body };
  }
  return null;
}

// Satır-içi (`k: [a, b]`) VEYA blok (`k:\n  - a`) liste — readTechDocs'un genelleştirilmiş hali.
export function readYamlList(text, key) {
  const blk = readIndentedBlock(text, key);
  if (!blk) return [];
  const inlineList = blk.inline.match(/^\[([^\]]*)\]$/);
  if (inlineList) return inlineList[1].split(',').map(scalar).filter(Boolean);
  return blk.body
    .map(l => l.match(/^[ \t]*-[ \t]+(.+?)[ \t]*$/))
    .filter(Boolean).map(m => scalar(m[1])).filter(Boolean);
}

function parseKV(line, obj) {
  const m = String(line).match(/^[ \t]*([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/);
  if (m) obj[m[1]] = scalar(m[2]);
}

// availability: always | feature_gated | flag_gated  (doldurulmamış `<...>` şablon alanı = YOK)
export function readAvailability(fm) {
  const m = fm.match(/^[ \t]*availability:[ \t]*([^\s#]+)/m);
  if (!m) return null;
  const v = scalar(m[1]);
  return (!v || /^<.*>$/.test(v) || /^\{\{.*\}\}$/.test(v)) ? null : v;
}

// config_flags bloğu. ÜÇ AYRI durum vardır, karıştırılırsa yanlış-pozitif üretir:
//   declared — `config_flags:` anahtarı VAR mı
//   answered — soru CEVAPLANMIŞ mı (`paid_feature` anahtarı var, değeri `null` OLSA BİLE)
//   gated    — gerçekten bir KOŞUL var mı (paid_feature gerçek bir ad VEYA company_settings dolu)
// 🔴 `paid_feature: null` = "ÖLÇTÜM, koşul YOK" → answered=true, gated=false. Bunu `gated` saymak
//    `availability: always` ile çelişki üretirdi — meşru bir hâli bloke eden yanlış-pozitif.
export function parseConfigFlags(fm) {
  const bos = { declared: false, answered: false, gated: false, paidFeature: undefined, settings: [] };
  const blk = readIndentedBlock(fm, 'config_flags');
  if (!blk) return bos;
  if (/^\{\s*\}$/.test(blk.inline)) return { ...bos, declared: true };

  const body = blk.body.join('\n');
  const pf = body.match(/^[ \t]*paid_feature:[ \t]*(.*)$/m);
  const paidFeature = pf ? scalar(pf[1]) : undefined;

  const settings = [];
  const csBlk = readIndentedBlock(body, 'company_settings');
  if (csBlk) {
    let cur = null;
    for (const line of csBlk.body) {
      const start = line.match(/^[ \t]*-[ \t]+(.*)$/);
      if (start) { if (cur) settings.push(cur); cur = {}; parseKV(start[1], cur); continue; }
      if (cur) parseKV(line, cur);
    }
    if (cur) settings.push(cur);
  }
  const gercekAd = paidFeature !== undefined && paidFeature !== '' && paidFeature !== 'null' && paidFeature !== '~';
  return {
    declared: true,
    answered: paidFeature !== undefined || settings.length > 0,
    gated: gercekAd || settings.length > 0,
    paidFeature, settings,
  };
}

// [T] frontmatter'ındaki `flags:` bloğu (v0.20.1 — konfig ekseninin BESLEYEN katman tarafı).
// Dönüş: { declared, empty, entries[] }. `declared` = anahtar var mı; `empty` = `[]` yazılmış.
// 🔴 [T]'de "ölçüldü ama koşul yok" ile "hiç bakılmadı" ayrımı BURADA YAPILMAZ — [L0]↔[T]
//    çapraz kontrolüyle çözülür (boş `flags` + [L0]'da gerçek koşul = ÇELİŞKİ). Gerekçe:
//    [T]'ye ayrı bir "ölçüldü" bayrağı koymak her [T]'ye tören eklerdi; çelişki sinyali bedava.
export function parseTechFlags(fm) {
  const bos = { declared: false, empty: true, entries: [] };
  const blk = readIndentedBlock(fm, 'flags');
  if (!blk) return bos;
  if (/^\[\s*\]$/.test(blk.inline)) return { ...bos, declared: true };

  const entries = [];
  let cur = null;
  for (const line of blk.body) {
    const start = line.match(/^[ \t]*-[ \t]+(.*)$/);
    if (start) { if (cur) entries.push(cur); cur = {}; parseKV(start[1], cur); continue; }
    if (cur) parseKV(line, cur);
  }
  if (cur) entries.push(cur);
  return { declared: true, empty: entries.length === 0, entries };
}

// Kanonik sözlüğün ```yaml bloğu: canonical_source + consumers[] + features[].name
export function parseFeatureDictionary(text) {
  const fence = String(text).match(/```ya?ml\r?\n([\s\S]*?)```/);
  if (!fence) return null;
  const y = fence[1];
  const src = y.match(/^[ \t]*canonical_source:[ \t]*(.*)$/m);
  const featBlk = readIndentedBlock(y, 'features');
  const features = [];
  if (featBlk) {
    let cur = null;
    for (const line of featBlk.body) {
      const start = line.match(/^[ \t]*-[ \t]+(.*)$/);
      if (start) { if (cur) features.push(cur); cur = {}; parseKV(start[1], cur); continue; }
      if (cur) parseKV(line, cur);
    }
    if (cur) features.push(cur);
  }
  return {
    canonicalSource: src ? scalar(src[1]) : null,
    consumers: readYamlList(y, 'consumers'),
    features: features.filter(f => f.name),
  };
}
