create table if not exists public.retailer_folder_fingerprints (
	retailer_slug text primary key,
	fingerprint text not null,
	source text not null,
	embed_url text null,
	pdf_url text null,
	updated_at timestamptz not null default now()
);

create table if not exists public.scrape_runs (
	id bigserial primary key,
	run_id text not null,
	retailer_slug text not null,
	status text not null,
	message text null,
	fingerprint text null,
	embed_url text null,
	pdf_url text null,
	scraped_data jsonb null,
	started_at timestamptz not null default now(),
	finished_at timestamptz null
);

create index if not exists scrape_runs_retailer_started_at_idx
	on public.scrape_runs (retailer_slug, started_at desc);

create index if not exists scrape_runs_run_id_idx
	on public.scrape_runs (run_id);
