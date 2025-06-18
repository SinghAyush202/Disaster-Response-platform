-- Enable PostGIS for geospatial functions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table: disasters
CREATE TABLE public.disasters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    location_name TEXT NOT NULL,
    location GEOGRAPHY(Point, 4326), -- Srid 4326 is for WGS84 (lat/lon)
    description TEXT,
    tags TEXT[], -- Array of tags like 'flood', 'earthquake'
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    audit_trail JSONB DEFAULT '[]'::jsonb -- Store as JSONB array for audit logs
);

-- Geospatial index for faster location-based queries on disasters
CREATE INDEX disasters_location_idx ON public.disasters USING GIST (location);
-- GIN index for faster array queries on tags
CREATE INDEX disasters_tags_idx ON public.disasters USING GIN (tags);
-- Index for owner_id
CREATE INDEX disasters_owner_id_idx ON public.disasters (owner_id);


-- Table: reports (User-submitted reports related to a disaster)
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_id UUID REFERENCES public.disasters(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    verification_status TEXT DEFAULT 'pending' NOT NULL, -- e.g., 'pending', 'verified', 'unverified'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Index for disaster_id on reports
CREATE INDEX reports_disaster_id_idx ON public.reports (disaster_id);
-- Index for user_id on reports
CREATE INDEX reports_user_id_idx ON public.reports (user_id);


-- Table: resources (Available resources like shelters, aid, etc.)
CREATE TABLE public.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_id UUID REFERENCES public.disasters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location_name TEXT NOT NULL,
    location GEOGRAPHY(Point, 4326), -- Srid 4326 for WGS84 (lat/lon)
    type TEXT NOT NULL, -- e.g., 'shelter', 'food', 'medical'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Geospatial index for faster location-based queries on resources
CREATE INDEX resources_location_idx ON public.resources USING GIST (location);
-- Index for disaster_id on resources
CREATE INDEX resources_disaster_id_idx ON public.resources (disaster_id);
-- Index for type on resources
CREATE INDEX resources_type_idx ON public.resources (type);


-- Table: cache (For caching external API responses)
CREATE TABLE public.cache (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Function to find nearby resources for a specific disaster
CREATE OR REPLACE FUNCTION find_nearby_resources(
    disaster_id_param UUID,
    target_point GEOMETRY(Point, 4326),
    max_distance_meters INT
)
RETURNS TABLE (
    id UUID,
    disaster_id UUID,
    name TEXT,
    location_name TEXT,
    location GEOGRAPHY,
    type TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.disaster_id,
        r.name,
        r.location_name,
        r.location,
        r.type,
        r.created_at
    FROM
        public.resources AS r
    WHERE
        r.disaster_id = disaster_id_param AND
        ST_DWithin(r.location, target_point::GEOGRAPHY, max_distance_meters);
END;
$$;