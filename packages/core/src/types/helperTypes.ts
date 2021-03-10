import { StyleError } from "./errors";

export interface Nothing<T> {
  tag: "Nothing";
}

export interface Just<T> {
  tag: "Just";
  contents: T;
}

export type MaybeVal<T> = Nothing<T> | Just<T>;

export type StyleErrors = StyleError[];
// TODO: Convert this to StyleError[]

export interface Left<A> {
  tag: "Left";
  contents: A;
}

export interface Right<B> {
  tag: "Right";
  contents: B;
}

export type Either<A, B> = Left<A> | Right<B>;
