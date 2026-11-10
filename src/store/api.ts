import { createApi } from "@reduxjs/toolkit/query/react";
import { COMPANY, COMPANY_LIST, DIFF, HOME, SCREENER } from "@/graphql/operations";
import type {
  CompanyListQuery,
  CompanyQuery,
  CompanyQueryVariables,
  DiffQuery,
  DiffQueryVariables,
  HomeQuery,
  ScreenerQuery,
} from "@/graphql/types.generated";
import { graphqlBaseQuery } from "./graphqlBaseQuery";

/**
 * Every server read goes through here. Each endpoint pairs an operation from
 * src/graphql/operations.ts with its codegen'd result and variable types, so
 * a schema change that breaks a component fails `tsc`, not the browser.
 * Dragging the as-of scrubber issues one `company` query per stop; RTK Query
 * caches each (ticker, period, asOf) so scrubbing back is instant.
 */
export const api = createApi({
  reducerPath: "api",
  baseQuery: graphqlBaseQuery({ url: "/api/graphql" }),
  // The snapshot changes only on redeploy; keep results for the session.
  keepUnusedDataFor: 600,
  endpoints: (build) => ({
    home: build.query<HomeQuery, void>({
      query: () => ({ document: HOME }),
    }),
    companyList: build.query<CompanyListQuery, void>({
      query: () => ({ document: COMPANY_LIST }),
    }),
    company: build.query<CompanyQuery, CompanyQueryVariables>({
      query: (variables) => ({ document: COMPANY, variables }),
    }),
    diff: build.query<DiffQuery, DiffQueryVariables>({
      query: (variables) => ({ document: DIFF, variables }),
    }),
    screener: build.query<ScreenerQuery, void>({
      query: () => ({ document: SCREENER }),
    }),
  }),
});

export const { useHomeQuery, useCompanyListQuery, useCompanyQuery, useDiffQuery, useScreenerQuery } = api;
