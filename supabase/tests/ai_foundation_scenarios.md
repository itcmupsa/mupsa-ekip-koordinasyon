# AI temel altyapısı test senaryoları

Bu senaryolar `20260825090000_add_ai_foundation.sql` migration'ı uygulandıktan sonra kontrollü bir test işlemi içinde çalıştırılır. Geçici kayıtlar test sonunda `ROLLBACK` ile kaldırılır.

## 1. Özellik varsayılan olarak kapalı

1. Aktif dönem için `ai_feature_settings` kaydı bulunduğu doğrulanır.
2. `is_enabled = false` ve `free_tier_only = true` olduğu doğrulanır.
3. Aktif dönem üyesi `is_ai_enabled(period_id)` çağırdığında `false` alır.
4. Süper Yönetici ayarı açmadan hiçbir Edge Function'ın Gemini çağrısı yapmaması gerekir.

## 2. Ayar yetkisi

1. Normal koordinatör `ai_feature_settings` tablosunu doğrudan okuyamaz veya değiştiremez.
2. Süper Yönetici ayarı okuyabilir ve günlük uygulama limitlerini değiştirebilir.
3. `free_tier_only = false` güncellemesi tablo kontrol kısıtı tarafından reddedilir.
4. Model limitleri tanımlı aralıkların dışına çıkarılamaz.

## 3. Kaynak onayı ve gizlilik

1. Yeni kaynak onayı varsayılan `classification = confidential`, `is_ai_allowed = false` oluşturulur.
2. `confidential` kaynak `is_ai_allowed = true` yapılamaz.
3. `public` veya `approved_internal` kaynak AI'a açılırken `approved_by` ve `approved_at` zorunludur.
4. Normal koordinatör kaynak onaylarını okuyamaz veya değiştiremez.
5. Süper Yönetici kaynak sınıflandırmasını yönetebilir.

## 4. İndeks parçası izolasyonu

1. Service-role ile onaylı bir kaynağa bağlı `ai_context_chunks` satırı oluşturulur.
2. `content_hash` 64 karakter değilse ekleme reddedilir.
3. Onay kaydı bulunmayan parça eklenemez.
4. Normal kullanıcı ve Süper Yönetici istemci oturumu tabloyu doğrudan okuyamaz.
5. Embedding doluysa `embedded_at` alanının da dolu olması gerekir.
6. Aynı kaynak/sürüm/hash ikinci kez eklenemez.

## 5. İş kuyruğu

1. Service-role aynı `dedupe_key` ile iki iş ekleyemez.
2. Normal kullanıcı `ai_jobs` tablosuna iş ekleyemez veya iş durumunu değiştiremez.
3. Süper Yönetici işlerin güvenli durum ve hata özetlerini okuyabilir.
4. Hata özetinin 500 karakter sınırı doğrulanır.
5. `attempt_count` ve `max_attempts` kontrol kısıtları doğrulanır.

## 6. Kota görünürlüğü

1. Kullanıcı yalnızca `requester_id` alanı kendisine ait günlük kullanım kaydını okuyabilir.
2. Başka bir kullanıcının kişisel kullanım kaydını okuyamaz.
3. Süper Yönetici dönem kullanım kayıtlarını okuyabilir.
4. Negatif istek/token/hata sayıları eklenemez.
5. Aynı gün/kullanıcı/işlem/model kombinasyonu tek sayaç satırında tutulur.

## 7. AI çıktısı izolasyonu

1. Kullanıcı yalnızca kendi `ai_outputs` kayıtlarını okuyabilir.
2. Normal kullanıcı veya Süper Yönetici başka bir kullanıcının kişisel özetini doğrudan okuyamaz.
3. Aynı kullanıcı, çıktı türü ve bağlam için yalnızca bir `is_current = true` satırı bulunabilir.
4. `context_hash` 64 karakter değilse ekleme reddedilir.
5. Kaynak manifesti bulunmayan kesin iddialı çıktı doğrulama katmanında `invalid` işaretlenmelidir.

## 8. Arıza ve geri dönüş

1. Gemini anahtarı yokken normal uygulama ekranları çalışmaya devam eder.
2. AI ayarı kapalıyken kullanıcıya AI bileşeni gösterilmez.
3. `429` sonrasında işin güvenli hata koduyla tekrar kuyruğuna alınacağı Edge Function testinde doğrulanır.
4. Yeni çıktı üretilemezse son geçerli ve süresi dolmamış çıktı kullanılabilir.

## 9. Ana sayfa bağlamı

1. AI kapalıyken `get_my_ai_home_context(period_id)` çağrısı hata vermelidir.
2. Aktif dönem üyeliği olmayan kullanıcı bağlam alamamalıdır.
3. Koordinatör yalnızca atandığı açık görevleri görmelidir; başka üyelerin bağımsız görevleri görünmemelidir.
4. Koordinatör yalnızca sorumlusu/üyesi olduğu ya da atanmış görevi bulunan etkinlikleri görmelidir.
5. Halkla ilişkiler koordinatörü aktif farkındalık kayıtlarını görebilmeli; diğer koordinatörler yalnızca sorumlusu oldukları kayıtları görmelidir.
6. Süper Yönetici tüm açık görevlerin ve ilgili kayıtların özetini görebilmelidir.
7. Dönen JSON içinde e-posta, kişi adı, açıklama, not, rapor, karar, bütçe veya sponsor alanı bulunmamalıdır.
8. Kesin tarih varsa `effective_date` kesin tarih, yoksa tahmini tarih olmalıdır.
9. `report_reminder_offset_days` boşsa geçmiş etkinlik için `report_due` üretilmemelidir.
10. Bağlam çıktısında silme, güncelleme, oluşturma veya bildirim gönderme komutu bulunmamalıdır.
