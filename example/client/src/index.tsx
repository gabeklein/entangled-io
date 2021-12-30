import React, { useState } from "react"
import ReactDOM from "react-dom"

import API from "@entangled/service";

const App = () => {
  const [text, setText] = useState("Click here to hit server!")

  async function onClick(){
    const response = await API.Greetings.hi();
    setText(response);
  }

  return (
    <div onClick={onClick}>
      {text}
    </div>
  )
}

window.onload = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  ReactDOM.render(<App/>, container)
}