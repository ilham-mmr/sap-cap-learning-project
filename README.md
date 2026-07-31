# SAP CAP Learning Project

A commented, hands-on learning project for the **SAP Cloud Application Programming Model (CAP)** using Node.js, CDS, OData V4, SQLite for local development, SAP HANA Cloud for production, and XSUAA for authorization.

The project uses a small order-management domain because it maps naturally to familiar SAP concepts:

- `Products` — material-like master data
- `Customers` — business-partner-like master data
- `Orders` — sales-order-like header data
- `OrderItems` — sales-order-like item data

> **Study goal:** Read this README once for the mental model, then follow the source comments and execute the HTTP examples.

## 1. The whole architecture

```text
Browser / UI5
    |
    | OData V4 over HTTP
    v
CAP service layer (srv/)
    |
    | CDS Query Language + transactions
    v
CAP data model (db/)
    |
    +--> SQLite during local development
    +--> SAP HANA Cloud through an HDI container in production
```

With BTP security:

```text
User -> Approuter / Work Zone -> XSUAA JWT -> CAP -> HANA Cloud
```

With S/4HANA integration, CAP normally calls the remote API through a BTP Destination rather than exposing credentials to the browser:

```text
UI5 -> CAP -> Destination -> S/4HANA API
```

### Layman explanation

CAP is the office behind a service counter. CDS describes the forms and filing cabinets, OData is the language used at the counter, handlers are the employees applying business rules, and HANA/SQLite is where the records are stored.

## 2. CAP versus RAP

| Question | RAP | CAP |
|---|---|---|
| Where does it run? | ABAP platform / S/4HANA / ABAP environment | Usually SAP BTP using Node.js or Java |
| Main use | Logic tightly integrated with SAP business objects | Side-by-side cloud extensions and service composition |
| Model | ABAP CDS + behavior definitions | CDS + service definitions + handlers |
| Common UI | Fiori elements | UI5, Fiori elements, or any web client |

**Memory sentence:** RAP builds inside the ABAP house; CAP builds an extension beside the house.

## 3. Repository map

```text
.
├── db/
│   ├── schema.cds                 # Persistent entities and relationships
│   └── data/                      # Initial CSV data for local learning
├── srv/
│   ├── learning-service.cds       # Public OData service contract
│   ├── learning-service.js        # before/on/after handlers
│   └── lib/order-calculator.js    # Pure reusable business calculation
├── test/
│   ├── learning-service.http      # Manual API exercises
│   └── order-calculator.test.js   # Fast unit tests with node:test
├── xs-security.json               # XSUAA scopes and role templates
├── mta.yaml                       # Cloud Foundry multi-target deployment
├── DEPLOYMENT.md                  # Step-by-step BTP deployment guide
└── package.json
```

## 4. CDS data modeling

The persistent model lives in `db/schema.cds`.

### Entity

An entity is a structured business object that CAP can persist and expose.

```cds
entity Products : cuid, managed {
  name  : String(100);
  price : Decimal(13,2);
  stock : Integer;
}
```

### `cuid` and `managed`

- `cuid` adds a UUID key named `ID`.
- `managed` adds `createdAt`, `createdBy`, `modifiedAt`, and `modifiedBy`.

These are reusable **aspects**. An aspect is similar to including the same reusable group of fields in several DDIC structures.

### Association versus composition

**Association** is a loose reference. Both objects can live independently.

Example: an order references a customer. Deleting one order must not delete the customer.

**Composition** is ownership. The child belongs to the parent lifecycle.

Example: order items belong to their order. A deep create can create the header and items together.

```cds
entity Orders : cuid, managed {
  customer : Association to Customers;
  items    : Composition of many OrderItems
               on items.parent = $self;
}
```

### ABAP comparison

- `Association to Customers` resembles a business reference such as `VBAK-KUNNR` to customer master data.
- `Composition of OrderItems` resembles the conceptual ownership between `VBAK` and `VBAP`.

## 5. Service definitions and projections

The database model is internal. The service in `srv/learning-service.cds` exposes selected projections as the API contract.

```cds
service LearningService {
  entity Products as projection on db.Products;
}
```

A projection lets you:

- Hide internal fields
- Rename fields
- Add annotations
- Publish only the entities appropriate for that API
- Change the database model later without unnecessarily breaking consumers

CAP automatically publishes OData metadata, entity sets, navigation, filtering, sorting, paging, and default CRUD for projections.

## 6. OData V4 essentials

Start the project and inspect:

```text
http://localhost:4004/odata/v4/learning/$metadata
```

Important query options:

```http
GET /odata/v4/learning/Products?$select=ID,name,price
GET /odata/v4/learning/Products?$filter=stock lt 10
GET /odata/v4/learning/Products?$orderby=price desc
GET /odata/v4/learning/Orders?$expand=items,customer
GET /odata/v4/learning/Products?$top=10&$skip=10
```

- `$select` reduces columns.
- `$filter` filters on the server.
- `$orderby` sorts on the server.
- `$expand` follows a relationship and returns related data.
- `$top` and `$skip` support paging.

> Do not use `$expand` everywhere. It can turn a small request into a large nested payload.

## 7. Default CRUD

CAP supplies generic handlers when no custom handler replaces them:

| Operation | HTTP | CAP event |
|---|---|---|
| Create | `POST` | `CREATE` |
| Read | `GET` | `READ` |
| Update | `PATCH` | `UPDATE` |
| Delete | `DELETE` | `DELETE` |

This project keeps generic CRUD and adds business rules around it instead of rewriting everything.

## 8. Handler phases: `before`, `on`, and `after`

The implementation is in `srv/learning-service.js`.

### `before`

Use it to validate, reject, normalize, or enrich incoming data before persistence.

```js
this.before("CREATE", "Products", (req) => {
  if (req.data.price <= 0) req.reject(400, "Price must be positive");
});
```

### `on`

Use it to implement an action/function or replace default processing. If you register `on('READ')`, you own that READ behavior, so do it deliberately.

### `after`

Use it to enrich or format returned data after the main operation. Avoid database updates inside `after READ`; a read should not secretly change data.

## 9. Actions, functions, and events

### Function

A function should be read-only and is normally called using `GET`.

```cds
function lowStock(threshold : Integer) returns many Products;
```

### Action

An action may change state and is normally called using `POST`.

```cds
action restock(productID : UUID, quantity : Integer) returns Products;
```

### Bound action

`submit` is bound to an individual order. Conceptually, it means: “perform Submit on this particular order.”

### Event

After an order is submitted, the service emits `OrderSubmitted`. In a larger solution, a messaging service could deliver this to another application without tight coupling.

> Layman version: an action is a command, a function is a question, and an event is an announcement.

## 10. Deep insert

A composition enables one request to create an order and its items:

```json
{
  "customer_ID": "...",
  "items": [
    { "product_ID": "...", "quantity": 2 },
    { "product_ID": "...", "quantity": 1 }
  ]
}
```

The `before CREATE Orders` handler validates the items, reads current product prices, calculates line totals, and calculates the header total. CAP then persists the complete composition.

## 11. Transactions

`restock` and `submit` run their reads and updates through `cds.tx(req)`.

```js
const tx = cds.tx(req);
await tx.run(...);
```

All operations using that request transaction succeed together or roll back together when an error occurs.

**ABAP comparison:** this is conceptually similar to grouping related updates into one logical unit of work rather than committing halfway through the business operation.

## 12. Authentication and authorization

### Authentication

Authentication answers: **Who is the user?**

Local development uses mocked users from `package.json`. Production is configured for XSUAA/JWT authentication.

### Authorization

Authorization answers: **What may that user do?**

The service demonstrates:

- `@requires` for service-level access
- `@restrict` for operation-level roles
- Runtime checks with `req.user.is('Admin')`

The XSUAA model is declared in `xs-security.json`:

- Scope — one permission
- Role template — a reusable role built from scopes
- Role collection — a BTP bundle assigned to users or groups

Hiding a button in UI5 is not security. The CAP backend must enforce authorization.

### Local mock users

| User | Password | Roles |
|---|---|---|
| `viewer` | `viewer` | Viewer |
| `editor` | `editor` | Viewer, Editor |
| `admin` | `admin` | Viewer, Editor, Admin |

Use basic authentication in the HTTP examples while running locally.

## 13. Local database versus HANA Cloud

- Local development uses `@cap-js/sqlite` for quick setup.
- Production uses `@cap-js/hana` and an HDI container.

CAP keeps the CDS model stable while the database adapter changes by profile.

```text
Development -> SQLite
Production  -> SAP HANA Cloud / HDI
```

Do not put production secrets in `package.json`. BTP provides credentials through service bindings.

## 14. Running locally

Prerequisites:

- A supported Node.js LTS release
- npm

Commands:

```bash
npm install
npm run watch
```

Open:

```text
http://localhost:4004
```

Run tests:

```bash
npm test
```

Try the API calls from `test/learning-service.http` using the REST Client extension or another HTTP client.

## 15. Debugging checklist

1. Read the terminal error and CAP request log.
2. Check `/$metadata` to confirm names and navigation properties.
3. Run `cds env` to inspect the effective configuration.
4. Verify the active profile: development, hybrid, or production.
5. Check the request payload and status code.
6. For authorization issues, inspect the authenticated user and assigned roles.
7. On BTP, use `cf logs <app-name> --recent`.
8. For database errors, inspect the HDI container and generated build artifacts.

## 16. Common mistakes

- Putting all business logic in the UI instead of CAP
- Exposing database entities directly without a service contract
- Using composition where the child is actually independent
- Overriding `READ` when an `after READ` hook would be enough
- Performing repeated database queries inside a loop
- Trusting prices sent from the browser
- Returning every column and relation by default
- Hardcoding credentials or remote-system URLs
- Assuming a UI role check replaces backend authorization
- Committing `.cdsrc-private.json`, service keys, or secrets

## 17. Suggested study path

1. Read `db/schema.cds` and identify keys, aspects, associations, and composition.
2. Read `srv/learning-service.cds` and identify projections, restrictions, actions, functions, and the event.
3. Start the app and inspect `$metadata`.
4. Execute simple READ queries with `$select`, `$filter`, and `$expand`.
5. Create an order with a deep insert.
6. Read `srv/learning-service.js` and follow each handler phase.
7. Execute `restock`, `lowStock`, and the bound `submit` action.
8. Run the unit tests.
9. Review `xs-security.json` and map roles to CDS restrictions.
10. Read `DEPLOYMENT.md` and map every MTA module/resource to its job.

## 18. Exercises

1. Add a `Categories` entity and associate products with categories.
2. Reject an order when stock is insufficient.
3. Decrease product stock when an order is submitted.
4. Restrict users so they can read only orders they created.
5. Add an `approve` action available only to `Admin`.
6. Add a calculated discount and store the net total.
7. Add a remote S/4 service definition and configure it through a destination.
8. Add integration tests for deep create and submit.

## 19. Interview quick check

- Why expose a projection instead of a database entity?
- When would you use association instead of composition?
- What is the difference between `before`, `on`, and `after`?
- Why should product price be read from the backend rather than trusted from the UI payload?
- What is the difference between an action and a function?
- What does `cds.tx(req)` protect?
- How do XSUAA scopes relate to CDS role names?
- Why is SQLite appropriate locally but not the target production database here?
- When would RAP be a better choice than CAP?

## 20. Companion frontend

The companion freestyle SAPUI5 project is intended to consume this service:

```text
https://github.com/ilham-mmr/sap-fiori-freestyle-learning-project
```

Start this CAP service on port `4004`, then start the UI5 project. Its local proxy forwards `/odata` calls to CAP.
