import { ArgExpr, replaceStmt } from "analysis/SubstanceAnalysis";
import { prettyStmt, prettySubNode } from "compiler/Substance";
import { dummyIdentifier } from "engine/EngineUtils";
import {
  ApplyPredicate,
  Bind,
  SubExpr,
  SubProg,
  SubStmt,
} from "types/substance";

//#region Mutation types

export type Mutation = Add | Delete | Update;
export type MutationType = Mutation["tag"];

export interface IMutation {
  tag: MutationType;
  mutate: (op: this, prog: SubProg) => SubProg;
}

export type Update =
  | SwapExprArgs
  | SwapStmtArgs
  | ReplaceStmtName
  | ReplaceExprName
  | ChangeStmtType
  | ChangeExprType
  | Replace;
// | TypeChange;

export interface Add extends IMutation {
  tag: "Add";
  stmt: SubStmt;
}
export interface Delete extends IMutation {
  tag: "Delete";
  stmt: SubStmt;
}

export interface Replace extends IMutation {
  tag: "Replace";
  stmt: SubStmt;
  newStmt: SubStmt;
  mutationType: string;
}

export interface SwapStmtArgs extends IMutation {
  tag: "SwapStmtArgs";
  stmt: ApplyPredicate;
  elem1: number;
  elem2: number;
}

export interface SwapExprArgs extends IMutation {
  tag: "SwapExprArgs";
  stmt: Bind;
  expr: ArgExpr;
  elem1: number;
  elem2: number;
}

export interface ReplaceStmtName extends IMutation {
  tag: "ReplaceStmtName";
  stmt: ApplyPredicate;
  newName: string;
}

export interface ReplaceExprName extends IMutation {
  tag: "ReplaceExprName";
  stmt: Bind;
  expr: ArgExpr;
  newName: string;
}
export interface ChangeStmtType extends IMutation {
  tag: "ChangeStmtType";
  stmt: ApplyPredicate;
  newExpr: ArgExpr;
}

export interface ChangeExprType extends IMutation {
  tag: "ChangeExprType";
  stmt: Bind;
  expr: ArgExpr;
  newExpr: ArgExpr;
}

export const showOps = (ops: Mutation[]): string => {
  return ops.map((op) => showOp(op)).join("\n");
};

export const showOp = (op: Mutation): string => {
  switch (op.tag) {
    // case "Replace":
    //   return `Replace ${prettyStmt(op.old)} by ${prettyStmt(op.new)}`;
    case "SwapStmtArgs":
      return `Swap arguments of ${prettyStmt(op.stmt)}`;
    case "SwapExprArgs":
      return `Swap arguments of ${prettySubNode(op.expr)} in ${prettyStmt(
        op.stmt
      )}`;
    default:
      return `${op.tag} ${prettySubNode(op.stmt)}`;
  }
};

//#endregion

//#region Mutation execution
export const executeMutation = (prog: SubProg, mutation: Mutation): SubProg =>
  mutation.mutate(mutation as any, prog); // TODO: typecheck this?

const swap = (arr: any[], a: number, b: number) =>
  arr.map((current, idx) => {
    if (idx === a) return arr[b];
    if (idx === b) return arr[a];
    return current;
  });

/**
 * Swap two arguments of a Substance statement
 *
 * @param param0 the swap mutation data
 * @param prog a Substance program
 * @returns a new Substance program
 */
export const swapStmtArgs = (
  { stmt, elem1, elem2 }: SwapStmtArgs,
  prog: SubProg
): SubProg => {
  const newStmt: SubStmt = {
    ...stmt,
    args: swap(stmt.args, elem1, elem2),
  };
  return replaceStmt(prog, stmt, newStmt);
};

/**
 * Swap two arguments of a Substance expression
 *
 * @param param0 the swap mutation data
 * @param prog a Substance program
 * @returns a new Substance program
 */
export const swapExprArgs = (
  { stmt, expr, elem1, elem2 }: SwapExprArgs,
  prog: SubProg
): SubProg => {
  const newStmt: SubStmt = {
    ...stmt,
    expr: {
      ...expr,
      args: swap(expr.args, elem1, elem2),
    } as SubExpr, // TODO: fix types to avoid casting
  };
  return replaceStmt(prog, stmt, newStmt);
};

//#endregion

//#region Mutation pre-flight checks

export const checkSwapStmtArgs = (
  stmt: SubStmt,
  elems: (p: ApplyPredicate) => [number, number]
): SwapStmtArgs | undefined => {
  if (stmt.tag === "ApplyPredicate") {
    const [elem1, elem2] = elems(stmt);
    return {
      tag: "SwapStmtArgs",
      stmt,
      elem1,
      elem2,
      mutate: swapStmtArgs,
    };
  } else return undefined;
};

export const checkSwapExprArgs = (
  stmt: SubStmt,
  elems: (p: ArgExpr) => [number, number]
): SwapExprArgs | undefined => {
  if (stmt.tag === "Bind") {
    const { expr } = stmt;
    if (
      expr.tag === "ApplyConstructor" ||
      expr.tag === "ApplyFunction" ||
      expr.tag === "Func"
    ) {
      const [elem1, elem2] = elems(expr);
      return {
        tag: "SwapExprArgs",
        stmt,
        expr,
        elem1,
        elem2,
        mutate: swapExprArgs,
      };
    } else return undefined;
  } else return undefined;
};

export const checkReplaceStmtName = (
  stmt: SubStmt,
  newName: (p: ApplyPredicate) => string
): ReplaceStmtName | undefined => {
  if (stmt.tag === "ApplyPredicate") {
    return {
      tag: "ReplaceStmtName",
      stmt,
      newName: newName(stmt),
      mutate: ({ stmt, newName }: ReplaceStmtName, prog) => {
        return replaceStmt(prog, stmt, {
          ...stmt,
          name: dummyIdentifier(newName, "SyntheticSubstance"),
        });
      },
    };
  } else return undefined;
};

export const checkReplaceExprName = (
  stmt: SubStmt,
  newName: (p: ArgExpr) => string
): ReplaceExprName | undefined => {
  if (stmt.tag === "Bind") {
    const { expr } = stmt;
    if (
      expr.tag === "ApplyConstructor" ||
      expr.tag === "ApplyFunction" ||
      expr.tag === "Func"
    ) {
      return {
        tag: "ReplaceExprName",
        stmt,
        expr,
        newName: newName(expr),
        mutate: ({ stmt, expr, newName }: ReplaceExprName, prog) => {
          return replaceStmt(prog, stmt, {
            ...stmt,
            expr: {
              ...expr,
              name: dummyIdentifier(newName, "SyntheticSubstance"),
            },
          });
        },
      };
    } else return undefined;
  } else return undefined;
};

// export const checkChangeStmtType = (stmt: SubStmt, )

//#endregion
