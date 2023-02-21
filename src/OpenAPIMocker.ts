import {
  DefaultBodyType,
  MockedResponse,
  PathParams,
  ResponseComposition,
  RestContext,
  RestRequest,
} from "msw";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import SwaggerClient from "swagger-client";

export type Method = "get" | "post" | "put" | "delete";
export type Document = OpenAPIV3_1.Document | OpenAPIV3.Document;
export type DocumentElement<
  D extends Document,
  V30,
  V31
> = D extends OpenAPIV3_1.Document ? V31 : V30;
export type DocumentOperation<D extends Document = Document> = DocumentElement<
  D,
  OpenAPIV3.OperationObject,
  OpenAPIV3_1.OperationObject
>;
// this is a simplified version of the schema
export interface DocumentSchemaFragment {
  type:
    | "array"
    | "object"
    | "string"
    | "boolean"
    | "number"
    | "integer"
    | "float";
  items?: DocumentSchemaFragment;
  properties?: { [key: string]: DocumentSchemaFragment };
  example?: string | number;
  enum?: string[];
  // these could be taken into account
  oneOf?: DocumentSchemaFragment[];
  anyOf?: DocumentSchemaFragment[];
  allOf?: DocumentSchemaFragment[];
}
export interface DocumentRequestBodyElement extends DocumentSchemaFragment {
  required?: boolean;
  nullable?: boolean;
}
export type DocumentRequestBody =
  | DocumentRequestBodyElement
  | { [key: string]: DocumentRequestBodyElement };

export type MockResponse =
  | {
      [key: string]: MockResponse | MockResponse[];
    }
  | string
  | number
  | null;

export interface Operation {
  operationId?: string;
  path: string;
  method: Method;
  mockResponseSuccess: MockResponse | MockResponse[];
  requestBody: DocumentRequestBody;
}

export interface OpenAPIMockerOptions<D> {
  definition?: D;
  validateRequestBody?: boolean;
}

/**
 * OpenAPIMocker is a class that mocks responses defined in openapi specification
 * Supports only OpenAPI 3.0.*
 * Takes into account only responses of type 'application/json'
 * No body validation or security headers
 */
export class OpenAPIMocker<D extends Document = Document> {
  definition?: D;
  validateRequestBody: boolean;
  operations: Operation[];

  constructor(params: OpenAPIMockerOptions<D>) {
    this.definition = params.definition;
    this.validateRequestBody =
      typeof params?.validateRequestBody === "boolean"
        ? params.validateRequestBody
        : true;
    this.operations = [];
  }

  async init() {
    const document = await this.resolveDocument();
    if (!document || !document.paths) return;

    const ops: Operation[] = [];

    // Build operations from paths
    Object.keys(document.paths).forEach((path) => {
      if (!document.paths) return;
      const value = document.paths[path];
      if (!value) return;

      // "get", "put", "post", "delete"
      const methodKeys = Object.keys(value);
      methodKeys.forEach((key) => {
        const METHODS = ["get", "post", "put", "delete"];
        if (!METHODS.includes(key)) return;
        const method = key as Method;
        const op = value[method] as DocumentOperation<D>;
        const { responses, requestBody, operationId } = op;
        if (!responses) return;
        // responses with different statuses
        Object.keys(responses).forEach((status) => {
          if (status === "200") {
            const content = responses[status] as DocumentElement<
              D,
              OpenAPIV3.ResponseObject,
              OpenAPIV3_1.ResponseObject
            >;
            const schema = this.getSchemaFromContent(
              content
            ) as DocumentSchemaFragment;
            if (!schema) return;
            const mockResponseSuccess = this.generateMockResponse(schema);

            // parse requestBody
            let schemaRequestBody;
            if (requestBody) {
              schemaRequestBody = this.getSchemaFromContent(
                requestBody
              ) as DocumentRequestBody;
            }

            // push operation
            ops.push({
              operationId,
              path,
              method,
              mockResponseSuccess,
              requestBody: schemaRequestBody,
            });
          }
        });
      });
    });

    // set operations
    this.operations = ops;
  }

  /**
   * Deferences the specification
   */
  async resolveDocument() {
    await SwaggerClient.resolve({ spec: this.definition });
    return this.definition;
  }

  /**
   * Small parser func
   */
  getSchemaFromContent(x: any) {
    const possibleKeys = [
      "application/json",
      "application/x-www-form-urlencoded",
    ];
    const content = x.content;
    if (!content) return null;
    const key = possibleKeys.find((key) => content[key]);
    const spec = content[key];
    if (!spec?.schema) return null;
    return spec.schema;
  }

  /**
   * Naive way to handle combined schemas
   * https://swagger.io/docs/specification/data-models/oneof-anyof-allof-not/
   */
  oneOffanyOffallOffHandler(
    value: DocumentSchemaFragment
  ): DocumentSchemaFragment {
    let val = value;
    if (val.oneOf) {
      val = val.oneOf[0];
    } else if (val.anyOf) {
      val = val.anyOf[0];
    }
    return val;
  }

  /**
   * Generates a mock response for each Openapi request schema
   */
  generateMockResponse(
    obj: DocumentSchemaFragment
  ): MockResponse | MockResponse[] {
    // inner function for recursion
    const inner = (
      value: DocumentSchemaFragment
    ): MockResponse | MockResponse[] => {
      const val = this.oneOffanyOffallOffHandler(value);
      switch (val.type) {
        case "array":
          return val.items ? [inner(val.items) as MockResponse] : [];
        case "object": {
          if (!val.properties) return null;
          const keys = Object.keys(val.properties);
          const obj: MockResponse = {};
          keys.forEach((key) => {
            if (!val.properties) return null;
            obj[key] = inner(val.properties[key]);
          });
          return obj;
        }
        default:
          // get the example or just return the type
          return val?.example || val.type;
      }
    };
    return inner(obj);
  }

  /**
   * Match exact and dynamic paths
   */
  getOperationForPathAndMethod(path: string, method: string) {
    return this.operations.find((op) => {
      const client = path.split("/");
      const back = op.path.split("/");
      if (client.length !== back.length) return false;
      const pathMatch = back.every(
        (val, i) => (val.startsWith("{") && client[i]) || val === client[i]
      );
      const methodMatch = op.method.toUpperCase() === method.toUpperCase();
      return pathMatch && methodMatch;
    });
  }

  /**
   * Naive way to validate request body
   */
  validatePostRequestBody(
    requestBody: object,
    schemaRequestBody: DocumentRequestBody
  ) {
    // inner function for recursion
    const inner = (
      value: object | number | string,
      schema: DocumentRequestBody
    ): boolean => {
      if (schema.anyOf || schema.oneOf || schema.allOf) {
        console.error("Not able to handle oneof-anyof-allof-not correctly");
        return false;
      }

      const valueNotDefined = typeof value === "undefined" || value === null;
      if (
        valueNotDefined &&
        (schema.nullable ||
          (typeof schema.required !== "undefined" && !schema.required))
      ) {
        return true;
      }
      if (valueNotDefined) {
        return false;
      }

      let isValid = false;

      switch (schema.type) {
        case "array":
          isValid =
            Array.isArray(value) &&
            value.every((val) => inner(val, schema.items));
          break;
        case "object":
          {
            const keys = Object.keys(schema.properties);
            isValid = keys.every((key) =>
              inner(value[key], schema.properties[key])
            );
          }
          break;
        default:
          {
            // handle odd types
            let desiredType = schema.type;
            if (desiredType === "integer" || desiredType === "float") {
              desiredType = "number";
            }
            // check the type
            isValid = typeof value === desiredType;
          }
          break;
      }

      return isValid;
    };
    return inner(requestBody, schemaRequestBody);
  }

  /**
   * Handles MSW request
   * ResponseResolver<RestRequest<DefaultBodyType, PathParams<string>>
   */
  async handleRequest(
    req: RestRequest<DefaultBodyType, PathParams<string>>,
    res: ResponseComposition<DefaultBodyType>,
    ctx: RestContext
  ): Promise<MockedResponse<DefaultBodyType>> {
    const method = req.method;
    const path = req.params["0"] as string;

    const operation = this.getOperationForPathAndMethod("/" + path, method);

    const mock = operation?.mockResponseSuccess;

    // not found
    if (!operation) {
      return res(ctx.status(404));
    }

    // validate body
    if (operation.requestBody && this.validateRequestBody) {
      const requestBody: object = await req.json();
      const isValidRequestBody = this.validatePostRequestBody(
        requestBody,
        operation.requestBody
      );
      if (!isValidRequestBody) {
        return res(ctx.status(400));
      }
    }

    ctx.status(200);
    return res(ctx.json(mock));
  }
}
