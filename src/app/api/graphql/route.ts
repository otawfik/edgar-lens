import { createGraphQLServer } from "@/server/graphql/yoga";

const yoga = createGraphQLServer();

// The snapshot is read from disk on first request, so this needs Node.
export const runtime = "nodejs";

export async function GET(request: Request) {
  return yoga.handleRequest(request, {});
}

export async function POST(request: Request) {
  return yoga.handleRequest(request, {});
}

export async function OPTIONS(request: Request) {
  return yoga.handleRequest(request, {});
}
