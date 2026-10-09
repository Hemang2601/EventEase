CREATE OR REPLACE FUNCTION public.assign_participant_zone()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.event_id IS NOT DISTINCT FROM OLD.event_id THEN RETURN NEW; END IF;
    NEW.zone_id := NULL;
  END IF;
  IF NEW.zone_id IS NULL THEN
    SELECT z.id INTO NEW.zone_id FROM public.event_zones z
    WHERE z.event_id = NEW.event_id
      AND (z.capacity IS NULL OR (SELECT count(*) FROM public.participants p WHERE p.zone_id = z.id) < z.capacity)
    ORDER BY (SELECT count(*) FROM public.participants p WHERE p.zone_id = z.id), z.name LIMIT 1;
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS participants_reassign_zone ON public.participants;
CREATE TRIGGER participants_reassign_zone BEFORE UPDATE OF event_id ON public.participants
FOR EACH ROW EXECUTE FUNCTION public.assign_participant_zone();