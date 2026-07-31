using { cuid, managed } from '@sap/cds/common';

namespace learning.orders;

/**
 * A CDS enum prevents arbitrary status values from leaking into the model.
 *
 * ABAP comparison:
 * This serves a similar purpose to a domain with fixed values, while remaining
 * part of the CAP domain model.
 */
type OrderStatus : String enum {
  DRAFT;
  SUBMITTED;
  APPROVED;
  CANCELLED;
}

/**
 * Reusable aspect for business status fields.
 *
 * Why an aspect?
 * It prevents us from copying the same field definition into several entities.
 * This is conceptually similar to reusing a DDIC include structure in ABAP.
 */
aspect HasStatus {
  status : OrderStatus default #DRAFT;
}

/** Product master data. */
entity Products : cuid, managed {
  /**
   * `localized` tells CAP to generate a text table and locale-aware views.
   * The base table contains the default language; translated values are stored
   * in Products.texts and selected using the request locale.
   */
  name        : localized String(100) not null;
  description : localized String(500);
  price       : Decimal(13,2) not null;
  stock       : Integer default 0;
  active      : Boolean default true;
}

/** Customer master data that can exist independently of orders. */
entity Customers : cuid, managed {
  name    : String(100) not null;
  email   : String(255) not null;
  country : String(2);

  // This is a loose relationship: deleting a customer is not automatically
  // the same thing as deleting every historical order.
  orders  : Association to many Orders on orders.customer = $self;
}

/** Sales-order-like header entity. */
entity Orders : cuid, managed, HasStatus {
  customer   : Association to Customers not null;
  orderDate  : Date default $now;
  currency   : String(3) default 'IDR';
  totalAmount: Decimal(15,2) default 0;
  note       : String(500);

  // Composition means OrderItems are owned by the order lifecycle.
  // This supports deep create and cascade behavior for header-item data.
  items : Composition of many OrderItems
            on items.parent = $self;
}

/** Sales-order-like item entity. */
entity OrderItems : cuid, managed {
  parent    : Association to Orders not null;
  product   : Association to Products not null;
  quantity  : Integer not null;

  // The backend copies the trusted product price at order-creation time.
  // We do not trust a price supplied by the browser.
  unitPrice : Decimal(13,2) not null;
  lineTotal : Decimal(15,2) not null;
}

/**
 * Optimistic concurrency control.
 *
 * CAP turns the annotated `modifiedAt` field into an OData ETag. A client reads
 * the ETag and sends it back in `If-Match` when updating. If another user has
 * changed the record in between, CAP rejects the stale update instead of
 * silently overwriting newer data.
 */
annotate Products with {
  modifiedAt @odata.etag;
};

annotate Customers with {
  modifiedAt @odata.etag;
};

annotate Orders with {
  modifiedAt @odata.etag;
};
