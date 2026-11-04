/// <reference types="vite/client" />
declare module "virtual:guidelines" {
  const guidelines: import("./types").Guideline[];
  export default guidelines;
}
