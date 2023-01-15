"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAPIMocker = void 0;
const swagger_client_1 = require("swagger-client");
/**
 * OpenAPIMocker is a class that mocks responses defined in openapi specification
 * Supports only OpenAPI 3.0.*
 * Takes into account only responses of type 'application/json'
 * No body validation or security headers
 */
class OpenAPIMocker {
    constructor(params) {
        this.definition = params.definition;
        this.operations = [];
    }
    async init() {
        const document = this.definition;
        if (!document || !document.paths)
            return;
        const ops = [];
        // Build operations from paths
        Object.keys(document.paths).forEach((path) => {
            if (!document.paths)
                return;
            const value = document.paths[path];
            if (!value)
                return;
            // "get", "put", "post", "delete"
            const methodKeys = Object.keys(value);
            methodKeys.forEach((key) => {
                const METHODS = ["get", "post", "put", "delete"];
                if (!METHODS.includes(key))
                    return;
                const method = key;
                const op = value[method];
                const { responses, operationId } = op;
                if (!responses)
                    return;
                // responses with different statuses
                Object.keys(responses).forEach((status) => {
                    if (status === "200") {
                        const content = responses[status].content;
                        if (!(content === null || content === void 0 ? void 0 : content["application/json"]))
                            return;
                        const schema = content["application/json"]
                            .schema;
                        if (!schema)
                            return;
                        const mockResponseSuccess = this.generateMockResponse(schema);
                        // push operation
                        ops.push({
                            operationId,
                            path,
                            method,
                            mockResponseSuccess,
                        });
                    }
                });
            });
        });
        // set operations
        this.operations = ops;
    }
    async resolveDocument(document) {
        const definition = document;
        await swagger_client_1.SwaggerClient.resolve({ spec: definition });
        return this.document;
    }
    /**
     * Generates a mock response for each Openapi request schema
     */
    generateMockResponse(obj) {
        const inner = (val) => {
            switch (val.type) {
                case "array":
                    return val.items ? [inner(val.items)] : [];
                case "object": {
                    if (!val.properties)
                        return null;
                    const keys = Object.keys(val.properties);
                    const obj = {};
                    keys.forEach((key) => {
                        if (!val.properties)
                            return null;
                        obj[key] = inner(val.properties[key]);
                    });
                    return obj;
                }
                default:
                    // get the example or just return the type
                    return (val === null || val === void 0 ? void 0 : val.example) || val.type;
            }
        };
        return inner(obj);
    }
    /**
     * Match exact and dynamic paths
     */
    getOperationForPathAndMethod(path, method) {
        return this.operations.find((op) => {
            const client = path.split("/");
            const back = op.path.split("/");
            if (client.length !== back.length)
                return false;
            const pathMatch = back.every((val, i) => val.startsWith("{") || val === client[i]);
            const methodMatch = op.method.toUpperCase() === method.toUpperCase();
            return pathMatch && methodMatch;
        });
    }
    /**
     * Handles MSW request
     */
    handleRequest(req, res, ctx) {
        const status = 200;
        // TODO: validate body
        const method = req.method;
        const path = req.params["0"];
        const operation = this.getOperationForPathAndMethod("/" + path, method);
        const mockedResponse = operation === null || operation === void 0 ? void 0 : operation.mockResponseSuccess;
        ctx.status(status);
        return res(ctx.json(mockedResponse || { notFound: 404 }));
    }
}
exports.OpenAPIMocker = OpenAPIMocker;
//# sourceMappingURL=OpenAPIMocker.js.map