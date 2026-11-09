import { createApi } from "@reduxjs/toolkit/query/react";
import { COMPANY, COMPARE, LATEST_FILINGS, SCREENER } from "@/graphql/operations";
import type {
  CompanyQuery,
  CompanyQueryVariables,
  CompareQuery,
  CompareQueryVariables,
  LatestFilingsQuery,
  LatestFilingsQueryVariables,
  ScreenerQuery,
} from "@/graphql/types.generated";
import { graphqlBaseQuery } from "./graphqlBaseQuery";

/**
 * Every server read goes through here. Each endpoint pairs an operation from
 * src/graphql/operations.ts with its codegen'd result and variable types, so
 * a schema change that breaks a component fails `tsc`, not the browser.
 */
export const api = createApi({
  reducerPath: "api",
  baseQuery: graphqlBaseQuery({ url: "/api/graphql" }),
  // The snapshot changes only on redeploy; keep results for the session.
  keepUnusedDataFor: 600,
  endpoints: (build) => ({
    screener: build.query<ScreenerQuery, void>({
      query: () => ({ document: SCREENER }),
    }),
    company: build.query<CompanyQuery, CompanyQueryVariables>({
      query: (variables) => ({ document: COMPANY, variables }),
    }),
    compare: build.query<CompareQuery, CompareQueryVariables>({
      query: (variables) => ({ document: COMPARE, variables }),
    }),
    latestFilings: build.query<LatestFilingsQuery, LatestFilingsQueryVariables>({
      query: (variables) => ({ document: LATEST_FILINGS, variables }),
    }),
  }),
});

export const {
  useScreenerQuery,
  useCompanyQuery,
  useCompareQuery,
  useLatestFilingsQuery,
} = api;
