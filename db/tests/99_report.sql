\echo
\echo === Результаты проверок БД ===
select case when passed then 'ok  ' else 'FAIL' end as status, name, coalesce(detail, '') as detail
from test.results
where not passed
order by n;

select count(*) filter (where passed)     as passed,
       count(*) filter (where not passed) as failed,
       count(*)                           as total
from test.results;

-- ненулевой код возврата для CI: psql -v ON_ERROR_STOP=1 прервётся на этой ошибке
do $$
begin
  if exists (select 1 from test.results where not passed) then
    raise exception 'RLS tests failed';
  end if;
end $$;
