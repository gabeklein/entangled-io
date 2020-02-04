import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";

import { greetings } from "@entangled/test-service"

window.onload = () => {
  ReactDOM.render(
    <App />, 
    document.body
  )
}

const App = () => {
  const [fill, setFill] = useState("Hello ???");

  useEffect(() => {
    void setFill
    greetings.hi()//.then(x => setFill(x))
  }, [])

  return <div>{fill}</div>
}