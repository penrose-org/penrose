import { pullAt, range } from "lodash";
import { Identifier } from "types/ast";
import { Map } from "immutable";
import { choice } from "pandemonium";
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

export interface Signature {
  args: string[];
  output?: string;
}

export type ArgStmtDecl = PredicateDecl | FunctionDecl | ConstructorDecl;

type EditType = "typeChange" | "replaceStmtName";

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
 * Swap two arguments of a Substance statement
 *
 * @param stmt a Substance statement with the `args` property
 * @param param1 a tuple of indices to swap
 * @returns a new Substance statement
 */
export const swapArgs = (
  stmt: ApplyConstructor | ApplyPredicate | ApplyFunction,
  [index1, index2]: [number, number]
): ApplyConstructor | ApplyPredicate | ApplyFunction => {
  return {
    ...stmt,
    args: swap(stmt.args, index1, index2),
  };
};

/**
 * Replace a Substance statement with another substance statement with the same signature.
 * NOTE: When no suitable replacement exists, returns original program without errors.
 * @param stmt a Substance statement
 * @param env Env of the program
 * @returns a new Substance statement
 */
export const replaceStmtName = (
  stmt: ApplyConstructor | ApplyPredicate | ApplyFunction | Func,
  env: Env
): ApplyConstructor | ApplyPredicate | ApplyFunction | Func => {
  const options = matchSignatures(stmt, env, "replaceStmtName");
  const pick = options.length > 0 ? choice(options) : stmt;
  return {
    ...stmt,
    name: pick.name,
  };
};

/**
 * Replace a Substance statement with another statement that takes the same arguments.
 * NOTE: When no suitable replacement exists, returns original program without errors.
 * @param stmt a Substance statement
 * @param env Env of the program
 * @param ids array containing the names of each Identifier in program
 * @returns a new Substance statement
 */
export const changeType = (
  stmt: ApplyConstructor | ApplyPredicate | ApplyFunction | Func | Bind,
  env: Env,
  ids: string[]
): ApplyConstructor | ApplyPredicate | ApplyFunction | Func | Bind => {
  //find matches for all 3 types
  const options = (s: any) => {
    const [st] = findStmt(s.name.value, env);
    return st
      ? [
          findMatches(st, env.constructors, "typeChange"),
          findMatches(st, env.predicates, "typeChange"),
          findMatches(st, env.functions, "typeChange"),
        ].flat()
      : [];
  };
  const opts = stmt.tag === "Bind" ? options(stmt.expr) : options(stmt);
  if (opts.length > 0) {
    // pick random option
    const pick = choice(opts);
    const s = stmt.tag === "Bind" ? stmt.expr : stmt;
    if (pick.tag === "PredicateDecl") {
      return applyPredicate(pick, (s as ApplyPredicate).args);
    } else {
      const castArgs = (s as ApplyConstructor).args;
      const m =
        pick.tag === "ConstructorDecl"
          ? applyConstructor(pick, castArgs)
          : applyFunction(pick, castArgs);
      // make into a Bind if the pick returns something
      return pick.output.variable ? applyBind(pick.output.variable, m) : m;
    }
  }
  // return unchanged statement if no matches were found
  return stmt;
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

//#region helpers

const swap = (arr: any[], a: number, b: number) =>
  arr.map((current, idx) => {
    if (idx === a) return arr[b];
    if (idx === b) return arr[a];
    return current;
  });

//#endregion

//#region Helpers

/**
 * Find all signatures that match a reference statement. NOTE: returns an empty list if
 * no matches are found; does not include the reference statement in list of matches.
 *
 * @param stmtName string value of a statement, i.e. "isSubset"
 * @param opts all possible declaration options
 * @param editType type of edit mutation that calls findMatches
 * @returns Array of any statements that have the same signature as input statement
 */
export const findMatches = (
  stmt: ArgStmtDecl,
  opts: Map<string, ArgStmtDecl>,
  editType: EditType
): ArgStmtDecl[] => {
  //generate signature for the original statement
  const origSignature = getSignature(stmt);
  // does not add original statement to list of matches
  const decls: ArgStmtDecl[] = [...opts.values()];
  return decls.filter((d) => {
    if (stmt !== d) {
      if (editType === "typeChange") {
        return signatureArgsEqual(origSignature, getSignature(d));
      } else if (editType === "replaceStmtName") {
        return signatureEquals(origSignature, getSignature(d));
      }
    }
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
export const findStmt = (
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
 * Returns a new bind variable distinct from all other existing variables.
 *
 * @param ids string value of a statement, i.e. "isSubset"
 * @returns new Identifier with unique value
 */
export const newBindVar = (ids: string[]): Identifier => {
  const letters = [...range(97, 122, 1)]; // a-z in ASCII
  // find an unused variable
  let pick = ids[0];
  let attempts = 10;
  while (attempts > 0) {
    pick = String.fromCharCode(choice(letters));
    if (ids.find((id) => id === pick) === undefined) {
      break;
    }
    attempts--;
  }
  // create new Identifier for the variable
  return {
    tag: "Identifier",
    type: "value",
    value: pick,
    nodeType: "SyntheticSubstance",
    children: [],
  };
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
  env: Env,
  editType: EditType
): ArgStmtDecl[] => {
  const [st, opts] = findStmt(stmt.name.value, env);
  if (st) {
    return findMatches(st, opts, editType);
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

//#endregion
