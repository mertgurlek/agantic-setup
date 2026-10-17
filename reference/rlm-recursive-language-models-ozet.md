# Recursive Language Models (RLM) — Araştırma Özeti

> Harici araştırma notu (agentic-repo-setup paketinin parçası DEĞİL — referans).
> Kaynak: github.com/alexzhang13/rlm · klonlanıp kod+doküman okunarak analiz edildi · 2026-06-16.
> Yazarlar: Alex L. Zhang, Tim Kraska, Omar Khattab (MIT OASYS lab).
> Blog (Eki '25): alexzhang13.github.io/blog/2025/rlm · arXiv (Ara '25): 2512.24601
> (arXiv ID 24601 = Les Misérables mahkûm no'su; muhtemelen bilinçli şaka ama sayfa gerçek makaleye çözülüyor, 3 sürüm Ara'25–May'26).

## 1. Tek cümlede

RLM = `llm.completion(prompt)` çağrısını `rlm.completion(prompt)` ile değiştiren, **görev-agnostik bir çıkarım (inference) paradigması**: kök LM, devasa context'i kendi penceresine doldurmak yerine bir **Python REPL'de değişken** olarak tutar; context'i programatik olarak inceler, parçalar ve kendisini/alt-LM'leri **özyinelemeli** çağırır. Sistemin kendisi yine bir "language model"dir (metinden metne olasılıksal eşleme) — adı buradan gelir.

## 2. Çözdüğü problem

- **Context rot:** context uzadıkça modelin o context'ten doğru bilgi geri-çağırma yeteneği düşer. RLM kök modeli uzun metne hiç "boğmaz".
- **Sınırsız girdi/çıktı uzunluğu:** taban modelin mimarisini değiştirmeden context-penceresinden ~100× büyük girdileri işler (bildirilen).

## 3. Çekirdek mekanizma (mühendislik)

- Kök LM **başta yalnız sorguyu** görür; context REPL'de `context` değişkenidir. Model, ```repl``` blokları yazarak context'i grep'ler/chunk'lar, alt-LM çağırır, sonucu buffer'da biriktirir, sonunda `answer["ready"]=True` ile bitirir.
- İki çağrı tipi: **`llm_query`** = tek-atış düz LM çağrısı (özet/çıkarım); **`rlm_query`** = kendi REPL'i olan **özyinelemeli çocuk RLM** (çok-adımlı alt-problem). `max_depth`'e ulaşınca `rlm_query` sessizce `llm_query`'ye düşer. Batched (paralel) varyantları var.
- **Tasarım iddiası:** CodeAct tarzı (her LM'in bir kod ortamı olsun), alt-ajan ve araç çağrıları **kod içinde fonksiyon** olsun → JSON tool-calling standardından kaçış. Kod, ifade gücü en yüksek ve eğitilebilir aksiyon-uzayıdır.

## 4. Mimari (3 parça — koddan doğrulandı)

| Parça | İş |
|-------|----|
| `RLM` (core/rlm.py) | ana iterasyon döngüsü; her `completion()` kendi context'ini doğurur ve temizler |
| `LMHandler` (core/lm_handler.py) | **per-completion TCP soket sunucusu** (127.0.0.1, oto-port); REPL içindeki kod, host'a LM çağrısı yapabilsin diye. İzole sandbox'lar (Docker/Modal) bununla konuşur; local de tutarlılık için aynı protokolü kullanır |
| `LocalREPL` (environments/local_repl.py) | **aynı process'te `exec()`** — subprocess yok; namespace turlar arası kalıcı; her exec sonrası scaffold (`llm_query` vb.) geri-yüklenir |

- **Depth/bütçe:** çocuk RLM **kalan** budget/timeout/token alır (toplamı değil) → çocuk ebeveynin kaynağını sömüremez. Her çocuk kendi handler+REPL'ine sahip, izole namespace.
- **Sandbox gerçeği (dürüst sınır):** default `local` ortam, model-üretilmiş kodu **host process'te exec eder**; tehlikeli builtin'ler (`eval/exec/input`) çıkarılır ama bu **yumuşak** koruma, güvenlik sınırı DEĞİL. Güvenli kullanım için bulut sandbox'lar (Modal/Prime/Docker/e2b/daytona) sunulur.

## 5. Ampirik bulgular (bildirilen — blog/paper; kendi reponda tekrarı garanti değil)

- **OOLONG @132k token:** `RLM(GPT-5-mini)`, `GPT-5`'i **~34 puan** geçti (~%114 daha çok doğru, ">2×"), **sorgu başına neredeyse GPT-5 kadar ucuz**.
- **OOLONG @263k token:** `RLM(GPT-5-mini)`, GPT-5'in **15+ puan** üstünde (~%49 artış). Büyük ölçekte "sayma" problemlerinde düşüş gözlendi.
- **BrowseComp-Plus @1000 doküman:** `RLM(GPT-5)` ~**mükemmel** performans; GPT-5 varyantları belirgin düşüş gösterdi. **Özyineleme ablation'ı** (recursion kapalı) bu ölçekte ~%90'a indi → özyineleme katkısı ölçüldü.
- **Ölçek:** **10M+ token** context, performans düşüşü olmadan işlendi (bildirilen).
- **Eğitim:** post-train edilmiş **8B** RLM varyantı, taban 8B'yi **%28.3** geçti. Maliyet mevcut yöntemlerle karşılaştırılabilir.
- **Dikkat (nüans):** manşet sonuçların çoğu **depth-1** (kök orkestratör + düz alt-LM çağrıları), derin özyineleme değil. Derin recursion (depth>1) opt-in ve daha az test edilmiş.

## 6. Dürüst sınırlar (yazarların kendi beyanı)

- **Gecikme:** her özyineleme çağrısı **bloklayıcı**, asenkronluk eksik → sorgular saniyelerden **birkaç dakikaya** kadar sürebilir.
- **Maliyet/runtime garantisi yok:** toplam API maliyeti ya da süre üzerinde güçlü kontrol yok (budget/timeout var ama "en iyi kısmi cevabı döndür" mantığıyla).
- **Soft sandbox:** yukarıdaki güvenlik notu.

## 7. Bizim agentic-repo-setup işiyle rezonans (neden ilgili)

Bağımsız bir kaynaktan gelen, doktrinimizle örtüşen kanıt + bir uyarı:

- **"Orchestrator, not solver" + "kendi context pencereni küçük tut, uzun-context işini alt-LM'e it"** = bizim **E-katman / token ekonomisi** doktrinimizin (E1 lazy LLM, kök bağlamı yalın tut) bağımsız bir kanıtı. K5/token-optimizör tohumunun 4. bağımsız teyidi sayılır — ama "aynı havuzdan içmek" filtresini unutma.
- **Cheap sub-model'e delegasyon** (`other_backends`, depth-bazlı routing → ucuz alt-model) = bizim **model-tiering** (`model:` satırı) mantığının runtime-tarafı muadili. Fark: RLM bir *runtime orkestratör*; biz *kurulum süreciyiz* — onların gateway'i bizim kapsamımızda yok (kategori farkını koru).
- **Kalan-bütçe propagasyonu** (çocuk toplamı değil kalanı alır) = bizim **sahiplik kilidi / dalga bütçesi** disiplininin aynısı.
- **Uyarı (secret/güvenlik doktrinimiz):** RLM'in default'u model-üretilmiş kodu in-process exec eder. "Mekanizması olmayan kural gürültüdür"ün güvenlik hali: untrusted context + local exec = sandbox şart. Bizim L5 (commit→deploy arası kapı, düz-metin secret yok) çizgimizle aynı refleks.
- **CodeAct vs JSON tool-calling:** RLM "JSON araç-çağrısından kaçın, kodu aksiyon yap" diyor. Bizim kapılar zaten kod (Node script); felsefe uyumlu ama bizim bağlamda doğrudan aksiyon kalemi değil — not düş, taşıma.

**Tek cümlelik alınacak ders:** RLM, "uzun bağlamı modele yutturma; onu dışsal bir ortam yap ve ucuz alt-çağrılarla programatik gez" tezini sayılarla destekliyor — bu bizim token-ekonomisi katmanımızın dışarıdan 4. bağımsız doğrulaması, ama hâlâ "mekanizma kim, ihtiyaç kanıtı ne" filtresinden geçmeli.
