const { DateTime, Interval } = require("luxon")
const fs = require('fs');

const prefs=['dam','fpm','fpw', 'idm']

const market = 4
const type = 'price' // 'price' //

const startDate = DateTime.fromISO('2023-07-01')
const endDate = startDate.plus({month:1}).minus({day:1})

const rawfolder = '../input/raw_' + type + '/' + market + '/' + startDate.toFormat('yyyy_LL')
const outfile = prefs[market-1] + '_' + startDate.toFormat('yyyy_LL') + '.json'
const out = '../input/' + type + '/' + prefs[market-1] + '/' + outfile 

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
      let oIns

      if (type == 'flow') {
        if (e.FlowResult>0) {
          oIns = { date: dte,  hour: parseInt(hour.split('.')[0]), flow: e.FlowResult,from: e.FromAreaName, to: e.ToAreaName }
          csvData.push(oIns)
        }
      } else {
        oIns = {date: dte,  hour: parseInt(hour.split('.')[0]), price: e.AreaPrice,area: e.AreaShortName}
        csvData.push(oIns)
      }
    })
  }
}

console.log(out)
fs.writeFileSync(out, JSON.stringify(csvData))
