"use strict";

const cds = require("@sap/cds");

/**
 * Example CAP service handler that consumes an S/4HANA remote service.
 *
 * This file is intentionally isolated under examples/. Copy and adapt it only
 * after importing the real API metadata and configuring the destination.
 */
module.exports = async function () {
  /**
   * `cds.connect.to()` returns a CAP service proxy. Your business code uses CQN
   * instead of manually assembling OData URLs, tokens, and query strings.
   */
  const businessPartnerApi = await cds.connect.to("API_BUSINESS_PARTNER");

  this.on("READ", "RemoteBusinessPartners", async (req) => {
    /**
     * Forward the incoming query when your local projection mirrors the remote
     * contract. CAP translates CQN to the remote protocol.
     */
    return businessPartnerApi.run(req.query);
  });
};
