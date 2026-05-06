/**
 * Repository tests using a mocked DynamoDB Document Client.
 *
 * These run in milliseconds and don't need AWS credentials or a real table.
 * Each `it` exercises a specific branch in `todoRepository`. Add new cases
 * here whenever you add behavior to the repo — this is the cheapest place
 * to lock in correctness.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

// Stub the env BEFORE importing the repository, since env.ts reads on access.
process.env.TODOS_TABLE_NAME = "test-todos";
process.env.AWS_REGION = "us-east-1";

const sendMock = vi.fn();
vi.mock("../lib/ddb.js", () => ({
  ddb: { send: (...args: unknown[]) => sendMock(...args) },
}));

const { todoRepository } = await import("./todoRepository.js");

/** Small helper: build a fully-shaped Todo for fixture data. */
function fixture(overrides: Partial<{
  id: string;
  title: string;
  description: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}> = {}) {
  const now = "2024-01-01T00:00:00.000Z";
  return {
    id: "fixture-id",
    title: "fixture",
    done: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Construct a ConditionalCheckFailedException-like error. */
function ccfe() {
  const err = new Error("The conditional request failed");
  err.name = "ConditionalCheckFailedException";
  return err;
}

describe("todoRepository.list", () => {
  beforeEach(() => sendMock.mockReset());

  it("returns an empty array when DynamoDB has no items", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });
    expect(await todoRepository.list()).toEqual([]);
  });

  it("treats an undefined Items field as empty (no crash)", async () => {
    sendMock.mockResolvedValueOnce({});
    expect(await todoRepository.list()).toEqual([]);
  });

  it("sorts items newest-first by createdAt", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        fixture({ id: "a", createdAt: "2024-01-01T00:00:00Z" }),
        fixture({ id: "b", createdAt: "2024-12-31T00:00:00Z" }),
        fixture({ id: "c", createdAt: "2024-06-01T00:00:00Z" }),
      ],
    });
    const ids = (await todoRepository.list()).map((t) => t.id);
    expect(ids).toEqual(["b", "c", "a"]);
  });

  it("issues a Scan command against the configured table", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });
    await todoRepository.list();
    const cmd = sendMock.mock.calls[0]?.[0];
    expect(cmd).toBeInstanceOf(ScanCommand);
    expect((cmd as ScanCommand).input.TableName).toBe("test-todos");
  });
});

describe("todoRepository.getById", () => {
  beforeEach(() => sendMock.mockReset());

  it("returns the item when present", async () => {
    sendMock.mockResolvedValueOnce({ Item: fixture({ id: "abc" }) });
    expect(await todoRepository.getById("abc")).toMatchObject({ id: "abc" });
  });

  it("returns undefined when item is missing", async () => {
    sendMock.mockResolvedValueOnce({});
    expect(await todoRepository.getById("missing")).toBeUndefined();
  });

  it("propagates unexpected errors (does not swallow)", async () => {
    sendMock.mockRejectedValueOnce(new Error("network down"));
    await expect(todoRepository.getById("x")).rejects.toThrow("network down");
  });

  it("issues a GetCommand keyed by id", async () => {
    sendMock.mockResolvedValueOnce({});
    await todoRepository.getById("abc");
    const cmd = sendMock.mock.calls[0]?.[0];
    expect(cmd).toBeInstanceOf(GetCommand);
    expect((cmd as GetCommand).input.Key).toEqual({ id: "abc" });
  });
});

describe("todoRepository.create", () => {
  beforeEach(() => sendMock.mockReset());

  it("generates a UUID v4 id", async () => {
    sendMock.mockResolvedValueOnce({});
    const todo = await todoRepository.create({ title: "x" });
    expect(todo.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("sets createdAt === updatedAt on creation", async () => {
    sendMock.mockResolvedValueOnce({});
    const todo = await todoRepository.create({ title: "x" });
    expect(todo.createdAt).toBe(todo.updatedAt);
  });

  it("defaults done to false when not provided", async () => {
    sendMock.mockResolvedValueOnce({});
    const todo = await todoRepository.create({ title: "x" });
    expect(todo.done).toBe(false);
  });

  it("respects an explicit done: true", async () => {
    sendMock.mockResolvedValueOnce({});
    const todo = await todoRepository.create({ title: "x", done: true });
    expect(todo.done).toBe(true);
  });

  it("uses a PutCommand with attribute_not_exists guard", async () => {
    sendMock.mockResolvedValueOnce({});
    await todoRepository.create({ title: "x" });
    const cmd = sendMock.mock.calls[0]?.[0] as PutCommand;
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.ConditionExpression).toMatch(/attribute_not_exists/);
  });

  it("propagates unexpected errors from DDB", async () => {
    sendMock.mockRejectedValueOnce(new Error("throttled"));
    await expect(todoRepository.create({ title: "x" })).rejects.toThrow(
      "throttled",
    );
  });
});

describe("todoRepository.update", () => {
  beforeEach(() => sendMock.mockReset());

  it("returns the updated todo on success", async () => {
    sendMock.mockResolvedValueOnce({
      Attributes: fixture({ id: "abc", title: "updated" }),
    });
    const result = await todoRepository.update("abc", { title: "updated" });
    expect(result).toMatchObject({ id: "abc", title: "updated" });
  });

  it("returns undefined when the row does not exist (ConditionalCheckFailed)", async () => {
    sendMock.mockRejectedValueOnce(ccfe());
    expect(
      await todoRepository.update("missing", { title: "x" }),
    ).toBeUndefined();
  });

  it("only sets fields that were provided (partial update)", async () => {
    sendMock.mockResolvedValueOnce({ Attributes: fixture() });
    await todoRepository.update("abc", { done: true });
    const cmd = sendMock.mock.calls[0]?.[0] as UpdateCommand;
    const expr = cmd.input.UpdateExpression ?? "";
    expect(expr).toMatch(/#done = :done/);
    expect(expr).not.toMatch(/#title = :title/);
    expect(expr).not.toMatch(/#description = :description/);
    // updatedAt is always touched.
    expect(expr).toMatch(/#updatedAt = :updatedAt/);
  });

  it("can update all fields together", async () => {
    sendMock.mockResolvedValueOnce({ Attributes: fixture() });
    await todoRepository.update("abc", {
      title: "t",
      description: "d",
      done: true,
    });
    const cmd = sendMock.mock.calls[0]?.[0] as UpdateCommand;
    expect(cmd.input.UpdateExpression).toMatch(/#title = :title/);
    expect(cmd.input.UpdateExpression).toMatch(/#description = :description/);
    expect(cmd.input.UpdateExpression).toMatch(/#done = :done/);
  });

  it("can update done to false (falsy values are not skipped)", async () => {
    sendMock.mockResolvedValueOnce({ Attributes: fixture({ done: false }) });
    await todoRepository.update("abc", { done: false });
    const cmd = sendMock.mock.calls[0]?.[0] as UpdateCommand;
    expect(cmd.input.ExpressionAttributeValues?.[":done"]).toBe(false);
  });

  it("can update description to an empty string", async () => {
    sendMock.mockResolvedValueOnce({ Attributes: fixture() });
    await todoRepository.update("abc", { description: "" });
    const cmd = sendMock.mock.calls[0]?.[0] as UpdateCommand;
    expect(cmd.input.ExpressionAttributeValues?.[":description"]).toBe("");
  });

  it("propagates non-conditional errors", async () => {
    sendMock.mockRejectedValueOnce(new Error("network"));
    await expect(
      todoRepository.update("abc", { title: "x" }),
    ).rejects.toThrow("network");
  });

  it("uses ReturnValues: ALL_NEW to fetch the updated row", async () => {
    sendMock.mockResolvedValueOnce({ Attributes: fixture() });
    await todoRepository.update("abc", { title: "y" });
    const cmd = sendMock.mock.calls[0]?.[0] as UpdateCommand;
    expect(cmd.input.ReturnValues).toBe("ALL_NEW");
  });
});

describe("todoRepository.delete", () => {
  beforeEach(() => sendMock.mockReset());

  it("returns true when delete succeeds", async () => {
    sendMock.mockResolvedValueOnce({});
    expect(await todoRepository.delete("abc")).toBe(true);
  });

  it("returns false when row does not exist (ConditionalCheckFailed)", async () => {
    sendMock.mockRejectedValueOnce(ccfe());
    expect(await todoRepository.delete("missing")).toBe(false);
  });

  it("propagates non-conditional errors", async () => {
    sendMock.mockRejectedValueOnce(new Error("boom"));
    await expect(todoRepository.delete("x")).rejects.toThrow("boom");
  });

  it("uses a DeleteCommand with attribute_exists guard", async () => {
    sendMock.mockResolvedValueOnce({});
    await todoRepository.delete("abc");
    const cmd = sendMock.mock.calls[0]?.[0] as DeleteCommand;
    expect(cmd).toBeInstanceOf(DeleteCommand);
    expect(cmd.input.ConditionExpression).toMatch(/attribute_exists/);
    expect(cmd.input.Key).toEqual({ id: "abc" });
  });
});
