
<h1 align="center">Engangled ⇝ IO</h1>

<p align="center">Spooky <code>action()</code> at a distance. 🧙‍♂️</p>

<br/>

> Documentation is a work in process; more to come soon!

<br/>

<p align="center">Entangled-IO is a set of developer tools, designed to bridge the gap between client and server applications written in typescript. With simple helpers on the backend, and webpack-plugin on the front, you can effectively call server-side functions as if they were local within your consumer apps.</p>
<br/>

## Installation

For a server application using express.
```
npm install @entangled/express
npm link
```

For a client application using webpack.
```
npm install @entangled/webpack
npm link my-service
```

<br/>

## Abstract

Entangled, when paired in a client and server app using typescript, fully abstracts matters of transport. At build time, it will generate for you paired resources and http-adaptors, following a map of gathered up business-logic functions you define.

For linked projects, this helps webpack scan a front-end build for what would otherwise be [illegal imports](https://i.kym-cdn.com/entries/icons/original/000/028/207/Screen_Shot_2019-01-17_at_4.22.43_PM.jpg) (as they can't actually be bundled). In their place, the entangled runtime fetches from an endpoint, REST resources which proxy the real functions being invoked. 

This makes server interop essencially free; imported as just a collection of async functions!

#### TL;DR

- Call remote functions as if directly from the client
- Skip explicitly writing REST handlers for your services
- Access resources using direct async functions, not requests
- Avoid packing and unpacking potentially complex data
  > Arguments and returned data are serialized and reassembed for you on both sides, so even deeply nested objects and arrays are safe and easy to send and recieve. <br/>
- Special objects don't need special handling
  > Transmitting `Date` objects traditionally for instance, is pretty tedius, but here it's automatic. <br/>
  > No more `let d = date && new Date(date);` nonsense. <br/>
  > `Map` & `Set` are also in the works; arbitary class types too eventually.
- **Type signatures are preserved!** 
  > Because you simply "import" actual server functions, your IDE remains aware of their signature, and so covered are the typical blind-spots for autocomplete and error detection.
- Errors thrown by the server (in development) are merged with ones thrown on the client
  > Sometimes, it can be inconvenient or even impossible to inspect console output from where your functions are running, such as within a container or serverless environment. This make it a non-issue via a shared stack-trace.

<br/>

Taking a wholistic approach, you can focus more on the business logic of your stack,  over the communication layer. <br/> This way, both can grow quickly and organically with little in the way of debugging or type maintainance.

<br/>

## Setup

It takes very little to get up and running. Start by linking your node app (using preference of [NPM](https://www.deadcoderising.com/how-to-smoothly-develop-node-modules-locally-using-npm-link/) or [Yarn](https://classic.yarnpkg.com/en/docs/cli/link/)) to client apps. A good practice is to add it as a dev-dependancy as well. 

> [Lerna](https://github.com/lerna/lerna) and/or [yarn-workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) can be used to accomplish the same thing if you're into monorepos!
> 
> However, while optional, configuring server modules with a [Typescript project reference](https://www.typescriptlang.org/docs/handbook/project-references.html) is a good idea. It causes your IDE to consider the `src/` of your project for types, rather than generated `d.ts` files. This can greatly enhanse the responsiveness of your type-checker, and assist with procedures (such as `Rename Symbol`).

**Remember**: *Declarations still are required* for both the development and production builds of any server module used.

<br/>

<h2>Hello World &nbsp;<sup>(In 5 easy steps)</sup></h2>

The following is pretty much all you'll need to implement a simple round trip between node and a browser application.

<br/>

<b>1.</b> &nbsp; Let's make a sever which can say hi.  🤖✌️

> `my-service/index.ts`

```typescript
/* First import a helper for whatever platform you're already using. */

import Interface from '@entangled/express';

/* Define functions to do or return whatever you like. */

async function sayHi(name = "World"){
  return `Hello ${name}!`
}

/* Create an interface with a map of functions you wish to expose.
   You can organize them too, into routes, via nesting! */

const api = new Interface({ sayHi });

/* Launch the resulting interface as an endpoint for runtime.
   Here, `listen` will create an Express instance for you (and route to "/")
   You can spread into an existing express app if you want to though! */

api.listen(8080); 

/* Most importantly, export the attached namespace for consumer projects to access! */

export = api; 
```

<br/>

<b>2.</b> &nbsp; On to the client; add your service as a **dev-dependancy** and remember to link it!

> `my-app/package.json`

```json
{
  "name": "my-app",
  "devDependancies": {
    "my-service": "0.0.0"
  }
}
```

<br/>

<b>3.</b> &nbsp; Add the entangled replacement-plugin to webpack; passing in the name of any modules exporting an Interface.<br/>

> `my-app/webpack.config.js`

```js
const { EnvironmentPlugin } = require("webpack");
const ApiReplacementPlugin = require("@entangled/webpack");

module.exports = {
  plugins: [
    new ApiReplacementPlugin(["my-service"]),
    new EnvironmentPlugin({ ENDPOINT: "http://localhost:8080/" })
  ]
}
```

<blockquote>By default, your endpoint's <i>protocol</i>, <i>domain</i>, <i>port</i>, and <i>root</i> are derived from var <code>ENDPOINT</code>, defined on env.<br/> 
Use <code><a href="https://webpack.js.org/plugins/environment-plugin/">EnvironmentPlugin</a></code> to inject that into your build as well. (We provide a default value too, in this example.)</blockquote>

<br/>

<b>4.</b> &nbsp; You now have everything you need, to run server functions on the client! Just import away. ✨

> `my-app/demo.jsx`

```tsx
/* Import the servce module and interface we've made there. */

import API from "my-service"

async function sayHello(event){
  const name = prompt("What is your name?", "World");

  /* Call and await a remote-function like you would any other thenable!
     It will fetch the corresponding resource (invoking your function) under the hood. */

  let response = await API.sayHi(name);

  /* Oh, and you might notice we still have type inference, even in non-ts files! 😍 */

  event.currentTarget.innerText = `Server said ${response}`;

  /* Enjoy your day ☕️ */
}

export default () => (
  <div onClick={sayHello}>
    Click me to say hi to the server!
  </div>
)
```

> Note: [`esModuleInterop`](https://stackoverflow.com/a/56348146) is set to true for this module, which substitues `*` for `default`. <br/> You might want to destructure your functions/routes instead however, which should be the norm for larger APIs anyway.

<br/>

<b>5.</b> &nbsp;  Host and Click. "*Server said Hello Moto*" 😎

<br/>

## Why does this work?

At runtime, having crawled the functions you provided, `@entangled/express` defines the route: <br>
`POST //0.0.0.0:8080/sayhi` on whatever backend you set up.

At the same time in your browser app, a copy of `@entangled/client` replaces `my-service` via webpack, but tweaked to export as follows:
```ts
{ sayHi: (name?: string) => Promise<string> }
```

> This will always mirror the `Interface` exported by you. 

When called, the runtime goes to work to bundle and send your arguments (if there are any) to a route expected to match your function.

If all goes well, your backend receives the request, to then reformat and `apply` to a real function. <br/> 
Much the same occures for the response, and *voila* the client's promise resolves the actual returned value! 

And all of your glue-code: `⤵`<br/> 
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;🗑

<br/>

## Packages

### `@entangled/webpack`

> This plugin lets webpack consume some dependancy (better put, a devDependancy) as a remote module. Webpack wil scan that import for it type definitions (`d.ts` files). An adaptor is then injected to replace those exported function with `fetch` calls, all to paths corresponding to the original.

### `@entangled/fetch`

> A client adaptor for your browser apps. Webpack relies on this for serialization and to inteface with the real endpoint serving your functions for actual use.

### `@entangled/interface`

> Webpack and the server adaptor rely on this to discover and parse `d.ts` files in order to properly mirror your IO. It tries to be aware of your actual arguments' types for purposes of conversion and error detection (coming soon). This is also, most-importantly responsible for conveying TS bindings to consumers properly.

### `@entangled/express`

> Consuming an arbitarily deep map of functions, this plugin (specifically for express apps) will expose all given as live-resources for consumer adaptors to bind to at runtime.


<br/>

## Try it out! 

> Provided is an exmaple you can try out for yourself!

```
git clone git@github.com:gabeklein/entangled-io.git
cd entangled-io
npm install
npm run example
```

> This will launch both a server (on port 8080) and dev-server (port 80) for the client, demoing a simple interaction you can play with!

<br/>

## License

MIT

<br/>

## Contributions

PR's are welcome, or email me if you want to be more involved, I'd love to have help!

<br/>
