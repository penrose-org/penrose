//#region Types for reverse-mode autodiff

import { MaybeVal } from "./common";
import { LbfgsParams } from "./state";

// ----- Core types

//      s ("single output" node)
//     ...
//     PARENT node (z) -- has refs to its parents
//      ^
//      | sensitivity (dz/dv)
//      |
//     var (v)         -- has refs to its parents
// (carries gradVal: ds/dv)

// (var and node are used interchangeably)

export interface IEdgeAD {
    node: VarAD;

    // Function "flowing down" from parent z (output, which is the node stored here) to child v (input), dz/dv
    // Aka how sensitive the output is to this input -- a function encoded as a computational graph fragment
    sensitivityNode: MaybeVal<VarAD>;
}

export type EdgeAD = IEdgeAD;

export interface IVarAD {
    val: number; // The value of this node at the time the computational graph was created. This is mostly unused, since most values are compiled out except for leaf nodes

    valDone: boolean; // formerly used to cache energy values in the computational graph in evalEnergyOnGraph; TODO: can be removed if evalEnergyOnGraph is removed

    tag: "custom";
    metadata: string; // Used for storing the kind of weight
    op: string;
    isCompNode: boolean; // comp node (normal computational graph) or grad node (node in computational graph for gradient)
    isInput: boolean; // These inputs need to be distinguished as bindings in the function (e.g. \x y -> x + y)
    parents: EdgeAD[]; // The resulting values from an expression. e.g. in `z := x + y`, `z` is a parent of `x` and of `y`
    children: EdgeAD[];
    parentsGrad: EdgeAD[]; // The resulting values from an expression. e.g. in `z := x + y`, `z` is a parent of `x` and of `y`
    childrenGrad: EdgeAD[];
    gradVal: MaybeVal<number>;
    gradNode: MaybeVal<VarAD>;
    index: number; // -1 if not a leaf node, 0-n for leaf nodes (order in the leaf node list) so we know how to pass in the floats

    debug: boolean; // If true, this prints node debug info on evaluation
    debugInfo: string;

    nodeVisited: boolean;
    // Now used to track whether this node (and its children) has already been computed in the codegen
    name: string; // Name of cached value for this node in codegen (e.g. `const x3 = x1 + x2;` <-- name of node is `x3`)
}

export type VarAD = IVarAD;
//#endregion

//#region Types for generalizing our system autodiff

export type VecAD = VarAD[];

export type Pt2 = [VarAD, VarAD];

export type GradGraphs = IGradGraphs;

export interface IGradGraphs {
    inputs: VarAD[];
    energyOutput: VarAD;
    // The energy inputs may be different from the grad inputs bc the former may contain the EP weight (but for the latter, we do not want the derivative WRT the EP weight)
    gradOutputs: VarAD[];
    weight: MaybeVal<VarAD>; // EP weight, a hyperparameter to both energy and gradient; TODO: generalize to multiple hyperparameters
}

export type OptInfo = IOptInfo;
// Returned after a call to `minimize`

export interface IOptInfo {
    xs: number[];
    energyVal: number;
    normGrad: number;
    newLbfgsInfo: LbfgsParams;
    gradient: number[];
    gradientPreconditioned: number[];
    time: number; // time in floating-point milliseconds for one call to `minimize`, measured by performance.now()
}

export type OptDebugInfo = IOptDebugInfo;

export type NumMap = Map<string, number>;

export interface IOptDebugInfo {
    gradient: NumMap;
    gradientPreconditioned: NumMap;
}

//#endregion
