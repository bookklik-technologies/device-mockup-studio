/** Header geometry from the workspace logo.svg; uses no external asset URL. */
export function brandMark(doc: Document): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 455 455');
  svg.setAttribute('width', '30');
  svg.setAttribute('height', '30');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const group = doc.createElementNS(ns, 'g');
  group.setAttribute('transform', 'translate(-2040 -755)');
  const path = doc.createElementNS(ns, 'path');
  path.setAttribute('d', 'M2086.4 756 2449.6 756C2474.67 756 2495 776.281 2495 801.3L2495 1073.1C2495 1098.12 2474.67 1118.4 2449.6 1118.4L2449.6 1118.4 2404.2 1118.4 2404.2 1163.7C2404.2 1188.72 2383.87 1209 2358.8 1209 2333.73 1209 2313.4 1188.72 2313.4 1163.7L2313.4 1073.1C2313.4 1048.08 2333.73 1027.8 2358.8 1027.8L2404.2 1027.8 2404.2 846.6 2131.8 846.6 2131.8 1027.8 2177.2 1027.8 2177.2 1027.8 2181.84 1028.03C2204.74 1030.35 2222.6 1049.65 2222.6 1073.1L2222.6 1163.7C2222.6 1188.72 2202.27 1209 2177.2 1209 2152.13 1209 2131.8 1188.72 2131.8 1163.7L2131.8 1118.4 2086.4 1118.4 2086.4 1118.4C2061.33 1118.4 2041 1098.12 2041 1073.1L2041 801.3 2041 801.3 2041.23 796.668C2043.56 773.826 2062.89 756 2086.4 756Z');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('fill-rule', 'evenodd');
  group.append(path);
  svg.append(group);
  return svg;
}
