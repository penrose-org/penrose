import domainGrammar from "parser/DomainParser";
import { alg, Graph } from "graphlib";
import { Map } from "immutable";
import { keyBy } from "lodash";
import nearley from "nearley";
import { idOf } from "parser/ParserUtil";
import {
  all,
  and,
  andThen,
  cyclicSubtypes,
  duplicateName,
  err,
  notTypeConsInPrelude,
  notTypeConsInSubtype,
  ok,
  Result,
  safeChain,
  typeNotFound,
} from "utils/Error";

// TODO: wrap errors in PenroseError type
export const compileDomain = (prog: string): CheckerResult => {
  const parser = new nearley.Parser(
    nearley.Grammar.fromCompiled(domainGrammar)
  );
  const { results } = parser.feed(prog);
  return checkDomain(results[0]);
};

export type CheckerResult = Result<Env, DomainError>;

//#region Domain context
export interface Env {
  types: Map<string, TypeDecl>;
  constructors: Map<string, ConstructorDecl>;
  functions: Map<string, FunctionDecl>;
  vars: Map<string, TypeConsApp>; // TODO: use Identifier as key?
  predicates: Map<string, PredicateDecl>;
  typeVars: Map<string, TypeVar>;
  preludeValues: Map<string, TypeConstructor>; // TODO: store as Substance values?
  subTypes: [TypeConstructor, TypeConstructor][];
  typeGraph: Graph;
}
//#endregion

/* Built in types for all Domain programs */
const builtinTypes: [string, TypeDecl][] = [
  [
    "String",
    {
      start: { line: 1, col: 1 },
      end: { line: 1, col: 1 },
      tag: "TypeDecl",
      name: idOf("String"),
      params: [],
    },
  ],
];
const initEnv = (): Env => ({
  types: Map(builtinTypes),
  typeVars: Map(),
  vars: Map(),
  constructors: Map(),
  predicates: Map(),
  functions: Map(),
  preludeValues: Map(),
  subTypes: [],
  typeGraph: new Graph(),
});

/**
 * Top-level function for the Domain semantic checker. Given a Domain AST, it outputs either a `DomainError` or a `DomainEnv` context.
 * @param prog compiled AST of a Domain program
 */
export const checkDomain = (prog: DomainProg): CheckerResult => {
  const { statements } = prog;
  // load built-in types
  const env: Env = initEnv();
  // check all statements
  const stmtsOk: CheckerResult = safeChain(statements, checkStmt, ok(env));
  // compute subtyping graph
  return andThen(computeTypeGraph, stmtsOk);
};

const checkStmt = (stmt: DomainStmt, env: Env): CheckerResult => {
  switch (stmt.tag) {
    case "TypeDecl": {
      // NOTE: params are not reused, so no need to check
      const { name, params } = stmt;
      // check name duplicate
      if (env.types.has(name.value))
        return err(duplicateName(name, stmt, env.types.get(name.value)!));
      // insert type into env
      return ok({ ...env, types: env.types.set(name.value, stmt) });
    }
    case "ConstructorDecl": {
      const { name, params, args, output } = stmt;
      // load params into context
      const localEnv: Env = {
        ...env,
        typeVars: Map(keyBy(params, "name.value")),
      };
      // check name duplicate
      if (env.constructors.has(name.value))
        return err(
          duplicateName(name, stmt, env.constructors.get(name.value)!)
        );
      // check arguments
      const argsOk = safeChain(args, checkArg, ok(localEnv));
      // check output
      const outputOk = checkArg(output, localEnv);
      // insert constructor into env
      const updatedEnv: CheckerResult = ok({
        ...env,
        constructors: env.constructors.set(name.value, stmt),
      });
      return all(argsOk, outputOk, updatedEnv);
    }
    case "FunctionDecl": {
      const { name, params, args, output } = stmt;
      // load params into context
      const localEnv: Env = {
        ...env,
        typeVars: Map(keyBy(params, "name.value")),
      };
      // check name duplicate
      if (env.functions.has(name.value))
        return err(duplicateName(name, stmt, env.functions.get(name.value)!));
      // check arguments
      const argsOk = safeChain(args, checkArg, ok(localEnv));
      // check output
      const outputOk = checkArg(output, localEnv);
      // insert function into env
      const updatedEnv: CheckerResult = ok({
        ...env,
        functions: env.functions.set(name.value, stmt),
      });
      return all(argsOk, outputOk, updatedEnv);
    }
    case "PredicateDecl": {
      const { name, params, args } = stmt;
      // load params into context
      const localEnv: Env = {
        ...env,
        typeVars: Map(keyBy(params, "name.value")),
      };
      // check name duplicate
      if (env.predicates.has(name.value))
        return err(duplicateName(name, stmt, env.predicates.get(name.value)!));
      // check arguments
      const argsOk = safeChain(args, checkArg, ok(localEnv));
      // insert predicate into env
      const updatedEnv: CheckerResult = ok({
        ...env,
        predicates: env.predicates.set(name.value, stmt),
      });
      return all(argsOk, updatedEnv);
    }
    case "NotationDecl": {
      // TODO: just passing through the notation rules here. Need to parse them into transformers
      return ok(env);
    }
    case "PreludeDecl": {
      const { name, type } = stmt;
      const typeOk = checkType(type, env);
      // make sure only type cons are involved in the prelude decl
      if (type.tag !== "TypeConstructor")
        return err(notTypeConsInPrelude(type));
      const updatedEnv: CheckerResult = ok({
        ...env,
        preludeValues: env.preludeValues.set(name.value, type),
      });
      return all(typeOk, updatedEnv);
    }
    case "SubTypeDecl": {
      const { subType, superType } = stmt;
      // make sure only type cons are involved in the subtyping relation
      if (subType.tag !== "TypeConstructor")
        return err(notTypeConsInSubtype(subType));
      if (superType.tag !== "TypeConstructor")
        return err(notTypeConsInSubtype(superType));
      const subOk = checkType(subType, env);
      const superOk = checkType(superType, env);
      const updatedEnv: CheckerResult = ok({
        ...env,
        subTypes: [...env.subTypes, [subType, superType]],
      });
      return all(subOk, superOk, updatedEnv);
    }
  }
};

/**
 * Check if a type exists in the domain context. Used across Domain, Substance, and Style.
 * @param type type constructor, type variable, or prop to be checked.
 * @param env  the Domain environment
 */
export const checkType = (
  type: Type,
  env: Env
): Result<Env, TypeNotFound | TypeVarNotFound> => {
  switch (type.tag) {
    case "TypeVar": {
      return env.typeVars.has(type.name.value)
        ? ok(env)
        : err({ tag: "TypeVarNotFound", typeVar: type });
    }
    case "Prop":
      return ok(env); // NOTE: no need to check
    case "TypeConstructor":
      return checkTypeConstructor(type, env);
  }
};

/**
 * Check if a type constructor exists in the domain context. Used across Domain, Substance, and Style.
 * @param type type constructor to be checked.
 * @param env  the Domain environment
 */
export const checkTypeConstructor = (
  type: TypeConstructor,
  env: Env
): Result<Env, TypeNotFound | TypeVarNotFound> => {
  const { name, args } = type;
  // check if name exists
  if (!env.types.has(name.value)) {
    const [...suggestions] = env.types.values();
    return err(
      typeNotFound(
        name,
        suggestions.map((t: TypeDecl) => t.name)
      )
    );
  }
  const argsOk = safeChain(args, checkType, ok(env));
  return and(ok(env), argsOk);
};

const checkArg = (arg: Arg, env: Env): CheckerResult =>
  checkType(arg.type, env);

const computeTypeGraph = (env: Env): CheckerResult => {
  const { subTypes, types, typeGraph } = env;
  const [...typeNames] = types.keys();
  typeNames.map((t: string) => typeGraph.setNode(t, t));
  // NOTE: since we search for super types upstream, subtyping arrow points to supertype
  subTypes.map(([subType, superType]: [TypeConstructor, TypeConstructor]) =>
    typeGraph.setEdge(subType.name.value, superType.name.value)
  );
  if (!alg.isAcyclic(typeGraph))
    return err(cyclicSubtypes(alg.findCycles(typeGraph)));
  return ok(env);
};

/**
 * Utility for comparing types. `isSubtypeOf` returns true if `subType` is a subtype of `superType`, or if both are actually the same type.
 * @param subType
 * @param superType
 * @param env
 */
export const isSubtypeOf = (
  subType: TypeConstructor,
  superType: TypeConstructor,
  env: Env
): boolean => {
  const superTypes = alg.dijkstra(env.typeGraph, subType.name.value);
  const superNode = superTypes[superType.name.value];
  // HACK: add in top type as an escape hatch for unbounded types
  if (superType.name.value === topType.name.value) return true;
  if (superNode) return superNode.distance < Number.POSITIVE_INFINITY;
  // TODO: include this case in our error system
  else {
    console.error(`${subType.name.value} not found in the subtype graph.`);
    return false;
  }
};

export const topType: TypeConsApp = {
  tag: "TypeConstructor",
  name: idOf("type"),
  args: [],
};
