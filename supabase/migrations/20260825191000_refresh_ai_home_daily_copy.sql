-- Önceki karşılaştırmalı "son özetten" metnini tekrar göstermemek için yalnızca
-- bu eski kopyayı taşıyan geçerli ana sayfa çıktılarını yenilenmeye açar.
update public.ai_outputs
set is_current = false
where output_type = 'home_summary'
  and is_current
  and payload ->> 'intro' ilike 'Son özetten%';
