# MUPSA Faz 4 — AI Teknik Uygulama Planı

**Durum:** Altyapı hazırlığı başladı, kullanıcıya açık AI özelliği yok.  
**Sağlayıcı:** Google Gemini API ücretsiz kota.  
**Modeller:** `gemini-3.7-flash`, `gemini-3.5-flash-lite`, `gemini-embedding-001`.  
**Temel ilke:** AI danışmandır; uygulama kaydı oluşturamaz, değiştiremez, silemez ve bildirim gönderemez.

## 1. Amaç

Faz 4; mevcut görev, etkinlik, farkındalık ve takvim verilerini yetkiye uygun biçimde özetleyen, kaynak gösteren ve kullanıcıya metin taslağı hazırlayan bir AI katmanı ekler.

İlk sürümün kullanım alanları:

1. Ana sayfada kişiye özel günlük süreç özeti.
2. Süper yöneticilere dönem genelinde daha ayrıntılı durum özeti.
3. Etkinlik ve farkındalık sayfalarında tarih/aşama uyumlu değerlendirme.
4. Kullanıcının soru sorabildiği bağlama duyarlı MUPSA Asistan.
5. Duyuru, açıklama, farkındalık içeriği ve rapor için taslak metin.
6. Halkla İlişkiler koordinatörlerine yaklaşan önemli gün önerileri.
7. Manuel takvim kayıtlarının toplantı/akademik tarih gibi sınıflandırılması.
8. Yönetim onaylı geçmiş kaynaklardan yeni yönetime rehberlik.

## 2. Faz 4'e geçiş koşulları

AI kullanıcıya açılmadan önce:

- Görev ve etkinlik akışları gerçek kullanıcılarla doğrulanmış olmalı.
- Tarih alanlarının kullanım anlamı kesinleşmiş olmalı.
- Rol ve alan bazlı yetkiler canlı verilerle test edilmiş olmalı.
- Rapor hatırlatma süresi gibi kurum kuralları yönetimce belirlenmiş olmalı.
- Google ücretsiz kota projesinin gerçek RPM/TPM/RPD değerleri AI Studio'dan kaydedilmeli.
- Yönetim kurulu ücretsiz Gemini veri kullanım koşulları hakkında bilgilendirilmeli.
- AI'a gönderilebilecek geçmiş içerikler tek tek onaylanmalı.

Bir tam akademik dönem beklemek zorunlu değildir. Ana sayfa pilotu için yeterli veri kalitesi ve birkaç haftalık gerçek kullanım aranır. Kurumsal hafıza özelliği ise yeterli sayıda onaylı geçmiş kaynak oluşana kadar açılmaz.

## 3. Değiştirilmeyecek güvenlik kararları

- Gemini anahtarı frontend'e, repoya veya Vite ortam değişkenine konulmaz.
- API çağrıları yalnızca Supabase Edge Function üzerinden yapılır.
- Yetki filtrelemesi Gemini çağrısından önce sunucuda uygulanır.
- Şifre, e-posta, telefon, oturum belirteci, push anahtarı ve sponsor iletişim bilgisi gönderilmez.
- AI bütçe verisini yalnızca ayrı bir yönetim kararı verilirse ve yalnızca yetkili bağlamda alabilir; ilk pilotta bütçe AI kapsamı dışındadır.
- AI serbestçe SQL çalıştıramaz ve service-role istemcisini araç olarak kullanamaz.
- AI tarafından üretilen eylem yalnızca sayfaya yönlendirme veya forma taslak aktarma olabilir.
- Kalıcı silme, pasifleştirme, atama, durum değiştirme, kayıt oluşturma ve bildirim gönderme AI'a kapalıdır.
- Tanımlı bağımlılık bulunmadan neden-sonuç cümlesi kurulamaz.

## 4. Ücretsiz kota politikası

Ücretsiz kullanım hedeflenir ancak garanti edilmez. Google kotaları proje bazındadır ve değişebilir.

Kota koruması:

- Ana sayfa özeti kullanıcı başına günde en fazla bir kez otomatik üretilir.
- Kritik veri değişikliği özeti geçersiz kılar; yeni özet arka planda ve kota uygunsa oluşturulur.
- Aynı bağlam `context_hash` ile tekrar kullanılabilir.
- Otomatik işler aynı dakikaya yığılmaz; zaman aralığına dağıtılır.
- Basit sınıflandırma ve yönlendirme Flash-Lite kullanır.
- Flash yalnızca özet, sohbet ve uzun taslaklarda kullanılır.
- Kullanıcı başına chat ve taslak limitleri `ai_feature_settings` üzerinden belirlenir.
- `429` hatasında iş tekrar kuyruğuna kontrollü gecikmeyle alınır.
- Kota dolduğunda son geçerli özet gösterilir; normal uygulama etkilenmez.
- İkinci API anahtarı kota artırma yöntemi olarak kullanılmaz.

## 5. Ücretsiz servis veri politikası

Ücretsiz Gemini kullanımında gönderilen içerik ve cevaplar Google ürünlerini geliştirmek için kullanılabilir ve insan değerlendiriciler tarafından incelenebilir. Bu nedenle içerikler üç sınıfa ayrılır:

### `public`

Kamuya açık veya yayımlanmış içerik. AI kullanımına yönetim onayıyla açılabilir.

### `approved_internal`

Kişisel/gizli bilgi içermeyen kurum içi metin. Yalnızca bir Süper Yönetici açıkça onayladıktan sonra indekslenebilir.

### `confidential`

AI'a hiçbir zaman gönderilmez. Varsayılan sınıf budur.

Rapor, karar ve devir teslim notları otomatik olarak uygun kabul edilmez. `ai_source_approvals` kaydı olmayan uzun metinler embedding kuyruğuna alınmaz.

## 6. Kesin veri ve embedding ayrımı

### Doğrudan SQL bağlamı

Şunlar embedding ile aranmaz:

- Tarihler ve kalan gün sayısı
- Görev durumları ve öncelikleri
- Sorumlular ve kullanıcının görev rolü
- SKS/tasarım/duyuru/rapor durumları
- Aktif/pasif bilgisi
- Açık/gecikmiş görev sayıları
- Kullanıcı ve koordinatörlük yetkileri

### Embedding bağlamı

Yalnızca onaylı metinler parça parça indekslenir:

- Etkinlik raporları
- Karar özetleri
- Devir teslim rehberleri
- Etkinlik/farkındalık açıklamaları
- Geçmişte yayımlanmış farkındalık içerikleri

Bir kaynak değiştiğinde yalnızca içerik hash'i değişen parça yeniden indekslenir.

## 7. Temel veritabanı yapısı

### `ai_feature_settings`

AI'ın dönem bazında açık/kapalı olmasını, model adlarını ve uygulama içi günlük limitleri tutar. Yeni dönemlerde varsayılan `is_enabled = false` olur.

### `ai_source_approvals`

Bir kaynağın `public`, `approved_internal` veya `confidential` olduğunu ve AI kullanımına açılıp açılmadığını tutar.

### `ai_jobs`

Embedding, özet, önemli gün taraması ve sınıflandırma işlerini asenkron yürütür. İstek başarısız olursa ham özel veri yerine güvenli hata kodu/özeti saklanır.

### `ai_context_chunks`

Onaylı metin parçalarını, kaynak kimliğini, içerik hash'ini, yetki politikasını ve embedding vektörünü tutar. İstemci doğrudan okuyamaz.

### `ai_usage_daily`

Model/işlem/kullanıcı bazında istek ve token sayaçlarını tutar. Uygulama limitleri Gemini çağrısından önce buradan kontrol edilir.

### `ai_outputs`

Doğrulanmış günlük özet, sayfa değerlendirmesi, öneri ve taslak çıktıları saklar. Her çıktı kaynak manifesti, model, bağlam hash'i, doğrulama durumu ve sona erme zamanı taşır.

Sohbet tabloları, kullanıcıya açık pilot başlamadan önce ayrı migration ile eklenir; temel migration'a gereksiz kapsam olarak dahil edilmez.

## 8. Asenkron iş akışı

1. Uygulama kaydı normal biçimde kaydedilir.
2. Değişiklik AI açısından önemliyse `ai_jobs` tablosuna küçük bir iş eklenir.
3. Cron/Edge Function uygun zamanda işi sahiplenir.
4. Kullanıcı ve kaynak yetkisi yeniden kontrol edilir.
5. İçerik politikası kontrol edilir.
6. Günlük kota kontrol edilir.
7. Model yönlendirici uygun modeli seçer.
8. Gemini cevabı JSON şemasına göre ayrıştırılır.
9. Kaynaklar ve kesin iddialar doğrulanır.
10. Geçerli çıktı saklanır; eski çıktı `is_current = false` yapılır.

İş kuyruğu kullanıcıya açık özellik açılana kadar otomatik doldurulmaz.

## 9. Model yönlendirme

| İşlem | Model |
| --- | --- |
| Manuel takvim sınıflandırma | Gemini 3.5 Flash-Lite |
| Önemli gün uygunluk kontrolü | Gemini 3.5 Flash-Lite |
| Normal MUPSA Asistan sohbeti | Gemini 3.5 Flash-Lite |
| Günlük ana sayfa özeti | Gemini 3.5 Flash-Lite |
| Kısa duyuru/içerik/rapor taslağı | Gemini 3.5 Flash-Lite |
| Hızlı etkinlik/farkındalık değerlendirmesi | Gemini 3.5 Flash-Lite |
| Takvim dahil derin dönem analizi | Gemini 3.7 Flash |
| Haftalık Süper Yönetici analizi | Gemini 3.7 Flash |
| Çok kaynaklı kurumsal hafıza sentezi | Gemini 3.7 Flash |
| Onaylı metin indeksleme | Embedding-001 |

Gemini 3.7 Flash normal sohbet için kullanılmaz. Sunucu yalnızca açıkça tanımlanmış derin analiz işlemlerini 3.7'ye yönlendirir; günlük ve kullanıcı mesajı başına çalışan yüksek hacimli işlemler Flash-Lite kullanır.

## 10. Ana sayfa özeti

Sunucu önce doğrulanmış bir `home_context` oluşturur. Bu bağlam kullanıcının rolüne göre yalnızca yetkili kayıtları içerir.

Normal koordinatör özeti:

- Kendi açık/gecikmiş görevleri
- Sorumlu olduğu etkinlik ve farkındalıklar
- Yaklaşan tarihler ve manuel kayıtlar
- Açıkça eksik alanlar

Süper yönetici özeti:

- Dönem geneli açık/gecikmiş görevler
- Koordinatörlük bazında yoğunluk
- Sorumlusu olmayan veya tarihi yaklaşan süreçler
- SKS ve rapor durumları

Her madde `source_type`, `source_id`, `reason_code` ve güvenli bir `action` taşır. Yalnızca `open_task`, `open_event`, `open_awareness`, `open_calendar` eylemlerine izin verilir.

## 11. Kaynak ve iddia doğrulaması

AI cevapları şu türlere ayrılır:

- `fact`: Kesin kaynak zorunludur ve sunucuda doğrulanır.
- `inference`: “AI değerlendirmesi” etiketiyle gösterilir; dayanak kaynaklar zorunludur.
- `recommendation`: Kurum kuralı gibi sunulamaz; kaynakları ve öneri etiketi bulunur.
- `draft`: Gerçek iddia sayılmaz; “AI taslağı” olarak etiketlenir.

Sohbette kaynak kimliklerini model üretmez. Sunucu erişilebilir kaynaklara `S1`, `S2` gibi geçici kimlikler verir. Model yalnızca bu kimlikleri kullanabilir. Yetkisiz, silinmiş veya var olmayan kaynak referansı cevapta gösterilmez.

Doğrulanamayan kesin iddia çıkarılır veya “Mevcut kayıtlardan doğrulanamadı” olarak cevaplanır.

## 12. Tarih/aşama motoru

Etkinlik aşaması AI tarafından tahmin edilmez. Sunucu şu deterministik aşamalardan birini hesaplar:

- `before_preparation`
- `preparation`
- `final_days`
- `event_day`
- `post_event_waiting`
- `report_due`

Tarih temeli kesin tarih, yoksa tahmini tarihtir. Hazırlık başlangıcı mevcut otomatik veritabanı alanından alınır. Rapor aşaması yönetimin belirleyeceği gün sayısından önce başlamaz.

Bağımlılık arayüzü kapalı olduğu sürece AI yalnızca birlikte görülen eksikleri söyler; “X, Y yüzünden bekliyor” cümlesi kuramaz.

## 13. Kullanıcı yüzeyleri

### Ana sayfa

“AI Günlük Özeti”, son güncelleme zamanı, kaynak açıklaması ve ilgili kayda git düğmeleri.

### Etkinlik/farkındalık detayı

Sayfaya özel değerlendirme ve kullanıcı tarafından istenen metin taslakları.

### MUPSA Asistan

Masaüstünde sağ panel, mobilde tam ekran. Kullanıcı soru sorar; AI yalnızca o kullanıcıya açık kaynaklarla cevaplar.

### Form içi taslak

“AI ile taslak hazırla” önizleme açar. Kullanıcı isterse metni forma aktarır ve normal Kaydet düğmesine kendisi basar.

### Halkla İlişkiler önerileri

Yaklaşan önemli gün önerileri yalnızca `public-relations-coordinator` aktif üyelerine gösterilir. Genel ekibe otomatik bildirim gönderilmez.

## 14. Manuel takvim sınıflandırması

Flash-Lite; başlık, kategori, açıklama ve tarihi kullanarak `record_type`, `importance`, `audience_hint`, `reminder_hint`, `confidence` üretir.

Bu sonuç doğrudan bildirim göndermez. İlk pilotta yalnızca Süper Yöneticiye öneri olarak gösterilir. Yönetim tarafından kabul edilmiş sabit kurallar oluşursa bildirim motoru daha sonraki ayrı kapsamda bu sınıflandırmayı kullanabilir.

## 15. Test stratejisi

- RLS: Kullanıcı başka kişinin AI çıktısını okuyamamalı.
- RLS: Normal kullanıcı ayar/kaynak onayı/iş kuyruğu okuyamamalı.
- Gizlilik: Yasak alanlar bağlam JSON'una girmemeli.
- Kota: Limit dolunca Gemini çağrısı yapılmamalı.
- Dedupe: Aynı veri hash'i tekrar indekslenmemeli.
- Kaynak: Var olmayan veya yetkisiz kaynak iddiası gösterilmemeli.
- Aşama: Etkinlikten önce rapor önerilmemeli.
- Arıza: Gemini kapalıyken normal uygulama çalışmalı.
- Mobil: AI paneli klavye ve safe-area ile kullanılabilir olmalı.

## 16. Aşamalı teslim

1. **Altyapı:** Bu belge, temel tablolar, RLS ve feature flag.
2. **Sunucu çekirdeği:** Yetkili bağlam, model yönlendirme, kota ve JSON doğrulama.
3. **İndeks pilotu:** Yalnızca onaylı test kaynakları.
4. **Ana sayfa pilotu:** Önce Süper Yönetici ve birkaç koordinatör.
5. **Taslak araçları:** Duyuru ve farkındalık metniyle başla.
6. **Halkla İlişkiler önerileri:** Önemli gün tablosu ve günlük tarama.
7. **MUPSA Asistan:** Kaynak doğrulamalı sohbet.
8. **Manuel takvim önerisi:** Sınıflandırma, kullanıcı tarafından onaylanan politika.
9. **Kurumsal hafıza:** Yeterli onaylı kaynak sonrasında.

Her aşama ayrı migration/Edge Function/UI değişikliği olarak teslim edilir. Bir aşama doğrulanmadan sonraki özellik genel kullanıma açılmaz.
