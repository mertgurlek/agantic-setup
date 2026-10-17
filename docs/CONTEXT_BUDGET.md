# Context Bütçesi

> Context de bütçedir (ALTIN KURAL ③). Ajan belleği sınırsız sanılmaz: uzun keşif ham geçmiş
> olarak taşınmaz, focus summary'ye sıkıştırılır. Ama aşağıdaki taahhütler ASLA düşürülemez.

## Mod bütçeleri

İki mod (CLAUDE.md "Süreç kuralları" kanonik): **hafif** = tek dosya + davranış değişmez +
baseline'da iz yok → ≤5 dosya, keşif turu yok. **tam dalga** = kapı davranışı / CLI sözleşmesi /
SKILL.md kimliği / sürüm işi → kâşif turu + plan + hakem, ≤15 dosya + ilgili test.

## Okuma kara listesi (ASLA tam okuma)

| Dosya/desen | Neden pahalı | Bunun yerine |
|-------------|--------------|--------------|
| `public/*.zip` · `public/*.skill` | binary release bundle | `scripts/pack-skill.mjs`'i oku |
| `package-lock.json` | üretilmiş, karar taşımaz | `package.json` |
| karar defterleri (tam okuma) | append-only, sürekli büyür | ilgili tarihe/başlığa grep |

Alan sınırı (kök ↔ `pilot-proje/`/`pilot-sim/`): CLAUDE.md "Üç alan" tablosu kanonik.

## Ucuz keşif sırası

1. `git ls-files` / `ls` ile yapıyı gör (dosya açma).
2. Kapı davranışını öğrenmek için önce `tests/`teki ilgili testi oku — niyet en ucuz orada.
3. `CONTRACT.md` = kapıların CLI sözleşmesi; kapı kaynağını okumadan önce buraya bak.
4. Sonra hedefli grep, en son tam dosya açma.

## Focus summary formatı (3+ tool okumasından sonra zorunlu)

```
GERÇEKLER: <ölçülen, kanıtlı — dosya:satır veya komut çıktısı>
RİSK/BELİRSİZ: <⚠ ile işaretli varsayımlar>
SONRAKİ ADIM: <tek cümle>
ATLANAN BAĞLAM: <neye bakılmadı — sessiz boşluk bırakma>
```

## Sıkıştırılamaz taahhütler (özetlemede ASLA düşmez)

- Kullanıcının verdiği karar ve onaylar (özellikle: sürüm bump, kapsam kararı)
- Kabul kriteri / definition-of-done
- Baseline: güncel değerler CLAUDE.md "Baseline manifestosu"nda (sayı burada TEKRARLANMAZ — bayatlar)
- Secret / prod / maliyet riski taşıyan her bulgu
- Aktif sahiplik kilitleri: CLAUDE.md
- Devralınan commit'lenmemiş iş (bkz. `docs/STATE.md`) — kaybolursa başka cihazın işi gider

## Ölçüm notu

Ajanın kendi bildirdiği token sayısı KANIT DEĞİLDİR. Telemetri yoksa süre ve "context hotspot"
ölç. Skill-cards katmanı (tekrar eden prosedürlerin kartlaştırılması) bu repoda KURULMADI —
tekrar eden iş ailesi kanıtı görülünce açılacak (kullanmayan ödemez).
