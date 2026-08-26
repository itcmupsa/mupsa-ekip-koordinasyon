# MUPİ Günlük Özet Geliştirme Planı

**Tarih:** 26 Ağustos 2026
**Durum:** Uygulandı ve doğrulandı

## 1. Hedef

MUPİ günlük özet sisteminin amacı:

- Her aktif kullanıcı için her sabah **09:00 Türkiye saati** kişisel özet oluşturmak.
- Özeti iki bölüme ayırmak:
  - **Bugün:** Gerçekten işlem gerektiren en fazla 3 konu.
  - **Yakında:** Henüz acil olmayan fakat önümüzdeki gün/haftalarda gündeme gelecek en fazla 3 konu.
- Uzak tarihli etkinliklerde gereksiz aciliyet üretmemek.
- Öncelik kararını Gemini'ye bırakmamak; tarih, görev durumu, süreç aşaması ve kullanıcı rolüne göre uygulama kurallarıyla belirlemek.
- Gemini'yi doğrulanmış veriyi kısa, doğal ve anlaşılır Türkçeyle sunan katman olarak kullanmak.
- İki farklı Google projesinden gelen Gemini API anahtarını aktif ve dengeli kullanmak.
- Her iki anahtarda da `gemini-3.5-flash-lite` kullanmak.
- Bir API anahtarı kota/servis sorunu yaşarsa diğerine otomatik geçmek.

---

## 2. Temel ürün ilkesi

MUPİ'nin günlük özeti **“en önemli şeyler”** listesi değil, **“bugün gerçekten dikkat veya işlem gerektiren şeyler”** listesi olmalıdır.

Bir kaydın önemli olması onun bugün acil olduğu anlamına gelmez.

Örnek:

- 40 gün sonraki büyük etkinlik: `importance = high`, `urgency = low`.
- Bugün bitecek normal görev: `importance = normal`, `urgency = high`.

MUPİ günlük özetinde aciliyet ve süreç zamanı esas alınmalıdır.

---

## 3. Bugün ve Yakında ayrımı

Yeni günlük özet şeması iki ayrı liste içermelidir.

```ts
{
  today: [
    {
      source_id: "S1",
      reason_code: "task_due_soon",
      action: "review_task",
      title: "...",
      detail: "..."
    }
  ],
  upcoming: [
    {
      source_id: "S7",
      reason_code: "preparation_started",
      action: "monitor_event",
      title: "...",
      detail: "..."
    }
  ]
}
```

Limitler:

- `today`: en fazla 3 kayıt.
- `upcoming`: en fazla 3 kayıt.

### Bugün

Sadece gerçekten işlem isteyen kayıtlar:

- Gecikmiş görevler.
- Son tarihi bugün veya çok yakın olan görevler.
- Günü gelen etkinlik/toplantılar.
- Süreç aşamasına göre artık çözülmesi gereken etkinlik eksikleri.
- Kritik operasyonel durumlar.

### Yakında

Henüz acil olmayan ancak kullanıcının radarında bulunması yararlı olan kayıtlar.

Örnek:

> MUPSA Bahar Etkinliği'nin hazırlık dönemi başladı. Şu anda acil işlem gerekmiyor.

MUPİ burada emir verici olmamalı ve gereksiz şekilde “mekân bul”, “tasarıma başla” gibi erken aksiyon üretmemelidir.

---

## 4. Etkinlik hazırlık zaman çizelgesi

40 günlük hazırlık dönemi tek bir aciliyet bloğu olarak değerlendirilmemelidir.

### 40–31 gün — Hazırlık başladı

- Etkinlik `Yakında` bölümünde gösterilebilir.
- Eksik mekân, tasarım, duyuru veya SKS tek başına `Bugün` önceliği oluşturmaz.
- Uygun metin: “Hazırlık dönemi başladı; şu anda acil işlem gerekmiyor.”

### 30–22 gün — Erken planlama

Değerlendirilebilecek başlıklar:

- Mekân.
- SKS gereksinimi.
- Ana sorumlular.
- Büyük organizasyon ihtiyaçları.

Bunlar normal şartlarda `Yakında` bölümünde kalır.

### 21–15 gün — Aktif hazırlık

Artık aşağıdaki kontroller anlamlı hale gelir:

- Mekân hâlâ belirsiz mi?
- SKS gerekiyorsa süreç başladı mı?
- Tasarım briefi gerekiyor mu?
- Ana görevler tanımlandı mı?

Eksikler düşük/orta önceliğe çıkabilir.

### 14–8 gün — Yoğun hazırlık

Kontroller:

- Tasarım.
- Duyuru.
- Görev durumları.
- Mekân.
- SKS.
- Sorumlular.
- Yaklaşan son tarihler.

Gerçek eksikler artık `Bugün` bölümüne çıkabilir.

### 7–3 gün — Son hazırlık

Eksikler yüksek önceliklidir.

Örnek:

> Etkinliğe 5 gün kaldı ve duyuru hâlâ “Brief Bekliyor”.

### 2–1 gün — Kritik kontrol

Yalnızca gerçekten eksik kalan operasyonel işler gösterilmelidir.

### Etkinlik günü

Etkinlik `Bugün` bölümünde gösterilir. Yalnızca gerekli son kontroller eklenir.

### Etkinlik sonrası

Hazırlık konuları kapanır. Rapor gerekiyorsa rapor süreci değerlendirilir.

---

## 5. Alan bazlı zamanlama

Genel 40 günlük pencerenin yanında alanların kendi zamanlaması bulunmalıdır.

Başlangıç önerisi:

- Mekân: 30 gün civarında `Yakında`, 21 gün ve altında giderek artan öncelik.
- SKS: erken planlanabilir ancak 40 gün kala acil değildir.
- Tasarım briefi: yaklaşık 21 gün kala değerlendirilmeye başlanır.
- Tasarım hazır olma durumu: yaklaşık 10–14 gün kala önem kazanır.
- Duyuru: yaklaşık 7–10 gün kala önem kazanır.
- Görevler: kendi son tarihlerine göre değerlendirilir.
- Rapor: etkinlik sonrasında devreye girer.

Bu eşikler ileride gerçek kullanım deneyimine göre merkezi ayarlara taşınabilir.

---

## 6. Görev öncelik algoritması

Başlangıç puanlaması:

| Durum | Puan |
|---|---:|
| Gecikmiş | 100 |
| Bugün | 98 |
| 1 gün | 95 |
| 2–3 gün | 90 |
| 4–7 gün | 70 |
| 8–14 gün | 45 |
| 14 günden fazla | Normalde gösterme |

Görev önceliği ek puan verebilir:

- `urgent`: +10
- `high`: +5
- `normal`: +0
- `low`: -5

Uzak tarihli bir görev yalnızca `urgent` etiketi taşıdığı için günlük acil konu haline gelmemelidir.

---

## 7. Öncelik motoru

Öncelik seçimi Gemini'den ayrılmalıdır.

Uygulama önce:

1. Tarihi hesaplar.
2. Süreç aşamasını belirler.
3. Kullanıcının rolünü/yetkisini kontrol eder.
4. Eksik alanın artık gerçekten gerekli olup olmadığını değerlendirir.
5. Puanı hesaplar.
6. `Bugün`, `Yakında` veya `Gösterme` sınıfına ayırır.

Gemini yalnızca bu filtrelenmiş ve doğrulanmış kayıtları almalıdır.

Önemli ilke:

> Gemini'ye “40 gün sonraki etkinliğin mekânı eksik ama bunu önemsiz say” demek yerine, kayıt henüz anlamlı değilse `Bugün` adayı olarak Gemini'ye hiç gönderilmemelidir.

---

## 8. Kullanıcı bazlı kişisel özet

Her sabah aktif dönemdeki tüm aktif üyeler için ayrı özet hazırlanmalıdır.

### Koordinatör görünümü

Kullanıcının yetkisine göre yalnızca ilgili bağlam:

- Kendisine atanmış görevler.
- Desteklediği görevler.
- Sorumlu olduğu etkinlikler.
- Koordinatörlüğüyle ilgili süreçler.
- Sorumlu olduğu farkındalık çalışmaları.

### Super Admin görünümü

Daha geniş ekip görünümü:

- Ekip genelindeki gecikmeler.
- Atanmamış kritik görevler.
- Yaklaşan etkinlikler.
- Kritik organizasyon eksikleri.

Kullanıcı bazlı bağlam mevcut RLS ve membership yetkilendirmesiyle uyumlu çalışmalıdır.

---

## 9. Sabah 09:00 scheduler düzeltmesi

Mevcut scheduler yalnızca tek bir Super Admin için özet üretme davranışına sahiptir. Bu değiştirilmelidir.

Yeni akış:

```text
09:00 Türkiye saati cron
        ↓
Aktif dönemi bul
        ↓
Tüm aktif üyeleri getir
        ↓
Her kullanıcı için yetkili bağlam hazırla
        ↓
Öncelik motorunu çalıştır
        ↓
Bugün + Yakında listelerini oluştur
        ↓
Gemini ile metni hazırla
        ↓
Kullanıcıya özel çıktıyı kaydet
```

Bir kullanıcının özeti başarısız olursa diğer kullanıcıların üretimi devam etmelidir.

Her kullanıcı işlemi bağımsız `try/catch` davranışıyla yürütülmelidir.

---

## 10. Aynı gün tekrar üretim koruması

Cron yanlışlıkla iki kez çalışırsa aynı kullanıcı için gereksiz Gemini çağrısı yapılmamalıdır.

Günlük çıktı benzersizliği en az şu alanlarla kontrol edilmelidir:

```text
period_id
recipient_id
operation_type
summary_date
```

Normal cron aynı gün ikinci kez çıktı üretmemelidir.

Gerekirse yönetici/teknik kullanım için ayrı `force_refresh` mekanizması eklenebilir.

---

## 11. İki Gemini API anahtarının kullanımı

İki anahtar farklı Google projelerinden gelmektedir ve her ikisi de aktif kullanılacaktır.

Her iki anahtar için model:

```text
gemini-3.5-flash-lite
```

İlk sürümde **round-robin + fallback** uygulanmalıdır.

Örnek:

```text
Kullanıcı 1 → Key A
Kullanıcı 2 → Key B
Kullanıcı 3 → Key A
Kullanıcı 4 → Key B
```

Bir anahtar aşağıdaki hatalardan birini verirse aynı işlem diğer anahtarla bir kez denenmelidir:

- 401
- 403
- 429
- 5xx
- timeout

API anahtarlarının kendisi hiçbir zaman frontend'e, loglara veya veritabanına açık biçimde yazılmamalıdır.

Loglarda yalnızca `key_slot = A/B` gibi anonim tanımlayıcı kullanılabilir.

---

## 12. İleri aşama key health sistemi

İlk sürümden sonra gerekirse şu sağlık bilgileri tutulabilir:

```text
provider_key_slot
last_success_at
last_failure_at
recent_429_count
cooldown_until
```

Örneğin Key A `429` verirse kısa süreli cooldown uygulanıp çağrılar Key B'ye yönlendirilebilir.

Bu özellik ilk uygulama için zorunlu değildir; round-robin + fallback yeterlidir.

---

## 13. Ortak Gemini istemcisi

Tüm Gemini çağrıları tek bir sunucu yardımcı fonksiyonunda birleştirilmelidir.

Örnek API:

```ts
callGemini({
  operation,
  payload,
  schema,
  timeoutMs,
})
```

Bu fonksiyon:

- API anahtarını seçer.
- `gemini-3.5-flash-lite` modelini kullanır.
- Timeout uygular.
- Gerekirse diğer anahtara geçer.
- Structured JSON sonucunu doğrular.
- Güvenli teknik log üretir.

Başlangıç ayarı:

- Timeout: yaklaşık 10 saniye.
- Aynı key üzerinde gereksiz retry yok.
- Diğer key ile en fazla 1 fallback denemesi.

---

## 14. Gemini prompt yaklaşımı

Gemini artık öncelik motoru olmamalıdır.

Prompt mantığı:

> Aşağıdaki kayıtlar uygulama tarafından doğrulanmış ve önceliklendirilmiştir. Önem sırasını değiştirme. Yeni görev, eksik veya neden uydurma. “Bugün” kayıtlarını kısa ve aksiyon odaklı; “Yakında” kayıtlarını bilgi verici ve baskısız ifade et.

Gemini'nin görevi:

- Dili doğal hale getirmek.
- Kısa özet oluşturmak.
- Doğrulanmış kaydı kullanıcıya anlaşılır sunmak.

Gemini'nin görevi olmayanlar:

- Yeni eksik uydurmak.
- Uzak tarihli işi acil ilan etmek.
- Yetkisiz kayıt seçmek.
- Görev/etkinlik oluşturmak veya değiştirmek.

---

## 15. Serbest metin sanitization

Gemini'ye gönderilen bütün kullanıcı tarafından yazılabilen metinler ortak bir sanitizer'dan geçirilmelidir.

Özellikle:

- Görev başlığı.
- Etkinlik başlığı.
- Farkındalık başlığı.
- Takvim başlığı.
- Takvim notu.
- AI'ya gönderilmesi ileride gerekli olabilecek diğer serbest metinler.

Temizlenecek veriler en az:

- E-posta adresleri.
- Telefon numaraları.
- URL'ler.
- Gereksiz kişisel tanımlayıcılar.

AI bağlamı mümkün olan en az veriyle oluşturulmalıdır.

---

## 16. MUPİ kartı arayüzü

Önerilen görünüm:

```text
MUPİ
Günlük Özet
26 Ağustos 2026

BUGÜN

• ...
• ...
• ...

YAKINDA

• ...
• ...
• ...
```

Bugün gerçekten işlem yoksa sistem sırf kartı doldurmak için öneri üretmemelidir.

Örnek:

```text
Bugün
Acil işlem gerektiren bir konu görünmüyor.

Yakında
MUPSA 3. Toplantı hazırlık dönemi başladı.
Şimdilik acil işlem gerekmiyor.
```

---

## 17. Gemini başarısız olduğunda fallback

Gemini çalışmasa bile günlük kart kullanılabilir kalmalıdır.

Öncelik motoru deterministik olduğundan kural tabanlı metin üretilebilir.

Fallback sırası:

1. Bugün için önceden üretilmiş doğrulanmış MUPİ özeti varsa onu kullan.
2. Yoksa kural tabanlı `Bugün + Yakında` özeti üret.
3. Hiç kayıt yoksa “Bugün acil işlem gerektiren bir konu görünmüyor.” mesajını göster.

Kullanıcıya mümkün olduğunca ham API/AI servis hatası gösterilmemelidir.

---

## 18. Audit ve gözlemleme

Her sabah üretim için güvenli teknik kayıt tutulmalıdır.

Önerilen alanlar:

```text
user_id
period_id
started_at
finished_at
provider_model
key_slot
source_count
today_count
upcoming_count
fallback_used
api_status
```

Loglanmaması gerekenler:

- API anahtarının kendisi.
- Gereksiz prompt içeriği.
- Kişisel veri.
- Hassas uygulama verileri.

Bu kayıtlar “Bu kullanıcının sabah özeti neden oluşmadı?” sorusunu teşhis edebilmek için kullanılmalıdır.

---

## 19. Test planı

### Scheduler

- 09:00 Türkiye saatinde cron çalışıyor mu?
- Her aktif kullanıcı için çıktı oluşuyor mu?
- Pasif kullanıcı için çıktı oluşmuyor mu?
- Tek bir kullanıcıdaki hata diğerlerini engelliyor mu?
- Aynı gün duplicate çıktı engelleniyor mu?

### Etkinlik zamanlaması

- 40 gün kala eksik mekân `Bugün` olmamalı.
- 34 gün kala etkinlik `Yakında` görünebilir.
- 20 gün + mekân yok → Yakında/düşük-orta öncelik.
- 10 gün + mekân yok → Bugün adayı olabilir.
- 5 gün + tasarım hâlâ Brief Bekliyor → Bugün yüksek öncelik.
- Etkinlik günü → Bugün.
- Etkinlik sonrası → hazırlık uyarıları kapanmalı, gerekiyorsa rapor süreci açılmalı.

### Görevler

- Dün bitmiş → Bugün.
- Bugün bitiyor → Bugün.
- 3 gün kaldı → Bugün.
- 12 gün kaldı → Yakında veya gösterme.
- 30 gün kaldı → normalde gösterme.

### Yetki

- Koordinatör ilgisiz başka koordinatörün özel görevlerini görmemeli.
- Koordinatör kendi görev/süreçlerini görmeli.
- Super Admin ekip genelini görebilmeli.

### API anahtarları

- Key A başarılı.
- Key B başarılı.
- A `429` → B devralıyor.
- B `429` → A devralıyor.
- Timeout → diğer key deneniyor.
- İki key de kullanılamıyor → kural tabanlı fallback.

### AI doğrulama

- Gemini var olmayan kaynak üretememeli.
- Gemini reason/action değiştirememeli.
- Gemini `Bugün` ile `Yakında` kayıtlarını keyfi olarak yer değiştirememeli.
- En fazla 3 + 3 kayıt sınırı korunmalı.

---

## 20. Uygulama sırası

Değişiklikler aşağıdaki sırayla yapılmalıdır:

1. Öncelik ve zamanlama motoru.
2. `Bugün + Yakında` output şeması.
3. 40 günlük etkinlik aşamaları ve alan bazlı zamanlama.
4. Kullanıcı bazlı bağlam.
5. 09:00 scheduler'ın tüm aktif üyelere yayılması.
6. Aynı gün duplicate özet koruması.
7. İki API key için round-robin + fallback.
8. Ortak Gemini client ve timeout.
9. Serbest metin sanitization.
10. Frontend MUPİ kartının `Bugün + Yakında` olarak güncellenmesi.
11. Rule-based fallback.
12. Audit/gözlemleme.
13. Otomatik ve canlı testler.

---

## 21. Değişiklik sırasında korunacak sınırlar

Bu çalışma yapılırken mevcut güvenlik ilkeleri korunmalıdır:

- Gemini API anahtarları frontend'e taşınmayacak.
- `service_role` frontend'e taşınmayacak.
- RLS/yetki sınırları aşılmayacak.
- Gemini doğrudan kayıt oluşturmayacak, güncellemeyecek veya silmeyecek.
- AI çıktıları kaynak/reason/action doğrulamasından geçmeye devam edecek.
- Bütçe, sponsor, e-posta ve gereksiz kişisel/hassas içerik AI bağlamına eklenmeyecek.
- Mevcut çalışan takvim ve farkındalık AI özellikleri yeni ortak Gemini client'a taşınırken davranış regresyonu test edilecek.

---

## 22. Nihai mimari ilkesi

> **MUPİ neyin önemli olduğuna tek başına karar vermeyecek. Uygulama zamanı, kullanıcı rolünü, deadline'ı, süreç aşamasını ve doğrulanmış eksikleri hesaplayacak; MUPİ yalnızca bu doğrulanmış sonucu anlaşılır ve doğal bir dille sunacak.**

Bu yaklaşımın temel hedefleri:

- 40 gün sonraki etkinliği gereksiz şekilde acil göstermemek.
- Gerçek gecikmeleri ve yaklaşan işleri kaçırmamak.
- Her koordinatöre kendi sorumluluklarına göre kişisel sabah özeti sunmak.
- İki Gemini projesinin Flash-Lite kapasitesini güvenli biçimde kullanmak.
- Gemini erişilemediğinde bile MUPİ kartının çalışmaya devam etmesini sağlamak.
