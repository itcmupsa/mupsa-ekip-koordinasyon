# Etkinlik durum grupları canlı test senaryoları

Migration: `20260809060000_add_event_status_groups.sql`
Yetki düzeltmesi: `20260809061000_fix_event_design_status_permissions.sql`

## 1. Durum listelerinin görünmesi

- Aktif üyelik sahibi kullanıcıyla etkinlik detayını aç.
- Düzenleme ekranında **Tasarım / Duyuru** seçeneklerini doğrula:
  `Gerekli Değil`, `Brief Bekliyor`, `Tasarımda`, `Revize`, `Hazır`, `Paylaşıldı`.
- **Rapor durumu** seçeneklerini doğrula:
  `Hayır`, `Hazırlanıyor`, `Evet`.

## 2. Süper Yönetici güncellemesi

- Süper Yönetici olarak iki alanı farklı değerlere getirip kaydet.
- Başarı mesajını, detay kartındaki değerleri ve sayfa yenilemesi sonrası kalıcılığı doğrula.

## 3. Etkinlik sahibi yetkisi

- Etkinlik sahibiyle giriş yap.
- Rapor durumunu değiştirebildiğini doğrula.
- Tasarım / Duyuru durumunun, Tasarım veya Basın/Yayın süreç sahibi atanmamışsa değiştirilemediğini doğrula.

## 4. Tasarım / Basın-Yayın süreç sahibi yetkisi

- Etkinliğe Tasarım veya Basın/Yayın sürecinde bir ana sorumlu ata.
- Bu kullanıcıyla giriş yapıp Tasarım / Duyuru durumunu değiştirebildiğini doğrula.
- Aynı kullanıcının rapor durumu ve genel etkinlik alanlarını değiştiremediğini doğrula.

## 5. Salt-okunur görünüm

- Yetkisiz aktif ekip üyesiyle etkinlik detayını aç.
- İki alanın etiketlerini ve mevcut değerlerini okuyabildiğini, düzenleme kontrolü görmediğini doğrula.

## 6. Dönem kilidi

- Dönemi kilitle.
- Yetkili kullanıcıyla iki durumdan birini değiştirmeyi dene.
- İşlemin reddedildiğini ve kullanıcıya kilitli dönem mesajının gösterildiğini doğrula.
