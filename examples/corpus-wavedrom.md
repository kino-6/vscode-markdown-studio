# WaveDrom Corpus Example

This redistributable example covers the WaveDrom cases Markdown Studio supports in Preview and PDF export.

## Basic Clock And Bus

```wavedrom
{ signal: [
  { name: "clk", wave: "p......" },
  { name: "req", wave: "0.1..0." },
  { name: "ack", wave: "0..1.0." },
  { name: "bus", wave: "x.34.5x", data: ["addr", "read", "data"] }
]}
```

## Alias: wavejson

```wavejson
{ signal: [
  ["Control",
    { name: "enable", wave: "0.1...." },
    { name: "ready", wave: "0...1.." }
  ],
  ["Data",
    { name: "data", wave: "x.345.x", data: ["A0", "A1", "B0", "B1"] }
  ]
]}
```

## Alias: wavedrom-json

```wavedrom-json
{
  "signal": [
    { "name": "clk", "wave": "P......" },
    { "name": "valid", "wave": "0.1.0.." },
    { "name": "payload", "wave": "x.=.x..", "data": ["packet"] }
  ]
}
```

## Invalid Source

Invalid WaveJSON should render as an inline error instead of breaking the whole preview.

```wavedrom
{ signal: [
```
