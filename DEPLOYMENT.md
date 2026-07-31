# Deployment Guide — SAP CAP Learning Project

This guide covers local execution, hybrid testing, MTA build, Cloud Foundry deployment, HANA Cloud, XSUAA role assignment, logs, and rollback.

## 1. What gets deployed

```text
MTAR
├── sap-cap-learning-project-srv          Node.js CAP application
├── sap-cap-learning-project-db-deployer  Deploys generated HANA artifacts
├── sap-cap-learning-project-db           HDI container service
└── sap-cap-learning-project-auth         XSUAA service instance
```

The MTA descriptor is `mta.yaml`. The build command creates a deployable `.mtar` archive under `mta_archives/`.

## 2. Prerequisites

Install and configure:

- A supported Node.js LTS release and npm
- SAP Cloud Foundry CLI
- MultiApps CF CLI plugin for `cf deploy`
- Cloud MTA Build Tool (`mbt`)
- Access to a BTP subaccount with Cloud Foundry enabled
- A target Cloud Foundry organization and space
- Entitlements for SAP HANA Cloud / HDI and XSUAA

Check your local tools:

```bash
node --version
npm --version
cf --version
mbt --version
cf plugins
```

## 3. Local development

```bash
npm install
npm run watch
```

CAP uses the development profile from `package.json`:

- SQLite database
- Mocked authentication
- Local users: `viewer`, `editor`, and `admin`

Open:

```text
http://localhost:4004
http://localhost:4004/odata/v4/learning/$metadata
```

Run tests:

```bash
npm test
```

### Reset local data

Stop the server and remove the local SQLite database:

```bash
rm -f db.sqlite
npm run watch
```

CAP recreates the schema and loads CSV seed data.

## 4. Login to Cloud Foundry

Find the API endpoint in the BTP subaccount's Cloud Foundry environment.

```bash
cf login -a <api-endpoint>
cf target -o <organization> -s <space>
cf target
```

Never paste credentials into repository files. Use interactive login, SSO, or your organization's approved credential method.

## 5. Prepare HANA Cloud

1. Create or reuse a SAP HANA Cloud database in the target subaccount.
2. Ensure it is running.
3. Confirm the space can create an `hdi-shared` service instance.
4. The MTA deployment will create the HDI container named by the resource in `mta.yaml`.

The HDI container is an isolated technical container for this application. It is not the same as giving the app unrestricted access to the entire HANA database.

## 6. Build the MTAR

Use a clean install before the build:

```bash
npm ci
mbt build
```

Expected output:

```text
mta_archives/sap-cap-learning-project_1.0.0.mtar
```

What happens during the build:

1. `npm ci` installs locked dependencies.
2. `cds build --production` generates `gen/srv` and `gen/db`.
3. MBT packages modules and descriptors into the MTAR.

Inspect the generated folders when troubleshooting, but do not manually edit generated files. Fix the CDS source or MTA definition and rebuild.

## 7. Deploy to Cloud Foundry

```bash
cf deploy mta_archives/sap-cap-learning-project_1.0.0.mtar
```

The deployer will:

- Create or update XSUAA
- Create or update the HDI container
- Deploy database artifacts
- Push the CAP Node.js application
- Bind services to the application

After deployment:

```bash
cf apps
cf services
cf env sap-cap-learning-project-srv
```

Do not share the output of `cf env`; it can contain sensitive service credentials.

## 8. Assign roles

`xs-security.json` defines role templates, but users still need role collections in the BTP cockpit.

Typical setup:

1. Open **Security → Role Collections** in the subaccount.
2. Create collections such as:
   - `CAP Learning Viewer`
   - `CAP Learning Editor`
   - `CAP Learning Admin`
3. Add the matching role from the deployed XSUAA application.
4. Assign role collections to users or identity-provider groups.

Role mapping:

| CDS role | Purpose |
|---|---|
| Viewer | Read data and call read-only functions |
| Editor | Create/update data and execute state-changing actions |
| Admin | Full access including delete |

A successful login without the correct role can still return `403 Forbidden`. That means authentication succeeded but authorization failed.

## 9. Test the deployed API

The CAP app route is shown by:

```bash
cf app sap-cap-learning-project-srv
```

For a real user-facing setup, expose the service through an Approuter, SAP Build Work Zone, or another authorized frontend route. Directly opening the service route is useful for diagnostics but is not the complete production UX architecture.

Test metadata after obtaining an authenticated route:

```text
https://<route>/odata/v4/learning/$metadata
```

Check:

- `401` — no valid authentication token
- `403` — authenticated but missing required role
- `404` — wrong path, route, or service name
- `500` — application/runtime problem; inspect logs

## 10. Hybrid development

Hybrid mode lets local code consume cloud service bindings, useful for testing HANA or XSUAA before full deployment.

A common workflow is:

```bash
cf create-service-key <service-instance> <key-name>
cds bind <service-name> --to <service-instance>:<key-name>
cds watch --profile hybrid
```

Exact binding commands vary with your CAP tooling version and project setup. Keep generated private binding files out of Git.

Security warning:

- Treat service keys like passwords.
- Delete temporary keys when finished.
- Never commit `.cdsrc-private.json`, `default-env.json`, or copied credentials.

## 11. Logs and troubleshooting

Recent logs:

```bash
cf logs sap-cap-learning-project-srv --recent
```

Stream logs:

```bash
cf logs sap-cap-learning-project-srv
```

Useful checks:

```bash
cf app sap-cap-learning-project-srv
cf env sap-cap-learning-project-srv
cf services
cf service sap-cap-learning-project-db
```

### Application fails to start

Check:

- Node engine compatibility
- Missing production dependency
- Incorrect `gen/srv` build output
- HANA or XSUAA binding failure
- Syntax errors in CDS or JavaScript

### DB deployer fails

Check:

- HANA Cloud is running
- HDI entitlement exists
- CDS compiles with `cds build --production`
- Conflicting schema changes
- DB deployer logs in deployment output

### `403 Forbidden`

Check:

- Role collection assigned to the user
- Correct XSUAA instance bound
- CDS role spelling matches the role-template name
- User logged out/in after role assignment so a new token is issued

### Deployment hangs or partially fails

Use:

```bash
cf deploy <mtar> -f
```

Only use force options after understanding the current deployment state. Avoid blindly deleting service instances because that can remove data.

## 12. Updating the application

1. Change source files.
2. Run local tests.
3. Increment the MTA/application version when appropriate.
4. Rebuild:

```bash
mbt build
```

5. Redeploy:

```bash
cf deploy mta_archives/<new-file>.mtar
```

The MTA deployer calculates changes and updates modules/resources.

## 13. Undeploy and data retention

To remove the MTA:

```bash
cf undeploy sap-cap-learning-project
```

Service instances may be retained or removed depending on command options and deployment configuration.

**Be careful:** deleting the HDI container deletes application data. For learning systems that may be acceptable; for real systems it requires an explicit backup and retention plan.

## 14. DEV → QA → PROD

Do not rebuild different source for each environment. Build a versioned artifact and transport/promote that artifact through controlled stages.

```text
Git commit
  -> CI tests
  -> MTA build
  -> DEV deploy
  -> QA transport and validation
  -> approval
  -> PROD deployment
```

Environment-specific values should come from service instances, destinations, identity configuration, and approved deployment parameters—not hardcoded branches of source code.

SAP Cloud Transport Management can transport MTAR content between BTP subaccounts. CI/CD can automate build and validation; CTMS provides governed landscape movement and approvals.

## 15. Production checklist

- [ ] Dependencies are pinned through `package-lock.json`
- [ ] Tests pass
- [ ] No credentials or service keys committed
- [ ] XSUAA roles reviewed with least privilege
- [ ] HANA migration impact reviewed
- [ ] Health, logs, and alerting configured
- [ ] Destination authentication configured securely
- [ ] DEV/QA/PROD are separated appropriately
- [ ] Backup and recovery plan exists
- [ ] Rollback procedure tested
- [ ] UI and API routes use HTTPS
