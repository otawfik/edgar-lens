import type { CodegenConfig } from "@graphql-codegen/cli";

/**
 * One schema (src/server/graphql/typeDefs.ts), two outputs:
 * - resolver signatures for the server, with domain objects as parents;
 * - result/variable types for every operation the client sends.
 * CI runs `npm run codegen` and fails if the output is stale.
 */
const config: CodegenConfig = {
  schema: "src/server/graphql/typeDefs.ts",
  documents: ["src/graphql/operations.ts"],
  generates: {
    "src/server/graphql/resolvers-types.generated.ts": {
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        contextType: "./context#GraphQLContext",
        mappers: {
          Company: "@/lib/finance/derive#CompanyFinancials",
          FilingChange: "@/server/dataset#FilingChange",
          RevisionStats: "@/lib/edgar/snapshot#RevisionStats",
        },
        mapperTypeSuffix: "Model",
        enumsAsTypes: true,
        useTypeImports: true,
        maybeValue: "T | null | undefined",
      },
    },
    "src/graphql/types.generated.ts": {
      plugins: ["typescript-operations"],
      config: {
        enumsAsTypes: true,
        skipTypename: true,
        useTypeImports: true,
        avoidOptionals: { field: true, inputValue: false, object: true },
      },
    },
  },
};

export default config;
