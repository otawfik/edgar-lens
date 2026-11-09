import type { BaseQueryFn } from "@reduxjs/toolkit/query";

export interface GraphQLRequest {
  document: string;
  variables?: Record<string, unknown>;
}

export interface GraphQLBaseQueryError {
  /** HTTP status, or "FETCH_ERROR" when the request never completed. */
  status: number | "FETCH_ERROR";
  message: string;
  /** GraphQL error codes (BAD_USER_INPUT, QUERY_TOO_COSTLY…), when present. */
  codes: string[];
}

const OPERATION = /\b(?:query|mutation)\s+(\w+)/;

/**
 * A ~40-line GraphQL transport for RTK Query. RTK Query already does caching,
 * de-duplication, loading state and invalidation; all it needs from a GraphQL
 * client is "POST this document, give me data or an error". Partial results
 * (data + errors) are treated as errors: this app never renders half a page.
 */
export function graphqlBaseQuery({
  url,
  fetchFn = (...args) => fetch(...args),
}: {
  url: string;
  fetchFn?: typeof fetch;
}): BaseQueryFn<GraphQLRequest, unknown, GraphQLBaseQueryError> {
  return async ({ document, variables }, { signal }) => {
    const operationName = OPERATION.exec(document)?.[1];
    let res: Response;
    try {
      res = await fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ query: document, variables, operationName }),
        signal,
      });
    } catch (err) {
      return {
        error: { status: "FETCH_ERROR", message: err instanceof Error ? err.message : String(err), codes: [] },
      };
    }
    let body: { data?: unknown; errors?: { message: string; extensions?: { code?: string } }[] };
    try {
      body = await res.json();
    } catch {
      return { error: { status: res.status, message: `Invalid JSON response (${res.status})`, codes: [] } };
    }
    if (body.errors?.length) {
      return {
        error: {
          status: res.status,
          message: body.errors.map((e) => e.message).join("; "),
          codes: body.errors.map((e) => e.extensions?.code).filter((c): c is string => !!c),
        },
      };
    }
    if (!res.ok || body.data === undefined) {
      return { error: { status: res.status, message: `GraphQL request failed (${res.status})`, codes: [] } };
    }
    return { data: body.data };
  };
}
