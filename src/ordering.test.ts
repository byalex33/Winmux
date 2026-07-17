import { expect, test } from "vitest";
import { moveById } from "./ordering";

test("reorders persisted folder and terminal rows by id", () => {
  const items = [{ id: "one" }, { id: "two" }, { id: "three" }];
  expect(moveById(items, "three", 0).map(({ id }) => id)).toEqual([
    "three",
    "one",
    "two",
  ]);
  expect(moveById(items, "one", 99).map(({ id }) => id)).toEqual([
    "two",
    "three",
    "one",
  ]);
  expect(moveById(items, "missing", 1)).toEqual(items);
});
