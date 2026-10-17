<!--
ÜRETİM TALİMATI (bu blok kopyalanmaz):
- Ne zaman kurulur: docs/flows.md'den (veya docs/flows/) SONRA, aynı FAZ 3 adımında.
- Bu envanter AKIŞTAN TÜRETİLİR — akışta geçmeyen ekranı buraya ekleme (ölü envanter riski).
- Nereye yazılır: docs/screens.md (tek dosya, tablo formatı — çoğu repoda yeterli büyüklük).
- Pixel-perfect mockup ZORUNLU DEĞİL. Kolon listesi ajan için yeterli yapısal bilgi taşır:
  ekran hangi akışta geçiyor, hangi DESIGN.md bileşenlerini kullanıyor, nereye gidiyor.
- `ui_exits` (templates/T-teknik-dokuman.template.md, profile: ui) bu envanterle ÇAKIŞMAZ:
  o TEK bir [T]'nin navigasyon hedefini kod-anchor'la doğrular (404 yakalar); bu tablo repo-geneli
  bir ENVANTERDİR, kod-anchor taşımaz. İkisi birbirinin yerine geçmez.
- {{...}} alanları kullanıcıyla/mevcut kod taramasıyla doldurulur.
-->
# Ekran envanteri — {{REPO_ADI}}

**Kaynak akış dosyası:** docs/flows.md

| Ekran | Geçtiği akış(lar) | DESIGN.md bileşenleri | Nereye gider |
|---|---|---|---|
| {{EKRAN_ADI}} | {{AKIS_ADI}} | {{BILESEN_LISTESI}} | {{HEDEF_EKRAN_VEYA_YOK}} |

**Yeni ekran ekleme kuralı:** önce docs/flows.md'e akış adımı olarak ekle, sonra buraya
envanter satırı düş. Tersi sırayla eklenen ekran ölü envanter adayıdır.
