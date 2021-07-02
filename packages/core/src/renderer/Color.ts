import { random_palette, viridis_data } from "./ColorData";
import { State } from "types/state";
import { Shape } from "types/shape";
import { Color } from "types/value";

/************************************************************************/
/*                   Color Function Type Declarations                   */
/************************************************************************/

/**
 * @type Stores RGB color as [R,G,B]; each number is a decimal between 0 & 1
 */
export type RGB = [number, number, number];

/**
 * @type Adjacency matrix storing edge weights between nodes
 */
export type Graph = number[][];

/**
 * @type Adjacency List representation of a graph.
 * Given adj : Ajlist, adj[i] is the list of nodes that are connected to node i
 */
export type Ajlist = number[][];

/************************************************************************/
/*                        Main Coloring Functions                       */
/************************************************************************/

/**
 * Given a state, returns a new state where shapes w/ uninitialized colors
 * have been colored according to K-Nearest Neighbors
 */
export const colorUninitShapes = (state: State): State => {
  // get the fn that checks if a shape has an uninitialized color
  const hasUninitializedColor = getUninitializedColorCheckerFn(state);

  // make a new (stricter) fn that also checks
  // if a shape obj satisfies includeShapesOnly as well
  const isUninitializedColorShape = (shape: Shape): boolean => {
    return hasUninitializedColor(shape) && includeShapesOnly(shape);
  };

  return getNewlyColoredState(
    state,
    isUninitializedColorShape,
    random_palette(),
    0.5
  );
};

/**
 * Given a state, returns a new state where text w/ uninitialized colors
 * have been colored according to the color of the topmost shape the text
 * is drawn on top of.
 * Meant to be called after colorUninitShapes has been called.
 */
/* 
  TODO: take into consideration the "total background color", not just
  the color of the topmost shape (especially when shapes are assigned
  transparent alphas) 
*/
export const colorUninitText = (state: State): State => {
  // fn that checks if a shape has an uninitialized color path
  const hasUninitializedColor = getUninitializedColorCheckerFn(state);

  // fn that checks if a shape is a text obj & has an uninit color path
  const isUninitializedColorText = (shape: Shape): boolean => {
    return hasUninitializedColor(shape) && shape.shapeType === "Text";
  };

  // get the text shapes that we need to assign colors to
  const textToAssignColors = state.shapes.filter(isUninitializedColorText);

  // get a list of [shapeName, shape] : [string, Shape] objects
  const shapeNameAndShapeList = getOrderedShapeNameAndShapePairList(state);

  // get the colorlist for the text objects
  const colorList = createTextColorList(
    textToAssignColors,
    shapeNameAndShapeList
  );

  // assign the colors to the text objects in a new state
  return assignNewColors(state, colorList, isUninitializedColorText, 1);
};

/************************************************************************/
/*       Transition Functions between different coloring states         */
/************************************************************************/

/**
 * Create a graph (matrix) that records the distance between nodes;
 * i.e. graph[i][j] === distance between shape i and shape j
 * @param shapeList a list of shapes (each shape will act as a node)
 */
const shapeListToDistanceGraph = (shapeList: Shape[]): Graph => {
  // initializing a matrix of 0.'s
  var object_graph = createMatrix(shapeList.length, shapeList.length);

  // filling in the matrix
  for (var i = 0; i < shapeList.length; i++) {
    for (var j = i + 1; j < shapeList.length; j++) {
      const shape1 = shapeList[i];
      const shape2 = shapeList[j];

      // for now, the only thing used to determine distance will be the centers
      // of each shape
      // TODO: use bounding boxes and/or more accurate measure of distance
      var v1 = shape1.properties.center;
      var v2 = shape2.properties.center;

      // some legality checks
      if (
        !Array.isArray(v1.contents) ||
        !Array.isArray(v2.contents) ||
        v1.contents.length !== v2.contents.length ||
        typeof v1.contents[0] !== "number" ||
        typeof v2.contents[0] !== "number"
      ) {
        throw new Error("bad center prop input: not number[]");
      }

      // calculate & set the distance
      const centerDist = dist(v1.contents as number[], v2.contents as number[]);
      object_graph[i][j] = centerDist;

      // symmetric matrix (we are creating an undirected graph)
      object_graph[j][i] = object_graph[i][j];
    }
  }

  return object_graph;
};

/**
 * Creates a KNN Graph (adjacency list) where two nodes are connected
 * if they are within each other's k nearest neighbors
 * @param distGraph distance graph, created by shapeListToDistanceGraph
 * @param k number of nearest neighbors, assumed k > 0 (k<=0 causes problems)
 */
const distGraphToKNNGraph = (distGraph: Graph, k: number): Ajlist => {
  if (k >= distGraph.length) {
    throw new Error("Warning: more neighbors requested than graph elems");
  }

  // ajlist will store the k closest neighbors for each node, in sorted order
  var ajlist: Ajlist;

  // first initialize the matrix
  ajlist = createMatrix(distGraph.length, k);

  // fill up the adjacency list
  for (var i = 0; i < distGraph.length; i++) {
    // list of all the neighbors of node i (includes itself)
    var currRow = distGraph[i];

    //  record the index of each neighbor
    //  along with its distance away from node i
    var indexedRow = currRow.map((element, index) => {
      return [element, index];
    });

    // remove node i from the list
    // (we don't include the node itself in its list of nbors)
    indexedRow = indexedRow.filter((elemIndexPair) => {
      return i !== elemIndexPair[1];
    });

    // sort the list based on the distance each node is away from node i
    indexedRow.sort((e1, e2): number => {
      return e1[0] - e2[0];
    });

    // put the indexes of the closest k neighbors in the ajlist
    for (var j = 0; j < k; j++) {
      ajlist[i][j] = indexedRow[j][1]; // add the indexes in sorted order
    }
  }

  return ajlist;
};

// takes in a KNN graph (adjacency list)
// creates a colorList, i.e. a list that maps node --> its assigned color
/**
 * Creates a colorlist c, where for every node i,
 * c[i] === the color assigned to node i
 * @param KNNGraph k-nearest neighbor graph (adjacency list),
 *  created by distGraphToKNNGraph
 * @param k number of nearest neighbors, assumed k > 0 (k<=0 causes problems)
 * @param palette optional param, a list of colors to choose from
 */
const KNNGraphToColorList = (
  KNNGraph: Ajlist,
  k: number,
  palette: RGB[] = viridis_data
): RGB[] => {
  // what's the minimum number of colors needed to color a graph, given k neighbors?
  const numColorsRequested = 2 * k; // this is sufficient?

  // list of colors that can be assigned to each node
  const colorsToAssign = sampleUniformPalette(numColorsRequested, palette);

  // initialize a colorlist
  var colorList: RGB[] = [];
  for (var i = 0; i < KNNGraph.length; i++) {
    colorList.push([-1, -1, -1]);
  }

  // now assign the colors to the nodes of the graph in a greedy fashion.

  // for every node...
  for (var node = 0; node < KNNGraph.length; node++) {
    // get its k nearest nbors...
    const nodeNbors = KNNGraph[node];

    var colorsThatCannotBeUsed: RGB[] = [];
    // loop through its nbors, checking if any have already been assigned a color
    for (
      var nbornodeindex = 0;
      nbornodeindex < nodeNbors.length;
      nbornodeindex++
    ) {
      const currNbor = nodeNbors[nbornodeindex];
      if (currNbor < node) {
        // then it has been assigned a color already
        // (since we assign colors to the nodes in order)

        // get the color that it has been assigned,
        const alreadyUsedColor = colorList[currNbor];

        // and mark it as a color that we cannot use for the current node
        colorsThatCannotBeUsed.push(alreadyUsedColor);
      }
    }

    // get a list of the indexes that map to the already used colors
    const unavailableColorIndexes = colorsThatCannotBeUsed.map((elem) => {
      return colorsToAssign.findIndex((color) => {
        return color === elem;
      });
    });

    // now assign a color to node (one that isn't a part of colorsThatCannotBeUsed)

    // to do this, we first create a list of indexes corresponding to the colors that
    // we CAN assign to the current node
    var availableColorIndexes: number[] = [];
    for (var i = 0; i < colorsToAssign.length; i++) {
      if (!unavailableColorIndexes.includes(i)) {
        availableColorIndexes.push(i);
      }
    }

    // now pick a random index that maps to the a viable color
    const randomColorIndexIndex = Math.floor(
      Math.random() * (availableColorIndexes.length - 1)
    );
    const randomColorIndex = availableColorIndexes[randomColorIndexIndex];

    // get its color
    const randomColor = colorsToAssign[randomColorIndex];

    // set the random color
    colorList[node] = randomColor;
  }

  return colorList;
};

/**
 * Creates a new state with newly assigned colors to the shapes that
 * satisfy includeInColorAdjustmentFn, using greedy KNN assignment.
 * @param state old state
 * @param includeInColorAdjustmentFn a fn that determines whether or not
 * a shape s should be assigned a new color
 * @param palette optional param, the palette used during KNN color assignment
 * @param alpha optional param, the opacity value assigned to all new colors.
 */
const getNewlyColoredState = (
  state: State,
  includeInColorAdjustmentFn: (s: Shape) => boolean,
  palette = random_palette(),
  alpha = 0.5
): State => {
  const shapesToAssignColors = state.shapes.filter(includeInColorAdjustmentFn);
  const distanceGraph = shapeListToDistanceGraph(shapesToAssignColors);
  if (distanceGraph.length <= 3) {
    var k = distanceGraph.length - 1; // number of neighbors
  } else {
    var k = 3;
  }
  if (k <= 0) {
    // this happens if distanceGraph.length <= 1,
    // in which case we don't need to do special coloring
    // (a single object or no object(s) has an unspecified color)
    return state;
  } else {
    const KNNGraph = distGraphToKNNGraph(distanceGraph, k);
    const colorList = KNNGraphToColorList(KNNGraph, k, palette);
    const newState = assignNewColors(
      state,
      colorList,
      includeInColorAdjustmentFn,
      alpha
    );
    return newState;
  }
};

/**
 * Creates a new state with newly assigned colors to the shapes that
 * satisfy includeInColorAdjustmentFn.
 * The colors are selected from colorList, in the order that they appear.
 * Ex. the first shape s for which includeInColorAdjustmentFn(s) === true
 * will be assigned colorList[0] as its color.
 * And the last shape for which includeInColorAdjustmentFn(s) === true
 * will be assigned colorList[colorList.length - 1] as its color.
 * It is assumed that:
 *  state.shapes.filter(includeInColorAdjustmentFn).length === colorList.length.
 * @param state old state
 * @param colorList list of colors to assign to shapes
 * @param includeInColorAdjustmentFn a fn that determines whether or not
 * a shape s should be assigned a new color
 * @param alpha optional param, the opacity value assigned to all new colors.
 */
const assignNewColors = (
  state: State,
  colorList: RGB[],
  includeInColorAdjustmentFn: (s: Shape) => boolean = includeShapesOnly,
  alpha: number = 0.5
): State => {
  // assumes all colors map to the order of appropriate objects in state
  var newState = state;
  var j = 0;
  for (var i = 0; i < newState.shapes.length; i++) {
    if (includeInColorAdjustmentFn(newState.shapes[i])) {
      newState.shapes[i].properties.color = {
        tag: "ColorV",
        contents: {
          tag: "RGBA",
          contents: [colorList[j][0], colorList[j][1], colorList[j][2], alpha],
        },
      };
      j += 1;
    }
  }
  return newState;
};

/************************************************************************/
/*                       Helper (Utility) Functions                     */
/************************************************************************/

/**
 * Initializes a matrix of all 0.s, of rows * cols dimension
 * @param rows number of rows, assumed >= 0
 * @param cols number of cols, assumed >= 0
 */
const createMatrix = (rows: number, cols: number): number[][] => {
  var matrix: number[][] = [];
  for (var i = 0; i < rows; i++) {
    var row: number[] = [];
    for (var j = 0; j < cols; j++) {
      row.push(0);
    }
    matrix.push(row);
  }
  return matrix;
};

/**
 * Calculates euclidean distance between two vectors.
 * Assumes v1.length === v2.length.
 */
const dist = (v1: number[], v2: number[]): number => {
  if (v1.length != v2.length) {
    throw new Error("Vector inputs are not of the same dimension");
  }
  var squaredSum = 0;
  for (var i = 0; i < v1.length; i++) {
    squaredSum += (v1[i] - v2[i]) * (v1[i] - v2[i]);
  }
  return Math.sqrt(squaredSum);
};

/**
 * Returns true if a shape is to be included in color assignment,
 * and false otherwise.
 * Currently excludes shapes that don't have a color/center attribute,
 * shapes whose coloring are handled not using this fn (ex. text), and
 * shapes whose edge detection has not yet been implemented (ex. Polygon).
 */
const includeShapesOnly = (shape: Shape): boolean => {
  return !(
    shape.shapeType === "FreeformPolygon" ||
    shape.shapeType === "Polygon" ||
    shape.shapeType === "Line" ||
    shape.shapeType === "Arrow" ||
    shape.shapeType === "Path" ||
    shape.shapeType === "Text" ||
    shape.shapeType === "Image" ||
    shape.shapeType === "PathString" ||
    shape.shapeType === "Polyline"
  );
};

/**
 * Returns a list of color from the passed in palette,
 * sampled at uniform intervals.
 * @param numColorsRequested equal to the length of the result array
 * @param palette optional param, the palette to sample colors from
 */
const sampleUniformPalette = (
  numColorsRequested: number,
  palette: RGB[] = viridis_data
): RGB[] => {
  // handle 0 case, to prevent division by 0 later on
  if (numColorsRequested === 0) return [];

  // this fn doesn't work if num colors requested > palette length
  if (numColorsRequested > palette.length) {
    throw new Error("More colors requested than available in palette");
  }

  const stepSize = Math.floor(palette.length / numColorsRequested);

  var rgbList: RGB[] = [];

  for (var i = 0; i < numColorsRequested; i++) {
    rgbList.push(palette[i * stepSize]);
  }

  return rgbList;
};

/**
 * Given a state, returns a (shape => bool) function f, such that
 * f(s) === true if shape s has an uninitialized color path, and
 * f(s) === false if shape s has a (user) initialized color path.
 */
const getUninitializedColorCheckerFn = (
  state: State
): ((shape: Shape) => boolean) => {
  // the list of uninitialized paths from the state
  const uninitPathsList = state.uninitializedPaths;

  // checks if a path is a color path
  const isColorPath = (path: any): boolean => {
    return path.tag === "PropertyPath" && path.property.value === "color";
  };

  // gets the list of uninitialized color paths
  const uninitColorPathList = uninitPathsList.filter(isColorPath);

  // given a path, returns the name of the shape it belongs to (ex. H.icon)
  const getPathName = (path: any): string => {
    return path.name.contents.value + "." + path.field.value;
  };

  // get the corresponding shape names of the uninitialized color paths
  const pathNameList = uninitColorPathList.map(getPathName);

  // determines if a shape has an uninitialized color path
  const hasUninitializedColor = (shape: Shape): boolean => {
    return pathNameList.includes(shape.properties.name.contents);
  };

  // return the fn
  return hasUninitializedColor;
};

/**
 * Given a state, return a list of [shapeName, shapeObj] tuples.
 * The list will be sorted accordingly to which shape is drawn last.
 * (i.e. the shapes at the front of the list are the ones drawn most recently).
 */
const getOrderedShapeNameAndShapePairList = (
  state: State
): [string, Shape][] => {
  // get all color-able shapes (circle, square, rect, ellipse, callout)
  const colorShapes = state.shapes.filter(includeShapesOnly);

  // get the shape names (strings)
  const colorShapeNames = colorShapes.map((elem) => {
    return elem.properties.name.contents;
  });

  // get the list of color-able shape names, in order in which they are drawn
  // shapes that appear at the beginning of the shapeLayeringOrderAll list
  // are the shapes that are drawn first (and would appear on the "bottom")
  const shapeLayeringOrderAll = state.shapeOrdering.filter((elem) => {
    return colorShapeNames.includes(elem);
  });

  // reverse the list to
  // get the shapes that are drawn most recently at the front of the list
  const reversedShapeLayeringOrderAll = shapeLayeringOrderAll.reverse();

  // takes in a shapeName, and returns a fn that checks of a shape has that name
  const isMatchingShape = (shapeName: string) => {
    const fn = (shape: Shape) => {
      return shapeName === shape.properties.name.contents;
    };
    return fn;
  };

  // maps the list of shape names to a list of
  // [shapeName, shape] : [string, Shape] objects
  const shapeNameAndShapePairsAll: [
    string,
    Shape
  ][] = reversedShapeLayeringOrderAll.map((shapeName) => {
    const matchesName = isMatchingShape(shapeName);
    const shape = colorShapes.find(matchesName);
    if (typeof shape === "undefined") {
      throw new Error("im sad");
    }
    return [shapeName, shape];
  });

  return shapeNameAndShapePairsAll;
};

/**
 * Determines if an (x,y) point is contained within a shape.
 * Used to determine whether (uninitialized color) text should be black or white.
 * @param shape currently supported shapes:
 *  Circle, ELlipse, Rectangle, Callout, Square
 * @param point (x,y) 2D vector
 */
const pointInShape = (shape: Shape, point: [number, number]): boolean => {
  const [px, py] = point;

  switch (shape.shapeType) {
    case "Circle":
      var [cx, cy] = shape.properties.center.contents as [number, number];
      var r = shape.properties.r.contents;
      return Math.sqrt((cx - px) * (cx - px) + (cy - py) * (cy - py)) <= r;

    case "Ellipse":
      var [cx, cy] = shape.properties.center.contents as [number, number];
      var [dx, dy] = [px - cx, py - cy];
      var theta = Math.atan2(dy, dx); // this is in radians
      var [rx, ry] = [
        shape.properties.rx.contents,
        shape.properties.ry.contents,
      ] as [number, number]; // width, height of ellipse
      var [xcomp, ycomp] = [dx * Math.cos(theta), dy * Math.sin(theta)];
      return (
        cx - rx <= xcomp &&
        xcomp <= cx + rx &&
        cy - ry <= ycomp &&
        ycomp <= cy + ry
      );

    case "Rectangle":
      var [cx, cy] = shape.properties.center.contents as [number, number];
      var [w, h] = [
        shape.properties.w.contents,
        shape.properties.h.contents,
      ] as [number, number];
      return cx - w <= px && px <= cx + w && cy - h <= py && py <= cy + h;

    // note: doesn't do precise calculation of the callout anchor,
    // only the main rectangle box
    case "Callout":
      var [cx, cy] = shape.properties.center.contents as [number, number];
      var [w, h] = [
        shape.properties.w.contents,
        shape.properties.h.contents,
      ] as [number, number];
      return cx - w <= px && px <= cx + w && cy - h <= py && py <= cy + h;

    case "Square":
      var [cx, cy] = shape.properties.center.contents as [number, number];
      var s = shape.properties.side.contents as number;
      return cx - s <= px && px <= cx + s && cy - s <= py && py <= cy + s;

    default:
      throw new Error(
        "pointInShape detection of " + shape.shapeType + " is not yet supported"
      );
    /* 
      unsupported shapes, currently ignored by fns that call this function 
       (and also excluded by includeShapesOnly): 

       - Line, Arrow, Path, Image, PathString, Polyline
       - FreeformPolygon, Polygon

       what's the difference between FreeformPolygon & Polygon? 
       note: may be able to use winding number algorithm, or rays for 
       point detection inside polygons
      */
  }
};

/**
 * Creates a list of colors to be assigned to the text paths in textPathList
 * @param textPathList a list of paths of text objs w/ uninitialized color fields
 * @param shapeNameAndShapePairList a list of shapes, sorted from drawn last --> drawn first
 */
const createTextColorList = (
  textPathList: any[],
  shapeNameAndShapePairList: [string, Shape][]
): RGB[] => {
  // colorlist to fill up w/ text colors (black or white)
  var colorList: RGB[] = [];

  // push a color into the colorlist, corresponding to each text path object
  for (var i = 0; i < textPathList.length; i++) {
    var textObj = textPathList[i];

    var textCenter = textObj.properties.center.contents as [number, number];

    // the shape that the text is immediately on top of
    var topmostShapeThatPointIsIn;

    // find a shape, if any, that the text center is contained in
    for (var j = 0; j < shapeNameAndShapePairList.length; j++) {
      const [shapeName, shape] = shapeNameAndShapePairList[j];
      if (pointInShape(shape, textCenter)) {
        topmostShapeThatPointIsIn = shape;
        break;
      }
    }

    // initialize a color variable
    var color = undefined;

    // the text center was not found to be inside any shape, so it will be
    // drawn against a white canvas
    if (typeof topmostShapeThatPointIsIn === "undefined") {
      color = [0, 0, 0]; // black, for visibility against a white canvas
    }
    // the text center WAS found to be inside of a shape
    else {
      // check the color that the shape was assigned
      const shapeColorObj = topmostShapeThatPointIsIn.properties.color
        .contents as Color<number>;
      var shapeColor = shapeColorObj.contents;
      var shapeColorType = shapeColorObj.tag;

      if (shapeColorType === "RGBA") {
        // "convert" to HSV to get the V value
        const [r, g, b, a] = [
          shapeColor[0],
          shapeColor[1],
          shapeColor[2],
          shapeColor[3],
        ];

        // https://math.stackexchange.com/questions/556341/rgb-to-hsv-color-conversion-algorithm
        const v = Math.max(r, g, b);

        // the h and s values are not used, placeholder for now
        shapeColor = [-1, -1, v, a];
        shapeColorType = "HSVA";
      }

      // assign color based on the "V" value
      if (shapeColorType === "HSVA") {
        // check the v value
        const [v, a] = [shapeColor[2], shapeColor[3]];

        // the following alpha and value thresholds are arbitrary
        if (a <= 0.35) {
          color = [0, 0, 0]; // black, if it's mostly transparent
        } else if (v < 0.7) {
          // alpha <= 0.6
          color = [1, 1, 1]; // white
        } else {
          // alpha > 0.6 and value >= 0.5
          color = [0, 0, 0]; // black
        }
      }
    }

    // a check to make typescript happy
    // also, Color<number> objects only have "RGBA" or "HSVA" as tags,
    // so this case should never be reached
    if (typeof color === "undefined") {
      throw new Error("Color not assigned");
    }

    colorList.push(color as RGB);
  }
  return colorList;
};

/**@deprecated */
// not currently in use
// converts a matrix that stores distance between objects
// to one that stores "repellant energy" between objects
// ex. graph[i][j] === *how much* objs i and j should repel each other
// (repel each other in terms of color)
const distanceGraphToEnergyGraph = (graph: Graph): Graph => {
  var newGraph = graph;
  for (var i = 0; i < graph.length; i++) {
    for (var j = i + 1; j < graph.length; j++) {
      // super hacky, uses some guidelines fron Constraints.ts (repel fxns)

      const epsilon = 20; // prevent division by 0
      const weight = 10e4; // scaling factor, since values are typically small

      // invert the distance to get a "repellant energy" value
      newGraph[i][j] = (1 / (graph[i][j] + epsilon)) * weight;

      // symmetric graph
      newGraph[j][i] = newGraph[i][j];
    }
  }
  return newGraph;
};
