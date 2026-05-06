/**
 * Validation tests — edge cases for the public input validators.
 *
 * These guard the boundary between untrusted client input and our domain.
 * Every accepted weird input here is one fewer surprise in production.
 */
import { describe, expect, it } from "vitest";
import {
  validateCreateTodoInput,
  validateUpdateTodoInput,
} from "./index.js";

describe("validateCreateTodoInput", () => {
  describe("happy paths", () => {
    it("accepts the minimum: just a title", () => {
      expect(validateCreateTodoInput({ title: "buy milk" })).toEqual({
        title: "buy milk",
        description: undefined,
        done: undefined,
      });
    });

    it("accepts title + description + done", () => {
      const result = validateCreateTodoInput({
        title: "ship",
        description: "to prod",
        done: false,
      });
      expect(result).toEqual({
        title: "ship",
        description: "to prod",
        done: false,
      });
    });

    it("trims surrounding whitespace from title", () => {
      expect(validateCreateTodoInput({ title: "   spaced   " })).toMatchObject({
        title: "spaced",
      });
    });

    it("accepts unicode, emoji, and combining characters", () => {
      const cases = ["café", "🚀 launch", "日本語", "á"];
      for (const title of cases) {
        expect(validateCreateTodoInput({ title })).toMatchObject({ title });
      }
    });

    it("accepts a title exactly at the 200-char limit", () => {
      const title = "a".repeat(200);
      expect(validateCreateTodoInput({ title })).toMatchObject({ title });
    });

    it("accepts an empty-string description (treated as present)", () => {
      // Empty string is a valid description. Repository layer stores it
      // verbatim. If you want "no description" use undefined / omit.
      expect(
        validateCreateTodoInput({ title: "x", description: "" }),
      ).toMatchObject({ description: "" });
    });

    it("ignores unknown extra fields silently", () => {
      const result = validateCreateTodoInput({
        title: "x",
        bogus: "ignored",
        secret: 42,
      });
      expect(result).not.toHaveProperty("bogus");
      expect(result).not.toHaveProperty("secret");
    });
  });

  describe("rejections", () => {
    it.each<[string, unknown]>([
      ["null body", null],
      ["undefined body", undefined],
      ["primitive number", 42],
      ["primitive string", "hello"],
      ["primitive boolean", true],
      ["array body", []],
    ])("rejects %s", (_label, value) => {
      expect(() => validateCreateTodoInput(value)).toThrow();
    });

    it("rejects missing title", () => {
      expect(() => validateCreateTodoInput({})).toThrow(/title/i);
    });

    it("rejects empty-string title", () => {
      expect(() => validateCreateTodoInput({ title: "" })).toThrow(/title/i);
    });

    it("rejects whitespace-only title (post-trim it would be empty)", () => {
      expect(() => validateCreateTodoInput({ title: "   " })).toThrow(/title/i);
    });

    it("rejects title that is not a string", () => {
      expect(() => validateCreateTodoInput({ title: 123 })).toThrow(/title/i);
      expect(() => validateCreateTodoInput({ title: null })).toThrow(/title/i);
      expect(() => validateCreateTodoInput({ title: ["x"] })).toThrow(/title/i);
    });

    it("rejects title longer than 200 chars", () => {
      const tooLong = "a".repeat(201);
      expect(() => validateCreateTodoInput({ title: tooLong })).toThrow(/200/);
    });

    it("rejects non-string description", () => {
      expect(() =>
        validateCreateTodoInput({ title: "x", description: 5 }),
      ).toThrow(/description/i);
    });

    it("rejects non-boolean done", () => {
      expect(() =>
        validateCreateTodoInput({ title: "x", done: "yes" }),
      ).toThrow(/done/i);
      expect(() => validateCreateTodoInput({ title: "x", done: 1 })).toThrow(
        /done/i,
      );
    });
  });
});

describe("validateUpdateTodoInput", () => {
  describe("happy paths", () => {
    it("accepts a single-field update (title only)", () => {
      expect(validateUpdateTodoInput({ title: "renamed" })).toEqual({
        title: "renamed",
      });
    });

    it("accepts a single-field update (done only)", () => {
      expect(validateUpdateTodoInput({ done: true })).toEqual({ done: true });
    });

    it("accepts a single-field update (description only)", () => {
      expect(validateUpdateTodoInput({ description: "more" })).toEqual({
        description: "more",
      });
    });

    it("accepts updating to false / empty (not just truthy values)", () => {
      expect(validateUpdateTodoInput({ done: false })).toEqual({ done: false });
      expect(validateUpdateTodoInput({ description: "" })).toEqual({
        description: "",
      });
    });

    it("ignores unknown extra fields", () => {
      expect(
        validateUpdateTodoInput({ done: true, bogus: "x" }),
      ).toEqual({ done: true });
    });
  });

  describe("rejections", () => {
    it("rejects an empty object (no fields to update)", () => {
      expect(() => validateUpdateTodoInput({})).toThrow(
        /at least one field/i,
      );
    });

    it("rejects null and non-object bodies", () => {
      for (const v of [null, undefined, 1, "hi", [], true]) {
        expect(() => validateUpdateTodoInput(v)).toThrow();
      }
    });

    it("rejects empty-string title (must be non-empty when provided)", () => {
      expect(() => validateUpdateTodoInput({ title: "" })).toThrow(/title/i);
    });

    it("rejects whitespace-only title", () => {
      expect(() => validateUpdateTodoInput({ title: "   " })).toThrow(/title/i);
    });

    it("rejects title over 200 chars", () => {
      expect(() =>
        validateUpdateTodoInput({ title: "a".repeat(201) }),
      ).toThrow(/200/);
    });

    it("rejects non-string description and non-boolean done", () => {
      expect(() =>
        validateUpdateTodoInput({ description: 1 as unknown as string }),
      ).toThrow();
      expect(() =>
        validateUpdateTodoInput({ done: "yes" as unknown as boolean }),
      ).toThrow();
    });
  });
});
