# operation_schemas — Data Dictionary

Structured relational model derived from the legacy `app_state` JSON. 103 tables, 11,242 rows. Parent tables hold each top-level record; child tables (named `parent__field`) hold what used to be nested arrays, linked back by a `<parent>_id` foreign key. Synthetic child keys use `row_pk`.

## Conventions

- **Primary key**: `id` on parent tables, `row_pk` on child tables.
- **Foreign key**: child tables carry `<parent>_id` referencing the parent's `id`.
- Nested-array order preserved in the `idx` column; keyed maps preserved in `key`.
- Values that were themselves nested objects/arrays are stored as JSON text.

## Tables (103)

### `app_hooks`  ·  84 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| key | text |  |
| value | boolean |  |

### `app_meta`  ·  6 rows
_Miscellaneous top-level app flags/values._

| column | type | key |
|---|---|---|
| key | text |  |
| value | text |  |

### `boats`  ·  15 rows
_Fleet vessels._

| column | type | key |
|---|---|---|
| id | text | PK |
| name | text |  |
| type | text |  |
| pier | text |  |
| cap | bigint |  |
| enginecount | bigint |  |
| use | text |  |
| material | text |  |
| reg | text |  |
| callsign | text |  |
| imo | text |  |
| year | text |  |
| homeportcity | text |  |
| gt | double precision |  |
| nt | double precision |  |
| dwt | text |  |
| loa | double precision |  |
| beam | double precision |  |
| depth | double precision |  |
| draft | text |  |
| lbp | double precision |  |
| bhp | double precision |  |
| licensepax | bigint |  |
| crew | bigint |  |
| fishcrew | text |  |
| totalcap | bigint |  |
| owner | text |  |
| homeport | text |  |
| owneraddr | text |  |

**Child tables:** `boats__assignments` (6), `boats__docs` (57), `boats__log` (93), `boats__repairhistory` (32), `boats__repairhistory__assets` (35)

### `fleet_consumable_logs`  ·  1 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| date | text |  |
| itemid | text |  |
| itemname | text |  |
| unit | text |  |
| qty | bigint |  |
| unitcost | double precision |  |
| cost | double precision |  |
| location | text |  |
| boatid | text |  |
| engineid | text |  |
| enginelabel | text |  |
| by | text |  |
| note | text |  |

### `fleet_daily`  ·  27 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| key | text |  |
| b2_fuel | double precision |  |
| b10_fuel | double precision |  |
| b6_fuel | double precision |  |
| b13_fuel | double precision |  |
| b12_fuel | double precision |  |
| b10_paxactual | bigint |  |
| b2_paxactual | bigint |  |

**Child tables:** `fleet_daily__trips` (39)

### `fleet_drlock`  ·  24 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| key | text |  |
| panwa | boolean |  |

### `fleet_engines`  ·  53 rows
_Engines and their assignment to boats._

| column | type | key |
|---|---|---|
| id | text | PK |
| brand | text |  |
| model | text |  |
| serial | text |  |
| hp | bigint |  |
| boatid | text |  |
| pos | text |  |
| status | text |  |
| basehours | double precision |  |
| serviceinterval | bigint |  |
| buydate | text |  |
| note | text |  |
| sparelocation | text |  |
| price | text |  |
| lastservicehours | double precision |  |
| lastservicedate | text |  |

**Child tables:** `fleet_engines__log` (89)

### `fleet_fuelprice`  ·  24 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| key | text |  |
| panwa | double precision |  |
| b10 | double precision |  |
| b2 | double precision |  |
| b13 | double precision |  |
| b6 | double precision |  |

### `fleet_gearboxes`  ·  58 rows
_Gearboxes._

| column | type | key |
|---|---|---|
| id | text | PK |
| boatid | text |  |
| engineid | text |  |
| brand | text |  |
| model | text |  |
| serial | text |  |
| status | text |  |
| basehours | bigint |  |
| buydate | text |  |
| note | text |  |
| sparelocation | text |  |
| shaftlength | text |  |
| modelsuffix | text |  |
| installhours | double precision |  |
| rotation | text |  |
| gearratio | text |  |
| oilcapacity | text |  |
| serviceinterval | bigint |  |
| lastservicedate | text |  |
| onboatid | text |  |
| onboatpos | text |  |

**Child tables:** `fleet_gearboxes__log` (107)

### `fleet_incidents`  ·  35 rows
_Incident reports._

| column | type | key |
|---|---|---|
| id | text | PK |
| no | text |  |
| boatid | text |  |
| date | text |  |
| time | text |  |
| title | text |  |
| detail | text |  |
| remark | text |  |
| priority | bigint |  |
| severity | text |  |
| type | text |  |
| status | text |  |
| maintid | text |  |
| closeddate | text |  |
| quickfix | boolean |  |
| resolveddate | text |  |

**Child tables:** `fleet_incidents__damagedassets` (46), `fleet_incidents__progresslog` (246), `fleet_incidents__relatedmaintids` (12)

### `fleet_inventory`  ·  131 rows
_Spare-parts inventory._

| column | type | key |
|---|---|---|
| id | text | PK |
| name | text |  |
| partno | text |  |
| category | text |  |
| supplier | text |  |
| location | text |  |
| unit | text |  |
| qty | bigint |  |
| minqty | bigint |  |
| cost | double precision |  |
| note | text |  |
| totalqty | bigint |  |
| primarylocation | text |  |
| createddate | text |  |
| createdfrom | text |  |

**Child tables:** `fleet_inventory__history` (281), `fleet_inventory__history__changes` (21), `fleet_inventory__stocks` (157)

### `fleet_maintenance`  ·  62 rows
_Maintenance jobs._

| column | type | key |
|---|---|---|
| id | text | PK |
| no | text |  |
| boatid | text |  |
| type | text |  |
| title | text |  |
| detail | text |  |
| location | text |  |
| status | text |  |
| startdate | text |  |
| enddate | text |  |
| cost | double precision |  |
| incidentid | text |  |
| boatstatus | text |  |
| boatstatusreason | text |  |
| setfixing | boolean |  |
| outcome | text |  |
| parentprojectid | text |  |
| awaitinginvoice | boolean |  |
| closenote | text |  |

**Child tables:** `fleet_maintenance__assets` (62), `fleet_maintenance__parts` (83), `fleet_maintenance__progresslog` (327)

### `fleet_memos`  ·  66 rows
_Purchase memos / requisitions._

| column | type | key |
|---|---|---|
| id | text | PK |
| no | text |  |
| title | text |  |
| boatid | text |  |
| memotype | text |  |
| proposer | text |  |
| from | text |  |
| to | text |  |
| cc | text |  |
| createddate | text |  |
| status | text |  |
| currentstep | bigint |  |
| vatenabled | boolean |  |
| vatrate | bigint |  |
| refnote | text |  |
| subtotal | double precision |  |
| discount | double precision |  |
| vat | double precision |  |
| amount | double precision |  |
| approvedby | text |  |
| approveddate | text |  |
| approvenote | text |  |
| ordereddate | text |  |
| receiveddate | text |  |
| supplier | text |  |
| discountpct | bigint |  |
| maintid | text |  |
| scope | text |  |
| generalcategory | text |  |
| note | text |  |
| orderedby | text |  |
| receivedby | text |  |
| paiddate | text |  |
| paidby | text |  |
| paidvia | text |  |
| discountamt | bigint |  |
| afterdiscount | double precision |  |
| receivedlocation | text |  |
| receivedsummary | text |  |
| projectid | text |  |

**Child tables:** `fleet_memos__items` (235)

### `fleet_projects`  ·  16 rows
_Fleet projects (drydock etc.)._

| column | type | key |
|---|---|---|
| id | text | PK |
| no | text |  |
| name | text |  |
| boatid | text |  |
| type | text |  |
| vendor | text |  |
| planfrom | text |  |
| planto | text |  |
| actualfrom | text |  |
| actualto | text |  |
| status | text |  |
| plannedbudget | bigint |  |
| notes | text |  |
| createdat | text |  |
| createdby | text |  |
| originalplanto | text |  |

**Child tables:** `fleet_projects__log` (85), `fleet_projects__plan` (20)

### `fleet_propellers`  ·  62 rows
_Propellers._

| column | type | key |
|---|---|---|
| id | text | PK |
| boatid | text |  |
| gearboxid | text |  |
| brand | text |  |
| serial | text |  |
| diameter | double precision |  |
| pitch | double precision |  |
| size | text |  |
| blades | text |  |
| material | text |  |
| rotation | text |  |
| hubsize | text |  |
| cupping | text |  |
| cost | bigint |  |
| status | text |  |
| buydate | text |  |
| note | text |  |
| sparelocation | text |  |
| oldserial | text |  |
| proppos | text |  |
| engineid | text |  |

**Child tables:** `fleet_propellers__log` (152)

### `fleet_safety`  ·  94 rows
_Safety equipment register._

| column | type | key |
|---|---|---|
| id | text | PK |
| boatid | text |  |
| category | text |  |
| name | text |  |
| brand | text |  |
| model | text |  |
| serial | text |  |
| qty | bigint |  |
| installdate | text |  |
| expirydate | text |  |
| nextpm | text |  |
| lastinspect | text |  |
| status | text |  |
| location | text |  |
| note | text |  |

**Child tables:** `fleet_safety__inspections` (4), `fleet_safety__log` (98)

### `nat_learn`  ·  2320 rows
_Learned nationality-name mappings (app helper data)._

| column | type | key |
|---|---|---|
| id | text | PK |
| key | text |  |
| il | bigint |  |
| sa | bigint |  |
| th | bigint |  |
| in | bigint |  |
| sg | bigint |  |
| my | bigint |  |
| au | bigint |  |
| de | bigint |  |
| us | bigint |  |
| om | bigint |  |
| eg | bigint |  |
| ae | bigint |  |
| br | bigint |  |
| cn | bigint |  |
| es | bigint |  |
| mx | bigint |  |
| kr | bigint |  |
| bar2 | bigint |  |
| bar | bigint |  |
| nl | bigint |  |
| ru | bigint |  |
| jo | bigint |  |
| jp | bigint |  |
| gb | bigint |  |
| ca | bigint |  |
| qa | bigint |  |
| irq | bigint |  |
| za | bigint |  |
| cub | bigint |  |
| fr | bigint |  |
| eth | bigint |  |
| ie | bigint |  |
| kz | bigint |  |
| uz | bigint |  |
| tw | bigint |  |
| it | bigint |  |
| se | bigint |  |
| nig | bigint |  |
| ge | bigint |  |
| ph | bigint |  |
| ar | bigint |  |
| gha | bigint |  |
| nz | bigint |  |
| pk | bigint |  |
| kw | bigint |  |
| lk | bigint |  |
| mon | bigint |  |
| by | bigint |  |
| aus | bigint |  |
| cl | bigint |  |
| dk | bigint |  |
| kh | bigint |  |
| tr | bigint |  |
| rs | bigint |  |
| pt | bigint |  |
| gr | bigint |  |
| lit | bigint |  |
| be | bigint |  |
| fi | bigint |  |
| no | bigint |  |
| usa | bigint |  |

### `routes`  ·  12 rows
_Tour routes / programs._

| column | type | key |
|---|---|---|
| id | text | PK |
| name | text |  |
| islands | text |  |
| color | text |  |
| pier | text |  |
| overrides_2026_05_31 | text |  |
| overrides_2026_05_30 | text |  |
| overrides_2026_06_07 | text |  |
| overrides_2026_06_14 | text |  |
| overrides_2026_06_21 | text |  |
| overrides_2026_06_28 | text |  |
| overrides_2026_06_29 | text |  |
| overrides_2026_06_22 | text |  |
| overrides_2026_06_15 | text |  |
| overrides_2026_06_08 | text |  |
| overrides_2026_06_01 | text |  |
| overrides_2026_06_02 | text |  |
| overrides_2026_06_09 | text |  |
| overrides_2026_06_16 | text |  |
| overrides_2026_06_23 | text |  |
| overrides_2026_06_30 | text |  |
| overrides_2026_06_25 | text |  |
| overrides_2026_06_18 | text |  |
| overrides_2026_06_11 | text |  |
| overrides_2026_06_04 | text |  |
| overrides_2026_06_05 | text |  |
| overrides_2026_06_19 | text |  |
| overrides_2026_06_12 | text |  |
| overrides_2026_06_26 | text |  |
| overrides_2026_06_27 | text |  |
| overrides_2026_06_20 | text |  |
| overrides_2026_06_13 | text |  |
| overrides_2026_06_06 | text |  |
| overrides_2026_06_03 | text |  |
| overrides_2026_06_10 | text |  |
| overrides_2026_06_17 | text |  |
| overrides_2026_06_24 | text |  |
| overrides_2026_07_05 | text |  |
| overrides_2026_07_06 | text |  |
| overrides_2026_07_13 | text |  |
| overrides_2026_07_12 | text |  |
| overrides_2026_07_19 | text |  |
| overrides_2026_07_20 | text |  |
| overrides_2026_07_27 | text |  |
| overrides_2026_07_26 | text |  |
| overrides_2026_07_01 | text |  |
| overrides_2026_07_08 | text |  |
| overrides_2026_07_15 | text |  |
| overrides_2026_07_22 | text |  |
| overrides_2026_07_29 | text |  |
| overrides_2026_07_30 | text |  |
| overrides_2026_07_23 | text |  |
| overrides_2026_07_16 | text |  |
| overrides_2026_07_09 | text |  |
| overrides_2026_07_02 | text |  |
| overrides_2026_07_03 | text |  |
| overrides_2026_07_10 | text |  |
| overrides_2026_07_17 | text |  |
| overrides_2026_07_31 | text |  |
| overrides_2026_07_24 | text |  |
| overrides_2026_07_25 | text |  |
| overrides_2026_07_18 | text |  |
| overrides_2026_07_11 | text |  |
| overrides_2026_07_04 | text |  |
| overrides_2026_08_01 | text |  |
| overrides_2026_08_15 | text |  |
| overrides_2026_08_22 | text |  |
| overrides_2026_08_29 | text |  |
| overrides_2026_08_03 | text |  |
| overrides_2026_08_10 | text |  |
| overrides_2026_08_17 | text |  |
| overrides_2026_08_24 | text |  |
| overrides_2026_08_05 | text |  |
| overrides_2026_08_06 | text |  |
| overrides_2026_08_12 | text |  |
| overrides_2026_08_13 | text |  |
| overrides_2026_08_19 | text |  |
| overrides_2026_08_20 | text |  |
| overrides_2026_08_26 | text |  |
| overrides_2026_08_27 | text |  |

**Child tables:** `routes__seasons` (26), `routes__times` (12)

### `sb_agents`  ·  84 rows
_Travel agents / partners who sell trips._

| column | type | key |
|---|---|---|
| id | text | PK |
| code | text |  |
| name | text |  |
| market | text |  |
| sub | text |  |
| sales | text |  |
| paytype | text |  |
| vatmode | text |  |
| creditdays | bigint |  |
| creditlimit | bigint |  |
| creditbalance | bigint |  |
| contact | text |  |
| email | text |  |
| phone | text |  |
| note | text |  |
| contractstatus | text |  |
| contractversion | text |  |
| companyinfo_legalname | text |  |
| companyinfo_tatlicense | text |  |
| companyinfo_address | text |  |
| companyinfo_tel | text |  |
| companyinfo_hotline | text |  |
| companyinfo_fax | text |  |
| companyinfo_website | text |  |
| agentsignatory_name | text |  |
| agentsignatory_designation | text |  |
| agentsignatory_tel | text |  |
| agentsignatory_signeddate | text |  |
| bookingchannel_method | text |  |
| bookingchannel_cutoff | text |  |
| bookingchannel_cancelpolicy | text |  |
| bookingchannel_email | text |  |
| bookingchannel_phone | text |  |
| contractstart | text |  |
| contractend | text |  |
| ratetypeid | text |  |
| color | text |  |

**Child tables:** `sb_agents__activity` (174), `sb_agents__contracthistory` (2), `sb_agents__contracthistory__addonservices` (3), `sb_agents__contracthistory__addonservices__variants` (6), `sb_agents__contracthistory__prices` (8), `sb_agents__contracthistory__programperiods` (8), `sb_agents__programperiods` (497), `sb_agents__programs` (497)

### `sb_agents_rate_bindings`  ·  84 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| ratetypeid | text |  |

### `sb_bookings`  ·  762 rows
_Customer bookings (the core sales record)._

| column | type | key |
|---|---|---|
| id | text | PK |
| schemaver | bigint |  |
| createdat | text |  |
| createdby | text |  |
| voucherref | text |  |
| agentid | text |  |
| ratetyperef | text |  |
| leadpax | text |  |
| leadnationality | text |  |
| leadtype | text |  |
| leadfoc | boolean |  |
| leadphone | text |  |
| leademail | text |  |
| pickupareaid | text |  |
| pickupself | boolean |  |
| pickuparea | text |  |
| pickupzone | text |  |
| hotelname | text |  |
| roomnumber | text |  |
| dropoffsame | boolean |  |
| dropoffareaid | text |  |
| dropoffarea | text |  |
| dropoffhotelname | text |  |
| guides_english | boolean |  |
| guides_russian | boolean |  |
| guides_chinese | boolean |  |
| guides_otherlang | text |  |
| notes | text |  |
| specialmeals_veg | bigint |  |
| specialmeals_vegan | bigint |  |
| specialmeals_halal | bigint |  |
| specialmeals_allergies | text |  |
| largeluggage | bigint |  |
| cashontour | text |  |
| focapproval | text |  |
| paymentsnapshot_method | text |  |
| paymentsnapshot_netdays | bigint |  |
| paymentsnapshot_source | text |  |
| paymentsnapshot_contractversion | text |  |
| pricebreakdown_seat | bigint |  |
| pricebreakdown_addon | bigint |  |
| pricebreakdown_focdiscount | bigint |  |
| pricebreakdown_discount | bigint |  |
| pricebreakdown_extra | bigint |  |
| pricebreakdown_total | bigint |  |
| status | text |  |
| total | bigint |  |
| soldby | text |  |
| pricemode | text |  |
| manualtotal | bigint |  |
| purpose | text |  |
| staffid | text |  |
| staffpurpose | text |  |
| note | text |  |
| bookedat | text |  |
| bookingdate | text |  |
| marketsnapshot_market | text |  |
| marketsnapshot_sub | text |  |
| marketsnapshot_agentid | text |  |
| marketsnapshot_at | text |  |
| confirmedby | text |  |
| confirmedat | text |  |
| ops_boatid | text |  |
| updatedat | text |  |
| updatedby | text |  |
| focapproval_count | bigint |  |
| focapproval_reason | text |  |
| focapproval_status | text |  |
| focapproval_requestedat | text |  |
| focapproval_requestedby | text |  |
| focapproval_approvedat | text |  |
| focapproval_approvedby | text |  |
| focreason | text |  |
| ops_vangroup | bigint |  |
| ops_vanseq | bigint |  |
| ops_vanreturnid | text |  |
| ops_vanid | text |  |
| invoiceid | text |  |
| paymentstatus | text |  |
| ops_returnsamevan | boolean |  |
| cashontour_amount | bigint |  |
| cashontour_currency | text |  |
| cashontour_handling | text |  |
| cashontour_note | text |  |
| cancelledat | text |  |
| cancellation_category | text |  |
| cancellation_categorylabel | text |  |
| cancellation_group | text |  |
| cancellation_note | text |  |
| cancellation_reason | text |  |
| cancellation_chargetype | text |  |
| cancellation_chargeamount | bigint |  |
| cancellation_at | text |  |
| cancellation_by | text |  |
| cancelcategory | text |  |
| cancelreason | text |  |
| reschedule_fromdate | text |  |
| reschedule_todate | text |  |
| reschedule_reason | text |  |
| reschedule_chargetype | text |  |
| reschedule_chargeamount | bigint |  |
| reschedule_collect | text |  |
| reschedule_at | text |  |
| reschedule_by | text |  |
| rebook_from | text |  |
| rebook_to | text |  |
| rebook_reason | text |  |
| rebook_at | text |  |
| ops_pickuptimefinal | text |  |
| approval_status | text |  |
| approval_reason | text |  |
| approval_targetstatus | text |  |
| approval_totover | bigint |  |
| approval_requestedby | text |  |
| approval_requestedat | text |  |
| approval_approvedby | text |  |
| approval_approvedat | text |  |
| approval_note | text |  |
| ops_reconfirm | text |  |
| weatherresolve_event | text |  |
| weatherresolve_status | text |  |
| weatherresolve_notifiedat | text |  |
| weatherresolve_outcome | text |  |
| weatherresolve_resolvedat | text |  |
| weatherresolve_newdate | text |  |
| editlock_uid | text |  |
| editlock_by | text |  |
| editlock_at | bigint |  |

**Child tables:** `sb_bookings__addons` (45), `sb_bookings__adjustments` (27), `sb_bookings__feeitems` (4), `sb_bookings__history` (1049), `sb_bookings__over` (1), `sb_bookings__partialcancels` (6), `sb_bookings__passengers` (711), `sb_bookings__trips` (762), `sb_bookings__upgrades` (2)

### `sb_extras`  ·  5 rows
_Add-on services sold on bookings._

| column | type | key |
|---|---|---|
| id | text | PK |
| bookingid | text |  |
| tripdate | text |  |
| service | text |  |
| qty | bigint |  |
| unitprice | bigint |  |
| total | bigint |  |
| tocompany | bigint |  |
| commission | bigint |  |
| seller | text |  |
| method | text |  |
| settle | text |  |
| date | text |  |

### `sb_invoices`  ·  23 rows
_Invoices issued to agents._

| column | type | key |
|---|---|---|
| id | text | PK |
| number | text |  |
| agentid | text |  |
| subtotal | bigint |  |
| depositapplied | bigint |  |
| total | bigint |  |
| issuedat | text |  |
| dueat | text |  |
| status | text |  |
| createdby | text |  |
| netamount | bigint |  |
| vatmode | text |  |
| vatrate | double precision |  |
| vatamount | bigint |  |
| feetype | text |  |
| note | text |  |

**Child tables:** `sb_invoices__bookingids` (23), `sb_invoices__lineitems` (15)

### `sb_market_monthly`  ·  17 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| key | text |  |
| value | bigint |  |

### `sb_market_stats`  ·  26 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| key | text |  |
| date | text |  |
| in_col | bigint |  |
| in_zwe | bigint |  |
| in_overseas | bigint |  |
| out_col | bigint |  |
| out_zwe | bigint |  |
| out_overseas | bigint |  |
| out_1951_convention | bigint |  |
| inat | text |  |
| outat | text |  |
| intotal | bigint |  |
| outtotal | bigint |  |
| in_1951_convention | bigint |  |

### `sb_markets`  ·  10 rows
_Market segments (RU, AP, OTA, ...)._

| column | type | key |
|---|---|---|
| id | text | PK |
| name | text |  |
| color | text |  |

**Child tables:** `sb_markets__subs` (35)

### `sb_nationalities`  ·  11 rows
_Nationality lookup._

| column | type | key |
|---|---|---|
| id | text | PK |
| code | text |  |
| name | text |  |
| custom | boolean |  |

### `sb_payments`  ·  3 rows
_Payments received against invoices._

| column | type | key |
|---|---|---|
| id | text | PK |
| invoiceid | text |  |
| agentid | text |  |
| amount | bigint |  |
| method | text |  |
| date | text |  |
| type | text |  |

### `sb_pickup_areas`  ·  48 rows
_Hotel pickup areas/zones._

| column | type | key |
|---|---|---|
| id | text | PK |
| name | text |  |
| zone | text |  |
| region | text |  |
| timegroup | text |  |

### `sb_pickup_time_profiles`  ·  1 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| name | text |  |
| from | text |  |
| to | text |  |
| notes | text |  |
| clonedfrom | text |  |
| createdat | text |  |

**Child tables:** `sb_pickup_time_profiles__times` (12)

### `sb_pickup_times`  ·  3 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| key | text |  |
| pk_n1 | text |  |
| pk_n2 | text |  |
| pk_e1 | text |  |
| pk_e2 | text |  |
| pk_wn1 | text |  |
| pk_w1 | text |  |
| pk_w2 | text |  |
| pk_s1 | text |  |
| pk_s2 | text |  |
| pk_c1 | text |  |
| pk_c2 | text |  |
| pk_pa1 | text |  |
| nt_vp | text |  |
| pk_pn1 | text |  |
| nt_tl | text |  |

### `sb_rate_types`  ·  7 rows
_Pricing rate cards._

| column | type | key |
|---|---|---|
| id | text | PK |
| code | text |  |
| name | text |  |
| note | text |  |
| color | text |  |
| createddate | text |  |
| validfrom | text |  |
| validto | text |  |
| active | boolean |  |

**Child tables:** `sb_rate_types__addons` (10), `sb_rate_types__addons__applies` (8), `sb_rate_types__addons__byroute` (4), `sb_rate_types__addons__r10` (9), `sb_rate_types__addons__r11` (8), `sb_rate_types__addons__r12` (9), `sb_rate_types__addons__r4` (4), `sb_rate_types__addons__r5` (9), `sb_rate_types__addons__r6` (6), `sb_rate_types__charterrates` (18), `sb_rate_types__routebundles` (3), `sb_rate_types__routes` (35), `sb_rate_types__routevalidity` (20), `sb_rate_types__seatrates` (35)

### `sb_sales`  ·  5 rows
_Internal sales staff/reps._

| column | type | key |
|---|---|---|
| id | text | PK |
| code | text |  |
| name | text |  |
| color | text |  |
| email | text |  |
| fullname | text |  |
| designation | text |  |
| tel | text |  |
| signature | text |  |

### `sb_seat_locks`  ·  1 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| routeid | text |  |
| date | text |  |
| boatid | text |  |
| holdertype | text |  |
| holderid | text |  |
| qty | bigint |  |
| used | bigint |  |
| reason | text |  |
| expiry | text |  |
| status | text |  |
| createdat | text |  |
| createdby | text |  |

**Child tables:** `sb_seat_locks__log` (2)

### `sb_staff`  ·  14 rows
_Staff members._

| column | type | key |
|---|---|---|
| id | text | PK |
| code | text |  |
| name | text |  |
| dept | text |  |
| active | boolean |  |
| quota_2026 | bigint |  |

### `sb_vehicles`  ·  13 rows
_Transfer vehicles (vans etc.)._

| column | type | key |
|---|---|---|
| id | text | PK |
| name | text |  |
| plate | text |  |
| type | text |  |
| capacity | bigint |  |
| ownership | text |  |
| partnername | text |  |
| zonebase | text |  |
| active | boolean |  |
| note | text |  |
| driver | text |  |
| driverphone | text |  |
| daystatus_2026_06_01 | text |  |
| daystatus_2026_06_02 | text |  |
| daystatus_2026_06_03 | text |  |
| daystatus_2026_06_04 | text |  |
| daystatus_2026_06_05 | text |  |
| daystatus_2026_06_06 | text |  |
| daystatus_2026_06_23 | text |  |
| daystatus_2026_07_01 | text |  |
| daystatus_2026_07_02 | text |  |
| daystatus_2026_07_03 | text |  |
| daystatus_2026_07_04 | text |  |
| daystatus_2026_07_05 | text |  |
| daystatus_2026_07_06 | text |  |
| daystatus_2026_07_07 | text |  |
| dayzone_2026_06_12 | text |  |
| dayroute_2026_06_11 | text |  |
| dayroute_2026_06_12 | text |  |
| dayroute_2026_06_13 | text |  |
| dayroute_2026_06_14 | text |  |
| dayroute_2026_06_15 | text |  |
| dayroute_2026_06_21 | text |  |
| dayroute_2026_06_22 | text |  |
| dayroute_2026_06_23 | text |  |
| dayroute_2026_06_24 | text |  |
| dayroute_2026_06_26 | text |  |
| dayroute_2026_07_01 | text |  |
| daystatus_2026_06_12 | text |  |
| daystatus_2026_06_13 | text |  |
| daystatus_2026_06_11 | text |  |
| dayroute_2026_06_19 | text |  |
| daystatus_2026_06_26 | text |  |
| dayroute_2026_06_20 | text |  |
| dayroute_2026_06_25 | text |  |
| dayroute_2026_06_28 | text |  |
| dayroute_2026_06_29 | text |  |
| dayroute_2026_06_18 | text |  |
| daystatus_2026_06_22 | text |  |
| daystatus_2026_06_24 | text |  |
| daystatus_2026_06_25 | text |  |
| daystatus_2026_06_27 | text |  |
| daystatus_2026_06_28 | text |  |
| daystatus_2026_06_29 | text |  |
| daystatus_2026_06_30 | text |  |
| daystatus_2026_06_21 | text |  |

**Child tables:** `sb_vehicles__log` (551), `sb_vehicles__statusranges` (9)

### `sb_weather`  ·  4 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| routeid | text |  |
| date | text |  |
| reason | text |  |
| at | text |  |
| note | text |  |

### `trips`  ·  63 rows
_Scheduled daily trips (by date/route)._

| column | type | key |
|---|---|---|
| id | text | PK |
| key | text |  |
| b1_route | text |  |
| b1_type | text |  |
| b1_booked | bigint |  |
| b3_route | text |  |
| b3_type | text |  |
| b3_booked | bigint |  |
| b4_route | text |  |
| b4_type | text |  |
| b4_booked | bigint |  |
| b5_route | text |  |
| b5_type | text |  |
| b5_booked | bigint |  |
| b6_route | text |  |
| b6_type | text |  |
| b6_booked | bigint |  |
| b7_route | text |  |
| b7_type | text |  |
| b7_booked | bigint |  |
| b9_route | text |  |
| b9_type | text |  |
| b9_booked | bigint |  |
| b10_route | text |  |
| b10_type | text |  |
| b10_booked | bigint |  |
| b12_route | text |  |
| b12_type | text |  |
| b12_booked | bigint |  |
| b11_route | text |  |
| b11_type | text |  |
| b11_booked | bigint |  |
| b13_route | text |  |
| b13_type | text |  |
| b13_booked | bigint |  |
| b2_route | text |  |
| b2_type | text |  |
| b2_booked | bigint |  |
| b13_charterbookingid | text |  |
| b6_charterbookingid | text |  |

### `vanjob_driver`  ·  1 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| key | text |  |
| driver | text |  |
| phone | text |  |
| plate | text |  |

### `vanjob_pickup_th`  ·  15 rows

| column | type | key |
|---|---|---|
| id | text | PK |
| key | text |  |
| value | text |  |
