import {
  useCenter,
  useFill,
  useRadius,
  useStroke,
  useTitle,
} from "./AttrHelper";

const Circle = (shape: IShape, canvasSize: [number, number]) => {
  const { properties } = shape;

  const elem = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  useFill(shape, elem);
  useCenter(shape, canvasSize, elem);
  useRadius(shape, elem);
  useStroke(shape, elem);
  useTitle(shape, elem);

  return elem;
};
export default Circle;
