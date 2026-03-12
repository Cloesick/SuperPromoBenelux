CREATE TABLE IF NOT EXISTS sp_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_name TEXT NOT NULL,
  path TEXT,
  retailer TEXT,
  destination_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  user_agent TEXT,
  referrer TEXT
);

CREATE INDEX IF NOT EXISTS sp_events_created_at_idx ON sp_events (created_at DESC);
CREATE INDEX IF NOT EXISTS sp_events_event_name_idx ON sp_events (event_name);
CREATE INDEX IF NOT EXISTS sp_events_utm_content_idx ON sp_events (utm_content);
