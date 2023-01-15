import { rest } from "msw";
import { enableFetchMocks } from "jest-fetch-mock";
import { setupServer, SetupServerApi } from "msw/node";
import OpenAPIMocker, { Document } from "../src/index";

// only json supported
import exampleApiSpec from "./api-with-examples.json";

// api url can be anything that you call from the application
const API_URL = "https://google.com";

// setup tests
let server: SetupServerApi;

beforeAll(async () => {
  // jest-fetch-mock to enable fetch
  enableFetchMocks();
  fetchMock.dontMock();

  // setup api
  const definition = exampleApiSpec as Document;
  const mockOpenApi = new OpenAPIMocker({ definition });
  await mockOpenApi.init();

  // setup server
  server = setupServer(
    rest.all(`${API_URL}/*`, async (req, res, ctx) =>
      mockOpenApi.handleRequest(req, res, ctx)
    )
  );
  server.listen();
});

afterAll(() => server.close());

// actual tests!

describe("Test example api", () => {
  it("should find base path", async () => {
    const res = await fetchMock(API_URL + "/").then((res) => res.json());
    const expected = {
      total: "integer",
      apis: [
        {
          apiKey: "string",
          apiVersionNumber: "string",
          apiUrl: "string",
          apiDocumentationUrl: "string",
        },
      ],
    };
    expect(res).toEqual(expected);
  });

  it("should find record fields from dynamic path", async () => {
    const res = await fetchMock(API_URL + "/dataset/version/fields", {
      method: "GET",
    }).then((res) => res.json());
    const expected = "string";
    expect(res).toEqual(expected);
  });

  it("should post record correctly", async () => {
    const res = await fetchMock(API_URL + "/dataset/version/records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        criteria: "*:*",
        start: 0,
        rows: 100,
      }),
    }).then((res) => res.json());
    const expected = ["string"];
    expect(res).toEqual(expected);
  });

  it("should be not found: 404", async () => {
    const res = await fetchMock(API_URL + "/totally/random/route/not");
    expect(res.status).toEqual(404);
  });

  it("invalid body: 400", async () => {
    const res = await fetchMock(API_URL + "/dataset/version/records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows: 100,
      }),
    });
    expect(res.status).toEqual(400);
  });
});
