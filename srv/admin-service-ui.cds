using { AdminService } from './admin-service';

/**
 * Metadata-driven UI annotations.
 *
 * Fiori elements reads these annotations from OData $metadata and generates
 * standard pages. This is the opposite of freestyle UI5, where you manually
 * build XML views and controller behavior.
 */
annotate AdminService.Orders with @(
  UI.HeaderInfo: {
    TypeName       : '{i18n>Order}',
    TypeNamePlural : '{i18n>Orders}',
    Title           : { Value: ID },
    Description     : { Value: status }
  },
  UI.SelectionFields: [status, orderDate, customer_ID],
  UI.LineItem: [
    { Value: ID,          Label: '{i18n>OrderID}' },
    { Value: customer_ID, Label: '{i18n>Customer}' },
    { Value: orderDate,   Label: '{i18n>OrderDate}' },
    { Value: status,      Label: '{i18n>Status}' },
    { Value: totalAmount, Label: '{i18n>TotalAmount}' },
    { Value: currency,    Label: '{i18n>Currency}' }
  ],
  UI.FieldGroup #General: {
    Data: [
      { Value: customer_ID, Label: '{i18n>Customer}' },
      { Value: orderDate,   Label: '{i18n>OrderDate}' },
      { Value: status,      Label: '{i18n>Status}' },
      { Value: note,        Label: '{i18n>Note}' }
    ]
  },
  UI.Facets: [
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : '{i18n>General}',
      Target : '@UI.FieldGroup#General'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : '{i18n>Items}',
      Target : 'items/@UI.LineItem'
    }
  ]
);

annotate AdminService.OrderItems with @(
  UI.LineItem: [
    { Value: product_ID, Label: '{i18n>Product}' },
    { Value: quantity,   Label: '{i18n>Quantity}' },
    { Value: unitPrice,  Label: '{i18n>UnitPrice}' },
    { Value: lineTotal,  Label: '{i18n>LineTotal}' }
  ]
);

annotate AdminService.Products with @(
  UI.HeaderInfo: {
    TypeName       : '{i18n>Product}',
    TypeNamePlural : '{i18n>Products}',
    Title           : { Value: name },
    Description     : { Value: description }
  },
  UI.SelectionFields: [name, active],
  UI.LineItem: [
    { Value: name,   Label: '{i18n>ProductName}' },
    { Value: price,  Label: '{i18n>UnitPrice}' },
    { Value: stock,  Label: '{i18n>Stock}' },
    { Value: active, Label: '{i18n>Active}' }
  ]
);
