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
      'title',
      'desc'
    ]),
    allowedAttributes: {
      '*': [
        'id',
        'class',
        'style',
        'fill',
        'stroke',
        'stroke-width',
        'd',
        'cx',
        'cy',
        'r',
        'x',
        'y',
        'x1',
        'x2',
        'y1',
        'y2',
        'width',
        'height',
        'viewBox',
        'transform',
        'xmlns',
        'xmlns:xlink',
        'xlink:href',
        'href',
        'points'
      ]
    },
    allowedSchemes: ['data'],
    parser: { lowerCaseTags: true }
  });

  return sanitized
    .replace(/\son[a-z]+=(["']).*?\1/gi, '')
    .replace(/\s(href|xlink:href)=(["'])\s*javascript:[^"']*\2/gi, '')
    .replace(/\s(href|xlink:href)=(["'])https?:\/\/[^"']*\2/gi, '');
}
