-- Seed script: generates realistic mock analytics data for the dashboard
-- Usage: docker exec -i server-postgres-1 psql -U bananalytics -d bananalytics < scripts/seed.sql

-- Get the project ID (uses the first project)
DO $$
DECLARE
  proj_id UUID;
  i INT;
  event_name TEXT;
  event_type TEXT;
  anon_id UUID;
  user_id TEXT;
  session_id UUID;
  ts TIMESTAMPTZ;
  country TEXT;
  country_code TEXT;
  city TEXT;
  lat FLOAT;
  lng FLOAT;
  geo_json JSONB;
  events TEXT[] := ARRAY['button_clicked', 'page_viewed', 'signup_start', 'signup_complete', 'purchase', '$screen', '$app_foreground', '$app_background', 'search', 'add_to_cart'];
  countries TEXT[][] := ARRAY[
    ARRAY['Germany', 'DE', 'Berlin', '52.52', '13.405'],
    ARRAY['Germany', 'DE', 'Munich', '48.135', '11.582'],
    ARRAY['United States', 'US', 'New York', '40.713', '-74.006'],
    ARRAY['United States', 'US', 'San Francisco', '37.775', '-122.419'],
    ARRAY['United Kingdom', 'GB', 'London', '51.507', '-0.128'],
    ARRAY['France', 'FR', 'Paris', '48.857', '2.352'],
    ARRAY['Japan', 'JP', 'Tokyo', '35.682', '139.692'],
    ARRAY['Brazil', 'BR', 'Sao Paulo', '-23.55', '-46.633'],
    ARRAY['Australia', 'AU', 'Sydney', '-33.869', '151.209'],
    ARRAY['India', 'IN', 'Mumbai', '19.076', '72.878']
  ];
  country_idx INT;
  anon_ids UUID[] := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  user_ids TEXT[] := ARRAY['user-001', 'user-002', 'user-003', 'user-004', 'user-005', 'user-006', 'user-007', 'user-008', NULL, NULL, NULL, NULL, NULL, NULL, NULL];
  session_ids UUID[];
BEGIN
  -- Get first project
  SELECT id INTO proj_id FROM projects LIMIT 1;
  IF proj_id IS NULL THEN
    RAISE EXCEPTION 'No project found. Create one first with: curl -X POST http://localhost:8080/v1/projects -H "Content-Type: application/json" -d ''{"name":"My App"}''';
  END IF;

  -- Generate session IDs
  session_ids := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];

  RAISE NOTICE 'Seeding data for project %', proj_id;

  -- Generate ~2000 events over the last 7 days
  FOR i IN 1..2000 LOOP
    -- Random timestamp in last 7 days (more recent = more events)
    ts := NOW() - (random() * interval '7 days') * (0.3 + random() * 0.7);

    -- Random event
    event_name := events[1 + floor(random() * array_length(events, 1))::int];

    -- Event type
    IF event_name = '$screen' THEN
      event_type := 'screen';
    ELSIF event_name = '$identify' THEN
      event_type := 'identify';
    ELSE
      event_type := 'track';
    END IF;

    -- Random user
    anon_id := anon_ids[1 + floor(random() * array_length(anon_ids, 1))::int];
    user_id := user_ids[1 + floor(random() * array_length(user_ids, 1))::int];
    session_id := session_ids[1 + floor(random() * array_length(session_ids, 1))::int];

    -- Random country
    country_idx := 1 + floor(random() * array_length(countries, 1))::int;
    country := countries[country_idx][1];
    country_code := countries[country_idx][2];
    city := countries[country_idx][3];
    lat := countries[country_idx][4]::float + (random() - 0.5) * 2;
    lng := countries[country_idx][5]::float + (random() - 0.5) * 2;

    geo_json := jsonb_build_object(
      'country', country,
      'country_code', country_code,
      'city', city,
      'lat', lat,
      'lng', lng
    );

    -- Insert event
    INSERT INTO events (
      message_id, project_id, event, type, properties, context,
      user_id, anonymous_id, client_ts, server_ts, session_id, created_at, geo
    ) VALUES (
      gen_random_uuid()::text,
      proj_id,
      event_name,
      event_type,
      CASE event_name
        WHEN 'button_clicked' THEN jsonb_build_object('button', (ARRAY['signup', 'login', 'purchase', 'share', 'settings'])[1 + floor(random()*5)::int])
        WHEN 'page_viewed' THEN jsonb_build_object('page', (ARRAY['/home', '/pricing', '/about', '/docs', '/blog'])[1 + floor(random()*5)::int])
        WHEN '$screen' THEN jsonb_build_object('name', (ARRAY['HomeScreen', 'ProfileScreen', 'SettingsScreen', 'FeedScreen'])[1 + floor(random()*4)::int])
        WHEN 'purchase' THEN jsonb_build_object('amount', round((random() * 100)::numeric, 2), 'currency', 'USD')
        WHEN 'search' THEN jsonb_build_object('query', (ARRAY['analytics', 'dashboard', 'pricing', 'docs'])[1 + floor(random()*4)::int])
        ELSE '{}'::jsonb
      END,
      jsonb_build_object('session', jsonb_build_object('id', session_id)),
      user_id,
      anon_id,
      ts,
      ts + interval '100 milliseconds',
      session_id::text,
      ts,
      geo_json
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Seeding complete. Check with: SELECT COUNT(*) FROM events WHERE project_id = ''%''', proj_id;
END $$;

-- Show summary
SELECT
  COUNT(*) as total_events,
  COUNT(DISTINCT anonymous_id) as unique_users,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(DISTINCT event) as event_types,
  MIN(created_at)::date as first_event,
  MAX(created_at)::date as last_event
FROM events;
