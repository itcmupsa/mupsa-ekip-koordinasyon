# Etkinlik koordinatörlük filtresi ve bütçe yetkisi

## Koordinatörlük filtresi

1. Etkinlikler sayfasını, farklı koordinatörlüklere bağlı sorumluların etkinlikleri varken aç.
2. Filtrede yalnızca en az bir etkinliği bulunan koordinatörlüklerin listelendiğini doğrula.
3. Bir koordinatörlük seçildiğinde sadece o koordinatörlüğün sorumlu olduğu etkinliklerin kaldığını doğrula.
4. Parantez içindeki etkinlik sayılarının kart sayılarıyla eşleştiğini doğrula.

## Normal koordinatör

1. Sayman olmayan normal koordinatör hesabıyla etkinlik detayını aç.
2. Üst bölüm navigasyonunda `Bütçe` bağlantısının görünmediğini doğrula.
3. Bütçe süreci, bütçe ekibi ve sponsor alanlarının görünmediğini doğrula.
4. `get_event_budget` RPC çağrısının yetki hatası verdiğini doğrula.
5. `events` tablosundaki bütçe kolonlarının doğrudan seçilemediğini doğrula.
6. `event_budget_sponsors` ve bütçe türündeki `event_process_members` kayıtlarının okunamadığını doğrula.

## Sayman

1. `treasurer` koordinatörlük rolündeki hesapla etkinlik detayını aç.
2. Bütçe bağlantısı, bütçe bilgileri, bütçe ekibi ve sponsorların göründüğünü doğrula.
3. Bütçe alanlarının güncellenebildiğini doğrula.
4. Sponsor ekleme, düzenleme ve pasifleştirme işlemlerini doğrula.
5. Bütçe ekibine üye ekleme ve kaldırma işlemlerini doğrula.

## Süper Yönetici

1. Süper Yönetici hesabıyla tüm bütçe alanlarının göründüğünü doğrula.
2. Bütçe alanları, sponsorlar ve bütçe ekibi üzerinde yönetim işlemlerinin çalıştığını doğrula.
