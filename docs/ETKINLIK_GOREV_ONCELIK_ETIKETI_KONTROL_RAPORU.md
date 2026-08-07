# Görev Öncelik Etiketleri Kontrol Raporu

## Sonuç

Görev kartında teknik öncelik değerlerinin kullanıcıya Türkçe gösterilmesi düzeltildi.

## Eşleştirmeler

- `low` → `Düşük`
- `normal` → `Normal`
- `high` → `Yüksek`
- `urgent` → `Acil`

Bilinmeyen bir değer gelirse ham değer gösterilmeye devam eder; veri kaybı yaşanmaz.

## Doğrulama

- `npm run lint` başarılı.
- `npm run build` başarılı.
- `git diff --check` başarılı.
