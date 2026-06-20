alter table p0plus_points
  alter column points type numeric(10,2)
  using points::numeric;
