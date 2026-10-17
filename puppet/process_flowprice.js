// Builds monthly JSON files from the hourly raw scrape files.
//
//   input/raw_<type>/<market>/<yyyy_LL>/<yyyy-LL-dd>/<hour>.json  ->  input/<type>/<pref>/<pref>_<yyyy_LL>.json
//
// By default every type/market/month with raw data but no monthly file is built.
// Months that have not finished yet are skipped, since they would never be rebuilt once written.
//
// Usage: node process_flowprice.js [--type flow|price] [--market 1-4] [--month yyyy-LL] [--force] [--include-partial]
//   --force            rebuild even if the monthly file already exists
//   --include-partial  also build months that have not finished yet

const { DateTime } = require("luxon")
const fs = require('fs')
const path = require('path')

const prefs = ['dam', 'fpm', 'fpw', 'idm']
const types = ['flow', 'price']
const inputDir = path.join(__dirname, '..', 'input')

function parseArgs(argv) {
  const opts = { types, markets: prefs.map((_, i) => i + 1), month: null, force: false, includePartial: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg == '--type') {
      const t = argv[++i]
      if (!types.includes(t)) throw new Error('--type must be one of ' + types.join(', '))
      opts.types = [t]
    } else if (arg == '--market') {
      const m = parseInt(argv[++i])
      if (!(m >= 1 && m <= prefs.length)) throw new Error('--market must be 1-' + prefs.length)
      opts.markets = [m]
    } else if (arg == '--month') {
      const m = DateTime.fromFormat(argv[++i] || '', 'yyyy-LL')
      if (!m.isValid) throw new Error('--month must be yyyy-LL, e.g. 2025-01')
      opts.month = m.toFormat('yyyy_LL')
    } else if (arg == '--force') {
      opts.force = true
    } else if (arg == '--include-partial') {
      opts.includePartial = true
    } else {
      throw new Error('Unknown argument: ' + arg)
    }
  }
  return opts
}

function listDir(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir) : []
}

function hourOf(file) {
  const m = file.match(/^(\d+)\.json$/)
  return m ? parseInt(m[1]) : null
}

function toRows(type, dte, hour, data) {
  if (type == 'flow') {
    // Each connection is reported in both directions with mirrored signs, so keeping
    // positive flows only gives one row per actual flow
    return data
      .filter(e => e.FlowResult > 0)
      .map(e => ({ date: dte, hour, flow: e.FlowResult, from: e.FromAreaName, to: e.ToAreaName }))
  }
  return data.map(e => ({ date: dte, hour, price: e.AreaPrice, area: e.AreaShortName }))
}

function processMonth(type, market, month) {
  const startDate = DateTime.fromFormat(month, 'yyyy_LL')
  const rawfolder = path.join(inputDir, 'raw_' + type, String(market), month)
  const out = path.join(inputDir, type, prefs[market - 1], prefs[market - 1] + '_' + month + '.json')

  const warnings = []
  const rows = []

  const expectedDays = []
  for (let d = startDate; d.hasSame(startDate, 'month'); d = d.plus({ day: 1 })) expectedDays.push(d.toISODate())

  const dtes = listDir(rawfolder).filter(d => DateTime.fromISO(d).isValid).sort()
  const missingDays = expectedDays.filter(d => !dtes.includes(d))
  if (missingDays.length) warnings.push('missing days: ' + missingDays.join(', '))
  const strayDays = dtes.filter(d => !expectedDays.includes(d))
  if (strayDays.length) warnings.push('days outside month ignored: ' + strayDays.join(', '))

  for (const dte of dtes.filter(d => expectedDays.includes(d))) {
    const hours = listDir(path.join(rawfolder, dte))
      .map(f => ({ file: f, hour: hourOf(f) }))
      .filter(h => h.hour !== null && h.hour >= 0 && h.hour <= 23)
      .sort((a, b) => a.hour - b.hour)

    const missingHours = []
    for (let h = 0; h < 24; h++) if (!hours.some(x => x.hour == h)) missingHours.push(h)
    if (missingHours.length) warnings.push(dte + ' missing hours: ' + missingHours.join(', '))

    let dayRows = 0
    for (const { file, hour } of hours) {
      const fullPath = path.join(rawfolder, dte, file)
      let data
      try {
        data = JSON.parse(fs.readFileSync(fullPath)).data
        if (!Array.isArray(data)) throw new Error('no data array')
      } catch (err) {
        warnings.push(dte + ' hour ' + hour + ' skipped (' + err.message + ')')
        continue
      }
      const hourRows = toRows(type, dte, hour, data)
      dayRows += hourRows.length
      rows.push(...hourRows)
    }
    console.log('  ' + dte + ': ' + hours.length + ' hours, ' + dayRows + ' rows')
  }

  fs.mkdirSync(path.dirname(out), { recursive: true })
  // Write to a temp file first so an interrupted run never leaves a truncated file that looks complete
  const tmp = out + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(rows))
  fs.renameSync(tmp, out)

  return { out, rows: rows.length, warnings }
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const currentMonth = DateTime.now().toFormat('yyyy_LL')
  const summary = { built: [], skippedPartial: [], warned: [] }

  for (const type of opts.types) {
    for (const market of opts.markets) {
      const months = listDir(path.join(inputDir, 'raw_' + type, String(market)))
        .filter(m => DateTime.fromFormat(m, 'yyyy_LL').isValid)
        .filter(m => !opts.month || m == opts.month)
        .sort()

      for (const month of months) {
        const label = type + ' ' + prefs[market - 1] + ' ' + month
        const out = path.join(inputDir, type, prefs[market - 1], prefs[market - 1] + '_' + month + '.json')

        if (fs.existsSync(out) && !opts.force) continue
        if (month >= currentMonth && !opts.includePartial) {
          summary.skippedPartial.push(label)
          continue
        }

        console.log('Building ' + label)
        const result = processMonth(type, market, month)
        console.log('  -> ' + result.out + ' (' + result.rows + ' rows)')
        result.warnings.forEach(w => console.warn('  WARN ' + w))
        summary.built.push(label)
        if (result.warnings.length) summary.warned.push(label)
      }
    }
  }

  console.log('\nBuilt ' + summary.built.length + ' file(s)' + (summary.built.length ? ': ' + summary.built.join(', ') : ''))
  if (summary.warned.length) console.log('With warnings: ' + summary.warned.join(', '))
  if (summary.skippedPartial.length) console.log('Skipped unfinished month(s) (use --include-partial): ' + summary.skippedPartial.join(', '))
}

try {
  main()
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
