import { Greetings } from '@example/api';
import Model from '@expressive/react';

import { Button, Container } from './components';

class Control extends Model {
  response = "";
  
  async fetch(){
    this.response = await Greetings.hi()
  }
}

export const App = () => {
  const { fetch, response } = Control.use();

  return (
    <Container>
      {response ? `Server said: ${response}` : (
        <Button onClick={fetch}>
          Say Hello
        </Button>
      )}
    </Container>
  )
}

export default App;