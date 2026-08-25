-- Dağıtımın gerçekten 3.5 Flash Lite ile geçerli bir özet ürettiğini doğrular.
do $$
begin
  if not exists (
    select 1
    from public.ai_outputs output
    join public.periods period on period.id = output.period_id
    where period.is_active
      and output.output_type = 'home_summary'
      and output.model_id = 'gemini-3.5-flash-lite'
      and output.validation_status = 'valid'
      and output.is_current
      and output.created_at >= now() - interval '10 minutes'
  ) then
    raise exception 'Güncel Gemini 3.5 Flash Lite özeti doğrulanamadı.';
  end if;
end;
$$;
