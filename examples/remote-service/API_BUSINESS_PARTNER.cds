namespace remote.example;

/**
 * Minimal stand-in for an imported S/4HANA Business Partner API.
 *
 * In a real project, generate this model from the remote service metadata with
 * `cds import <edmx-or-openapi-file>` instead of typing the contract manually.
 *
 * This file lives under examples/, so CAP does not load it into the runnable
 * learning application. Copy it into srv/external/ when doing the exercise.
 */
@cds.external
service API_BUSINESS_PARTNER {
  entity A_BusinessPartner {
    key BusinessPartner     : String(10);
        BusinessPartnerName : String(80);
        Country             : String(3);
  }
}
