-- Public bucket for store logos and banners.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-media',
  'store-media',
  TRUE,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Store media readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-media');

CREATE POLICY "Store owners upload media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'store-media'
  AND EXISTS (
    SELECT 1
    FROM public.stores
    WHERE stores.id::text = (storage.foldername(name))[1]
      AND stores.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners update media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'store-media'
  AND EXISTS (
    SELECT 1
    FROM public.stores
    WHERE stores.id::text = (storage.foldername(name))[1]
      AND stores.owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'store-media'
  AND EXISTS (
    SELECT 1
    FROM public.stores
    WHERE stores.id::text = (storage.foldername(name))[1]
      AND stores.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners delete media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'store-media'
  AND EXISTS (
    SELECT 1
    FROM public.stores
    WHERE stores.id::text = (storage.foldername(name))[1]
      AND stores.owner_id = auth.uid()
  )
);
