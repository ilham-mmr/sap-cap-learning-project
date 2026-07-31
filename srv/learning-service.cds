using { learning.orders as db } from '../db/schema';

/**
 * Public OData V4 contract.
 *
 * The database namespace stays internal. Projections let the API evolve
 * independently and avoid exposing every persistence detail by accident.
 */
@path: '/learning'
@requires: 'Viewer'
service LearningService {

  /**
   * Everyone with Viewer can read products.
   * Editor/Admin can change them. The backend remains the security boundary;
   * hiding an Edit button in UI5 would not be sufficient.
   */
  @restrict: [
    { grant: 'READ', to: 'Viewer' },
    { grant: ['CREATE', 'UPDATE'], to: 'Editor' },
    { grant: '*', to: 'Admin' }
  ]
  entity Products as projection on db.Products;

  @restrict: [
    { grant: 'READ', to: 'Viewer' },
    { grant: ['CREATE', 'UPDATE'], to: 'Editor' },
    { grant: '*', to: 'Admin' }
  ]
  entity Customers as projection on db.Customers;

  @restrict: [
    { grant: 'READ', to: 'Viewer' },
    { grant: ['CREATE', 'UPDATE'], to: 'Editor' },
    { grant: '*', to: 'Admin' }
  ]
  entity Orders as projection on db.Orders actions {
    /** Bound action: called for one specific order instance. */
    @requires: 'Editor'
    action submit() returns Orders;
  };

  @readonly
  entity OrderItems as projection on db.OrderItems;

  /** Read-only operation, therefore modeled as a function. */
  function lowStock(threshold : Integer) returns many Products;

  /** State-changing operation, therefore modeled as an action. */
  @requires: 'Editor'
  action restock(productID : UUID, quantity : Integer) returns Products;

  /**
   * An event is an announcement. A messaging service can later deliver it to
   * another application without tightly coupling that app to this handler.
   */
  event OrderSubmitted : {
    orderID     : UUID;
    totalAmount : Decimal(15,2);
  };
}
