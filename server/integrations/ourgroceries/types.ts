/**
 * OurGroceries API Types
 * Reverse-engineered from https://github.com/ljmerza/py-our-groceries
 */

export type OurGroceriesAuthResponse = {
  success: boolean;
  sessionId?: string;
  error?: string;
};

export type OurGroceriesListItem = {
  id: string;
  value: string; // Item name
  categoryId?: string;
  crossed?: boolean; // Whether item is checked off
  autoAdd?: boolean;
};

export type OurGroceriesList = {
  id: string;
  name: string;
  versionId: string;
  items: OurGroceriesListItem[];
};

export type OurGroceriesGetListsResponse = {
  shoppingLists: Array<{
    id: string;
    name: string;
    versionId: string;
  }>;
};

export type OurGroceriesGetListItemsResponse = {
  list: {
    id: string;
    name: string;
    versionId: string;
    items: OurGroceriesListItem[];
  };
};
