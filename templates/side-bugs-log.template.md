# SIDE-BUGS-LOG — iş sırasında görülen ama kapsam-dışı bırakılan kusurlar

> **Append-only defter.** İş sırasında bir ajan/yazılımcı planın dışında bir kusur görürse ama
> "bunu da bundle'da çözelim mi?" sorusuna HAYIR alırsa (ya da düşük güven / farklı modül olduğu
> için hiç sormadıysa), kusur BURAYA yazılır — kaçmasın ama mevcut işin kapsamını da şişirmesin.
>
> **Kural (4 dış-model sentezi 2026-07-21):** loglanan bug bu PR'da DÜZELTİLMEZ (scope kilidi).
> Her kayıt AYRI bir kimliktir; gerçek bir iş olacaksa ayrı ticket/issue açılır. Bu defter bir
> "unutma önleyici"dir, bir backlog değil — düzeltme kararı ayrı bir akıştır.
>
> Bu dosya `check-history --rule=append-only` ile korunur (satır silme/değiştirme yakalanır). Kurulumda
> `APPEND_ONLY_EXTRA=docs/SIDE-BUGS-LOG.md` ile kapıya tanıt (ya da kanonik listeye ekli sürümü kullan).

## Kayıtlar

<!-- Her satır bir aday yan-bug. Format:
| tarih | dosya:satır | semptom (ne gördün) | kanıt | güven | neden bundle'a alınmadı | feature_id (varsa) |
-->

| Tarih | Konum | Semptom | Kanıt | Güven | Neden bundle-dışı | feature_id |
|-------|-------|---------|-------|-------|-------------------|------------|
<!-- örn: | 2026-07-21 | src/x/y.ts:42 | boş listede 500 döner | repro log | orta | farklı modül, ayrı iş | — | -->
