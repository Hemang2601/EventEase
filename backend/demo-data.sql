--
-- PostgreSQL database dump
--

\restrict 4lCiaxYsrUNcHa8hpC8Su9zLSJdqq55FETn6GtDJE0Y5VuvqnOut12MuXTvPtkg

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.9

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
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.events (id, owner_id, title, description, venue, starts_at, capacity, created_at, category, is_open, checkin_opens_minutes, cover_url, host_photo_url, host_name, edit_unlocked) FROM stdin;
9511ca8d-cb73-4cd3-af91-606a6aad496d	70051d5f-70db-479c-8d6a-88440829fe6a	Culture Branding	dasdfsdfsd	dfdsfds	2026-10-17 03:53:00+00	100	2026-10-08 03:53:55.343937+00	Technology	t	60	\N	\N	\N	f
90c8e98d-5f8d-400b-83b2-7b4da2e7d155	70051d5f-70db-479c-8d6a-88440829fe6a	Tech Fest 2026	Annual technology festival with project exhibitions, robotics and AI demos.	Main Auditorium, Atmiya University	2026-10-18 04:15:31.187962+00	200	2026-10-08 04:15:31.187962+00	Technology	t	60	\N	\N	Prof. Yuvraj Gosai	f
f2fb1850-867b-46ee-ac63-4c21ec17eed2	70051d5f-70db-479c-8d6a-88440829fe6a	Cultural Night	Music, dance and drama performances by student clubs.	Open Air Theatre	2026-10-23 04:15:31.187962+00	500	2026-10-08 04:15:31.187962+00	Cultural	t	60	\N	\N	Cultural Committee	f
6fda74f5-8039-4f87-b514-f08f0dae7d38	70051d5f-70db-479c-8d6a-88440829fe6a	Inter-College Sports Meet	Cricket, football, athletics and indoor games across colleges.	University Sports Ground	2026-10-28 04:15:31.187962+00	300	2026-10-08 04:15:31.187962+00	Sports	t	60	\N	\N	Sports Department	f
12aae9a1-46f0-42f1-b5d0-304b2aec460c	70051d5f-70db-479c-8d6a-88440829fe6a	Atmiya Avsar	\N	\N	2026-10-10 02:30:00+00	100	2026-10-08 03:45:12.664373+00	Technology	t	60	\N	\N	\N	f
dd411667-b555-44f4-b61b-fff7d999d659	70051d5f-70db-479c-8d6a-88440829fe6a	Code Carnival Hackathon	24-hour coding hackathon with prizes worth 1 lakh.	Computer Lab Block C	2026-10-13 04:15:00+00	100	2026-10-08 04:15:31.187962+00	Technology	t	59	\N	\N	CSI Student Chapter	f
\.


--
-- Data for Name: event_edit_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.event_edit_requests (id, event_id, requester_id, reason, status, admin_note, decided_at, created_at) FROM stdin;
864b71b1-9f36-46a0-a693-90caa9566fce	dd411667-b555-44f4-b61b-fff7d999d659	50a6d3df-a26b-469b-81d6-60891548a13e	Update seat	used	\N	2026-10-08 07:12:30.296369+00	2026-10-08 07:04:32.366354+00
\.


--
-- Data for Name: event_zones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.event_zones (id, event_id, name, capacity, created_at) FROM stdin;
39943f68-8de9-44dd-85be-cda07217863c	dd411667-b555-44f4-b61b-fff7d999d659	Auditorium 1	\N	2026-10-08 04:24:43.716336+00
873c3291-d29e-444c-9e36-d9798894fbe7	dd411667-b555-44f4-b61b-fff7d999d659	Auditorium 2	\N	2026-10-08 04:24:43.716336+00
17de190b-3ea2-471c-8f1c-448bed3c052d	dd411667-b555-44f4-b61b-fff7d999d659	Auditorium 3	\N	2026-10-08 04:24:43.716336+00
c100f5bb-7ea2-4445-aed0-9f027e4f9524	90c8e98d-5f8d-400b-83b2-7b4da2e7d155	Main Hall	100	2026-10-08 05:10:29.925979+00
867a7caf-ff5c-41d6-a01e-1528de9b4479	90c8e98d-5f8d-400b-83b2-7b4da2e7d155	Lab Block	50	2026-10-08 05:10:29.925979+00
f079dec3-4bed-4df3-83d3-fd936512bb1a	12aae9a1-46f0-42f1-b5d0-304b2aec460c	Auditorium 4	250	2026-10-08 07:41:19.692653+00
\.


--
-- Data for Name: participants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.participants (id, event_id, full_name, email, phone, department, code, checked_in_at, created_at, checked_in_gate, user_id, zone_id) FROM stdin;
325e3a40-9141-44a8-827c-ff2de6a74a88	12aae9a1-46f0-42f1-b5d0-304b2aec460c	yuvraj gosai	yuvrajgosai29@gmail.com	08511015826	mca	A142D6FE	2026-10-08 03:52:45.473895+00	2026-10-08 03:52:01.001024+00	Gate 01	\N	\N
6dc83ed0-7f33-4dde-b02d-79360793b9c9	f2fb1850-867b-46ee-ac63-4c21ec17eed2	Kavya Desai	kavya.desai@student.atmiya.edu	9876543214	BBA	EE-C7EF51	2026-10-08 01:15:31.187962+00	2026-10-08 04:15:31.187962+00	Main Gate	\N	\N
8797017f-08e2-4cab-8d23-5cc9d79b7214	f2fb1850-867b-46ee-ac63-4c21ec17eed2	Arjun Trivedi	arjun.trivedi@student.atmiya.edu	9876543215	BCA	EE-60F652	\N	2026-10-08 04:15:31.187962+00	\N	\N	\N
56fa1363-a5d5-446e-9d62-478429263cd1	f2fb1850-867b-46ee-ac63-4c21ec17eed2	Ishita Raval	ishita.raval@student.atmiya.edu	9876543216	B.Com	EE-6E37CE	\N	2026-10-08 04:15:31.187962+00	\N	\N	\N
7531e4e8-c73a-4a2f-91a9-36030f52a157	6fda74f5-8039-4f87-b514-f08f0dae7d38	Vivek Chavda	vivek.chavda@student.atmiya.edu	9876543217	Mechanical Engineering	EE-809AFA	2026-10-08 03:45:31.187962+00	2026-10-08 04:15:31.187962+00	Gate B	\N	\N
a4b0350f-2763-4a3a-9520-beaaa07dd68d	6fda74f5-8039-4f87-b514-f08f0dae7d38	Nisha Parmar	nisha.parmar@student.atmiya.edu	9876543218	Civil Engineering	EE-8955E8	\N	2026-10-08 04:15:31.187962+00	\N	\N	\N
b529f883-8966-4d87-aa5c-3518cf44f05a	6fda74f5-8039-4f87-b514-f08f0dae7d38	Devang Bhatt	devang.bhatt@student.atmiya.edu	9876543219	Mechanical Engineering	EE-798488	\N	2026-10-08 04:15:31.187962+00	\N	\N	\N
032a9395-a939-4878-9916-78e27c6d90fb	dd411667-b555-44f4-b61b-fff7d999d659	Manav Kothari	manav.kothari@student.atmiya.edu	9876543220	Computer Engineering	EE-DC9272	2026-10-08 03:30:31.187962+00	2026-10-08 04:15:31.187962+00	Auditorium 1	\N	39943f68-8de9-44dd-85be-cda07217863c
4230f9d1-f802-4641-b3d4-41b0f00ce5ad	dd411667-b555-44f4-b61b-fff7d999d659	Riya Solanki	riya.solanki@student.atmiya.edu	9876543221	Information Technology	EE-D1A3D4	2026-10-08 03:55:31.187962+00	2026-10-08 04:15:31.187962+00	Auditorium 2	\N	873c3291-d29e-444c-9e36-d9798894fbe7
e142934f-93a3-4c95-9e67-78eec3d5ded0	dd411667-b555-44f4-b61b-fff7d999d659	Kunal Vaghela	kunal.vaghela@student.atmiya.edu	9876543222	Computer Engineering	EE-FAA6E9	\N	2026-10-08 04:15:31.187962+00	\N	\N	17de190b-3ea2-471c-8f1c-448bed3c052d
d721f0b0-e45c-4ab0-86bb-1c88cf8fc1cb	dd411667-b555-44f4-b61b-fff7d999d659	Tanvi Gandhi	tanvi.gandhi@student.atmiya.edu	9876543223	BCA	EE-67C5BD	\N	2026-10-08 04:15:31.187962+00	\N	\N	39943f68-8de9-44dd-85be-cda07217863c
b94d3674-57d2-4bd0-8f66-fb5d5da704de	90c8e98d-5f8d-400b-83b2-7b4da2e7d155	Aarav Shah	aarav.shah@student.atmiya.edu	9876543210	Computer Engineering	EE-87D155	2026-10-08 02:15:31.187962+00	2026-10-08 04:15:31.187962+00	Gate A	\N	867a7caf-ff5c-41d6-a01e-1528de9b4479
4ffa67b0-7f68-4a87-b7af-7e4e6942f688	90c8e98d-5f8d-400b-83b2-7b4da2e7d155	Priya Patel	priya.patel@student.atmiya.edu	9876543211	Information Technology	EE-4DC1FE	\N	2026-10-08 04:15:31.187962+00	\N	\N	c100f5bb-7ea2-4445-aed0-9f027e4f9524
f9cad541-8bde-4425-8224-6dbf35a269b4	90c8e98d-5f8d-400b-83b2-7b4da2e7d155	Rohan Mehta	rohan.mehta@student.atmiya.edu	9876543212	Computer Engineering	EE-6B2618	2026-10-08 03:15:31.187962+00	2026-10-08 04:15:31.187962+00	Gate A	\N	867a7caf-ff5c-41d6-a01e-1528de9b4479
e9066c4d-b413-4ef8-8c27-95a5529a0750	90c8e98d-5f8d-400b-83b2-7b4da2e7d155	Sneha Joshi	sneha.joshi@student.atmiya.edu	9876543213	Electronics	EE-D781FA	\N	2026-10-08 04:15:31.187962+00	\N	\N	c100f5bb-7ea2-4445-aed0-9f027e4f9524
81ebc83a-855d-453b-8e9d-423f03f1fa24	90c8e98d-5f8d-400b-83b2-7b4da2e7d155	yuvraj gosai	yuvrajgosai22229@gmail.com	08511015826	mca	ED521726	\N	2026-10-08 05:32:48.896144+00	\N	33320d30-af66-4fdd-a08f-6523fd03e0a3	867a7caf-ff5c-41d6-a01e-1528de9b4479
8512185f-f598-44fd-a6a1-aa9af2b1cf57	f2fb1850-867b-46ee-ac63-4c21ec17eed2	Uvuv Student	uvuv2964@gmail.com	08511015826	MCA	CE2ABE3A	\N	2026-10-08 06:42:32.166955+00	\N	33320d30-af66-4fdd-a08f-6523fd03e0a3	\N
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, email, full_name, wants_organizer, created_at) FROM stdin;
3d00ec25-a791-427c-a1db-0f710904fa15	meera@gmail.com	meera shah	f	2026-10-08 05:11:43.600575+00
70051d5f-70db-479c-8d6a-88440829fe6a	yuvrajgosai29@gmail.com	Yuvraj Gosai	f	2026-10-08 04:02:45.574172+00
33320d30-af66-4fdd-a08f-6523fd03e0a3	uvuv2964@gmail.com	Uvuv Student	f	2026-10-08 05:00:18.702424+00
50a6d3df-a26b-469b-81d6-60891548a13e	yuvrajgosai2918@gmail.com	Yuvraj Gosai (Organizer)	f	2026-10-08 05:00:19.61597+00
cfa510ce-4688-4d8c-ae5f-7b95ad02c3a5	demo@gmail.com	Demo	f	2026-10-08 11:08:16.378123+00
\.


--
-- Data for Name: scan_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.scan_logs (id, event_id, participant_id, code, result, gate, participant_name, scanned_by, created_at) FROM stdin;
fc1262ec-9d22-4cb1-a57c-b39d46d870a5	12aae9a1-46f0-42f1-b5d0-304b2aec460c	325e3a40-9141-44a8-827c-ff2de6a74a88	A142D6FE	success	Gate 01	yuvraj gosai	70051d5f-70db-479c-8d6a-88440829fe6a	2026-10-08 03:52:45.473895+00
81eeb5c2-f598-4083-bfa3-0c5c78a56285	12aae9a1-46f0-42f1-b5d0-304b2aec460c	325e3a40-9141-44a8-827c-ff2de6a74a88	A142D6FE	duplicate	Gate 01	yuvraj gosai	70051d5f-70db-479c-8d6a-88440829fe6a	2026-10-08 03:52:50.820975+00
100bd994-0bf7-4261-8f05-7979e393a988	f2fb1850-867b-46ee-ac63-4c21ec17eed2	6dc83ed0-7f33-4dde-b02d-79360793b9c9	EE-C7EF51	success	Main Gate	Kavya Desai	\N	2026-10-08 04:15:31.187962+00
2b64ded7-a7c6-4c26-9a11-68673e3b653f	6fda74f5-8039-4f87-b514-f08f0dae7d38	7531e4e8-c73a-4a2f-91a9-36030f52a157	EE-809AFA	success	Gate B	Vivek Chavda	\N	2026-10-08 04:15:31.187962+00
77665582-c336-4edd-a575-c680c31fd56b	90c8e98d-5f8d-400b-83b2-7b4da2e7d155	b94d3674-57d2-4bd0-8f66-fb5d5da704de	EE-87D155	success	Lab Block	Aarav Shah	50a6d3df-a26b-469b-81d6-60891548a13e	2026-10-08 04:15:31.187962+00
e9967983-624a-46d6-81f9-f89e9fea224e	90c8e98d-5f8d-400b-83b2-7b4da2e7d155	f9cad541-8bde-4425-8224-6dbf35a269b4	EE-6B2618	success	Lab Block	Rohan Mehta	50a6d3df-a26b-469b-81d6-60891548a13e	2026-10-08 04:15:31.187962+00
4c511694-e090-4bf6-b1b3-7e0aa90bb0fb	dd411667-b555-44f4-b61b-fff7d999d659	032a9395-a939-4878-9916-78e27c6d90fb	EE-DC9272	success	Auditorium 1	Manav Kothari	50a6d3df-a26b-469b-81d6-60891548a13e	2026-10-08 04:15:31.187962+00
a78bbae2-6931-4c5d-88bd-84ccd3bce55c	dd411667-b555-44f4-b61b-fff7d999d659	4230f9d1-f802-4641-b3d4-41b0f00ce5ad	EE-D1A3D4	success	Auditorium 2	Riya Solanki	50a6d3df-a26b-469b-81d6-60891548a13e	2026-10-08 04:15:31.187962+00
a843e716-3c27-414a-b002-df04a3e8b0d3	12aae9a1-46f0-42f1-b5d0-304b2aec460c	\N	ED521726	too_early	Gate 01	\N	70051d5f-70db-479c-8d6a-88440829fe6a	2026-10-08 06:41:33.127617+00
be143df4-66d7-4e8e-aed1-7d0c4d6a26cb	dd411667-b555-44f4-b61b-fff7d999d659	\N	ED521726	too_early	Gate 01	\N	50a6d3df-a26b-469b-81d6-60891548a13e	2026-10-08 06:41:46.552536+00
\.


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_tickets (id, user_id, email, full_name, event_id, subject, message, status, reply, replied_by, replied_at, created_at) FROM stdin;
9179830d-d14e-4949-8d3c-9b05cd854425	70051d5f-70db-479c-8d6a-88440829fe6a	aarav.shah@student.atmiya.edu	Aarav Shah	\N	QR code not loading	My pass QR code is not showing on my phone. Please help before the event day.	open	\N	\N	\N	2026-10-08 04:15:31.187962+00
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, user_id, role, created_at) FROM stdin;
1c6608c2-11bc-4c93-b1b4-73a7a680a8dc	70051d5f-70db-479c-8d6a-88440829fe6a	student	2026-10-08 04:02:45.574172+00
f4d86a0b-b0f8-4121-b6be-e8b84535c228	70051d5f-70db-479c-8d6a-88440829fe6a	organizer	2026-10-08 04:02:45.574172+00
d56b8ac7-59f7-4232-a534-870715b97716	70051d5f-70db-479c-8d6a-88440829fe6a	admin	2026-10-08 04:02:45.574172+00
56804a12-bbf4-4550-8b2a-36ac9e870bd6	33320d30-af66-4fdd-a08f-6523fd03e0a3	student	2026-10-08 05:00:18.702424+00
49876423-c409-49ef-ba9f-8b354a3d789c	50a6d3df-a26b-469b-81d6-60891548a13e	student	2026-10-08 05:00:19.61597+00
f12bd9d1-209c-4a7c-b10e-e435bc411596	50a6d3df-a26b-469b-81d6-60891548a13e	organizer	2026-10-08 05:00:26.031723+00
d8669407-511a-40d5-bd07-cd54a1c5add1	3d00ec25-a791-427c-a1db-0f710904fa15	student	2026-10-08 05:11:43.600575+00
7e969860-0884-4755-8533-d73989c07a84	3d00ec25-a791-427c-a1db-0f710904fa15	organizer	2026-10-08 05:11:43.83289+00
b780e5e0-f3bc-40e3-b5f6-ad65ebd791b0	cfa510ce-4688-4d8c-ae5f-7b95ad02c3a5	student	2026-10-08 11:08:16.378123+00
\.


--
-- Data for Name: zone_staff; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.zone_staff (zone_id, user_id, created_at) FROM stdin;
39943f68-8de9-44dd-85be-cda07217863c	70051d5f-70db-479c-8d6a-88440829fe6a	2026-10-08 05:10:29.925979+00
867a7caf-ff5c-41d6-a01e-1528de9b4479	50a6d3df-a26b-469b-81d6-60891548a13e	2026-10-08 05:10:29.925979+00
c100f5bb-7ea2-4445-aed0-9f027e4f9524	50a6d3df-a26b-469b-81d6-60891548a13e	2026-10-08 05:10:29.925979+00
39943f68-8de9-44dd-85be-cda07217863c	50a6d3df-a26b-469b-81d6-60891548a13e	2026-10-08 05:10:29.925979+00
873c3291-d29e-444c-9e36-d9798894fbe7	50a6d3df-a26b-469b-81d6-60891548a13e	2026-10-08 05:10:29.925979+00
\.


--
-- PostgreSQL database dump complete
--

\unrestrict 4lCiaxYsrUNcHa8hpC8Su9zLSJdqq55FETn6GtDJE0Y5VuvqnOut12MuXTvPtkg

