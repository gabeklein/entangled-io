declare const __webpack_require__: any;

__webpack_require__.i.push((options: any) => {
  const { module, id } = options;

  console.log(`Loaded module: ${id}`);
  
  if(module.hot)
    module.hot.accept();
})