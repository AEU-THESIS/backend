// Renders the bar chart that sits inside the exported workbooks.
//
// ExcelJS has no native chart API, so the chart is embedded as a picture —
// the same trick the client used with an off-screen Chart.js canvas before
// export moved server-side. There is no canvas here, so the chart is drawn as
// plain SVG and rasterised with sharp (already a dependency, for image
// uploads), which keeps the export free of native chart/canvas packages.

import sharp from 'sharp'

export interface BarChartPoint {
  label: string
  value: number
}

export interface BarChartOptions {
  title: string
  /** Prefixed to every y-axis tick, e.g. the shop's currency symbol. */
  valuePrefix?: string
  barColor?: string
  width?: number
  height?: number
}

const DEFAULT_WIDTH = 900
const DEFAULT_HEIGHT = 380
const DEFAULT_BAR_COLOR = '#B45309'
const AXIS_COLOR = '#E5E7EB'
const TEXT_COLOR = '#666666'
const FONT_STACK = 'Arial, Helvetica, sans-serif'

// Chart.js draws a category band per point and fills 72% of it
// (categoryPercentage 0.8 x barPercentage 0.9); matching that keeps the
// exported chart visually identical to the one on screen.
const BAR_FILL_RATIO = 0.72
const BAR_CORNER_RADIUS = 4
/** Beyond this, x labels are thinned out the way Chart.js auto-skips them. */
const MAX_X_LABELS = 16

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

/** Rounds a raw axis step up to the next 1/2/5 x 10^n, so ticks read cleanly. */
const niceStep = (rough: number) => {
  if (!(rough > 0)) return 1
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  if (normalized <= 1) return magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 5) return 5 * magnitude
  return 10 * magnitude
}

const formatTick = (value: number, step: number) => {
  // Show only as many decimals as the step actually needs, so a $2 step reads
  // "$4" rather than "$4.00".
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)))
  return value.toFixed(decimals)
}

/**
 * Builds an inclusive tick scale that always contains zero (Chart.js
 * `beginAtZero`), so a bar's height reads as its full value and a negative
 * value drops below the zero line.
 */
const buildScale = (values: number[]) => {
  const rawMin = Math.min(0, ...values)
  const rawMax = Math.max(0, ...values)
  if (rawMin === 0 && rawMax === 0) return { min: 0, max: 1, step: 1, ticks: [0, 1] }

  const step = niceStep((rawMax - rawMin) / 5)
  const min = Math.floor(rawMin / step) * step
  const max = Math.ceil(rawMax / step) * step
  const ticks: number[] = []
  // Accumulating with multiplication rather than repeated addition keeps
  // floating-point drift out of the tick labels.
  for (let i = 0; min + i * step <= max + step / 2; i++) ticks.push(min + i * step)
  return { min, max: ticks[ticks.length - 1], step, ticks }
}

/** A bar with its outer end rounded, matching Chart.js `borderRadius`. */
const barPath = (x: number, y: number, width: number, height: number, negative: boolean) => {
  const radius = Math.min(BAR_CORNER_RADIUS, width / 2, height)
  if (height <= 0) return ''
  if (negative) {
    return [
      `M${x} ${y}`,
      `h${width}`,
      `v${height - radius}`,
      `a${radius} ${radius} 0 0 1 ${-radius} ${radius}`,
      `h${-(width - 2 * radius)}`,
      `a${radius} ${radius} 0 0 1 ${-radius} ${-radius}`,
      'Z',
    ].join(' ')
  }
  return [
    `M${x} ${y + height}`,
    `v${-(height - radius)}`,
    `a${radius} ${radius} 0 0 1 ${radius} ${-radius}`,
    `h${width - 2 * radius}`,
    `a${radius} ${radius} 0 0 1 ${radius} ${radius}`,
    `v${height - radius}`,
    'Z',
  ].join(' ')
}

const buildSvg = (points: BarChartPoint[], options: BarChartOptions) => {
  const width = options.width ?? DEFAULT_WIDTH
  const height = options.height ?? DEFAULT_HEIGHT
  const barColor = options.barColor ?? DEFAULT_BAR_COLOR
  const prefix = options.valuePrefix ?? ''

  const scale = buildScale(points.map(point => point.value))
  const tickLabels = scale.ticks.map(tick => `${prefix}${formatTick(tick, scale.step)}`)
  // ~7px per character is a close enough advance width for the tick font to
  // reserve a gutter without measuring glyphs.
  const gutter = Math.max(...tickLabels.map(label => label.length)) * 7 + 16

  const padding = { top: 48, right: 24, bottom: 46, left: gutter }
  const plotWidth = Math.max(1, width - padding.left - padding.right)
  const plotHeight = Math.max(1, height - padding.top - padding.bottom)
  const yOf = (value: number) =>
    padding.top + plotHeight * (1 - (value - scale.min) / (scale.max - scale.min))

  const parts: string[] = []
  parts.push(`<rect width="${width}" height="${height}" fill="#FFFFFF"/>`)
  parts.push(
    `<text x="${width / 2}" y="26" text-anchor="middle" font-family="${FONT_STACK}" font-size="16" font-weight="bold" fill="#333333">${escapeXml(options.title)}</text>`
  )

  for (let i = 0; i < scale.ticks.length; i++) {
    const y = yOf(scale.ticks[i])
    parts.push(
      `<line x1="${padding.left}" y1="${y}" x2="${padding.left + plotWidth}" y2="${y}" stroke="${AXIS_COLOR}" stroke-width="1"/>`
    )
    parts.push(
      `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-family="${FONT_STACK}" font-size="12" fill="${TEXT_COLOR}">${escapeXml(tickLabels[i])}</text>`
    )
  }

  const zeroY = yOf(0)
  parts.push(
    `<line x1="${padding.left}" y1="${zeroY}" x2="${padding.left + plotWidth}" y2="${zeroY}" stroke="#D1D5DB" stroke-width="1"/>`
  )

  const band = plotWidth / Math.max(1, points.length)
  const barWidth = Math.max(1, band * BAR_FILL_RATIO)
  const labelStride = Math.ceil(points.length / MAX_X_LABELS)

  points.forEach((point, index) => {
    const center = padding.left + band * (index + 0.5)
    const valueY = yOf(point.value)
    const top = Math.min(valueY, zeroY)
    const barHeight = Math.abs(valueY - zeroY)
    const path = barPath(center - barWidth / 2, top, barWidth, barHeight, point.value < 0)
    if (path) parts.push(`<path d="${path}" fill="${barColor}"/>`)

    if (index % labelStride === 0) {
      parts.push(
        `<text x="${center}" y="${padding.top + plotHeight + 20}" text-anchor="middle" font-family="${FONT_STACK}" font-size="12" fill="${TEXT_COLOR}">${escapeXml(point.label)}</text>`
      )
    }
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`
}

/** Renders the chart to PNG bytes, ready for `workbook.addImage`. */
export const renderBarChartPng = async (
  points: BarChartPoint[],
  options: BarChartOptions
): Promise<Buffer> =>
  sharp(Buffer.from(buildSvg(points, options)))
    .png()
    .toBuffer()
