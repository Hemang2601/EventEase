ALTER TABLE public.events ADD COLUMN IF NOT EXISTS edit_unlocked boolean NOT NULL DEFAULT false;

CREATE TABLE public.event_edit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.event_edit_requests(event_id);
GRANT SELECT ON public.event_edit_requests TO authenticated;
GRANT ALL ON public.event_edit_requests TO service_role;
ALTER TABLE public.event_edit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own or admin edit requests" ON public.event_edit_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.request_event_edit(_event_id uuid, _reason text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e public.events; r text := left(trim(coalesce(_reason,'')), 500);
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _event_id;
  IF NOT FOUND OR e.owner_id <> auth.uid() THEN RETURN json_build_object('ok',false,'error','Only the event owner can request changes'); END IF;
  IF length(r) < 5 THEN RETURN json_build_object('ok',false,'error','Please describe what you want to change'); END IF;
  IF e.edit_unlocked THEN RETURN json_build_object('ok',false,'error','Editing is already unlocked'); END IF;
  IF EXISTS (SELECT 1 FROM public.event_edit_requests WHERE event_id = _event_id AND status = 'pending') THEN
    RETURN json_build_object('ok',false,'error','A request is already waiting for admin approval'); END IF;
  INSERT INTO public.event_edit_requests (event_id, requester_id, reason) VALUES (_event_id, auth.uid(), r);
  RETURN json_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_decide_edit_request(_request_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE q public.event_edit_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN json_build_object('ok',false,'error','Admins only'); END IF;
  SELECT * INTO q FROM public.event_edit_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND OR q.status <> 'pending' THEN RETURN json_build_object('ok',false,'error','Request already handled'); END IF;
  UPDATE public.event_edit_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    admin_note = nullif(left(trim(coalesce(_note,'')),500),''), decided_at = now() WHERE id = q.id;
  IF _approve THEN UPDATE public.events SET edit_unlocked = true WHERE id = q.event_id; END IF;
  RETURN json_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.enforce_event_edit_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  IF NEW.edit_unlocked AND NOT OLD.edit_unlocked THEN
    RAISE EXCEPTION 'Only an admin can unlock editing' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.title, NEW.description, NEW.venue, NEW.starts_at, NEW.capacity, NEW.category, NEW.checkin_opens_minutes, NEW.cover_url, NEW.host_photo_url, NEW.host_name)
     IS DISTINCT FROM (OLD.title, OLD.description, OLD.venue, OLD.starts_at, OLD.capacity, OLD.category, OLD.checkin_opens_minutes, OLD.cover_url, OLD.host_photo_url, OLD.host_name) THEN
    IF NOT OLD.edit_unlocked THEN
      RAISE EXCEPTION 'Editing is locked. Request permission from the admin first.' USING ERRCODE = 'P0001';
    END IF;
    NEW.edit_unlocked := false;
    UPDATE public.event_edit_requests SET status = 'used' WHERE event_id = NEW.id AND status = 'approved';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER events_edit_lock BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.enforce_event_edit_lock();

REVOKE EXECUTE ON FUNCTION public.request_event_edit(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_decide_edit_request(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_event_edit_lock() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_event_edit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_edit_request(uuid, boolean, text) TO authenticated;