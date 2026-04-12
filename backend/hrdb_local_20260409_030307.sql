--
-- PostgreSQL database dump
--

\restrict rWUOJmsKjLWhtzBHCgeHdTYNf66WBKWOyBBuB2qownywaEq4UuA5ol0hUbeFjb8

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
-- Name: calculate_prorated_leave_days(date, character varying, integer); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.calculate_prorated_leave_days(p_start_date date, p_employee_type character varying, p_calendar_year integer, OUT entitled_days numeric, OUT pro_rate_percent numeric, OUT calculation_details jsonb) OWNER TO postgres;

--
-- Name: calculate_years_of_service(date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_years_of_service(start_date date, reference_date date DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  RETURN FLOOR(EXTRACT(DAY FROM (reference_date - start_date)) / 365.25)::INT;
END;
$$;


ALTER FUNCTION public.calculate_years_of_service(start_date date, reference_date date) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: leave_policies; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.leave_policies OWNER TO postgres;

--
-- Name: get_applicable_leave_policy(character varying, integer); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.get_applicable_leave_policy(p_employee_type character varying, p_years_of_service integer) OWNER TO postgres;

--
-- Name: is_employee_in_probation(uuid, date); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.is_employee_in_probation(p_employee_id uuid, reference_date date) OWNER TO postgres;

--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.approval_workflows OWNER TO postgres;

--
-- Name: approval_workflows_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.approval_workflows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.approval_workflows_id_seq OWNER TO postgres;

--
-- Name: approval_workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.approval_workflows_id_seq OWNED BY public.approval_workflows.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: employee_leave_balances; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.employee_leave_balances OWNER TO postgres;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
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
    end_date date
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: holidays; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    holiday_date date NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.holidays OWNER TO postgres;

--
-- Name: leave_attachments; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.leave_attachments OWNER TO postgres;

--
-- Name: leave_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leave_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_attachments_id_seq OWNER TO postgres;

--
-- Name: leave_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leave_attachments_id_seq OWNED BY public.leave_attachments.id;


--
-- Name: leave_balance_history; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.leave_balance_history OWNER TO postgres;

--
-- Name: leave_calculation_log; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.leave_calculation_log OWNER TO postgres;

--
-- Name: leave_entitlement_config; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.leave_entitlement_config OWNER TO postgres;

--
-- Name: leave_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leave_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_policies_id_seq OWNER TO postgres;

--
-- Name: leave_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leave_policies_id_seq OWNED BY public.leave_policies.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.leave_requests OWNER TO postgres;

--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.leave_types OWNER TO postgres;

--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.notification_settings OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: positions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    department_id uuid NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.positions OWNER TO postgres;

--
-- Name: user_auth; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_auth (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    role character varying(50) DEFAULT 'employee'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_auth OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    assigned_by uuid
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: approval_workflows id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_workflows ALTER COLUMN id SET DEFAULT nextval('public.approval_workflows_id_seq'::regclass);


--
-- Name: leave_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_attachments ALTER COLUMN id SET DEFAULT nextval('public.leave_attachments_id_seq'::regclass);


--
-- Name: leave_policies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_policies ALTER COLUMN id SET DEFAULT nextval('public.leave_policies_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Data for Name: approval_workflows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.approval_workflows (id, leave_type, approval_levels, min_days, max_days, requires_hr, flow_pattern, description, created_at, updated_at) FROM stdin;
2	all	1	1	1	f	supervisor	\N	2026-04-07 04:21:03.204335	2026-04-07 08:24:50.887901
3	all	1	1	\N	f	supervisor	\N	2026-04-07 08:24:58.854446	2026-04-07 08:24:58.854446
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name, description, created_at, updated_at) FROM stdin;
f7fba0b2-985d-4295-8f6b-94d74cb4cd4e	Human Resources	Human Resources Department	2026-04-06 15:32:22.460712	2026-04-06 15:32:22.460712
311a1d6b-a22c-4b67-9834-321124f96352	Finance	Finance and Accounting	2026-04-06 15:32:22.460712	2026-04-06 15:32:22.460712
a46e4a46-6ebe-4d1e-b102-c12c003500ff	Operations	Operations Management	2026-04-06 15:32:22.460712	2026-04-06 15:32:22.460712
0983a3b8-fd5f-44c7-8c56-a3274952dff5	Sales	Sales and Marketing	2026-04-06 15:32:22.460712	2026-04-06 15:32:22.460712
5fde3baa-1837-4eae-b660-f44fa7d7aec6	QA TEMP DEPT	temp	2026-04-07 03:32:48.36966	2026-04-07 03:32:48.36966
d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	ITD	Information Technology	2026-04-06 15:32:22.460712	2026-04-06 15:32:22.460712
5d6163ad-2a5a-434b-a086-888541b98502	Manager	Manager	2026-04-07 04:03:32.661532	2026-04-07 04:03:32.661532
\.


--
-- Data for Name: employee_leave_balances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee_leave_balances (id, employee_id, leave_type, balance_days, year, created_at, updated_at, entitled_days, used_days, remaining_days, carried_over_days, pro_rated_percent, is_utilized, notes, accrued_amount, total_entitlement) FROM stdin;
30a4eb86-1060-4053-82db-64953574b3fa	6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	annual	0	2026	2026-04-07 15:37:14.89265	2026-04-07 15:37:14.930976	5.50	0.00	5.50	0.00	75.00	f	manual-adjustment:annual:1:by-2026-04-07T08:37:14.930Z	0.00	1.00
72faffb9-cfee-4380-8a4d-0bbd354bb7b7	6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	sick	0	2026	2026-04-07 15:37:14.89265	2026-04-07 15:37:14.936207	11.50	0.00	11.50	0.00	75.00	f	manual-adjustment:sick:0.5:by-2026-04-07T08:37:14.932Z\nmanual-adjustment:sick:1:by-2026-04-07T08:37:14.936Z	0.00	1.50
87f11846-310c-4388-8ff2-2ba63dbe118b	6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	personal	0	2026	2026-04-07 15:37:14.89265	2026-04-07 15:37:14.936559	5.50	0.00	5.50	0.00	75.00	f	manual-adjustment:personal:0.5:by-2026-04-07T08:37:14.936Z	0.00	0.50
8bfe8436-7d96-4532-b9f3-04a5269792be	8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	maternity	0	2026	2026-04-07 15:42:53.468636	2026-04-07 15:42:53.468636	90.00	0.00	90.00	0.00	75.00	f	\N	0.00	0.00
000cee9f-9f2b-4ff3-aa5a-b8429856e0d7	8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	paternity	0	2026	2026-04-07 15:42:53.468636	2026-04-07 15:42:53.468636	7.00	0.00	7.00	0.00	75.00	f	\N	0.00	0.00
338dc475-5f3f-4445-9786-23e5cca826a3	8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	annual	0	2027	2026-04-07 15:42:53.468636	2026-04-07 15:42:53.468636	6.00	0.00	6.00	0.00	100.00	f	\N	0.00	0.00
3cfe7511-882f-46dd-8973-48fef3c602a0	8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	sick	0	2027	2026-04-07 15:42:53.468636	2026-04-07 15:42:53.468636	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
8bfa9119-b17c-423b-8064-9b21d65c57e7	8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	personal	0	2027	2026-04-07 15:42:53.468636	2026-04-07 15:42:53.468636	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
f9964b23-61e9-4e76-bc67-a7b56034fd6b	6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	maternity	0	2026	2026-04-07 15:37:14.89265	2026-04-07 15:37:14.89265	90.00	0.00	90.00	0.00	75.00	f	\N	0.00	0.00
c1613574-0989-4345-8779-8270bc180e3d	6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	paternity	0	2026	2026-04-07 15:37:14.89265	2026-04-07 15:37:14.89265	7.00	0.00	7.00	0.00	75.00	f	\N	0.00	0.00
966852e2-b663-49d6-a4f4-9894ba620dc0	6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	annual	0	2027	2026-04-07 15:37:14.89265	2026-04-07 15:37:14.89265	6.00	0.00	6.00	0.00	100.00	f	\N	0.00	0.00
45072577-61f0-4421-9480-bbac2bfa674b	6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	sick	0	2027	2026-04-07 15:37:14.89265	2026-04-07 15:37:14.89265	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
6ea931ad-dbb9-4748-bb38-15098cc313e9	6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	personal	0	2027	2026-04-07 15:37:14.89265	2026-04-07 15:37:14.89265	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
04452af1-1ab5-4952-b4a9-d01b12c02062	6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	maternity	0	2027	2026-04-07 15:37:14.89265	2026-04-07 15:37:14.89265	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
d70cc293-5370-4d89-b9af-aefd0b401325	6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	paternity	0	2027	2026-04-07 15:37:14.89265	2026-04-07 15:37:14.89265	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
e974e13f-a842-4ae4-a0ea-3322f5ba7be8	8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	maternity	0	2027	2026-04-07 15:42:53.468636	2026-04-07 15:42:53.468636	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
40ab04a0-8e69-4a79-b3b2-9ca3a30c2356	8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	paternity	0	2027	2026-04-07 15:42:53.468636	2026-04-07 15:42:53.468636	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
e5588d2a-17c9-470c-b786-aef04f529f35	8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	annual	0	2026	2026-04-07 15:42:53.468636	2026-04-07 15:42:53.529449	5.50	0.00	5.50	0.00	75.00	f	manual-adjustment:annual:1:by-2026-04-07T08:42:53.529Z	0.00	1.00
a6ed897c-16ee-4ca4-be33-b6a77d2efd93	8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	sick	0	2026	2026-04-07 15:42:53.468636	2026-04-07 15:43:08.630039	11.50	0.00	11.50	0.00	75.00	f	manual-adjustment:sick:0.5:by-2026-04-07T08:42:53.531Z\nmanual-adjustment:sick:1:by-2026-04-07T08:43:08.629Z	0.00	1.50
e4187ee2-dd1d-411b-bc75-7aa4bd5d6fe6	8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	personal	0	2026	2026-04-07 15:42:53.468636	2026-04-07 15:43:08.633912	5.50	0.00	5.50	0.00	75.00	f	manual-adjustment:personal:0.5:by-2026-04-07T08:43:08.633Z	0.00	0.50
afb7bd92-433a-4a90-a621-7dfa02ea81b2	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	personal	0	2026	2026-04-07 16:56:27.788206	2026-04-07 16:56:27.788206	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
f086c4f3-6d44-469e-aa20-059aae32f4e5	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	maternity	0	2026	2026-04-07 16:56:27.788206	2026-04-07 16:56:27.788206	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
fcf29010-f8ea-4ed4-b0f4-7dacbaf08ef0	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	paternity	0	2026	2026-04-07 16:56:27.788206	2026-04-07 16:56:27.788206	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
bf569198-0a56-46b2-bece-7a5afebd4af2	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	annual	0	2027	2026-04-07 16:56:27.788206	2026-04-07 16:56:27.788206	13.00	0.00	13.00	0.00	100.00	f	\N	0.00	0.00
2fb6ac41-6621-466a-8d8f-329591dfab80	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	annual	0	2026	2026-04-07 16:56:27.788206	2026-04-08 17:31:07.820439	12.00	2.00	10.00	0.00	100.00	f	\N	0.00	0.00
7501abc1-080d-4452-8930-c6aab2e8344f	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	sick	0	2026	2026-04-07 16:56:27.788206	2026-04-09 01:32:47.684832	30.00	4.00	26.00	0.00	100.00	f	\N	0.00	0.00
298c2f7c-0c3a-4f6c-a7fc-0f043f36702c	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	sick	0	2027	2026-04-07 16:56:27.788206	2026-04-07 16:56:27.788206	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
981cc082-aa44-458d-8417-c16e8a0c66e6	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	personal	0	2027	2026-04-07 16:56:27.788206	2026-04-07 16:56:27.788206	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
b7b4de61-ac58-46f4-b196-cac35f7375e1	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	maternity	0	2027	2026-04-07 16:56:27.788206	2026-04-07 16:56:27.788206	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
932112d3-1742-45a4-90e0-41154c4df536	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	paternity	0	2027	2026-04-07 16:56:27.788206	2026-04-07 16:56:27.788206	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
3ec37867-e32c-4715-9e40-f9b4679b1980	130685a3-1057-468d-a338-2e2d06aac5c5	personal	0	2026	2026-04-07 17:23:51.624868	2026-04-07 17:23:51.624868	5.00	0.00	5.00	0.00	91.67	f	\N	0.00	0.00
ab75b058-35dd-4593-bb0e-6f22fb72b5b4	130685a3-1057-468d-a338-2e2d06aac5c5	maternity	0	2026	2026-04-07 17:23:51.624868	2026-04-07 17:23:51.624868	90.00	0.00	90.00	0.00	91.67	f	\N	0.00	0.00
e434cca0-c051-4445-8e82-bb7b80b0ef57	130685a3-1057-468d-a338-2e2d06aac5c5	paternity	0	2026	2026-04-07 17:23:51.624868	2026-04-07 17:23:51.624868	7.00	0.00	7.00	0.00	91.67	f	\N	0.00	0.00
8ac19de1-51b8-4b9c-97c1-3719db3d341c	130685a3-1057-468d-a338-2e2d06aac5c5	annual	0	2027	2026-04-07 17:23:51.624868	2026-04-07 17:23:51.624868	6.00	0.00	6.00	0.00	100.00	f	\N	0.00	0.00
c760dcc6-3721-40cb-acca-2022381ffadb	130685a3-1057-468d-a338-2e2d06aac5c5	sick	0	2027	2026-04-07 17:23:51.624868	2026-04-07 17:23:51.624868	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
41b23f2e-1d24-41d2-b100-57077cba96b9	130685a3-1057-468d-a338-2e2d06aac5c5	personal	0	2027	2026-04-07 17:23:51.624868	2026-04-07 17:23:51.624868	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
8eb4a4d4-e7d6-4225-a80f-f8a1cd824c3d	130685a3-1057-468d-a338-2e2d06aac5c5	maternity	0	2027	2026-04-07 17:23:51.624868	2026-04-07 17:23:51.624868	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
0ac6bd47-8ac4-455c-a9ea-6017e76c11ef	130685a3-1057-468d-a338-2e2d06aac5c5	paternity	0	2027	2026-04-07 17:23:51.624868	2026-04-07 17:23:51.624868	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
4d055c96-54a9-44e4-bfcb-cc51788613a5	caf92029-47ec-4419-bf2f-685e22390cae	annual	0	2026	2026-04-08 04:56:38.29705	2026-04-08 04:56:38.29705	4.50	0.00	4.50	0.00	75.00	f	\N	0.00	0.00
4c170e55-d0e4-4da8-841d-10f1f7c31c29	caf92029-47ec-4419-bf2f-685e22390cae	sick	0	2026	2026-04-08 04:56:38.29705	2026-04-08 04:56:38.29705	10.00	0.00	10.00	0.00	75.00	f	\N	0.00	0.00
30d59354-774f-4fb8-85f0-011b0b8a1739	caf92029-47ec-4419-bf2f-685e22390cae	personal	0	2026	2026-04-08 04:56:38.29705	2026-04-08 04:56:38.29705	5.00	0.00	5.00	0.00	75.00	f	\N	0.00	0.00
f032da94-98db-4f39-8298-41bd11e5adf1	caf92029-47ec-4419-bf2f-685e22390cae	maternity	0	2026	2026-04-08 04:56:38.29705	2026-04-08 04:56:38.29705	90.00	0.00	90.00	0.00	75.00	f	\N	0.00	0.00
e46fcf75-83c3-43ad-bc74-eab091c5d3d5	caf92029-47ec-4419-bf2f-685e22390cae	paternity	0	2026	2026-04-08 04:56:38.29705	2026-04-08 04:56:38.29705	7.00	0.00	7.00	0.00	75.00	f	\N	0.00	0.00
87ce9514-8559-418f-924e-7aac33c41044	b3742e10-166c-44e7-9acf-9f02f1c10628	annual	0	2026	2026-04-08 04:56:38.439291	2026-04-08 04:56:38.439291	4.50	0.00	4.50	0.00	75.00	f	\N	0.00	0.00
58c2a8a5-6920-43c5-aa50-9541e42bfa4d	b3742e10-166c-44e7-9acf-9f02f1c10628	sick	0	2026	2026-04-08 04:56:38.439291	2026-04-08 04:56:38.439291	10.00	0.00	10.00	0.00	75.00	f	\N	0.00	0.00
fa82852f-051f-4a99-ae8a-87c23b86de49	b3742e10-166c-44e7-9acf-9f02f1c10628	personal	0	2026	2026-04-08 04:56:38.439291	2026-04-08 04:56:38.439291	5.00	0.00	5.00	0.00	75.00	f	\N	0.00	0.00
38fb23f5-5167-4b86-9325-8bfddeb261fd	b3742e10-166c-44e7-9acf-9f02f1c10628	maternity	0	2026	2026-04-08 04:56:38.439291	2026-04-08 04:56:38.439291	90.00	0.00	90.00	0.00	75.00	f	\N	0.00	0.00
fca2c091-36f6-49de-b3f2-4ba0c087ea42	b3742e10-166c-44e7-9acf-9f02f1c10628	paternity	0	2026	2026-04-08 04:56:38.439291	2026-04-08 04:56:38.439291	7.00	0.00	7.00	0.00	75.00	f	\N	0.00	0.00
92f9d7d5-e356-474b-b704-ff8c62b42593	3da0ed69-ec12-42e2-99f3-2f84e55a452f	annual	0	2026	2026-04-08 16:11:12.777266	2026-04-08 16:11:12.777266	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
ab57df52-4a93-45b1-bd95-b957a1c5fbcf	3da0ed69-ec12-42e2-99f3-2f84e55a452f	sick	0	2026	2026-04-08 16:11:12.777266	2026-04-08 16:11:12.777266	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
944501a5-46fb-4aa4-ad30-6b21f0fc6fd1	3da0ed69-ec12-42e2-99f3-2f84e55a452f	personal	0	2026	2026-04-08 16:11:12.777266	2026-04-08 16:11:12.777266	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
e4107c62-0103-4f46-a14f-e9f075464430	3da0ed69-ec12-42e2-99f3-2f84e55a452f	maternity	0	2026	2026-04-08 16:11:12.777266	2026-04-08 16:11:12.777266	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
edad6d1e-abfa-4551-8463-e76b71432a6e	3da0ed69-ec12-42e2-99f3-2f84e55a452f	paternity	0	2026	2026-04-08 16:11:12.777266	2026-04-08 16:11:12.777266	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
237b458e-7f5f-43b1-9537-9ce2af6daa46	3da0ed69-ec12-42e2-99f3-2f84e55a452f	annual	0	2027	2026-04-08 16:11:12.777266	2026-04-08 16:11:12.777266	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
66769667-9a1b-4ce1-894f-e68e76b145ce	3da0ed69-ec12-42e2-99f3-2f84e55a452f	sick	0	2027	2026-04-08 16:11:12.777266	2026-04-08 16:11:12.777266	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
3236ad85-c7f5-41b8-b182-fba03ba2e800	3da0ed69-ec12-42e2-99f3-2f84e55a452f	personal	0	2027	2026-04-08 16:11:12.777266	2026-04-08 16:11:12.777266	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
6504f430-4746-41a8-849d-de064d8dbd0e	3da0ed69-ec12-42e2-99f3-2f84e55a452f	maternity	0	2027	2026-04-08 16:11:12.777266	2026-04-08 16:11:12.777266	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
16c3b85a-13af-4816-8982-fd716acea179	3da0ed69-ec12-42e2-99f3-2f84e55a452f	paternity	0	2027	2026-04-08 16:11:12.777266	2026-04-08 16:11:12.777266	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
7dbecf7c-74d5-4589-9f0a-ccda965c1fd5	130685a3-1057-468d-a338-2e2d06aac5c5	annual	0	2026	2026-04-07 17:23:51.624868	2026-04-08 17:35:37.579833	5.50	2.00	3.50	0.00	91.67	f	 | hr-adjusted-quota	0.00	0.00
622e7c5b-4f8c-439e-b1b6-9260d51e8b9b	130685a3-1057-468d-a338-2e2d06aac5c5	sick	0	2026	2026-04-07 17:23:51.624868	2026-04-08 18:12:43.659126	10.00	5.00	5.00	0.00	91.67	f	\N	0.00	0.00
47236afa-f65a-4b3e-93ae-0c17808f06f9	9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	sick	0	2026	2026-04-09 01:28:41.813283	2026-04-09 01:28:41.813283	10.00	0.00	10.00	0.00	75.00	f	\N	0.00	0.00
9dc063ad-d2bd-43be-a4f4-b4d837514a94	9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	personal	0	2026	2026-04-09 01:28:41.813283	2026-04-09 01:28:41.813283	5.00	0.00	5.00	0.00	75.00	f	\N	0.00	0.00
1e3ebd71-7ab9-4dbe-b8b9-ce3dad1e96aa	9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	maternity	0	2026	2026-04-09 01:28:41.813283	2026-04-09 01:28:41.813283	90.00	0.00	90.00	0.00	75.00	f	\N	0.00	0.00
3dc60102-143b-4bc1-a6bf-7f1476e13bdb	9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	paternity	0	2026	2026-04-09 01:28:41.813283	2026-04-09 01:28:41.813283	7.00	0.00	7.00	0.00	75.00	f	\N	0.00	0.00
b5abcdfa-cbfc-45cc-9a38-b6451cc0470d	9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	annual	0	2027	2026-04-09 01:28:41.813283	2026-04-09 01:28:41.813283	6.00	0.00	6.00	0.00	100.00	f	\N	0.00	0.00
1130fab2-6399-456c-b99f-b8333713d70c	9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	sick	0	2027	2026-04-09 01:28:41.813283	2026-04-09 01:28:41.813283	30.00	0.00	30.00	0.00	100.00	f	\N	0.00	0.00
a7ebfc7d-9749-4aad-a6c2-ee0036f45084	9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	personal	0	2027	2026-04-09 01:28:41.813283	2026-04-09 01:28:41.813283	3.00	0.00	3.00	0.00	100.00	f	\N	0.00	0.00
d5c11a68-ebe2-46b0-aabc-166ddc6f2bcb	9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	maternity	0	2027	2026-04-09 01:28:41.813283	2026-04-09 01:28:41.813283	120.00	0.00	120.00	0.00	100.00	f	\N	0.00	0.00
feb47187-c301-4f72-8acf-c66316f4ea9d	9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	paternity	0	2027	2026-04-09 01:28:41.813283	2026-04-09 01:28:41.813283	15.00	0.00	15.00	0.00	100.00	f	\N	0.00	0.00
52fdb803-8900-463f-b7e7-0ce06a7339b4	9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	annual	0	2026	2026-04-09 01:28:41.813283	2026-04-09 01:28:41.86719	4.50	0.00	4.50	0.00	75.00	f	 | hr-adjusted-quota	0.00	0.00
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (id, user_id, email, display_name, first_name, last_name, id_card_number, employment_date, employment_status, annual_leave_days, department, department_id, "position", manager_id, phone, address, birth_date, gender, employee_type, status, created_at, updated_at, probation_end_date, pro_rate_applied_for_year, last_leave_calculation_date, start_date, employee_code, prefix, position_id, end_date) FROM stdin;
b3742e10-166c-44e7-9acf-9f02f1c10628	\N	smoke.1775547391634@example.com	\N	Smoke	Test	\N	\N	probation	15	\N	311a1d6b-a22c-4b67-9834-321124f96352	\N	\N	0800000000	\N	\N	\N	permanent	active	2026-04-07 14:36:31.638875	2026-04-07 14:36:31.638875	\N	\N	\N	2026-04-01	SMK1775547391634	\N	e34e1c79-b456-4d4c-b96a-38f3367982e2	\N
caf92029-47ec-4419-bf2f-685e22390cae	\N	smoke.1775547467254@example.com	\N	Smoke	Test	\N	\N	probation	15	\N	311a1d6b-a22c-4b67-9834-321124f96352	\N	\N	0800000000	\N	\N	\N	permanent	active	2026-04-07 14:37:47.257161	2026-04-07 14:37:47.257161	\N	\N	\N	2026-04-01	SMK1775547467254	\N	e34e1c79-b456-4d4c-b96a-38f3367982e2	\N
6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	\N	smoke.1775551034874@example.com	\N	Smoke	Test	\N	\N	probation	15	\N	311a1d6b-a22c-4b67-9834-321124f96352	\N	\N	0899999999	\N	\N	\N	permanent	active	2026-04-07 15:37:14.877997	2026-04-07 15:37:14.877997	\N	\N	\N	2026-04-01	SMK1775551034874	\N	e34e1c79-b456-4d4c-b96a-38f3367982e2	\N
8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	\N	smoke.1775551373@example.com	\N	Smoke	Test	\N	\N	probation	15	\N	311a1d6b-a22c-4b67-9834-321124f96352	\N	\N	0899999999	\N	\N	\N	permanent	active	2026-04-07 15:42:53.458923	2026-04-07 15:42:53.458923	\N	\N	\N	2026-04-01	SMK1775551373	\N	e34e1c79-b456-4d4c-b96a-38f3367982e2	\N
130685a3-1057-468d-a338-2e2d06aac5c5	735927ff-660d-435d-a61f-ba00f8c12bb6	nongkanjung@gmail.com	\N	test	test	\N	\N	probation	15	\N	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	\N	\N		\N	\N	\N	permanent	active	2026-04-07 17:23:51.610693	2026-04-07 17:23:51.610693	\N	\N	\N	2026-02-01	T2019	\N	5f936e6f-b16f-4575-a764-129de08201d0	\N
3da0ed69-ec12-42e2-99f3-2f84e55a452f	cfea03aa-c9b3-47cf-87b2-b966985b5496	nongkan.jung@gmail.com	\N	ceo	ceo	\N	\N	probation	15	\N	\N	\N	\N	\N	\N	\N	\N	permanent	active	2026-04-08 16:11:12.763998	2026-04-08 16:11:12.763998	\N	\N	\N	\N	\N	\N	\N	\N
8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	6bdda66c-cd57-4493-83a8-703d52ebad61	rattikan@tlogical.com	\N	Rattikanl	Gunjaima	\N	\N	probation	15	\N	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	\N	\N		\N	\N	\N	permanent	active	2026-04-07 16:56:27.782817	2026-04-07 16:56:27.782817	\N	\N	\N	2019-11-21	T19006	\N	5f936e6f-b16f-4575-a764-129de08201d0	\N
9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	c7546f0f-1e3d-42ed-b4c0-7c3cd59fa38b	rattikan50@hotmail.com	\N	dddfdf	dfdfd	\N	\N	probation	15	\N	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	\N	\N		\N	\N	\N	permanent	active	2026-04-09 01:28:41.809443	2026-04-09 01:28:41.809443	\N	\N	\N	2026-04-01	1234	\N	5f936e6f-b16f-4575-a764-129de08201d0	\N
\.


--
-- Data for Name: holidays; Type: TABLE DATA; Schema: public; Owner: postgres
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
-- Data for Name: leave_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave_attachments (id, leave_request_id, file_name, file_path, file_size, mime_type, uploaded_at) FROM stdin;
1	3c48436a-cdfe-455d-bb9f-c35e2a9a8666	Screenshot 2569-04-08 at 14.36.45.png	/uploads/leaves/1775644586459_mze7pq9z_Screenshot_2569-04-08_at_14_36_45.png	86220	image/png	2026-04-08 17:36:26.545245
2	8d917557-2612-4952-a61a-7b5bd9e5d19c	Screenshot 2569-04-08 at 12.25.31.png	/uploads/leaves/1775647649080_bgaehqls_Screenshot_2569-04-08_at_12_25_31.png	145637	image/png	2026-04-08 18:27:29.124359
\.


--
-- Data for Name: leave_balance_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave_balance_history (id, employee_id, year, leave_type, previous_entitled_days, previous_used_days, previous_remaining_days, new_entitled_days, new_used_days, new_remaining_days, change_reason, changed_by, changed_at, created_at) FROM stdin;
\.


--
-- Data for Name: leave_calculation_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave_calculation_log (id, employee_id, calculation_type, calculation_date, years_of_service, tenure_year_for_policy, policy_id, base_quota, pro_rate_percent, final_entitled_days, calculation_details, calculated_by, calculated_at, created_at) FROM stdin;
77a50006-7d80-4100-a870-4d172a49aafb	6d673556-8dcd-40d9-8b9b-4d6a7a57eb3d	new_hire_prorate	2026-04-07	0	0	\N	\N	100.00	4.50	\N	system	2026-04-07 15:37:14.89265	2026-04-07 15:37:14.89265
d3bb6327-f448-4b71-aa1c-3f5f0b8974d9	8cb4cc73-9ee7-4ed5-b534-0a45dbf6b029	new_hire_prorate	2026-04-07	0	0	\N	\N	100.00	4.50	\N	system	2026-04-07 15:42:53.468636	2026-04-07 15:42:53.468636
41b0c99a-581f-4559-9db8-de89cf834048	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	new_hire_prorate	2026-04-07	6	6	\N	\N	100.00	12.00	\N	system	2026-04-07 16:56:27.788206	2026-04-07 16:56:27.788206
ea57b253-7f92-4962-b8cf-084512801429	130685a3-1057-468d-a338-2e2d06aac5c5	new_hire_prorate	2026-04-07	0	0	\N	\N	100.00	5.50	\N	system	2026-04-07 17:23:51.624868	2026-04-07 17:23:51.624868
54be43e8-154a-42a3-9a96-404d35131932	caf92029-47ec-4419-bf2f-685e22390cae	new_hire_prorate	2026-04-08	0	0	\N	\N	100.00	4.50	\N	system	2026-04-08 04:56:38.29705	2026-04-08 04:56:38.29705
a173187f-341a-42a2-b46e-3a5fa1ace19a	b3742e10-166c-44e7-9acf-9f02f1c10628	new_hire_prorate	2026-04-08	0	0	\N	\N	100.00	4.50	\N	system	2026-04-08 04:56:38.439291	2026-04-08 04:56:38.439291
8d7dda60-4544-463f-8ff4-9c8aceec1590	3da0ed69-ec12-42e2-99f3-2f84e55a452f	new_hire_prorate	2026-04-08	56	56	\N	\N	100.00	15.00	\N	system	2026-04-08 16:11:12.777266	2026-04-08 16:11:12.777266
87bb207d-c146-4711-a081-a685b266b200	9d3b60ab-b1cc-4cb6-90b6-acc1c73761df	new_hire_prorate	2026-04-09	0	0	\N	\N	100.00	4.50	\N	system	2026-04-09 01:28:41.813283	2026-04-09 01:28:41.813283
\.


--
-- Data for Name: leave_entitlement_config; Type: TABLE DATA; Schema: public; Owner: postgres
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
-- Data for Name: leave_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave_policies (id, employee_type, employee_status, min_years_of_service, max_years_of_service, annual_leave_quota, sick_leave_quota, personal_leave_quota, maternity_leave_quota, paternity_leave_quota, is_prorated_first_year, is_prorated, description, active, created_at, updated_at, tenure_year_from, tenure_year_to, policy_name) FROM stdin;
3	contract	active	0	\N	6	30	3	120	15	t	t	พนักงานสัญญาจ้าง/ทดลองงาน	t	2026-04-06 19:43:47.207827	2026-04-07 01:56:09.088347	0	\N	\N
4	parttime	active	0	\N	3	15	3	90	7	f	f	พนักงานพาร์ทไทม์	t	2026-04-06 19:43:47.207827	2026-04-07 01:56:09.088347	0	\N	\N
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
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave_requests (id, employee_id, leave_type, start_date, end_date, total_days, reason, status, rejection_reason, approver_id, created_at, updated_at, start_time, end_time, is_half_day, half_day_period, approved_at) FROM stdin;
cad41119-bd4e-489c-abca-71c84756e90b	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	sick	2026-09-21	2026-09-21	1	Test sick leave attachment Monday	approved	\N	53ca0dcf-a94e-406e-b1c3-9668f752359e	2026-04-08 15:36:18.475045	2026-04-08 15:36:18.475045	08:30:00	17:30:00	f	\N	2026-04-08 17:26:57.162
168697d5-8ae9-45fd-8e5b-bfef8666f1d7	130685a3-1057-468d-a338-2e2d06aac5c5	vacation	2026-05-11	2026-05-11	1	ทดสอบรูปแบบอีเมลใหม่	rejected	ทดสอบการปฏิเสธการลา	\N	2026-04-08 14:12:05.628746	2026-04-08 14:12:05.628746	08:30:00	17:30:00	f	\N	\N
3967519e-f6f7-4735-8e3d-e6c8e813ea67	130685a3-1057-468d-a338-2e2d06aac5c5	vacation	2026-05-08	2026-05-08	1	email async timeout test	approved	\N	6bdda66c-cd57-4493-83a8-703d52ebad61	2026-04-08 08:04:22.972441	2026-04-08 08:04:22.972441	08:30:00	17:30:00	f	\N	2026-04-08 17:29:38.018
80ab05c6-db64-43cf-a9d8-6b1e0dbc9758	130685a3-1057-468d-a338-2e2d06aac5c5	vacation	2026-05-08	2026-05-08	1	email env verify	rejected	ทดสอบการไม่อนุมัติ	\N	2026-04-08 08:26:55.980692	2026-04-08 08:26:55.980692	08:30:00	17:30:00	f	\N	\N
6abc0f2e-b491-4cf0-88e7-3edb40cbc30a	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	sick	2026-04-08	2026-04-08	1	sdfdddfddfdfdf	approved	\N	cfea03aa-c9b3-47cf-87b2-b966985b5496	2026-04-08 16:06:11.445532	2026-04-08 16:06:11.445532	08:30:00	17:30:00	f	\N	2026-04-08 17:31:01.553
5e38090c-86c7-45b0-97fd-748df0d5dfe3	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	sick	2026-04-08	2026-04-08	1	ทดสอบการลาป่วย	approved	\N	cfea03aa-c9b3-47cf-87b2-b966985b5496	2026-04-08 16:01:45.884934	2026-04-08 16:01:45.884934	08:30:00	17:30:00	f	\N	2026-04-08 17:31:05.736
1f945168-3a5c-4950-990f-12540ab27cbf	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	vacation	2026-04-16	2026-04-17	2	กกกกกกกกก	approved	\N	cfea03aa-c9b3-47cf-87b2-b966985b5496	2026-04-08 07:39:10.834411	2026-04-08 07:39:10.834411	08:30:00	17:30:00	f	\N	2026-04-08 17:31:07.819
8f8932ad-b002-4c47-a762-bb68c58d2449	130685a3-1057-468d-a338-2e2d06aac5c5	vacation	2026-05-07	2026-05-07	1	email notify retest	approved	\N	53ca0dcf-a94e-406e-b1c3-9668f752359e	2026-04-08 07:48:15.268628	2026-04-08 07:48:15.268628	08:30:00	17:30:00	f	\N	2026-04-08 17:35:37.571
ab361846-a929-4dce-980f-7e9aa8fa7a2a	130685a3-1057-468d-a338-2e2d06aac5c5	sick	2026-05-06	2026-05-06	1	api smoke success	rejected	ทดสอบการปฏิเสธการลา	\N	2026-04-08 07:36:47.399551	2026-04-08 07:36:47.399551	08:30:00	17:30:00	f	\N	\N
3c48436a-cdfe-455d-bb9f-c35e2a9a8666	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	personal	2026-04-09	2026-04-09	1	แแอแแแอหก	rejected	ทดสอบการปฏิเสธการลา	\N	2026-04-08 17:36:26.538581	2026-04-08 17:36:26.538581	08:30:00	17:30:00	f	\N	\N
44536303-d9cc-49e0-b3f9-e1ad231a8620	130685a3-1057-468d-a338-2e2d06aac5c5	sick	2026-04-07	2026-04-07	1	กะหกดหกกดกดกหหกดกหกดกดหหกดกหดดกห	approved	\N	53ca0dcf-a94e-406e-b1c3-9668f752359e	2026-04-08 14:19:10.984321	2026-04-08 14:19:10.984321	08:30:00	17:30:00	f	\N	2026-04-08 17:42:47.164
2ad63fac-c8a9-4afb-a987-3aee0241b202	130685a3-1057-468d-a338-2e2d06aac5c5	sick	2026-04-07	2026-04-07	1	กะหกดหกกดกดกหหกดกหกดกดหหกดกหดดกห	approved	\N	cfea03aa-c9b3-47cf-87b2-b966985b5496	2026-04-08 14:19:02.646443	2026-04-08 14:19:02.646443	08:30:00	17:30:00	f	\N	2026-04-08 17:45:13.947
d392196f-2fd0-439a-841a-427b5d6a408e	130685a3-1057-468d-a338-2e2d06aac5c5	sick	2026-04-07	2026-04-07	1	กะหกดหกกดกดกหหกดกหกดกดหหกดกหดดกห	approved	\N	53ca0dcf-a94e-406e-b1c3-9668f752359e	2026-04-08 14:18:56.468415	2026-04-08 14:18:56.468415	08:30:00	17:30:00	f	\N	2026-04-08 18:12:43.657
8d917557-2612-4952-a61a-7b5bd9e5d19c	8b1835c2-b2c2-43c7-aaae-4ec4f5e4cb36	sick	2026-04-01	2026-04-01	1	hhhhhhhhhhh	approved	\N	cfea03aa-c9b3-47cf-87b2-b966985b5496	2026-04-08 18:27:29.117259	2026-04-08 18:27:29.117259	08:30:00	17:30:00	f	\N	2026-04-09 01:32:47.678
\.


--
-- Data for Name: leave_types; Type: TABLE DATA; Schema: public; Owner: postgres
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
-- Data for Name: notification_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_settings (id, department, role, email, notify_on_leave_request, notify_on_approval, notify_on_rejection, created_at, updated_at, dept_id, leave_type, to_list, cc_list, bcc_list, is_active) FROM stdin;
8fa89567-dea2-4c97-946b-a1b9364c11dd	IT	manager	it-manager@company.local	t	t	t	2026-04-06 15:32:22.466637	2026-04-07 13:31:21.681419	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	vacation	nongkanjung@gmail.com	rattikan50@hotmail.com		t
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, title, message, type, is_read, link, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.positions (id, name, department_id, description, created_at, updated_at) FROM stdin;
51e027ed-bc31-4b25-bdcc-a84160ce7d53	HR Manager	9a002a0d-c3db-469e-82e9-ec412a8762da	Human Resources Manager	2026-04-06 15:20:20.97762	2026-04-06 15:20:20.97762
e3dda3bd-5b0f-4646-95f8-354ae946cad9	Finance Manager	e48fb08b-4d94-411e-bf22-99384dd3a4a6	Finance Manager	2026-04-06 15:20:20.97762	2026-04-06 15:20:20.97762
e34e1c79-b456-4d4c-b96a-38f3367982e2	Accountant	e48fb08b-4d94-411e-bf22-99384dd3a4a6	Accountant	2026-04-06 15:20:20.97762	2026-04-06 15:20:20.97762
fdf37c85-fc23-4960-8400-d07a9ad725c4	Administrator	31bb4eac-6562-45b6-b182-948c388c54ee	Administrator	2026-04-06 15:20:20.97762	2026-04-06 15:20:20.97762
5f936e6f-b16f-4575-a764-129de08201d0	นักพัฒนาซอฟต์แวร์	d119b8f3-7d82-4afa-88a4-7a0e6bba6a97	นักพัฒนาซอฟต์แวร์	2026-04-06 15:20:20.97762	2026-04-06 15:20:20.97762
7207b785-2824-4cb4-8ac3-2eded9480275	CEO	5d6163ad-2a5a-434b-a086-888541b98502	\N	2026-04-07 04:03:52.366959	2026-04-07 04:03:52.366959
\.


--
-- Data for Name: user_auth; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_auth (id, email, password_hash, role, created_at, updated_at) FROM stdin;
53ca0dcf-a94e-406e-b1c3-9668f752359e	admin@tlogical.com	$2b$10$A/BrJBwWGWHxarRJThRMoeeEmjkheJ0VsJPqmYYIsA/5sDd5HSmdy	admin	2026-04-07 03:02:43.015448	2026-04-07 03:02:43.015448
735927ff-660d-435d-a61f-ba00f8c12bb6	nongkanjung@gmail.com	$2b$10$vtfEFuQ6nLEvbWQ9DrVDVufsEdNRunA.YOH2mkoWi3uuMu9n4jmHK	employee	2026-04-07 17:23:51.602362	2026-04-07 17:23:51.602362
4ffe0182-6b4f-4769-a0d6-a6ab7587d1f9	admin@hrdb.local	$2b$10$bJI/kGGK45WbYeHqMZhCXu7jzNFDLwJk.N1/bvE9qh1XFiX.TL1Ty	admin	2026-04-06 15:32:52.65172	2026-04-08 15:54:31.789004
cfea03aa-c9b3-47cf-87b2-b966985b5496	nongkan.jung@gmail.com	$2b$10$b1k3m5OFdnmCvIfDSVhKS.XHqkQQAID0lLatzu9Ylc92/U84x8V52	ceo	2026-04-08 16:11:12.678626	2026-04-08 16:11:12.678626
6bdda66c-cd57-4493-83a8-703d52ebad61	rattikan@tlogical.com	$2b$10$LvrzZUKWF/Yo41TQoN0V8.nOd1qjcHAKfxINbmaUaPeOSL.pWCX3C	supervisor	2026-04-07 16:17:15.580504	2026-04-07 16:17:15.580504
c7546f0f-1e3d-42ed-b4c0-7c3cd59fa38b	rattikan50@hotmail.com	$2b$10$YKiZzolZRmn4kPwAiu.JA.QvszGqOkvE3xYWe.iVMQ8RATvBYGPQ2	employee	2026-04-09 01:28:41.806139	2026-04-09 01:28:41.806139
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (id, user_id, role, assigned_at, assigned_by) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, display_name, role, is_active, created_at, updated_at) FROM stdin;
840e914e-b0f8-4570-85a8-569347de6d56	admin@hrdb.local	$2b$10$PLACEHOLDER_HASH	Administrator	admin	t	2026-04-06 15:20:20.994496	2026-04-06 15:20:20.994496
5d7d80a5-f153-496f-a709-a274afe20833	admin@system.com	$2b$10$O2tu1oWlpLeG2LWwbGntReBSo4PWysoACTjA1teIxeZ2jqwkP70nC	Admin User	admin	t	2026-04-06 15:19:16.702163	2026-04-06 15:19:16.702163
\.


--
-- Name: approval_workflows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.approval_workflows_id_seq', 3, true);


--
-- Name: leave_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leave_attachments_id_seq', 2, true);


--
-- Name: leave_policies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leave_policies_id_seq', 15, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_leave_type_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_leave_type_year_key UNIQUE (employee_id, leave_type, year);


--
-- Name: employee_leave_balances employee_leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_id_card_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_id_card_number_key UNIQUE (id_card_number);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_holiday_date_key UNIQUE (holiday_date);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: leave_attachments leave_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_attachments
    ADD CONSTRAINT leave_attachments_pkey PRIMARY KEY (id);


--
-- Name: leave_balance_history leave_balance_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balance_history
    ADD CONSTRAINT leave_balance_history_pkey PRIMARY KEY (id);


--
-- Name: leave_calculation_log leave_calculation_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_calculation_log
    ADD CONSTRAINT leave_calculation_log_pkey PRIMARY KEY (id);


--
-- Name: leave_entitlement_config leave_entitlement_config_config_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_entitlement_config
    ADD CONSTRAINT leave_entitlement_config_config_key_key UNIQUE (config_key);


--
-- Name: leave_entitlement_config leave_entitlement_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_entitlement_config
    ADD CONSTRAINT leave_entitlement_config_pkey PRIMARY KEY (id);


--
-- Name: leave_policies leave_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_policies
    ADD CONSTRAINT leave_policies_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_code_key UNIQUE (code);


--
-- Name: leave_types leave_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_name_key UNIQUE (name);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- Name: user_auth user_auth_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_auth
    ADD CONSTRAINT user_auth_email_key UNIQUE (email);


--
-- Name: user_auth user_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_auth
    ADD CONSTRAINT user_auth_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_employee_leave_balances_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_leave_balances_employee_id ON public.employee_leave_balances USING btree (employee_id);


--
-- Name: idx_employee_leave_balances_leave_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_leave_balances_leave_type ON public.employee_leave_balances USING btree (leave_type);


--
-- Name: idx_employee_leave_balances_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_leave_balances_year ON public.employee_leave_balances USING btree (employee_id, year);


--
-- Name: idx_employees_department; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_department ON public.employees USING btree (department);


--
-- Name: idx_employees_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_email ON public.employees USING btree (email);


--
-- Name: idx_employees_employee_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_employee_code ON public.employees USING btree (employee_code);


--
-- Name: idx_employees_position_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_position_id ON public.employees USING btree (position_id);


--
-- Name: idx_employees_probation_end_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_probation_end_date ON public.employees USING btree (probation_end_date);


--
-- Name: idx_employees_start_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_start_date ON public.employees USING btree (start_date);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_employees_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_user_id ON public.employees USING btree (user_id);


--
-- Name: idx_holidays_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_holidays_date ON public.holidays USING btree (holiday_date);


--
-- Name: idx_leave_attachments_leave_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_attachments_leave_request_id ON public.leave_attachments USING btree (leave_request_id);


--
-- Name: idx_leave_balance_history_changed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_balance_history_changed_at ON public.leave_balance_history USING btree (changed_at);


--
-- Name: idx_leave_balance_history_employee_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_balance_history_employee_year ON public.leave_balance_history USING btree (employee_id, year);


--
-- Name: idx_leave_balances_hybrid_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_balances_hybrid_employee ON public.employee_leave_balances USING btree (employee_id, year, leave_type);


--
-- Name: idx_leave_balances_hybrid_year_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_balances_hybrid_year_type ON public.employee_leave_balances USING btree (year, leave_type);


--
-- Name: idx_leave_calculation_log_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_calculation_log_date ON public.leave_calculation_log USING btree (calculation_date);


--
-- Name: idx_leave_calculation_log_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_calculation_log_employee ON public.leave_calculation_log USING btree (employee_id);


--
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- Name: idx_leave_requests_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_employee_id ON public.leave_requests USING btree (employee_id);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- Name: idx_notification_settings_department; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_settings_department ON public.notification_settings USING btree (department);


--
-- Name: idx_notification_settings_dept_leave_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_settings_dept_leave_type ON public.notification_settings USING btree (dept_id, leave_type);


--
-- Name: idx_notification_settings_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_settings_role ON public.notification_settings USING btree (role);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_positions_department_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_positions_department_id ON public.positions USING btree (department_id);


--
-- Name: idx_user_auth_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_auth_email ON public.user_auth USING btree (email);


--
-- Name: idx_user_auth_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_auth_role ON public.user_auth USING btree (role);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: employees employees_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_auth(id) ON DELETE SET NULL;


--
-- Name: leave_attachments leave_attachments_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_attachments
    ADD CONSTRAINT leave_attachments_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- Name: leave_balance_history leave_balance_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balance_history
    ADD CONSTRAINT leave_balance_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.employees(id);


--
-- Name: leave_balance_history leave_balance_history_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balance_history
    ADD CONSTRAINT leave_balance_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_calculation_log leave_calculation_log_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_calculation_log
    ADD CONSTRAINT leave_calculation_log_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_calculation_log leave_calculation_log_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_calculation_log
    ADD CONSTRAINT leave_calculation_log_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.leave_policies(id);


--
-- Name: leave_entitlement_config leave_entitlement_config_last_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_entitlement_config
    ADD CONSTRAINT leave_entitlement_config_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES public.employees(id);


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_auth(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_auth(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.user_auth(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_auth(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict rWUOJmsKjLWhtzBHCgeHdTYNf66WBKWOyBBuB2qownywaEq4UuA5ol0hUbeFjb8

