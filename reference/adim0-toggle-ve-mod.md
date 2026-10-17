# ADIM 0 — Toggle eksenleri ve kurulum modu tespiti

> SKILL.md ADIM 0 ağır detayı buraya taşındı (SKILL.md tavanı ~300 satır; ağır içerik
> `reference/`e). SKILL.md kısa işaretçi ile buraya bakar.
> Üç DİK eksen: boyut (küçük/orta/büyük) · muhatap (kim için) · dış entegrasyon (ortamda ne BAĞLI).
> Ortak ilke: **kullanmayan ödemez** — kapalı toggle o katmanın TEK satırını bile kurmaz.

## 1) Muhatap toggle'ları

**MUHATAP TOGGLE'LARI (v0.5 — boyuttan DİK/bağımsız eksen; "kullanmayan ödemez"):**
boyut "ne kadar tören" sorusu; muhatap "kimler için" sorusu. İkisini ayrı sor:
- **PM/ürün ekibi var mı?** → evetse `reference/multi-team.md`'den PRODUCT_LOG.md (append-only)
  + pm-sorgu (salt-okunur rol) + ürün-karar eskalasyon kademesi yüklenir.
- **Kullanıcı-görünür UI + senaryo yazan biri var mı?** → evetse senaryo-JSON şablonu +
  co-update kapısı (FAZ 2) açılır.
- **Müşteriye doküman/chatbot sunan biri var mı?** → evetse `reference/multi-team.md` §4 yüklenir
  (son-kullanıcı dokümanı: docs/user/ + öner-onayla + üç kapsam-ekseni; Faz 2 önceliği).
- **Ayrı bir test/QA ekosistemi + test-case sistemi (Fibery/Jira/TestRail) var mı?** → evetse
  **test-köprüsü** açılır: `[T]` → `test-brief.yaml` (`templates/test-brief.template.yaml`) → öner-onayla
  → dış test-sistemine outbox. Tarif + kanonik kurallar `reference/faz2-dokuman-katmani.md §8`'de
  (4 dış-model sentezi: kapı+akış karışımı · fail-closed UNKNOWN · semantik-drift çapraz-kontrolü ·
  önce-üret-geç-yayınla). Kapalıysa TEK satır kurulmaz — [T] katmanı test-sistemi olmadan da çalışır.
- **Aynı kod farklı müşterilerde farklı mı davranıyor (paket/lisans/firma ayarı)?** → evetse
  **konfig ekseni** (v0.20) açılır: `reference/multi-team.md` §4.6 + kanonik sözlük
  (`templates/feature-dictionary.template.md`) + `[L0]` `availability`/`config_flags` şeması +
  `check-provenance --rule=config-flags`. Doküman katmanı "kullanıcı ne yapabilir"i cevaplar,
  bu eksen "**bu kullanıcı yapabilir Mİ**"yi. Hayırsa TEK satır kurulmaz (sözlük yoksa kapı no-op).
- **Aynı sözleşmeyi (özellik/ayar adları) ≥2 repo mu taşıyor?** → evetse `reference/multi-team.md`
  §4a: kanonik kaynak = kapıyı FİİLEN uygulayan repo · kapı orada yaşar, KOPYALANMAZ · denetlenen
  doküman ATFIDIR, kod adlandırması değil (aksi = türev reponun kodunu ihlal sayan kalıcı sahte alarm).
- **FRICTION_LOG (sürtünme günlüğü)** muhataptan bağımsız, daima kurulur (append-only) —
  sistemin kendi kurallarının yarattığı sorunu yakalar. Triyaj disiplini artık MEKANİK:
  `check-history --rule=friction-repeat` (yeni girdi `Mekanizma-adayı:` taşır + eşiği aşmış
  AÇIK tekrarlar NOT'lanır — v0.20; ders kaydedilip OKUNMAMASININ panzehiri).

### 1a) ZORUNLU soru turu (v0.30) — boyutla AYNI turda, cevap künyeye

Boyut sorusunu tek başına sorma. TEK `AskUserQuestion` çağrısında (çoklu soru) şunlar birlikte sorulur:
muhatap → `toggles.muhatap.pm_urun` · `qa_senaryo` · `son_kullanici_dokumani` · `test_koprusu`;
takip katmanı → `toggles.takip.state` (STATE.md canlı board; varsayılan kapalı) · `toggles.takip.yan_bug`
(docs/SIDE-BUGS-LOG.md; varsayılan kapalı). Cevaplar künyeye (`.agentic-repo-setup.json`) true/false yazılır.
- **Sorulmadan false yazmak YASAK.** Şablon bu alanları `null` taşır: null = SORULMADI (≠ hayır).
  `install-exam` ⑧ null/eksik alanda FAIL verir (v0.30+ künyeler; eski künyeler UYGULANAMAZ).
- Saha kanıtı: v0.23-v0.24 kurulumlarında (saha-F, 2026-09-03) yalnız boyut soruldu, muhatap hiç
  sorulmadı, künyeye şablonun sabit false'u yazıldı — sessiz atlama.
- `son_kullanici_dokumani=true` → kurulumda pre-commit hook'una VE CI'a doc-recency `--cascade` bağlanır
  (`reference/faz2-dokuman-katmani.md` §9).
- `takip.state=false` → STATE.md kurulmaz; rol/şablon STATE'e yazma adımları "STATE varsa" koşulludur.
  `takip.yan_bug=false` → SIDE-BUGS-LOG kurulmaz; yan-bug çıkış raporunda bildirilir.

Muhatap toggle'ı KAPALIYSA o katmanın TEK satırı bile kurulmaz — çekirdek dosyalar
(SKILL/CLAUDE) çok-ekip içeriğiyle ŞİŞMEZ. Ağır içerik reference/multi-team.md'de kalır.

## 2) Dış entegrasyon toggle'ı (DEAK)

**DIŞ ENTEGRASYON TOGGLE'I (v0.9 — DEAK, ÜÇÜNCÜ dik eksen; sorma, ÖNCE BAK):** dış sistem adımları
(CI platformu, iş-takip aracı) çekirdeğe gömülü değil, kurulum-zamanı kalibre edilen adaptördür.
- **CI platformu:** `.github/workflows/` mı, `azure-pipelines.yml` mi, `.gitlab-ci.yml` mi var (yoksa "CI yok")?
  GitHub Actions ise `templates/ci-workflow.template.yml`'den repo-özgü workflow ÜRET; Azure/GitLab ise
  verify reçetesini ELLE dök + STATE'e "platform-üreteci tasarım" yaz (üreteç henüz GHA-only).
- **İş-takip aracı (Fibery/Jira/Notion):** yalnız ortamda ilgili MCP BAĞLIYSA sor (bağlı değilse toggle
  ölü sorudur, sorma). Açıksa 3 bağımsız alt-toggle: niyet (okuma) · rapor (yazma, secret-maskeli) ·
  senkron (markdown KANONİK, tek-yön ayna; uzlaştırma kapısı tasarım/pilot-bağlı).
- **AST-indeks aracı (codebase-memory-mcp/`cmm`):** kapıların symbol doğrulamasını (ham `.includes` →
  yapısal graf) besler. Üç-kapılı BAK, üçü de gerekli yoksa ölü toggle: env `ARS_AST_ADAPTER` set mi ·
  `cmm` CLI PATH'te mi · graf DB diskte mi. Açıksa symbol-ikinci-görüş (KOD, fail-open, `!found` iken soft[]
  ipucu — verdict DEĞİŞMEZ) kurulur; impact-adayı + index==kaynak TASARIM/pilot-bağlı. Kapı **CLI** çağırır,
  MCP'ye bağlanmaz (K8: sürekli-server yok, graf bir kez ürettirilir, git-watcher KOŞMAZ).
Ayrıntı + dürüstlük sınırı (ne KOD, ne TASARIM): `reference/external-integrations.md`. Toggle kapalı = no-op.

## 3) Kurulum modu tespiti (yeşil alan / çürümüş / olgun-iyi → augment)

**KURULUM MODU TESPİTİ (ADIM 0'da ÖN-sınıfla, FAZ 1 madde 7 + doc-truth ölçümüyle NİHAİ karar):**
Burada (ADIM 0) bir ÖN-sınıflandırma yap; KESİN karar FAZ 1 madde 7 (mevcut rehber dosyalar denetimi)
sonrasında verilir — çünkü "rehber gerçeğe uyuyor mu" ancak orada ölçülür.
**Yeşil alan** (rehber/kapı yok) → tam kurulum. **Çürümüş** (rehber gerçeğe aykırı) →
yeniden üret. **OLGUN-İYİ** → **augment modu.** v0.5 eşiği SOMUT (artık saf yargı değil):
*rehber + (log VEYA memory sistemi) + ≥1 çalışan kapı var VE FAZ 1 madde 7'de check-doc-integrity --rule=doc-truth
bu repoda TEMİZ geçiyorsa* → augment. **doc-truth'u nasıl koşarsın (kapı daha kurulmadan):** repoda
zaten bir doc-truth kapısı varsa onu; yoksa skill paketindeki `gates/check-doc-integrity.mjs --rule=doc-truth`'ı hedef repo
köküne karşı koş (kurulum-öncesi ölçüm; kalıcı kurulum FAZ 2'de). (doc-truth kırmızıysa rehber çürümüş
demektir → yeniden üret.) Augment'ta var olan iyi dosya yeniden üretilmez — yanlış iddialar cerrahi
düzeltilir, eksik kapı/bölüm eklenir; mevcut adlar/konvansiyonlar kanonik kalır.
