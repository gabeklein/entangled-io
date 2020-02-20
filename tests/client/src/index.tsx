import React, { useState } from "react"
import ReactDOM from "react-dom"

import API from "@entangled/service";

window.onload = async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  ReactDOM.render(<App/>, container)
}

const App = () => {
  const [text, setText] = useState("Click here to hit server!")

  return (
    <div onClick={async () => {
      const response = await API.echo("Echo!! Echo!!");
      setText(response);
    }}>
      {text}
    </div>
  )
}