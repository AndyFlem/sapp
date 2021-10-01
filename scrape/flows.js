const axios = require('axios').default
const { DateTime } = require("luxon")
const fs = require('fs');
const market = 3
const cats=[5,18,19,22]
const prefs=['dam','fpm','fpw']

getFlows().then(() => {
  console.log('OK')
})

async function getFlows() {
  let curDate
  
  curDate = DateTime.fromISO( '2016-01-01')

  let files=fs.readdirSync('../input/flows/' + prefs[market-1])
  if (files.length>0) {
    const lastFile=files.sort()[files.length-1]
    curDate=DateTime.fromObject({year: lastFile.slice(4,8), month:lastFile.slice(9,11)}).endOf('month').plus({day:1})
  }
  

  console.log(curDate.toISODate())
  let csvData=[]

  while (curDate <= DateTime.fromISO( '2021-10-01')) 
  {
    let period = 1

    while (period < 25) {
      const url=`http://www.sappmarket.com/Home/GetFlow?deliveryDate=${curDate.toFormat('yyyy/LL/dd')}&periodId=${period}&categoryId=${cats[market-1]}&marketId=${market}`
      console.log(url)
    
      let response = await axios.get(url)
      //console.log(response.data.excelData)

      response.data.data.forEach(e => {
        if (e.FlowResult>0) {
          const oIns = {date: curDate.toISODate(),  hour: period-1, flow: e.FlowResult,from: e.FromAreaName, to: e.ToAreaName}
          csvData.push(oIns)
        } 
      })
      period++
    }
    curDate=curDate.plus({ days: 1 })
    if (curDate.day==1) {
      console.log(csvData)
      fs.writeFileSync('../input/flows/' + prefs[market-1] + '/' + prefs[market-1] + '_' + curDate.minus({ days: 1 }).toFormat('yyyy_LL') + '.json', JSON.stringify(csvData))
      csvData=[]
    }
  } 
  
  return Promise.resolve()

}