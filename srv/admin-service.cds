using { learning.orders as db } from '../db/schema';

/**
 * Draft-enabled service for SAP Fiori elements practice.
 *
 * Why a second service?
 * - LearningService demonstrates explicit APIs, actions, and custom handlers.
 * - AdminService demonstrates the metadata-driven Fiori elements + draft path.
 *
 * Draft creates a temporary working copy while a user edits. The active
 * business record is changed only when the draft is activated.
 */
@path: '/admin'
@requires: 'Editor'
service AdminService {

  /**
   * CAP's draft provider adds the draft lifecycle endpoints and technical
   * fields expected by a Fiori elements edit flow.
   */
  @odata.draft.enabled
  entity Orders as projection on db.Orders;

  /**
   * The composition target is exposed so the order object page can edit items
   * as part of the same draft document.
   */
  entity OrderItems as projection on db.OrderItems;

  /** Read-only value-help/master-data entities. */
  @readonly entity Products  as projection on db.Products;
  @readonly entity Customers as projection on db.Customers;
}
