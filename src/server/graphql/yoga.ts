import { createSchema, createYoga } from "graphql-yoga";
import { getDataset, type Dataset } from "../dataset";
import type { GraphQLContext } from "./context";
import { useQueryLimits } from "./limits";
import { resolvers } from "./resolvers";
import { typeDefs } from "./typeDefs";

export const schema = createSchema<GraphQLContext>({ typeDefs, resolvers });

/**
 * One Yoga instance per server process. The dataset is injected so tests can
 * run the full HTTP pipeline (parsing, validation, limits, masking) against a
 * fixture without a Next.js server.
 */
export function createGraphQLServer(dataset: () => Dataset = getDataset) {
  return createYoga<object, GraphQLContext>({
    schema,
    graphqlEndpoint: "/api/graphql",
    fetchAPI: { Response },
    context: () => ({ dataset: dataset() }),
    plugins: [useQueryLimits()],
    // Unexpected errors are masked; GraphQLErrors we throw (bad input,
    // limits) pass through with their extension codes.
    maskedErrors: true,
    // Per-request info logs in development only; warnings and errors always.
    logging: process.env.NODE_ENV === "development" ? "info" : "warn",
    graphiql: { title: "EDGAR Lens GraphQL" },
  });
}
