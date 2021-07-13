import {
  ShapeTypes,
  PenroseState,
  PenroseFn,
  prettyPrintFn,
  prettyPrintPath,
  prettyPrintExpr,
} from "@penrose/core";
import { FieldDict, Translation } from "@penrose/core/build/dist/types/value";
import { uniqBy } from "lodash";
import { Path } from "@penrose/core/build/dist/types/style";
import { Fn } from "@penrose/core/build/dist/types/state";
import { flatMap } from "lodash";
import { VarAD } from "../../../../core/build/dist/types/ad";

// TODO: The nodes and edges are left untyped for now because adding new keys to them (e.g. `DOF: true`) is used to style their CSS - not sure how to accommodate this as a TS type

export interface PGraph {
  // Graph for cytoscape (see `graph1` for example + schema)
  nodes: any;
  edges: any;
}

// Example graph schema: 2 nodes, 1 edge between them; `selectorName` can be styled, for example
const graph1 = [
  { data: { id: "a" } },
  { data: { id: "b" } },
  {
    data: {
      id: "ab",
      source: "a",
      target: "b",
      selectorName: true,
    },
  },
];

// Flatten a list of lists into a single list of elements
const merge = (arr: any) => [].concat(...arr);

const flatGraph = (es: PGraph[]): PGraph => {
  return {
    nodes: flatMap(es, (e) => e.nodes),
    edges: flatMap(es, (e) => e.edges),
  };
};

// ---------

// Given a parent node, returns the graph corresponding to nodes and edges of children
// May contain duplicate nodes
// TODO: Add type for graph and VarAD
const traverseGraphTopDown = (par: VarAD): PGraph => {
  const parNode = { id: par.id, label: par.op };
  const edges = par.children.map((edge) => ({
    from: parNode.id,
    to: edge.node.id,
  }));

  const subgraphs = par.children.map((edge) => traverseGraphTopDown(edge.node));
  const subnodes = merge(subgraphs.map((g) => g.nodes));
  const subedges = merge(subgraphs.map((g) => g.edges));

  return {
    nodes: [parNode].concat(subnodes),
    edges: edges.concat(subedges),
  };
};

// For building atomic op graph. Returns unique nodes after all nodes are merged
export const traverseUnique = (par: VarAD): PGraph => {
  const g = traverseGraphTopDown(par);
  return {
    ...g,
    nodes: uniqBy(g.nodes, (e: any) => e.id),
  };
};

// Convert from `traverseUnique` schema to cytoscape schema
export const convertSchema = (graph: PGraph): PGraph => {
  const { nodes, edges } = graph;

  const nodes2 = nodes.map((e) => ({
    data: {
      id: String(e.id), // this needs to be unique
      label: e.label,
    },
  }));

  const edges2 = edges.map((e) => ({
    data: {
      id: String(e.from) + " -> " + String(e.to), // NOTE: No duplicate edges
      source: String(e.from),
      target: String(e.to),
      // No label
    },
  }));

  return { nodes: nodes2, edges: edges2 };
};

// -----

// Make nodes and edges related to showing one DOF node (p is a varying path)
export const toGraphDOF = (p: Path, allArgs: string[]): PGraph => {
  const empty = { nodes: [], edges: [] };

  if (p.tag === "FieldPath") {
    return empty;
  } else if (p.tag === "PropertyPath") {
    const fp = {
      ...p,
      tag: "FieldPath",
      name: p.name,
      field: p.field,
    };

    if (!allArgs.includes(prettyPrintPath(fp))) {
      return empty;
    }

    // TODO: Could all the prettyprinting cause performance issues for large graphs?
    // Connect X.shape to X.shape.property
    const edge = {
      data: {
        id: prettyPrintPath(fp) + " -> " + prettyPrintPath(p),
        source: prettyPrintPath(fp),
        target: prettyPrintPath(p),
      },
    };

    return { nodes: [], edges: [edge] };
  } else if (p.tag === "AccessPath") {
    // If X.shape exists, connect X.shape to X.shape.property to X.shape.property[i]
    const graph0 = toGraphDOF(p.path, allArgs);

    // Make node for X.shape.property (the one for X.shape.property[i] already exists)
    const propNode = {
      data: {
        id: prettyPrintPath(p.path),
        label: prettyPrintPath(p.path),
      },
    };

    // Make edge for X.shape.property to X.shape.property[i]
    const propEdge = {
      data: {
        id: prettyPrintPath(p.path) + " -> " + prettyPrintPath(p),
        source: prettyPrintPath(p.path),
        target: prettyPrintPath(p),
      },
    };

    return {
      // TODO: Use graph combination function
      nodes: graph0.nodes.concat([propNode]),
      edges: graph0.edges.concat([propEdge]),
    };
  } else if (p.tag === "LocalVar" || "InternalLocalVar") {
    throw Error("unexpected node type: local var in varying var");
  }

  return empty;
};

// Make nodes and edges related to showing DOF nodes

export const toGraphDOFs = (
  varyingPaths: Path[],
  allFns: Fn[],
  allArgs: string[]
): PGraph => {
  const varyingPathNodes = varyingPaths.map((p) => {
    const res = prettyPrintPath(p);
    return {
      data: {
        id: res,
        label: res,
        DOF: true,
      },
    };
  });

  // Put in edges for varyingPathNodes
  // The edges connecting it are: one additional edge for each layer of nesting, plus a node
  // e.g. A.shape -> A.shape.center -> A.shape.center[0]

  let intermediateNodes: any[] = [];
  let intermediateEdges: any[] = [];

  for (const p of varyingPaths) {
    // If the varying path is a shape arg AND its shape arg appears in the function arguments, then make intermediate nodes to connect the varying path with the shape arg
    const pGraph = toGraphDOF(p, allArgs);
    intermediateNodes = intermediateNodes.concat(pGraph!.nodes);
    intermediateEdges = intermediateEdges.concat(pGraph!.edges);
  }

  return {
    nodes: merge([varyingPathNodes, intermediateNodes]),
    edges: merge([intermediateEdges]),
  };
};

// For opt fn graph
// TODO: Hover to show outgoing edges (cytoscape)
// TODO / NOTE: This does not work with inline computations (e.g. f(g(p), x)). Everything needs to be a path
export const toGraphOpt = (
  objfns: PenroseFn[],
  constrfns: PenroseFn[],
  varyingPaths: any[]
): PGraph => {
  // One node for each unique path, id = path name, name = path name
  // One node for each unique obj/constr application, id = the function w/ its args, name = function name
  // One edge for each function=>path application, id = from + to names, name = none

  const allFns = objfns.concat(constrfns);
  const allArgs: string[] = merge(
    allFns.map((f) => f.fargs.map(prettyPrintExpr))
  ); // This also includes constants, etc.

  const argNodes = allArgs.map((p) => ({
    data: {
      id: p,
      label: p,
    },
  }));

  const fnNodes = allFns.map((f) => ({
    data: {
      id: prettyPrintFn(f),
      label: f.fname,
      [f.optType]: true,
    },
  }));

  const varyingGraph = toGraphDOFs(varyingPaths, allFns, allArgs);

  const nodes = merge([argNodes, fnNodes, varyingGraph.nodes]);

  const fnEdges = merge(
    allFns.map((f) =>
      f.fargs.map((arg) => ({
        data: {
          id: prettyPrintFn(f) + " -> " + prettyPrintExpr(arg),
          source: prettyPrintFn(f), // Matches existing fn ids
          target: prettyPrintExpr(arg), // Matches existing path ids
        },
      }))
    )
  );

  const edges = merge([fnEdges, varyingGraph.edges]);

  return {
    nodes,
    edges,
  };
};
