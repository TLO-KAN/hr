--
-- PostgreSQL database dump
--

\restrict pqIuzn9k2PU2KcfZedSWkWFn8lakIgS0crzW6g5Kxw7adOKmMmEmNMxtrka2ZyV

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: calculate_prorated_leave_days(date, character varying, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_prorated_leave_days(p_start_date date, p_employee_type character varying, p_calendar_year integer, OUT entitled_days numeric, OUT pro_rate_percent numeric, OUT calculation_details jsonb) RETURNS record
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_anniversary_date DATE;
  v_months_at_old_rate INT := 0;
  v_months_at_new_rate INT := 0;
  v_old_rate DECIMAL;
  v_new_rate DECIMAL;
  v_policy_old RECORD;
  v_policy_new RECORD;
  v_years_before_anniversary INT;
  v_years_at_anniversary INT;
  v_rounded_days DECIMAL;
  v_start_year INT;
BEGIN
  v_start_year := EXTRACT(YEAR FROM p_start_date)::INT;
  
  -- If hire date is after the calendar year, no entitlement
  IF v_start_year > p_calendar_year THEN
    entitled_days := 0;
    pro_rate_percent := 0;
    calculation_details := jsonb_build_object('error', 'Start date is after calendar year');
    RETURN;
  END IF;
  
  -- Calculate anniversary date in the calendar year
  BEGIN
    v_anniversary_date := make_date(p_calendar_year, EXTRACT(MONTH FROM p_start_date)::INT, EXTRACT(DAY FROM p_start_date)::INT);
  EXCEPTION WHEN OTHERS THEN
    -- Handle Feb 29 in non-leap years
    v_anniversary_date := make_date(p_calendar_year, 2, 28);
  END;
  
  -- Get years of service before anniversary
  v_years_before_anniversary := FLOOR(EXTRACT(DAY FROM (v_anniversary_date - p_start_date)) / 365.25)::INT;
  v_years_at_anniversary := v_years_before_anniversary;
  
  -- Get policy before anniversary
  SELECT * INTO v_policy_old
  FROM leave_policies
  WHERE employee_type = p_employee_type
    AND tenure_year_from <= v_years_before_anniversary
    AND (tenure_year_to IS NULL OR tenure_year_to >= v_years_before_anniversary)
    AND active = true
  ORDER BY tenure_year_from DESC
  LIMIT 1;
  
  -- Get policy at/after anniversary
  SELECT * INTO v_policy_new
  FROM leave_policies
  WHERE employee_type = p_employee_type
    AND tenure_year_from <= v_years_at_anniversary
    AND (tenure_year_to IS NULL OR tenure_year_to >= v_years_at_anniversary)
    AND active = true
  ORDER BY tenure_year_from DESC
  LIMIT 1;
  
  -- Handle cases where no policy found
  IF v_policy_old IS NULL AND v_policy_new IS NULL THEN
    entitled_days := 6;
    pro_rate_percent := 100;
    calculation_details := jsonb_build_object('error', 'No policy found');
    RETURN;
  END IF;
  
  -- If same policy or only old policy exists (hire date after anniversary)
  IF v_policy_old IS NULL OR (v_policy_old IS NOT NULL AND v_policy_new IS NOT NULL AND v_policy_old.id = v_policy_new.id) THEN
    v_old_rate := COALESCE(v_policy_old.annual_leave_quota, v_policy_new.annual_leave_quota);
    
    -- Pro-rate from hire date to end of year
    IF v_start_year = p_calendar_year THEN
      v_months_at_old_rate := EXTRACT(MONTH FROM (DATE(p_calendar_year || '-12-31')::DATE - p_start_date))::INT + 1;
      entitled_days := ROUND((v_old_rate::DECIMAL / 12 * v_months_at_old_rate)::NUMERIC, 2);
      pro_rate_percent := ROUND(((v_months_at_old_rate::DECIMAL * 100) / 12)::NUMERIC, 2);
    ELSE
      -- Full year
      entitled_days := v_old_rate;
      pro_rate_percent := 100;
      v_months_at_old_rate := 12;
    END IF;
  ELSE
    -- Policy changes at anniversary
    IF v_policy_old.annual_leave_quota <> v_policy_new.annual_leave_quota THEN
      v_old_rate := v_policy_old.annual_leave_quota;
      v_new_rate := v_policy_new.annual_leave_quota;
      
      -- Anniversary is after Jan 1 in the same year
      IF v_anniversary_date > DATE(p_calendar_year || '-01-01') THEN
        v_months_at_old_rate := EXTRACT(MONTH FROM v_anniversary_date) - 1;
        v_months_at_new_rate := 12 - v_months_at_old_rate;
        
        -- If hire date is after anniversary, no old rate applies
        IF p_start_date > v_anniversary_date THEN
          v_months_at_old_rate := 0;
          v_months_at_new_rate := 12;
          entitled_days := v_new_rate;
        ELSE
          entitled_days := ROUND((v_old_rate::DECIMAL / 12 * v_months_at_old_rate + v_new_rate::DECIMAL / 12 * v_months_at_new_rate)::NUMERIC, 2);
        END IF;
        pro_rate_percent := ROUND(((v_months_at_old_rate + v_months_at_new_rate)::DECIMAL * 100 / 12)::NUMERIC, 2);
      ELSE
        -- Anniversary already passed, use new rate for entire year
        entitled_days := v_new_rate;
        pro_rate_percent := 100;
        v_months_at_new_rate := 12;
      END IF;
    ELSE
      -- Same quota despite policy change
      entitled_days := v_policy_old.annual_leave_quota;
      pro_rate_percent := 100;
      v_months_at_old_rate := 12;
    END IF;
  END IF;
  
  -- Apply rounding to 0.5 (round down)
  v_rounded_days := FLOOR(entitled_days * 2) / 2;
  entitled_days := v_rounded_days;
  
  -- Build calculation details
  calculation_details := jsonb_build_object(
    'start_date', p_start_date::TEXT,
    'calendar_year', p_calendar_year,
    'anniversary_date', v_anniversary_date::TEXT,
    'years_at_anniversary', v_years_at_anniversary,
    'old_policy_annual_quota', COALESCE(v_policy_old.annual_leave_quota, 0),
    'new_policy_annual_quota', COALESCE(v_policy_new.annual_leave_quota, 0),
    'months_at_old_rate', v_months_at_old_rate,
    'months_at_new_rate', v_months_at_new_rate,
    'pro_rate_percent', pro_rate_percent,
    'final_entitled_days', entitled_days
  );
END;
$$;


--
-- Name: calculate_years_of_service(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_years_of_service(start_date date, reference_date date DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  RETURN FLOOR(EXTRACT(DAY FROM (reference_date - start_date)) / 365.25)::INT;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: leave_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_policies (
    id integer NOT NULL,
    employee_type character varying(50) NOT NULL,
    employee_status character varying(50),
    min_years_of_service integer DEFAULT 0,
    max_years_of_service integer,
    annual_leave_quota integer DEFAULT 6,
    sick_leave_quota integer DEFAULT 30,
    personal_leave_quota integer DEFAULT 6,
    maternity_leave_quota integer DEFAULT 120,
    paternity_leave_quota integer DEFAULT 15,
    is_prorated_first_year boolean DEFAULT true,
    is_prorated boolean DEFAULT false,
    description text,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tenure_year_from integer DEFAULT 0,
    tenure_year_to integer,
    policy_name character varying(255)
);


--
-- Name: get_applicable_leave_policy(character varying, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_applicable_leave_policy(p_employee_type character varying, p_years_of_service integer) RETURNS SETOF public.leave_policies
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT lp.*
  FROM leave_policies lp
  WHERE lp.employee_type = p_employee_type
    AND lp.tenure_year_from <= p_years_of_service
    AND (lp.tenure_year_to IS NULL OR lp.tenure_year_to >= p_years_of_service)
    AND lp.active = true
  ORDER BY lp.tenure_year_from DESC
  LIMIT 1;
END;
$$;


--
-- Name: is_employee_in_probation(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_employee_in_probation(p_employee_id uuid, reference_date date DEFAULT CURRENT_DATE) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_start_date DATE;
  v_days_worked INT;
BEGIN
  SELECT start_date INTO v_start_date
  FROM employees
  WHERE id = p_employee_id;
  
  IF v_start_date IS NULL THEN
    RETURN FALSE;
  END IF;
  
  v_days_worked := EXTRACT(DAY FROM (reference_date - v_start_date))::INT;
  RETURN v_days_worked < 119;
END;
$$;


--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_workflows (
    id integer NOT NULL,
    leave_type character varying(50) DEFAULT 'all'::character varying NOT NULL,
    approval_levels integer DEFAULT 1 NOT NULL,
    min_days integer,
    max_days integer,
    requires_hr boolean DEFAULT false,
    flow_pattern character varying(50) DEFAULT 'supervisor'::character varying,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: approval_workflows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_workflows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_workflows_id_seq OWNED BY public.approval_workflows.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: employee_leave_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_leave_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    leave_type character varying(50) NOT NULL,
    balance_days integer DEFAULT 0,
    year integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    entitled_days numeric(5,2) DEFAULT 0,
    used_days numeric(5,2) DEFAULT 0,
    remaining_days numeric(5,2) DEFAULT 0,
    carried_over_days numeric(5,2) DEFAULT 0,
    pro_rated_percent numeric(5,2) DEFAULT 100,
    is_utilized boolean DEFAULT false,
    notes text,
    accrued_amount numeric(5,2) DEFAULT 0,
    total_entitlement numeric(5,2) DEFAULT 0
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email character varying(255),
    display_name character varying(255),
    first_name character varying(255),
    last_name character varying(255),
    id_card_number character varying(13),
    employment_date date,
    employment_status character varying(50) DEFAULT 'probation'::character varying,
    annual_leave_days integer DEFAULT 15,
    department character varying(100),
    department_id uuid,
    "position" character varying(100),
    manager_id uuid,
    phone character varying(20),
    address text,
    birth_date date,
    gender character varying(20),
    employee_type character varying(50) DEFAULT 'permanent'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    probation_end_date date,
    pro_rate_applied_for_year integer,
    last_leave_calculation_date date,
    start_date date,
    employee_code character varying(50),
    prefix character varying(20),
    position_id uuid,
    end_date date,
    avatar_url character varying(500),
    first_name_en character varying(255),
    last_name_en character varying(255),
    nickname character varying(255),
    annual_leave_quota numeric(5,1),
    manual_leave_override boolean DEFAULT false
);


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    holiday_date date NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: leave_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_attachments (
    id integer NOT NULL,
    leave_request_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: leave_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_attachments_id_seq OWNED BY public.leave_attachments.id;


--
-- Name: leave_balance_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_balance_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    year integer NOT NULL,
    leave_type character varying(50) NOT NULL,
    previous_entitled_days numeric(5,2),
    previous_used_days numeric(5,2),
    previous_remaining_days numeric(5,2),
    new_entitled_days numeric(5,2),
    new_used_days numeric(5,2),
    new_remaining_days numeric(5,2),
    change_reason character varying(255),
    changed_by uuid,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: leave_calculation_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_calculation_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid,
    calculation_type character varying(50) NOT NULL,
    calculation_date date NOT NULL,
    years_of_service integer DEFAULT 0 NOT NULL,
    tenure_year_for_policy integer,
    policy_id integer,
    base_quota numeric(5,2),
    pro_rate_percent numeric(5,2) DEFAULT 100,
    final_entitled_days numeric(5,2),
    calculation_details jsonb,
    calculated_by character varying(50) DEFAULT 'system'::character varying,
    calculated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: leave_entitlement_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_entitlement_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_key character varying(100) NOT NULL,
    config_value character varying(255) NOT NULL,
    data_type character varying(50) DEFAULT 'string'::character varying,
    description text,
    last_updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: leave_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_policies_id_seq OWNED BY public.leave_policies.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    leave_type character varying(50),
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days integer,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying,
    rejection_reason text,
    approver_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    start_time time without time zone,
    end_time time without time zone,
    is_half_day boolean DEFAULT false,
    half_day_period character varying(20),
    approved_at timestamp without time zone
);


--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    is_paid boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department character varying(100),
    role character varying(50),
    email character varying(255),
    notify_on_leave_request boolean DEFAULT true,
    notify_on_approval boolean DEFAULT true,
    notify_on_rejection boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    dept_id uuid,
    leave_type character varying(50),
    to_list text,
    cc_list text,
    bcc_list text,
    is_active boolean DEFAULT true
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) DEFAULT 'info'::character varying,
    is_read boolean DEFAULT false,
    link character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    department_id uuid NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_auth (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    role character varying(50) DEFAULT 'employee'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    assigned_by uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    display_name character varying(255),
    role character varying(50) DEFAULT 'employee'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: approval_workflows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows ALTER COLUMN id SET DEFAULT nextval('public.approval_workflows_id_seq'::regclass);


--
-- Name: leave_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_attachments ALTER COLUMN id SET DEFAULT nextval('public.leave_attachments_id_seq'::regclass);


--
-- Name: leave_policies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_policies ALTER COLUMN id SET DEFAULT nextval('public.leave_policies_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Data for Name: approval_workflows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.approval_workflows (id, leave_type, approval_levels, min_days, max_days, requires_hr, flow_pattern, description, created_at, updated_at) FROM stdin;
2	all	1	1	1	f	supervisor	\N	2026-04-07 04:21:03.204335	2026-04-07 08:24:50.887901
3	all	1	1	\N	f	supervisor	\N	2026-04-07 08:24:58.854446	2026-04-07 08:24:58.854446
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, name, description, created_at, updated_at) FROM stdin;
d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	เทคโนโลยีสารสนเทศ	Information Technology	2026-04-06 15:32:22.460712	2026-04-06 15:32:22.460712
5d6163ad-2a5a-434b-a086-888541b98502	บริหาร	Manager	2026-04-07 04:03:32.661532	2026-04-07 04:03:32.661532
0983a3b8-fd5f-44c7-8c56-a3274952dff5	การตลาด	Sales and Marketing	2026-04-06 15:32:22.460712	2026-04-06 15:32:22.460712
311a1d6b-a22c-4b67-9834-321124f96352	บัญชี/การเงิน	Finance and Accounting	2026-04-06 15:32:22.460712	2026-04-06 15:32:22.460712
\.


--
-- Data for Name: employee_leave_balances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employee_leave_balances (id, employee_id, leave_type, balance_days, year, created_at, updated_at, entitled_days, used_days, remaining_days, carried_over_days, pro_rated_percent, is_utilized, notes, accrued_amount, total_entitlement) FROM stdin;
2ac94baf-8496-41a1-9646-6389900ffe56	c939212d-761e-4b5c-9694-25b8a322a50e	maternity	0	2026	2026-04-20 00:47:24.820479	2026-04-20 00:47:24.820479	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
3df325f1-d743-4ab4-aac5-6b591378dd65	c939212d-761e-4b5c-9694-25b8a322a50e	paternity	0	2026	2026-04-20 00:47:24.820479	2026-04-20 00:47:24.820479	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
1cfbcd6a-fd04-4ce4-b5fb-f6dd69a7fcc4	c939212d-761e-4b5c-9694-25b8a322a50e	annual	0	2027	2026-04-20 00:47:24.820479	2026-04-20 00:47:24.820479	13.00	0.00	13.00	0.00	100.00	f	\N	0.00	0.00
bec714f2-fe18-4b58-9686-e42cda84c983	c939212d-761e-4b5c-9694-25b8a322a50e	sick	0	2027	2026-04-20 00:47:24.820479	2026-04-20 00:47:24.820479	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
6d00440c-c2a6-4a22-a38e-76ecaadd3021	c939212d-761e-4b5c-9694-25b8a322a50e	personal	0	2027	2026-04-20 00:47:24.820479	2026-04-20 00:47:24.820479	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
e6aa6066-553b-4e05-bba7-54f361d1eb04	c939212d-761e-4b5c-9694-25b8a322a50e	maternity	0	2027	2026-04-20 00:47:24.820479	2026-04-20 00:47:24.820479	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
21a0f5b1-b28b-4ef2-882a-15e9dedef1ae	c939212d-761e-4b5c-9694-25b8a322a50e	paternity	0	2027	2026-04-20 00:47:24.820479	2026-04-20 00:47:24.820479	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
c70aeb7c-8a91-4ed4-b44b-fc9d96525d32	7927525e-486f-4a91-a731-bf77c316208d	maternity	0	2026	2026-04-20 02:43:06.762836	2026-04-20 02:43:06.762836	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
6e2182c3-f646-482b-bb7c-dc10e15c607a	7927525e-486f-4a91-a731-bf77c316208d	paternity	0	2026	2026-04-20 02:43:06.762836	2026-04-20 02:43:06.762836	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
aabd8949-080b-412e-8bee-0b7ad104f62f	7927525e-486f-4a91-a731-bf77c316208d	annual	0	2027	2026-04-20 02:43:06.762836	2026-04-20 02:43:06.762836	8.00	0.00	8.00	0.00	100.00	f	\N	0.00	0.00
373cb6f8-ee57-4b4e-b906-67cf50d3da5a	7927525e-486f-4a91-a731-bf77c316208d	sick	0	2027	2026-04-20 02:43:06.762836	2026-04-20 02:43:06.762836	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
543c9c1b-23d4-4fec-86ce-640ea5212616	7927525e-486f-4a91-a731-bf77c316208d	personal	0	2027	2026-04-20 02:43:06.762836	2026-04-20 02:43:06.762836	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
2f5ada6c-677c-4da5-b405-8ecc578370ea	7927525e-486f-4a91-a731-bf77c316208d	maternity	0	2027	2026-04-20 02:43:06.762836	2026-04-20 02:43:06.762836	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
d3263e90-9436-4fdf-baab-9978d53bd259	7927525e-486f-4a91-a731-bf77c316208d	paternity	0	2027	2026-04-20 02:43:06.762836	2026-04-20 02:43:06.762836	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
c7fa700e-3f8a-4753-b89a-87fc25c9519a	7927525e-486f-4a91-a731-bf77c316208d	annual	0	2026	2026-04-20 02:43:06.762836	2026-04-20 02:43:06.826309	6.00	0.00	6.00	0.00	100.00	f	 | hr-adjusted-quota	0.00	0.00
a4f50cf6-d695-4838-824a-ef0ea7351670	439d37bc-02d1-4a6b-b8e7-d79086602061	sick	0	2026	2026-04-20 02:34:37.606256	2026-04-20 02:34:37.606256	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
ed2d706e-6400-467e-a36d-db4591b848a8	439d37bc-02d1-4a6b-b8e7-d79086602061	personal	0	2026	2026-04-20 02:34:37.606256	2026-04-20 02:34:37.606256	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
e1a627ea-246f-4540-8236-844c12137079	439d37bc-02d1-4a6b-b8e7-d79086602061	maternity	0	2026	2026-04-20 02:34:37.606256	2026-04-20 02:34:37.606256	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
8425eec9-c8f1-4424-94ac-aca9a220951e	439d37bc-02d1-4a6b-b8e7-d79086602061	paternity	0	2026	2026-04-20 02:34:37.606256	2026-04-20 02:34:37.606256	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
93f18d80-66fe-4b53-a6e7-779068b431aa	439d37bc-02d1-4a6b-b8e7-d79086602061	annual	0	2027	2026-04-20 02:34:37.606256	2026-04-20 02:34:37.606256	14.00	0.00	14.00	0.00	100.00	f	\N	0.00	0.00
4b4ea961-e402-4b21-87e1-4e42b473dd9c	439d37bc-02d1-4a6b-b8e7-d79086602061	sick	0	2027	2026-04-20 02:34:37.606256	2026-04-20 02:34:37.606256	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
4c3beb76-aac0-483b-b7b5-f0869081ff09	439d37bc-02d1-4a6b-b8e7-d79086602061	personal	0	2027	2026-04-20 02:34:37.606256	2026-04-20 02:34:37.606256	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
680210a7-2852-4851-bd55-c69f6c8bb7b3	439d37bc-02d1-4a6b-b8e7-d79086602061	maternity	0	2027	2026-04-20 02:34:37.606256	2026-04-20 02:34:37.606256	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
a071ca1a-34ec-4bd3-b337-4aa479ceadf5	439d37bc-02d1-4a6b-b8e7-d79086602061	paternity	0	2027	2026-04-20 02:34:37.606256	2026-04-20 02:34:37.606256	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
7e438361-9988-43e0-9674-d01855a55123	439d37bc-02d1-4a6b-b8e7-d79086602061	annual	0	2026	2026-04-20 02:34:37.606256	2026-04-20 02:34:37.665817	12.00	0.00	12.00	0.00	100.00	f	 | hr-adjusted-quota	0.00	0.00
54c791f3-8249-47c0-8512-0e6a26331253	c939212d-761e-4b5c-9694-25b8a322a50e	annual	0	2026	2026-04-20 00:47:24.820479	2026-04-20 02:39:22.398639	12.00	0.00	12.00	0.00	100.00	f	manual-override	0.00	24.00
c4bd0086-03a4-4e8b-bd38-e7388243eabb	c939212d-761e-4b5c-9694-25b8a322a50e	sick	0	2026	2026-04-20 00:47:24.820479	2026-04-20 02:39:22.402044	30.00	0.00	30.00	0.00	100.00	f	manual-override	0.00	0.00
9f1ce0a6-e674-4990-9cf6-59bb1fb79bc2	c939212d-761e-4b5c-9694-25b8a322a50e	personal	0	2026	2026-04-20 00:47:24.820479	2026-04-20 02:39:22.40275	3.00	0.00	3.00	0.00	100.00	f	manual-override	0.00	0.00
9adea290-5a8b-48e9-8940-8defd5860dce	7927525e-486f-4a91-a731-bf77c316208d	sick	0	2026	2026-04-20 02:43:06.762836	2026-04-20 02:43:06.762836	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
c6fdaefc-6eeb-45bf-889d-c68a8635f39c	7927525e-486f-4a91-a731-bf77c316208d	personal	0	2026	2026-04-20 02:43:06.762836	2026-04-20 02:43:06.762836	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
ee9a4bbe-0058-4676-961f-a03d1e7eff14	c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	maternity	0	2026	2026-04-20 03:10:19.267938	2026-04-20 03:10:19.267938	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
b88be05e-d7ef-4b01-9d15-72c3f56383b0	c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	paternity	0	2026	2026-04-20 03:10:19.267938	2026-04-20 03:10:19.267938	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
03ad5698-335e-4769-9f23-d707bfbbdb2c	c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	sick	0	2026	2026-04-20 03:10:19.267938	2026-04-20 03:10:19.267938	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
f248b659-6399-4640-bef7-e6ea6521cfa6	c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	personal	0	2026	2026-04-20 03:10:19.267938	2026-04-20 03:10:19.267938	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
85140fa5-5875-4f7b-8d68-bf22d1c7c6b2	c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	annual	0	2027	2026-04-20 03:10:19.267938	2026-04-20 03:10:19.267938	7.00	0.00	7.00	0.00	100.00	f	\N	0.00	0.00
9440aa59-8fc2-44fa-afb8-37606591d61e	c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	sick	0	2027	2026-04-20 03:10:19.267938	2026-04-20 03:10:19.267938	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
2d40c40c-ce6f-48d9-8aa6-201af99cf0bf	c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	personal	0	2027	2026-04-20 03:10:19.267938	2026-04-20 03:10:19.267938	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
81465567-f02e-4c41-8880-d36173fcb042	c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	maternity	0	2027	2026-04-20 03:10:19.267938	2026-04-20 03:10:19.267938	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
1a444050-8a16-46e7-ab9a-244e25a85a38	c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	paternity	0	2027	2026-04-20 03:10:19.267938	2026-04-20 03:10:19.267938	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
0d09b961-c052-4711-8c18-18dd3b676333	c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	annual	0	2026	2026-04-20 03:10:19.267938	2026-04-20 03:10:19.318198	2.00	0.00	2.00	0.00	100.00	f	 | hr-adjusted-quota	0.00	0.00
df32e7f8-bc65-4152-bcd7-4446f5f7a07b	7483ce34-7912-4f78-8dc8-1650abe66f61	sick	0	2026	2026-04-20 03:13:12.819904	2026-04-20 03:13:12.819904	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
f7fdd918-1beb-4983-9ecb-126a41c205b1	7483ce34-7912-4f78-8dc8-1650abe66f61	personal	0	2026	2026-04-20 03:13:12.819904	2026-04-20 03:13:12.819904	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
84f142d5-c501-4f3d-8e87-0bc6bdf3b8c6	7483ce34-7912-4f78-8dc8-1650abe66f61	maternity	0	2026	2026-04-20 03:13:12.819904	2026-04-20 03:13:12.819904	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
512e7b34-b113-46e4-b40a-d2ca27c8e383	7483ce34-7912-4f78-8dc8-1650abe66f61	paternity	0	2026	2026-04-20 03:13:12.819904	2026-04-20 03:13:12.819904	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
0d1a1439-8467-4965-817c-a32bec6ce6d4	7483ce34-7912-4f78-8dc8-1650abe66f61	annual	0	2027	2026-04-20 03:13:12.819904	2026-04-20 03:13:12.819904	7.00	0.00	7.00	0.00	100.00	f	\N	0.00	0.00
428eefa1-06f2-472e-afe4-41deec0643c5	7483ce34-7912-4f78-8dc8-1650abe66f61	sick	0	2027	2026-04-20 03:13:12.819904	2026-04-20 03:13:12.819904	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
93646c8a-2dea-4a32-b946-8363cfde9154	7483ce34-7912-4f78-8dc8-1650abe66f61	personal	0	2027	2026-04-20 03:13:12.819904	2026-04-20 03:13:12.819904	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
ec0b88c8-864e-4753-944a-7fa5830369d6	7483ce34-7912-4f78-8dc8-1650abe66f61	maternity	0	2027	2026-04-20 03:13:12.819904	2026-04-20 03:13:12.819904	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
ddaea4c3-448c-419f-902b-fccf9f49e947	7483ce34-7912-4f78-8dc8-1650abe66f61	paternity	0	2027	2026-04-20 03:13:12.819904	2026-04-20 03:13:12.819904	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
f2e58a74-b30c-4479-961f-73a9154a00e2	7483ce34-7912-4f78-8dc8-1650abe66f61	annual	0	2026	2026-04-20 03:13:12.819904	2026-04-20 03:13:12.878218	2.00	0.00	2.00	0.00	100.00	f	 | hr-adjusted-quota	0.00	0.00
917ddcab-4eb5-4759-b30e-abeeb229c932	1022495d-db2f-46e8-be26-e05e5777e4fb	sick	0	2026	2026-04-20 03:14:54.810053	2026-04-20 03:14:54.810053	0.00	0.00	0.00	0.00	91.67	f	\N	0.00	0.00
8ef31aa3-0a32-4501-a694-dd7a9bf6ef10	1022495d-db2f-46e8-be26-e05e5777e4fb	personal	0	2026	2026-04-20 03:14:54.810053	2026-04-20 03:14:54.810053	0.00	0.00	0.00	0.00	91.67	f	\N	0.00	0.00
4f7d6f49-ff22-4ecc-9df6-35560154bbd3	1022495d-db2f-46e8-be26-e05e5777e4fb	maternity	0	2026	2026-04-20 03:14:54.810053	2026-04-20 03:14:54.810053	0.00	0.00	0.00	0.00	91.67	f	\N	0.00	0.00
a360d9ed-59c6-4232-bdb0-cc428edd00de	1022495d-db2f-46e8-be26-e05e5777e4fb	paternity	0	2026	2026-04-20 03:14:54.810053	2026-04-20 03:14:54.810053	15.00	0.00	15.00	0.00	91.67	f	\N	0.00	0.00
fd502b35-0c4b-4ab3-84b5-d01fa154eb28	1022495d-db2f-46e8-be26-e05e5777e4fb	annual	0	2027	2026-04-20 03:14:54.810053	2026-04-20 03:14:54.810053	6.00	0.00	6.00	0.00	100.00	f	\N	0.00	0.00
5becf9f4-c207-420c-a4be-6150e8aff72d	1022495d-db2f-46e8-be26-e05e5777e4fb	sick	0	2027	2026-04-20 03:14:54.810053	2026-04-20 03:14:54.810053	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
c9129144-ca9c-4ad8-9c59-54e008b1cd50	1022495d-db2f-46e8-be26-e05e5777e4fb	personal	0	2027	2026-04-20 03:14:54.810053	2026-04-20 03:14:54.810053	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
abb3192d-4d12-4a5c-b6ec-0be3d99b114d	1022495d-db2f-46e8-be26-e05e5777e4fb	maternity	0	2027	2026-04-20 03:14:54.810053	2026-04-20 03:14:54.810053	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
3081e985-e8ef-4369-a1a0-5bdb4b17af18	1022495d-db2f-46e8-be26-e05e5777e4fb	paternity	0	2027	2026-04-20 03:14:54.810053	2026-04-20 03:14:54.810053	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
af1d7965-63d0-492e-bb38-d3050fe8e043	1022495d-db2f-46e8-be26-e05e5777e4fb	annual	0	2026	2026-04-20 03:14:54.810053	2026-04-20 03:14:54.865234	1.50	0.00	1.50	0.00	91.67	f	 | hr-adjusted-quota	0.00	0.00
0e3acc68-6481-40e7-8e0c-bf495f2eeffd	d1827117-4158-4c1d-9dad-05cd5bb911c7	sick	0	2026	2026-04-20 03:16:34.0393	2026-04-20 03:16:34.0393	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
ac1df3db-2919-4c4b-97c4-c866cf0c0dae	d1827117-4158-4c1d-9dad-05cd5bb911c7	personal	0	2026	2026-04-20 03:16:34.0393	2026-04-20 03:16:34.0393	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
88f3ef38-271a-43be-8758-aff3befefeef	d1827117-4158-4c1d-9dad-05cd5bb911c7	maternity	0	2026	2026-04-20 03:16:34.0393	2026-04-20 03:16:34.0393	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
8c5c8b1f-61b3-4f1e-af81-95e15d5b4fb9	d1827117-4158-4c1d-9dad-05cd5bb911c7	paternity	0	2026	2026-04-20 03:16:34.0393	2026-04-20 03:16:34.0393	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
41f21f83-661b-49dc-a626-e0ab70c8559c	d1827117-4158-4c1d-9dad-05cd5bb911c7	annual	0	2027	2026-04-20 03:16:34.0393	2026-04-20 03:16:34.0393	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
dc1caa5f-bce3-46ae-868f-fadaa520bd10	d1827117-4158-4c1d-9dad-05cd5bb911c7	sick	0	2027	2026-04-20 03:16:34.0393	2026-04-20 03:16:34.0393	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
8b3696ce-3ec0-4d1e-95d3-0ede033cf38c	d1827117-4158-4c1d-9dad-05cd5bb911c7	personal	0	2027	2026-04-20 03:16:34.0393	2026-04-20 03:16:34.0393	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
2d6a949c-9742-475d-a560-53d47fa745ce	d1827117-4158-4c1d-9dad-05cd5bb911c7	maternity	0	2027	2026-04-20 03:16:34.0393	2026-04-20 03:16:34.0393	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
f84a83e6-2bd2-4efb-9a8f-1393531a9174	d1827117-4158-4c1d-9dad-05cd5bb911c7	paternity	0	2027	2026-04-20 03:16:34.0393	2026-04-20 03:16:34.0393	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
cd1fc583-a713-4484-ad27-03a63a04f0be	d1827117-4158-4c1d-9dad-05cd5bb911c7	annual	0	2026	2026-04-20 03:16:34.0393	2026-04-20 03:16:34.09579	15.00	0.00	15.00	0.00	100.00	f	 | hr-adjusted-quota	0.00	0.00
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employees (id, user_id, email, display_name, first_name, last_name, id_card_number, employment_date, employment_status, annual_leave_days, department, department_id, "position", manager_id, phone, address, birth_date, gender, employee_type, status, created_at, updated_at, probation_end_date, pro_rate_applied_for_year, last_leave_calculation_date, start_date, employee_code, prefix, position_id, end_date, avatar_url, first_name_en, last_name_en, nickname, annual_leave_quota, manual_leave_override) FROM stdin;
d1827117-4158-4c1d-9dad-05cd5bb911c7	ba353b04-5bef-44f8-a3a7-0693c8392bae	rojpiti@tlogical.com	\N	โรจน์ปิติ	ธรรมชูเวท	\N	2015-11-17	probation	15	\N	5d6163ad-2a5a-434b-a086-888541b98502	\N	\N	\N	\N	\N	\N	permanent	active	2026-04-20 03:16:34.035787	2026-04-20 03:16:34.035787	2015-11-17	\N	\N	2015-11-17	T15001	นาย	7207b785-2824-4cb4-8ac3-2eded9480275	\N	\N	Rojpiti	Thamchoowet	Tee	\N	f
439d37bc-02d1-4a6b-b8e7-d79086602061	34a08d5b-dd61-44ac-b02b-fa165d09b0e7	napaporn@tlogical.com	\N	นภาพร 	จูสุวรรณ์	\N	2018-10-01	probation	15	\N	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	\N	\N		\N	\N	\N	permanent	active	2026-04-20 02:34:37.596865	2026-04-20 02:34:37.596865	2018-10-01	\N	\N	2018-10-01	T18001	นางสาว	51e027ed-bc31-4b25-bdcc-a84160ce7d53	\N	\N	Napaporn	Jusuwan	Hava	12.0	f
c939212d-761e-4b5c-9694-25b8a322a50e	fbfff076-00cc-4b7b-a065-21c48881c23b	rattikan@tlogical.com	\N	รัตติกาล	กันใจมา	\N	2019-11-21	probation	15	\N	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	\N	\N		\N	\N	\N	permanent	active	2026-04-20 00:47:24.809507	2026-04-20 00:47:24.809507	2019-11-21	\N	\N	2019-11-21	T19006	นางสาว	5f936e6f-b16f-4575-a764-129de08201d0	\N	\N	Rattikanl	Ganjaima	Kan	12.0	t
7927525e-486f-4a91-a731-bf77c316208d	06551f1b-9306-4b50-8edf-d15262287318	jack@tlogical.com	\N	พัชรพล	จันขาว	\N	2024-07-01	probation	15	\N	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	\N	\N	\N	\N	\N	\N	permanent	active	2026-04-20 02:43:06.756895	2026-04-20 02:43:06.756895	2024-10-01	\N	\N	2024-07-01	T24004	นาย	5f936e6f-b16f-4575-a764-129de08201d0	\N	\N	Phatcharaphon	Chankhao	๋Jack	\N	f
c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	793db59b-50f0-4b23-a62f-47a25838c782	seen@tlogical.com	\N	ชานน	เลียน	\N	2025-11-03	probation	15	\N	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	\N	\N	\N	\N	\N	\N	permanent	active	2026-04-20 03:10:19.256632	2026-04-20 03:10:19.256632	2026-03-01	\N	\N	2025-11-03	T25004	นาย	5f936e6f-b16f-4575-a764-129de08201d0	\N	\N	Chanon	Lien	Seen	\N	f
7483ce34-7912-4f78-8dc8-1650abe66f61	c9916825-8558-4654-b176-71d911162886	guy@tlogical.com	\N	กฤตภาส	ธิปาแก้ว	\N	2025-11-10	probation	15	\N	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	\N	\N	\N	\N	\N	\N	permanent	active	2026-04-20 03:13:12.815434	2026-04-20 03:13:12.815434	2026-03-01	\N	\N	2025-11-10	T25005	นาย	5f936e6f-b16f-4575-a764-129de08201d0	\N	\N	Kritthapath	Thipakeaw	Guy	\N	f
1022495d-db2f-46e8-be26-e05e5777e4fb	29d29b94-d38b-435e-a763-a13b969225d7	chayapat@tlogical.com	\N	ชยพัทร์	บัวต๋า	\N	2026-02-16	probation	15	\N	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	\N	\N	\N	\N	\N	\N	permanent	active	2026-04-20 03:14:54.806322	2026-04-20 03:14:54.806322	2026-02-16	\N	\N	2026-02-16	T26003	นาย	e3dda3bd-5b0f-4646-95f8-354ae946cad9	\N	\N	Chayapat	Buatah	Got	\N	f
\.


--
-- Data for Name: holidays; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.holidays (id, holiday_date, name, description, created_at, updated_at) FROM stdin;
18c3a669-99e4-450f-bcd0-40a00e56e479	2025-01-01	New Year Day	New Year Holiday	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
95ee4628-3ff6-4d57-a2a9-516ae842acad	2025-02-13	Makha Bucha	Buddhist Holiday	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
6a27e638-44f6-4171-80a3-517d6eb66e42	2025-04-06	Chakri Memorial Day	Thai National Holiday	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
511f8e54-8d5e-4654-9508-d19ed8110ed3	2025-04-13	Songkran Festival	Thai New Year - Day 1	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
3f6d2bfe-24a5-4b24-b3df-3858003f56a5	2025-04-14	Songkran Festival	Thai New Year - Day 2	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
f5f69b54-8621-4fe9-9eb4-67057b263f4e	2025-04-15	Songkran Festival	Thai New Year - Day 3	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
78841787-04a5-48ae-bf77-69a83f10dfb9	2025-05-01	Labour Day	International Labour Day	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
7f545523-425b-45d5-82bc-0c20780ebdff	2025-05-22	Visakha Bucha	Buddhist Holiday	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
7e1b4d49-6694-4769-bf0e-7fe446556d25	2025-07-29	King Vajiralongkorn Birthday	Thai National Holiday	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
a7b3e3ff-5d7d-4534-b0d3-25d809c774d9	2025-07-31	Buddhist Lent Day	Buddhist Observance	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
4f7582c2-a8b5-4c23-9e21-4d316400137f	2025-10-13	King Bhumibol Memorial Day	Thai National Holiday	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
bec7643e-ded7-426d-baca-6a77d1e5bb92	2025-10-14	King Bhumibol Memorial Day Observed	Thai National Holiday	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
7e5a96a3-9d7c-42b1-a410-4234e06aee66	2025-10-23	Chulalongkorn Memorial Day	Thai National Holiday	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
99da7608-d1fb-4630-89f9-de5b7fe0e3e5	2025-12-05	King Bhumibol Birthday	Thai National Holiday	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
390484f9-4617-4c96-9e06-12dfea558ef2	2025-12-10	Constitution Day	Thai National Holiday	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
737c9092-904e-42c4-bcef-bb3172fcbd64	2025-12-31	New Year's Eve	Year End	2026-04-06 15:32:22.463288	2026-04-06 15:32:22.463288
0b844e16-0010-4a55-aa13-c26ee01473ae	2026-01-01	วันขึ้นปีใหม่		2026-04-07 13:39:53.80477	2026-04-07 13:39:53.80477
3e7eae9b-dd0a-47da-9db3-d79984e36177	2026-02-02	วันหยุดทำการเพิ่มเป็นกรณีพิเศษ		2026-04-07 13:40:10.858049	2026-04-07 13:40:10.858049
e5bb6631-e365-4ca8-8f7a-80a4648ec3de	2026-04-13	วันสงกรานต์		2026-04-07 13:40:25.07199	2026-04-07 13:40:25.07199
ba58e220-7616-45b3-8b18-330e2e41ee61	2026-04-14	วันสงกรานต์		2026-04-07 13:40:34.123173	2026-04-07 13:40:34.123173
7332f523-7077-4d92-9720-a96bb31dedcd	2026-04-15	วันสงกรานต์		2026-04-07 13:40:40.890116	2026-04-07 13:40:40.890116
9ef957d6-edb9-4494-bd43-5bd8e43a1e76	2026-05-01	วันแรงงานแห่งชาติ		2026-04-07 13:40:59.339755	2026-04-07 13:40:59.339755
e336562c-d30c-4bba-95dc-482f057816eb	2026-06-03	วันเฉลิมพระชมนพรรษา สามเด็จพระนางเจ้าสุทิดา		2026-04-07 13:41:30.151669	2026-04-07 13:41:30.151669
e4d9adb4-044d-44e6-a6c5-9edd33d1becb	2026-07-28	วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว		2026-04-07 13:41:59.507518	2026-04-07 13:41:59.507518
9107f1f5-8950-425c-8c52-5a2bca7220c0	2026-08-12	วันแรงงานแห่งชาติ		2026-04-07 13:42:41.662947	2026-04-07 13:42:41.662947
6de03a84-c8eb-4e60-a8f0-68f7280cc441	2026-10-13	วันนวมินทรมหาราช		2026-04-07 13:43:16.732416	2026-04-07 13:43:16.732416
23f641ef-1a09-4e56-8256-93eaf23f8a27	2026-10-23	วันปิยะมหาราช		2026-04-07 13:43:38.84092	2026-04-07 13:43:38.84092
efda0be5-9d93-4374-ba54-92905803f0da	2026-12-07	ชดเชยวันชาติ และวันพ่อแห่งชาติ		2026-04-07 13:44:03.216541	2026-04-07 13:44:03.216541
c3005e5d-70fa-44e1-9c97-74dc918fc1a5	2026-12-31	วันสิ้นปี		2026-04-07 13:45:41.728472	2026-04-07 13:45:41.728472
\.


--
-- Data for Name: leave_attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_attachments (id, leave_request_id, file_name, file_path, file_size, mime_type, uploaded_at) FROM stdin;
\.


--
-- Data for Name: leave_balance_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_balance_history (id, employee_id, year, leave_type, previous_entitled_days, previous_used_days, previous_remaining_days, new_entitled_days, new_used_days, new_remaining_days, change_reason, changed_by, changed_at, created_at) FROM stdin;
\.


--
-- Data for Name: leave_calculation_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_calculation_log (id, employee_id, calculation_type, calculation_date, years_of_service, tenure_year_for_policy, policy_id, base_quota, pro_rate_percent, final_entitled_days, calculation_details, calculated_by, calculated_at, created_at) FROM stdin;
d13f242c-cfe3-4326-a6be-546282302af9	c939212d-761e-4b5c-9694-25b8a322a50e	new_hire_prorate	2026-04-20	6	6	\N	\N	100.00	12.00	\N	system	2026-04-20 00:47:24.820479	2026-04-20 00:47:24.820479
cc17a1b8-5918-486c-bdae-591d52e441b5	439d37bc-02d1-4a6b-b8e7-d79086602061	new_hire_prorate	2026-04-20	7	7	\N	\N	100.00	13.00	\N	system	2026-04-20 02:34:37.606256	2026-04-20 02:34:37.606256
80f3a703-a367-477b-9ee9-1dbf496acdfd	7927525e-486f-4a91-a731-bf77c316208d	new_hire_prorate	2026-04-20	1	1	\N	\N	100.00	7.00	\N	system	2026-04-20 02:43:06.762836	2026-04-20 02:43:06.762836
225c24cb-36e5-4fc8-b1fc-028eafb261bc	c3b5f9f2-5645-4d2e-b3a7-2f962b59b399	new_hire_prorate	2026-04-20	0	0	\N	\N	100.00	6.00	\N	system	2026-04-20 03:10:19.267938	2026-04-20 03:10:19.267938
9e11307b-da99-467a-b900-231d56f7467e	7483ce34-7912-4f78-8dc8-1650abe66f61	new_hire_prorate	2026-04-20	0	0	\N	\N	100.00	6.00	\N	system	2026-04-20 03:13:12.819904	2026-04-20 03:13:12.819904
abc1d006-3d6c-478c-b067-77f0319097d0	1022495d-db2f-46e8-be26-e05e5777e4fb	new_hire_prorate	2026-04-20	0	0	\N	\N	100.00	0.00	\N	system	2026-04-20 03:14:54.810053	2026-04-20 03:14:54.810053
fc88c8ad-8f44-424f-a13d-475d40ece408	d1827117-4158-4c1d-9dad-05cd5bb911c7	new_hire_prorate	2026-04-20	10	10	\N	\N	100.00	15.00	\N	system	2026-04-20 03:16:34.0393	2026-04-20 03:16:34.0393
\.


--
-- Data for Name: leave_entitlement_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_entitlement_config (id, config_key, config_value, data_type, description, last_updated_by, created_at, updated_at) FROM stdin;
b2069b01-3722-4cc1-9631-0084d03909e5	probation_days	119	integer	จำนวนวันทดลองงานก่อนจะสามารถขอลาได้	\N	2026-04-07 00:02:25.453402	2026-04-07 00:02:25.453402
7534ce73-4954-4610-b750-e19253758f3d	yearly_reset_date	2026-01-01	string	วันที่ระบบตัดสิทธิ์วันลาการไม่ใช้ของปีปีหน้า	\N	2026-04-07 00:02:25.453402	2026-04-07 00:02:25.453402
2b74f027-2b27-4ea6-a1ea-5702fb2f99ea	rounding_method	0.5	decimal	การปัดเศษวันลา (0.5 = ปัดลงที่ 0.5 วัน)	\N	2026-04-07 00:02:25.453402	2026-04-07 00:02:25.453402
5f9d9f66-4e63-4ecc-bcbe-1fb46315f058	max_carry_over_days	0	decimal	จำนวนวันลาสูงสุดที่สามารถยกไปปีหน้าได้	\N	2026-04-07 00:02:25.453402	2026-04-07 00:02:25.453402
d6e6bad0-9e6c-4915-8c0f-957f7cd4952f	pro_rate_calculation_enabled	true	boolean	เปิดใช้งานการคำนวณ Pro-rate	\N	2026-04-07 00:02:25.453402	2026-04-07 00:02:25.453402
1d7df146-f369-4eed-ab0e-c90f3bc534cd	step_up_policy_enabled	true	boolean	เปิดใช้งานนโยบายเพิ่มสิทธิ์ตามอายุงาน	\N	2026-04-07 00:02:25.453402	2026-04-07 00:02:25.453402
\.


--
-- Data for Name: leave_policies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_policies (id, employee_type, employee_status, min_years_of_service, max_years_of_service, annual_leave_quota, sick_leave_quota, personal_leave_quota, maternity_leave_quota, paternity_leave_quota, is_prorated_first_year, is_prorated, description, active, created_at, updated_at, tenure_year_from, tenure_year_to, policy_name) FROM stdin;
3	contract	active	0	\N	6	30	3	120	15	t	t	พนักงานสัญญาจ้าง/ทดลองงาน	t	2026-04-06 19:43:47.207827	2026-04-07 01:56:09.088347	0	\N	\N
4	parttime	active	0	\N	3	15	3	90	7	f	f	พนักงานพาร์ทไทม์	t	2026-04-06 19:43:47.207827	2026-04-07 01:56:09.088347	0	\N	\N
16	permanent	active	0	\N	0	0	0	0	15	t	t	\N	t	2026-04-16 02:05:03.028959	2026-04-16 02:05:03.028959	0	\N	\N
1	permanent	active	1	1	6	30	3	120	15	t	t	พนักงานประจำอายุงานน้อยกว่า 1 ปี	t	2026-04-06 19:43:47.207827	2026-04-07 01:56:09.088347	1	1	Permanent - Year 1
5	permanent	active	2	2	7	30	3	120	15	f	f	พนักงานประจำปีที่ 2	t	2026-04-07 00:05:03.837211	2026-04-07 01:56:09.088347	2	2	Permanent - Year 2
6	permanent	active	3	3	8	30	3	120	15	f	f	พนักงานประจำปีที่ 3	t	2026-04-07 00:05:03.837211	2026-04-07 01:56:09.088347	3	3	Permanent - Year 3
7	permanent	active	4	4	9	30	3	120	15	f	f	พนักงานประจำปีที่ 4	t	2026-04-07 00:05:03.837211	2026-04-07 01:56:09.088347	4	4	Permanent - Year 4
8	permanent	active	5	5	10	30	3	120	15	f	f	พนักงานประจำปีที่ 5	t	2026-04-07 00:05:03.837211	2026-04-07 01:56:09.088347	5	5	Permanent - Year 5
9	permanent	active	6	6	11	30	3	120	15	f	f	พนักงานประจำปีที่ 6	t	2026-04-07 00:05:03.837211	2026-04-07 01:56:09.088347	6	6	Permanent - Year 6
10	permanent	active	7	7	12	30	3	120	15	f	f	พนักงานประจำปีที่ 7	t	2026-04-07 00:05:03.837211	2026-04-07 01:56:09.088347	7	7	Permanent - Year 7
11	permanent	active	8	8	13	30	3	120	15	f	f	พนักงานประจำปีที่ 8	t	2026-04-07 00:05:03.837211	2026-04-07 01:56:09.088347	8	8	Permanent - Year 8
12	permanent	active	9	9	14	30	3	120	15	f	f	พนักงานประจำปีที่ 9	t	2026-04-07 00:05:03.837211	2026-04-07 01:56:09.088347	9	9	Permanent - Year 9
13	permanent	active	10	\N	15	30	3	120	15	f	f	พนักงานประจำปีที่ 10	t	2026-04-07 00:05:03.837211	2026-04-07 01:56:09.088347	10	\N	Permanent - Year 10
\.


--
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_requests (id, employee_id, leave_type, start_date, end_date, total_days, reason, status, rejection_reason, approver_id, created_at, updated_at, start_time, end_time, is_half_day, half_day_period, approved_at) FROM stdin;
\.


--
-- Data for Name: leave_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_types (id, name, code, description, is_paid, created_at, updated_at) FROM stdin;
03b9310f-d014-4278-b318-4559d54594d5	ลาป่วย	sick	ลาเนื่องจากป่วยหรือบาดเจ็บ	t	2026-04-06 15:19:16.691875	2026-04-06 15:19:16.691875
ec8cb2dc-1c4b-4d7f-92fa-c228af2f26dc	ลากิจส่วนตัว	personal	ลาเพื่อกิจการส่วนตัว	t	2026-04-06 15:19:16.691875	2026-04-06 15:19:16.691875
afab8cf0-12ca-457c-ad2f-c5b5ee330374	ลาพักร้อน	vacation	ลาพักร้อนประจำปี	t	2026-04-06 15:19:16.691875	2026-04-06 15:19:16.691875
eb869e04-fe22-4f7e-bf77-63389f0fb079	ลาคลอด	maternity	ลาคลอด	t	2026-04-06 15:19:16.691875	2026-04-06 15:19:16.691875
b37d78ab-fd9d-45fa-9451-06038712dc00	ลาบิดา	paternity	ลาบิดา	t	2026-04-06 15:19:16.691875	2026-04-06 15:19:16.691875
84a57a65-32b1-41f9-bf8e-3f5549647617	ลาไม่รับค่าจ้าง	unpaid	ลาไม่รับค่าจ้าง	f	2026-04-06 15:19:16.691875	2026-04-06 15:19:16.691875
eb430631-017e-47c6-ad36-d21d6ef7dc4c	อื่น ๆ	other	ลาประเภทอื่น	f	2026-04-06 15:19:16.691875	2026-04-06 15:19:16.691875
41ad392b-6b71-4f33-ab4d-395cd6b7c85c	Annual Leave	AL	Paid Annual Leave	t	2026-04-06 15:20:20.993734	2026-04-06 15:20:20.993734
b5ddc0ae-78f8-4cfe-83de-21fbfa855d34	Sick Leave	SL	Sick Leave	t	2026-04-06 15:20:20.993734	2026-04-06 15:20:20.993734
a05391f9-fb09-4bb9-8f36-7c607242d3f7	Personal Leave	PL	Unpaid Personal Leave	f	2026-04-06 15:20:20.993734	2026-04-06 15:20:20.993734
bfef5382-7300-4f3d-a4ed-acf6311a4506	Maternity Leave	ML	Maternity Leave	t	2026-04-06 15:20:20.993734	2026-04-06 15:20:20.993734
3602bf15-d6df-460f-a4c4-8469bf9a5e5b	Emergency Leave	EL	Emergency Leave	f	2026-04-06 15:20:20.993734	2026-04-06 15:20:20.993734
\.


--
-- Data for Name: notification_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_settings (id, department, role, email, notify_on_leave_request, notify_on_approval, notify_on_rejection, created_at, updated_at, dept_id, leave_type, to_list, cc_list, bcc_list, is_active) FROM stdin;
8fa89567-dea2-4c97-946b-a1b9364c11dd	IT	manager	it-manager@company.local	t	t	t	2026-04-06 15:32:22.466637	2026-04-07 13:31:21.681419	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	vacation	nongkanjung@gmail.com	rattikan50@hotmail.com		t
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, title, message, type, is_read, link, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: positions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.positions (id, name, department_id, description, created_at, updated_at) FROM stdin;
5f936e6f-b16f-4575-a764-129de08201d0	นักพัฒนาซอฟต์แวร์	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	นักพัฒนาซอฟต์แวร์	2026-04-06 15:20:20.97762	2026-04-06 15:20:20.97762
7207b785-2824-4cb4-8ac3-2eded9480275	CEO	5d6163ad-2a5a-434b-a086-888541b98502	\N	2026-04-07 04:03:52.366959	2026-04-07 04:03:52.366959
51e027ed-bc31-4b25-bdcc-a84160ce7d53	ผู้จัดการโครงการงานไอที	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	Human Resources Manager	2026-04-06 15:20:20.97762	2026-04-06 15:20:20.97762
e34e1c79-b456-4d4c-b96a-38f3367982e2	ผู้ปฏิบัติการ	311a1d6b-a22c-4b67-9834-321124f96352	Accountant	2026-04-06 15:20:20.97762	2026-04-06 15:20:20.97762
e3dda3bd-5b0f-4646-95f8-354ae946cad9	เจ้าหน้าที่ปฏิบัติการงานไอที	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	เจ้าหน้าที่ปฏิบัติการงานไอที	2026-04-06 15:20:20.97762	2026-04-06 15:20:20.97762
\.


--
-- Data for Name: user_auth; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_auth (id, email, password_hash, role, created_at, updated_at) FROM stdin;
c9916825-8558-4654-b176-71d911162886	guy@tlogical.com	$2b$10$xHJioDNeFwmlVD8AFjfigunNQgkdn0ctKrEUFzzYsaRuugyR/Ikv.	employee	2026-04-20 03:13:12.811049	2026-04-20 03:13:12.811049
29d29b94-d38b-435e-a763-a13b969225d7	chayapat@tlogical.com	$2b$10$wZXWY5pBxFsq8FBPglpq6.L.Mf/dxzkeF5cj2dv7JQLOtVrL/usPi	employee	2026-04-20 03:14:54.803314	2026-04-20 03:14:54.803314
ba353b04-5bef-44f8-a3a7-0693c8392bae	rojpiti@tlogical.com	$2b$10$i/WHPa30wUysBrQRQng/0.BFDajCX0brrAVwHK1sO2.frDjzIYPYC	admin	2026-04-20 03:16:34.03189	2026-04-20 03:16:34.03189
53ca0dcf-a94e-406e-b1c3-9668f752359e	admin@tlogical.com	$2b$10$A/BrJBwWGWHxarRJThRMoeeEmjkheJ0VsJPqmYYIsA/5sDd5HSmdy	admin	2026-04-07 03:02:43.015448	2026-04-07 03:02:43.015448
4ffe0182-6b4f-4769-a0d6-a6ab7587d1f9	admin@hrdb.local	$2b$10$bJI/kGGK45WbYeHqMZhCXu7jzNFDLwJk.N1/bvE9qh1XFiX.TL1Ty	admin	2026-04-06 15:32:52.65172	2026-04-08 15:54:31.789004
30dafe5e-93b5-4a2c-946e-c0581541df72	user@example.com	$2b$10$Fgueng7h5xaJjagI/UgRreHcr13dFv2cHz8Fa9mT7s0.C/6lsZhza	employee	2026-04-18 14:08:48.561116	2026-04-18 14:08:48.561116
fbfff076-00cc-4b7b-a065-21c48881c23b	rattikan@tlogical.com	$2b$10$/hz1ZiE0BFPRuGYBugMj/.rd6l9kIrkIsXL/nvGnEgvc0Ofb0/JSq	supervisor	2026-04-20 00:47:24.800737	2026-04-20 00:47:24.800737
34a08d5b-dd61-44ac-b02b-fa165d09b0e7	napaporn@tlogical.com	$2b$10$Yob1Uh6Aw3I.n95.ZV89dOF8zwDG2azyTH0lO02DG0JwpAAY2.GWi	employee	2026-04-20 02:34:37.59088	2026-04-20 02:34:37.59088
06551f1b-9306-4b50-8edf-d15262287318	jack@tlogical.com	$2b$10$oeLNOFq9r8NFYumzxjVYIehO4TDa8u4IdDNw43dfrtFwyqtX7IIQG	employee	2026-04-20 02:43:06.750418	2026-04-20 02:43:06.750418
793db59b-50f0-4b23-a62f-47a25838c782	seen@tlogical.com	$2b$10$5FHGLTAyjadP1s1yJ4rzu.NB41EjP0n3H2Km68bNcFmzJtOh2FDwy	employee	2026-04-20 03:10:19.244104	2026-04-20 03:10:19.244104
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, user_id, role, assigned_at, assigned_by) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, display_name, role, is_active, created_at, updated_at) FROM stdin;
840e914e-b0f8-4570-85a8-569347de6d56	admin@hrdb.local	$2b$10$PLACEHOLDER_HASH	Administrator	admin	t	2026-04-06 15:20:20.994496	2026-04-06 15:20:20.994496
5d7d80a5-f153-496f-a709-a274afe20833	admin@system.com	$2b$10$O2tu1oWlpLeG2LWwbGntReBSo4PWysoACTjA1teIxeZ2jqwkP70nC	Admin User	admin	t	2026-04-06 15:19:16.702163	2026-04-06 15:19:16.702163
\.


--
-- Name: approval_workflows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.approval_workflows_id_seq', 3, true);


--
-- Name: leave_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leave_attachments_id_seq', 3, true);


--
-- Name: leave_policies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leave_policies_id_seq', 16, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 16, true);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_leave_type_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_leave_type_year_key UNIQUE (employee_id, leave_type, year);


--
-- Name: employee_leave_balances employee_leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_id_card_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_id_card_number_key UNIQUE (id_card_number);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_holiday_date_key UNIQUE (holiday_date);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: leave_attachments leave_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_attachments
    ADD CONSTRAINT leave_attachments_pkey PRIMARY KEY (id);


--
-- Name: leave_balance_history leave_balance_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balance_history
    ADD CONSTRAINT leave_balance_history_pkey PRIMARY KEY (id);


--
-- Name: leave_calculation_log leave_calculation_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_calculation_log
    ADD CONSTRAINT leave_calculation_log_pkey PRIMARY KEY (id);


--
-- Name: leave_entitlement_config leave_entitlement_config_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_entitlement_config
    ADD CONSTRAINT leave_entitlement_config_config_key_key UNIQUE (config_key);


--
-- Name: leave_entitlement_config leave_entitlement_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_entitlement_config
    ADD CONSTRAINT leave_entitlement_config_pkey PRIMARY KEY (id);


--
-- Name: leave_policies leave_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_policies
    ADD CONSTRAINT leave_policies_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_code_key UNIQUE (code);


--
-- Name: leave_types leave_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_name_key UNIQUE (name);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- Name: user_auth user_auth_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auth
    ADD CONSTRAINT user_auth_email_key UNIQUE (email);


--
-- Name: user_auth user_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auth
    ADD CONSTRAINT user_auth_pkey PRIMARY KEY (id);


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
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_employee_leave_balances_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_leave_balances_employee_id ON public.employee_leave_balances USING btree (employee_id);


--
-- Name: idx_employee_leave_balances_leave_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_leave_balances_leave_type ON public.employee_leave_balances USING btree (leave_type);


--
-- Name: idx_employee_leave_balances_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_leave_balances_year ON public.employee_leave_balances USING btree (employee_id, year);


--
-- Name: idx_employees_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_department ON public.employees USING btree (department);


--
-- Name: idx_employees_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_email ON public.employees USING btree (email);


--
-- Name: idx_employees_employee_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_employee_code ON public.employees USING btree (employee_code);


--
-- Name: idx_employees_position_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_position_id ON public.employees USING btree (position_id);


--
-- Name: idx_employees_probation_end_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_probation_end_date ON public.employees USING btree (probation_end_date);


--
-- Name: idx_employees_start_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_start_date ON public.employees USING btree (start_date);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_employees_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_user_id ON public.employees USING btree (user_id);


--
-- Name: idx_holidays_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_holidays_date ON public.holidays USING btree (holiday_date);


--
-- Name: idx_leave_attachments_leave_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_attachments_leave_request_id ON public.leave_attachments USING btree (leave_request_id);


--
-- Name: idx_leave_balance_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balance_history_changed_at ON public.leave_balance_history USING btree (changed_at);


--
-- Name: idx_leave_balance_history_employee_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balance_history_employee_year ON public.leave_balance_history USING btree (employee_id, year);


--
-- Name: idx_leave_balances_hybrid_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balances_hybrid_employee ON public.employee_leave_balances USING btree (employee_id, year, leave_type);


--
-- Name: idx_leave_balances_hybrid_year_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balances_hybrid_year_type ON public.employee_leave_balances USING btree (year, leave_type);


--
-- Name: idx_leave_calculation_log_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_calculation_log_date ON public.leave_calculation_log USING btree (calculation_date);


--
-- Name: idx_leave_calculation_log_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_calculation_log_employee ON public.leave_calculation_log USING btree (employee_id);


--
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- Name: idx_leave_requests_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_employee_id ON public.leave_requests USING btree (employee_id);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- Name: idx_notification_settings_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_settings_department ON public.notification_settings USING btree (department);


--
-- Name: idx_notification_settings_dept_leave_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_settings_dept_leave_type ON public.notification_settings USING btree (dept_id, leave_type);


--
-- Name: idx_notification_settings_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_settings_role ON public.notification_settings USING btree (role);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_positions_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_positions_department_id ON public.positions USING btree (department_id);


--
-- Name: idx_user_auth_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_auth_email ON public.user_auth USING btree (email);


--
-- Name: idx_user_auth_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_auth_role ON public.user_auth USING btree (role);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: employees employees_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_auth(id) ON DELETE SET NULL;


--
-- Name: leave_attachments leave_attachments_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_attachments
    ADD CONSTRAINT leave_attachments_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- Name: leave_balance_history leave_balance_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balance_history
    ADD CONSTRAINT leave_balance_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.employees(id);


--
-- Name: leave_balance_history leave_balance_history_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balance_history
    ADD CONSTRAINT leave_balance_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_calculation_log leave_calculation_log_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_calculation_log
    ADD CONSTRAINT leave_calculation_log_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_calculation_log leave_calculation_log_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_calculation_log
    ADD CONSTRAINT leave_calculation_log_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.leave_policies(id);


--
-- Name: leave_entitlement_config leave_entitlement_config_last_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_entitlement_config
    ADD CONSTRAINT leave_entitlement_config_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES public.employees(id);


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_auth(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_auth(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.user_auth(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_auth(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict pqIuzn9k2PU2KcfZedSWkWFn8lakIgS0crzW6g5Kxw7adOKmMmEmNMxtrka2ZyV

