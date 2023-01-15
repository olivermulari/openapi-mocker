import { DefaultBodyType, PathParams, ResponseComposition, RestContext, RestRequest } from "msw";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
export type Method = "get" | "post" | "put" | "delete";
export type Document = OpenAPIV3_1.Document | OpenAPIV3.Document;
export type DocumentElement<D extends Document, V30, V31> = D extends OpenAPIV3_1.Document ? V31 : V30;
export type DocumentOperation<D extends Document = Document> = DocumentElement<D, OpenAPIV3.OperationObject, OpenAPIV3_1.OperationObject>;
export interface DocumentResponseFragment {
    type: "array" | "object" | "string" | "number";
    items?: DocumentResponseFragment;
    properties?: {
        [key: string]: DocumentResponseFragment;
    };
    example?: string | number;
}
export type MockResponse = {
    [key: string]: MockResponse | MockResponse[];
} | string | number | null;
export interface Operation {
    operationId?: string;
    path: string;
    method: Method;
    mockResponseSuccess: MockResponse | MockResponse[];
}
export interface OpenAPIMockerOptions<D> {
    definition?: D;
}
/**
 * OpenAPIMocker is a class that mocks responses defined in openapi specification
 * Supports only OpenAPI 3.0.*
 * Takes into account only responses of type 'application/json'
 * No body validation or security headers
 */
export declare class OpenAPIMocker<D extends Document = Document> {
    definition?: D;
    document?: D;
    operations: Operation[];
    constructor(params: OpenAPIMockerOptions<D>);
    init(): Promise<void>;
    resolveDocument(document: D): Promise<D>;
    /**
     * Generates a mock response for each Openapi request schema
     */
    generateMockResponse(obj: DocumentResponseFragment): MockResponse | MockResponse[];
    /**
     * Match exact and dynamic paths
     */
    getOperationForPathAndMethod(path: string, method: string): Operation;
    /**
     * Handles MSW request
     */
    handleRequest(req: RestRequest<DefaultBodyType, PathParams<string>>, res: ResponseComposition<DefaultBodyType>, ctx: RestContext): import("msw/lib/SetupApi-b2f0e5ac").j<DefaultBodyType> | Promise<import("msw/lib/SetupApi-b2f0e5ac").j<DefaultBodyType>>;
}
