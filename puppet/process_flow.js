const { DateTime, Interval } = require("luxon")
const fs = require('fs');

const prefs=['dam','fpm','fpw', 'idm']

const market = 4
const startDate = DateTime.fromISO('2023-05-01')
const endDate = startDate.plus({month:1}).minus({day:1})

const rawfolder = '../input/raw/' + market + '/' + startDate.toFormat('yyyy_LL')
const outfile = prefs[market-1] + '_' + startDate.toFormat('yyyy_LL') + '.json'
const out = '../input/flows/' + prefs[market-1] + '/' + outfile 

console.log('Start date: ', startDate.toISODate())
console.log('End date: ', endDate.toISODate())
console.log('Input: ', rawfolder)
console.log('Output: ', out)

let dtes=fs.readdirSync(rawfolder).sort()
let csvData = []

for (const dte of dtes) {
  let hours = fs.readdirSync(rawfolder + '/' + dte)
  
  hours.sort((a,b) => parseInt(a.split('.')[0]) - parseInt(b.split('.')[0]) )
  for (const hour of hours) {
    console.log(dte, ' ', hour)
    const data=JSON.parse(fs.readFileSync(rawfolder + '/' + dte + '/' + hour)).data
    
    data.forEach(e => {
      if (e.FlowResult>0) {
        const oIns = {date: dte,  hour: parseInt(hour.split('.')[0]), flow: e.FlowResult,from: e.FromAreaName, to: e.ToAreaName}
        csvData.push(oIns)
      }
    })
  }
}

fs.writeFileSync(out, JSON.stringify(csvData))
