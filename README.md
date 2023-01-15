# OpenAPI Mocker

OpenAPI-mocker is a library that helps creating a mock api handler out of OpenAPI specification. The goal is to mock APIs instead of fetch in integration tests. This library helps to minimise the amount of manual work when updating the ever changeing API mocks.

The library does not validate OpenAPI-specs. Instead it tries to optimistically get example mocks out of the OpenAPI-spec. If example value is not provided it will fallback to returning the type of the field.

## Usage

OpenAPIMocker is ment to be used with the library [Mock Service Worker (MSW)](https://mswjs.io/). Here is an exapmle how to use the framework.

```typescript
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
    const expected = {}; // here you should have some kind of expected result.
    expect(res).toEqual(expected);
  });
```

## not yet supported

- oneOf, anyOf, allOf, not [https://swagger.io/docs/specification/data-models/oneof-anyof-allof-not/](https://swagger.io/docs/specification/data-models/oneof-anyof-allof-not/)
  - optimistic support in place
- authorisation header validation
- query parameter validation
- no full support for schema types validation
- no full support for requestBody required & nullable validation

## Contribute?

> Please contribute with PR's. The framework is not yet complete
