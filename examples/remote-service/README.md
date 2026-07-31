# Remote S/4HANA Service Exercise

This folder is intentionally outside `srv/`, so the example does not affect the runnable project until you choose to activate it.

## Mental model

```text
CAP business code
   -> cds.connect.to("API_BUSINESS_PARTNER")
   -> CAP RemoteService proxy
   -> BTP Destination / service binding
   -> S/4HANA OData API
```

The browser should not know the S/4 URL or credentials. CAP acts as the secure orchestration and abstraction layer.

## Practical exercise

1. Download the metadata of an S/4 API available to your landscape.
2. Import it:

```bash
cds import API_BUSINESS_PARTNER.edmx --as cds
```

3. Move the generated CDS model into `srv/external/`.
4. Add a production requirement in `package.json`:

```json
{
  "cds": {
    "requires": {
      "API_BUSINESS_PARTNER": {
        "kind": "odata-v4",
        "model": "srv/external/API_BUSINESS_PARTNER",
        "[production]": {
          "credentials": {
            "destination": "S4HANA_BUSINESS_PARTNER"
          }
        }
      }
    }
  }
}
```

5. For local development, either mock the remote service or provide a local URL in a private profile. Never commit credentials.
6. Add an entity in your local service as a projection on the imported entity.
7. Connect with `cds.connect.to()` and forward or reshape the query.
8. Test `$select`, `$filter`, paging, error propagation, and authorization.

## Destination versus service binding

A **Destination** centralizes the remote URL and authentication method. A **service binding** provides credentials/configuration to your deployed CAP app. CAP resolves those settings at runtime, so code stays environment-independent.

## Common mistakes

- Calling S/4 directly from UI5 and exposing the backend endpoint
- Hardcoding credentials in `package.json`
- Manually concatenating untrusted values into URLs
- Returning the entire remote payload when the UI needs only a few fields
- Forgetting timeout, error mapping, logging, and retry considerations
- Assuming the local mock proves production authentication is correct

## Certification drill

Set a 30-minute timer and do this without copying the sample:

1. Import a service model.
2. Configure it in `cds.requires`.
3. Connect with `cds.connect.to()`.
4. Expose a read-only projection.
5. Prove the generated request supports `$select` and `$filter`.
6. Explain where authentication occurs in local and BTP environments.
