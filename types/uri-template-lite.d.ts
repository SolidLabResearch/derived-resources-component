declare module 'uri-template-lite' {
  export function expand(template: string, data: { [key: string]: unknown }): string;

  export default class Template {
    constructor(template: string);
    expand: (data: { [key: string]: unknown }) => string;
    match: (template: string) => { [key: string]: string };
  }
}
