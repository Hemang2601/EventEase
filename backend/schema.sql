--
-- PostgreSQL database dump
--

\restrict UTCijGfWguPX2GCRogPQmNuyFB2EJfVgIm50cYear4qDeunAM80d1TmK76xP8l1

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'organizer',
    'student'
);


--
-- Name: admin_decide_edit_request(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_decide_edit_request(_request_id uuid, _approve boolean, _note text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: admin_dismiss_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_dismiss_request(_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.profiles SET wants_organizer = false WHERE id = _user_id;
END $$;


--
-- Name: admin_set_role(uuid, public.app_role, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_role(_user_id uuid, _role public.app_role, _enabled boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN json_build_object('ok',false,'error','Admins only'); END IF;
  IF _role = 'student' THEN RETURN json_build_object('ok',false,'error','Student role is permanent'); END IF;
  IF NOT _enabled AND _role = 'admin' AND _user_id = auth.uid() THEN
    RETURN json_build_object('ok',false,'error','You cannot remove your own admin role');
  END IF;
  IF _enabled THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role) ON CONFLICT DO NOTHING;
    IF _role = 'organizer' THEN UPDATE public.profiles SET wants_organizer = false WHERE id = _user_id; END IF;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
  RETURN json_build_object('ok',true);
END $$;


--
-- Name: assign_participant_zone(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_participant_zone() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
END $$;


--
-- Name: can_manage_event(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_event(_event_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND owner_id = auth.uid()))
$$;


--
-- Name: cancel_registration(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_registration(_participant_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE p public.participants; e public.events;
BEGIN
  SELECT * INTO p FROM public.participants WHERE id = _participant_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owns_pass(p) THEN RETURN json_build_object('ok',false,'error','Pass not found'); END IF;
  SELECT * INTO e FROM public.events WHERE id = p.event_id;
  IF p.checked_in_at IS NOT NULL THEN RETURN json_build_object('ok',false,'error','Already checked in'); END IF;
  IF e.starts_at <= now() THEN RETURN json_build_object('ok',false,'error','Event has started — changes are locked'); END IF;
  UPDATE public.scan_logs SET participant_id = NULL WHERE participant_id = p.id;
  DELETE FROM public.participants WHERE id = p.id;
  RETURN json_build_object('ok',true);
END $$;


--
-- Name: check_in_participant(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_in_participant(_event_id uuid, _code text, _gate text DEFAULT 'Gate 01'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE p public.participants; ev public.events; other record; c text := left(upper(trim(coalesce(_code,''))),64);
  g text := left(coalesce(nullif(trim(_gate),''),'Gate 01'), 40); opens timestamptz; manager boolean; zname text;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = _event_id;
  IF NOT FOUND THEN RETURN json_build_object('status','forbidden'); END IF;
  manager := ev.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin');
  IF NOT manager AND NOT public.is_event_staff(_event_id) THEN RETURN json_build_object('status','forbidden'); END IF;
  opens := ev.starts_at - make_interval(mins => ev.checkin_opens_minutes);
  IF now() < opens THEN
    INSERT INTO public.scan_logs (event_id, code, result, gate, scanned_by) VALUES (_event_id, c, 'too_early', g, auth.uid());
    RETURN json_build_object('status','too_early','code',c,'opens_at',opens);
  END IF;
  SELECT * INTO p FROM public.participants WHERE event_id = _event_id AND code = c FOR UPDATE;
  IF NOT FOUND THEN
    SELECT p2.full_name, e2.title INTO other FROM public.participants p2 JOIN public.events e2 ON e2.id = p2.event_id WHERE p2.code = c AND p2.event_id <> _event_id LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.scan_logs (event_id, code, result, gate, participant_name, scanned_by) VALUES (_event_id, c, 'wrong_event', g, other.full_name, auth.uid());
      RETURN json_build_object('status','wrong_event','full_name',other.full_name,'code',c,'event',other.title);
    END IF;
    INSERT INTO public.scan_logs (event_id, code, result, gate, scanned_by) VALUES (_event_id, c, 'invalid', g, auth.uid());
    RETURN json_build_object('status','invalid','code',c);
  END IF;
  SELECT name INTO zname FROM public.event_zones WHERE id = p.zone_id;
  IF zname IS NOT NULL THEN g := zname; END IF;
  IF NOT manager AND (p.zone_id IS NULL OR NOT public.is_zone_staff(p.zone_id)) THEN
    INSERT INTO public.scan_logs (event_id, participant_id, code, result, gate, participant_name, scanned_by) VALUES (_event_id, p.id, c, 'wrong_zone', g, p.full_name, auth.uid());
    RETURN json_build_object('status','wrong_zone','full_name',p.full_name,'code',p.code,'zone',coalesce(zname,'Unassigned'));
  END IF;
  IF p.checked_in_at IS NOT NULL THEN
    INSERT INTO public.scan_logs (event_id, participant_id, code, result, gate, participant_name, scanned_by) VALUES (_event_id, p.id, c, 'duplicate', g, p.full_name, auth.uid());
    RETURN json_build_object('status','duplicate','full_name',p.full_name,'code',p.code,'checked_in_at',p.checked_in_at,'gate',p.checked_in_gate);
  END IF;
  UPDATE public.participants SET checked_in_at = now(), checked_in_gate = g WHERE id = p.id RETURNING * INTO p;
  INSERT INTO public.scan_logs (event_id, participant_id, code, result, gate, participant_name, scanned_by) VALUES (_event_id, p.id, c, 'success', g, p.full_name, auth.uid());
  RETURN json_build_object('status','success','full_name',p.full_name,'code',p.code,'checked_in_at',p.checked_in_at,'gate',g);
END $$;


--
-- Name: enforce_event_edit_lock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_event_edit_lock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: event_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.event_stats(_event_id uuid) RETURNS TABLE(registered bigint, checked_in bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT count(*), count(checked_in_at) FROM public.participants WHERE event_id = _event_id
$$;


--
-- Name: get_ticket(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_ticket(_code text) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT json_build_object('code', p.code, 'full_name', p.full_name, 'checked_in_at', p.checked_in_at,
    'event_id', e.id, 'event_title', e.title, 'venue', e.venue, 'starts_at', e.starts_at, 'category', e.category,
    'zone', (SELECT name FROM public.event_zones WHERE id = p.zone_id))
  FROM public.participants p JOIN public.events e ON e.id = p.event_id
  WHERE p.code = upper(trim(_code)) LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, wants_organizer)
  VALUES (NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
          coalesce(NEW.raw_user_meta_data->>'account_type','') = 'organizer')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'), (NEW.id, 'organizer') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


--
-- Name: is_event_staff(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_event_staff(_event_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.zone_staff s JOIN public.event_zones z ON z.id = s.zone_id WHERE z.event_id = _event_id AND s.user_id = auth.uid())
$$;


--
-- Name: is_zone_staff(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_zone_staff(_zone_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.zone_staff WHERE zone_id = _zone_id AND user_id = auth.uid())
$$;


--
-- Name: list_staff_candidates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_staff_candidates() RETURNS TABLE(id uuid, full_name text, email text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p.id, p.full_name, p.email FROM public.profiles p
  WHERE (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'organizer'))
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role IN ('organizer','admin'))
  ORDER BY p.full_name
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    department text,
    code text NOT NULL,
    checked_in_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_in_gate text,
    user_id uuid,
    zone_id uuid
);


--
-- Name: owns_pass(public.participants); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_pass(_p public.participants) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL AND (_p.user_id = auth.uid() OR lower(_p.email) = lower(coalesce(auth.jwt()->>'email','')))
$$;


--
-- Name: register_participant(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_participant(_event_id uuid, _full_name text, _email text, _phone text, _department text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _event public.events%ROWTYPE; _count integer; _code text; _staff boolean; _clash text;
BEGIN
  SELECT * INTO _event FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Event not found'); END IF;
  _staff := auth.uid() IS NOT NULL AND (_event.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  IF NOT _event.is_open AND NOT _staff THEN RETURN json_build_object('ok', false, 'error', 'Registrations are closed for this event'); END IF;
  IF _event.starts_at <= now() AND NOT _staff THEN RETURN json_build_object('ok', false, 'error', 'This event has already started'); END IF;
  IF EXISTS (SELECT 1 FROM public.participants WHERE event_id = _event_id AND (lower(email) = lower(_email) OR (NOT _staff AND auth.uid() IS NOT NULL AND user_id = auth.uid()))) THEN
    RETURN json_build_object('ok', false, 'error', 'This email is already registered');
  END IF;
  SELECT e.title INTO _clash FROM public.participants p JOIN public.events e ON e.id = p.event_id
  WHERE e.id <> _event_id
    AND (e.starts_at AT TIME ZONE 'Asia/Kolkata')::date = (_event.starts_at AT TIME ZONE 'Asia/Kolkata')::date
    AND (lower(p.email) = lower(_email) OR (NOT _staff AND auth.uid() IS NOT NULL AND p.user_id = auth.uid()))
  LIMIT 1;
  IF _clash IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'error', format('Already registered for "%s" on the same date — one event per day', _clash));
  END IF;
  SELECT count(*) INTO _count FROM public.participants WHERE event_id = _event_id;
  IF _count >= _event.capacity THEN RETURN json_build_object('ok', false, 'error', 'Event is full'); END IF;
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.participants (event_id, full_name, email, phone, department, code, user_id)
  VALUES (_event_id, _full_name, _email, _phone, _department, _code, CASE WHEN _staff THEN NULL ELSE auth.uid() END);
  RETURN json_build_object('ok', true, 'code', _code);
END; $$;


--
-- Name: request_event_edit(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_event_edit(_event_id uuid, _reason text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare e public.events; r text := left(trim(coalesce(_reason,'')), 500);
begin
  select * into e from public.events where id = _event_id;
  if not found or (e.owner_id <> auth.uid() and not public.is_event_staff(_event_id)) then
    return json_build_object('ok',false,'error','Only the event team can request changes');
  end if;
  if length(r) < 5 then return json_build_object('ok',false,'error','Please describe what you want to change'); end if;
  if e.edit_unlocked then return json_build_object('ok',false,'error','Editing is already unlocked'); end if;
  if exists (select 1 from public.event_edit_requests where event_id = _event_id and status = 'pending') then
    return json_build_object('ok',false,'error','A request is already waiting for admin approval');
  end if;
  insert into public.event_edit_requests (event_id, requester_id, reason) values (_event_id, auth.uid(), r);
  return json_build_object('ok',true);
end $$;


--
-- Name: set_participant_zone(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_participant_zone(_participant_id uuid, _zone_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE p public.participants;
BEGIN
  SELECT * INTO p FROM public.participants WHERE id = _participant_id;
  IF NOT FOUND OR NOT public.can_manage_event(p.event_id) THEN RETURN json_build_object('ok',false,'error','Not allowed'); END IF;
  IF _zone_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.event_zones WHERE id = _zone_id AND event_id = p.event_id) THEN
    RETURN json_build_object('ok',false,'error','Zone not in this event'); END IF;
  UPDATE public.participants SET zone_id = _zone_id WHERE id = p.id;
  RETURN json_build_object('ok',true);
END $$;


--
-- Name: switch_registration(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.switch_registration(_participant_id uuid, _new_event_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE p public.participants; e public.events; n public.events; _count int; _code text; _clash text;
BEGIN
  SELECT * INTO p FROM public.participants WHERE id = _participant_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owns_pass(p) THEN RETURN json_build_object('ok',false,'error','Pass not found'); END IF;
  IF p.event_id = _new_event_id THEN RETURN json_build_object('ok',false,'error','Pick a different event'); END IF;
  SELECT * INTO e FROM public.events WHERE id = p.event_id;
  IF p.checked_in_at IS NOT NULL THEN RETURN json_build_object('ok',false,'error','Already checked in'); END IF;
  IF e.starts_at <= now() THEN RETURN json_build_object('ok',false,'error','Event has started — changes are locked'); END IF;
  SELECT * INTO n FROM public.events WHERE id = _new_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok',false,'error','Event not found'); END IF;
  IF NOT n.is_open THEN RETURN json_build_object('ok',false,'error','Registrations are closed for that event'); END IF;
  IF n.starts_at <= now() THEN RETURN json_build_object('ok',false,'error','That event has already started'); END IF;
  IF EXISTS (SELECT 1 FROM public.participants WHERE event_id = n.id AND lower(email) = lower(p.email)) THEN
    RETURN json_build_object('ok',false,'error','You are already registered for that event');
  END IF;
  SELECT ev.title INTO _clash FROM public.participants q JOIN public.events ev ON ev.id = q.event_id
  WHERE q.id <> p.id AND ev.id <> n.id
    AND (ev.starts_at AT TIME ZONE 'Asia/Kolkata')::date = (n.starts_at AT TIME ZONE 'Asia/Kolkata')::date
    AND (lower(q.email) = lower(p.email) OR (auth.uid() IS NOT NULL AND q.user_id = auth.uid()))
  LIMIT 1;
  IF _clash IS NOT NULL THEN
    RETURN json_build_object('ok',false,'error',format('You already have a pass for "%s" on that date — one event per day', _clash));
  END IF;
  SELECT count(*) INTO _count FROM public.participants WHERE event_id = n.id;
  IF _count >= n.capacity THEN RETURN json_build_object('ok',false,'error','That event is full'); END IF;
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  UPDATE public.scan_logs SET participant_id = NULL WHERE participant_id = p.id;
  UPDATE public.participants SET event_id = n.id, code = _code, zone_id = NULL, checked_in_gate = NULL, created_at = now(), user_id = coalesce(user_id, auth.uid()) WHERE id = p.id;
  RETURN json_build_object('ok',true,'code',_code);
END $$;


--
-- Name: validate_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE clash text; regs int;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.starts_at < now() THEN
    RAISE EXCEPTION 'Event date & time cannot be in the past' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.starts_at IS DISTINCT FROM OLD.starts_at AND NEW.starts_at < now() AND OLD.starts_at >= now() THEN
    RAISE EXCEPTION 'Event date & time cannot be moved into the past' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
    SELECT title INTO clash FROM public.events
    WHERE id <> NEW.id AND (starts_at AT TIME ZONE 'Asia/Kolkata')::date = (NEW.starts_at AT TIME ZONE 'Asia/Kolkata')::date
    LIMIT 1;
    IF clash IS NOT NULL THEN
      RAISE EXCEPTION 'Another event ("%") is already scheduled on this date. Pick a different date.', clash USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.capacity < OLD.capacity THEN
    SELECT count(*) INTO regs FROM public.participants WHERE event_id = NEW.id;
    IF NEW.capacity < regs THEN
      RAISE EXCEPTION 'Capacity cannot be lower than the % students already registered', regs USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: zone_overview(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.zone_overview(_event_id uuid) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.name), '[]'::json) FROM (
    SELECT z.id, z.name, z.capacity,
      (SELECT count(*) FROM public.participants p WHERE p.zone_id = z.id) AS registered,
      (SELECT count(*) FROM public.participants p WHERE p.zone_id = z.id AND p.checked_in_at IS NOT NULL) AS checked_in,
      (SELECT count(*) FROM public.scan_logs l WHERE l.event_id = z.event_id AND l.gate = z.name AND l.result <> 'success') AS rejected,
      coalesce((SELECT json_agg(json_build_object('user_id', s.user_id, 'full_name', pr.full_name, 'email', pr.email,
          'scans', (SELECT count(*) FROM public.scan_logs l WHERE l.event_id = z.event_id AND l.scanned_by = s.user_id AND l.result = 'success')))
        FROM public.zone_staff s LEFT JOIN public.profiles pr ON pr.id = s.user_id WHERE s.zone_id = z.id), '[]'::json) AS staff,
      public.is_zone_staff(z.id) AS mine
    FROM public.event_zones z
    WHERE z.event_id = _event_id AND (public.can_manage_event(_event_id) OR public.is_zone_staff(z.id))
  ) t
$$;


--
-- Name: event_edit_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_edit_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_note text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    name text NOT NULL,
    capacity integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_zones_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT event_zones_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 60)))
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    venue text,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    capacity integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'Technology'::text NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    checkin_opens_minutes integer DEFAULT 60 NOT NULL,
    cover_url text,
    host_photo_url text,
    host_name text,
    edit_unlocked boolean DEFAULT false NOT NULL,
    CONSTRAINT events_capacity_check CHECK (((capacity > 0) AND (capacity <= 100000)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    wants_organizer boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scan_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scan_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    participant_id uuid,
    code text NOT NULL,
    result text NOT NULL,
    gate text,
    participant_name text,
    scanned_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    email text NOT NULL,
    full_name text,
    event_id uuid,
    subject text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    reply text,
    replied_by uuid,
    replied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_tickets_message_check CHECK (((char_length(message) >= 5) AND (char_length(message) <= 3000))),
    CONSTRAINT support_tickets_reply_check CHECK (((reply IS NULL) OR (char_length(reply) <= 3000))),
    CONSTRAINT support_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'answered'::text, 'closed'::text]))),
    CONSTRAINT support_tickets_subject_check CHECK (((char_length(subject) >= 3) AND (char_length(subject) <= 150)))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: zone_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zone_staff (
    zone_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_edit_requests event_edit_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_edit_requests
    ADD CONSTRAINT event_edit_requests_pkey PRIMARY KEY (id);


--
-- Name: event_zones event_zones_event_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_zones
    ADD CONSTRAINT event_zones_event_id_name_key UNIQUE (event_id, name);


--
-- Name: event_zones event_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_zones
    ADD CONSTRAINT event_zones_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: participants participants_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_code_key UNIQUE (code);


--
-- Name: participants participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: scan_logs scan_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scan_logs
    ADD CONSTRAINT scan_logs_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: zone_staff zone_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_staff
    ADD CONSTRAINT zone_staff_pkey PRIMARY KEY (zone_id, user_id);


--
-- Name: event_edit_requests_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_edit_requests_event_id_idx ON public.event_edit_requests USING btree (event_id);


--
-- Name: participants_event_email_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX participants_event_email_uidx ON public.participants USING btree (event_id, lower(email));


--
-- Name: participants_event_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX participants_event_email_unique ON public.participants USING btree (event_id, lower(email));


--
-- Name: participants_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX participants_event_idx ON public.participants USING btree (event_id);


--
-- Name: participants_event_user_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX participants_event_user_unique ON public.participants USING btree (event_id, user_id) WHERE (user_id IS NOT NULL);


--
-- Name: participants_zone_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX participants_zone_id_idx ON public.participants USING btree (zone_id);


--
-- Name: scan_logs_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scan_logs_event_idx ON public.scan_logs USING btree (event_id, created_at DESC);


--
-- Name: zone_staff_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zone_staff_user_id_idx ON public.zone_staff USING btree (user_id);


--
-- Name: events events_edit_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER events_edit_lock BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.enforce_event_edit_lock();


--
-- Name: events events_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER events_validate BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.validate_event();


--
-- Name: participants participants_assign_zone; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER participants_assign_zone BEFORE INSERT ON public.participants FOR EACH ROW EXECUTE FUNCTION public.assign_participant_zone();


--
-- Name: participants participants_reassign_zone; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER participants_reassign_zone BEFORE UPDATE OF event_id ON public.participants FOR EACH ROW EXECUTE FUNCTION public.assign_participant_zone();


--
-- Name: event_edit_requests event_edit_requests_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_edit_requests
    ADD CONSTRAINT event_edit_requests_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_zones event_zones_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_zones
    ADD CONSTRAINT event_zones_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: participants participants_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: participants participants_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.event_zones(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: scan_logs scan_logs_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scan_logs
    ADD CONSTRAINT scan_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: scan_logs scan_logs_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scan_logs
    ADD CONSTRAINT scan_logs_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: zone_staff zone_staff_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_staff
    ADD CONSTRAINT zone_staff_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.event_zones(id) ON DELETE CASCADE;


--
-- Name: participants Admins delete participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete participants" ON public.participants FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: participants Admins update participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update participants" ON public.participants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: participants Admins view participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view participants" ON public.participants FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: scan_logs Admins view scan logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view scan logs" ON public.scan_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: events Anyone can view events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view events" ON public.events FOR SELECT TO authenticated, anon USING (true);


--
-- Name: event_zones Anyone can view zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view zones" ON public.event_zones FOR SELECT TO authenticated, anon USING (true);


--
-- Name: zone_staff Managers assign staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers assign staff" ON public.zone_staff FOR INSERT TO authenticated WITH CHECK ((public.can_manage_event(( SELECT event_zones.event_id
   FROM public.event_zones
  WHERE (event_zones.id = zone_staff.zone_id))) AND (public.has_role(user_id, 'organizer'::public.app_role) OR public.has_role(user_id, 'admin'::public.app_role))));


--
-- Name: event_zones Managers delete zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers delete zones" ON public.event_zones FOR DELETE TO authenticated USING (public.can_manage_event(event_id));


--
-- Name: event_zones Managers insert zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers insert zones" ON public.event_zones FOR INSERT TO authenticated WITH CHECK (public.can_manage_event(event_id));


--
-- Name: zone_staff Managers remove staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers remove staff" ON public.zone_staff FOR DELETE TO authenticated USING (public.can_manage_event(( SELECT event_zones.event_id
   FROM public.event_zones
  WHERE (event_zones.id = zone_staff.zone_id))));


--
-- Name: event_zones Managers update zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers update zones" ON public.event_zones FOR UPDATE TO authenticated USING (public.can_manage_event(event_id));


--
-- Name: events Organizers insert events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organizers insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (((auth.uid() = owner_id) AND (public.has_role(auth.uid(), 'organizer'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: participants Owners delete participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners delete participants" ON public.participants FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = participants.event_id) AND (e.owner_id = auth.uid())))));


--
-- Name: events Owners or admin delete events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners or admin delete events" ON public.events FOR DELETE TO authenticated USING (((auth.uid() = owner_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: participants Owners update participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners update participants" ON public.participants FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = participants.event_id) AND (e.owner_id = auth.uid())))));


--
-- Name: participants Owners view participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners view participants" ON public.participants FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = participants.event_id) AND (e.owner_id = auth.uid())))));


--
-- Name: scan_logs Owners view scan logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners view scan logs" ON public.scan_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = scan_logs.event_id) AND (e.owner_id = auth.uid())))));


--
-- Name: events Owners, staff or admin update events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners, staff or admin update events" ON public.events FOR UPDATE TO authenticated USING (((auth.uid() = owner_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR (edit_unlocked AND public.is_event_staff(id)))) WITH CHECK (((auth.uid() = owner_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_event_staff(id)));


--
-- Name: participants Participants view own passes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants view own passes" ON public.participants FOR SELECT TO authenticated USING ((lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: support_tickets Staff reply to tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff reply to tickets" ON public.support_tickets FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (public.has_role(auth.uid(), 'organizer'::public.app_role) AND ((event_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = support_tickets.event_id) AND (e.owner_id = auth.uid()))))))));


--
-- Name: support_tickets Students create own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students create own tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (status = 'open'::text) AND (reply IS NULL)));


--
-- Name: participants Students view own registrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view own registrations" ON public.participants FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles Update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: user_roles Users view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: event_edit_requests View own or admin edit requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View own or admin edit requests" ON public.event_edit_requests FOR SELECT TO authenticated USING (((requester_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: zone_staff View own or managed staff rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View own or managed staff rows" ON public.zone_staff FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.can_manage_event(( SELECT event_zones.event_id
   FROM public.event_zones
  WHERE (event_zones.id = zone_staff.zone_id)))));


--
-- Name: support_tickets View own or managed tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View own or managed tickets" ON public.support_tickets FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR (public.has_role(auth.uid(), 'organizer'::public.app_role) AND ((event_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = support_tickets.event_id) AND (e.owner_id = auth.uid()))))))));


--
-- Name: profiles View own profile or admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View own profile or admin" ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: scan_logs Zone staff view event scan logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Zone staff view event scan logs" ON public.scan_logs FOR SELECT TO authenticated USING (public.is_event_staff(event_id));


--
-- Name: participants Zone staff view their participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Zone staff view their participants" ON public.participants FOR SELECT TO authenticated USING (((zone_id IS NOT NULL) AND public.is_zone_staff(zone_id)));


--
-- Name: event_edit_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_edit_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: event_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: scan_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: zone_staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zone_staff ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict UTCijGfWguPX2GCRogPQmNuyFB2EJfVgIm50cYear4qDeunAM80d1TmK76xP8l1

