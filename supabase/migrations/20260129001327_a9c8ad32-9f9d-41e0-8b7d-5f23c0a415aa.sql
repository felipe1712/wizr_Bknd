-- Add new entity types: tema and evento
ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'tema';
ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'evento';