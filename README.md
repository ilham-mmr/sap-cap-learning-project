# SAP CAP Learning Project

A commented, hands-on study repository for the **SAP Cloud Application Programming Model (CAP)** using Node.js, CDS, OData V4, SQLite, SAP HANA Cloud, XSUAA, Fiori elements annotations, draft handling, localization, optimistic concurrency, automated testing, remote-service patterns, and BTP deployment.

The domain resembles familiar SAP sales processing:

- `Products` — material-like master data
- `Customers` — business-partner-like master data
- `Orders` — sales-order-like header data
- `OrderItems` — sales-order-like item data

> **Study rule:** Do not only read or copy this project. Run it, break it, debug it, modify it, and finally rebuild the important parts from a blank folder.

## Is this enough for the SAP CAP hands-on certification?

**It is a strong practice foundation, but this repository alone is not sufficient.**

It now covers most core technical patterns you should be able to apply:

- CAP project structure and convention over configuration
- CDS modeling, aspects, enums, associations, and compositions
- localized business data and static i18n texts
- service projections and generic OData V4 CRUD
- query options, navigation, deep insert, actions, functions, and events
- `before`, `on`, and `after` handlers
- CQL/CQN, trusted backend calculation, and request transactions
- XSUAA concepts and role-based authorization
- ETag-based optimistic concurrency
- draft-enabled services and Fiori elements annotations
- unit and service integration testing
- remote service and BTP Destination patterns
- SQLite/HANA profiles, HDI, MTA, and Cloud Foundry deployment

A practical certification also expects you to work in the actual SAP environment. This repo cannot replace hands-on practice with:

- SAP Business Application Studio dev spaces and tools
- BTP entitlements, service instances, bindings, and role collections
- real XSUAA/JWT behavior
- HANA Cloud and HDI deployment
- real destinations and remote SAP APIs
- SAP Build Work Zone and Fiori elements app generation
- the official SAP learning journey and certification practice system

Use [`CERTIFICATION-PRACTICE.md`](CERTIFICATION-PRACTICE.md) for the skills matrix, weekly plan, debugging drills, and a 120-minute mock practical exam.

## Official study companions

Always verify the current certification page before booking because scope and format can change.

- SAP Learning: Introduction to SAP Cloud Application Programming Model
- SAP Learning practice system: Backend Developer — SAP Cloud Application Programming Model (`C_CPE`)
- SAP CAP documentation: https://cap.cloud.sap/docs/
- Official CAP samples: https://github.com/cap-js/samples
- SAP learning-journey sample: https://github.com/SAP-samples/cap-development-learning-journey

## 1. The whole architecture

```text
Browser / Fiori application
        |
        | OData V4 over HTTP
        v
CAP application service (srv/)
        |
        | CQL / transactions
        v
CAP domain model (db/)
        |
        +--> SQLite during local development
        +--> SAP HANA Cloud through HDI in production
```

With BTP security:

```text
User -> Work Zone / Approuter -> XSUAA JWT -> CAP -> HANA Cloud
```

With S/4HANA integration:

```text
UI -> CAP -> RemoteService proxy -> BTP Destination -> S/4HANA API
```

### Layman explanation

CAP is the office behind a service counter:

- CDS defines the forms, business objects, and filing structure.
- OData is the language spoken between the frontend and counter.
- Generic providers handle routine CRUD automatically.
- Handlers are employees applying special business rules.
- SQLite/HANA is the record storage.
- XSUAA is the permission system.
- A Destination is the centrally managed address and authentication route to another system.

## 2. CAP versus RAP

| Question | RAP | CAP |
|---|---|---|
| Runtime | ABAP platform / S/4HANA / ABAP environment | Usually SAP BTP with Node.js or Java |
| Best fit | Logic tightly integrated with SAP business objects | Side-by-side extensions and cloud services |
| Main model | ABAP CDS + behavior definitions | CDS + service definitions + handlers |
| Typical UI | Fiori elements | Fiori elements, UI5, or another web client |

**Memory sentence:** RAP builds inside the ABAP house; CAP builds an extension beside the house.

## 3. Repository map

```text
.
├── db/
│   ├── schema.cds
│   └── data/
│       ├── learning.orders-Products.csv
│       ├── learning.orders-Products_texts.csv
│       └── learning.orders-Customers.csv
├── srv/
│   ├── learning-service.cds
│   ├── learning-service.js
│   ├── admin-service.cds
│   ├── admin-service-ui.cds
│   └── lib/order-calculator.js
├── i18n/
│   ├── i18n.properties
│   └── i18n_id.properties
├── test/
│   ├── certification-drills.http
│   ├── learning-service.http
│   ├── learning-service.integration.test.js
│   └── order-calculator.test.js
├── examples/remote-service/
├── xs-security.json
├── mta.yaml
├── DEPLOYMENT.md
├── CERTIFICATION-PRACTICE.md
└── package.json
```

## 4. Quick start

Prerequisites:

- supported Node.js LTS release
- npm
- `@sap/cds-dk` globally available or installed in the project

Run:

```bash
npm install
npm run watch
```

Open:

```text
http://localhost:4004
```

Useful endpoints:

```text
http://localhost:4004/odata/v4/learning/$metadata
http://localhost:4004/odata/v4/admin/$metadata
```

Run all tests:

```bash
npm test
```

Run only the pure calculation unit tests:

```bash
npm run test:unit
```

Build production artifacts:

```bash
npm run build
```

## 5. CAP convention over configuration

CAP expects conventional folders:

- `db/` — persistence/domain model
- `srv/` — exposed services and business logic
- `app/` — frontend applications

CAP discovers files, compiles CDS, serves generic CRUD, loads CSV data, and wires matching service implementation files automatically.

### Why it matters

You spend less time configuring framework plumbing and more time describing the business domain.

### Exam habit

Know both the convention and how to inspect effective configuration:

```bash
cds env
cds env folders
cds env requires
```

## 6. CDS domain modeling

The model is in [`db/schema.cds`](db/schema.cds).

### Entities

An entity is a structured business object that may be persisted and exposed.

```cds
entity Products : cuid, managed {
  name  : localized String(100) not null;
  price : Decimal(13,2) not null;
  stock : Integer default 0;
}
```

### Reusable aspects

- `cuid` adds UUID key `ID`.
- `managed` adds creation and modification audit fields.
- `HasStatus` is a custom reusable aspect.

**ABAP comparison:** an aspect is conceptually similar to reusing a DDIC include structure, though CAP composes it into the semantic model.

### Enums

`OrderStatus` limits status to meaningful domain values. This prevents arbitrary strings from becoming valid business states.

**ABAP comparison:** similar in purpose to a domain with fixed values.

### Association

An association is a loose relationship. The target can exist independently.

```cds
customer : Association to Customers;
```

Deleting an order must not delete its customer.

### Composition

A composition models ownership and shared lifecycle.

```cds
items : Composition of many OrderItems
          on items.parent = $self;
```

Order items belong to their order and naturally support deep create/draft behavior.

**Memory example:** Customer ↔ Order is an association; Order ↔ Items is a composition.

## 7. Localized business data versus static i18n

These are related but different concepts.

### Localized business data

`localized String` generates text persistence and locale-aware views. The request locale determines which translated value is returned.

```http
GET /odata/v4/learning/Products(...)?$select=name,description
Accept-Language: id
```

The default-language values are in `Products.csv`; translated records are in `Products_texts.csv`.

### Static i18n

Files under `i18n/` translate labels and annotation texts such as “Order Date” or “Total Amount.” These are UI/service metadata texts, not database business records.

### Layman distinction

- Static i18n translates the label on the box.
- Localized data translates the actual value stored inside the box.

## 8. Service projections

The persistence model is internal. [`srv/learning-service.cds`](srv/learning-service.cds) exposes projections as the public API.

```cds
entity Customers as projection on db.Customers;
```

A projection can:

- hide internal fields
- rename or calculate fields
- add annotations
- publish a limited contract
- protect consumers from persistence changes

### Virtual field

`stockStatus` is declared in the service metadata but is not stored in the database:

```cds
virtual null as stockStatus : String(10)
```

The `after READ` handler calculates it for the response.

> A property added only in JavaScript but missing from OData metadata may not be a reliable public API field. Declare transient API fields explicitly.

## 9. Generic CRUD and OData V4

CAP's generic provider handles routine operations unless you replace them:

| Business operation | HTTP | CAP event |
|---|---|---|
| Create | `POST` | `CREATE` |
| Read | `GET` | `READ` |
| Update | `PATCH` | `UPDATE` |
| Delete | `DELETE` | `DELETE` |

Useful query options:

```http
GET /Products?$select=ID,name,price
GET /Products?$filter=stock lt 10
GET /Products?$orderby=price desc
GET /Products?$top=10&$skip=10
GET /Orders?$expand=items,customer
```

- `$select` reduces columns.
- `$filter` filters on the server.
- `$orderby` sorts on the server.
- `$top`/`$skip` page records.
- `$expand` follows navigation relationships.

Do not automatically expand every relationship. Large nested payloads are expensive.

## 10. Handler lifecycle

The implementation is in [`srv/learning-service.js`](srv/learning-service.js).

### `before`

Use it to validate, normalize, reject, or enrich data before generic processing.

Examples here:

- validate product values
- normalize email
- validate deep-order items
- read trusted product prices
- calculate totals

### `on`

Use it to implement actions/functions or deliberately replace default processing.

Examples here:

- `lowStock` function
- `restock` action
- bound `submit` action

If you implement `on('READ')`, you take ownership of that read. Do not override generic behavior unnecessarily.

### `after`

Use it for response enrichment after the main operation.

The product handler calculates a transient stock status. Avoid hidden database changes during `after READ`.

## 11. CQL/CQN and trusted backend calculation

CAP code uses CQL/CQN rather than manually assembling SQL or OData URLs:

```js
await tx.run(
  SELECT.one.from(Products).where({ ID: productID })
);
```

The browser sends product IDs and quantities, but CAP reads authoritative prices from the backend.

### Why?

A malicious or outdated client could send a fake price. Business-critical values must be validated or derived by the backend.

## 12. Deep insert

Because items are a composition, one request can create the header and children:

```json
{
  "customer_ID": "...",
  "items": [
    { "product_ID": "...", "quantity": 2 }
  ]
}
```

The handler calculates item values and the header total, and CAP persists the document structure.

## 13. Transactions

Use the request transaction:

```js
const tx = cds.tx(req);
await tx.run(...);
```

Related reads and writes succeed or roll back as one logical operation.

**ABAP comparison:** conceptually similar to keeping related database changes in one LUW rather than committing halfway through a business operation.

## 14. Actions, functions, and events

### Function

A read-only question, commonly invoked with `GET`:

```cds
function lowStock(threshold : Integer) returns many Products;
```

### Action

A command that may change state, commonly invoked with `POST`:

```cds
action restock(productID : UUID, quantity : Integer) returns Products;
```

### Bound action

`submit()` is attached to one Order instance: “submit this specific order.”

### Event

`OrderSubmitted` is an announcement. Another component can react without the order service directly calling it.

**Memory sentence:** function = question, action = command, event = announcement.

## 15. Authentication and authorization

Authentication answers **who are you?** Authorization answers **what may you do?**

### Local mock users

| User | Password | Roles |
|---|---|---|
| `viewer` | `viewer` | Viewer |
| `editor` | `editor` | Viewer, Editor |
| `admin` | `admin` | Viewer, Editor, Admin |

### CDS authorization

The project demonstrates:

- `@requires` — service/entity/action requires a role
- `@restrict` — operation-level grants
- `req.user.is(...)` — runtime checks when dynamic logic is necessary

### XSUAA

[`xs-security.json`](xs-security.json) defines scopes and role templates used in production.

- Scope — individual permission
- Role template — reusable role definition
- Role collection — BTP bundle assigned to users/groups

Hiding a button in UI5 improves usability but does not secure data. CAP must enforce authorization.

## 16. Optimistic concurrency with ETags

`modifiedAt` is annotated with `@odata.etag`.

Flow:

1. Client reads a record and its ETag.
2. Client sends `If-Match` on update.
3. CAP compares it with the current value.
4. A stale update is rejected instead of overwriting newer work.

### Layman example

Two users open the same order. User A saves first. User B still holds an old version. The ETag is the “version stamp” that prevents B from silently erasing A's changes.

Practice requests are in [`test/certification-drills.http`](test/certification-drills.http).

## 17. Draft-enabled Fiori elements service

[`srv/admin-service.cds`](srv/admin-service.cds) exposes Orders with:

```cds
@odata.draft.enabled
entity Orders as projection on db.Orders;
```

Draft provides a temporary working copy for long-running edits. The active record is changed only when the user activates the draft.

### Why it matters

Fiori elements edit flows frequently rely on draft semantics for:

- save/cancel behavior
- locking and ownership of edits
- incomplete working data
- header–item editing as one document

[`srv/admin-service-ui.cds`](srv/admin-service-ui.cds) demonstrates metadata-driven:

- HeaderInfo
- SelectionFields
- LineItem
- FieldGroup
- Facets

Fiori elements reads these annotations and generates standard UI behavior. Freestyle UI5 requires manual views and controller logic.

## 18. Testing strategy

### Pure unit test

[`test/order-calculator.test.js`](test/order-calculator.test.js) tests calculation logic without starting CAP. It is fast and isolates business rules.

### CAP integration test

[`test/learning-service.integration.test.js`](test/learning-service.integration.test.js) uses `cds.test()` to start a test server and exercises:

- service reads
- virtual fields
- localization
- authorization
- deep create

### Manual HTTP practice

Use [`test/certification-drills.http`](test/certification-drills.http) to inspect headers, ETags, payloads, metadata, and status codes.

A practical exam rewards the ability to diagnose behavior, so do not hide every detail behind automated tests.

## 19. Remote services and destinations

The isolated example is under [`examples/remote-service/`](examples/remote-service/).

Typical flow:

```js
const api = await cds.connect.to("API_BUSINESS_PARTNER");
return api.run(req.query);
```

In real projects:

1. import remote metadata with `cds import`
2. configure the service in `cds.requires`
3. use a BTP Destination or service binding in production
4. consume it through CAP's RemoteService proxy
5. expose only the local contract needed by your application

Do not hardcode credentials or call S/4 directly from the browser for complex enterprise scenarios.

## 20. SQLite versus HANA Cloud

```text
Development -> SQLite
Production  -> SAP HANA Cloud through HDI
```

CAP keeps the CDS model stable while the database adapter changes by profile.

- SQLite is quick for local iteration.
- HANA/HDI is the production deployment target in this project.
- credentials come from BTP service bindings, not committed configuration.

Read [`DEPLOYMENT.md`](DEPLOYMENT.md) for the MTA/Cloud Foundry flow.

## 21. Deployment mental model

```text
CDS source
  -> cds build
  -> HANA artifacts + Node.js service artifacts
  -> mbt build
  -> MTAR archive
  -> cf deploy
  -> HDI deployer + CAP app + XSUAA bindings
```

Know the jobs of:

- CAP service module
- HANA DB deployer
- HDI container
- XSUAA instance
- Destination service when remote APIs are used
- role collections after deployment

## 22. Debugging checklist

1. Read the terminal error and request log.
2. Open `/$metadata` and verify exact names/navigation.
3. Run `cds env` and inspect the active profile.
4. Check HTTP method, URL, headers, status, and payload.
5. Verify mock/production roles.
6. Inspect the transaction boundary.
7. Confirm a virtual field is declared in service metadata.
8. For localization, check `Accept-Language` and `_texts.csv`.
9. For concurrency, check ETag and `If-Match`.
10. On BTP, use `cf logs <app> --recent` and inspect service bindings.

## 23. Common mistakes

- memorizing definitions without rebuilding a project
- putting business logic only in UI5
- exposing persistence entities blindly
- choosing composition for an independent object
- trusting price or authorization information from the browser
- overriding generic `READ` unnecessarily
- querying the database once per item in a loop
- expanding every navigation property
- confusing localized data with static i18n
- updating without ETag protection in collaborative scenarios
- enabling draft without understanding active versus draft instances
- committing secrets or private destination configuration
- proving only local SQLite behavior and assuming HANA/BTP will be identical

## 24. Recommended study sequence

1. Read `db/schema.cds` and draw the entity relationships.
2. Run `cds watch` and inspect both `$metadata` documents.
3. Complete every request in `test/certification-drills.http`.
4. Trace each handler in `learning-service.js`.
5. Run unit and integration tests.
6. Add one new entity, action, restriction, and test yourself.
7. Generate a Fiori elements app from `AdminService` in BAS.
8. Practice one real remote service/destination scenario.
9. Deploy to HANA/Cloud Foundry and inspect logs/bindings.
10. Complete the blank-project mock in `CERTIFICATION-PRACTICE.md`.

## 25. Exercises

1. Add Categories and associate Products with them.
2. Add sales organization and distribution channel to Orders.
3. Reject submit when stock is insufficient.
4. Decrease stock in the same transaction as submit.
5. Add Admin-only `approve` and `cancel` bound actions.
6. Add row-level authorization using the current user.
7. Add declarative validation annotations and compare them with handlers.
8. Add a Customer value help annotation.
9. Add a real imported remote API model.
10. Add tests for ETag failure and draft activation.

## 26. Interview and oral-practice questions

- Why use service projections?
- Association versus composition?
- Static i18n versus localized business data?
- `before` versus `on` versus `after`?
- Action versus function versus event?
- What does `cds.tx(req)` guarantee?
- Why is backend price lookup important?
- What problem do ETags solve?
- What problem does draft solve?
- How does Fiori elements use annotations?
- How do XSUAA roles map to CDS authorization?
- How does CAP consume an S/4 API through a Destination?
- What changes between SQLite and HANA profiles?
- What does the HDI deployer do?
- When is RAP a better choice than CAP?

## 27. Companion frontend

The freestyle UI5 companion project consumes `LearningService`:

https://github.com/ilham-mmr/sap-fiori-freestyle-learning-project

Start CAP on port `4004`, then start the UI5 project. Its local proxy forwards `/odata` calls to this service.
