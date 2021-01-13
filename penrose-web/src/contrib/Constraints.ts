import {
  absVal,
  add,
  addN,
  constOf,
  constOfIf,
  div,
  EPS_DENOM,
  fns,
  gt,
  inverse,
  max,
  min,
  mul,
  neg,
  ops,
  squared,
  sub,
  varOf,
} from "engine/Autodiff";
import * as _ from "lodash";
import { canvasSize } from "ui/Canvas";
import { linePts } from "utils/OtherUtils";

export const objDict = {
  /** 
  * Encourage the inputs to have the same value: `(x - y)^2`
  */
  equal: (x: VarAD, y: VarAD) => squared(sub(x, y)),

  /** 
  * Encourage shape `top` to be above shape `bottom`. Only works for shapes with property `center`.
  */
  above: (
    [t1, top]: [string, any],
    [t2, bottom]: [string, any],
    offset = 100
  ) =>
    // (getY top - getY bottom - offset) ^ 2
    squared(
      sub(sub(top.center.contents[1], bottom.center.contents[1]), varOf(offset))
    ),

  /** 
  * Encourage shape `s1` to have the same center position as shape `s2`. Only works for shapes with property `center`.
  */
  sameCenter: ([t1, s1]: [string, any], [t2, s2]: [string, any]) =>
    ops.vdistsq(fns.center(s1), fns.center(s2)),

  /** 
  * Try to repel shapes `s1` and `s2` with some weight.
  */
  repel: ([t1, s1]: [string, any], [t2, s2]: [string, any], weight = 10.0) => {
    // HACK: `repel` typically needs to have a weight multiplied since its magnitude is small
    // TODO: find this out programmatically
    const repelWeight = 10e6;

    let res;

    // Repel a line `s1` from another shape `s2` with a center.
    if (t1 === "Line") {
      const line = s1;
      const c2 = fns.center(s2);
      const lineSamplePts = sampleSeg(linePts(line));
      const allForces = addN(
        lineSamplePts.map((p) => repelPt(constOfIf(weight), c2, p))
      );
      res = mul(constOfIf(weight), allForces);
    } else {
      // Repel any two shapes with a center.
      // 1 / (d^2(cx, cy) + eps)
      res = inverse(ops.vdistsq(fns.center(s1), fns.center(s2)));
    }

    return mul(res, constOf(repelWeight));
  },

  /** 
  * Try to center the arrow `arr` between the shapes `s2` and `s3` (they can also be any shapes with a center).
  */
  centerArrow: (
    [t1, arr]: [string, any],
    [t2, text1]: [string, any],
    [t3, text2]: [string, any]
  ): VarAD => {
    const spacing = varOf(1.1); // arbitrary

    if (typesAre([t1, t2, t3], ["Arrow", "Text", "Text"])) {
      // HACK: Arbitrarily pick the height of the text
      // [spacing * getNum text1 "h", negate $ 2 * spacing * getNum text2 "h"]
      return centerArrow2(arr, fns.center(text1), fns.center(text2),
        [mul(spacing, text1.h.contents),
        neg(mul(text2.h.contents, spacing))]);

    } else throw new Error(`${[t1, t2, t3]} not supported for centerArrow`);
  },

  /** 
  * Encourage shape `bottom` to be below shape `top`. Only works for shapes with property `center`.
  */
  below: ([t1, bottom]: [string, any], [t2, top]: [string, any], offset = 100) =>
    // TODO: can this be made more efficient (code-wise) by calling "above" and swapping arguments?
    squared(sub(sub(top.center.contents[1], bottom.center.contents[1]), constOfIf(offset))),

  /** 
  * Try to center a label `s2` with respect to some shape `s1`.
  */
  centerLabel: (
    [t1, s1]: [string, any],
    [t2, s2]: [string, any],
    w: number
  ): VarAD => {
    if (typesAre([t1, t2], ["Arrow", "Text"])) {
      const arr = s1;
      const text1 = s2;
      const mx = div(
        add(arr.start.contents[0], arr.end.contents[0]),
        constOf(2.0)
      );
      const my = div(
        add(arr.start.contents[1], arr.end.contents[1]),
        constOf(2.0)
      );

      // entire equation is (mx - lx) ^ 2 + (my + 1.1 * text.h - ly) ^ 2 from Functions.hs - split it into two halves below for readability
      const lh = squared(sub(mx, text1.center.contents[0]));
      const rh = squared(
        sub(
          add(my, mul(text1.h.contents, constOf(1.1))),
          text1.center.contents[1]
        )
      );
      return mul(add(lh, rh), constOfIf(w));
    } else if (typesAre([t1, t2], ["Rectangle", "Text"])) {
      // Try to center label in the rectangle
      // TODO: This should be applied generically on any two GPIs with a center
      return objDict.sameCenter([t1, s1], [t2, s2]);
    } else throw new Error(`${[t1, t2]} not supported for centerLabel`);
  },

  /** 
  * Try to place shape `s1` near shape `s2` (putting their centers at the same place).
  */
  near: ([t1, s1]: [string, any], [t2, s2]: [string, any], offset = 10.0) => {
    // This only works for two objects with centers (x,y)
    const res = absVal(ops.vdistsq(fns.center(s1), fns.center(s2)));
    return sub(res, squared(constOfIf(offset)));
  },

  /** 
  * Try to place shape `s1` near a location `(x, y)`.
  */
  nearPt: ([t1, s1]: [string, any], x: any, y: any) => {
    return ops.vdistsq(fns.center(s1), [constOfIf(x), constOfIf(y)]);
  },
};

// constrDict is the dictionary of all constraints available in Style These are
// called by the key of the dictionary (e.g., maxSize is called via the string
// "maxSize" in Style)
export const constrDict = {

  /** 
  * Require that a shape have a size less than some constant maximum, based on the type of the shape.
  */
  maxSize: ([shapeType, props]: [string, any]) => {
    const limit = Math.max(...canvasSize);
    switch (shapeType) {
      case "Circle":
        return sub(props.r.contents, constOf(limit / 6.0));
      case "Square":
        return sub(props.side.contents, constOf(limit / 3.0));
      default:
        // HACK: report errors systematically
        throw new Error(`${shapeType} doesn't have a maxSize`);
    }
  },

  /** 
  * Require that a shape have a size greater than some constant minimum, based on the type of the shape.
  */
  minSize: ([shapeType, props]: [string, any]) => {
    const limit = 20;

    if (shapeType === "Line" || shapeType === "Arrow") {
      const minLen = 50;
      const vec = ops.vsub(props.end.contents, props.start.contents);
      return sub(constOf(minLen), ops.vnorm(vec));
    }

    switch (shapeType) {
      case "Circle":
        return sub(constOf(limit), props.r.contents);
      case "Square":
        return sub(constOf(limit), props.side.contents);
      default:
        // HACK: report errors systematically
        throw new Error(`${shapeType} doesn't have a minSize`);
    }
  },

  /** 
  * Require that a shape `s1` contains another shape `s2`, based on the type of the shape, and with an optional `offset` between the sizes of the shapes (e.g. if `s1` should contain `s2` with margin `offset`).
  */
  contains: (
    [t1, s1]: [string, any],
    [t2, s2]: [string, any],
    offset: VarAD
  ) => {
    if (t1 === "Circle" && t2 === "Circle") {
      const d = ops.vdist(fns.center(s1), fns.center(s2));
      const o = offset
        ? sub(sub(s1.r.contents, s2.r.contents), offset)
        : sub(s1.r.contents, s2.r.contents);
      const res = sub(d, o);
      return res;
    } else if (t1 === "Circle" && t2 === "Text") {
      const d = ops.vdist(fns.center(s1), fns.center(s2));
      const textR = max(s2.w.contents, s2.h.contents);
      return add(sub(d, s1.r.contents), textR);
    } else if (t1 === "Rectangle" && t2 === "Circle") {
      // contains [GPI r@("Rectangle", _), GPI c@("Circle", _), Val (FloatV padding)] =
      // -- HACK: reusing test impl, revert later
      //    let r_l = min (getNum r "w") (getNum r "h") / 2
      //        diff = r_l - getNum c "r"
      //    in dist (getX r, getY r) (getX c, getY c) - diff + padding

      // TODO: `rL` is probably a hack for dimensions
      const rL = div(min(s1.w.contents, s1.h.contents), varOf(2.0));
      const diff = sub(rL, s2.r.contents);
      const d = ops.vdist(fns.center(s1), fns.center(s2));
      return add(sub(d, diff), offset);
    } else if (t1 === "Square" && t2 === "Circle") {
      // dist (outerx, outery) (innerx, innery) - (0.5 * outer.side - inner.radius)
      const sq = s1.center.contents;
      const d = ops.vdist(sq, fns.center(s2));
      return sub(d, sub(mul(constOf(0.5), s1.side.contents), s2.r.contents));
    } else if (t1 === "Rectangle" && t2 === "Text") {
      // contains [GPI r@("Rectangle", _), GPI l@("Text", _), Val (FloatV padding)] =
      // TODO: implement precisely, max (w, h)? How about diagonal case?
      // dist (getX l, getY l) (getX r, getY r) - getNum r "w" / 2 +
      //   getNum l "w" / 2 + padding

      const a1 = ops.vdist(fns.center(s1), fns.center(s2));
      const a2 = div(s1.w.contents, constOf(2.0));
      const a3 = div(s2.w.contents, constOf(2.0));
      const c = offset ? offset : constOf(0.0);
      return add(add(sub(a1, a2), a3), c);
    } else if (t1 === "Square" && t2 === "Text") {
      const a1 = ops.vdist(fns.center(s1), fns.center(s2));
      const a2 = div(s1.side.contents, constOf(2.0));
      const a3 = div(s2.w.contents, constOf(2.0)); // TODO: Implement w/ exact text dims
      const c = offset ? offset : constOf(0.0);
      return add(add(sub(a1, a2), a3), c);
    } else if (t1 === "Square" && t2 === "Arrow") {
      const [[startX, startY], [endX, endY]] = linePts(s2);
      const [x, y] = fns.center(s1);

      const r = div(s1.side.contents, constOf(2.0));
      const f = constOf(0.75); // 0.25 padding
      //     (lx, ly) = ((x - side / 2) * 0.75, (y - side / 2) * 0.75)
      //     (rx, ry) = ((x + side / 2) * 0.75, (y + side / 2) * 0.75)
      // in inRange startX lx rx + inRange startY ly ry + inRange endX lx rx +
      //    inRange endY ly ry
      const [lx, ly] = [mul(sub(x, r), f), mul(sub(y, r), f)];
      const [rx, ry] = [mul(add(x, r), f), mul(add(y, r), f)];
      return addN([
        constrDict.inRange(startX, lx, rx),
        constrDict.inRange(startY, ly, ry),
        constrDict.inRange(endX, lx, rx),
        constrDict.inRange(endY, ly, ry),
      ]);
    } else throw new Error(`${[t1, t2]} not supported for contains`);
  },

  /** 
  * Require that a shape `s1` is disjoint from shape `s2`, based on the type of the shape, and with an optional `offset` between them (e.g. if `s1` should be disjoint from `s2` with margin `offset`).
  */
  disjoint: (
    [t1, s1]: [string, any],
    [t2, s2]: [string, any],
    offset = 5.0
  ) => {
    if (t1 === "Circle" && t2 === "Circle") {
      const d = ops.vdist(fns.center(s1), fns.center(s2));
      const o = [s1.r.contents, s2.r.contents, varOf(10.0)];
      return sub(addN(o), d);
    } else if (typesAre([t1, t2], ["Text", "Line"])) {
      const [text, seg] = [s1, s2];
      const centerT = fns.center(text);
      const endpts = linePts(seg);
      const cp = closestPt_PtSeg(centerT, endpts);
      const lenApprox = div(text.w.contents, constOf(2.0));
      return sub(add(lenApprox, constOfIf(offset)), ops.vdist(centerT, cp));
    } else throw new Error(`${[t1, t2]} not supported for disjoint`);
  },

  /** 
  * Require that shape `s1` is smaller than `s2` with some offset `offset`.
  */
  smallerThan: ([t1, s1]: [string, any], [t2, s2]: [string, any]) => {

     if(t1 === "Circle" && t2 === "Circle") {
        // s1 is smaller than s2
        const offset = mul(varOf(0.4), s2.r.contents);
        return sub(sub(s1.r.contents, s2.r.contents), offset);
     } else throw new Error(`${[t1, t2]} not supported for smallerThan`);
  },

  lessThan: (x: VarAD, y: VarAD) => {
     return squared(sub(x, y));
  },

  equalTo: (x: VarAD, y: VarAD) => {
     return absVal(sub(x, y));
  },

  /** 
  * Require that shape `s1` outside of `s2` with some offset `padding`.
  */
  outsideOf: (
    [t1, s1]: [string, any],
    [t2, s2]: [string, any],
    padding = 10
  ) => {
    if (t1 === "Text" && t2 === "Circle") {
      const textR = max(s1.w.contents, s1.h.contents);
      const d = ops.vdist(fns.center(s1), fns.center(s2));
      return sub(add(add(s2.r.contents, textR), constOfIf(padding)), d);
    } else throw new Error(`${[t1, t2]} not supported for outsideOf`);
  },

  /** 
  * Require that shape `s1` overlaps shape `s2` with some offset `padding`.
  */
  overlapping: (
    [t1, s1]: [string, any],
    [t2, s2]: [string, any],
    padding = 10
  ) => {
    if (t1 === "Circle" && t2 === "Circle") {
      return looseIntersect(
        fns.center(s1),
        s1.r.contents,
        fns.center(s2),
        s2.r.contents,
        constOfIf(padding)
      );
    } else throw new Error(`${[t1, t2]} not supported for overlapping`);
  },

  /** 
  * Require that shape `s1` is tangent to shape `s2`.
  */
  tangentTo: (
    [t1, s1]: [string, any],
    [t2, s2]: [string, any]
  ) => {
    if (t1 === "Circle" && t2 === "Circle") {
      const d = ops.vdist(fns.center(s1), fns.center(s2));
      const r1 = s1.r.contents;
      const r2 = s2.r.contents;
      // Since we want equality
      return absVal(sub(d, sub(r1, r2)));
    } else throw new Error(`${[t1, t2]} not supported for tangentTo`);
  },

  orthogonalCircles: (
    [t1, s1]: [string, any],
    [t2, s2]: [string, any]
  ) => {
    if (t1 === "Circle" && t2 === "Circle") {
       // Two circles of radii r1,r2 at a distance d will be
       // orthogonal iff d^2 = r1^2 + r2^2.
      const d2 = ops.vdistsq(fns.center(s1), fns.center(s2));
      const r1 = s1.r.contents;
      const r2 = s2.r.contents;
      const r12 = squared(r1);
      const r22 = squared(r2);
      const e = sub(d2,add(r12,r22));
      return absVal(e);
    } else throw new Error(`${[t1, t2]} not supported for orthogonalCircles`);
  },

  /** 
  * Require that label `s2` is at a distance of `offset` from a point-like shape `s1`.
  */
  atDist: ([t1, s1]: [string, any], [t2, s2]: [string, any], offset: VarAD) => {
    // TODO: Account for the size/radius of the initial point, rather than just the center

    if (t2 === "Text") {
      let pt;
      if (t1 === "Arrow") {
        // Position label close to the arrow's end
        pt = { x: s1.end.contents[0], y: s1.end.contents[1] };
      } else {
        // Only assume shape1 has a center
        pt = { x: s1.center.contents[0], y: s1.center.contents[1] };
      }

      // Get polygon of text (box)
      // TODO: Make this a GPI property
      // TODO: Do this properly; Port the matrix stuff in `textPolygonFn` / `textPolygonFn2` in Shapes.hs
      // I wrote a version simplified to work for rectangles

      const text = s2;
      // TODO: Simplify this code since I don't actually use `textPts`
      const halfWidth = div(text.w.contents, constOf(2.0));
      const halfHeight = div(text.h.contents, constOf(2.0));
      const nhalfWidth = neg(halfWidth);
      const nhalfHeight = neg(halfHeight);
      const textCenter = fns.center(text);
      // CCW: TR, TL, BL, BR
      const textPts = [
        [halfWidth, halfHeight],
        [nhalfWidth, halfHeight],
        [nhalfWidth, nhalfHeight],
        [halfWidth, nhalfHeight],
      ].map((p) => ops.vadd(textCenter, p));

      const rect = {
        minX: textPts[1][0],
        maxX: textPts[0][0],
        minY: textPts[2][1],
        maxY: textPts[0][1],
      };

      // TODO: Rewrite this with `ifCond`
      // If the point is inside the box, push it outside w/ `noIntersect`
      if (pointInBox(pt, rect)) {
        return noIntersect(
          textCenter,
          text.w.contents,
          fns.center(s1),
          constOf(2.0)
        );
      } else {
        // If the point is outside the box, try to get the distance from the point to equal the desired distance
        const dsqRes = dsqBP(pt, rect);
        const WEIGHT = 1;
        return mul(constOf(WEIGHT), equalHard(dsqRes, squared(offset)));
      }
    } else {
      throw Error(`unsupported shapes for 'atDist': ${t1}, ${t2}`);
    }
  },

  /** 
  * Require that the vector defined by `(q, p)` is perpendicular from the vector defined by `(r, p)`.
  */
  perpendicular: (q: VarAD[], p: VarAD[], r: VarAD[]): VarAD => {
    const v1 = ops.vsub(q, p);
    const v2 = ops.vsub(r, p);
    const dotProd = ops.vdot(v1, v2);
    return equalHard(dotProd, constOf(0.0));
  },

  /** 
  * Require that the value `x` is in the range defined by `[x0, x1]`.
  */
  inRange: (x: VarAD, x0: VarAD, x1: VarAD) => {
    return mul(sub(x, x0), sub(x, x1));
  },
};

// -------- Helpers for writing objectives

/** 
* Check that the `inputs` list equals the `expected` list.
*/
const typesAre = (inputs: string[], expected: string[]): boolean =>
  inputs.length === expected.length &&
  _.every(_.zip(inputs, expected).map(([i, e]) => i === e));

// -------- (Hidden) helpers for objective/constraints/computations

/** 
* Require that `x` equals `y`.
*/
const equalHard = (x: VarAD, y: VarAD) => {
  // This is an equality constraint (x = c) via two inequality constraints (x <= c and x >= c)
  const valMax = max(x, y);
  const valMin = min(x, y);
  // TODO: I guess you could also use an absolute value?
  return sub(valMax, valMin);
};

/** 
* Require that a shape at `center1` with radius `r1` not intersect a shape at `center2` with radius `r2`.
*/
const noIntersect = (
  center1: VarAD[],
  r1: VarAD,
  center2: VarAD[],
  r2: VarAD,
  padding = 10
): VarAD => {
  // noIntersect [[x1, y1, s1], [x2, y2, s2]] = - dist (x1, y1) (x2, y2) + (s1 + s2 + 10)
  const res = add(add(r1, r2), constOfIf(padding));
  return sub(res, ops.vdist(center1, center2));
};

/** 
* Require that a shape at `center1` with radius `r1` intersect a shape at `center2` with radius `r2`, with overlap amount `padding`.
*/
const looseIntersect = (
  center1: VarAD[],
  r1: VarAD,
  center2: VarAD[],
  r2: VarAD,
  padding: VarAD
): VarAD => {
  // looseIntersect [[x1, y1, s1], [x2, y2, s2]] = dist (x1, y1) (x2, y2) - (s1 + s2 - 10)
  const res = sub(add(r1, r2), padding);
  return sub(ops.vdist(center1, center2), res);
};

/** 
* Encourage that an arrow `arr` be centered between two shapes with centers `center1` and `center2`, and text size (?) `[o1, o2]`.
*/
const centerArrow2 = (
  arr: any,
  center1: VarAD[],
  center2: VarAD[],
  [o1, o2]: VarAD[]
): VarAD => {
  const vec = ops.vsub(center2, center1); // direction the arrow should point to
  const dir = ops.vunit(vec);

  let start = center1;
  let end = center2;

  // TODO: take in spacing, use the right text dimension/distance?, note on arrow directionality

  // TODO: add abs
  if (gt(ops.vnorm(vec), add(o1, absVal(o2)))) {
    start = ops.vadd(center1, ops.vmul(o1, dir));
    end = ops.vadd(center2, ops.vmul(o2, dir));
  }

  const fromPt = arr.start.contents;
  const toPt = arr.end.contents;

  return add(ops.vdistsq(fromPt, start), ops.vdistsq(toPt, end));
};

/** 
* Repel a vector `a` from a vector `b` with weight `c`.
*/
const repelPt = (c: VarAD, a: VarAD[], b: VarAD[]) =>
  div(c, add(ops.vdistsq(a, b), constOf(EPS_DENOM)));

// ------- Polygon-related helpers

/** 
* Return true iff `p` is in rect `b`, assuming `rect` is an axis-aligned bounding box (AABB) with properties `minX, maxX, minY, maxY`.
*/
const pointInBox = (p: any, rect: any): boolean => {
  return (
    p.x > rect.minX && p.x < rect.maxX && p.y > rect.minY && p.y < rect.maxY
  );
};

/** 
* Assuming `rect` is an axis-aligned bounding box (AABB),
* compute the positive distance squared from point `p` to box `rect` (not the signed distance).
* https://stackoverflow.com/questions/5254838/calculating-distance-between-a-point-and-a-rectangular-box-nearest-point
*/
const dsqBP = (p: any, rect: any): VarAD => {
  const dx = max(max(sub(rect.minX, p.x), constOf(0.0)), sub(p.x, rect.maxX));
  const dy = max(max(sub(rect.minY, p.y), constOf(0.0)), sub(p.y, rect.maxY));
  return add(squared(dx), squared(dy));
};

/** 
* Linearly interpolate between left `l` and right `r` endpoints, at fraction `k` of interpolation.
*/
const lerp = (l: VarAD, r: VarAD, k: VarAD): VarAD => {
  // TODO: Rewrite the lerp code to be more concise
  return add(mul(l, sub(constOf(1.0), k)), mul(r, k));
};

/** 
* Linearly interpolate between vector `l` and vector `r` endpoints, at fraction `k` of interpolation.
*/
const lerp2 = (l: VarAD[], r: VarAD[], k: VarAD): [VarAD, VarAD] => {
  return [lerp(l[0], r[0], k), lerp(l[1], r[1], k)];
};

/** 
* Sample a line `line` at `NUM_SAMPLES` points uniformly.
*/
const sampleSeg = (line: VarAD[][]) => {
  const NUM_SAMPLES = 15;
  const NUM_SAMPLES2 = constOf(1 + NUM_SAMPLES);
  // TODO: Check that this covers the whole line, i.e. no off-by-one error
  const samples = _.range(1 + NUM_SAMPLES).map((i) => {
    const k = div(constOf(i), NUM_SAMPLES2);
    return lerp2(line[0], line[1], k);
  });

  return samples;
};

/** 
* Return the closest point on segment `[start, end]` to point `pt`.
*/
const closestPt_PtSeg = (pt: VarAD[], [start, end]: VarAD[][]): VarAD[] => {
  const EPS0 = varOf(10e-3);
  const lensq = max(ops.vdistsq(start, end), EPS0); // Avoid a divide-by-0 if the line is too small

  // If line seg looks like a point, the calculation just returns (something close to) `v`
  const dir = ops.vsub(end, start);
  // t = ((p -: v) `dotv` dir) / lensq -- project vector onto line seg and normalize
  const t = div(
    ops.vdot(ops.vsub(pt, start), dir),
    add(lensq, constOf(EPS_DENOM))
  );
  const t1 = clamp([0.0, 1.0], t);

  // v +: (t' *: dir) -- walk along vector of line seg
  return ops.vadd(start, ops.vmul(t1, dir));
};

/** 
* Clamp `x` in range `[l, r]`.
*/
const clamp = ([l, r]: number[], x: VarAD): VarAD => {
  return max(constOf(l), min(constOf(r), x));
};
