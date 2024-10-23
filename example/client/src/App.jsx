import React from 'react'
import Model from "@expressive/react"

import { Greetings } from '@example/api'

class Control extends Model {
  response = "";
  
  async fetch(){
    this.response = await Greetings.hello('World')
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

  <this>
    {response ? (
      <hello>{response}</hello>
    ) : (
      <hello onClick={fetch}>
        Hello World!!
      </hello>
    )}
  </this>
}

export default App;