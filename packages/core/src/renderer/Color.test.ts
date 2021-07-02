import { Graph } from "./Color";

test("first test", () => {
  expect(true).toBe(true);
});

/**
 * Checks that # of rows === # of cols within a graph (list of num lists)
 */
const is_square_matrix = (graph: Graph): boolean => {
  for (var i = 0; i < graph.length; i++) {
    if (graph[i].length !== graph.length) {
      return false;
    }
  }
  return true;
};

/**
 * Checks that an edge exists between every pair of nodes & no self loops exist
 */
const is_complete_graph = (graph: Graph): boolean => {
  if (!is_square_matrix(graph)) return false;
  for (var i = 0; i < graph.length; i++) {
    for (var j = 0; j < graph.length; j++) {
      // no self loops
      if (i == j && graph[i][j] !== 0) return false;
      // edge weights are symmetric
      else if (i != j && graph[i][j] !== graph[j][i]) return false;
    }
  }
  return true;
};

/*
// some vars to use
const empty_arr: number[][] = [];
const jagged_arr = [
  [1, 2, 3],
  [4, 5],
  [6, 7, 8],
];
const rect_arr = [
  [1, 2],
  [4, 5],
  [8, 9],
];
const square_arr = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];
const self_loops = square_arr;
const asymmetric_graph = [
  [0, 2],
  [5, 0],
];
const complete_graph = [
  [0, 2, 3],
  [2, 0, 5],
  [3, 5, 0],
];

// is_square_matrix
describe("testing is_square_matrix", () => {
  test("is_square_matrix, empty case", () => {
    expect(is_square_matrix(empty_arr)).toBe(true);
  });

  test("is_square_matrix, jagged case", () => {
    expect(is_square_matrix(jagged_arr)).toBe(false);
  });

  test("is_square_matrix, rectangular case", () => {
    expect(is_square_matrix(rect_arr)).toBe(false);
  });

  test("is_square_matrix, square case", () => {
    expect(is_square_matrix(square_arr)).toBe(true);
  });
});

// is_complete_graph
describe("testing is_complete_graph", () => {
  test("is_complete_graph, empty case", () => {
    expect(is_complete_graph(empty_arr)).toBe(true);
  });

  test("is_complete_graph, jagged case", () => {
    expect(is_complete_graph(jagged_arr)).toBe(false);
  });

  test("is_complete_graph, rectangular case", () => {
    expect(is_complete_graph(rect_arr)).toBe(false);
  });

  test("is_complete_graph, self loops", () => {
    expect(is_complete_graph(self_loops)).toBe(false);
  });

  test("is_complete_graph, asymmetric graph", () => {
    expect(is_complete_graph(asymmetric_graph)).toBe(false);
  });

  test("is_complete_graph, complete graph", () => {
    expect(is_complete_graph(complete_graph)).toBe(true);
  });
});

// compareEdges
describe("testing compareEdges", () => {
  const e1 = { start_node_index: 0, end_node_index: 2, weight: 0 };
  const e2 = { start_node_index: 1, end_node_index: 5, weight: 0 };
  const e3 = { start_node_index: 2, end_node_index: 6, weight: 10 };
  const e4 = { start_node_index: 4, end_node_index: 7, weight: 8 };

  test("compareEdges, equality", () => {
    expect(compareEdges(e1, e2)).toBe(0);
  });

  test("compareEdges, equality swapped", () => {
    expect(compareEdges(e2, e1)).toBe(0);
  });

  test("compareEdges, less than", () => {
    expect(compareEdges(e1, e3)).toBeLessThan(0);
  });

  test("compareEdges, greater than", () => {
    expect(compareEdges(e3, e1)).toBeGreaterThan(0);
  });

  test("compareEdges, sorting", () => {
    const hopefully_sorted = [e1, e3, e4];
    hopefully_sorted.sort(compareEdges);
    expect(hopefully_sorted).toStrictEqual([e1, e4, e3]);
  });
});
*/
