/**
 * Query sanity limits. The schema is small, but it has a cycle (a company's
 * latest `changes` point back to the company) and nested lists (companies ×
 * line items × periods × vintages), so an unbounded query could fan out to
 * every figure many times over. Two guards:
 *
 * - depthLimit: a validation rule rejecting selections nested too deeply.
 * - estimateCost: a static cost estimate (each field 1, list fields multiplied
 *   by their `first`/`last`/`limit` argument or default, or by the length of a
 *   list argument such as `compare(tickers:)`), checked before execution with
 *   the request's real variables.
 *
 * Introspection fields (`__schema`, `__type`…) are exempt so GraphiQL works.
 */
import {
  GraphQLError,
  Kind,
  getNamedType,
  getNullableType,
  isListType,
  isObjectType,
  type ASTVisitor,
  type DocumentNode,
  type FieldNode,
  type GraphQLArgument,
  type FragmentDefinitionNode,
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLSchema,
  type OperationDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
  type ValueNode,
} from "graphql";

export const MAX_DEPTH = 8;
export const MAX_COST = 25_000;
const SIZE_ARGS = ["first", "last", "limit"];

type Fragments = Record<string, FragmentDefinitionNode>;

function fragmentsOf(doc: DocumentNode): Fragments {
  const out: Fragments = {};
  for (const def of doc.definitions) {
    if (def.kind === Kind.FRAGMENT_DEFINITION) out[def.name.value] = def;
  }
  return out;
}

function selectionDepth(set: SelectionSetNode | undefined, fragments: Fragments, seen: Set<string>): number {
  if (!set) return 0;
  let max = 0;
  for (const sel of set.selections) {
    if (sel.kind === Kind.FIELD) {
      if (sel.name.value.startsWith("__")) continue;
      max = Math.max(max, 1 + selectionDepth(sel.selectionSet, fragments, seen));
    } else if (sel.kind === Kind.INLINE_FRAGMENT) {
      max = Math.max(max, selectionDepth(sel.selectionSet, fragments, seen));
    } else {
      const name = sel.name.value;
      if (seen.has(name) || !fragments[name]) continue;
      seen.add(name);
      max = Math.max(max, selectionDepth(fragments[name].selectionSet, fragments, seen));
      seen.delete(name);
    }
  }
  return max;
}

/** Depth of each operation in a document (fields only; fragments are inlined). */
export function operationDepths(doc: DocumentNode): Record<string, number> {
  const fragments = fragmentsOf(doc);
  const out: Record<string, number> = {};
  for (const def of doc.definitions) {
    if (def.kind !== Kind.OPERATION_DEFINITION) continue;
    out[def.name?.value ?? "(anonymous)"] = selectionDepth(def.selectionSet, fragments, new Set());
  }
  return out;
}

export function depthLimit(max: number = MAX_DEPTH) {
  return (context: ValidationContext): ASTVisitor => ({
    Document(doc) {
      for (const [name, depth] of Object.entries(operationDepths(doc))) {
        if (depth > max) {
          context.reportError(
            new GraphQLError(
              `Operation "${name}" has depth ${depth}; the maximum is ${max}.`,
              { extensions: { code: "QUERY_TOO_DEEP" } },
            ),
          );
        }
      }
    },
  });
}

type Vars = Record<string, unknown> | null | undefined;

function numberArg(node: ValueNode | undefined, vars: Vars): number | null {
  if (!node) return null;
  if (node.kind === Kind.INT) return Number.parseInt(node.value, 10);
  if (node.kind === Kind.VARIABLE) {
    const v = vars?.[node.name.value];
    return typeof v === "number" ? v : null;
  }
  return null;
}

function listArgLength(node: ValueNode | undefined, vars: Vars): number | null {
  if (!node) return null;
  if (node.kind === Kind.LIST) return node.values.length;
  if (node.kind === Kind.VARIABLE) {
    const v = vars?.[node.name.value];
    return Array.isArray(v) ? v.length : null;
  }
  return null;
}

/** graphql 17 stores SDL defaults as literals, programmatic ones as values. */
function defaultNumber(arg: GraphQLArgument): number | null {
  const d = arg.default;
  if (!d) return null;
  if (d.literal) return d.literal.kind === Kind.INT ? Number.parseInt(d.literal.value, 10) : null;
  return typeof d.value === "number" ? d.value : null;
}

function multiplier(field: FieldNode, def: GraphQLField<unknown, unknown>, vars: Vars): number {
  if (!isListType(getNullableType(def.type))) return 1;
  for (const name of SIZE_ARGS) {
    const argDef = def.args.find((a) => a.name === name);
    if (!argDef) continue;
    const given = numberArg(field.arguments?.find((a) => a.name.value === name)?.value, vars);
    const n = given ?? defaultNumber(argDef);
    if (n !== null) return Math.max(1, n);
  }
  for (const arg of field.arguments ?? []) {
    const argDef = def.args.find((a) => a.name === arg.name.value);
    if (argDef && isListType(getNullableType(argDef.type))) {
      const len = listArgLength(arg.value, vars);
      if (len !== null) return Math.max(1, len);
    }
  }
  return 10;
}

function selectionCost(
  schema: GraphQLSchema,
  type: GraphQLNamedType,
  set: SelectionSetNode | undefined,
  fragments: Fragments,
  vars: Vars,
  seen: Set<string>,
): number {
  if (!set || !isObjectType(type)) return 0;
  let total = 0;
  for (const sel of set.selections) {
    if (sel.kind === Kind.FIELD) {
      if (sel.name.value.startsWith("__")) continue;
      const def = type.getFields()[sel.name.value];
      if (!def) continue;
      const child = selectionCost(schema, getNamedType(def.type), sel.selectionSet, fragments, vars, seen);
      total += 1 + multiplier(sel, def, vars) * child;
    } else if (sel.kind === Kind.INLINE_FRAGMENT) {
      const t = sel.typeCondition ? schema.getType(sel.typeCondition.name.value) : type;
      if (t) total += selectionCost(schema, t, sel.selectionSet, fragments, vars, seen);
    } else {
      const frag = fragments[sel.name.value];
      if (!frag || seen.has(frag.name.value)) continue;
      const t = schema.getType(frag.typeCondition.name.value);
      seen.add(frag.name.value);
      if (t) total += selectionCost(schema, t, frag.selectionSet, fragments, vars, seen);
      seen.delete(frag.name.value);
    }
  }
  return total;
}

export function estimateCost(
  schema: GraphQLSchema,
  doc: DocumentNode,
  variables?: Vars,
  operationName?: string | null,
): number {
  const fragments = fragmentsOf(doc);
  const ops = doc.definitions.filter(
    (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION,
  );
  const op = operationName ? ops.find((o) => o.name?.value === operationName) : ops[0];
  if (!op) return 0;
  const root =
    op.operation === "query" ? schema.getQueryType() :
    op.operation === "mutation" ? schema.getMutationType() : schema.getSubscriptionType();
  if (!root) return 0;
  return selectionCost(schema, root, op.selectionSet, fragments, variables, new Set());
}

/** Envelop/Yoga plugin wiring both limits in. */
export function queryLimitsPlugin(opts: { maxDepth?: number; maxCost?: number } = {}) {
  const maxCost = opts.maxCost ?? MAX_COST;
  return {
    onValidate({ addValidationRule }: { addValidationRule: (rule: unknown) => void }) {
      addValidationRule(depthLimit(opts.maxDepth ?? MAX_DEPTH));
    },
    onExecute({
      args,
      setResultAndStopExecution,
    }: {
      args: {
        schema: GraphQLSchema;
        document: DocumentNode;
        variableValues?: Vars;
        operationName?: string | null;
      };
      setResultAndStopExecution: (r: { errors: GraphQLError[] }) => void;
    }) {
      const cost = estimateCost(args.schema, args.document, args.variableValues, args.operationName);
      if (cost > maxCost) {
        setResultAndStopExecution({
          errors: [
            new GraphQLError(`Query cost ${cost} exceeds the limit of ${maxCost}.`, {
              extensions: { code: "QUERY_TOO_COSTLY", cost, maxCost },
            }),
          ],
        });
      }
    },
  };
}
