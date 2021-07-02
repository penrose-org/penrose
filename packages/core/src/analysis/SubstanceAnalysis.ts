import { prettyStmt } from "compiler/Substance";
import { Map } from "immutable";
import {
  cloneDeep,
  cloneDeepWith,
  intersectionWith,
  isEqual,
  isEqualWith,
  omit,
  pullAt,
  sortBy,
} from "lodash";
import { SwapExprArgs, SwapStmtArgs } from "synthesis/Mutation";
import { ASTNode, Identifier, metaProps } from "types/ast";
import {
  ConstructorDecl,
  DomainStmt,
  Env,
  FunctionDecl,
  PredicateDecl,
  TypeDecl,
} from "types/domain";
import {
  ApplyConstructor,
  ApplyFunction,
  ApplyPredicate,
  AutoLabel,
  Bind,
  Decl,
  Func,
  SubExpr,
  SubPredArg,
  SubProg,
  SubStmt,
  TypeConsApp,
} from "types/substance";
import { exprToNumber } from "utils/OtherUtils";

export interface Signature {
  args: string[];
  output?: string;
}

export type ArgStmtDecl = PredicateDecl | FunctionDecl | ConstructorDecl;

export type ArgStmt = ApplyFunction | ApplyPredicate | ApplyConstructor;

export type ArgExpr = ApplyFunction | ApplyConstructor | Func;

/**
 * Append a statement to a Substance program
 *
 * @param prog a Substance program
 * @param stmt a statement to append
 * @returns a new Substance program
 */
export const appendStmt = (prog: SubProg, stmt: SubStmt): SubProg => ({
  ...prog,
  statements: [...prog.statements, stmt],
});

/**
 * Find all declarations that take the same number and type of args as
 * original statement
 * @param stmt a Substance statement
 * @param env Env of the program
 * @returns a new Substance statement
 */
export const argMatches = (
  stmt: ApplyConstructor | ApplyPredicate | ApplyFunction | Func | Bind,
  env: Env
): ArgStmtDecl[] => {
  const options = (s: any) => {
    const [st] = findDecl(s.name.value, env);
    return st
      ? [
          matchDecls(st, env.constructors, signatureArgsEqual),
          matchDecls(st, env.predicates, signatureArgsEqual),
          matchDecls(st, env.functions, signatureArgsEqual),
        ].flat()
      : [];
  };
  return stmt.tag === "Bind" ? options(stmt.expr) : options(stmt);
};

/**
 * Remove a statement from a Substance program.
 * NOTE: When the statement doesn't exist in the program, `removeStmt` returns the original program without errors.
 *
 * @param prog a Substance program
 * @param stmt a statement to delete
 * @returns a new Substance program with the statement removed
 */
export const removeStmt = (prog: SubProg, stmt: SubStmt): SubProg => {
  const index = prog.statements.indexOf(stmt);
  if (index > -1) {
    return {
      ...prog,
      statements: pullAt(prog.statements, index),
    };
  } else {
    return prog;
  }
};

/**
 * Replace a statement in a Substance program.
 * NOTE: When the statement to replace doesn't exist in the program, `replaceStmt` returns the original program without errors.
 *
 * @param prog a Substance program
 * @param originalStmt a statement to remove
 * @param newStmt a statement to add in place of the removed statement
 * @returns a new Substance program with the statement replaced
 */
export const replaceStmt = (
  prog: SubProg,
  originalStmt: SubStmt,
  newStmt: SubStmt
): SubProg => ({
  ...prog,
  statements: prog.statements.map((s) => (s === originalStmt ? newStmt : s)),
});

/**
 * Get a Substance statement by index
 *
 * @param prog a Substance program
 * @param index the index of a Substance statement in the program
 * @returns
 */
export const getStmt = (prog: SubProg, index: number): SubStmt =>
  prog.statements[index];

//#region Helpers
/**
 * Find all signatures that match a reference statement. NOTE: returns an empty list if
 * no matches are found; does not include the reference statement in list of matches.
 *
 * @param stmtName string value of a statement, i.e. "isSubset"
 * @param opts all possible declaration options
 * @param matchFunc function that determines condition for a match
 * @returns Array of any statements that have the same signature as input statement
 */
export const matchDecls = (
  stmt: ArgStmtDecl,
  opts: Map<string, ArgStmtDecl>,
  matchFunc: (a: Signature, b: Signature) => boolean
): ArgStmtDecl[] => {
  //generate signature for the original statement
  const origSignature = getSignature(stmt);
  const decls: ArgStmtDecl[] = [...opts.values()];
  return decls.filter((d) => {
    // does not add original statement to list of matches
    return stmt !== d && matchFunc(origSignature, getSignature(d));
  });
};

/**
 * Find a given statement's declaration from Domain.
 * NOTE: match will be undefined if the statement could not
 * be found in list of predicates, functions, or constructors
 *
 * @param stmtName string value of a statement, i.e. "isSubset"
 * @param env Env for current program
 * @returns Array of length 2, with entries corresponding to: [matching decl, list where decl was found]
 */
export const findDecl = (
  stmtName: string,
  env: Env
): [ArgStmtDecl | undefined, Map<string, ArgStmtDecl>] => {
  let match: ArgStmtDecl | undefined;
  match = env.predicates.get(stmtName);
  if (match !== undefined) return [match, env.predicates];
  match = env.functions.get(stmtName);
  if (match !== undefined) return [match, env.functions];
  match = env.constructors.get(stmtName);
  return [match, env.constructors];
};

/**
 * Find matching signatures for a given statement
 *
 * @param stmt any supported Statement object (constructor, predicate, function)
 * @param env an Env object with domain/substance metadata
 * @param editType the type of edit mutation occurring
 * @returns an Array of all other statements that match the stmt signature
 */
export const matchSignatures = (
  stmt: ApplyConstructor | ApplyPredicate | ApplyFunction | Func,
  env: Env
): ArgStmtDecl[] => {
  const [st, opts] = findDecl(stmt.name.value, env);
  if (st) {
    return matchDecls(st, opts, signatureEquals);
  }
  return [];
};

/**
 * Get signature of a declaration
 *
 * @param decl a Declaration object
 * @returns a new Signature object
 */
export const getSignature = (decl: ArgStmtDecl): Signature => {
  const argTypes: string[] = [];
  let outType: string | undefined;
  if (decl.args) {
    decl.args.forEach((a) => {
      if (a.type.tag === "TypeConstructor") argTypes.push(a.type.name.value);
    });
  }
  // see if there is an output field:
  const d = decl as ConstructorDecl;
  if (d.output && d.output.type.tag === "TypeConstructor") {
    outType = d.output.type.name.value;
  }
  return {
    args: argTypes,
    output: outType,
  };
};

/**
 * Check if 2 signatures are equal
 *
 * @param a a Signature
 * @param b a Signature
 * @returns true if signatures are equal
 */
export const signatureEquals = (a: Signature, b: Signature): boolean => {
  return a.output === b.output && signatureArgsEqual(a, b);
};

/**
 * Check if the types of 2 signatures' arguments are equal
 *
 * @param a a Signature
 * @param b a Signature
 * @returns true if signatures take the same number and type of args
 */
export const signatureArgsEqual = (a: Signature, b: Signature): boolean => {
  return (
    a.args.length === b.args.length &&
    a.args.every((val, index) => val === b.args[index])
  );
};

export const printStmts = (
  stmts: PredicateDecl[] | ConstructorDecl[] | FunctionDecl[]
): void => {
  let outStr = "";
  const s = stmts as PredicateDecl[];
  s.forEach((stmt) => {
    outStr += stmt.name.value + " ";
  });
  console.log(`[${outStr}]`);
};

export const domainToSubType = (
  domainType: DomainStmt["tag"]
):
  | Decl["tag"]
  | ApplyPredicate["tag"]
  | ApplyFunction["tag"]
  | ApplyConstructor["tag"]
  | Func["tag"]
  | undefined => {
  switch (domainType) {
    case "ConstructorDecl":
      return "Func";
    case "FunctionDecl":
      return "Func";
    case "PredicateDecl":
      return "ApplyPredicate";
    case "TypeDecl":
      return "Decl";
  }
};

export const applyConstructor = (
  decl: ConstructorDecl,
  args: SubExpr[]
): ApplyConstructor => {
  const { name } = decl;
  return {
    tag: "ApplyConstructor",
    name,
    nodeType: "SyntheticSubstance",
    children: [],
    args,
  };
};

export const applyFunction = (
  decl: FunctionDecl,
  args: SubExpr[]
): ApplyFunction => {
  const { name } = decl;
  return {
    tag: "ApplyFunction",
    name,
    nodeType: "SyntheticSubstance",
    children: [],
    args,
  };
};

export const applyPredicate = (
  decl: PredicateDecl,
  args: SubPredArg[]
): ApplyPredicate => {
  const { name } = decl;
  return {
    tag: "ApplyPredicate",
    name,
    nodeType: "SyntheticSubstance",
    children: [],
    args,
  };
};

export const subProg = (statements: SubStmt[]): SubProg => ({
  tag: "SubProg",
  statements,
  children: statements,
  nodeType: "SyntheticSubstance",
});

// TODO: generate arguments as well
export const applyTypeDecl = (decl: TypeDecl): TypeConsApp => {
  const { name } = decl;
  return nullaryTypeCons(name);
};

export const applyBind = (variable: Identifier, expr: SubExpr): Bind => ({
  tag: "Bind",
  children: [],
  nodeType: "SyntheticSubstance",
  variable,
  expr,
});

export const nullaryTypeCons = (name: Identifier): TypeConsApp => ({
  tag: "TypeConstructor",
  name,
  args: [],
});

export const autoLabelStmt: AutoLabel = {
  tag: "AutoLabel",
  option: {
    tag: "DefaultLabels",
    nodeType: "SyntheticSubstance",
    children: [],
  },
  nodeType: "SyntheticSubstance",
  children: [],
};

/**
 * Compare two AST nodes by their contents, ignoring structural properties such as `children` and positional properties like `start` and `end`.
 *
 * @param node1 the first AST node
 * @param node2 the second AST node
 * @returns a boolean value
 */
export const nodesEqual = (node1: ASTNode, node2: ASTNode): boolean =>
  isEqualWith(node1, node2, (node1: ASTNode, node2: ASTNode) => {
    return isEqual(cleanNode(node1), cleanNode(node2));
  });

export const intersection = (left: SubProg, right: SubProg): SubStmt[] =>
  intersectionWith(left.statements, right.statements, (s1, s2) =>
    nodesEqual(s1, s2)
  );

/**
 * Sort the statements in a Substance AST by statement type and then by lexicographic ordering of source text.
 * @param prog A Substance AST
 * @returns A sorted Substance AST
 */
export const sortStmts = (prog: SubProg): SubProg => {
  const { statements } = prog;
  // first sort by statement type, and then by lexicographic ordering of source text
  const newStmts: SubStmt[] = sortBy(statements, [
    "tag",
    (s: SubStmt) => prettyStmt(s),
  ]);
  return {
    ...prog,
    statements: newStmts,
  };
};

export const cleanNode = (prog: ASTNode): ASTNode => omitDeep(prog, metaProps);

/**
 * Finds the type of a Substance identifer.
 *
 * @param id an identifer
 * @param env the environment
 * @returns
 */
export const typeOf = (id: string, env: Env): string | undefined =>
  env.vars.get(id)?.name.value;

// helper function for omitting properties in an object
const omitDeep = (originalCollection: any, excludeKeys: string[]): any => {
  // TODO: `omitFn` mutates the collection
  const collection = cloneDeep(originalCollection);
  const omitFn = (value: any) => {
    if (value && typeof value === "object") {
      excludeKeys.forEach((key) => {
        delete value[key];
      });
    }
  };
  return cloneDeepWith(collection, omitFn);
};

//#endregion
