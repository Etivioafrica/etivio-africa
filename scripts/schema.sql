-- Dumps the public schema as JSON for scripts/gen-types.py (no Docker needed).
select json_build_object(
  'tables', (
    select json_agg(json_build_object(
      'name', c.relname,
      'columns', (
        select json_agg(json_build_object(
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'udt', t.typname,
          'is_enum', t.typtype = 'e' or (et.typtype = 'e'),
          'elem', et.typname,
          'nullable', not a.attnotnull,
          'has_default', a.atthasdef or a.attidentity <> '',
          'identity_always', a.attidentity = 'a'
        ) order by a.attname)
        from pg_attribute a
        join pg_type t on t.oid = a.atttypid
        left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      ),
      'fks', (
        select json_agg(json_build_object(
          'name', k.conname,
          'columns', (select json_agg(att.attname) from unnest(k.conkey) ck join pg_attribute att on att.attrelid = k.conrelid and att.attnum = ck),
          'ref_table', rc.relname,
          'ref_columns', (select json_agg(att.attname) from unnest(k.confkey) ck join pg_attribute att on att.attrelid = k.confrelid and att.attnum = ck),
          'one_to_one', false
        ) order by k.conname)
        from pg_constraint k join pg_class rc on rc.oid = k.confrelid
        where k.conrelid = c.oid and k.contype = 'f'
      )
    ) order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'enums', (
    select json_object_agg(t.typname, (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid))
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
  ),
  'functions', (
    select json_agg(json_build_object(
      'name', p.proname,
      'args', (
        select json_agg(json_build_object('name', p.proargnames[i], 'type', format_type(p.proargtypes[i - 1], null), 'has_default', i > p.pronargs - p.pronargdefaults) order by i)
        from generate_subscripts(p.proargtypes, 1) g(i0), lateral (select g.i0 + 1 as i) x
      ),
      'returns_table', p.proretset and p.proargmodes is not null,
      'out', (
        select json_agg(json_build_object('name', p.proargnames[i], 'type', format_type(p.proallargtypes[i], null)) order by i)
        from generate_subscripts(p.proallargtypes, 1) i
        where p.proargmodes[i] = 't'
      ),
      'returns', format_type(p.prorettype, null)
    ) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.prorettype <> 'trigger'::regtype
      -- Skip functions that come with an extension (btree_gist's cash_dist and friends).
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  )
);
