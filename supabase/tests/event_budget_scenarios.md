# Bütçe alanları ve yetki test senaryoları

## Şema

- `events` tablosunda bütçe alanlarının ve `budget_statuses` kayıtlarının bulunduğunu doğrula.
- `estimated_budget`, `approved_budget` ve `actual_expense` alanlarına negatif değer yazmayı dene; veritabanı işlemi reddetmeli.

## Yetki

- Aktif normal üye bütçe alanlarını okuyabilmeli, düzenleme kontrolünü görmemeli.
- Etkinlik sahibi genel etkinlik alanlarını düzenleyebilmeli ancak bütçe alanlarını değiştirememeli.
- Bütçe Ana Sorumlusu bütçe alanlarını değiştirebilmeli ancak başlık, genel not veya SKS durumunu değiştirememeli.
- Süper Yönetici tüm bütçe alanlarını yönetebilmeli.
- Aynı kişi aynı etkinliğin bütçe ekibinde birden fazla sorumluluk türüne atanamamalı.

## Dönem ve arayüz

- Kilitli dönemde bütçe alanı ve bütçe ekibi değişiklikleri reddedilmeli.
- Aktif Sayman varsa yeni bütçe ekibinde Ana Sorumlu adayı olarak görünmeli.
- Bütçe durumu veritabanından okunmalı; e-posta adresleri gösterilmemeli.
