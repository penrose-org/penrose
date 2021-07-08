import { IVarAD } from "../types/ad";
import { Shape } from "../types/shape";
import { State } from "../types/state";
import { FieldExpr } from "../types/value";

export const getListOfStagedStates = (state: State): State[] => {
  // encodes the order in which the user defines GPIs in substance
  // as obj properties
  const trMap = state.translation.trMap;

  // turn trMap's properties into a list
  var objArr = Object.entries(trMap);

  objArr = objArr.filter(hasGPIProperties);

  // each element in listOfStagedObjArrs is a list of objs to draw
  // in a panel in the comic
  // ex. for a final diagram with objects A,B,C
  // listOfStagedObjArrs = [[A], [A,B], [A,B,C]]
  var listOfStagedObjArrs = objArr.map(tabulateObjArrs);

  const newState = state;

  const getStateFromObjArr = (arr: StringObjPair[]) => {
    return getStateFromObjArrAndLocalState(arr, newState);
  };

  // map each object array to a state (modify the shapelist of the og state)
  var listOfStagedStates = listOfStagedObjArrs.map(getStateFromObjArr);

  return listOfStagedStates;
};

// cannot use-- see tree.sty for an example, where
// anonymous elements like IsSubset have FGPI (arrows) assoc. w/ them
// if you filter these elements out, the arrows will not be drawn
const areLocallyDefined = (elem: any) => {
  return !elem[0].includes("$LOCAL");
};

// determines if an object has any GPI tagged properties
const hasGPIProperties = (elem: any) => {
  const arr = elem[1];

  const objArr: [string, any][] = Object.entries(arr);

  const hasGPIAsTag = (object: any) => {
    return object[1].tag === "FGPI";
  };

  return (
    objArr.filter((elem) => {
      return hasGPIAsTag(elem);
    }).length !== 0
  );
};

// local typedef for ease of typing expressions
type StringObjPair = [string, { [k: string]: FieldExpr<IVarAD> }];

// used to make list of objects for each "comic panel"
// used as the fn for .map
const tabulateObjArrs = (
  objArr: StringObjPair,
  index: number,
  arr: StringObjPair[]
): StringObjPair[] => {
  return arr.slice(0, index + 1);
};

// returns a modified state RES, where only shapes
// that belong to objects in arr are kept in RES.shape (the state's shapelist)
const getStateFromObjArrAndLocalState = (
  arr: StringObjPair[],
  state: State
): State => {
  var testArrNames = arr.map((elem) => {
    return elem[0];
  });

  // make a newState (replace list of shapes)
  var newShapeList: Shape[] = [];

  for (var i = 0; i < state.shapes.length; i++) {
    var shap = state.shapes[i];
    var shapPropPathName = shap.properties.name.contents as string;
    const dotIndex = shapPropPathName.indexOf(".");
    if (dotIndex === -1) {
      throw new Error("shape property doesn't have a .");
    }
    var shapName = shapPropPathName.slice(0, dotIndex);

    if (testArrNames.includes(shapName)) {
      newShapeList.push(shap);
    }
  }
  // to be cleaner, i should technically update shapeOrdering as well
  // but not modifying that doesn't seem to affect the creation of the SVG

  // shallow copy, otherwise weird aliasing issues
  var newState = { ...state };

  newState.shapes = newShapeList;

  return newState;
};
