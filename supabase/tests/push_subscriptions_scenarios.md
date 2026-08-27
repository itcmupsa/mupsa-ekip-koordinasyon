# Push abonelik altyapısı testi

Bu senaryolar gerçek Supabase test projesinde çalıştırılacaktır.

## 1. Birden fazla cihaz

1. Aynı aktif kullanıcı için farklı `endpoint` değerleriyle iki abonelik eklenir.
2. İki satırın da oluştuğu ve aynı `profile_id` altında saklandığı doğrulanır.

## 2. Aynı cihazın yenilenmesi

1. Mevcut bir `endpoint` ile ikinci satır eklenmek istenir.
2. Benzersizlik kuralının ikinci kaydı reddettiği doğrulanır.
3. Anahtarları yenilenmiş mevcut abonelik güncellenir; tek satır kaldığı ve `updated_at` değerinin yenilendiği doğrulanır.

## 3. Yetki ve gizlilik

1. Kullanıcı yalnızca kendi aboneliklerini okuyup değiştirebildiğini doğrular.
2. Başka bir normal ekip üyesinin başka kullanıcının aboneliklerini okuyamadığı/değiştiremediği doğrulanır.
3. Süper Yöneticinin başka kullanıcıların ham `endpoint`, `p256dh_key` ve `auth_key` değerlerini SELECT/UPDATE edemediği doğrulanır; teslimat erişimi service role ile sınırlı kalır.
4. Aynı browser endpoint'i oturum değişiminde `sync_push_subscription` ile yalnız authenticated kullanıcının profiline bağlanır.
5. Abonelik anahtarlarının `audit_logs` tablosuna yazılmadığı doğrulanır.

## 4. Pasifleştirme

1. Geçersiz veya izin kaldırılmış cihaz için `is_active = false` yapılır ve `failed_at` yazılır.
2. İlerideki push teslimatının yalnızca aktif abonelikleri seçmesi gerektiği doğrulanır.
