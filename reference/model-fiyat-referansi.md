# Model Fiyat/Performans Referansı — sürümlenmiş anlık görüntü (v0.17.2)

> Rubrik ve tier→model eşlemesi `reference/model-effort-tiering.md`'de yaşar. Bu dosyada yalnız
> FİYAT anlık görüntüsü ve tazeleme ritüeli yaşar — ikisi ayrı eksendir.
>
> 🔴 **Bu bir ANLIK GÖRÜNTÜDÜR, canlı veri DEĞİLDİR.** Ölçüm tarihi aşağıda. Bayatlar.
> Tazeleme YOLU: aşağıdaki "Tazeleme" bölümü — MANUEL, insan onaylı.

## Neden statik (otomatik değil) — bilinçli ret, K30

Kullanıcı önerisi (2026-08-06): "fiyat verisini haftalık web'den çek, ajan rol dosyalarını
kendi kendine güncellesin, kapıya bağla." Bu **REDDEDİLDİ**. Gerekçeler (dış-göz denetimi:
GLM 5.2, OpenRouter üzerinden + doktrin çaprazlaması):

1. **Ağ bağımlı kapı deterministik değildir.** Site yapısı değişir / rate-limit / 503 → kapı ya
   hepsini geçirir ya hepsini bloklar. "Yanlış-alarm kapıyı öldürür" yasası doğrudan ateşlenir.
   Ölçüm: bu repoda ağ çağrısı yapan kapı YOKTUR (emsalsiz olurdu).
2. **Kimlik sınırı.** Haftalık cron kurmak runtime-motoru davranışıdır; bu paket tek-oturumluk
   KURULUM sürecidir (SKILL.md giriş bloğu). Hedef repoya zamanlı iş kurulabilir, ama "skill
   bunu yapıyor" diye konumlandırılamaz.
3. **Bulanık invariant E0'a inmez.** Fiyat SAYISI keskindir; ama "hangi model hangi işe uygun"
   BULANIKTIR (görev karmaşıklığı/bütçe/gecikme bağımlı). Otomatik kapı ikisini birden yapmaya
   çalışır → bulanığı E0'a indirme girişimi → doktrin yasağı.
4. **Self-modifying config üç risk taşır:** sessiz sürüklenme (kötü bir çekim tüm rolleri yanlış
   modele çevirir, kimse bakmaz) · tekrar-üretilemezlik (iki hafta arayla aynı görev farklı
   modelle koşar, sonuçlar karşılaştırılamaz) · özyinelemeli kırılma (paket kendi frontmatter'ını
   değiştirirse sonraki kurulum farklı davranır).

**Kurtarılan çekirdek:** ihtiyaç gerçektir (fiyat bayatlar), mekanizma değişti — statik tablo +
sürümleme + manuel tazeleme + insan onayı (E3). Emsal: `scripts/token-audit.mjs` cost-ledger'ı
telemetriden türetir, ajan self-report'undan ASLA.

## Tier eşlemesi — kanonik yer değişti

🔴 Tier↔model↔effort eşlemesi (hangi iş hangi tier'a düşer, `high` mı `xhigh` mı) burada
DUPLIKE TUTULMAZ — tek kaynak `reference/model-effort-tiering.md`. Bu dosya orada YAŞAMAYAN tek
şeyi tutar: fiyat sabitinin bilinçle YAZILMAMASI ve tazeleme ritüeli (aşağı). Eski statik tablo
tiering'in ölçtüğü gerçek varsayılanla (hakem `xhigh`, tepe `max`) çelişip bayatladığı için
kaldırıldı.

**Fiyat sabiti bilinçle YAZILMADI.** $/1M token değerleri bu dosyada TUTULMAZ: ölçüm sabiti
gömme yasağı (v0.12) gereği bayatlayan sayı sessizce yalan söyler. Güncel fiyat gerektiğinde
tazeleme yolundan ölç.

## Dış modeller — AYRI eksen, tier DEĞİL

🔴 Rol frontmatter'ındaki `model:` **Claude Code subagent mekanizmasıdır.** Oraya OpenRouter/Codex
tarzı bir dış-model ID'si yazılamaz — bağlanmaz, sessizce yok sayılır (`thinking:` tuzağının aynısı).
Dış modeller bu pakette AYRI yoldan geçer: `[toggle: dış-model]` danışma adımı + komut çağrısı,
insan-onaylı ve son çare. Yani **dış model bir rol tier'ı değil, danışma halkasıdır.**

## Tazeleme (MANUEL — kapı değil, ritüel)

1. Claude model envanterini ölç: oturumda erişilebilir modelleri doğrula (hafızadan YAZMA).
2. Dış model fiyatı gerekiyorsa canlı listeden doğrula (global kural: model ID'leri uydurulmaz).
3. Tier eşlemesi değiştiyse: bu dosyanın "ölçüm tarihi"ni güncelle + tabloyu düzelt.
4. Rol dosyalarındaki `model:`/`effort:` satırlarını yeni eşlemeye göre gözden geçir.
5. Değişiklik bir PR/commit olur — **insan onaylar** (E3). Otomatik uygulama YOK.

Tetikleyici: sürüm bump'ı ya da "bu tier artık yanlış" gözlemi. Takvim değil, gözlem.
