const NS = 'http://www.w3.org/2000/svg';

type Attrs = Record<string, string | number>;

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent?.appendChild(el);
  return el;
}

export const fmt = (n: number) => Math.round(n * 100) / 100;
