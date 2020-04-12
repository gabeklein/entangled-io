<br/>
<h1 align="center">Engangled ⇝ IO</h1>

<p align="center">Spooky <code>action()</code> at a distance. 🧙‍♂️</p>

<br/>

> Documentation is a work in process; more to come soon!

<br/>

<p align="center">Entangled-IO is a set of developer tools designed to bridge the gap between a client and server applications written in typescript. With a simple helper on the backend, and webpack-plugin on the front, you can effectively call server-side functions as if they were locally defined within your apps in the field.</p>

<br/>

## Installation

> For your server application, using express.
```
npm install @entangled/express
npm link
```

> For your client application, using webpack.
```
npm install @entangled/webpack
npm link my-service
```

<br/>

## The basics

Entangled when paired in a client and server app, using typescript, allows you to mostly ignore transport. At build time, *entangled* will generate matching resources and adaptors, following a simple map of functions you define along side your server's logic. 

This is uses webpack to scan your build for usages of what would otherwise be [illegal imports](https://i.kym-cdn.com/entries/icons/original/000/028/207/Screen_Shot_2019-01-17_at_4.22.43_PM.jpg), as they wouldn't really exist at runtime. Instead, similar to [externals](https://webpack.js.org/configuration/externals/), your app will know to fetch from an endpoint, resources which proxy your actual functions. 

*This makes interop essencially free.*  

### TL;DR

- You don't need to define resources, this is automagic.
- You don't need to consume resources, this is also automagic.
- You don't need to pack or unpack complex data; yep it's automagic.
  > Arguments and returned data are serialized and reassembed for you on both sides, so even deeply nested objects and arrays are welcome. <br/>
- Special objects do not need to be stringified either. Handing off `Date` for instance has always been super tedius, but here it's handled and efficiently too. <br/> Finally, `date && new Date(date)` can go the way of the dodo.
  > `Map` & `Set` are in the works, arbitary class types too eventually.
- **Type signatures are preserved!** Because you're "importing" server functions, your IDE remains aware of interfaces, so autocomplete and error checking won't have blind-spots. 😭
- Errors thrown by the server (during development) are added to the stack trace, consequently thrown on client-side. 
  > Sometimes, it can be inconvenient or even impossible to inspect console output from where your functions are actually running, such as in a container or part of a cluster. This helps make that a non-issue. <sub>&nbsp;(It's unstable, but I'm working on it!)</sub>

Ultimately, this lets you focus on the business logic of your app, rather than the api. <br/> That way, it can grow swiftly and organically with little in the way of debugging over type inconsistencies.

<br/>

## Usage

It takes very little to get up and running, start by linking your node-app using [NPM](https://www.deadcoderising.com/how-to-smoothly-develop-node-modules-locally-using-npm-link/) or [Yarn](https://classic.yarnpkg.com/en/docs/cli/link/) to your clients. A good practice is to list it as a dev-dependancy as well. 

> [Lerna](https://github.com/lerna/lerna) and/or [yarn-workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) can also be used to accomplish the same thing if you're into monorepos!
> 
> However, while not necessary, configuring the server modules with a [Typescript project reference](https://www.typescriptlang.org/docs/handbook/project-references.html) is also a good idea. It causes your IDE's language-server to consider the actual `src/` of your project for types, rather than the `d.ts` files generated by a build. This can greatly enhanse the responsiveness of type-checker, and assist in procedures (such as `Rename Symbol`).

***Remember**: Declarations though are required for both development and production builds of any used server module.*

<br/>

## A simple example

> `my-service/index.ts`

There are better ways to structure your app, but let's cram everything into just one file for now.

```typescript
/* Import an appropriate helper for whatever platform you are using. */

import Interface from '@entangled/express';

/* Define some functions to do or return whatever you like. */

async function sayHi(name = "World"){
  return `Hello ${name}!`
}

/* Define resources via a map (object) of your functions;
   you can organize them too, into routes, via nesting! */

const api = new Interface({ sayHi });

/* Launch the resulting interface as an endpoint for runtime.
   Here, `listen` will create an Express instance for you (and route to "/")
   You can also spread it into an existing express app, if you want, though! */

api.listen(8080); 

/* Finally, expose the interface for consumers to easily import. */

export = api; 
```

<br/>

Next step is to add the replacement-plugin to your webpack config and pass the module defining your API.

> `my-app/webpack.config.js`

```js
const ResourceReplacementPlugin = require("@entangled/webpack");

module.exports = {
  plugins: [
    new ResourceReplacementPlugin(["my-service"])
  ]
}
```

<br/>

> `my-app/app.tsx`

```tsx
/* Import your server-module and interface we've established there. */

import API from "my-service"

async function sayHello(e: MouseEvent){
  const name = prompt("What is your name?", "World");

  /* Simply call and await the remote-function like you would any other thenable!
     It will fetch the corresponding resource (invoking your function) under the hood. */

  let response = await API.sayHi(name);

  /* Oh, and you might notice you still have type inference, even in .js files! 😍 */

  e.currentTarget.innerText = `Server said: ${response}`;

  /* Enjoy your day ☕️ */
}

export default () => (
  <div onClick={sayHello}>
    Click me to say hi to the server!
  </div>
)
```
<br/>

> Note that [`esModuleInterop`](https://stackoverflow.com/a/56348146) is set to `true` for this module here, which substitues `*` for `default`. <br/> You might want to destructure your functions/routes instead, which should be the norm for larger API's.

### Explaination

This worksbecause,  having crawled your provided functions, `@entangled/express` here defines the route: <br>
`POST //host:8080/sayhi`

At the same time, a copy of `@entangled/client` is injected to replace `my-service`, exporting `API` itself containing
```ts
{ sayHi: (name?: string) => Promise<string> }
```

When called, the runtime goes to work to bundle and send your arguments (if any) to the matching resource.

If all goes well, Express receives the request, to parse and forward to your original function. <br/> 
The inverse occures for the response, and *voila* the client's promise resolves the returned value!

And all of your glue-code? 👋`⤵`<br/> 
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;🗑

<br/>

## Packages

### `@entangled/webpack`

> This plugin lets webpack consume some dependancy (better put, a devDependancy) as a remote module. Webpack wil scan that import for type definitions `d.ts` of your server module. An adaptor is then injected which will replace those exports using `fetch` calls, all to resources corresponding to those functions.

### `@entangled/fetch`

> A client adaptor for your browser apps. Webpack relies on this for serialization and to plug-in to the real endpoint exposing your exported functions for use.

### `@entangled/interface`

> Webpack and the server adaptor relies on this to discover and parse `d.ts` files in order to properly mirror your IO. It tries to be aware of your actual arguments' types for purposes of conversion and error detection (coming soon). This is also most-importantly responsible for conveying TS bindings to consumers properly.

### `@entangled/express`

> Consuming an arbitarily deep map of functions, this plugin (specifically for express apps) will expose those functions as an endpoint for the client-adaptor to bind to at run-time.


<br/>

## Try it out! 

> Provided is an exmaple you can try this out for yourself!

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

<sub>plz.</sub>
