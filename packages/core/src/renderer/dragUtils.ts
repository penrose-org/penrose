import { updateVaryingValues } from "engine/PropagateUpdate";
import { Properties, Shape } from "types/shape";
import { State } from "types/state";
import { findDef, positionalProps } from "./ShapeDef";

/**
 * Retrieve data from drag events and update varying state accordingly
 */
export const dragUpdate = (
  state: State,
  id: string,
  dx: number,
  dy: number
): State => {
  const dragged: State = {
    ...state,
    params: { ...state.params, optStatus: "NewIter" },
    shapes: state.shapes.map(({ shapeType, properties }: Shape) => {
      if (properties.name.contents === id) {
        return dragShape({ shapeType, properties }, [dx, dy]);
      }
      return { shapeType, properties };
    }),
  };
  const updatedWithVaryingState = updateVaryingValues(dragged);
  return updatedWithVaryingState;
};

const dragShape = (shape: Shape, offset: [number, number]): Shape => {
  const { shapeType, properties } = shape;
  const propsToMove = positionalProps(shapeType);
  if (propsToMove) {
    return {
      ...shape,
      properties: moveProperties(properties, propsToMove, offset),
    };
  } else {
    console.log("Path drag unimplemented", shape); // Just to prevent crashing on accidental drag
    return shape;
  }
};

/**
 * For each of the specified properties listed in `propPairs`, subtract a number from the original value.
 */
const moveProperties = (
  properties: Properties,
  propsToMove: string[],
  [dx, dy]: [number, number]
): Properties => {
  const moveProperty = (props: Properties, propertyID: string) => {
    // TODO: deal with vectors, list of vectors, and perhaps curve data
    const [x, y] = props[propertyID].contents as [number, number];
    props[propertyID].contents = [x + dx, y + dy];
    return props;
  };
  return propsToMove.reduce(moveProperty, properties);
};
