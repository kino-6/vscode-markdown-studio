import sanitizeHtml from 'sanitize-html';

const blockedTags = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed']);

export function sanitizeSvg(input: string): string {
  const strippedBlockedTags = input.replace(/<\/?\s*([a-zA-Z0-9:-]+)([^>]*)>/g, (match, tagName) => {
    const normalized = String(tagName).toLowerCase();
    return blockedTags.has(normalized) ? '' : match;
  });

  const sanitized = sanitizeHtml(strippedBlockedTags, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'svg',
      'g',
      'path',
      'circle',
      'ellipse',
      'rect',
      'line',
      'polyline',
      'polygon',
      'text',
      'tspan',
      'defs',
      'marker',
      'style',
      'symbol',
      'use',
      'image',
      'title',
      'desc'
    ]),
    allowVulnerableTags: true,
    allowedAttributes: {
      '*': [
        'id',
        'class',
        'style',
        'fill',
        'stroke',
        'stroke-width',
        'stroke-dasharray',
        'stroke-linecap',
        'stroke-linejoin',
        'stroke-opacity',
        'fill-opacity',
        'opacity',
        'd',
        'cx',
        'cy',
        'r',
        'rx',
        'ry',
        'x',
        'y',
        'x1',
        'x2',
        'y1',
        'y2',
        'dx',
        'dy',
        'width',
        'height',
        'viewBox',
        'transform',
        'xmlns',
        'xmlns:xlink',
        'xlink:href',
        'href',
        'points',
        'preserveAspectRatio',
        'font-family',
        'font-size',
        'font-weight',
        'font-style',
        'text-anchor',
        'text-decoration',
        'dominant-baseline',
        'alignment-baseline',
        'lengthAdjust',
        'textLength',
        'letter-spacing',
        'word-spacing',
        'marker-end',
        'marker-start',
        'marker-mid',
        'clip-path',
        'clip-rule',
        'fill-rule',
        'color',
        'display',
        'visibility',
        'overflow',
        'version',
        'contentStyleType'
      ]
    },
    allowedSchemes: ['data'],
    allowedStyles: {
      '*': {
        'stroke': [/.*/],
        'stroke-width': [/.*/],
        'stroke-dasharray': [/.*/],
        'fill': [/.*/],
        'font-family': [/.*/],
        'font-size': [/.*/],
        'font-weight': [/.*/],
        'font-style': [/.*/],
        'text-anchor': [/.*/],
        'width': [/.*/],
        'height': [/.*/],
        'background': [/.*/],
        'color': [/.*/],
        'opacity': [/.*/],
        'display': [/.*/],
        'visibility': [/.*/],
      }
    },
    parser: { lowerCaseTags: true }
  });

  return sanitized
    .replace(/\son[a-z]+=(["']).*?\1/gi, '')
    .replace(/\s(href|xlink:href)=(["'])\s*javascript:[^"']*\2/gi, '')
    .replace(/\s(href|xlink:href)=(["'])https?:\/\/[^"']*\2/gi, '');
}
