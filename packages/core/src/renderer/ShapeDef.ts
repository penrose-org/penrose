import { randFloat } from "utils/Util";
import { Shape } from "types/shape";
import { Value } from "types/value";
import { IFloatV, IVectorV, IColorV, IPolygonV } from "types/value";
import { Path } from "types/style";

//#region shapedef helpers and samplers

/** @ignore */
type PropContents = Value<number>["contents"];
/** @ignore */
type ConstSampler = (type: PropType, value: PropContents) => Value<number>;

type Range = [number, number];

// NOTE: I moved `canvasSize` here from Canvas.tsx, which re-exports it, to avoid a circular import in `Style`.

export const canvasSize: [number, number] = [800, 700];
export const canvasXRange: Range = [-canvasSize[0] / 2, canvasSize[0] / 2];
export const canvasYRange: Range = [-canvasSize[1] / 2, canvasSize[1] / 2];

/** Generate a single string based on a path to a shape */
export const getShapeName = (p: Path): string => {
  if (p.tag === "FieldPath" || p.tag === "PropertyPath") {
    const { name, field } = p;
    return `${name.contents.value}.${field.value}`;
  } else {
    throw new Error("Can only derive shape name from field or property path.");
  }
};

/**
 * Sort shapes given a list of ordered shape names.
 *
 * @param shapes unsorted shapes
 * @param ordering global ordering of shapes
 */
export const sortShapes = (shapes: Shape[], ordering: string[]): Shape[] => {
  return ordering.map(
    (name) =>
      // COMBAK: Deal with nonexistent shapes
      shapes.find(
        ({ properties }) => properties.name.contents === name
      ) as Shape
  ); // assumes that all names are unique
};

/**
 * Checks if a `Text` shape has non-empty content
 *
 * @param shape a `Text` shape
 */
export const notEmptyLabel = (shape: Shape): boolean => {
  const { shapeType, properties } = shape;
  return shapeType === "Text" ? !(properties.string.contents === "") : true;
};

const sampleFloatIn = (min: number, max: number): IFloatV<number> => ({
  tag: "FloatV",
  contents: randFloat(min, max),
});

const vectorSampler: Sampler = (): IVectorV<number> => ({
  tag: "VectorV",
  contents: [randFloat(...canvasXRange), randFloat(...canvasYRange)],
});
const widthSampler: Sampler = (): IFloatV<number> => ({
  tag: "FloatV",
  contents: randFloat(3, canvasSize[0] / 6),
});
const zeroFloat: Sampler = (): IFloatV<number> => ({
  tag: "FloatV",
  contents: 0.0,
});
const pathLengthSampler: Sampler = (): IFloatV<number> => ({
  tag: "FloatV",
  contents: 1.0,
});
const heightSampler: Sampler = (): IFloatV<number> => ({
  tag: "FloatV",
  contents: randFloat(3, canvasSize[1] / 6),
});
const strokeSampler: Sampler = (): IFloatV<number> => ({
  tag: "FloatV",
  contents: randFloat(0.5, 3),
});
const colorSampler: Sampler = (): IColorV<number> => {
  const [min, max] = [0.1, 0.9];
  return {
    tag: "ColorV",
    contents: {
      tag: "RGBA",
      contents: [
        randFloat(min, max),
        randFloat(min, max),
        randFloat(min, max),
        0.5,
      ],
    },
  };
};

export const constValue: ConstSampler = (
  tag: PropType,
  contents: PropContents
) =>
  ({
    tag,
    contents,
  } as Value<number>);

const black: IColorV<number> = {
  tag: "ColorV",
  contents: {
    tag: "RGBA",
    contents: [0, 0, 0, 1.0],
  },
};

const emptyPoly: IPolygonV<number> = {
  tag: "PolygonV",
  contents: [
    [],
    [],
    [
      [-Infinity, Infinity],
      [-Infinity, Infinity],
    ],
    [],
  ],
};

//#endregion

//#region shapedefs
export type ShapeDef = IShapeDef;

// type HasTag<T, N> = T extends { tag: N } ? T : never;

export type PropType = Value<number>["tag"];

export type InputType =
  | "range"
  | "mulptrange"
  | "color"
  | "select"
  | "checkbox"
  | "text"
  | "number"
  | "url"
  | "ptrange";

export interface IInputProps {
  inputType: InputType;
  showValue?: boolean;
  min?: number;
  max?: number;
  minX?: number;
  minY?: number;
  maxX?: number;
  maxY?: number;
  options?: string[];
}

export interface IProp {
  /**
   * The datatype of the property
   */
  propType: PropType;
  /**
   * The sampling function to generate the property
   */
  sampler: Sampler;
  /**
   * Optional parameters for the inspector to render the property
   */
  inspection?: IInputProps;
  /**
   * Documentation of the property
   */
  description?: string;
}

export type IPropModel = { [k: string]: IProp };

export interface IShapeDef {
  shapeType: string;
  properties: IPropModel;
  positionalProps?: string[];
}

export type Sampler = () => Value<number>;

export const circleDef: ShapeDef = {
  shapeType: "Circle",
  properties: {
    center: { propType: "VectorV", sampler: vectorSampler },
    r: { propType: "FloatV", sampler: widthSampler },
    pathLength: { propType: "FloatV", sampler: pathLengthSampler }, // part of svg spec
    strokeWidth: { propType: "FloatV", sampler: strokeSampler },
    style: { propType: "StrV", sampler: () => constValue("StrV", "filled") },
    strokeStyle: {
      propType: "StrV",
      sampler: () => constValue("StrV", "solid"),
    },
    strokeColor: { propType: "ColorV", sampler: colorSampler },
    color: { propType: "ColorV", sampler: colorSampler },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultCircle"),
    },
  },
  positionalProps: ["center"],
};

export const ellipseDef: ShapeDef = {
  shapeType: "Ellipse",
  properties: {
    center: { propType: "VectorV", sampler: vectorSampler },
    rx: { propType: "FloatV", sampler: widthSampler },
    ry: { propType: "FloatV", sampler: heightSampler },
    pathLength: { propType: "FloatV", sampler: pathLengthSampler }, // part of svg spec
    strokeWidth: { propType: "FloatV", sampler: strokeSampler },
    style: { propType: "StrV", sampler: () => constValue("StrV", "filled") },
    strokeStyle: {
      propType: "StrV",
      sampler: () => constValue("StrV", "solid"),
    },
    strokeColor: { propType: "ColorV", sampler: colorSampler },
    strokeDashArray: {
      propType: "StrV",
      sampler: () => constValue("StrV", ""),
    },
    color: { propType: "ColorV", sampler: colorSampler },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultCircle"),
    },
  },
  positionalProps: ["center"],
};

export const rectDef: ShapeDef = {
  shapeType: "Rectangle",
  properties: {
    center: { propType: "VectorV", sampler: vectorSampler },
    w: { propType: "FloatV", sampler: widthSampler },
    h: { propType: "FloatV", sampler: heightSampler },
    rx: { propType: "FloatV", sampler: zeroFloat },
    strokeWidth: { propType: "FloatV", sampler: strokeSampler },
    style: { propType: "StrV", sampler: () => constValue("StrV", "filled") },
    strokeStyle: {
      propType: "StrV",
      sampler: () => constValue("StrV", "solid"),
    },
    strokeColor: { propType: "ColorV", sampler: colorSampler },
    strokeDashArray: {
      propType: "StrV",
      sampler: () => constValue("StrV", ""),
    },
    color: { propType: "ColorV", sampler: colorSampler },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultRect"),
    },
  },
  positionalProps: ["center"],
};

export const calloutDef: ShapeDef = {
  shapeType: "Callout",
  properties: {
    anchor: ["VectorV", vectorSampler],
    center: ["VectorV", vectorSampler],
    w: ["FloatV", widthSampler],
    h: ["FloatV", heightSampler],
    padding: ["FloatV", zeroFloat], // padding around the contents of the callout box
    rx: ["FloatV", zeroFloat], // currently unused
    strokeWidth: ["FloatV", strokeSampler],
    style: ["StrV", () => constValue("StrV", "filled")],
    strokeStyle: ["StrV", () => constValue("StrV", "solid")],
    strokeColor: ["ColorV", colorSampler],
    strokeDashArray: ["StrV", () => constValue("StrV", "")],
    color: ["ColorV", colorSampler],
    name: ["StrV", () => constValue("StrV", "defaultCallout")],
  },
};

export const polygonDef: ShapeDef = {
  shapeType: "Polygon",
  properties: {
    strokeWidth: { propType: "FloatV", sampler: strokeSampler },
    style: { propType: "StrV", sampler: () => constValue("StrV", "filled") },
    strokeStyle: {
      propType: "StrV",
      sampler: () => constValue("StrV", "solid"),
    },
    strokeColor: { propType: "ColorV", sampler: colorSampler },
    color: { propType: "ColorV", sampler: colorSampler },
    center: { propType: "VectorV", sampler: vectorSampler },
    scale: { propType: "FloatV", sampler: () => constValue("FloatV", 1) },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultPolygon"),
    },
    points: {
      propType: "PtListV",
      sampler: () =>
        constValue("PtListV", [
          [0, 0],
          [0, 10],
          [10, 0],
        ]),
    },
  },
  positionalProps: ["center"],
};

export const freeformPolygonDef: ShapeDef = {
  shapeType: "FreeformPolygon",
  properties: {
    strokeWidth: { propType: "FloatV", sampler: strokeSampler },
    style: { propType: "StrV", sampler: () => constValue("StrV", "filled") },
    strokeStyle: {
      propType: "StrV",
      sampler: () => constValue("StrV", "solid"),
    },
    strokeColor: { propType: "ColorV", sampler: colorSampler },
    color: { propType: "ColorV", sampler: colorSampler },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultFreeformPolygon"),
    },
    points: {
      propType: "PtListV",
      sampler: () =>
        constValue("PtListV", [
          [0, 0],
          [0, 10],
          [10, 0],
        ]),
    },
  },
  positionalProps: [],
};

const DEFAULT_PATHSTR = `M 10,30
A 20,20 0,0,1 50,30
A 20,20 0,0,1 90,30
Q 90,60 50,90
Q 10,60 10,30 z`;

export const pathStringDef: ShapeDef = {
  shapeType: "PathString",
  properties: {
    center: { propType: "VectorV", sampler: vectorSampler },
    w: { propType: "FloatV", sampler: widthSampler },
    h: { propType: "FloatV", sampler: heightSampler },
    rotation: { propType: "FloatV", sampler: () => constValue("FloatV", 0) },
    opacity: { propType: "FloatV", sampler: () => constValue("FloatV", 1.0) },
    strokeWidth: { propType: "FloatV", sampler: strokeSampler },
    strokeStyle: {
      propType: "StrV",
      sampler: () => constValue("StrV", "solid"),
    },
    strokeColor: { propType: "ColorV", sampler: colorSampler },
    color: { propType: "ColorV", sampler: colorSampler },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultPolygon"),
    },
    data: {
      propType: "StrV",
      sampler: () => constValue("StrV", DEFAULT_PATHSTR),
    },
    viewBox: {
      propType: "StrV",
      sampler: () => constValue("StrV", "0 0 100 100"),
    },
  },
  positionalProps: ["center"],
};

export const polylineDef: ShapeDef = {
  shapeType: "Polyline",
  properties: {
    strokeWidth: { propType: "FloatV", sampler: strokeSampler },
    center: { propType: "VectorV", sampler: vectorSampler },
    scale: { propType: "FloatV", sampler: () => constValue("FloatV", 1) },
    style: { propType: "StrV", sampler: () => constValue("StrV", "filled") },
    strokeStyle: {
      propType: "StrV",
      sampler: () => constValue("StrV", "solid"),
    },
    strokeColor: { propType: "ColorV", sampler: colorSampler },
    color: { propType: "ColorV", sampler: colorSampler },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultPolygon"),
    },
    points: {
      propType: "PtListV",
      sampler: () =>
        constValue("PtListV", [
          [0, 0],
          [0, 10],
          [10, 0],
        ]),
    },
  },
  positionalProps: ["center"],
};

export const imageDef: ShapeDef = {
  shapeType: "Image",
  properties: {
    center: { propType: "VectorV", sampler: vectorSampler },
    w: { propType: "FloatV", sampler: widthSampler },
    h: { propType: "FloatV", sampler: heightSampler },
    rotation: { propType: "FloatV", sampler: () => constValue("FloatV", 0) },
    opacity: { propType: "FloatV", sampler: () => constValue("FloatV", 1.0) },
    style: { propType: "StrV", sampler: () => constValue("StrV", "filled") },
    stroke: { propType: "StrV", sampler: () => constValue("StrV", "none") },
    path: {
      propType: "StrV",
      sampler: () => constValue("StrV", "missing image path"),
    },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultImage"),
    },
  },
  positionalProps: ["center"],
};

export const squareDef: ShapeDef = {
  shapeType: "Square",
  properties: {
    center: { propType: "VectorV", sampler: vectorSampler },
    side: { propType: "FloatV", sampler: widthSampler },
    rotation: { propType: "FloatV", sampler: () => constValue("FloatV", 0) },
    style: { propType: "StrV", sampler: () => constValue("StrV", "none") },
    rx: { propType: "FloatV", sampler: zeroFloat },
    strokeWidth: { propType: "FloatV", sampler: strokeSampler },
    strokeStyle: {
      propType: "StrV",
      sampler: () => constValue("StrV", "solid"),
    },
    strokeColor: { propType: "ColorV", sampler: colorSampler },
    strokeDashArray: {
      propType: "StrV",
      sampler: () => constValue("StrV", ""),
    },
    color: { propType: "ColorV", sampler: colorSampler },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultSquare"),
    },
  },
  positionalProps: ["center"],
};

export const textDef: ShapeDef = {
  shapeType: "Text",
  properties: {
    center: { propType: "VectorV", sampler: vectorSampler },
    w: { propType: "FloatV", sampler: () => constValue("FloatV", 0) },
    h: { propType: "FloatV", sampler: () => constValue("FloatV", 0) },
    fontSize: { propType: "StrV", sampler: () => constValue("StrV", "12pt") },
    rotation: { propType: "FloatV", sampler: () => constValue("FloatV", 0) },
    style: { propType: "StrV", sampler: () => constValue("StrV", "none") },
    stroke: { propType: "StrV", sampler: () => constValue("StrV", "none") },
    color: { propType: "ColorV", sampler: () => black },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultText"),
    },
    string: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultLabelText"),
    },
    // HACK: typechecking is not passing due to Value mismatch. Not sure why
    polygon: { propType: "PolygonV", sampler: () => emptyPoly },
  },
  positionalProps: ["center"],
};

export const lineDef: ShapeDef = {
  shapeType: "Line",
  properties: {
    start: { propType: "VectorV", sampler: vectorSampler },
    end: { propType: "VectorV", sampler: vectorSampler },
    thickness: { propType: "FloatV", sampler: () => sampleFloatIn(5, 15) },
    leftArrowhead: {
      propType: "BoolV",
      sampler: () => constValue("BoolV", false),
    },
    rightArrowhead: {
      propType: "BoolV",
      sampler: () => constValue("BoolV", false),
    },
    arrowheadStyle: {
      propType: "StrV",
      sampler: () => constValue("StrV", "arrowhead-2"),
    },
    arrowheadSize: {
      propType: "FloatV",
      sampler: () => constValue("FloatV", 1.0),
    },
    color: { propType: "ColorV", sampler: colorSampler },
    style: { propType: "StrV", sampler: () => constValue("StrV", "solid") },
    stroke: { propType: "StrV", sampler: () => constValue("StrV", "none") },
    strokeDashArray: {
      propType: "StrV",
      sampler: () => constValue("StrV", ""),
    },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultLine"),
    },
  },
  positionalProps: ["start", "end"],
};

export const arrowDef: ShapeDef = {
  shapeType: "Arrow",
  properties: {
    start: { propType: "VectorV", sampler: vectorSampler },
    end: { propType: "VectorV", sampler: vectorSampler },
    thickness: { propType: "FloatV", sampler: () => sampleFloatIn(5, 15) },
    arrowheadStyle: {
      propType: "StrV",
      sampler: () => constValue("StrV", "arrowhead-2"),
    },
    arrowheadSize: {
      propType: "FloatV",
      sampler: () => constValue("FloatV", 1.0),
    },
    style: { propType: "StrV", sampler: () => constValue("StrV", "solid") },
    color: { propType: "ColorV", sampler: colorSampler },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultArrow"),
    },
    strokeDashArray: {
      propType: "StrV",
      sampler: () => constValue("StrV", ""),
    },
  },
  positionalProps: ["start", "end"],
};

export const curveDef: ShapeDef = {
  shapeType: "Path",
  properties: {
    path: { propType: "PtListV", sampler: () => constValue("PtListV", []) },
    polyline: { propType: "PtListV", sampler: () => constValue("PtListV", []) },
    polygon: { propType: "PolygonV", sampler: () => emptyPoly },
    pathData: {
      propType: "PathDataV",
      sampler: () => constValue("PathDataV", []),
    },
    strokeWidth: { propType: "FloatV", sampler: strokeSampler },
    style: { propType: "StrV", sampler: () => constValue("StrV", "solid") },
    strokeDashArray: {
      propType: "StrV",
      sampler: () => constValue("StrV", ""),
    },
    effect: { propType: "StrV", sampler: () => constValue("StrV", "none") },
    color: { propType: "ColorV", sampler: colorSampler },
    fill: { propType: "ColorV", sampler: colorSampler },
    leftArrowhead: {
      propType: "BoolV",
      sampler: () => constValue("BoolV", false),
    },
    rightArrowhead: {
      propType: "BoolV",
      sampler: () => constValue("BoolV", false),
    },
    arrowheadStyle: {
      propType: "StrV",
      sampler: () => constValue("StrV", "arrowhead-2"),
    },
    arrowheadSize: {
      propType: "FloatV",
      sampler: () => constValue("FloatV", 1.0),
    },
    name: {
      propType: "StrV",
      sampler: () => constValue("StrV", "defaultCurve"),
    },
  },
};

/**
 * A registry of all types of shape definitions in the Penrose system.
 */
export const shapedefs: ShapeDef[] = [
  circleDef,
  ellipseDef,
  textDef,
  rectDef,
  calloutDef,
  polygonDef,
  freeformPolygonDef,
  polylineDef,
  pathStringDef,
  squareDef,
  curveDef,
  imageDef,
  lineDef,
  arrowDef,
];

export const positionalProps = (type: string): string[] | undefined => {
  const res = shapedefs.find(({ shapeType }: ShapeDef) => shapeType === type);
  if (!res) return undefined;
  return res.positionalProps;
};

export const findDef = (type: string): ShapeDef => {
  const res = shapedefs.find(({ shapeType }: ShapeDef) => shapeType === type);
  if (res) return res;
  else throw new Error(`${type} is not a valid shape definition.`);
};

//#endregion
