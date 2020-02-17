import React, { useState } from "react"
import ReactDOM from "react-dom"

import { echo } from "@entangled/service";

window.onload = async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  ReactDOM.render(<App/>, container)
}

const App = () => {
  const [text, setText] = useState("Click here to hit server!")

  return (
    <div onClick={async () => {
      const response = await echo("Echo!! Echo!!");
      setText(response);
    }}>
      {text}
    </div>
  )
}