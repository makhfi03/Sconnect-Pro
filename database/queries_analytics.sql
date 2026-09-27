SELECT 
  a.title,
  a.max_capacity,
  COUNT(r.id) FILTER (WHERE r.status = 'confirmed') AS confirmed,
  ROUND(
    (COUNT(r.id) FILTER (WHERE r.status = 'confirmed')::numeric / a.max_capacity) * 100, 1
  ) AS fill_rate_percent
FROM activities a
LEFT JOIN registrations r ON a.id = r.activity_id
GROUP BY a.id, a.title, a.max_capacity
ORDER BY fill_rate_percent DESC;

SELECT 
  ass.name AS association_name,
  COUNT(r.id) AS total_registrations,
  COALESCE(SUM(r.final_price), 0) AS total_revenue
FROM associations ass
JOIN activities a ON ass.id = a.association_id
LEFT JOIN registrations r ON a.id = r.activity_id AND r.status = 'confirmed'
GROUP BY ass.id, ass.name
ORDER BY total_revenue DESC;

SELECT 
  wl.status,
  COUNT(*) AS count
FROM waiting_list wl
GROUP BY wl.status;

SELECT 
  m.firstname, m.lastname, m.is_resident,
  wl.score, wl.status, wl.created_at,
  a.title AS activity_title
FROM waiting_list wl
JOIN members m ON wl.member_id = m.id
JOIN activities a ON wl.activity_id = a.id
WHERE wl.status IN ('waiting', 'promoted_pending')
ORDER BY wl.score DESC, wl.created_at ASC;