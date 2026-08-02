# Bildirim testi — görev atandı

Bu senaryolar, `20260802140000_queue_task_assigned_notifications.sql` migration'ı uygulandıktan sonra gerçek Supabase test projesinde çalıştırılacaktır. Her senaryo kendi test etkinliği ve göreviyle, diğer senaryolardan bağımsız yürütülür.

## 1. Asıl sorumlu ataması

1. Aktif dönemde bir etkinlik ve görev oluşturulur.
2. Göreve aktif bir ekip üyesi `primary` olarak atanır.
3. `notifications` tablosunda o kişi için tam **iki** yeni kayıt doğrulanır: biri `in_app`, diğeri `email` kanalıyla.
4. Her iki kaydın da `notification_type = task_assigned`, doğru `event_id`, doğru `task_id` ve `delivery_status = queued` olduğu doğrulanır.
5. Görev veya etkinlik adının, bildirim gövdesinde doğru olduğu doğrulanır.

## 2. Destekleyen ve bilgilendirilecek kişi ataması

1. Aynı görev için iki farklı aktif ekip üyesi sırasıyla `supporting` ve `informed` olarak atanır.
2. Her atama için yalnızca o atanan kişiye iki kuyruk kaydı oluştuğu doğrulanır.
3. Bildirim gövdesindeki rol ifadesinin doğru olduğu doğrulanır.

## 3. Tekrar ve yeniden atama

1. Aynı kişi aynı görev ve aynı atama türüyle ikinci kez eklenmek istenir.
2. Mevcut benzersizlik kuralının işlemi reddettiği ve ek bildirim oluşmadığı doğrulanır.
3. Atama silinip kişi yeniden atanır.
4. Yeni atama kaydının yeni kimliği üzerinden, o yeni atama için iki yeni kuyruk kaydı oluştuğu doğrulanır.

## 4. İlgisiz değişiklikler

1. Görevin başlığı veya ilerleme durumu değiştirilir.
2. Yeni `task_assigned` bildirimi oluşmadığı doğrulanır.
3. Bu değişikliklere ilişkin bildirimler, kendi ayrı tetikleyicileri eklendiğinde test edilecektir.

## 5. Teslimat ayrımı

1. Atama yapıldığında trigger'ın e-posta/push göndermediği, yalnızca `queued` kayıtları oluşturduğu doğrulanır.
2. E-posta teslimat katmanı daha sonra eklendiğinde, başarısız gönderimin görevi veya atamayı geri almadığı ayrıca doğrulanacaktır.
