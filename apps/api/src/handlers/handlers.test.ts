/**
 * Handler-level tests.
 *
 * These exercise the HTTP boundary: status codes, error envelopes,
 * validation passthrough, and the few branches that aren't visible from
 * the repository layer (missing path params, malformed JSON, etc).
 *
 * The repository is mocked so each test is fast and deterministic.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

process.env.TODOS_TABLE_NAME = "test-todos";
process.env.TODOS_USER_INDEX = "userId-index";
process.env.AWS_REGION = "us-east-1";

const TEST_USER_ID = "user-test-123";

const repoMock = {
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../repository/todoRepository.js", () => ({
  todoRepository: repoMock,
}));

const { handler: listHandler } = await import("./listTodos.js");
const { handler: getHandler } = await import("./getTodo.js");
const { handler: createHandler } = await import("./createTodo.js");
const { handler: updateHandler } = await import("./updateTodo.js");
const { handler: deleteHandler } = await import("./deleteTodo.js");

/** Build a minimal API Gateway v2 event with JWT claims for tests. */
function event(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/",
    rawQueryString: "",
    headers: {},
    requestContext: {
      authorizer: { jwt: { claims: { sub: TEST_USER_ID } } },
    } as unknown as APIGatewayProxyEventV2["requestContext"],
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}

function bodyOf(result: APIGatewayProxyResultV2): unknown {
  if (typeof result === "string") return result;
  return result.body ? JSON.parse(result.body) : undefined;
}

function statusOf(result: APIGatewayProxyResultV2): number {
  if (typeof result === "string") return 200;
  return result.statusCode ?? 200;
}

beforeEach(() => {
  for (const fn of Object.values(repoMock)) fn.mockReset();
});

/* -------------------------------------------------------------------------- */
/* GET /todos                                                                 */
/* -------------------------------------------------------------------------- */
describe("listTodos handler", () => {
  it("200s with the array from the repository", async () => {
    repoMock.list.mockResolvedValueOnce([{ id: "1" }, { id: "2" }]);
    const result = await listHandler(event());
    expect(statusOf(result)).toBe(200);
    expect(bodyOf(result)).toEqual([{ id: "1" }, { id: "2" }]);
  });

  it("200s with an empty array when there are no todos", async () => {
    repoMock.list.mockResolvedValueOnce([]);
    const result = await listHandler(event());
    expect(statusOf(result)).toBe(200);
    expect(bodyOf(result)).toEqual([]);
  });

  it("500s when the repository throws", async () => {
    repoMock.list.mockRejectedValueOnce(new Error("ddb down"));
    const result = await listHandler(event());
    expect(statusOf(result)).toBe(500);
    expect(bodyOf(result)).toMatchObject({ error: "InternalError" });
  });
});

/* -------------------------------------------------------------------------- */
/* GET /todos/{id}                                                            */
/* -------------------------------------------------------------------------- */
describe("getTodo handler", () => {
  it("200s when found", async () => {
    repoMock.getById.mockResolvedValueOnce({ id: "abc", title: "x" });
    const result = await getHandler(event({ pathParameters: { id: "abc" } }));
    expect(statusOf(result)).toBe(200);
    expect(bodyOf(result)).toMatchObject({ id: "abc" });
  });

  it("404s when not found", async () => {
    repoMock.getById.mockResolvedValueOnce(undefined);
    const result = await getHandler(
      event({ pathParameters: { id: "missing" } }),
    );
    expect(statusOf(result)).toBe(404);
    expect(bodyOf(result)).toMatchObject({ error: "NotFound" });
  });

  it("400s when path param :id is missing", async () => {
    const result = await getHandler(event());
    expect(statusOf(result)).toBe(400);
    expect(bodyOf(result)).toMatchObject({ error: "BadRequest" });
  });

  it("500s on unexpected repo errors", async () => {
    repoMock.getById.mockRejectedValueOnce(new Error("boom"));
    const result = await getHandler(event({ pathParameters: { id: "x" } }));
    expect(statusOf(result)).toBe(500);
  });
});

/* -------------------------------------------------------------------------- */
/* POST /todos                                                                */
/* -------------------------------------------------------------------------- */
describe("createTodo handler", () => {
  it("201s with the created todo on valid input", async () => {
    const todo = {
      id: "1",
      title: "buy",
      done: false,
      createdAt: "x",
      updatedAt: "x",
    };
    repoMock.create.mockResolvedValueOnce(todo);
    const result = await createHandler(
      event({ body: JSON.stringify({ title: "buy" }) }),
    );
    expect(statusOf(result)).toBe(201);
    expect(bodyOf(result)).toEqual(todo);
  });

  it("400s when body is missing entirely", async () => {
    const result = await createHandler(event({ body: undefined }));
    expect(statusOf(result)).toBe(400);
    expect(repoMock.create).not.toHaveBeenCalled();
  });

  it("400s when body is not valid JSON", async () => {
    const result = await createHandler(event({ body: "{not json" }));
    expect(statusOf(result)).toBe(400);
    expect(repoMock.create).not.toHaveBeenCalled();
  });

  it("400s when title is missing", async () => {
    const result = await createHandler(event({ body: JSON.stringify({}) }));
    expect(statusOf(result)).toBe(400);
    expect(bodyOf(result)).toMatchObject({ error: "BadRequest" });
    expect(repoMock.create).not.toHaveBeenCalled();
  });

  it("400s when title is empty / whitespace / too long", async () => {
    for (const title of ["", "   ", "a".repeat(201)]) {
      const result = await createHandler(
        event({ body: JSON.stringify({ title }) }),
      );
      expect(statusOf(result)).toBe(400);
    }
    expect(repoMock.create).not.toHaveBeenCalled();
  });

  it("400s when done is not a boolean", async () => {
    const result = await createHandler(
      event({ body: JSON.stringify({ title: "x", done: "yes" }) }),
    );
    expect(statusOf(result)).toBe(400);
  });

  it("500s when repository throws unexpectedly", async () => {
    repoMock.create.mockRejectedValueOnce(new Error("ddb"));
    const result = await createHandler(
      event({ body: JSON.stringify({ title: "x" }) }),
    );
    expect(statusOf(result)).toBe(500);
  });
});

/* -------------------------------------------------------------------------- */
/* PUT /todos/{id}                                                            */
/* -------------------------------------------------------------------------- */
describe("updateTodo handler", () => {
  const validBody = JSON.stringify({ done: true });

  it("200s with the updated todo on success", async () => {
    repoMock.update.mockResolvedValueOnce({
      id: "abc",
      title: "x",
      done: true,
      createdAt: "t",
      updatedAt: "t",
    });
    const result = await updateHandler(
      event({ pathParameters: { id: "abc" }, body: validBody }),
    );
    expect(statusOf(result)).toBe(200);
    expect(bodyOf(result)).toMatchObject({ done: true });
  });

  it("404s when the todo does not exist", async () => {
    repoMock.update.mockResolvedValueOnce(undefined);
    const result = await updateHandler(
      event({ pathParameters: { id: "missing" }, body: validBody }),
    );
    expect(statusOf(result)).toBe(404);
  });

  it("400s when path param :id is missing", async () => {
    const result = await updateHandler(event({ body: validBody }));
    expect(statusOf(result)).toBe(400);
  });

  it("400s when body is missing", async () => {
    const result = await updateHandler(
      event({ pathParameters: { id: "abc" } }),
    );
    expect(statusOf(result)).toBe(400);
  });

  it("400s when body is empty object (no fields to update)", async () => {
    const result = await updateHandler(
      event({ pathParameters: { id: "abc" }, body: "{}" }),
    );
    expect(statusOf(result)).toBe(400);
    expect(repoMock.update).not.toHaveBeenCalled();
  });

  it("400s on invalid JSON", async () => {
    const result = await updateHandler(
      event({ pathParameters: { id: "abc" }, body: "{not-json" }),
    );
    expect(statusOf(result)).toBe(400);
  });

  it("400s when a field has the wrong type", async () => {
    const result = await updateHandler(
      event({
        pathParameters: { id: "abc" },
        body: JSON.stringify({ done: 1 }),
      }),
    );
    expect(statusOf(result)).toBe(400);
  });
});

/* -------------------------------------------------------------------------- */
/* DELETE /todos/{id}                                                         */
/* -------------------------------------------------------------------------- */
describe("deleteTodo handler", () => {
  it("204s when the row was deleted", async () => {
    repoMock.delete.mockResolvedValueOnce(true);
    const result = await deleteHandler(
      event({ pathParameters: { id: "abc" } }),
    );
    expect(statusOf(result)).toBe(204);
  });

  it("404s when the row did not exist", async () => {
    repoMock.delete.mockResolvedValueOnce(false);
    const result = await deleteHandler(
      event({ pathParameters: { id: "missing" } }),
    );
    expect(statusOf(result)).toBe(404);
  });

  it("400s when :id is missing", async () => {
    const result = await deleteHandler(event());
    expect(statusOf(result)).toBe(400);
  });

  it("500s on unexpected errors", async () => {
    repoMock.delete.mockRejectedValueOnce(new Error("boom"));
    const result = await deleteHandler(
      event({ pathParameters: { id: "x" } }),
    );
    expect(statusOf(result)).toBe(500);
  });
});
