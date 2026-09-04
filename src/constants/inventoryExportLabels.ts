/**
 * Copy for the inventory Excel exports, in the locales the client ships.
 *
 * Workbook generation moved from the browser to the API, so the strings that
 * used to come from vue-i18n (`inventory.expenseReport.excel.*`,
 * `inventory.history.excel.*`) live here instead and are picked by the
 * `locale` query parameter. Keep both locales in step with the client's
 * `src/i18n/locales/{en,kh}.json`, exactly as those two files are kept in step
 * with each other.
 */

export const EXPORT_LOCALES = ['en', 'kh'] as const
export type ExportLocale = (typeof EXPORT_LOCALES)[number]

/** BCP 47 tag used for the locale's date/number formatting inside a workbook. */
export const INTL_LOCALE_OF: Record<ExportLocale, string> = {
  en: 'en',
  kh: 'km-KH',
}

export interface ExpenseReportLabels {
  title: string
  subtitle: string
  filterLine: string
  allItems: string
  groupByDay: string
  kpiTotalSpend: string
  kpiTotalSpendCaption: string
  kpiTransactions: string
  kpiTransactionsCaption: string
  kpiAverage: string
  kpiAverageCaption: string
  /** Section heading above the embedded chart (the on-screen card's title). */
  chartTitle: string
  chartLabel: string
  purchaseHistory: string
  multiMonthNote: string
  tableDate: string
  tableItem: string
  tableQuantity: string
  tableUnitCost: string
  tableTotal: string
  totalRow: string
  footerHeading: string
  footerBody: string
}

export interface StockHistoryLabels {
  /** Sheet-tab name for the main sheet (the un-personalised page title). */
  sheetName: string
  title: string
  subtitle: string
  filterLine: string
  kpiCurrentStock: string
  kpiCurrentStockCaption: string
  kpiTotalIn: string
  kpiTotalInCaption: string
  kpiTotalOut: string
  kpiTotalOutCaption: string
  chartTitle: string
  chartLabel: string
  movementHistory: string
  multiMonthNote: string
  tableDate: string
  tableType: string
  tableQuantity: string
  tableUnit: string
  tableValue: string
  tableUnitCost: string
  tableNotes: string
  tableBy: string
  typeAdd: string
  typeRemove: string
  totalRow: string
  footerHeading: string
  footerBody: string
  filterTypeIn: string
  filterTypeOut: string
  filterTypeBoth: string
}

export interface InventoryExportLabels {
  /** Month abbreviations for the per-month sheet tabs. */
  monthsShort: readonly string[]
  expenseReport: ExpenseReportLabels
  stockHistory: StockHistoryLabels
}

const EN: InventoryExportLabels = {
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  expenseReport: {
    title: 'Expense Report',
    subtitle: 'Purchase spend on restocking — not profit or cost of goods sold.',
    filterLine:
      'Date Range: {start} → {end}   •   Item: {item}   •   Group By: {groupBy}   •   Currency: {currency}',
    allItems: 'All Items',
    groupByDay: 'Day',
    kpiTotalSpend: 'TOTAL PURCHASE SPEND',
    kpiTotalSpendCaption: '{count} purchases',
    kpiTransactions: 'PURCHASE TRANSACTIONS',
    kpiTransactionsCaption: 'Stock-in / stock-increase records',
    kpiAverage: 'AVERAGE PURCHASE',
    kpiAverageCaption: 'Average per transaction',
    chartTitle: 'Spend Over Time',
    chartLabel: 'Daily Purchase Spend',
    purchaseHistory: 'Purchase History',
    multiMonthNote:
      'This range spans multiple months — see the monthly sheets below for the full record list.',
    tableDate: 'Date',
    tableItem: 'Item',
    tableQuantity: 'Quantity',
    tableUnitCost: 'Unit Cost',
    tableTotal: 'Total',
    totalRow: 'TOTAL',
    footerHeading: 'REPORT SCOPE  •  PURCHASE SPEND ONLY',
    footerBody:
      'Includes stock-in and stock-increase history records for the selected period. This report does not calculate profit, COGS, or current inventory value.',
  },
  stockHistory: {
    sheetName: 'Stock History',
    title: 'Stock History — {item}',
    subtitle: 'Stock movement history — additions and removals.',
    filterLine:
      'Date Range: {start} → {end}   •   Item: {item}   •   Type: {type}   •   Unit: {unit}   •   Category: {category}',
    kpiCurrentStock: 'CURRENT STOCK',
    kpiCurrentStockCaption: 'Value: {value}',
    kpiTotalIn: 'TOTAL IN',
    kpiTotalInCaption: 'Stock added this period',
    kpiTotalOut: 'TOTAL OUT',
    kpiTotalOutCaption: 'Stock consumed this period',
    chartTitle: 'Value Over Time',
    chartLabel: 'Daily Net Value Change',
    movementHistory: 'Movement History',
    multiMonthNote:
      'This range spans multiple months — see the monthly sheets below for the full movement list.',
    tableDate: 'Date',
    tableType: 'Type',
    tableQuantity: 'Quantity',
    tableUnit: 'Unit',
    tableValue: 'Value',
    tableUnitCost: 'Unit Cost',
    tableNotes: 'Notes',
    tableBy: 'By',
    typeAdd: 'Add',
    typeRemove: 'Remove',
    totalRow: 'TOTAL',
    footerHeading: 'REPORT SCOPE  •  STOCK MOVEMENT HISTORY ONLY',
    footerBody:
      'Includes stock additions and removals for {item} in the selected period. Does not reflect shop-wide inventory value or other items.',
    filterTypeIn: 'In',
    filterTypeOut: 'Out',
    filterTypeBoth: 'Both',
  },
}

const KH: InventoryExportLabels = {
  monthsShort: [
    'មករា',
    'កុម្ភៈ',
    'មីនា',
    'មេសា',
    'ឧសភា',
    'មិថុនា',
    'កក្កដា',
    'សីហា',
    'កញ្ញា',
    'តុលា',
    'វិច្ឆិកា',
    'ធ្នូ',
  ],
  expenseReport: {
    title: 'របាយការណ៍ចំណាយ',
    subtitle: 'ចំណាយទិញស្តុកឡើងវិញ — មិនមែនប្រាក់ចំណេញ ឬថ្លៃដើមទំនិញលក់ទេ។',
    filterLine:
      'ចន្លោះកាលបរិច្ឆេទ៖ {start} → {end}   •   មុខទំនិញ៖ {item}   •   ដាក់ជាក្រុមតាម៖ {groupBy}   •   រូបិយប័ណ្ណ៖ {currency}',
    allItems: 'មុខទំនិញទាំងអស់',
    groupByDay: 'ថ្ងៃ',
    kpiTotalSpend: 'ចំណាយទិញស្តុកសរុប',
    kpiTotalSpendCaption: '{count} ដងទិញ',
    kpiTransactions: 'ចំនួនប្រតិបត្តិការទិញ',
    kpiTransactionsCaption: 'កំណត់ត្រាបញ្ចូល / បង្កើនស្តុក',
    kpiAverage: 'ចំណាយជាមធ្យមក្នុងមួយដង',
    kpiAverageCaption: 'ជាមធ្យមក្នុងមួយប្រតិបត្តិការ',
    chartTitle: 'ចំណាយតាមពេលវេលា',
    chartLabel: 'ចំណាយទិញប្រចាំថ្ងៃ',
    purchaseHistory: 'ប្រវត្តិការទិញ',
    multiMonthNote: 'ចន្លោះពេលនេះលើសពីមួយខែ — សូមមើលសន្លឹកប្រចាំខែខាងក្រោមសម្រាប់បញ្ជីពេញលេញ។',
    tableDate: 'កាលបរិច្ឆេទ',
    tableItem: 'មុខទំនិញ',
    tableQuantity: 'បរិមាណ',
    tableUnitCost: 'តម្លៃក្នុងមួយឯកតា',
    tableTotal: 'សរុប',
    totalRow: 'សរុប',
    footerHeading: 'វិសាលភាពរបាយការណ៍  •  ចំណាយទិញស្តុកតែប៉ុណ្ណោះ',
    footerBody:
      'រួមបញ្ចូលកំណត់ត្រាបញ្ចូល និងបង្កើនស្តុកសម្រាប់រយៈពេលដែលបានជ្រើសរើស។ របាយការណ៍នេះមិនគណនាប្រាក់ចំណេញ ថ្លៃដើមទំនិញលក់ ឬតម្លៃសារពើភ័ណ្ឌបច្ចុប្បន្នទេ។',
  },
  stockHistory: {
    sheetName: 'ប្រវត្តិស្តុក',
    title: 'ប្រវត្តិស្តុក — {item}',
    subtitle: 'ប្រវត្តិចលនាស្តុក — ការបញ្ចូល និងការដក។',
    filterLine:
      'ចន្លោះកាលបរិច្ឆេទ៖ {start} → {end}   •   មុខទំនិញ៖ {item}   •   ប្រភេទ៖ {type}   •   ឯកតា៖ {unit}   •   ប្រភេទទំនិញ៖ {category}',
    kpiCurrentStock: 'ស្តុកបច្ចុប្បន្ន',
    kpiCurrentStockCaption: 'តម្លៃ៖ {value}',
    kpiTotalIn: 'បញ្ចូលសរុប',
    kpiTotalInCaption: 'ស្តុកបានបញ្ចូលក្នុងរយៈពេលនេះ',
    kpiTotalOut: 'ដកសរុប',
    kpiTotalOutCaption: 'ស្តុកបានប្រើប្រាស់ក្នុងរយៈពេលនេះ',
    chartTitle: 'តម្លៃតាមពេលវេលា',
    chartLabel: 'ការផ្លាស់ប្តូរតម្លៃសុទ្ធប្រចាំថ្ងៃ',
    movementHistory: 'ប្រវត្តិចលនាស្តុក',
    multiMonthNote: 'ចន្លោះពេលនេះលើសពីមួយខែ — សូមមើលសន្លឹកប្រចាំខែខាងក្រោមសម្រាប់បញ្ជីពេញលេញ។',
    tableDate: 'កាលបរិច្ឆេទ',
    tableType: 'ប្រភេទ',
    tableQuantity: 'បរិមាណ',
    tableUnit: 'ឯកតា',
    tableValue: 'តម្លៃ',
    tableUnitCost: 'តម្លៃក្នុងមួយឯកតា',
    tableNotes: 'កំណត់ចំណាំ',
    tableBy: 'ដោយ',
    typeAdd: 'បញ្ចូល',
    typeRemove: 'ដក',
    totalRow: 'សរុប',
    footerHeading: 'វិសាលភាពរបាយការណ៍  •  ប្រវត្តិចលនាស្តុកតែប៉ុណ្ណោះ',
    footerBody:
      'រួមបញ្ចូលការបញ្ចូល និងការដកស្តុកសម្រាប់ {item} ក្នុងរយៈពេលដែលបានជ្រើសរើស។ មិនឆ្លុះបញ្ចាំងពីតម្លៃសារពើភ័ណ្ឌទាំងមូល ឬមុខទំនិញផ្សេងទៀតទេ។',
    filterTypeIn: 'បញ្ចូល',
    filterTypeOut: 'ដក',
    filterTypeBoth: 'ទាំងពីរ',
  },
}

const LABELS: Record<ExportLocale, InventoryExportLabels> = { en: EN, kh: KH }

export const inventoryExportLabels = (locale: ExportLocale) => LABELS[locale]

/**
 * Fills `{name}` placeholders, mirroring vue-i18n's named interpolation so the
 * strings above can be copied verbatim between the two projects. An unmatched
 * placeholder is left as-is rather than blanked, which makes a missing
 * parameter obvious in the generated file.
 */
export const interpolate = (template: string, params: Record<string, string | number> = {}) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  )
