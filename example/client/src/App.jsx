import React from 'react'
import Model from "@expressive/react"

import { Greetings } from '@example/api'

class Control extends Model {
  response = "";
  
  async fetch(){
    this.response = await Greetings.hi('World')
  }
}

/** @type {React.FC} */
export const App = () => {
  const { fetch, response } = Control.use()

  height: vh(100);
  boxSizing: border-box;
  flexAlign: center;
  fontSize: 30;
  padding: 10;
  overflow: hidden;

  hello: {
    color: 0x333;    
  }

  button: {
    padding: 12, 20;
    fontSize: 20;
    borderRadius: 5;
    backgroundColor: 0xddd;
    border: 0xb8b8b8;
    color: 0x444;
    cursor: pointer
  }

  <this>
    {response ? (
      <hello>Server said: {response}</hello>
    ) : (
      <button onClick={fetch}>
        Say Hello
      </button>
    )}
  </this>
}

export default App;