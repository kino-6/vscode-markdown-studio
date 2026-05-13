# Markdown Studio — Math And Local Assets Example

This example is a small, redistributable version of cases that started in the local Markdown corpus. It focuses on two workflows that often break in Preview/PDF tools: KaTeX math and local relative assets.

[[toc]]

## KaTeX Math

Inline math should render inside normal prose: $E = mc^2$ and $\alpha + \beta = \gamma$.

Currency should remain ordinary text: The total is $12.50 and should not become math.

Display math:

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

$$
\begin{aligned}
a^2 + b^2 &= c^2 \\
\sum_{i=1}^{n} i &= \frac{n(n+1)}{2}
\end{aligned}
$$

## Math In Tables And Lists

| Name | Formula | Notes |
| --- | --- | --- |
| Area | $A = \pi r^2$ | Inline math in a table cell |
| Normal distribution | $N(\mu,\sigma^2)$ | Greek letters and parentheses |

- Inline list math: $f(x)=x^2+1$.
- Longer inline math: $\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$.

## Local Relative Images

Images with relative paths should resolve in Preview and PDF.

![Logo with spaces](images/local asset sample.svg)

![Nested local asset](images/nested/local-asset.svg)

Inline HTML images should resolve too:

<img src="images/local asset sample.svg" width="180" alt="Inline HTML local asset">

## Local Links

[Open the nested image](images/nested/local-asset.svg)

## Missing Local Asset

A missing local image should not crash Preview or PDF export:

![Missing image](images/missing-local-asset.png)
