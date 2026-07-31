"use strict";

const cds = require("@sap/cds");

/**
 * `cds.test()` starts the CAP server on a random local port, provides HTTP
 * helpers, and shuts the server down after the test file finishes.
 *
 * Keep one cds.test() call per test file. CAP holds process-wide server/model
 * state, so starting it repeatedly in one file can create confusing failures.
 */
const test = cds.test(__dirname + "/..");
const { GET, POST, PATCH, expect } = test;

const PRODUCT_ID = "11111111-1111-1111-1111-111111111111";
const CUSTOMER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const viewerAuth = {
  auth: { username: "viewer", password: "viewer" }
};

const editorAuth = {
  auth: { username: "editor", password: "editor" }
};

describe("LearningService", () => {
  test("Viewer can read products and virtual stockStatus is returned", async () => {
    const { data, status } = await GET(
      "/odata/v4/learning/Products?$filter=ID eq " + PRODUCT_ID,
      viewerAuth
    );

    expect(status).to.equal(200);
    expect(data.value).to.have.length(1);
    expect(data.value[0].stockStatus).to.equal("LOW");
  });

  test("Accept-Language selects localized product data", async () => {
    const { data, status } = await GET(
      `/odata/v4/learning/Products(${PRODUCT_ID})?$select=name,description`,
      {
        ...viewerAuth,
        headers: { "accept-language": "id" }
      }
    );

    expect(status).to.equal(200);
    expect(data.name).to.equal("Keyboard Mekanis");
  });

  test("Viewer is forbidden from changing product master data", async () => {
    try {
      await PATCH(
        `/odata/v4/learning/Products(${PRODUCT_ID})`,
        { stock: 99 },
        viewerAuth
      );
      throw new Error("Expected the PATCH request to be rejected");
    } catch (error) {
      expect(error.response.status).to.equal(403);
    }
  });

  test("Editor can create an order with a deep insert", async () => {
    const payload = {
      customer_ID: CUSTOMER_ID,
      currency: "IDR",
      note: "Created by the CAP integration test",
      items: [
        {
          product_ID: PRODUCT_ID,
          quantity: 2
        }
      ]
    };

    const { data, status } = await POST(
      "/odata/v4/learning/Orders",
      payload,
      editorAuth
    );

    expect(status).to.equal(201);
    expect(data.status).to.equal("DRAFT");
    expect(Number(data.totalAmount)).to.equal(2400000);
  });
});
