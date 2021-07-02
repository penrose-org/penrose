import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./App";
import "./index.css";

ReactDOM.render(<App />, document.getElementById("root") as HTMLElement);

if (process.env.NODE_ENV !== "production") {
  localStorage.setItem("debug", "renderer:*,ide:*");
}

export default App;
