# Farkındalık Paylaşımları ve Dönem Tarihi Test Senaryoları

Bu senaryolar migration Supabase’e uygulanmadan önce gözden geçirme ve sonrasında canlı doğrulama için hazırlanmıştır. Test verileri canlıda kalıcı bırakılmamalı; mümkünse transaction içinde geri alınmalıdır.

## 1. Dönem aralığı

- `2026-2027` kaydı `2026-07-01` ile `2027-06-30` arasında olmalı.
- 2026-08-15 tarihi 2026-2027 dönemi içinde olmalı.
- 2027-01-15 tarihi 2026-2027 dönemi içinde olmalı.
- 2027-06-30 tarihi 2026-2027 dönemi içinde olmalı.
- 2027-07-01 tarihi bir sonraki döneme ait olmalı.
- Arayüzde ay bilgisi yalnızca `Ağustos` değil, `Ağustos 2026` olarak görünmeli.

## 2. Etkinlik hazırlık başlangıcı

- Kesin tarih varsa `preparation_start_date`, kesin tarihten 40 gün önce olmalı.
- Kesin tarih yoksa ve tahmini tarih varsa tahmini tarihten 40 gün önce olmalı.
- İki tarih de yoksa hazırlık başlangıcı `null` olmalı.
- Kesin tarih sonradan eklenince tahmini tarihe göre hesaplanan değer kesin tarihe göre güncellenmeli.
- Kullanıcı hazırlık başlangıcı alanını elle değiştirememeli.

## 3. Farkındalık oluşturma

- Aktif dönem üyesi yeni farkındalık kaydı oluşturabilmeli.
- Farkındalık adı boş bırakılamamalı.
- Başlangıç günü bitiş gününden sonra olamamalı.
- Paylaşım tarihi varsa hazırlığa başlangıç tarihi paylaşım tarihinden 14 gün önce hesaplanmalı.
- Paylaşım tarihi yok, tahmini paylaşım tarihi varsa hazırlığa başlangıç tarihi tahmini tarihten 14 gün önce hesaplanmalı.
- İki ana tarih de yoksa hazırlığa başlangıç tarihi `null` olmalı.
- Paylaşım ID kullanıcıdan istenmemeli; kayıt otomatik UUID almalı.
- Dönem kullanıcı tarafından değiştirilememeli.

## 4. Farkındalık düzenleme ve listeleme

- Aktif üyeler aktif kayıtları okuyabilmeli.
- Kayıtlar başlangıç/paylaşım tarihine göre tam yıl bilgisiyle listelenmeli.
- Tasarım, duyuru metni, paylaşım ve kayıt kontrolü durumları görünmeli.
- Sorumlu adları görünmeli; e-posta adresleri görünmemeli.
- Drive, tasarım ve paylaşım linkleri ayrı ayrı açılabilmeli.
- Oluşturan veya atanmış sorumlu kayıt üzerinde düzenleme yapabilmeli.
- Yetkisiz kullanıcı düzenleme/pasifleştirme kontrollerini görmemeli ve RLS ile de engellenmeli.

## 5. Pasifleştirme ve dönem kilidi

- Yetkili kullanıcı kaydı pasifleştirebilmeli.
- Pasif kayıt varsayılan listede görünmemeli.
- Pasifleri göster seçeneğiyle pasif kayıt görülebilmeli.
- Yetkili kullanıcı pasif kaydı yeniden aktifleştirebilmeli.
- Pasifleştirme ve yeniden aktifleştirme fiziksel silme yapmamalı.
- Dönem kilitliyken ekleme, düzenleme, pasifleştirme ve yeniden aktifleştirme reddedilmeli.
- Audit kaydı oluşturma, düzenleme ve pasifleştirme/aktifleştirme işlemlerini kaydetmeli.
