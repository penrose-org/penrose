// TODO: This is the file with the most final version of CompGraph vis

import * as React from "react";
import IViewProps from "./IViewProps";
import cytoscape from "cytoscape";
import { uniqBy } from "lodash";
import dagre from "cytoscape-dagre";
import { FieldDict, Translation } from "@penrose/core";
import {
  traverseUnique,
  convertSchema,
  toGraphOpt,
  PGraph,
} from "./GraphUtils";

cytoscape.use(dagre);

// TODO: Style edges to DOF vs edges to constants differently

const style = [
  // the stylesheet for the graph
  {
    selector: "node",
    style: {
      "background-color": "#666",
    },
  },

  {
    selector: "node[label]",
    style: {
      label: "data(label)", // label comes from a field of the node
    },
  },

  {
    selector: "node[ObjFn]",
    style: {
      "background-color": "orange",
    },
  },

  {
    selector: "node[ConstrFn]",
    style: {
      "background-color": "blue",
    },
  },

  {
    selector: "node[DOF]",
    style: {
      "background-color": "red",
    },
  },

  {
    selector: "edge",
    style: {
      width: 3,
      "line-color": "#ccc",
      "target-arrow-color": "#ccc",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
    },
  },
];

const makeGraph = (frame: any, value: string): PGraph => {
  let graph;

  if (value === "opt") {
    // Find nodes and edges for opt comp graph
    graph = toGraphOpt(frame.objFns, frame.constrFns, frame.varyingPaths);
  } else if (value === "atomic") {
    // Find nodes and edges for atomic op graph, from top energy node
    graph = convertSchema(traverseUnique(frame.params.energyGraph));
  } else if (value === "none") {
    return { nodes: [], edges: [] };
  } else {
    throw Error(`unexpected value '${value}'`);
  }

  // console.log(`graph of ${value}`, graph);

  // console.log(
  //   "graph # nodes",
  //   graph.nodes.length,
  //   "# edges",
  //   graph.edges.length
  // );

  return graph;
};

const CompGraph: React.FC<IViewProps> = ({ frame, history }: IViewProps) => {
  if (!frame) {
    return (
      <div style={{ padding: "1em", fontSize: "1em", color: "#4f4f4f" }}>
        no frame
      </div>
    );
  }

  const [items] = React.useState([
    { label: "none", value: "none" },
    { label: "Optimization functions", value: "opt" },
    { label: "Atomic operations in energy", value: "atomic" },
  ]);

  const [value, setValue] = React.useState("none"); // init value of state to use

  const graphRef: React.RefObject<HTMLDivElement> = React.useRef<HTMLDivElement>(
    null
  );

  React.useEffect(() => {
    if (graphRef.current !== null) {
      const cy = cytoscape({
        container: graphRef.current, // container to render in
        elements: makeGraph(frame, value),
        style: style,
      });

      cy.layout({
        name: "dagre",
      }).run();

      return () => {
        cy.destroy();
      };
    }
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div>
        Select the computation graph to display. (Note: large graphs may take
        1-2 minutes to load.)
      </div>

      <div>
        <b>Navigation:</b> You can pan and zoom in the frame, and drag nodes.
      </div>

      <div>
        <b>Key for optimization graph:</b> orange = objective; blue =
        constraint; red = degree of freedom (DOF, aka varying variable); gray =
        other
      </div>

      <div>
        <b>Note:</b> In the optimization graph, only Style paths in
        objective/constraint function arguments are visualized; expressions are
        currently not visualized (which may lead to slightly misleading graphs)
      </div>

      <select value={value} onChange={(e) => setValue(e.currentTarget.value)}>
        {items.map(({ label, value }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div
          ref={graphRef}
          style={{ width: "100%", height: "100%", flexGrow: 1 }}
        />
      </div>
    </div>
  );
};

export default CompGraph;
