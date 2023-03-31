const axios = require('axios').default
const { DateTime } = require("luxon")
const fs = require('fs');
const market = 4
const cats=[5,18,19,5]
const prefs=['dam','fpm','fpw', 'idm']

const folder = '../input/flows/' + prefs[market-1] + '/'

getFlows().then(() => {
  console.log('OK')
})

async function getFlows() {
  let curDate
  let lastDate
  curDate = DateTime.fromISO('2020-01-01')
  
  let files=fs.readdirSync('../input/flows/' + prefs[market-1])
  if (files.length>0) {
    const lastFile=files.sort()[files.length-1]
    console.log("Last file: " + lastFile)
    const lastData=JSON.parse(fs.readFileSync(folder + lastFile))
    console.log(lastData)
    if (lastData.length==0) {
      const dte = lastFile.split('.')[0]
      lastDate=dte.split('_')[1] + '-' + dte.split('_')[2] + '-01'
      curDate=DateTime.fromISO(lastDate).plus({month:1})
    } else {
      lastDate=lastData[lastData.length-1].date
      curDate=DateTime.fromISO(lastDate).plus({day:1})
    }
  }
  console.log("Start date:", curDate.toISODate())
  
  let csvData=[]

  while (curDate <= DateTime.now()) 
  {
    let period = 11

    while (period < 35) {
      const url=`http://www.sappmarket.com/Home/GetFlow?deliveryDate=${curDate.toFormat('yyyy/LL/dd')}&periodId=${period}&categoryId=${cats[market-1]}&marketId=${market}`
      // const url=`http://www.sappmarket.com/Home/GetAreaPrice?deliveryDate=${curDate.toFormat('yyyy/LL/dd')}&periodId=${period}&currencyId=1&marketId=${market}`
      console.log(url)
    
      let response = await axios.get(url)
   
      response.data.data.forEach(e => {
          const oIns = {date: curDate.toISODate(),  hour: period-11, flow: e.FlowResult,from: e.FromAreaName, to: e.ToAreaName}
          csvData.push(oIns)
      })
      period++
    }
    console.log(csvData)
    fs.writeFileSync(folder + prefs[market-1] + '_' + curDate.toFormat('yyyy_LL') + '.json', JSON.stringify(csvData))

    curDate=curDate.plus({ days: 1 })
    if (curDate.day==1) {
      csvData=[]
    }    
  } 
  
  return Promise.resolve()

}