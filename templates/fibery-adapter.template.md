<!--
ÜRETİM TALİMATI (v0.9 — DEAK tracker adaptörü): Bu, Fibery (ya da Jira/Notion) entegrasyon
KONFİGÜRASYON iskeletidir. Kurulum ajanı YALNIZ ortamda ilgili MCP bağlıysa VE kullanıcı toggle'ı
AÇTIYSA üretir (kullanmayan ödemez). Hedef konum: docs/integrations/tracker.md.
Üç toggle BAĞIMSIZ: biri açık öteki kapalı olabilir. Kapalı bölümü SİL (yorum bırakma).
İLKE: skill HAZIRLAR, BARINDIRMAZ (K8) — bu dosya adaptör KONFİGÜdür, çalışan servis değil.
Detay/gerekçe: reference/external-integrations.md §2.
-->

# Takip Aracı Entegrasyonu (DEAK — Fibery adaptörü)

**Araç:** {{TRACKER_ADI}}  ·  **Bağlantı:** {{MCP_ADI}} (MCP)  ·  **Çalışma alanı:** {{SPACE_ADI}}

> Açık toggle'lar: {{ACIK_TOGGLELAR}}. Kapalı toggle = bu repoda kurulmadı (no-op).

<!-- ===== [toggle: niyet] — OKUMA (en güvenli) ===== -->
## Niyet kaynağı (okuma)

Bir kod/doküman değişikliğinin "NEDEN"i {{TRACKER_ADI}} ticket'ından okunur. Bağ:
- **Ticket alanı:** {{NIYET_ALANI}} (örn. Description / yorum)
- **Bağ mekanizması:** doc-anchor yanına ticket-kimliği — örn. `<!-- intent: {{TICKET_ID_DESENI}} -->`
- **Kullanım:** Faz 2 son-kullanıcı dokümanı üretirken "ne yapıldı"yı koddan, "neden/nasıl"ı buradan al.
- **Çelişki kuralı (K7):** kod ile ticket çelişirse doküman "doğrulanamadı" etiketi alır — uydurma YOK.

<!-- ===== [toggle: rapor] — YAZMA-rapor ===== -->
## Kapı/drift raporu (yazma)

Kapı sonuçları {{TRACKER_ADI}}'ye özet olarak raporlanır:
- **Hedef:** {{RAPOR_HEDEFI}} (örn. ticket yorumu / ayrı "CI sağlık" veritabanı)
- **Tetik:** {{RAPOR_TETIGI}} (örn. doc-recency tripwire, bahçıvan turu bulgusu, kabul durumu değişimi)
- **GİZLİLİK (zorunlu):** rapor ham secret TAŞIMAZ. `check-hygiene --rule=secrets` maskelemesi raporlamadan ÖNCE uygulanır;
  yalnız sayısal/yol-düzeyi özet gider (`N ölü referans`, `M tripwire`). Ham diff/değer GÖNDERME.

<!-- ===== [toggle: senkron] — İKİ-YÖN (DİKKAT: doctrine kısıtı) ===== -->
## Senkron (markdown kanonik → tracker ayna)

> ⚠ Kör iki-yönlü senkron YASAK (denormalizasyon→drift — reference/doctrine.md). İzin verilen tek desen:
- **Kanonik kaynak:** repo-içi versiyonlu markdown ({{KANONIK_YOL}}). Tracker yalnız AYNA.
- **Yön:** TEK-YÖN (repo → {{TRACKER_ADI}}). Tracker'da elle yapılan değişiklik kanonik sayılmaz.
- **Uzlaştırma kapısı:** "üretilen ayna == kaynak markdown" assert'i (sapma FAIL). [v0.9: TASARIM — pilot-bağlı,
  KODLANMADI.] Toggle açıksa tek-yön ayna kur, uzlaştırmayı ELLE denetle ve STATE'e "senkron kapısı tasarım" yaz.

---
**STATE notu (zorunlu):** kurulan toggle'lar + KODLANMAYAN tasarım parçaları (senkron kapısı, platform-üreteci)
açıkça STATE.md'ye yazılır — "kuruldu" diye satılmaz (DEAK dürüstlük sınırı).
