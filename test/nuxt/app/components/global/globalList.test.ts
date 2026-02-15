import { describe, it, expect } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";

import type { ShoppingListWithIntegration } from "~/types/ui";
import type { ShoppingListItem } from "~/types/database";

import GlobalList from "../../../../../app/components/global/globalList.vue";

function baseShoppingList(
  overrides: Partial<ShoppingListWithIntegration> & { id: string; name: string; order: number },
): ShoppingListWithIntegration {
  return {
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ShoppingListWithIntegration;
}

describe("GlobalList", () => {
  it("renders empty state when lists are empty", async () => {
    const wrapper = await mountSuspended(GlobalList, {
      props: {
        lists: [],
        loading: false,
      },
    });
    expect(wrapper.text()).toContain("No lists found");
  });

  it("shows loading state when loading", async () => {
    const wrapper = await mountSuspended(GlobalList, {
      props: {
        lists: [],
        loading: true,
      },
    });
    expect(wrapper.text()).toContain("Loading lists");
  });

  it("shows emptyStateDescription when provided and lists empty", async () => {
    const wrapper = await mountSuspended(GlobalList, {
      props: {
        lists: [],
        loading: false,
        emptyStateDescription: "Add your first list to get started.",
      },
    });
    expect(wrapper.text()).toContain("Add your first list to get started.");
  });

  it("renders with showEditItem as function and lists with items", async () => {
    const list = baseShoppingList({
      id: "list-1",
      name: "Groceries",
      order: 1,
      items: [
        {
          id: "item-1",
          name: "Milk",
          checked: false,
          order: 1,
          notes: null,
          quantity: 1,
          unit: null,
          label: null,
          food: null,
        },
      ] as ShoppingListItem[],
    });
    const showEditItemFn = () => true;
    const wrapper = await mountSuspended(GlobalList, {
      props: {
        lists: [list],
        loading: false,
        showEditItem: showEditItemFn,
      },
    });
    expect(wrapper.text()).toContain("Groceries");
    expect(wrapper.text()).toContain("Milk");
  });

  it("shows progress when showProgress and list has mixed completed and active items", async () => {
    const list = baseShoppingList({
      id: "list-1",
      name: "Tasks",
      order: 1,
      items: [
        { id: "i1", name: "A", checked: true, order: 1, notes: null, quantity: 1, unit: null, label: null, food: null },
        { id: "i2", name: "B", checked: false, order: 2, notes: null, quantity: 1, unit: null, label: null, food: null },
      ] as ShoppingListItem[],
    });
    const wrapper = await mountSuspended(GlobalList, {
      props: {
        lists: [list],
        loading: false,
        showProgress: true,
      },
    });
    expect(wrapper.text()).toContain("50%");
  });

  it("shows 0% progress when all items unchecked", async () => {
    const list = baseShoppingList({
      id: "list-1",
      name: "Tasks",
      order: 1,
      items: [
        { id: "i1", name: "A", checked: false, order: 1, notes: null, quantity: 1, unit: null, label: null, food: null },
        { id: "i2", name: "B", checked: false, order: 2, notes: null, quantity: 1, unit: null, label: null, food: null },
      ] as ShoppingListItem[],
    });
    const wrapper = await mountSuspended(GlobalList, {
      props: { lists: [list], loading: false, showProgress: true },
    });
    expect(wrapper.text()).toContain("0%");
  });

  it("shows 25% progress when one of four items checked", async () => {
    const list = baseShoppingList({
      id: "list-1",
      name: "Tasks",
      order: 1,
      items: [
        { id: "i1", name: "A", checked: true, order: 1, notes: null, quantity: 1, unit: null, label: null, food: null },
        { id: "i2", name: "B", checked: false, order: 2, notes: null, quantity: 1, unit: null, label: null, food: null },
        { id: "i3", name: "C", checked: false, order: 3, notes: null, quantity: 1, unit: null, label: null, food: null },
        { id: "i4", name: "D", checked: false, order: 4, notes: null, quantity: 1, unit: null, label: null, food: null },
      ] as ShoppingListItem[],
    });
    const wrapper = await mountSuspended(GlobalList, {
      props: { lists: [list], loading: false, showProgress: true },
    });
    expect(wrapper.text()).toContain("25%");
  });

  it("shows 75% progress when three of four items checked", async () => {
    const list = baseShoppingList({
      id: "list-1",
      name: "Tasks",
      order: 1,
      items: [
        { id: "i1", name: "A", checked: true, order: 1, notes: null, quantity: 1, unit: null, label: null, food: null },
        { id: "i2", name: "B", checked: true, order: 2, notes: null, quantity: 1, unit: null, label: null, food: null },
        { id: "i3", name: "C", checked: true, order: 3, notes: null, quantity: 1, unit: null, label: null, food: null },
        { id: "i4", name: "D", checked: false, order: 4, notes: null, quantity: 1, unit: null, label: null, food: null },
      ] as ShoppingListItem[],
    });
    const wrapper = await mountSuspended(GlobalList, {
      props: { lists: [list], loading: false, showProgress: true },
    });
    expect(wrapper.text()).toContain("75%");
  });

  it("shows 100% progress when all items checked", async () => {
    const list = baseShoppingList({
      id: "list-1",
      name: "Tasks",
      order: 1,
      items: [
        { id: "i1", name: "A", checked: true, order: 1, notes: null, quantity: 1, unit: null, label: null, food: null },
        { id: "i2", name: "B", checked: true, order: 2, notes: null, quantity: 1, unit: null, label: null, food: null },
      ] as ShoppingListItem[],
    });
    const wrapper = await mountSuspended(GlobalList, {
      props: { lists: [list], loading: false, showProgress: true },
    });
    expect(wrapper.text()).toContain("100%");
  });

  it("renders lists with source native and integration when showIntegrationIcons", async () => {
    const nativeList = baseShoppingList({
      id: "n1",
      name: "Native",
      order: 1,
      source: "native",
    });
    const integrationList = baseShoppingList({
      id: "i1",
      name: "Integration",
      order: 2,
      source: "integration",
      integrationName: "Mealie",
    });
    const wrapper = await mountSuspended(GlobalList, {
      props: {
        lists: [nativeList, integrationList],
        loading: false,
        showIntegrationIcons: true,
      },
    });
    expect(wrapper.text()).toContain("Native");
    expect(wrapper.text()).toContain("Integration");
  });
});
